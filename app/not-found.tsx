import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#fff7ed] px-6 py-16">
      <div className="absolute inset-y-0 left-0 hidden w-1/3 bg-primary md:block" />
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary-light" />
      <div className="absolute -bottom-40 -left-24 h-80 w-80 rounded-full border-[40px] border-primary/15" />

      <Link
        href="/"
        className="absolute left-6 top-6 text-2xl font-bold tracking-tight text-primary md:left-10 md:top-8"
      >
        PlatoRest
      </Link>

      <section className="relative z-10 w-full max-w-2xl text-center md:text-left">
        <p className="text-[clamp(7rem,22vw,15rem)] font-black leading-[0.8] tracking-[-0.08em] text-primary/15">
          404
        </p>
        <div className="mt-8 max-w-lg md:ml-[18%]">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Página no encontrada</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-text-primary md:text-6xl">
            Este plato no está en el menú.
          </h1>
          <p className="mt-5 text-base leading-7 text-text-secondary">
            El enlace que buscás no existe o fue movido. Volvé al inicio y seguí explorando PlatoRest.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
