"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type RebillCheckoutElement = HTMLElement & {
  publicKey: string;
  planId: string;
  language: string;
  oneClickCheckout: boolean;
  display: { successPage: boolean; checkoutSummary: boolean };
  customerInformation?: { email?: string; fullName?: string };
};

type RebillSuccessDetail = {
  subscriptionId?: string;
  data?: { subscriptionId?: string; result?: { subscriptionId?: string; subscription?: { id?: string } } };
  result?: { subscriptionId?: string; subscription?: { id?: string } };
};

function getSubscriptionId(detail: RebillSuccessDetail) {
  return detail.subscriptionId ?? detail.data?.subscriptionId ?? detail.data?.result?.subscriptionId ?? detail.result?.subscriptionId ?? detail.result?.subscription?.id;
}

export function RebillCheckout({ publicKey, planId, email, name }: { publicKey: string; planId: string; email?: string | null; name?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
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
      checkout.display = { successPage: false, checkoutSummary: false };
      checkout.style.display = "block";
      checkout.style.width = "100%";
      checkout.style.maxWidth = "100%";
      checkout.customerInformation = { email: email ?? undefined, fullName: name ?? undefined };
      checkout.addEventListener("success", (event) => {
        const subscriptionId = getSubscriptionId((event as CustomEvent<RebillSuccessDetail>).detail);
        if (!subscriptionId) {
          setError("Rebill confirmó el pago, pero no devolvió la suscripción.");
          return;
        }

        setValidating(true);
        void fetch("/api/rebill/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscriptionId }),
        })
          .then((response) => {
            if (!response.ok) throw new Error("confirm_failed");
            window.location.assign("/dashboard");
          })
          .catch(() => setError("El pago fue recibido, pero todavía estamos validando la activación. Recargá en unos segundos."))
          .finally(() => setValidating(false));
      });
      checkout.addEventListener("error", () => setError("Rebill rechazó el pago. Revisá los datos e intentá nuevamente."));
      containerRef.current.append(checkout);
      setLoaded(true);
    }).catch(() => setError("No se pudo cargar el checkout de Rebill."));

    return () => {
      cancelled = true;
      checkout?.remove();
    };
  }, [email, name, planId, publicKey]);

  return (
    <div className="min-h-[520px]" aria-live="polite">
      {validating && <p className="mb-4 rounded-lg bg-muted p-3 text-sm text-text-secondary">Validando tu suscripción...</p>}
      {error && <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {!loaded && !error && <p className="mb-4 text-sm text-text-secondary">Cargando checkout seguro...</p>}
      <div ref={containerRef} className="min-h-[460px] w-full min-w-0 overflow-x-hidden" />
      <noscript><Button disabled>Necesitás JavaScript para pagar</Button></noscript>
    </div>
  );
}
