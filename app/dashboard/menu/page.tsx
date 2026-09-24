import { prisma } from "@/lib/prisma";
import { ensureFeaturedCategory } from "@/lib/featured-category";
import { requireBusinessId } from "@/lib/tenant";
import { MenuClient } from "./menu-client";

const currentTime = () => Date.now();

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const businessId = await requireBusinessId();
  const restaurant = await prisma.restaurant.findFirst({
    where: { businessId },
    orderBy: { createdAt: "asc" },
    include: { business: { select: { plan: true, trialEndsAt: true } } },
  });
  if (!restaurant) {
    return (
      <main className="p-6 text-text-secondary">
        No hay restaurantes configurados.
      </main>
    );
  }

  await ensureFeaturedCategory(restaurant.id);

  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        orderBy: { name: "asc" },
        include: {
          variants: true,
          modifierGroups: {
            orderBy: { sortOrder: "asc" },
            include: {
              modifierGroup: {
                include: { modifiers: { orderBy: { sortOrder: "asc" } } },
              },
            },
          },
        },
      },
    },
  });

  const isPro = restaurant.business.plan === "pro";
  const trialExpired = !!restaurant.business.trialEndsAt && restaurant.business.trialEndsAt.getTime() < currentTime();
  const readOnly = !isPro && trialExpired;

  return (
    <MenuClient
      readOnly={readOnly}
      restaurantId={restaurant.id}
      restaurantSlug={restaurant.slug}
      restaurantName={restaurant.name}
      restaurantLogo={restaurant.logo}
      restaurantBanner={restaurant.banner}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        isFeatured: c.isFeatured,
        products: c.products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          active: p.active,
          takeAway: p.takeAway,
          price: Number(p.variants.find((v) => v.isDefault)?.price ?? p.variants[0]?.price ?? 0),
          imageUrl: p.imageUrl,
          variants: p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: Number(v.price),
            costPrice: v.costPrice === null ? null : Number(v.costPrice),
            packagingPrice: v.packagingPrice === null ? null : Number(v.packagingPrice),
            sku: v.sku,
            isDefault: v.isDefault,
          })),
          modifierGroups: p.modifierGroups.map((pmg) => ({
            id: pmg.modifierGroup.id,
            name: pmg.modifierGroup.name,
            required: pmg.modifierGroup.required,
            multiple: pmg.modifierGroup.multiple,
            modifiers: pmg.modifierGroup.modifiers.map((m) => ({ id: m.id, name: m.name, price: Number(m.price) })),
          })),
        })),
      }))}
    />
  );
}
