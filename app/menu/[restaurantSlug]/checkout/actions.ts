"use server";

import { prisma } from "@/lib/prisma";
import { geocodeAddress, haversineKm } from "@/lib/geo";
import { getPostHogClient } from "@/lib/posthog-server";

export type CheckoutInput = {
  restaurantSlug: string;
  items: { variantId: string; qty: number }[];
  fulfillment: "PICKUP" | "DELIVERY";
  deliveryAddress?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentMethod: "CASH";
};

export type CheckoutResult =
  | {
      ok: true;
      orderId: string;
      total: number;
      whatsappNumber: string | null;
      items: { name: string; qty: number; price: number }[];
    }
  | { ok: false; error: string };

export async function createOrder(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: input.restaurantSlug },
    include: { business: { include: { socialLinks: { where: { platform: "WHATSAPP" } } } } },
  });
  if (!restaurant) return { ok: false, error: "Restaurante no encontrado." };

  if (input.items.length === 0) {
    return { ok: false, error: "El carrito está vacío." };
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: input.items.map((i) => i.variantId) },
      product: { restaurantId: restaurant.id, active: true },
    },
    include: { product: true },
  });
  if (variants.length !== input.items.length) {
    return { ok: false, error: "Algún producto ya no está disponible." };
  }

  if (input.fulfillment === "DELIVERY") {
    if (!input.deliveryAddress) {
      return { ok: false, error: "Falta la dirección de entrega." };
    }
    if (restaurant.lat == null || restaurant.lng == null) {
      return {
        ok: false,
        error: "El restaurante no tiene ubicación configurada.",
      };
    }
    const dest = await geocodeAddress(input.deliveryAddress);
    if (!dest) {
      return { ok: false, error: "No se pudo ubicar la dirección." };
    }
    const distanceKm = haversineKm(
      { lat: restaurant.lat, lng: restaurant.lng },
      dest,
    );
    if (distanceKm > restaurant.deliveryRadiusKm) {
      return {
        ok: false,
        error: `Dirección fuera del radio de entrega (${restaurant.deliveryRadiusKm} km).`,
      };
    }
  }

  if (!input.customerPhone && !input.customerEmail) {
    return { ok: false, error: "Falta teléfono o email de contacto." };
  }

  let customer = await prisma.customer.findFirst({
    where: {
      businessId: restaurant.businessId,
      OR: [
        input.customerPhone ? { phone: input.customerPhone } : undefined,
        input.customerEmail ? { email: input.customerEmail } : undefined,
      ].filter((c): c is NonNullable<typeof c> => Boolean(c)),
    },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        businessId: restaurant.businessId,
        name: input.customerName,
        phone: input.customerPhone,
        email: input.customerEmail,
      },
    });
  }

  const total = input.items.reduce((sum, item) => {
    const variant = variants.find((v) => v.id === item.variantId)!;
    return sum + Number(variant.price) * item.qty;
  }, 0);

  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      customerId: customer.id,
      source: "WEB",
      fulfillment: input.fulfillment,
      deliveryAddress:
        input.fulfillment === "DELIVERY" ? input.deliveryAddress : null,
      paymentMethod: input.paymentMethod,
      total,
      items: {
        create: input.items.map((item) => {
          const variant = variants.find((v) => v.id === item.variantId)!;
          return {
            variantId: variant.id,
            quantity: item.qty,
            unitPrice: variant.price,
          };
        }),
      },
    },
  });

  const ph = getPostHogClient();
  if (ph) {
    ph.capture({
      distinctId: customer.id,
      event: "order_placed",
      properties: {
        order_id: order.id,
        restaurant_slug: input.restaurantSlug,
        fulfillment: input.fulfillment,
        payment_method: input.paymentMethod,
        total,
        item_count: input.items.reduce((s, i) => s + i.qty, 0),
      },
    });
    await ph.flush();
  }

  return {
    ok: true,
    orderId: order.id,
    total,
    whatsappNumber: restaurant.business.socialLinks[0]?.url ?? null,
    items: input.items.map((item) => {
      const variant = variants.find((v) => v.id === item.variantId)!;
      return { name: variant.product.name, qty: item.qty, price: Number(variant.price) };
    }),
  };
}
