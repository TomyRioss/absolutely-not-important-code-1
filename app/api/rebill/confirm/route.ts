import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SubscriptionResponse = {
  result?: { plan?: { id?: string }; status?: string };
  plan?: { id?: string };
  status?: string;
};

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null) as { subscriptionId?: string } | null;
    const subscriptionId = body?.subscriptionId?.trim();
    const apiKey = process.env.REBILL_SECRET_KEY?.trim();
    const planId = process.env.REBILL_PLAN_ID?.trim();
    if (!subscriptionId || !apiKey || !planId) return NextResponse.json({ error: "Rebill no está configurado" }, { status: 500 });

    const membership = await prisma.membership.findFirst({
      where: { userId, role: "OWNER" },
      select: { businessId: true },
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
