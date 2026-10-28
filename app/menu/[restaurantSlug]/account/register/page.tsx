"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { customerSignIn } from "@/lib/customer-session-client";
import { HiEye, HiEyeSlash, HiArrowLeft } from "react-icons/hi2";

export default function CustomerRegisterPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password, restaurantSlug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo crear la cuenta.");
      }

      const signInRes = await customerSignIn(email, password);
      if (signInRes?.error) throw new Error("No pudimos iniciar sesión. Probá ingresar manualmente.");

      router.push(`/menu/${restaurantSlug}`);
      router.refresh();
    } catch (err) {
      console.error("[customer register] failed", err);
      setError(err instanceof Error ? err.message : "No pudimos crear tu cuenta. Intentá de nuevo.");
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
        <h1 className="text-2xl font-bold text-text-primary">Crear cuenta</h1>
        <p className="mt-1 text-sm text-text-secondary">Guardá tus datos para pedir más rápido.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-text-primary">
              Nombre completo
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Pérez"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-text-primary outline-none transition focus:border-primary"
            />
          </div>

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
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-text-primary">
              Teléfono
            </label>
            <input
              id="phone"
              type="tel"
              required
              inputMode="numeric"
              pattern="[0-9]{10,15}"
              title="Código de país + área + número, sin espacios ni signos (ej: 5491134083140)"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="5491122334455"
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
                placeholder="Mínimo 6 caracteres"
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
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <p className="mt-6 text-center text-sm text-text-secondary">
          ¿Ya tenés cuenta?{" "}
          <Link
            href={`/menu/${restaurantSlug}/account/login`}
            className="font-semibold text-primary hover:text-primary-hover"
          >
            Iniciar sesión
          </Link>
        </p>
      </form>
    </main>
  );
}
