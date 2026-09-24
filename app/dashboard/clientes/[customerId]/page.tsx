import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBusinessId } from "@/lib/tenant";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const businessId = await requireBusinessId();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId, businessId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: { include: { variant: { include: { product: true } } } } },
      },
      pointsTransactions: { select: { points: true } },
      redemptions: {
        orderBy: { createdAt: "desc" },
        include: { reward: { select: { name: true } }, rewardVariant: { select: { name: true } } },
      },
    },
  });
  if (!customer) notFound();

  const loyaltyPoints = customer.pointsTransactions.reduce((sum, t) => sum + t.points, 0);

  const productCounts = new Map<string, number>();
  for (const order of customer.orders) {
    for (const item of order.items) {
      const name = item.variant.product.name;
      productCounts.set(name, (productCounts.get(name) ?? 0) + item.quantity);
    }
  }
  const favoriteProduct = [...productCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const totalSpent = customer.orders.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <main className="min-h-screen bg-surface p-4 md:p-6">
      <Link href="/dashboard/clientes" className="text-sm text-primary">
        ← Clientes
      </Link>

      <div className="my-4 rounded-lg border border-border bg-background p-4">
        <h1 className="text-xl font-semibold text-text-primary">
          {customer.name}
        </h1>
        <p className="text-text-secondary">
          {[customer.phone, customer.email].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <p className="font-medium text-primary">{loyaltyPoints} puntos</p>
          <p className="text-text-secondary">{customer.orders.length} pedidos</p>
          <p className="text-text-secondary">
            Total gastado: ${totalSpent.toLocaleString("es-AR")}
          </p>
          {favoriteProduct && (
            <p className="text-text-secondary">Favorito: {favoriteProduct}</p>
          )}
          <p className="text-text-secondary">Tarjeta de fidelización: próximamente</p>
        </div>
      </div>

      <h2 className="mb-2 font-semibold text-text-primary">
        Historial de pedidos
      </h2>
      <ul className="mb-4 divide-y divide-border rounded-lg border border-border bg-background">
        {customer.orders.length === 0 && (
          <li className="p-4 text-sm text-text-secondary">Sin pedidos.</li>
        )}
        {customer.orders.map((order) => (
          <li key={order.id} className="p-4">
            <div className="flex justify-between text-sm text-text-secondary">
              <span>{order.createdAt.toLocaleString("es-AR")}</span>
              <span>{order.source} · {order.status}</span>
            </div>
            <ul className="mt-1 text-text-primary">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.quantity}x {item.variant.product.name}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-right font-medium text-text-primary">
              Total: ${formatMoney(order.total.toString())}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 font-semibold text-text-primary">
        Historial de canjeados
      </h2>
      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {customer.redemptions.length === 0 && (
          <li className="p-4 text-sm text-text-secondary">Sin canjes.</li>
        )}
        {customer.redemptions.map((redemption) => (
          <li key={redemption.id} className="flex justify-between p-4 text-sm">
            <div>
              <p className="font-medium text-text-primary">
                {redemption.reward.name}
                {redemption.rewardVariant ? ` · ${redemption.rewardVariant.name}` : ""}
              </p>
              <p className="text-text-secondary">
                {redemption.createdAt.toLocaleString("es-AR")} · {redemption.status}
              </p>
            </div>
            <p className="shrink-0 pl-3 font-medium text-primary">
              -{redemption.pointsSpent} pts
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
