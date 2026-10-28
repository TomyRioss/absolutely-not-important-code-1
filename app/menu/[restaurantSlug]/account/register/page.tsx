"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { customerSignIn } from "@/lib/customer-session-client";
import { HiEye, HiEyeSlash, HiArrowLeft } from "react-icons/hi2";

type RegisterError = { message: string; canSignIn: boolean };

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
  const [error, setError] = useState<RegisterError | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError({ message: "La contraseña debe tener al menos 6 caracteres.", canSignIn: false });
      return;
    }
    setLoading(true);
    let accountCreated = false;
    try {
      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password, restaurantSlug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError({
          message: data?.error ?? "No pudimos crear la cuenta. Revisá los datos e intentá otra vez.",
          canSignIn: data?.code !== "ACCOUNT_WITHOUT_PASSWORD" && (res.status === 401 || res.status === 409),
        });
        return;
      }

      accountCreated = true;
      const signInRes = await customerSignIn(email, password);
      if (signInRes?.error) {
        setError({
          message: "La cuenta ya se creó, pero no pudimos iniciar sesión. Entrá con el email y la contraseña que acabás de registrar.",
          canSignIn: true,
        });
        return;
      }

      router.push(`/menu/${restaurantSlug}`);
      router.refresh();
    } catch (err) {
      console.error("[customer register] failed", err);
      setError({
        message: accountCreated
          ? "La cuenta ya se creó, pero no pudimos iniciar sesión. Entrá con el email y la contraseña que acabás de registrar."
          : "No pudimos confirmar el registro. Probá iniciar sesión con estos datos antes de volver a crear la cuenta.",
        canSignIn: true,
      });
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
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5" role="alert" aria-live="assertive">
            <p className="text-sm font-medium text-danger">{error.message}</p>
            {error.canSignIn && (
              <Link
                href={`/menu/${restaurantSlug}/account/login`}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-danger underline underline-offset-2"
              >
                Ir a iniciar sesión
              </Link>
            )}
          </div>
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
