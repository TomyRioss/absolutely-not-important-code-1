import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { DEFAULT_PRODUCTS } from "@/lib/default-products";
import { ensureFeaturedCategory } from "@/lib/featured-category";
import { seedDefaultRewards } from "@/lib/default-rewards";

export async function POST(req: Request) {
  try {
    const { name, email, password, restaurantName, phone } = await req.json();

    if (!name || !email || !password || !restaurantName) {
      return NextResponse.json({ error: "Faltan datos requeridos." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const baseSlug = slugify(restaurantName) || "negocio";
    let businessSlug = baseSlug;
    let businessSuffix = 1;
    while (await prisma.business.findUnique({ where: { slug: businessSlug } })) {
      businessSlug = `${baseSlug}-${businessSuffix++}`;
    }

    const trialEndsAt = new Date(Date.now() + 24 * 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        phone: phone || undefined,
        passwordHash,
      },
    });

    const business = await prisma.business.create({
      data: {
        name: restaurantName,
        slug: businessSlug,
        trialEndsAt,
        plan: "trial",
        ownerId: user.id,
        memberships: {
          create: {
            role: "OWNER",
            userId: user.id,
          },
        },
      },
    });

    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.restaurant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        businessId: business.id,
        name: restaurantName,
        slug,
        deliveryRadiusKm: 5,
      },
    });

    await seedDefaultRewards(business.id);

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

    return NextResponse.json({ businessId: business.id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/register]", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const targetFromMeta = (err.meta?.target as string[] | undefined)?.join(",") ?? "";
      const target = targetFromMeta || err.message;
      if (target.includes("phone")) {
        return NextResponse.json({ error: "Ese número de WhatsApp ya está registrado en otra cuenta." }, { status: 409 });
      }
      if (target.includes("email")) {
        return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
      }
    }
    return NextResponse.json({ error: "No se pudo crear la cuenta. Intentá de nuevo." }, { status: 500 });
  }
}
