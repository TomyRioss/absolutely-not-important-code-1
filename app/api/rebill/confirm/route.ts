import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SubscriptionResponse = {
  result?: {
    plan?: { id?: string };
    status?: string;
    customer?: { email?: string };
    customerEmail?: string;
  };
  plan?: { id?: string };
  status?: string;
  customer?: { email?: string };
  customerEmail?: string;
};

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function findStringProperty(value: unknown, property: string, seen = new Set<object>()): string | undefined {
  if (!value || typeof value !== "object" || seen.has(value)) return undefined;
  seen.add(value);

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === property && typeof nestedValue === "string" && nestedValue.trim()) return nestedValue;
    const found = findStringProperty(nestedValue, property, seen);
    if (found) return found;
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null) as { paymentId?: string; subscriptionId?: string } | null;
    let subscriptionId = body?.subscriptionId?.trim();
    const paymentId = body?.paymentId?.trim();
    const sandbox = process.env.REBILL_MODE?.trim() === "sandbox";
    const apiKey = sandbox
      ? process.env.REBILL_SANDBOX_SECRET_KEY?.trim()
      : process.env.REBILL_SECRET_KEY?.trim();
    const planId = sandbox
      ? process.env.REBILL_SANDBOX_PLAN_ID?.trim()
      : process.env.REBILL_PLAN_ID?.trim();
    if (!apiKey || !planId) return NextResponse.json({ error: "Rebill no está configurado" }, { status: 500 });

    // Hosted checkout returns to a fixed URL without a subscription reference.
    // Resolve it from Rebill using the authenticated account, never a supplied email.
    if (!subscriptionId && !paymentId) {
      if (!session.user.email) return NextResponse.json({ error: "No se pudo identificar la cuenta" }, { status: 409 });
      const searchResponse = await fetch("https://api.rebill.com/v3/subscriptions/search", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: { customer: { email: session.user.email }, planId, status: ["active"] },
          pagination: { limit: 1, offset: 0, sort: "created_at", order: "DESC" },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!searchResponse.ok) return NextResponse.json({ error: "No se pudo consultar el pago en Rebill" }, { status: 502 });
      const search = await searchResponse.json() as { records?: { id?: string }[] };
      subscriptionId = search.records?.[0]?.id;
      if (!subscriptionId) return NextResponse.json({ error: "Rebill todavía no confirmó una suscripción activa para tu cuenta" }, { status: 409 });
    }

    if (!subscriptionId && paymentId) {
      const paymentResponse = await fetch(`https://api.rebill.com/v3/payments/${encodeURIComponent(paymentId)}`, {
        headers: { "x-api-key": apiKey },
        cache: "no-store",
      });
      if (!paymentResponse.ok) return NextResponse.json({ error: "No se pudo validar el pago" }, { status: 502 });

      const payment = await paymentResponse.json() as unknown;
      const paymentStatus = findStringProperty(payment, "status")?.toLowerCase();
      subscriptionId = findStringProperty(payment, "subscriptionId");
      if (paymentStatus !== "approved") return NextResponse.json({ error: "El pago todavía no está aprobado" }, { status: 409 });
      if (!subscriptionId) return NextResponse.json({ error: "Rebill todavía no vinculó el pago con la suscripción" }, { status: 409 });
    }

    if (!subscriptionId) return NextResponse.json({ error: "No se encontró la suscripción" }, { status: 409 });

    const membership = await prisma.membership.findFirst({
      where: { userId, role: "OWNER" },
      select: { businessId: true, user: { select: { email: true } } },
      orderBy: { id: "asc" },
    });
    if (!membership) return NextResponse.json({ error: "negocio no encontrado" }, { status: 404 });

    const response = await fetch(`https://api.rebill.com/v3/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "No se pudo validar la suscripción" }, { status: 502 });

    const payload = await response.json() as SubscriptionResponse;
    const subscription = payload.result ?? payload;
    if (subscription.plan?.id !== planId || subscription.status?.toLowerCase() !== "active") {
      return NextResponse.json({ error: "La suscripción todavía no está activa" }, { status: 409 });
    }

    const subscriptionEmail = subscription.customer?.email ?? subscription.customerEmail;
    if (!subscriptionEmail || normalizeEmail(subscriptionEmail) !== normalizeEmail(membership.user.email)) {
      return NextResponse.json({ error: "El correo del pago no coincide con tu cuenta" }, { status: 409 });
    }

    await prisma.business.updateMany({
      where: { id: membership.businessId, OR: [{ plan: "trial" }, { mpSubscriptionId: subscriptionId }] },
      data: { plan: "pro", mpSubscriptionId: subscriptionId, proStartedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/rebill/confirm]", error);
    return NextResponse.json({ error: "No se pudo confirmar la suscripción" }, { status: 500 });
  }
}
