"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PaymentReturn({ rejected, checkout }: { rejected: boolean; checkout?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"pending" | "success" | "error">(rejected ? "error" : "pending");
  const [message, setMessage] = useState(rejected ? "Rebill rechazó el pago. Revisá los datos o elegí otro medio de pago." : "");
  const [attempt, setAttempt] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (rejected) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function confirm() {
      try {
        const response = await fetch("/api/rebill/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkout }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        });
        const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
        if (controller.signal.aborted) return;
        if (response.ok && result?.ok) {
          setState("success");
          router.refresh();
          return;
        }
        if ((response.status === 409 || response.status === 502) && attempt < 9) {
          timer = setTimeout(() => setAttempt((value) => value + 1), 3_000);
          return;
        }
        setMessage(result?.error ?? "No pudimos confirmar la activación. Reintentá la validación; no vuelvas a pagar.");
        setState("error");
      } catch {
        if (controller.signal.aborted) return;
        if (attempt < 9) {
          timer = setTimeout(() => setAttempt((value) => value + 1), 3_000);
          return;
        }
        setMessage("No pudimos conectarnos para confirmar la activación. Reintentá la validación; no vuelvas a pagar.");
        setState("error");
      }
    }
    void confirm();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [attempt, checkout, rejected, router, run]);

  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="space-y-5 p-6" aria-live="polite" aria-busy={state === "pending"}>
        <h1 className="text-2xl font-semibold text-text-primary">
          {state === "success" ? "Pago confirmado" : state === "pending" ? "Confirmando tu pago" : rejected ? "Pago rechazado" : "Activación pendiente"}
        </h1>
        <p className="text-sm text-text-secondary">
          {state === "success" ? "Tu Plan Pro está activo. Ya podés usar todas las funciones de PlatoRest." : state === "pending" ? "Estamos verificando tu suscripción con Rebill. No vuelvas a pagar." : message}
        </p>
        {state === "success" ? (
          <Button className="min-h-11" render={<Link href="/dashboard" prefetch={false} />}>Ir al panel</Button>
        ) : rejected ? (
          <Button className="min-h-11" render={<Link href="/dashboard/pricing" />}>Volver a precios</Button>
        ) : state === "error" ? (
          <Button className="min-h-11" onClick={() => {
            setState("pending");
            setMessage("");
            setAttempt(0);
            setRun((value) => value + 1);
          }}>Reintentar validación</Button>
        ) : <p role="status" className="text-sm text-text-secondary">La confirmación puede tardar unos segundos.</p>}
      </CardContent>
    </Card>
  );
}
