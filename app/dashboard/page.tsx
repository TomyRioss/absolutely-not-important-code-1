import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireBusinessId } from "@/lib/tenant";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { QrDownloadButton } from "./qr-download-button";
import { LinkPreviewCard } from "./link-preview-card";
import { OnboardingWidget } from "./onboarding-widget";
import { getOnboardingProgress } from "@/lib/onboarding";

export default async function AdminHome() {
  const businessId = await requireBusinessId();

  const restaurant = await prisma.restaurant.findFirst({
    where: { businessId },
    orderBy: { createdAt: "asc" },
    include: { business: { select: { slug: true } } },
  });

  const host = (await headers()).get("host");
  const isLocalHost = host ? /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) : false;
  const origin = host ? `${isLocalHost ? "http" : "https"}://${host}` : "";
  const menuUrl = restaurant ? `${origin}/menu/${restaurant.slug}` : "";
  const onboardingUrl = restaurant ? `${origin}/${restaurant.business.slug}` : "";
  const qrPreviewUrl = menuUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}`
    : "";
  const onboarding = await getOnboardingProgress(businessId, restaurant?.id ?? null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Panel admin</h1>

      {onboarding && <OnboardingWidget progress={onboarding} variant="full" />}

      {!restaurant ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-text-secondary">Creando página web...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <LinkPreviewCard title="Menú digital" url={menuUrl} />
          <LinkPreviewCard title="Menú de bienvenida" url={onboardingUrl} />

          <Card>
            <CardHeader>
              <CardTitle>QR Menú Digital</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <Image src={qrPreviewUrl} alt="QR del menú digital" width={128} height={128} unoptimized className="h-32 w-32" />
              <div className="flex w-full items-center rounded-lg border border-border">
                <div className="flex w-[30%] shrink-0">
                  <QrDownloadButton menuUrl={menuUrl} slug={restaurant.slug} label="Descargar QR" />
                </div>
                <a
                  href={menuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-[70%] min-w-0 truncate border-l border-border px-2 py-2 text-xs text-text-secondary underline underline-offset-2"
                >
                  {menuUrl}
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
import Image from "next/image";
