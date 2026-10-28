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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://platorest.com";
    const dashboardUrl = new URL("/dashboard/pedidos", appUrl).toString();
    const logoUrl = new URL("/platorest-brand-email.png", appUrl).toString();
    const shortOrderId = order.orderId.slice(-8);
    const restaurantName = escapeHtml(order.restaurantName);
    const customerName = escapeHtml(order.customerName);
    const formattedTotal = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(order.total);
    const subject = `Nuevo pedido #${shortOrderId}`;
    const text = [
      `Te llegó un pedido nuevo para ${order.restaurantName}.`,
      `Pedido: #${shortOrderId}`,
      `Cliente: ${order.customerName}`,
      `Total: ${formattedTotal}`,
      `Abrir pedidos: ${dashboardUrl}`,
    ].join("\n");
    const html = `
      <!doctype html>
      <html lang="es">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="margin:0;padding:0;background-color:#f4f4f5;color:#1c1917;font-family:Arial,Helvetica,sans-serif;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
            Nuevo pedido #${shortOrderId} para ${restaurantName}.
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
            <tr>
              <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
                  <tr>
                    <td align="center" style="padding:4px 20px 24px;">
                      <img src="${escapeHtml(logoUrl)}" width="210" alt="Platorest" style="display:block;width:210px;max-width:100%;height:auto;border:0;" />
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 4px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e4e7ec;border-radius:14px;">
                        <tr>
                          <td style="padding:32px 28px 28px;">
                            <p style="margin:0 0 8px;color:#52525b;font-size:14px;line-height:20px;">${restaurantName}</p>
                            <h1 style="margin:0;color:#1c1917;font-size:26px;line-height:32px;font-weight:700;">Te llegó un pedido nuevo</h1>
                            <p style="margin:10px 0 0;color:#52525b;font-size:15px;line-height:23px;">Revisá los datos y preparalo desde tu panel.</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 28px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #e4e7ec;border-bottom:1px solid #e4e7ec;">
                              <tr>
                                <td style="padding:15px 0;color:#52525b;font-size:14px;line-height:20px;">Pedido</td>
                                <td align="right" style="padding:15px 0;color:#1c1917;font-size:14px;line-height:20px;font-weight:700;">#${shortOrderId}</td>
                              </tr>
                              <tr>
                                <td style="padding:15px 0;border-top:1px solid #e4e7ec;color:#52525b;font-size:14px;line-height:20px;">Cliente</td>
                                <td align="right" style="padding:15px 0;border-top:1px solid #e4e7ec;color:#1c1917;font-size:14px;line-height:20px;font-weight:600;">${customerName}</td>
                              </tr>
                              <tr>
                                <td style="padding:15px 0;border-top:1px solid #e4e7ec;color:#52525b;font-size:14px;line-height:20px;">Total</td>
                                <td align="right" style="padding:15px 0;border-top:1px solid #e4e7ec;color:#1c1917;font-size:16px;line-height:22px;font-weight:700;">${formattedTotal}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:28px;">
                            <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;min-height:48px;box-sizing:border-box;padding:14px 24px;border-radius:8px;background-color:#ff6b00;color:#1c1917;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;">Abrir pedidos</a>
                            <p style="margin:16px 0 0;color:#52525b;font-size:13px;line-height:20px;">Desde el panel podés revisar el pedido y actualizar su estado.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:22px 16px 0;color:#71717a;font-size:12px;line-height:18px;">
                      Aviso automático de pedidos de Platorest<br />
                      <a href="https://platorest.com" style="color:#52525b;text-decoration:underline;">platorest.com</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const { error } = await resend.emails.send({
      from,
      to: [order.ownerEmail],
      subject,
      text,
      html,
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
