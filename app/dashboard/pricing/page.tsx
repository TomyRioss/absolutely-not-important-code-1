import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { PromoCountdown } from "@/components/promo-countdown";

const currentTime = () => Date.now();

export default async function PricingPage() {
  const session = await auth();
  const membership = session?.user?.id
    ? await prisma.membership.findFirst({
        where: { userId: session.user.id, role: "OWNER" },
        include: { business: true },
        orderBy: { id: "asc" },
      })
    : null;
  const business = membership?.business;
  const rebillPaymentLink = process.env.REBILL_PAYMENT_LINK_URL;
  const trialDaysLeft = business?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(business.trialEndsAt).getTime() - currentTime()) / 86400000))
    : null;
  const isPro = business?.plan === "pro";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-text-primary">Mejorá tu plan</h1>
        <p className="mt-2 text-text-secondary">
          {isPro
            ? "Ya tenés el Plan Pro activo."
            : trialDaysLeft !== null && trialDaysLeft > 0
              ? <>Te quedan <span className="font-medium text-primary underline underline-offset-2">{trialDaysLeft} días de prueba</span> gratuita.</>
              : "Tu prueba gratuita terminó. Suscribite para seguir usando PlatoRest sin límites."}
        </p>
      </div>

      <Card className="rounded-2xl border-2 border-primary p-8 shadow-lg">
        <CardContent className="p-0">
          <h2 className="text-xl font-bold text-primary">Plan Promocional</h2>
          <p className="mt-1 text-6xl font-extrabold tracking-tight text-primary">
            $19.900<span className="text-lg font-medium text-text-secondary">/mes</span>
          </p>
          <PromoCountdown className="mt-4" />
          <ul className="mt-6 space-y-3">
            {["Menú digital con QR sin límites", "Pedidos online sin comisiones", "POS, inventario y estadísticas", "Fidelización de clientes", "Soporte 24/7 feriados y fines de semana"].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-text-primary">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {isPro ? (
            <Button disabled className="mt-8 w-full" size="lg">Plan activo</Button>
          ) : (
            <>
              {rebillPaymentLink ? (
                <Button
                  className="mt-8 w-full"
                  size="lg"
                  render={<a href={rebillPaymentLink} />}
                >
                  Suscribirme
                </Button>
              ) : (
                <Button disabled className="mt-8 w-full" size="lg">
                  Suscripción no disponible
                </Button>
              )}
              <p className="mt-2 text-center text-xs text-text-secondary">
                Usá el mismo email de tu cuenta de PlatoRest en Rebill.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
