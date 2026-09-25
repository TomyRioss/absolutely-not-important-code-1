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
  subscription?: { id?: string; status?: string };
  customer?: { email?: string };
  payment?: { status?: string };
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
    const subscriptionId = data?.subscriptionId ?? data?.subscription?.id ?? data?.id;
    const configuredLink = process.env.REBILL_PAYMENT_LINK_ID;
    const configuredPlan = process.env.REBILL_PLAN_ID?.trim();
    if (!configuredLink || !configuredPlan) {
      console.error("[webhook rebill] IDs de Rebill no configurados");
      return NextResponse.json({ error: "webhook misconfigured" }, { status: 500 });
    }
    const matchesLink = data?.paymentLinkId === configuredLink;
    const matchesPlan = data?.planId === configuredPlan;
    if (!data || !event || !email || !subscriptionId || (!matchesLink && !matchesPlan)) {
      console.warn("[webhook rebill] evento ignorado", {
        event,
        subscriptionId,
        hasEmail: Boolean(email),
        matchesLink,
        matchesPlan,
      });
      return NextResponse.json({ received: true });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { businessesOwned: { select: { id: true } } },
    });
    const businessId = user?.businessesOwned[0]?.id;
    if (!businessId) return NextResponse.json({ received: true });

    const status = (data.status ?? data.subscription?.status)?.toLowerCase();
    const defaulted = status === "defaulted" || (status === "paused" && data.statusDetail === "defaulted");
    const revoke = defaulted || ["cancelled", "finished"].includes(status ?? "");
    const paymentStatus = data.payment?.status?.toLowerCase();
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
        where: { id: businessId },
        data: { plan: "pro", mpSubscriptionId: subscriptionId, proStartedAt: new Date() },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook rebill] error", error);
    return NextResponse.json({ error: "webhook processing failed" }, { status: 500 });
  }
}
