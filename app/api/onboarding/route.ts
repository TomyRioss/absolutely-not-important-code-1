import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { DEFAULT_PRODUCTS } from "@/lib/default-products";
import { ensureFeaturedCategory } from "@/lib/featured-category";
import { seedDefaultRewards } from "@/lib/default-rewards";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { address, lat, lng, fullName, phone, restaurantName } = await req.json();

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    let membership = await prisma.membership.findFirst({
      where: { userId: user.id, role: "OWNER" },
      include: { business: true },
    });

    if (!membership) {
      if (!restaurantName) {
        return NextResponse.json({ error: "Falta el nombre del restaurante." }, { status: 400 });
      }

      if (fullName || phone) {
        await prisma.user.update({
          where: { id: user.id },
          data: { name: fullName || user.name, phone: phone || user.phone },
        });
      }

      const baseBusinessSlug = slugify(restaurantName) || "negocio";
      let businessSlug = baseBusinessSlug;
      let businessSuffix = 1;
      while (await prisma.business.findUnique({ where: { slug: businessSlug } })) {
        businessSlug = `${baseBusinessSlug}-${businessSuffix++}`;
      }

      const trialEndsAt = new Date(Date.now() + 24 * 24 * 60 * 60 * 1000);
      try {
        const business = await prisma.business.create({
          data: {
            name: restaurantName,
            slug: businessSlug,
            trialEndsAt,
            plan: "trial",
            ownerId: user.id,
            memberships: { create: { role: "OWNER", userId: user.id } },
          },
        });

        membership = await prisma.membership.findFirstOrThrow({
          where: { businessId: business.id, userId: user.id },
          include: { business: true },
        });

        await seedDefaultRewards(business.id);
      } catch (err) {
        if (!(err && typeof err === "object" && "code" in err && err.code === "P2002")) throw err;
        const existingMembership = await prisma.membership.findFirst({
          where: { userId: user.id, role: "OWNER" },
          include: { business: true },
        });
        if (!existingMembership) throw err;
        membership = existingMembership;
      }
    }

    const existingRestaurant = await prisma.restaurant.findFirst({
      where: { businessId: membership.businessId },
    });
    if (existingRestaurant) {
      return NextResponse.json({ slug: existingRestaurant.slug }, { status: 200 });
    }

    const baseSlug = slugify(membership.business.name) || "negocio";
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.restaurant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        businessId: membership.businessId,
        name: membership.business.name,
        slug,
        address: address ?? undefined,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        deliveryRadiusKm: 5,
      },
    });

    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((name, sortOrder) => ({
        restaurantId: restaurant.id,
        name,
        sortOrder,
      })),
    });

    await ensureFeaturedCategory(restaurant.id);

    const categories = await prisma.category.findMany({
      where: { restaurantId: restaurant.id },
      select: { id: true, name: true },
    });
    const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

    await Promise.all(
      DEFAULT_PRODUCTS.map(async (p) => {
        const product = await prisma.product.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: categoryIdByName.get(p.categoryName) ?? null,
            name: p.name,
            description: p.description,
            imageUrl: p.imageUrl,
            variants: {
              create: { name: "Único", price: p.price, isDefault: true },
            },
          },
        });

        for (const [i, mg] of (p.modifierGroups ?? []).entries()) {
          await prisma.modifierGroup.create({
            data: {
              restaurantId: restaurant.id,
              name: mg.name,
              required: mg.required,
              multiple: mg.multiple,
              sortOrder: i,
              modifiers: {
                create: mg.options.map((o, j) => ({
                  name: o.name,
                  price: o.price ?? 0,
                  sortOrder: j,
                })),
              },
              products: {
                create: { productId: product.id, sortOrder: i },
              },
            },
          });
        }
      }),
    );

    const ph = getPostHogClient();
    if (ph) {
      ph.capture({
        distinctId: user.id,
        event: "onboarding_completed",
        properties: { restaurant_slug: slug, plan: "trial" },
      });
      await ph.flush();
    }

    return NextResponse.json({ slug: restaurant.slug }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/onboarding]", err);
    return NextResponse.json({ error: "No se pudo completar el registro del local." }, { status: 500 });
  }
}
