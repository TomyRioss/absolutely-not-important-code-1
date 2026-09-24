"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiCheckCircle, HiChatBubbleLeftRight, HiEye, HiEyeSlash, HiExclamationTriangle } from "react-icons/hi2";
import { FcGoogle } from "react-icons/fc";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { signIn, signOut } from "next-auth/react";
import posthog from "posthog-js";

const BENEFITS = [
  "Crea tu menú digital en segundos",
  "Recibe pedidos directo por WhatsApp",
  "Gestioná mesas, inventario y ventas en un solo lugar",
  "Métricas y reportes en tiempo real",
  "Soporte 24/7 en español",
];

const WHERE_HEARD = [
  "Referido",
  "Anuncios Facebook",
  "Búsqueda web",
  "Recomendación",
];

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [whereHeard, setWhereHeard] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!acceptTerms) {
      setError("Debés aceptar los términos y condiciones.");
      return;
    }
    setLoading(true);
    try {
      await signOut({ redirect: false });
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName, email, password, restaurantName, phone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo crear la cuenta.");
      }

      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName, email, restaurantName, phone, notes: whereHeard }),
      }).catch((err) => console.error("[register] lead save failed", err));

      const signInRes = await signIn("credentials", { email, password, redirect: false });
      if (signInRes?.error) throw new Error("No pudimos iniciar sesión. Probá ingresar manualmente.");

      posthog.capture("user_signed_up", { method: "credentials", where_heard: whereHeard });
      // ya tenemos nombre/telefono, wizard solo pide dirección
      router.push("/onboarding?skip=contact");
      router.refresh();
    } catch (err) {
      console.error("[register] signup failed", err);
      setError(err instanceof Error ? err.message : "No pudimos crear tu cuenta. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError(null);
    if (!acceptTerms) {
      setError("Debés aceptar los términos y condiciones.");
      return;
    }
    setGoogleLoading(true);
    posthog.capture("user_signed_up_google");
    try {
      await signOut({ redirect: false });
      // Google no da telefono/direccion/nombre restaurante, wizard completo los pide
      await signIn("google", { callbackUrl: "/onboarding" });
    } catch (err) {
      console.error("[register] google signup failed", err);
      setError("No pudimos conectar con Google. Intentá de nuevo.");
      setGoogleLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      <div className="relative flex w-full items-center justify-center bg-background px-6 pb-12 pt-24 md:w-[60%] md:py-12">
        <Link href="/" className="absolute left-6 top-6 z-10 text-2xl font-bold text-primary md:left-8 md:top-8 md:text-3xl">
          PlatoRest
        </Link>

        <a
          href="https://wa.me/5491171410652"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-6 top-6 z-10 flex items-center gap-3 md:right-8 md:top-8"
        >
          <span className="h-6 w-px bg-border" />
          <HiChatBubbleLeftRight className="h-5 w-5 text-text-primary" />
          <span className="text-sm font-semibold text-text-primary">Soporte</span>
        </a>

        <form onSubmit={handleSubmit} className="w-full max-w-lg">
          <h1 className="text-2xl font-bold leading-tight text-text-primary md:text-3xl">
            Registrate en PlatoRest y empezá a recibir pedidos en minutos
          </h1>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 md:hidden">
            {BENEFITS.slice(0, 3).map((benefit) => (
              <li key={benefit} className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <HiCheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleGoogleSignup}
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

          <div className="space-y-2.5">
            <div>
              <label htmlFor="restaurantName" className="mb-1 block text-sm font-medium text-text-primary">
                Nombre del restaurante
              </label>
              <input
                id="restaurantName"
                type="text"
                required
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="La Parrilla de Juan"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-text-primary outline-none transition focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-text-primary">
                Nombre completo
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-text-primary outline-none transition focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-text-primary">
                Número de WhatsApp
              </label>
              <PhoneInput
                defaultCountry="ar"
                value={phone}
                onChange={setPhone}
                inputClassName="!h-11 !w-full !rounded-r-lg !border-border !bg-background !text-text-primary"
                countrySelectorStyleProps={{
                  buttonClassName: "!h-11 !rounded-l-lg !border-border !bg-background !px-3",
                }}
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
                placeholder="juan@restaurante.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-text-primary outline-none transition focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="whereHeard" className="mb-1 block text-sm font-medium text-text-primary">
                ¿Dónde nos conociste?
              </label>
              <select
                id="whereHeard"
                required
                value={whereHeard}
                onChange={(e) => setWhereHeard(e.target.value)}
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-3 pr-8 text-text-primary outline-none transition focus:border-primary"
              >
                <option value="">Seleccioná una opción</option>
                {WHERE_HEARD.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-text-primary">
                  Contraseña nueva
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6"
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
              <div>
                <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-text-primary">
                  Confirmar
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmar contraseña"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-text-primary outline-none transition focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                    aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showConfirmPassword ? <HiEyeSlash className="h-5 w-5" /> : <HiEye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger"
            >
              <HiExclamationTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>

          <label className="mt-4 flex items-start gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <span>
              Acepto los{" "}
              <Link href="/terminos" className="font-semibold text-primary hover:underline">
                términos y condiciones
              </Link>{" "}
              y la{" "}
              <Link href="/privacidad" className="font-semibold text-primary hover:underline">
                política de privacidad
              </Link>{" "}
              de PlatoRest.
            </span>
          </label>

          <p className="mt-6 text-center text-sm text-text-secondary">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
              Iniciar sesión
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
            <li key={benefit} className="flex items-center gap-3 text-lg font-semibold">
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
