"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { supabaseAdmin, RESTAURANT_ASSETS_BUCKET } from "@/lib/supabase-admin";
import { SocialPlatform } from "@prisma/client";
import { slugify } from "@/lib/slug";
import { assertOwnsRestaurant, assertOwnsBusiness } from "@/lib/tenant";

type ActionResult = { ok: true } | { ok: false; error: string };

async function restaurantIdOfCategory(categoryId: string) {
  const c = await prisma.category.findUnique({ where: { id: categoryId }, select: { restaurantId: true } });
  return c?.restaurantId ?? null;
}

async function restaurantIdOfProduct(productId: string) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { restaurantId: true } });
  return p?.restaurantId ?? null;
}

async function restaurantIdOfModifierGroup(modifierGroupId: string) {
  const g = await prisma.modifierGroup.findUnique({ where: { id: modifierGroupId }, select: { restaurantId: true } });
  return g?.restaurantId ?? null;
}

// ponytail: short goo.gl/maps.app.goo.gl links redirect before revealing lat/lng; resolve server-side (client fetch would hit CORS)
export async function resolveMapsShortLink(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    return res.url || null;
  } catch {
    return null;
  }
}

export async function updateSocialLink(
  businessId: string,
  platform: SocialPlatform,
  url: string,
): Promise<ActionResult> {
  try {
    await assertOwnsBusiness(businessId);
    if (!url.trim()) {
      await prisma.socialLink.deleteMany({ where: { businessId, platform } });
    } else {
      await prisma.socialLink.upsert({
        where: { businessId_platform: { businessId, platform } },
        create: { businessId, platform, url: url.trim() },
        update: { url: url.trim() },
      });
    }
  } catch {
    return { ok: false, error: "No se pudo guardar la red social." };
  }
  revalidatePath("/dashboard/menu/landing");
  return { ok: true };
}

export async function createCategory(
  restaurantId: string,
  name: string,
): Promise<ActionResult> {
  if (!name.trim()) return { ok: false, error: "Nombre requerido." };
  try {
    await assertOwnsRestaurant(restaurantId);
    await prisma.category.create({ data: { restaurantId, name: name.trim() } });
  } catch {
    return { ok: false, error: "Error al crear categoría." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export async function renameCategory(categoryId: string, name: string): Promise<ActionResult> {
  if (!name.trim()) return { ok: false, error: "Nombre requerido." };
  try {
    const restaurantId = await restaurantIdOfCategory(categoryId);
    if (!restaurantId) return { ok: false, error: "Categoría no encontrada." };
    await assertOwnsRestaurant(restaurantId);
    await prisma.category.update({ where: { id: categoryId }, data: { name: name.trim() } });
  } catch {
    return { ok: false, error: "No se pudo renombrar." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export async function reorderCategories(categoryIds: string[]): Promise<ActionResult> {
  try {
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, restaurantId: true },
    });
    if (categories.length !== categoryIds.length) return { ok: false, error: "Categoría no encontrada." };
    const restaurantIds = new Set(categories.map((c) => c.restaurantId));
    if (restaurantIds.size !== 1) return { ok: false, error: "No autorizado." };
    await assertOwnsRestaurant([...restaurantIds][0]);

    await prisma.$transaction(
      categoryIds.map((id, index) =>
        prisma.category.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
  } catch {
    return { ok: false, error: "No se pudo reordenar." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  try {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return { ok: false, error: "Categoría no encontrada." };
    await assertOwnsRestaurant(category.restaurantId);
    if (category.isFeatured) return { ok: false, error: "No se puede borrar la categoría destacada." };
    await prisma.category.delete({ where: { id: categoryId } });
  } catch {
    return { ok: false, error: "No se pudo borrar (tiene productos asociados)." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export type VariantInput = {
  id?: string;
  name: string;
  price: number;
  costPrice: number | null;
  packagingPrice: number | null;
  sku: string | null;
  isDefault: boolean;
};

type SaveProductInput = {
  productId?: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  variants: VariantInput[];
};

export type SaveProductResult =
  | { ok: true; productId: string }
  | { ok: false; error: string };

export async function saveProduct(input: SaveProductInput): Promise<SaveProductResult> {
  if (!input.name.trim()) return { ok: false, error: "Nombre requerido." };
  if (input.variants.length === 0) return { ok: false, error: "Agregá al menos un precio." };
  for (const v of input.variants) {
    if (!Number.isFinite(v.price) || v.price < 0) {
      return { ok: false, error: "Precio inválido." };
    }
  }

  try {
    await assertOwnsRestaurant(input.restaurantId);
    if (input.productId) {
      const existingRestaurantId = await restaurantIdOfProduct(input.productId);
      if (existingRestaurantId !== input.restaurantId) return { ok: false, error: "No autorizado." };
    }

    const productId = await prisma.$transaction(async (tx) => {
      let id = input.productId;
      if (id) {
        await tx.product.update({
          where: { id },
          data: { name: input.name.trim(), description: input.description.trim() || null },
        });
        const existing = await tx.productVariant.findMany({ where: { productId: id } });
        const keepIds = new Set(input.variants.filter((v) => v.id).map((v) => v.id));
        const toDelete = existing.filter((v) => !keepIds.has(v.id));
        if (toDelete.length > 0) {
          await tx.productVariant.deleteMany({ where: { id: { in: toDelete.map((v) => v.id) } } });
        }
      } else {
        const product = await tx.product.create({
          data: {
            restaurantId: input.restaurantId,
            categoryId: input.categoryId,
            name: input.name.trim(),
            description: input.description.trim() || null,
          },
        });
        id = product.id;
      }

      for (const v of input.variants) {
        const data = {
          name: v.name.trim() || "Único",
          price: v.price,
          costPrice: v.costPrice,
          packagingPrice: v.packagingPrice,
          sku: v.sku?.trim() || null,
          isDefault: v.isDefault,
        };
        if (v.id) {
          await tx.productVariant.update({ where: { id: v.id }, data });
        } else {
          await tx.productVariant.create({ data: { ...data, productId: id! } });
        }
      }

      return id!;
    });

    revalidatePath("/dashboard/menu");
    return { ok: true, productId };
  } catch {
    return { ok: false, error: "No se pudo guardar el producto." };
  }
}

export type ModifierInput = { id?: string; name: string; price: number };
export type ModifierGroupInput = {
  id?: string;
  name: string;
  required: boolean;
  multiple: boolean;
  modifiers: ModifierInput[];
};

export async function saveModifierGroup(
  restaurantId: string,
  productId: string,
  input: ModifierGroupInput,
): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Nombre requerido." };
  try {
    await assertOwnsRestaurant(restaurantId);
    const productRestaurantId = await restaurantIdOfProduct(productId);
    if (productRestaurantId !== restaurantId) return { ok: false, error: "No autorizado." };

    await prisma.$transaction(async (tx) => {
      let groupId = input.id;
      if (groupId) {
        await tx.modifierGroup.update({
          where: { id: groupId },
          data: { name: input.name.trim(), required: input.required, multiple: input.multiple },
        });
        const existing = await tx.modifier.findMany({ where: { modifierGroupId: groupId } });
        const keepIds = new Set(input.modifiers.filter((m) => m.id).map((m) => m.id));
        const toDelete = existing.filter((m) => !keepIds.has(m.id));
        if (toDelete.length > 0) {
          await tx.modifier.deleteMany({ where: { id: { in: toDelete.map((m) => m.id) } } });
        }
      } else {
        const count = await tx.modifierGroup.count({ where: { restaurantId } });
        const group = await tx.modifierGroup.create({
          data: {
            restaurantId,
            name: input.name.trim(),
            required: input.required,
            multiple: input.multiple,
            sortOrder: count,
          },
        });
        groupId = group.id;
        await tx.productModifierGroup.create({ data: { productId, modifierGroupId: groupId } });
      }

      for (let i = 0; i < input.modifiers.length; i++) {
        const m = input.modifiers[i];
        const data = { name: m.name.trim() || "Opción", price: m.price, sortOrder: i };
        if (m.id) {
          await tx.modifier.update({ where: { id: m.id }, data });
        } else {
          await tx.modifier.create({ data: { ...data, modifierGroupId: groupId! } });
        }
      }
    });
  } catch {
    return { ok: false, error: "No se pudo guardar el grupo de modificadores." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export async function deleteModifierGroup(groupId: string): Promise<ActionResult> {
  try {
    const restaurantId = await restaurantIdOfModifierGroup(groupId);
    if (!restaurantId) return { ok: false, error: "Grupo no encontrado." };
    await assertOwnsRestaurant(restaurantId);
    await prisma.modifierGroup.delete({ where: { id: groupId } });
  } catch {
    return { ok: false, error: "No se pudo borrar el grupo." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export async function unlinkModifierGroupFromProduct(
  productId: string,
  modifierGroupId: string,
): Promise<ActionResult> {
  try {
    const restaurantId = await restaurantIdOfProduct(productId);
    if (!restaurantId) return { ok: false, error: "Producto no encontrado." };
    await assertOwnsRestaurant(restaurantId);
    await prisma.productModifierGroup.delete({
      where: { productId_modifierGroupId: { productId, modifierGroupId } },
    });
  } catch {
    return { ok: false, error: "No se pudo quitar el grupo del producto." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export type ProductForAssociation = { id: string; name: string; categoryName: string; linked: boolean };

export async function getProductsForModifierGroup(
  restaurantId: string,
  modifierGroupId: string,
): Promise<ProductForAssociation[]> {
  await assertOwnsRestaurant(restaurantId);
  const [products, links] = await Promise.all([
    prisma.product.findMany({
      where: { restaurantId },
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } } },
    }),
    prisma.productModifierGroup.findMany({ where: { modifierGroupId }, select: { productId: true } }),
  ]);
  const linkedIds = new Set(links.map((l) => l.productId));
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    categoryName: p.category?.name ?? "Sin categoría",
    linked: linkedIds.has(p.id),
  }));
}

export async function setModifierGroupProductLink(
  productId: string,
  modifierGroupId: string,
  linked: boolean,
): Promise<ActionResult> {
  try {
    const restaurantId = await restaurantIdOfProduct(productId);
    if (!restaurantId) return { ok: false, error: "Producto no encontrado." };
    await assertOwnsRestaurant(restaurantId);
    if (linked) {
      await prisma.productModifierGroup.upsert({
        where: { productId_modifierGroupId: { productId, modifierGroupId } },
        create: { productId, modifierGroupId },
        update: {},
      });
    } else {
      await prisma.productModifierGroup.deleteMany({ where: { productId, modifierGroupId } });
    }
  } catch {
    return { ok: false, error: "No se pudo actualizar la asociación." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export async function duplicateProduct(productId: string): Promise<ActionResult> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });
    if (!product) return { ok: false, error: "Producto no encontrado." };
    await assertOwnsRestaurant(product.restaurantId);
    await prisma.product.create({
      data: {
        restaurantId: product.restaurantId,
        categoryId: product.categoryId,
        name: `${product.name} (copia)`,
        description: product.description,
        imageUrl: product.imageUrl,
        active: product.active,
        takeAway: product.takeAway,
        variants: {
          create: product.variants.map((v) => ({
            name: v.name,
            price: v.price,
            isDefault: v.isDefault,
          })),
        },
      },
    });
  } catch {
    return { ok: false, error: "No se pudo duplicar el producto." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export async function moveProductCategory(
  productId: string,
  categoryId: string,
): Promise<ActionResult> {
  try {
    const [productRestaurantId, categoryRestaurantId] = await Promise.all([
      restaurantIdOfProduct(productId),
      restaurantIdOfCategory(categoryId),
    ]);
    if (!productRestaurantId || productRestaurantId !== categoryRestaurantId) {
      return { ok: false, error: "No autorizado." };
    }
    await assertOwnsRestaurant(productRestaurantId);
    await prisma.product.update({ where: { id: productId }, data: { categoryId } });
  } catch {
    return { ok: false, error: "No se pudo mover el producto." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export async function toggleProductActive(
  productId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    const restaurantId = await restaurantIdOfProduct(productId);
    if (!restaurantId) return { ok: false, error: "Producto no encontrado." };
    await assertOwnsRestaurant(restaurantId);
    await prisma.product.update({ where: { id: productId }, data: { active } });
  } catch {
    return { ok: false, error: "Error al actualizar producto." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export async function toggleProductTakeAway(
  productId: string,
  takeAway: boolean,
): Promise<ActionResult> {
  try {
    const restaurantId = await restaurantIdOfProduct(productId);
    if (!restaurantId) return { ok: false, error: "Producto no encontrado." };
    await assertOwnsRestaurant(restaurantId);
    await prisma.product.update({ where: { id: productId }, data: { takeAway } });
  } catch {
    return { ok: false, error: "Error al actualizar producto." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadRestaurantAsset(
  restaurantId: string,
  kind: "logo" | "banner",
  dataUrl: string,
): Promise<UploadResult> {
  try {
    await assertOwnsRestaurant(restaurantId);
  } catch {
    return { ok: false, error: "No autorizado." };
  }

  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return { ok: false, error: "Imagen inválida." };
  const [, mimeType, base64] = match;
  const ext = mimeType.split("/")[1];
  const path = `${restaurantId}/${kind}-${Date.now()}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(RESTAURANT_ASSETS_BUCKET)
    .upload(path, Buffer.from(base64, "base64"), { contentType: mimeType, upsert: true });

  if (error) return { ok: false, error: "No se pudo subir la imagen." };

  const { data } = supabaseAdmin.storage.from(RESTAURANT_ASSETS_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

export async function updateRestaurant(
  restaurantId: string,
  data: {
    name?: string;
    logo?: string | null;
    banner?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  },
): Promise<ActionResult> {
  if (data.name !== undefined && !data.name.trim()) {
    return { ok: false, error: "Nombre requerido." };
  }
  try {
    await assertOwnsRestaurant(restaurantId);
    const current = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true } });
    if (!current) return { ok: false, error: "Restaurante no encontrado." };

    let slug = current.slug;
    if (data.name !== undefined) {
      const baseSlug = slugify(data.name) || "restaurante";
      slug = baseSlug;
      let suffix = 1;
      while (await prisma.restaurant.findFirst({ where: { slug, id: { not: restaurantId } }, select: { id: true } })) {
        slug = `${baseSlug}-${suffix++}`;
      }
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.name !== undefined ? { slug } : {}),
        ...(data.logo !== undefined ? { logo: data.logo } : {}),
        ...(data.banner !== undefined ? { banner: data.banner } : {}),
        ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
        ...(data.lat !== undefined ? { lat: data.lat } : {}),
        ...(data.lng !== undefined ? { lng: data.lng } : {}),
      },
      include: { business: { select: { slug: true } } },
    });
    revalidatePath(`/${updated.business.slug}`);
    revalidatePath(`/menu/${current.slug}`);
    revalidatePath(`/menu/${updated.slug}`);
  } catch {
    return { ok: false, error: "No se pudo actualizar el restaurante." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export type OpeningHoursInput = { dayOfWeek: number; openTime: string; closeTime: string };

export async function saveOpeningHours(
  restaurantId: string,
  hours: OpeningHoursInput[],
  timezone: string,
): Promise<ActionResult> {
  for (const h of hours) {
    if (!/^\d{2}:\d{2}$/.test(h.openTime) || !/^\d{2}:\d{2}$/.test(h.closeTime)) {
      return { ok: false, error: "Horario inválido." };
    }
  }
  try {
    await assertOwnsRestaurant(restaurantId);
    await prisma.$transaction([
      prisma.restaurant.update({ where: { id: restaurantId }, data: { timezone } }),
      prisma.openingHours.deleteMany({ where: { restaurantId } }),
      ...hours.map((h, index) =>
        prisma.openingHours.create({
          data: { restaurantId, dayOfWeek: h.dayOfWeek, openTime: h.openTime, closeTime: h.closeTime, sortOrder: index },
        }),
      ),
    ]);
  } catch {
    return { ok: false, error: "No se pudieron guardar los horarios." };
  }
  revalidatePath("/dashboard/menu/landing");
  return { ok: true };
}

export async function createBranch(
  businessId: string,
  name: string,
): Promise<ActionResult & { branch?: { id: string; name: string; slug: string; address: string | null; lat: number | null; lng: number | null } }> {
  if (!name.trim()) return { ok: false, error: "Nombre requerido." };
  try {
    await assertOwnsBusiness(businessId);
    const baseSlug = slugify(name) || "sucursal";
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.restaurant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }
    const branch = await prisma.restaurant.create({
      data: { businessId, name: name.trim(), slug, deliveryRadiusKm: 5 },
      include: { business: { select: { slug: true } } },
    });
    revalidatePath("/dashboard/menu");
    revalidatePath(`/${branch.business.slug}`);
    return { ok: true, branch };
  } catch {
    return { ok: false, error: "No se pudo crear la sucursal." };
  }
}

export async function deleteBranch(restaurantId: string): Promise<ActionResult> {
  try {
    await assertOwnsRestaurant(restaurantId);
    const existing = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { businessId: true, business: { select: { slug: true } } } });
    const count = await prisma.restaurant.count({ where: { businessId: existing?.businessId } });
    if (count <= 1) return { ok: false, error: "No podés borrar la única sucursal." };
    await prisma.restaurant.delete({ where: { id: restaurantId } });
    if (existing) revalidatePath(`/${existing.business.slug}`);
  } catch {
    return { ok: false, error: "No se pudo borrar la sucursal." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export async function uploadProductImage(
  restaurantId: string,
  productId: string,
  dataUrl: string,
): Promise<UploadResult> {
  try {
    await assertOwnsRestaurant(restaurantId);
    const productRestaurantId = await restaurantIdOfProduct(productId);
    if (productRestaurantId !== restaurantId) return { ok: false, error: "No autorizado." };
  } catch {
    return { ok: false, error: "No autorizado." };
  }

  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return { ok: false, error: "Imagen inválida." };
  const [, mimeType, base64] = match;
  const ext = mimeType.split("/")[1];
  const path = `${restaurantId}/products/${productId}-${Date.now()}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(RESTAURANT_ASSETS_BUCKET)
    .upload(path, Buffer.from(base64, "base64"), { contentType: mimeType, upsert: true });

  if (error) return { ok: false, error: "No se pudo subir la imagen." };

  const { data } = supabaseAdmin.storage.from(RESTAURANT_ASSETS_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

export async function updateProductImage(
  productId: string,
  imageUrl: string | null,
): Promise<ActionResult> {
  try {
    const restaurantId = await restaurantIdOfProduct(productId);
    if (!restaurantId) return { ok: false, error: "Producto no encontrado." };
    await assertOwnsRestaurant(restaurantId);
    await prisma.product.update({ where: { id: productId }, data: { imageUrl } });
  } catch {
    return { ok: false, error: "No se pudo actualizar la imagen." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  try {
    const restaurantId = await restaurantIdOfProduct(productId);
    if (!restaurantId) return { ok: false, error: "Producto no encontrado." };
    await assertOwnsRestaurant(restaurantId);
    await prisma.$transaction(async (tx) => {
      await tx.productVariant.deleteMany({ where: { productId } });
      await tx.product.delete({ where: { id: productId } });
    });
  } catch {
    return { ok: false, error: "No se pudo borrar el producto." };
  }
  revalidatePath("/dashboard/menu");
  return { ok: true };
}
