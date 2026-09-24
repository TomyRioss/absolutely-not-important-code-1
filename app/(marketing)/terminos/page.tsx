import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Términos y condiciones | PlatoRest",
  description: "Términos y condiciones de uso de PlatoRest.",
};

const sections = [
  ["1. Aceptación", "Al crear una cuenta o utilizar PlatoRest, aceptás estos términos. Si no estás de acuerdo, no utilices el servicio."],
  ["2. Servicio", "PlatoRest ofrece herramientas para gestionar restaurantes, menús digitales, pedidos, clientes y operaciones relacionadas."],
  ["3. Cuenta", "Debés proporcionar información verdadera y mantener seguras tus credenciales. Sos responsable de la actividad realizada desde tu cuenta."],
  ["4. Uso permitido", "No podés usar PlatoRest para actividades ilegales, fraudulentas, abusivas o que afecten la seguridad y disponibilidad de la plataforma."],
  ["5. Planes y pagos", "Los períodos de prueba, planes, precios y condiciones de pago se informan al momento de contratar. Cualquier cambio se comunicará con anticipación razonable."],
  ["6. Contenido", "Conservás tus derechos sobre la información que cargás. Nos autorizás a procesarla únicamente para prestar y mejorar el servicio."],
  ["7. Disponibilidad", "Trabajamos para mantener PlatoRest disponible, pero pueden existir interrupciones por mantenimiento, proveedores o causas fuera de nuestro control."],
  ["8. Cambios y contacto", "Podemos actualizar estos términos. Si tenés consultas, escribinos por los canales de soporte disponibles en PlatoRest."],
] as const;

export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-surface px-6 py-16 md:py-24">
      <article className="mx-auto max-w-3xl rounded-2xl border border-border bg-background p-6 shadow-sm md:p-10">
        <Link href="/" className="text-sm font-semibold text-primary hover:underline">
          PlatoRest
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-text-primary md:text-4xl">Términos y condiciones</h1>
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
          También podés consultar nuestra <Link href="/privacidad" className="font-medium text-primary hover:underline">política de privacidad</Link>.
        </p>
      </article>
    </main>
  );
}
