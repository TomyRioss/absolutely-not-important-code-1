import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type CheckoutBinding = {
  userId: string;
  businessId: string;
  planId: string;
  paymentLinkId: string;
  mode: "sandbox" | "production";
  createdAt: number;
  expiresAt: number;
};

export type RebillSubscription = {
  id: string;
  status: string;
  statusDetail?: string;
  plan?: { id?: string };
  metadata?: Record<string, string>;
};

export function getRebillConfig() {
  const mode: CheckoutBinding["mode"] = process.env.REBILL_MODE?.trim() === "sandbox" ? "sandbox" : "production";
  const apiKey = (mode === "sandbox" ? process.env.REBILL_SANDBOX_SECRET_KEY : process.env.REBILL_SECRET_KEY)?.trim();
  const planId = (mode === "sandbox" ? process.env.REBILL_SANDBOX_PLAN_ID : process.env.REBILL_PLAN_ID)?.trim();
  const templateLinkId = (mode === "sandbox" ? process.env.REBILL_SANDBOX_PAYMENT_LINK_ID : process.env.REBILL_PAYMENT_LINK_ID)?.trim();
  return apiKey && planId && templateLinkId ? { mode, apiKey, planId, templateLinkId } : null;
}

export type RebillConfig = NonNullable<ReturnType<typeof getRebillConfig>>;

export function signCheckout(binding: CheckoutBinding) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing checkout signing secret");
  const value = Buffer.from(JSON.stringify(binding)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`rebill-checkout-v1:${value}`).digest("base64url");
  return `${value}.${signature}`;
}

export function readCheckout(token: unknown): CheckoutBinding | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || typeof token !== "string" || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [value, signature] = parts;
  const expected = createHmac("sha256", secret).update(`rebill-checkout-v1:${value}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const binding = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CheckoutBinding;
    if (![binding.userId, binding.businessId, binding.planId, binding.paymentLinkId].every(value => typeof value === "string" && value.length > 0 && value.length <= 200)) return null;
    if (binding.mode !== "sandbox" && binding.mode !== "production") return null;
    if (!Number.isFinite(binding.createdAt) || !Number.isFinite(binding.expiresAt)) return null;
    if (binding.createdAt > Date.now() + 60_000 || binding.expiresAt <= Date.now() || binding.expiresAt <= binding.createdAt || binding.expiresAt - binding.createdAt > 172_800_000) return null;
    return binding;
  } catch {
    return null;
  }
}

export async function rebillRequest<T>(config: RebillConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.rebill.com/v3/${path}`, {
    ...init,
    headers: { "x-api-key": config.apiKey, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Rebill ${path.split("/")[0]} HTTP ${response.status}`);
  return await response.json() as T;
}

export async function findCheckoutSubscription(config: RebillConfig, binding: CheckoutBinding) {
  const signal = AbortSignal.timeout(15_000);
  for (let offset = 0; ; offset += 100) {
    const page = await rebillRequest<{ records: RebillSubscription[]; pagination?: { hasNextPage?: boolean } }>(config, "subscriptions/search", {
      method: "POST",
      body: JSON.stringify({
        filters: { planId: binding.planId, status: ["active"], createdAt: { startDate: new Date(binding.createdAt - 60_000).toISOString() } },
        pagination: { limit: 100, offset, sort: "created_at", order: "DESC" },
      }),
      signal,
    });
    const found = page.records.find(subscription => subscription.metadata?.paymentLinkId === binding.paymentLinkId);
    if (found) return found.id;
    if (!page.pagination?.hasNextPage || !page.records.length) return null;
  }
}

export async function getSubscriptionBinding(config: RebillConfig, subscription: RebillSubscription) {
  const linkId = subscription.metadata?.paymentLinkId;
  if (!linkId || subscription.plan?.id !== config.planId) return null;
  const link = await rebillRequest<{ metadata?: Record<string, string>; plan?: { id?: string } }>(config, `payment-links/${encodeURIComponent(linkId)}`);
  const binding = readCheckout(link.metadata?.platorestCheckout);
  return binding && binding.mode === config.mode && binding.planId === config.planId
    && binding.paymentLinkId === linkId && link.plan?.id === config.planId ? binding : null;
}
