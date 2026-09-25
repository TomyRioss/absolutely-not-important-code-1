"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import { createPosOrder } from "./actions";

type Product = { variantId: string; name: string; price: number };
type LineItem = { variantId: string; name: string; price: number; qty: number };

export function PosClient({
  restaurantId,
  products,
}: {
  restaurantId: string;
  products: Product[];
}) {
  const [items, setItems] = useState<LineItem[]>([]);
  const [paymentMethod] = useState<"CASH">("CASH");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<{
    orderId: string;
    total: number;
  } | null>(null);

  function addItem(product: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === product.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === product.variantId ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...prev, { variantId: product.variantId, name: product.name, price: product.price, qty: 1 }];
    });
  }

  function removeItem(variantId: string) {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  async function handleCharge() {
    setLoading(true);
    setError(null);
    try {
      const result = await createPosOrder({
        restaurantId,
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        paymentMethod,
        customerPhone: customerPhone || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReceipt({ orderId: result.orderId, total: result.total });
      setItems([]);
      setCustomerPhone("");
    } catch (err) {
      console.error("pos charge error:", err);
      setError("Error al cobrar. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (receipt) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 text-center">
          <h1 className="mb-2 text-xl font-semibold text-success">
            Cobrado
          </h1>
          <p className="text-text-secondary">
            Comprobante #{receipt.orderId.slice(-8)}
          </p>
          <p className="mt-2 text-lg font-semibold text-text-primary">
            Total: ${formatMoney(receipt.total)}
          </p>
          <button
            onClick={() => setReceipt(null)}
            className="mt-6 w-full rounded bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
          >
            Nuevo pedido
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface p-4 md:p-6">
      <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-background p-4">
          <h2 className="mb-3 font-semibold text-text-primary">Productos</h2>
          <ul className="grid grid-cols-2 gap-2">
            {products.map((p) => (
              <li key={p.variantId}>
                <button
                  onClick={() => addItem(p)}
                  className="w-full rounded border border-border px-3 py-2 text-left hover:border-primary hover:bg-primary-light"
                >
                  <span className="block text-sm font-medium text-text-primary">
                    {p.name}
                  </span>
                  <span className="text-sm text-text-secondary">
                    ${formatMoney(p.price)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-background p-4">
          <h2 className="mb-3 font-semibold text-text-primary">Pedido</h2>
          <ul className="mb-4 divide-y divide-border">
            {items.length === 0 && (
              <li className="py-4 text-sm text-text-secondary">
                Sin productos agregados.
              </li>
            )}
            {items.map((item) => (
              <li key={item.variantId} className="flex items-center justify-between py-2">
                <span className="text-text-primary">
                  {item.qty}x {item.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary">
                    ${formatMoney(item.price * item.qty)}
                  </span>
                  <button
                    onClick={() => removeItem(item.variantId)}
                    className="text-danger text-sm"
                  >
                    quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="mb-4 text-right font-semibold text-text-primary">
            Total: ${formatMoney(total)}
          </p>

          <input
            type="tel"
            placeholder="Teléfono cliente (opcional, para fidelización)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="mb-4 w-full rounded border border-border px-3 py-2.5 outline-none focus:border-primary"
          />

          <div className="mb-4 flex gap-4">
            <label className="flex items-center gap-2 py-1.5 text-text-primary">
              <input
                type="radio"
                checked={paymentMethod === "CASH"}
                readOnly
              />
              Efectivo
            </label>
          </div>

          {error && (
            <p className="mb-4 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <button
            onClick={handleCharge}
            disabled={loading || items.length === 0}
            className="w-full rounded bg-primary px-4 py-3 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? "Cobrando..." : `Cobrar $${formatMoney(total)}`}
          </button>
        </section>
      </div>
    </main>
  );
}
