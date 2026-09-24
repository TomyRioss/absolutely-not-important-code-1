import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad | PlatoRest",
  description: "Política de privacidad de PlatoRest.",
};

const sections = [
  ["1. Información que recopilamos", "Podemos recopilar datos de cuenta, contacto, restaurante, pedidos y uso de la plataforma que ingresás o generás al utilizar PlatoRest."],
  ["2. Para qué usamos los datos", "Usamos la información para prestar el servicio, autenticar usuarios, procesar pedidos, brindar soporte, mejorar la plataforma y enviar comunicaciones relacionadas con tu cuenta."],
  ["3. Compartición", "No vendemos datos personales. Podemos compartir información con proveedores que nos ayudan a operar PlatoRest, únicamente cuando es necesario para prestar el servicio y bajo obligaciones de confidencialidad."],
  ["4. Conservación y seguridad", "Conservamos los datos durante el tiempo necesario para cumplir las finalidades informadas y aplicamos medidas razonables para protegerlos contra acceso, pérdida o uso no autorizado."],
  ["5. Tus derechos", "Podés solicitar acceso, actualización o eliminación de tus datos personales, sujeto a las obligaciones legales aplicables. Para hacerlo, contactanos por los canales de soporte disponibles."],
  ["6. Cookies y métricas", "Podemos utilizar cookies y herramientas de medición para mantener sesiones, entender el uso del producto y mejorar la experiencia."],
  ["7. Cambios", "Podemos actualizar esta política cuando cambien el servicio o las obligaciones aplicables. Publicaremos la versión vigente en esta página."],
] as const;

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-surface px-6 py-16 md:py-24">
      <article className="mx-auto max-w-3xl rounded-2xl border border-border bg-background p-6 shadow-sm md:p-10">
        <Link href="/" className="text-sm font-semibold text-primary hover:underline">
          PlatoRest
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-text-primary md:text-4xl">Política de privacidad</h1>
        <p className="mt-3 text-sm text-text-secondary">Última actualización: 24/09/2026</p>
        <div className="mt-10 space-y-8 text-sm leading-7 text-text-secondary">
          {sections.map(([title, text]) => (
            <section key={title}>
              <h2 className="text-base font-semibold text-text-primary">{title}</h2>
              <p className="mt-2">{text}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-border pt-6 text-sm text-text-secondary">
          Para conocer las reglas de uso del servicio, consultá los <Link href="/terminos" className="font-medium text-primary hover:underline">términos y condiciones</Link>.
        </p>
      </article>
    </main>
  );
}
