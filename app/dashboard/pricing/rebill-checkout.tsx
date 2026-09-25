"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type RebillCheckoutElement = HTMLElement & {
  publicKey: string;
  planId: string;
  language: string;
  oneClickCheckout: boolean;
  display: { successPage: boolean };
  customerInformation?: { email?: string; fullName?: string };
};

function subscriptionIdFrom(detail: any): string | undefined {
  return detail?.subscriptionId ?? detail?.data?.subscriptionId ?? detail?.data?.result?.subscriptionId ?? detail?.result?.subscriptionId ?? detail?.result?.subscription?.id;
}

export function RebillCheckout({ publicKey, planId, email, name }: { publicKey: string; planId: string; email?: string | null; name?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let checkout: RebillCheckoutElement | undefined;
    let cancelled = false;
    void import("rebill/loader").then(({ defineCustomElements }) => {
      if (cancelled || !containerRef.current) return;
      defineCustomElements(window);
      checkout = document.createElement("rebill-checkout") as unknown as RebillCheckoutElement;
      checkout.publicKey = publicKey;
      checkout.planId = planId;
      checkout.language = "es";
      checkout.oneClickCheckout = false;
      checkout.display = { successPage: false };
      checkout.customerInformation = { email: email ?? undefined, fullName: name ?? undefined };
      checkout.addEventListener("success", async (event) => {
        const subscriptionId = subscriptionIdFrom((event as CustomEvent).detail);
        if (!subscriptionId) return setError("Rebill confirmó el pago, pero no devolvió la suscripción.");
        const response = await fetch("/api/rebill/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId }),
        });
        if (!response.ok) return setError("El pago fue recibido. Estamos validando la activación; recargá en unos segundos.");
        window.location.assign("/dashboard");
      });
      checkout.addEventListener("error", () => setError("Rebill rechazó el pago. Revisá los datos e intentá nuevamente."));
      containerRef.current.append(checkout);
    }).catch(() => setError("No se pudo cargar el checkout de Rebill."));
    return () => { cancelled = true; checkout?.remove(); };
  }, [email, name, open, planId, publicKey]);

  if (!open) return <Button className="mt-8 w-full" size="lg" onClick={() => setOpen(true)}>Suscribirme</Button>;

  return <div ref={containerRef} className="mt-8 min-h-80" aria-live="polite">
    {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    <noscript><Button disabled>Necesitás JavaScript para pagar</Button></noscript>
  </div>;
}
