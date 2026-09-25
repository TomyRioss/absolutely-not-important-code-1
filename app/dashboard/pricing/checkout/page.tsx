import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_PRO_PRICE_ARS } from "@/lib/pricing";
import { RebillCheckout } from "./rebill-checkout";

export default async function RebillCheckoutPage() {
  const session = await auth();
  const membership = session?.user?.id
    ? await prisma.membership.findFirst({
        where: { userId: session.user.id, role: "OWNER" },
        include: { business: { select: { plan: true } } },
        orderBy: { id: "asc" },
      })
    : null;
  const publicKey = process.env.NEXT_PUBLIC_REBILL_PUBLIC_KEY?.trim();
  const planId = process.env.REBILL_PLAN_ID?.trim();

  if (!session?.user?.id || !membership || !publicKey || !planId || !process.env.REBILL_SECRET_KEY?.trim()) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-4 p-6">
          <h1 className="text-xl font-semibold text-text-primary">Suscripción no disponible</h1>
          <p className="text-sm text-text-secondary">No pudimos preparar el checkout para esta cuenta.</p>
          <Button render={<Link href="/dashboard/pricing" />} variant="outline">Volver a precios</Button>
        </CardContent>
      </Card>
    );
  }

  if (membership.business.plan === "pro") {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-4 p-6">
          <h1 className="text-xl font-semibold text-text-primary">Plan Pro activo</h1>
          <p className="text-sm text-text-secondary">Esta cuenta ya tiene una suscripción activa.</p>
          <Button render={<Link href="/dashboard" />}>Ir al panel</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/dashboard/pricing" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" />
        Volver a precios
      </Link>

      <div>
        <p className="text-sm font-medium text-primary">Activá tu cuenta</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-text-primary">Suscribite al Plan Pro</h1>
        <p className="mt-2 max-w-2xl text-text-secondary">
          Checkout seguro de Rebill. El pago se valida contra tu sesión de PlatoRest antes de activar el plan.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <CardTitle>Plan Pro · ${PLAN_PRO_PRICE_ARS.toLocaleString("es-AR")}/mes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              {["Menú digital con QR sin límites", "Pedidos online sin comisiones", "POS, inventario y estadísticas", "Fidelización de clientes", "Soporte 24/7"].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-text-primary">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted p-4 text-sm text-text-secondary">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
              <p>La activación queda vinculada a tu cuenta autenticada de PlatoRest.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="order-1 overflow-visible lg:order-2">
          <CardHeader>
            <CardTitle>Completá el pago</CardTitle>
            <p className="text-sm text-text-secondary">Tu cuenta: {session.user.email}</p>
          </CardHeader>
          <CardContent>
            <RebillCheckout publicKey={publicKey} planId={planId} email={session.user.email} name={session.user.name} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
