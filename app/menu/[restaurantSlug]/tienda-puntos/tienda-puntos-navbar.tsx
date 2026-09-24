"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiSparkles, HiUserCircle, HiArrowRightOnRectangle } from "react-icons/hi2";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { customerSignOut } from "@/lib/customer-session-client";

const TABS = [
  { href: "", label: "Tienda" },
  { href: "/encuestas", label: "Encuestas" },
  { href: "/tarjeta", label: "Tarjeta" },
];

export function TiendaPuntosNavbar({
  restaurantSlug,
  customerName,
  balance,
}: {
  restaurantSlug: string;
  customerName: string;
  balance: number;
}) {
  const pathname = usePathname();
  const base = `/menu/${restaurantSlug}/tienda-puntos`;

  return (
    <div className="mb-5">
      <div className="relative flex w-full items-center justify-between gap-3 overflow-hidden bg-primary px-4 py-3 text-white shadow-lg shadow-primary/20">
        <HiSparkles className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 text-white/10" />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-full text-left outline-none">
            <HiUserCircle className="h-7 w-7 shrink-0 text-white/90" />
            <p className="min-w-0 truncate text-sm font-medium">{customerName}</p>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => customerSignOut(`/menu/${restaurantSlug}`)}
            >
              <HiArrowRightOnRectangle className="h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold tabular-nums backdrop-blur-sm">
          {balance.toLocaleString("es-AR")} pts
        </span>
      </div>

      <div className="grid w-full grid-cols-3 gap-1.5 bg-surface px-4 py-2">
        {TABS.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = pathname === href;
          return (
            <Link
              key={tab.href}
              href={href}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-center text-sm font-medium transition ${
                active ? "bg-background text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
