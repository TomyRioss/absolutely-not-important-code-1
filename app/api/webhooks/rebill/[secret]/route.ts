import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRebillConfig, getSubscriptionBinding, rebillRequest, type RebillSubscription } from "@/lib/rebill-checkout";

type RebillData = { id?: string; subscriptionId?: string; subscription?: { id?: string }; payment?: { id?: string } };

function validSignature(raw: Buffer, received: string | null, secret: string) {
  if (!received || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const actual = Buffer.from(received, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request, { params }: { params: Promise<{ secret: string }> }) {
  try {
    const { secret: pathSecret } = await params;
    const sandbox = process.env.REBILL_MODE?.trim() === "sandbox";
    const expectedPathSecret = (sandbox ? process.env.REBILL_SANDBOX_WEBHOOK_PATH_SECRET : process.env.REBILL_WEBHOOK_PATH_SECRET)?.trim();
    if (!expectedPathSecret || pathSecret !== expectedPathSecret) return NextResponse.json({ error: "not found" }, { status: 404 });
    const raw = Buffer.from(await request.arrayBuffer());
    const signingSecret = (sandbox ? process.env.REBILL_SANDBOX_WEBHOOK_SIGNING_SECRET : process.env.REBILL_WEBHOOK_SIGNING_SECRET)?.trim();
    if (!signingSecret || !validSignature(raw, request.headers.get("x-rebill-signature"), signingSecret)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    let payload: { data?: RebillData; webhook?: { event?: string } } | null;
    try { payload = JSON.parse(raw.toString("utf8")); }
    catch { return NextResponse.json({ error: "invalid payload" }, { status: 400 }); }
    const data = payload?.data;
    const event = payload?.webhook?.event;
    if (!data || !event || !["subscription.created", "subscription.updated", "payment.created", "payment.updated"].includes(event)) return NextResponse.json({ received: true });
    const config = getRebillConfig();
    if (!config) return NextResponse.json({ error: "webhook misconfigured" }, { status: 503 });
    let subscriptionId = data.subscriptionId ?? data.subscription?.id ?? (event.startsWith("subscription.") ? data.id : undefined);
    let paymentStatus: string | undefined;
    if (event.startsWith("payment.")) {
      const paymentId = data.payment?.id ?? data.id;
      if (!paymentId) return NextResponse.json({ received: true });
      const payment = await rebillRequest<{ subscriptionId?: string; status?: string }>(config, `payments/${encodeURIComponent(paymentId)}`);
      subscriptionId = payment.subscriptionId;
      paymentStatus = payment.status?.toLowerCase();
    }
    if (!subscriptionId) return NextResponse.json({ received: true });
    const subscription = await rebillRequest<RebillSubscription>(config, `subscriptions/${encodeURIComponent(subscriptionId)}`);
    const known = await prisma.business.findUnique({ where: { mpSubscriptionId: subscriptionId }, select: { id: true, plan: true } });
    let businessId = known?.id;
    let checkoutLinkId: string | undefined;
    if (!businessId) {
      const binding = await getSubscriptionBinding(config, subscription);
      if (!binding) {
        console.warn("[rebill webhook] unbound subscription ignored", { subscriptionId });
        return NextResponse.json({ received: true });
      }
      const owner = await prisma.membership.findFirst({ where: { userId: binding.userId, businessId: binding.businessId, role: "OWNER" }, select: { businessId: true } });
      businessId = owner?.businessId;
      checkoutLinkId = binding.paymentLinkId;
    }
    if (!businessId) return NextResponse.json({ received: true });
    const status = subscription.status.toLowerCase();
    const revoke = ["paused", "cancelled", "finished", "defaulted"].includes(status)
      || (event === "payment.updated" && ["refunded", "chargeback", "charged_back"].includes(paymentStatus ?? ""));
    const activate = status === "active" && (!event.startsWith("payment.") || paymentStatus === "approved");
    if (revoke) {
      await prisma.business.updateMany({ where: { id: businessId, mpSubscriptionId: subscriptionId }, data: { plan: "trial" } });
    } else if (activate) {
      if (known?.plan !== "pro") {
        const updated = await prisma.business.updateMany({
          where: { id: businessId, OR: [{ plan: "trial" }, { mpSubscriptionId: subscriptionId }] },
          data: { plan: "pro", mpSubscriptionId: subscriptionId, proStartedAt: new Date() },
        });
        if (!updated.count) {
          console.error("[rebill webhook] subscription binding conflict", { businessId, subscriptionId });
          return NextResponse.json({ error: "subscription binding conflict" }, { status: 409 });
        }
      }
      if (checkoutLinkId) {
        await rebillRequest(config, `payment-links/${encodeURIComponent(checkoutLinkId)}`, { method: "PATCH", body: JSON.stringify({ status: "expired" }) })
          .catch(() => console.warn("[rebill webhook] unable to expire completed checkout"));
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[rebill webhook]", error instanceof Error ? error.message : "processing failed");
    return NextResponse.json({ error: "webhook processing failed" }, { status: 502 });
  }
}
