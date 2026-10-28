import { notFound } from "next/navigation";
import Image from "next/image";
import { HiOutlinePhone, HiOutlineBuildingStorefront, HiOutlineMapPin, HiOutlineTruck } from "react-icons/hi2";
import { prisma } from "@/lib/prisma";
import { SOCIAL_PLATFORM_META } from "@/lib/social-platforms";

export default async function BusinessLinkPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;

  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    include: {
      restaurants: { orderBy: { createdAt: "asc" } },
      socialLinks: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!business) notFound();

  const mainRestaurant = business.restaurants[0];
  const whatsapp = business.socialLinks.find((l) => l.platform === "WHATSAPP");

  return (
    <main className="min-h-screen w-full bg-background">
      <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-[2fr_3fr]">
        <div className="relative flex flex-col items-center justify-center gap-3 overflow-hidden border-b border-border p-8 md:border-b-0 md:border-r">
          {mainRestaurant?.banner && (
            <Image
              src={mainRestaurant.banner}
              alt=""
              fill
              className="object-cover object-bottom"
            />
          )}
          {mainRestaurant?.banner && (
            <div className="absolute inset-0 bg-background/70" />
          )}
          {mainRestaurant?.logo ? (
            <Image
              src={mainRestaurant.logo}
              alt={business.name}
              width={112}
              height={112}
              unoptimized
              className="relative z-10 h-28 w-28 rounded-2xl object-cover shadow-sm md:h-40 md:w-40"
            />
          ) : (
            <div className="relative z-10 flex h-28 w-28 items-center justify-center rounded-2xl bg-primary-light text-3xl font-bold text-primary shadow-sm md:h-40 md:w-40">
              {business.name.charAt(0)}
            </div>
          )}
          <h1 className="relative z-10 text-center text-xl font-bold text-text-primary">{business.name}</h1>

          {business.socialLinks.length > 0 && (
            <div className="relative z-10 flex items-center gap-3">
              {business.socialLinks.map((link) => {
                const meta = SOCIAL_PLATFORM_META[link.platform];
                const Icon = meta.icon;
                const href =
                  link.platform === "WHATSAPP"
                    ? `https://wa.me/${link.url.replace(/\D/g, "")}`
                    : link.url;
                return (
                  <a
                    key={link.id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={meta.label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-surface"
                    style={{ color: meta.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center gap-4 p-8">
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            {mainRestaurant && (
              <a
                href={`/menu/${mainRestaurant.slug}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-6 text-center text-lg font-semibold text-white shadow-sm hover:opacity-90"
              >
                <HiOutlineTruck className="h-6 w-6" />
                Delivery
              </a>
            )}
            {mainRestaurant && (
              <a
                href={`/menu/${mainRestaurant.slug}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 py-6 text-center text-lg font-semibold text-text-primary shadow-sm hover:bg-surface"
              >
                <HiOutlineBuildingStorefront className="h-6 w-6" />
                Menú
              </a>
            )}
            <a
              href={`/${businessSlug}/sucursales`}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 py-6 text-center text-lg font-semibold text-text-primary shadow-sm hover:bg-surface"
            >
              <HiOutlineMapPin className="h-6 w-6" />
              Sucursales
            </a>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp.url.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 py-6 text-center text-lg font-semibold text-text-primary shadow-sm hover:bg-surface"
              >
                <HiOutlinePhone className="h-6 w-6" />
                Contacto
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
