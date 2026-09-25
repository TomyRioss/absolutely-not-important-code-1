"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HiArrowLeft, HiCheckCircle, HiTrash } from "react-icons/hi2";
import { FaWhatsapp } from "react-icons/fa6";
import { getCart, clearCart, removeFromCart, type Cart } from "@/lib/cart";
import { formatMoney } from "@/lib/utils";
import { createOrder, type CheckoutResult } from "./actions";
import posthog from "posthog-js";

export default function CheckoutPage() {
  const router = useRouter();
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  const [cart, setCart] = useState<Cart | null>(null);
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "DELIVERY">(
    "PICKUP",
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod] = useState<"CASH">("CASH");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ result: Extract<CheckoutResult, { ok: true }>; whatsappUrl: string | null } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setCart(getCart()), 0);
    return () => clearTimeout(id);
  }, []);

  function goBack() {
    router.push(`/menu/${restaurantSlug}`);
  }

  function handleRemoveItem(key: string) {
    removeFromCart(key);
    setCart(getCart());
  }

  function handleClearCart() {
    clearCart();
    setCart(getCart());
  }

  const total =
    cart?.items.reduce((sum, i) => sum + i.price * i.qty, 0) ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createOrder({
        restaurantSlug,
        items: cart.items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
        fulfillment,
        deliveryAddress: fulfillment === "DELIVERY" ? deliveryAddress : undefined,
        customerName,
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        paymentMethod,
      });
      if (!result.ok) {
        posthog.capture("order_place_failed", { restaurant_slug: restaurantSlug, error: result.error });
        setError(result.error);
        return;
      }
      clearCart();

      let whatsappUrl: string | null = null;
      if (result.whatsappNumber) {
        const lines = [
          `¡Hola! Quiero confirmar mi pedido #${result.orderId.slice(-8)}:`,
          "",
          ...result.items.map((i) => `${i.qty}x ${i.name} - $${(i.price * i.qty).toLocaleString("es-AR")}`),
          "",
          `Total: $${result.total.toLocaleString("es-AR")}`,
          fulfillment === "DELIVERY" ? `Entrega: ${deliveryAddress}` : "Retiro en local",
          "Pago: Efectivo",
          `Nombre: ${customerName}`,
        ];
        const message = encodeURIComponent(lines.join("\n"));
        const phone = result.whatsappNumber.replace(/\D/g, "");
        whatsappUrl = `https://wa.me/${phone}?text=${message}`;
      }
      setSuccess({ result, whatsappUrl });
    } catch (err) {
      console.error("checkout error:", err);
      setError("Error al procesar el pedido. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-4 text-center">
        <HiCheckCircle className="h-16 w-16 text-primary" />
        <h1 className="text-xl font-semibold text-text-primary">¡Pedido hecho!</h1>
        <p className="text-text-secondary">
          Tu pedido #{success.result.orderId.slice(-8)} fue recibido. Total: $
          {success.result.total.toLocaleString("es-AR")}
        </p>
        {success.whatsappUrl && (
          <p className="flex items-center gap-1.5 text-sm text-text-secondary">
            <FaWhatsapp className="h-4 w-4 text-[#25D366]" />
            Seguilo por WhatsApp{" "}
            <a
              href={success.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#128C7E] underline underline-offset-2 hover:text-[#075E54]"
            >
              {success.result.whatsappNumber}
            </a>
          </p>
        )}
        <button
          type="button"
          onClick={() => router.push(`/menu/${restaurantSlug}`)}
          className="text-sm font-medium text-text-secondary hover:text-primary"
        >
          Volver al menú
        </button>
      </main>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-4">
        <p className="text-text-secondary">Tu carrito está vacío.</p>
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <HiArrowLeft className="h-4 w-4" /> Volver al menú
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={goBack}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary"
        >
          <HiArrowLeft className="h-4 w-4" /> Volver
        </button>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-background p-6"
        >
          <h1 className="mb-4 text-xl font-semibold text-text-primary">
            Tu pedido
          </h1>

          <ul className="mb-4 divide-y divide-border">
            {cart.items.map((item, index) => {
              const key = item.key ?? item.variantId ?? String(index);
              return (
                <li key={key} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-text-primary">
                    {item.qty}x {item.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-text-secondary">${formatMoney(item.price * item.qty)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(key)}
                      aria-label={`Quitar ${item.name}`}
                      className="text-text-secondary hover:text-danger"
                    >
                      <HiTrash className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={handleClearCart}
              className="text-sm font-medium text-text-secondary hover:text-danger"
            >
              Vaciar carrito
            </button>
            <p className="font-semibold text-text-primary">Total: ${formatMoney(total)}</p>
          </div>

          <label className="mb-1 block text-sm text-text-secondary">
            Nombre
          </label>
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mb-4 w-full rounded border border-border px-3 py-2.5 outline-none focus:border-primary"
          />

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="tel"
              placeholder="Teléfono"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="rounded border border-border px-3 py-2.5 outline-none focus:border-primary"
            />
            <input
              type="email"
              placeholder="Email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="rounded border border-border px-3 py-2.5 outline-none focus:border-primary"
            />
          </div>

          <label className="mb-1 block text-sm text-text-secondary">
            Entrega
          </label>
          <div className="mb-4 flex gap-4">
            <label className="flex items-center gap-2 py-1.5 text-text-primary">
              <input
                type="radio"
                checked={fulfillment === "PICKUP"}
                onChange={() => setFulfillment("PICKUP")}
              />
              Retiro en local
            </label>
            <label className="flex items-center gap-2 py-1.5 text-text-primary">
              <input
                type="radio"
                checked={fulfillment === "DELIVERY"}
                onChange={() => setFulfillment("DELIVERY")}
              />
              Delivery
            </label>
          </div>

          {fulfillment === "DELIVERY" && (
            <input
              required
              placeholder="Dirección de entrega"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="mb-4 w-full rounded border border-border px-3 py-2.5 outline-none focus:border-primary"
            />
          )}

          <label className="mb-1 block text-sm text-text-secondary">Pago</label>
          <div className="mb-6 flex gap-4">
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
            type="submit"
            disabled={loading}
            className="w-full rounded bg-primary px-4 py-3 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? "Procesando..." : "Confirmar pedido"}
          </button>
        </form>
      </div>
    </main>
  );
}
