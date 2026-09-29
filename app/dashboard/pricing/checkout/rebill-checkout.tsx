"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type RebillCheckoutElement = HTMLElement & {
  publicKey: string;
  planId: string;
  language: string;
  oneClickCheckout: boolean;
  display: { successPage: boolean; checkoutSummary: boolean; submitButton: boolean };
  customerInformation?: { email?: string; fullName?: string };
  submit: () => Promise<void>;
  apmPayment?: { id?: string; subscriptionId?: string | null } | null;
  responseCheckoutCard?: { result?: { paymentId?: string; subscriptionId?: string | null } } | null;
};

type RebillSuccessDetail = {
  paymentId?: string;
  subscriptionId?: string;
  data?: { paymentId?: string; subscriptionId?: string; result?: { paymentId?: string; subscriptionId?: string; subscription?: { id?: string } } };
  result?: { paymentId?: string; subscriptionId?: string; subscription?: { id?: string } };
};

type PaymentReference = { paymentId?: string; subscriptionId?: string };

function findId(value: unknown, idKey: "paymentId" | "subscriptionId", parentKey?: string, seen = new Set<object>()): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (seen.has(value)) return undefined;
  seen.add(value);

  for (const [key, nestedValue] of Object.entries(value)) {
    const matchesId = key === idKey || key === "id" && parentKey === (idKey === "paymentId" ? "payment" : "subscription");
    if (matchesId && typeof nestedValue === "string" && nestedValue.trim()) {
      return nestedValue;
    }
    const found = findId(nestedValue, idKey, key, seen);
    if (found) return found;
  }
}

function getPaymentReference(detail: RebillSuccessDetail, checkout?: RebillCheckoutElement | null): PaymentReference {
  return {
    subscriptionId: findId(detail, "subscriptionId")
      ?? findId(checkout?.apmPayment, "subscriptionId")
      ?? findId(checkout?.responseCheckoutCard, "subscriptionId"),
    paymentId: findId(detail, "paymentId")
      ?? checkout?.responseCheckoutCard?.result?.paymentId
      ?? checkout?.apmPayment?.id,
  };
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function RebillCheckout({ publicKey, planId, mode, email, name }: { publicKey: string; planId: string; mode: "production" | "sandbox"; email?: string | null; name?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const paymentApprovedRef = useRef(false);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [approvedPayment, setApprovedPayment] = useState<PaymentReference | null>(null);
  const [checkoutEmail, setCheckoutEmail] = useState(email ?? "");
  const emailMismatch = normalizeEmail(checkoutEmail) !== normalizeEmail(email);

  const confirmSubscription = useCallback((payment: PaymentReference) => {
    setValidating(true);
    void fetch("/api/rebill/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
      signal: AbortSignal.timeout(20_000),
    })
      .then((response) => {
        if (!response.ok) throw new Error("confirm_failed");
        window.location.assign("/dashboard");
      })
      .catch(() => setError("El pago fue recibido, pero no pudimos validar la activación. Reintentá la validación en unos segundos."))
      .finally(() => setValidating(false));
  }, []);

  useEffect(() => {
    let checkout: RebillCheckoutElement | undefined;
    let cancelled = false;
    let readyTimeout: number | undefined;

    void import("rebill/loader").then(async ({ defineCustomElements }) => {
      if (cancelled || !containerRef.current) return;
      const { initializeRebillSDK } = await import("rebill/config");
      if (cancelled) return;
      initializeRebillSDK({ environment: "production", debug: mode === "sandbox" });
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
      checkout.addEventListener("ready", () => {
        if (cancelled) return;
        if (readyTimeout !== undefined) window.clearTimeout(readyTimeout);
        setLoaded(true);
      }, { once: true });
      checkout.addEventListener("formChange", (event) => {
        const detail = (event as CustomEvent<{ data?: { email?: string }; isValid?: boolean }>).detail;
        const formData = detail?.data;
        if (typeof formData?.email === "string") setCheckoutEmail(formData.email);
        if (submittingRef.current && detail?.isValid === false) {
          submittingRef.current = false;
          setSubmitting(false);
          setError("Revisá los campos marcados para continuar con el pago.");
        }
      });
      checkout.addEventListener("success", (event) => {
        if (paymentApprovedRef.current) return;
        paymentApprovedRef.current = true;
        setPaymentApproved(true);
        submittingRef.current = false;
        setSubmitting(false);
        const payment = getPaymentReference((event as CustomEvent<RebillSuccessDetail>).detail, checkout);
        if (!payment.subscriptionId && !payment.paymentId) {
          setError("El pago fue recibido, pero Rebill todavía no informó la suscripción. No vuelvas a pagar; reintentá la validación en unos segundos.");
          return;
        }

        setApprovedPayment(payment);
        confirmSubscription(payment);
      });
      checkout.addEventListener("error", () => {
        if (cancelled) return;
        submittingRef.current = false;
        setSubmitting(false);
        setError("Rebill rechazó el pago. Revisá los datos e intentá nuevamente.");
      });
      containerRef.current.append(checkout);
      readyTimeout = window.setTimeout(() => {
        if (!cancelled) setError("Rebill está tardando en preparar el pago. Recargá la página e intentá nuevamente.");
      }, 30_000);
    }).catch(() => {
      if (!cancelled) setError("No se pudo cargar el checkout de Rebill. Recargá la página e intentá nuevamente.");
    });

    return () => {
      cancelled = true;
      if (readyTimeout !== undefined) window.clearTimeout(readyTimeout);
      checkout?.remove();
    };
  }, [confirmSubscription, email, mode, name, planId, publicKey]);

  return (
    <div className="min-h-[520px]">
      {validating && <p role="status" className="mb-4 rounded-lg bg-muted p-3 text-sm text-text-secondary">Validando tu suscripción...</p>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {!loaded && !error && <p className="mb-4 text-sm text-text-secondary">Cargando checkout seguro...</p>}
      <div ref={containerRef} className="min-h-[460px] w-full min-w-0 overflow-x-hidden" />
      {emailMismatch && <p className="mt-4 break-words rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">El correo del pago no coincide con tu cuenta. Corregilo para continuar.</p>}
      {paymentApproved ? approvedPayment ? (
        <Button
          className="mt-4 h-12 w-full"
          disabled={validating}
          onClick={() => {
            setError(null);
            confirmSubscription(approvedPayment);
          }}
        >
          {validating ? "Validando..." : "Reintentar validación"}
        </Button>
      ) : (
        <Button
          className="mt-4 h-12 w-full"
          disabled={validating}
          onClick={() => {
            const checkout = containerRef.current?.firstElementChild as RebillCheckoutElement | null;
            const payment = getPaymentReference({}, checkout);
            if (!payment.subscriptionId && !payment.paymentId) {
              setError("Rebill todavía no informó la suscripción. No vuelvas a pagar; reintentá en unos segundos.");
              return;
            }
            setError(null);
            setApprovedPayment(payment);
            confirmSubscription(payment);
          }}
        >
          {validating ? "Validando..." : "Reintentar validación"}
        </Button>
      ) : (
        <Button
          className="mt-4 h-12 w-full"
          disabled={!loaded || validating || submitting || emailMismatch}
          onClick={() => {
            if (!checkoutEmail || emailMismatch) return;
            setError(null);
            const checkout = containerRef.current?.firstElementChild as RebillCheckoutElement | null;
            if (!checkout) {
              setError("No se pudo iniciar el pago. Recargá la página e intentá nuevamente.");
              return;
            }
            submittingRef.current = true;
            setSubmitting(true);
            void checkout.submit().catch(() => {
              submittingRef.current = false;
              setSubmitting(false);
              setError("No se pudo iniciar el pago. Revisá los datos e intentá nuevamente.");
            }).finally(() => {
              submittingRef.current = false;
              setSubmitting(false);
            });
          }}
        >
          {submitting ? "Procesando..." : "Continuar"}
        </Button>
      )}
      <noscript><Button disabled>Necesitás JavaScript para pagar</Button></noscript>
    </div>
  );
}
