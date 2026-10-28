"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Smartphone, Rocket } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { QrDownloadButton } from "./qr-download-button";
import { Separator } from "@/components/ui/separator";
import type { OnboardingProgress } from "@/lib/onboarding";
import { BrandLogo } from "@/components/brand-logo";

type MobileNavProps = {
  menuUrl: string;
  slug: string | null;
  isPro: boolean;
  trialDaysLeft: number | null;
  onboarding?: OnboardingProgress | null;
};

export function MobileNav({ menuUrl, slug, isPro, trialDaysLeft, onboarding }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleNavigateCapture(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("a")) setOpen(false);
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="flex h-11 w-11 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10"
      >
        <Menu className="h-6 w-6" />
      </button>

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setOpen(false)}
        />
        <aside
          onClickCapture={handleNavigateCapture}
          className={`absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-primary py-4 shadow-xl transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-4 pb-2">
            <BrandLogo className="h-11 w-auto brightness-0 invert" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="flex h-10 w-10 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!isPro && (
            <div className="mx-3 mb-3 flex items-center justify-between gap-2 rounded-md bg-white/10 px-3 py-2.5">
              <Link
                href="/dashboard/pricing"
                className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-primary"
              >
                <Rocket className="h-3.5 w-3.5" />
                Mejorá tu plan
              </Link>
              {trialDaysLeft !== null && (
                <span className="text-xs font-semibold text-white/80">
                  {trialDaysLeft > 0
                    ? `${trialDaysLeft} días de prueba`
                    : "Trial expirado"}
                </span>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-2">
            <SidebarNav onboarding={onboarding} />
          </div>

          {slug && (
            <div className="mt-auto border-t border-white/15 px-3 pt-4">
              <div className="flex items-stretch overflow-hidden rounded-md bg-white">
                <Link
                  href={`/menu/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  <Smartphone className="h-6 w-6" />
                  Vista previa
                </Link>
                <Separator orientation="vertical" className="!h-auto bg-border" />
                <QrDownloadButton menuUrl={menuUrl} slug={slug} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
