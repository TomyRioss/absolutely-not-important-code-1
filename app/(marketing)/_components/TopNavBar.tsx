"use client";

import Link from "next/link";
import { useState } from "react";

export default function TopNavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center px-6 py-4 md:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex items-center gap-1.5 text-3xl font-medium tracking-normal text-primary">
          PlatoRest
        </Link>

        <div className="hidden items-center justify-end gap-3 md:col-start-3 md:flex">
          <Link
            href="/login"
            className="border-b-2 border-primary text-sm font-semibold text-text-primary transition-colors duration-200 hover:text-primary"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-hover"
          >
            Demo Gratis
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="-m-2 justify-self-end p-2 text-xl leading-none text-text-primary md:hidden"
          aria-label="Abrir menú"
          aria-expanded={open}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-border px-6 py-4 md:hidden">
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="mt-2 self-center border-b-2 border-primary py-2 text-center text-sm font-semibold text-text-primary transition-colors duration-200 hover:text-primary"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            onClick={() => setOpen(false)}
            className="rounded bg-primary px-4 py-2 text-center text-sm font-bold text-white transition-colors duration-200 hover:bg-primary-hover"
          >
            Demo Gratis
          </Link>
        </nav>
      )}
    </header>
  );
}
