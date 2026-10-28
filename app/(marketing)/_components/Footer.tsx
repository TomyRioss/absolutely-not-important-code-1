import Link from "next/link";
import { FaInstagram, FaFacebookF, FaWhatsapp } from "react-icons/fa6";
import { SITE } from "@/lib/seo";
import { BrandLogo } from "@/components/brand-logo";

const FOOTER_SECTIONS = [
  {
    title: "Producto",
    links: [
      { label: "Demo gratis", href: "/register" },
      ...(process.env.NEXT_PUBLIC_SHOW_PRICING === "true"
        ? [{ label: "Precios", href: "/precios" }]
        : []),
    ],
  },
  {
    title: "Soporte",
    links: [{ label: "WhatsApp", href: SITE.whatsapp }],
  },
];

const SOCIALS = [
  { label: "WhatsApp", href: SITE.whatsapp, icon: FaWhatsapp },
  { label: "Instagram", href: SITE.instagram, icon: FaInstagram },
  { label: "Facebook", href: SITE.facebook, icon: FaFacebookF },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <Link href="/" className="inline-flex">
              <BrandLogo className="h-12 w-auto rounded-sm" />
            </Link>
            <p className="mt-3 text-sm text-text-secondary">
              Menú digital con QR y sistema gastronómico todo-en-uno para restaurantes en Buenos Aires y toda Argentina.
            </p>
            <div className="mt-6 flex gap-3">
              {SOCIALS.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-secondary transition hover:border-primary hover:bg-primary hover:text-white"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm uppercase tracking-wider text-primary">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-secondary hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 border-t border-border pt-6 text-sm text-text-secondary sm:flex-row">
          <p>© {new Date().getFullYear()} PlatoRest. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
