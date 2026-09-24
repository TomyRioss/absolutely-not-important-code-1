import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [""];

  if (process.env.NEXT_PUBLIC_SHOW_PRICING === "true") {
    routes.push("/precios");
  }

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${SITE.url}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.9,
  }));

  // Menús digitales públicos: indexables para que cada restaurante aparezca
  // en búsquedas con su nombre (y puedan vincularse desde Google Maps).
  const restaurants = await prisma.restaurant.findMany({
    select: { slug: true, createdAt: true },
  });

  const menuEntries: MetadataRoute.Sitemap = restaurants.map((r) => ({
    url: `${SITE.url}/menu/${r.slug}`,
    lastModified: r.createdAt,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticEntries, ...menuEntries];
}
