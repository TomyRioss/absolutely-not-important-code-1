import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RebillData = {
  id?: string;
  status?: string;
  lastStatus?: string | null;
  statusDetail?: string | null;
  planId?: string;
  paymentLinkId?: string;
  subscriptionId?: string;
  subscription?: { id?: string; status?: string; metadata?: Record<string, string> };
  customer?: { email?: string };
  payment?: { status?: string; metadata?: Record<string, string> };
  metadata?: Record<string, string>;
  paymentMetadata?: Record<string, string>;
  subscriptionMetadata?: Record<string, string>;
  customAttributes?: Record<string, string>;
};

function validSignature(raw: Buffer, received: string | null, secret: string) {
  if (!received) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const actual = Buffer.from(received, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request, { params }: { params: Promise<{ secret: string }> }) {
  try {
    const { secret: pathSecret } = await params;
    const expectedPathSecret = process.env.REBILL_WEBHOOK_PATH_SECRET?.trim();
    if (!expectedPathSecret || pathSecret !== expectedPathSecret) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const raw = Buffer.from(await request.arrayBuffer());
    const signingSecret = process.env.REBILL_WEBHOOK_SIGNING_SECRET?.trim();
    if (!signingSecret || !validSignature(raw, request.headers.get("x-rebill-signature"), signingSecret)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    let payload: { data?: RebillData; webhook?: { event?: string } };
    try {
      payload = JSON.parse(raw.toString("utf8")) as { data?: RebillData; webhook?: { event?: string } };
    } catch {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }
    const data = payload.data;
    const event = payload.webhook?.event;
    const email = data?.customer?.email?.trim().toLowerCase();
    const metadata = {
      ...data?.customAttributes,
      ...data?.metadata,
      ...data?.payment?.metadata,
      ...data?.paymentMetadata,
      ...data?.subscription?.metadata,
      ...data?.subscriptionMetadata,
    };
    const metadataBusinessId = metadata?.platorestBusinessId?.trim();
    const subscriptionId = data?.subscriptionId ?? data?.subscription?.id ?? data?.id;
    const configuredLink = process.env.REBILL_PAYMENT_LINK_ID?.trim();
    const configuredPlan = process.env.REBILL_PLAN_ID?.trim();
    if (!configuredLink && !configuredPlan) {
      console.error("[webhook rebill] REBILL_PAYMENT_LINK_ID o REBILL_PLAN_ID requerido");
      return NextResponse.json({ error: "webhook misconfigured" }, { status: 500 });
    }
    const matchesLink = Boolean(configuredLink && (data?.paymentLinkId === configuredLink || metadata.paymentLinkId === configuredLink));
    const matchesPlan = Boolean(configuredPlan && data?.planId === configuredPlan);
    const knownSubscription = subscriptionId
      ? await prisma.business.findUnique({ where: { mpSubscriptionId: subscriptionId }, select: { id: true } })
      : null;
    if (!data || !event || !subscriptionId || (!matchesLink && !matchesPlan && !knownSubscription) || (!email && !metadataBusinessId && !knownSubscription)) {
      console.warn("[webhook rebill] evento ignorado", {
        event,
        subscriptionId,
        hasEmail: Boolean(email),
        matchesLink,
        matchesPlan,
        knownSubscription: Boolean(knownSubscription),
      });
      return NextResponse.json({ received: true });
    }

    const businessId = metadataBusinessId ?? (email ? (await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { businessesOwned: { select: { id: true } } },
    }))?.businessesOwned[0]?.id : undefined) ?? knownSubscription?.id;
    if (!businessId) return NextResponse.json({ received: true });

    const status = (data.status ?? data.subscription?.status)?.toLowerCase();
    const defaulted = status === "defaulted" || (status === "paused" && data.statusDetail?.toLowerCase() === "defaulted");
    const paymentStatus = (data.payment?.status ?? data.status)?.toLowerCase();
    const paymentRevoke = event === "payment.updated" && ["refunded", "chargeback", "charged_back"].includes(paymentStatus ?? "");
    const revoke = defaulted || paymentRevoke || ["paused", "cancelled", "finished"].includes(status ?? "");
    const activate = (event === "subscription.created" && status === "active") ||
      (event === "subscription.updated" && status === "active") ||
      ((event === "payment.created" || event === "payment.updated") && paymentStatus === "approved");

    if (revoke) {
      await prisma.business.updateMany({
        where: { id: businessId, mpSubscriptionId: subscriptionId },
        data: { plan: "trial" },
      });
    } else if (activate) {
      await prisma.business.updateMany({
        where: {
          id: businessId,
          OR: [{ plan: "trial" }, { mpSubscriptionId: subscriptionId }],
        },
        data: { plan: "pro", mpSubscriptionId: subscriptionId, proStartedAt: new Date() },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook rebill] error", error);
    return NextResponse.json({ error: "webhook processing failed" }, { status: 500 });
  }
}
