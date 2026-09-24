"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { QrDownloadButton } from "./qr-download-button";
import { Separator } from "@/components/ui/separator";
import type { OnboardingProgress } from "@/lib/onboarding";

export function DashboardShell({
  children,
  menuUrl,
  slug,
  onboarding,
}: {
  children: React.ReactNode;
  menuUrl: string;
  slug: string | null;
  onboarding?: OnboardingProgress | null;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className={`hidden shrink-0 flex-col bg-primary py-6 transition-[width] md:flex ${collapsed ? "w-16" : "w-56"}`}>
        <SidebarNav onboarding={onboarding} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        {!collapsed && slug && (
          <div className="mt-auto border-t border-white/15 px-3 pt-4">
            <div className="flex items-stretch overflow-hidden rounded-md bg-white">
              <a
                href={`/menu/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
              >
                <Smartphone className="h-6 w-6" />
                Vista previa
              </a>
              <Separator orientation="vertical" className="!h-auto bg-border" />
              <QrDownloadButton menuUrl={menuUrl} slug={slug} />
            </div>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
