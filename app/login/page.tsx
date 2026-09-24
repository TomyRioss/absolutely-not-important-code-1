"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import posthog from "posthog-js";
import { HiCheckCircle, HiChatBubbleLeftRight, HiEye, HiEyeSlash } from "react-icons/hi2";
import { FcGoogle } from "react-icons/fc";

const BENEFITS = [
  "Crea tu menú digital en segundos",
  "Recibe pedidos directo por WhatsApp",
  "Gestioná mesas, inventario y ventas en un solo lugar",
  "Métricas y reportes en tiempo real",
  "Soporte 24/7 en español",
];

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    posthog.capture("user_logged_in_google");
    try {
      await signOut({ redirect: false });
      await signIn("google", { callbackUrl: searchParams.get("callbackUrl") ?? "/dashboard" });
    } catch (err) {
      console.error("[login] google signin failed", err);
      setError("No pudimos conectar con Google. Intentá de nuevo.");
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signOut({ redirect: false });
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        posthog.capture("login_failed", { method: "credentials" });
        setError("Email o contraseña incorrectos.");
        return;
      }
      posthog.capture("user_logged_in", { method: "credentials" });
      router.push(searchParams.get("callbackUrl") ?? "/dashboard");
      router.refresh();
    } catch (err) {
      console.error("login error:", err);
      setError("Error al iniciar sesión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      <div className="relative flex w-full items-center justify-center bg-background px-6 pb-12 pt-24 md:w-[60%] md:py-12">
        <Link
          href="/"
          className="absolute left-6 top-6 z-10 text-2xl font-bold text-primary md:left-8 md:top-8 md:text-3xl"
        >
          PlatoRest
        </Link>

        <div className="absolute right-6 top-6 z-10 flex items-center gap-3 md:right-8 md:top-8 md:gap-4">
          <a
            href="https://wa.me/5491171410652"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <HiChatBubbleLeftRight className="h-5 w-5 text-text-primary" />
            <span className="hidden text-sm font-semibold text-text-primary sm:inline">Soporte</span>
          </a>
          <span className="hidden h-6 w-px bg-border md:block" />
          <span className="hidden text-sm text-text-secondary md:inline">¿No tenés cuenta?</span>
          <Link
            href="/register"
            className="rounded-lg border-2 border-primary px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white md:px-4"
          >
            Registrarse
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-2xl">
          <h1 className="text-3xl font-bold leading-tight text-text-primary">
            Bienvenido de vuelta a PlatoRest
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            Ingresá a tu cuenta para gestionar tu restaurante.
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 font-semibold text-text-primary transition hover:bg-border/30 disabled:opacity-50"
          >
            <FcGoogle className="h-5 w-5" />
            {googleLoading ? "Conectando..." : "Continuar con Google"}
          </button>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-text-secondary">o con tu email</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-text-primary"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@restaurante.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-text-primary outline-none transition focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-text-primary"
              >
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
            <p className="mt-4 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          <p className="mt-6 text-center text-sm text-text-secondary">
            <Link
              href="/recuperar-password"
              className="font-semibold text-primary hover:text-primary-hover"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </form>
      </div>

      <div className="relative hidden md:block md:w-[40%]">
        <Image
          src="https://images.pexels.com/photos/2696064/pexels-photo-2696064.jpeg?auto=compress&cs=tinysrgb&w=1200"
          alt="Chef preparando plato"
          fill
          unoptimized
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 via-primary/50 to-primary/20" />
        <ul className="relative flex h-full flex-col justify-center gap-5 p-10 text-white">
          {BENEFITS.map((benefit) => (
            <li
              key={benefit}
              className="flex items-center gap-3 text-lg font-semibold"
            >
              <HiCheckCircle className="h-6 w-6 flex-shrink-0 text-green-400" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
import Image from "next/image";
