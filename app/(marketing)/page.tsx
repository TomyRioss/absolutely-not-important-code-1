import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HiHeart, HiDeviceTablet } from "react-icons/hi2";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  buildMetadata,
  faqJsonLd,
  softwareApplicationJsonLd,
  webPageJsonLd,
} from "@/lib/seo";
import { FaqSection } from "./_components/sections";
import LeadForm from "./_components/LeadForm";
import { PromoCountdown } from "@/components/promo-countdown";

const DESCRIPTION =
  "PlatoRest es el menú digital con QR y sistema gastronómico para restaurantes en Buenos Aires y toda Argentina: carta digital, pedidos online sin comisiones, punto de venta, inventario, estadísticas y fidelización en un solo lugar.";

export const metadata: Metadata = buildMetadata({
  title: "Menú Digital con QR y Sistema Gastronómico para Restaurantes",
  description: DESCRIPTION,
  path: "/",
});

const HOME_FAQS = [
  {
    question: "¿Qué es PlatoRest?",
    answer:
      "PlatoRest es un sistema gastronómico todo-en-uno para restaurantes, desarrollado en Buenos Aires, Argentina. Incluye menú digital con código QR, pedidos online sin comisiones, punto de venta (POS), control de inventario, estadísticas y fidelización de clientes en una sola plataforma.",
  },
  {
    question: "¿Qué es un menú digital con QR para restaurantes?",
    answer:
      "Es la versión online de tu carta: el cliente escanea un código QR desde su celular, sin descargar ninguna app, y ve tus platos y precios siempre actualizados. Con PlatoRest además puede pedir, pagar y reservar desde el mismo menú digital.",
  },
  {
    question: "¿PlatoRest cobra comisiones por los pedidos online?",
    answer:
      "No. A diferencia de las apps de delivery, PlatoRest no cobra comisiones por pedido. Funciona con una suscripción mensual fija y los pedidos que recibís a través de tu menú digital son 100% tuyos.",
  },
  {
    question: "¿Funciona en Buenos Aires y en el resto de Argentina?",
    answer:
      "Sí. PlatoRest funciona en CABA, GBA y cualquier provincia de Argentina porque es 100% online. El soporte es 24/7, incluidos feriados y fines de semana, con atención presencial en CABA y Gran Buenos Aires.",
  },
  {
    question: "¿Puedo probarlo antes de empezar?",
    answer:
      "Sí, tenés una prueba de 24 días gratuita al registrarte para probar el sistema.",
  },
];

const FEATURES = [
  {
    icon: HiHeart,
    eyebrow: "Fidelización de clientes",
    title: "Convertí cada visita en un cliente que vuelve",
    description:
      "Un programa de fidelización simple y automático: tus clientes suman puntos, ganan regalos y vuelven una y otra vez. Sin tarjetas de papel, sin planillas: todo pasa en tu menú digital.",
    image: "https://images.pexels.com/photos/1304540/pexels-photo-1304540.jpeg?auto=compress&cs=tinysrgb&w=1200",
    items: [
      {
        title: "Tienda de puntos",
        description: "Tus clientes canjean sus puntos por premios y vuelven por más.",
      },
      {
        title: "Regalos por visita",
        description: "Sorprendé a quienes te eligen todos los días y convertilos en fans.",
      },
      {
        title: "Registro de clientes",
        description: "Construí tu propia base de datos y conocé a tus mejores clientes.",
      },
    ],
  },
  {
    icon: HiDeviceTablet,
    eyebrow: "Menú digital con QR",
    title: "Tu carta viva, en el celular de cada cliente",
    description:
      "Un menú digital que trabaja para vos las 24 horas: recibe pedidos, toma reservas y muestra tus platos donde te buscan. Sin comisiones de apps de delivery: cada venta es 100% tuya.",
    image: "https://images.pexels.com/photos/4391470/pexels-photo-4391470.jpeg?auto=compress&cs=tinysrgb&w=1200",
    items: [
      {
        title: "Pedidos online sin comisiones",
        description: "Olvidate de pagar un % por pedido: lo que vendés es tuyo.",
      },
      {
        title: "Menú digital apto para Google Maps",
        description: "Tu carta siempre actualizada, exactamente donde te encuentran.",
      },
      {
        title: "Reservas desde el menú digital",
        description: "Ocupá tu salón sin atender un solo teléfono.",
      },
    ],
  },
];

export default function LandingPage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            softwareApplicationJsonLd(),
            webPageJsonLd({
              name: "Menú Digital con QR y Sistema Gastronómico para Restaurantes",
              description: DESCRIPTION,
              path: "/",
            }),
            faqJsonLd(HOME_FAQS),
          ]),
        }}
      />

      <header className="relative flex flex-col overflow-hidden bg-orange-50 lg:h-[70vh] lg:flex-row">
        <div className="relative z-10 flex flex-1 items-center px-6 pt-20 pb-12 lg:w-[50%] lg:py-0 lg:px-16">
          <div>
            <h1 className="text-balance text-2xl font-bold leading-[1.15] tracking-tight text-primary sm:text-3xl lg:text-4xl">
              Menú digital con QR y sistema gastronómico todo-en-uno para tu restaurante.
            </h1>
            <p className="mt-6 max-w-lg text-pretty text-lg text-text-secondary">
              PlatoRest te muestra el salón completo en tiempo real: quién
              está sentado, quién espera la cuenta y qué mesa se libera
              primero. Menú digital con QR, POS, inventario y fidelización.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#contacto"
                className={cn(buttonVariants({ size: "lg" }), "h-auto min-h-11 rounded-lg px-8 py-4 text-lg shadow-lg")}
              >
                Agendar demo
              </Link>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-auto min-h-11 rounded-lg border-2 border-primary px-6 py-4 text-base text-primary hover:bg-primary-light hover:text-primary"
                )}
              >
                Acceder ahora
              </Link>
            </div>
          </div>
        </div>

        <div className="relative h-72 w-full sm:h-96 lg:h-auto lg:w-[50%]">
          <Image
            src="https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt="Cocina de restaurante usando un sistema gastronómico"
            fill
            priority
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-cover"
          />
        </div>

        <div className="absolute -bottom-1 left-0 right-0 h-24 rounded-t-[100%] bg-surface md:h-32" />
      </header>


      <div className="bg-surface pb-16 pt-20">
        <div className="mx-auto mb-14 max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-bold text-primary md:text-4xl">
            ¡Gestiona todo desde un solo lugar!
          </h2>
        </div>

        <div className="flex flex-col gap-10">
            {FEATURES.map((f, i) => {
              const imageFirst = i % 2 === 1;
              return (
                <section
                  key={f.title}
                  className={cn(
                    "w-full",
                    i % 2 === 0 ? "bg-surface" : "bg-background"
                  )}
                >
                  <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-5 lg:gap-0">
                    <div
                      className={cn(
                        "relative mx-auto h-56 w-full max-w-xl sm:h-64 lg:col-span-2 lg:mx-6 lg:my-10 lg:h-[420px] lg:max-w-none lg:rounded-2xl",
                        imageFirst ? "lg:order-first" : "lg:order-last"
                      )}
                    >
                      <Image
                        src={f.image}
                        alt={`${f.eyebrow} - PlatoRest`}
                        fill
                        sizes="(min-width: 1024px) 40vw, (min-width: 640px) 100vw, 100vw"
                        className="object-cover lg:rounded-2xl"
                      />
                    </div>
                    <div className={cn("flex items-center px-6 py-10 sm:px-12 lg:col-span-3 lg:px-20", imageFirst ? "lg:order-last" : "lg:order-first")}>
                      <div className="max-w-xl">
                        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
                          <f.icon className="h-5 w-5" aria-hidden="true" />
                          {f.eyebrow}
                        </p>
                        <h3 className="mt-4 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                          {f.title}
                        </h3>
                        <p className="mt-5 text-lg leading-relaxed text-text-secondary">
                          {f.description}
                        </p>
                        <ul className="mt-8 space-y-5">
                          {f.items.map((item) => (
                            <li key={item.title} className="flex items-start gap-4">
                              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                ✓
                              </span>
                              <div>
                                <p className="font-semibold text-text-primary">
                                  {item.title}
                                </p>
                                <p className="mt-1 text-sm text-text-secondary">
                                  {item.description}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
        </div>
      </div>

      {process.env.NEXT_PUBLIC_SHOW_PRICING === "true" && (
        <section className="px-6 py-32">
          <div className="mx-auto max-w-6xl">
            <Card className="relative overflow-hidden rounded-3xl border-2 border-primary p-6 shadow-xl sm:p-10 md:p-16 lg:p-20">
              <CardContent className="grid grid-cols-1 items-center gap-12 p-0 lg:grid-cols-2">
                <div>
                  <h2 className="text-4xl font-bold text-primary underline decoration-primary/40 underline-offset-8 sm:text-5xl">
                    Plan Promocional
                  </h2>
                  <ul className="mt-8 space-y-4 text-lg md:text-xl">
                    <li className="flex items-start gap-3 text-text-primary">
                      <span className="mt-1 text-primary">✓</span>
                      <span>Soporte 24/7 feriados y fines de semana</span>
                    </li>
                    <li className="flex items-start gap-3 text-text-primary">
                      <span className="mt-1 text-primary">✓</span>
                      <span>Soporte Presencial CABA y GBA</span>
                    </li>
                    <li className="flex items-start gap-3 text-text-primary">
                      <span className="mt-1 text-primary">✓</span>
                      <span>Todas las funcionalidades actuales y futuras</span>
                    </li>
                  </ul>
                  <p className="mt-6 text-base text-text-secondary">
                    Salida de nuestra primer versión privada
                  </p>
                </div>

                <div className="text-center">
                  <p className="flex items-baseline justify-center gap-3">
                    <span className="text-4xl font-bold text-primary sm:text-5xl md:text-6xl">
                      $45.000<span className="text-xl font-medium text-text-secondary md:text-2xl">/mes</span>
                    </span>
                  </p>
                  <PromoCountdown className="mt-6" />
                  <Link
                    href="/register"
                    className={cn(buttonVariants({ size: "lg" }), "mt-8 h-auto w-full rounded-lg px-6 py-4 text-lg")}
                  >
                    PROBALO GRATIS
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <section id="contacto" className="bg-primary px-6 py-24 text-white scroll-mt-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Potencia tu restaurante hoy</h2>
            <p className="mt-4 max-w-md text-white/80">
              Déjanos tus datos y te llamaremos para darte una demo personalizada de 15 minutos.
            </p>
          </div>

          <Card className="rounded-2xl border-0 p-8 shadow-2xl">
            <CardContent className="p-0">
              <LeadForm />
            </CardContent>
          </Card>
        </div>
      </section>

      <FaqSection
        heading="Preguntas frecuentes sobre PlatoRest"
        faqs={HOME_FAQS}
      />
    </main>
  );
}
