"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { customerSignIn, customerSignOut } from "@/lib/customer-session-client";
import { HiUserCircle, HiShare, HiGift, HiEye, HiEyeSlash, HiArrowLeft } from "react-icons/hi2";
import { FaWhatsapp } from "react-icons/fa6";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type RegisterError = { message: string; canSignIn: boolean; email?: string };

function getInitials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function MenuNavbar({
  restaurantSlug,
  restaurantName,
  customerName,
  whatsappNumber,
}: {
  restaurantSlug: string;
  restaurantName: string;
  customerName: string | null;
  whatsappNumber: string | null;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<"default" | "register">("default");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regError, setRegError] = useState<RegisterError | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await customerSignIn(email, password);
      if (res?.error) {
        setLoginError("El email o la contrase\u00f1a no coinciden. Revisalos e intent\u00e1 otra vez. Si no la record\u00e1s, contact\u00e1 al local.");
        return;
      }
      setAuthModalOpen(false);
      router.refresh();
    } catch (err) {
      console.error("[menu navbar] login failed", err);
      setLoginError("Error al iniciar sesión. Intentá de nuevo.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);
    if (regPassword.length < 6) {
      setRegError({ message: "La contraseña debe tener al menos 6 caracteres.", canSignIn: false });
      return;
    }
    setRegLoading(true);
    let accountCreated = false;
    try {
      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          phone: regPhone,
          password: regPassword,
          restaurantSlug,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setRegError({
          message: data?.error ?? "No pudimos crear la cuenta. Revisá los datos e intentá otra vez.",
          canSignIn: data?.code !== "ACCOUNT_WITHOUT_PASSWORD" && (res.status === 401 || res.status === 409),
          email: res.status === 401 || data?.code === "ALREADY_CUSTOMER" ? regEmail : undefined,
        });
        return;
      }

      accountCreated = true;
      const signInRes = await customerSignIn(regEmail, regPassword);
      if (signInRes?.error) {
        setRegError({
          message: "La cuenta ya se creó, pero no pudimos iniciar sesión. Entrá con el email y la contraseña que acabás de registrar.",
          canSignIn: true,
          email: regEmail,
        });
        return;
      }

      setAuthModalOpen(false);
      router.refresh();
    } catch (err) {
      console.error("[menu navbar] register failed", err);
      setRegError({
        message: accountCreated
          ? "La cuenta ya se creó, pero no pudimos iniciar sesión. Entrá con el email y la contraseña que acabás de registrar."
          : "No pudimos confirmar el registro. Probá iniciar sesión con estos datos antes de volver a crear la cuenta.",
        canSignIn: true,
        email: regEmail,
      });
    } finally {
      setRegLoading(false);
    }
  }
  function closeAuthModal(open: boolean) {
    setAuthModalOpen(open);
    if (!open) {
      setAuthView("default");
      setRegError(null);
      setLoginError(null);
    }
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      await navigator.share({ title: restaurantName, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => {});
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-background px-4 py-2.5">
      <Dialog open={authModalOpen} onOpenChange={closeAuthModal}>
        <DialogContent>
          {authView === "default" ? (
            <>
              <DialogHeader>
                <DialogTitle>¡Sumate a la fidelización!</DialogTitle>
                <DialogDescription>Registrate o iniciá sesión para acumular puntos y canjear recompensas.</DialogDescription>
              </DialogHeader>
              <button
                type="button"
                onClick={() => setAuthView("register")}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                Registrarme
              </button>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-text-secondary">o iniciá sesión</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-2.5">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-primary"
                />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm text-text-primary outline-none transition focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <HiEyeSlash className="h-4 w-4" /> : <HiEye className="h-4 w-4" />}
                  </button>
                </div>

                {loginError && (
                  <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger" role="alert" aria-live="assertive">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full rounded-lg border border-border px-4 py-2.5 text-center text-sm font-semibold text-text-primary transition hover:bg-surface disabled:opacity-50"
                >
                  {loginLoading ? "Ingresando..." : "Iniciar sesión"}
                </button>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <button
                  type="button"
                  onClick={() => setAuthView("default")}
                  className="mb-1 flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
                >
                  <HiArrowLeft className="h-4 w-4" />
                  Volver
                </button>
                <DialogTitle>Crear cuenta</DialogTitle>
                <DialogDescription>Guardá tus datos para pedir más rápido y sumar puntos.</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleRegister} className="flex flex-col gap-2.5">
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-primary"
                />
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-primary"
                />
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10,15}"
                  title="Código de país + área + número, sin espacios ni signos (ej: 5491134083140)"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="5491122334455"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-primary"
                />
                <div className="relative">
                  <input
                    type={regShowPassword ? "text" : "password"}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm text-text-primary outline-none transition focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setRegShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                    aria-label={regShowPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {regShowPassword ? <HiEyeSlash className="h-4 w-4" /> : <HiEye className="h-4 w-4" />}
                  </button>
                </div>

                {regError && (
                  <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5" role="alert" aria-live="assertive">
                    <p className="text-sm font-medium text-danger">{regError.message}</p>
                    {regError.canSignIn && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(regError.email ?? "");
                          setLoginError(
                            regError.email
                              ? "Ingresá la contraseña de esta cuenta."
                              : "Ingresá con el email y la contraseña de la cuenta que ya existe.",
                          );
                          setAuthView("default");
                          setRegError(null);
                        }}
                        className="mt-2 min-h-11 text-left text-sm font-semibold text-danger underline underline-offset-2"
                      >
                        Ir a iniciar sesión
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
                >
                  {regLoading ? "Creando cuenta..." : "Crear cuenta"}
                </button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
      <div className="flex items-center gap-2">
      {whatsappNumber && (
        <a
          href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface"
        >
          <FaWhatsapp className="h-5 w-5" />
        </a>
      )}
      <button
        type="button"
        onClick={handleShare}
        aria-label="Compartir"
        className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface"
      >
        <HiShare className="h-5 w-5" />
      </button>

      <div ref={ref} className="relative flex items-center gap-2">
        {customerName && (
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-surface"
            aria-label="Cuenta"
          >
            <HiUserCircle className="h-6 w-6" />
          </button>
        )}

        {menuOpen && customerName && (
          <div className="absolute left-0 top-10 w-48 rounded-xl border border-border bg-background p-1.5 shadow-lg">
            <p className="truncate px-2.5 py-1.5 text-sm font-semibold text-text-primary">
              {customerName}
            </p>
            <Link
              href={`/menu/${restaurantSlug}/account`}
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-2.5 py-1.5 text-sm text-text-primary hover:bg-surface"
            >
              Mi cuenta
            </Link>
            <Link
              href={`/menu/${restaurantSlug}/tienda-puntos`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-text-primary hover:bg-surface"
            >
              <HiGift className="h-4 w-4" />
              Tienda de puntos
            </Link>
            <button
              type="button"
              onClick={() => customerSignOut(`/menu/${restaurantSlug}`)}
              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-danger hover:bg-surface"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
      </div>

      {customerName ? (
        <Link
          href={`/menu/${restaurantSlug}/tienda-puntos`}
          className="flex min-w-0 items-center gap-1.5 truncate rounded-full bg-primary/10 py-1 pl-1 pr-2.5 text-xs font-semibold text-primary"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
            {getInitials(customerName)}
          </span>
          Tienda de puntos
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="flex min-w-0 items-center gap-1 truncate rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
        >
          <HiGift className="h-3.5 w-3.5 shrink-0" />
          ¡Gana puntos y recompensas!
        </button>
      )}
    </div>
  );
}
