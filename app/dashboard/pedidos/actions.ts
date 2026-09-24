"use server";

import { prisma } from "@/lib/prisma";
import { decrementStockOrThrow } from "@/lib/stock";
import { pointsForTotal } from "@/lib/loyalty";
import { revalidatePath } from "next/cache";
import { assertOwnsRestaurant } from "@/lib/tenant";

type OrderStatus = "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, restaurant: { select: { businessId: true } } },
  });
  if (!order) return { ok: false, error: "Pedido no encontrado." };

  try {
    await assertOwnsRestaurant(order.restaurantId);

    await prisma.$transaction(async (tx) => {
      // V4: stock decrements when order first leaves PENDING toward fulfillment
      const advancesPastPending =
        order.status === "PENDING" &&
        ["CONFIRMED", "PREPARING", "READY", "COMPLETED"].includes(newStatus);
      if (advancesPastPending) {
        const stockError = await decrementStockOrThrow(
          tx,
          order.restaurantId,
          order.items.map((i) => ({ variantId: i.variantId, qty: i.quantity })),
        );
        if (stockError) {
          throw new Error(
            `Stock insuficiente de "${stockError.name}" (disponible: ${stockError.available}).`,
          );
        }
      }

      // V5: loyaltyPoints only awarded once, on completed paid order
      if (order.status !== "COMPLETED" && newStatus === "COMPLETED" && order.customerId) {
        const points = await pointsForTotal(Number(order.total), order.restaurant.businessId, tx);
        if (points > 0) {
          await tx.pointsTransaction.create({
            data: { customerId: order.customerId, points, reason: "ORDER", orderId: order.id },
          });
        }
      }

      await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar el pedido.";
    return { ok: false, error: message };
  }

  revalidatePath("/dashboard/pedidos");
  return { ok: true };
}

export async function updateOrderItems(
  orderId: string,
  items: { variantId: string; quantity: number }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  if (order.status !== "PENDING") {
    return { ok: false, error: "Solo se puede editar un pedido pendiente." };
  }
  if (items.length === 0 || items.some((i) => i.quantity < 1)) {
    return { ok: false, error: "El pedido debe tener al menos un producto con cantidad válida." };
  }

  try {
    await assertOwnsRestaurant(order.restaurantId);

    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: items.map((i) => i.variantId) },
        product: { restaurantId: order.restaurantId },
      },
    });
    if (variants.length !== new Set(items.map((i) => i.variantId)).size) {
      return { ok: false, error: "Producto no encontrado." };
    }

    const total = items.reduce((sum, i) => {
      const variant = variants.find((v) => v.id === i.variantId)!;
      return sum + Number(variant.price) * i.quantity;
    }, 0);

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId } });
      await tx.orderItem.createMany({
        data: items.map((i) => ({
          orderId,
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: variants.find((v) => v.id === i.variantId)!.price,
        })),
      });
      await tx.order.update({ where: { id: orderId }, data: { total } });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar el pedido.";
    return { ok: false, error: message };
  }

  revalidatePath("/dashboard/pedidos");
  return { ok: true };
}
