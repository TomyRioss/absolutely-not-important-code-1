"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type RebillCheckoutElement = HTMLElement & {
  publicKey: string;
  planId: string;
  language: string;
  oneClickCheckout: boolean;
  display: { successPage: boolean; checkoutSummary: boolean; submitButton: boolean };
  customerInformation?: { email?: string; fullName?: string };
  submit: () => Promise<void>;
};

type RebillSuccessDetail = {
  subscriptionId?: string;
  data?: { subscriptionId?: string; result?: { subscriptionId?: string; subscription?: { id?: string } } };
  result?: { subscriptionId?: string; subscription?: { id?: string } };
};

function findSubscriptionId(value: unknown, parentKey?: string, seen = new Set<object>()): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (seen.has(value)) return undefined;
  seen.add(value);

  for (const [key, nestedValue] of Object.entries(value)) {
    if ((key === "subscriptionId" || key === "id" && parentKey === "subscription") && typeof nestedValue === "string" && nestedValue.trim()) {
      return nestedValue;
    }
    const found = findSubscriptionId(nestedValue, key, seen);
    if (found) return found;
  }
}

function getSubscriptionId(detail: RebillSuccessDetail) {
  return findSubscriptionId(detail);
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function RebillCheckout({ publicKey, planId, email, name }: { publicKey: string; planId: string; email?: string | null; name?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutEmail, setCheckoutEmail] = useState(email ?? "");
  const emailMismatch = normalizeEmail(checkoutEmail) !== normalizeEmail(email);

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
      checkout.display = { successPage: false, checkoutSummary: false, submitButton: false };
      checkout.style.display = "block";
      checkout.style.width = "100%";
      checkout.style.maxWidth = "100%";
      checkout.customerInformation = { email: email ?? undefined, fullName: name ?? undefined };
      checkout.addEventListener("formChange", (event) => {
        const formData = (event as CustomEvent<{ data?: { email?: string } }>).detail?.data;
        if (typeof formData?.email === "string") setCheckoutEmail(formData.email);
      });
      checkout.addEventListener("success", (event) => {
        setSubmitting(false);
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
      checkout.addEventListener("error", () => {
        setSubmitting(false);
        setError("Rebill rechazó el pago. Revisá los datos e intentá nuevamente.");
      });
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
      {emailMismatch && <p className="mt-4 break-words rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">El correo del pago no coincide con tu cuenta. Corregilo para continuar.</p>}
      <Button
        className="mt-4 h-12 w-full"
        disabled={!loaded || validating || submitting || emailMismatch}
        onClick={() => {
          if (!checkoutEmail || emailMismatch) return;
          setError(null);
          setSubmitting(true);
          const checkout = containerRef.current?.firstElementChild as RebillCheckoutElement | null;
          void checkout?.submit().catch(() => {
            setSubmitting(false);
            setError("No se pudo iniciar el pago. Revisá los datos e intentá nuevamente.");
          });
        }}
      >
        {submitting ? "Procesando..." : "Continuar"}
      </Button>
      <noscript><Button disabled>Necesitás JavaScript para pagar</Button></noscript>
    </div>
  );
}
