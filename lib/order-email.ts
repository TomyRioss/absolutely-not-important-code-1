import "server-only";

import { Resend } from "resend";

type NewOrderEmail = {
  orderId: string;
  restaurantName: string;
  ownerEmail: string;
  customerName: string;
  total: number;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export async function sendNewOrderEmail(order: NewOrderEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn(
      `[order-email] Email not sent for order ${order.orderId}: configure RESEND_API_KEY and RESEND_FROM_EMAIL.`,
    );
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const dashboardUrl = new URL(
      "/dashboard/pedidos",
      process.env.NEXT_PUBLIC_APP_URL ?? "https://platorest.com",
    ).toString();
    const shortOrderId = order.orderId.slice(-8);
    const restaurantName = escapeHtml(order.restaurantName);
    const customerName = escapeHtml(order.customerName);
    const subject = `Nuevo pedido #${shortOrderId}`;
    const text = [
      `Entró un nuevo pedido para ${order.restaurantName}.`,
      `Pedido: #${shortOrderId}`,
      `Cliente: ${order.customerName}`,
      `Total: $${order.total.toFixed(2)}`,
      `Abrir pedidos: ${dashboardUrl}`,
    ].join("\n");

    const { error } = await resend.emails.send({
      from,
      to: [order.ownerEmail],
      subject,
      text,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
          <h1 style="font-size: 22px;">Nuevo pedido para ${restaurantName}</h1>
          <p>Entró el pedido <strong>#${shortOrderId}</strong> de ${customerName}.</p>
          <p>Total: <strong>$${order.total.toFixed(2)}</strong></p>
          <p><a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 8px; background: #ea580c; color: #fff; text-decoration: none;">Abrir pedidos</a></p>
        </div>
      `,
    });

    if (error) {
      console.error(
        `[order-email] Failed to send notification for order ${order.orderId}: ${error.message}`,
      );
    }
  } catch (error) {
    console.error(
      `[order-email] Failed to send notification for order ${order.orderId}:`,
      error,
    );
  }
}
