import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findCheckoutSubscription, getRebillConfig, getSubscriptionBinding, readCheckout, rebillRequest, type RebillSubscription } from "@/lib/rebill-checkout";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const config = getRebillConfig();
    if (!config) return NextResponse.json({ error: "Pago no disponible" }, { status: 503 });
    const body = await request.json().catch(() => null) as { checkout?: unknown } | null;
    const binding = readCheckout(body?.checkout);
    if (body?.checkout && (!binding || binding.userId !== userId || binding.mode !== config.mode || binding.planId !== config.planId)) {
      return NextResponse.json({ error: "Esta compra pertenece a otra cuenta o su referencia venció. Ingresá con la cuenta que inició el pago." }, { status: 403 });
    }
    const membership = await prisma.membership.findFirst({
      where: { userId, role: "OWNER", ...(binding ? { businessId: binding.businessId } : {}) },
      select: { businessId: true, business: { select: { plan: true, mpSubscriptionId: true } } },
      orderBy: { id: "asc" },
    });
    if (!membership) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });

    // Email cannot identify the account that initiated a purchase.
    const subscriptionId = binding ? await findCheckoutSubscription(config, binding)
      : membership.business.plan === "pro" ? membership.business.mpSubscriptionId : null;
    if (!binding && !subscriptionId) return NextResponse.json({ error: "Falta la referencia de la compra. Usá el enlace de regreso de Rebill o contactá soporte; no vuelvas a pagar." }, { status: 400 });
    if (!subscriptionId) return NextResponse.json({ error: "Rebill todavía no confirmó la suscripción de esta compra" }, { status: 409 });
    const subscription = await rebillRequest<RebillSubscription>(config, `subscriptions/${encodeURIComponent(subscriptionId)}`);
    if (subscription.plan?.id !== config.planId || subscription.status?.toLowerCase() !== "active") {
      return NextResponse.json({ error: "La suscripción todavía no está activa" }, { status: 409 });
    }
    if (binding) {
      const verified = await getSubscriptionBinding(config, subscription);
      if (!verified || verified.userId !== userId || verified.businessId !== membership.businessId || verified.paymentLinkId !== binding.paymentLinkId) {
        return NextResponse.json({ error: "No pudimos vincular esta compra a tu cuenta" }, { status: 403 });
      }
    }
    if (membership.business.plan !== "pro" || membership.business.mpSubscriptionId !== subscriptionId) {
      const updated = await prisma.business.updateMany({
        where: { id: membership.businessId, OR: [{ plan: "trial" }, { mpSubscriptionId: subscriptionId }] },
        data: { plan: "pro", mpSubscriptionId: subscriptionId, proStartedAt: new Date() },
      });
      if (!updated.count) return NextResponse.json({ error: "Esta cuenta ya tiene otra suscripción vinculada. Contactá soporte; no vuelvas a pagar." }, { status: 409 });
    }
    if (binding) {
      await rebillRequest(config, `payment-links/${encodeURIComponent(binding.paymentLinkId)}`, { method: "PATCH", body: JSON.stringify({ status: "expired" }) })
        .catch(() => console.warn("[rebill confirm] unable to expire completed checkout"));
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[rebill confirm]", error instanceof Error ? error.message : "confirmation failed");
    return NextResponse.json({ error: "No pudimos verificar la compra. Reintentá la validación; no vuelvas a pagar." }, { status: 502 });
  }
}
