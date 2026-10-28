"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { customerSignIn } from "@/lib/customer-session-client";
import { HiEye, HiEyeSlash, HiArrowLeft } from "react-icons/hi2";

export default function CustomerLoginPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = use(params);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await customerSignIn(email, password);
      if (res?.error) {
        setError("El email o la contrase\u00f1a no coinciden. Revisalos e intent\u00e1 otra vez. Si no la record\u00e1s, contact\u00e1 al local.");
        return;
      }
      router.push(`/menu/${restaurantSlug}`);
      router.refresh();
    } catch (err) {
      console.error("[customer login] failed", err);
      setError("No pudimos conectar para iniciar sesi\u00f3n. Revis\u00e1 tu conexi\u00f3n e intent\u00e1 otra vez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link
        href={`/menu/${restaurantSlug}`}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
      >
        <HiArrowLeft className="h-4 w-4" />
        Volver al menú
      </Link>

      <form onSubmit={handleSubmit}>
        <h1 className="text-2xl font-bold text-text-primary">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-text-secondary">Accedé a tu cuenta para seguir tus pedidos.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-text-primary">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-text-primary outline-none transition focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-text-primary">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-text-primary outline-none transition focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <HiEyeSlash className="h-5 w-5" /> : <HiEye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        <p className="mt-6 text-center text-sm text-text-secondary">
          ¿No tenés cuenta?{" "}
          <Link
            href={`/menu/${restaurantSlug}/account/register`}
            className="font-semibold text-primary hover:text-primary-hover"
          >
            Registrarse
          </Link>
        </p>
      </form>
    </main>
  );
}
