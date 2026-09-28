import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_PRO_PRICE_ARS } from "@/lib/pricing";

export async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fdashboard%2Fadmin");

  if (!(await isPlatformAdmin(session.user.id))) redirect("/dashboard");
  return session;
}

export async function isPlatformAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  return user?.platformRole === "ADMIN";
}

export async function getPlatformSnapshot() {
  const [users, businesses, userCount, businessCount, restaurants, orders, menuProducts, orderTotals, activePlans, openRegisterSessions, recentOrders] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, phone: true, createdAt: true, lastLoginAt: true, platformRole: true, memberships: { select: { business: { select: { name: true } } } } },
    }),
    prisma.business.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, slug: true, plan: true, createdAt: true, trialEndsAt: true, proStartedAt: true,
        owner: { select: { id: true, name: true, email: true } },
        restaurants: {
          select: {
            id: true, name: true, slug: true, createdAt: true,
            products: { select: { id: true, name: true, description: true, active: true, category: { select: { name: true } }, variants: { select: { name: true, price: true } } } },
            _count: { select: { products: true, orders: true } },
          },
        },
      },
    }),
    prisma.user.count(),
    prisma.business.count(),
    prisma.restaurant.count(),
    prisma.order.count(),
    prisma.product.count(),
    prisma.order.aggregate({ where: { status: "COMPLETED" }, _sum: { total: true } }),
    prisma.business.count({ where: { plan: "pro" } }),
    prisma.registerSession.count({ where: { closedAt: null } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { restaurant: { select: { name: true, business: { select: { name: true } } } }, items: { include: { variant: { include: { product: { select: { name: true } } } } } }, customer: { select: { name: true } } },
    }),
  ]);

  const orderCounts = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
  const monthlyRecurringRevenue = activePlans * PLAN_PRO_PRICE_ARS;

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      users: userCount,
      businesses: businessCount,
      restaurants,
      orders,
      menuProducts,
      activePlans,
      openRegisterSessions,
      monthlyRecurringRevenue,
      annualRecurringRevenue: monthlyRecurringRevenue * 12,
      orderGrossTotal: Number(orderTotals._sum.total ?? 0),
      churnAvailable: false,
      orderCounts: Object.fromEntries(orderCounts.map(({ status, _count }) => [status, _count._all])),
    },
    users: users.map(({ memberships, ...user }) => ({ ...user, businessCount: memberships.length, businesses: memberships.map(({ business }) => business.name) })),
    businesses: businesses.map((business) => ({
      ...business,
      restaurants: business.restaurants.map((restaurant) => ({
        ...restaurant,
        products: restaurant.products.map((product) => ({
          ...product,
          variants: product.variants.map((variant) => ({ ...variant, price: Number(variant.price) })),
        })),
      })),
    })),
    orders: recentOrders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      status: order.status,
      source: order.source,
      fulfillment: order.fulfillment,
      total: Number(order.total),
      businessName: order.restaurant.business.name,
      restaurantName: order.restaurant.name,
      customerName: order.customer?.name ?? null,
      items: order.items.map(({ quantity, variant }) => ({ name: variant.product.name, quantity })),
    })),
  };
}

export type PlatformSnapshot = Awaited<ReturnType<typeof getPlatformSnapshot>>;
