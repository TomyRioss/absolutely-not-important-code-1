"use server";

import { prisma } from "@/lib/prisma";
import { decrementStockOrThrow } from "@/lib/stock";
import { pointsForTotal } from "@/lib/loyalty";
import { assertOwnsRestaurant } from "@/lib/tenant";

export type PosOrderInput = {
  restaurantId: string;
  items: { variantId: string; qty: number }[];
  paymentMethod: "CASH";
  customerPhone?: string;
  customerEmail?: string;
};

export type PosOrderResult =
  | { ok: true; orderId: string; total: number }
  | { ok: false; error: string };

export async function createPosOrder(
  input: PosOrderInput,
): Promise<PosOrderResult> {
  if (input.items.length === 0) {
    return { ok: false, error: "Agregá al menos un producto." };
  }

  try {
    await assertOwnsRestaurant(input.restaurantId);
  } catch {
    return { ok: false, error: "No autorizado." };
  }

  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: input.restaurantId },
  });

  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: input.items.map((i) => i.variantId) },
      product: { restaurantId: input.restaurantId, active: true },
    },
  });
  if (variants.length !== input.items.length) {
    return { ok: false, error: "Algún producto ya no está disponible." };
  }

  let customerId: string | undefined;
  if (input.customerPhone || input.customerEmail) {
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
          name: "Cliente mostrador",
          phone: input.customerPhone,
          email: input.customerEmail,
        },
      });
    }
    customerId = customer.id;
  }

  const total = input.items.reduce((sum, item) => {
    const variant = variants.find((v) => v.id === item.variantId)!;
    return sum + Number(variant.price) * item.qty;
  }, 0);

  const result = await prisma.$transaction(async (tx) => {
    const stockError = await decrementStockOrThrow(
      tx,
      input.restaurantId,
      input.items,
    );
    if (stockError) {
      return {
        ok: false as const,
        error: `Stock insuficiente de "${stockError.name}" (disponible: ${stockError.available}).`,
      };
    }

    const order = await tx.order.create({
      data: {
        restaurantId: input.restaurantId,
        customerId,
        source: "POS",
        fulfillment: "PICKUP",
        status: "COMPLETED",
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

    // V5: loyaltyPoints only awarded on completed paid order — POS orders are created COMPLETED
    if (customerId) {
      const points = await pointsForTotal(total, restaurant.businessId, tx);
      if (points > 0) {
        await tx.pointsTransaction.create({
          data: { customerId, points, reason: "ORDER", orderId: order.id },
        });
      }
    }

    return { ok: true as const, orderId: order.id, total };
  });

  return result;
}
