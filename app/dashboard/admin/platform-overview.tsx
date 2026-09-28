"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  RefreshCw,
  Search,
  Store,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { PlatformSnapshot } from "@/lib/platform-admin";

const arsNumber = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const usdNumber = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = (value: string | Date) => new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const orderStatus: Record<string, string> = { PENDING: "Pendiente", CONFIRMED: "Confirmado", PREPARING: "En preparación", READY: "Listo", COMPLETED: "Completado", CANCELLED: "Cancelado" };

type ExchangeRate = { value: number; updatedAt: string };

function MoneyValue({ amount, rate, compact = false }: { amount: number; rate: ExchangeRate | null; compact?: boolean }) {
  const ars = Number.isFinite(amount) ? arsNumber.format(amount) : "—";
  const usd = Number.isFinite(amount) && rate ? usdNumber.format(amount / rate.value) : null;

  return (
    <span className={`inline-flex ${compact ? "flex-wrap items-baseline gap-x-2" : "flex-col items-end leading-tight"}`}>
      {usd ? <span className="inline-flex items-center gap-1.5 font-semibold text-text-primary"><span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-text-secondary">USD</span><span>{usd}</span></span> : <span className="inline-flex items-center gap-1.5 font-semibold text-text-primary"><span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-text-secondary">ARS</span><span>{ars}</span></span>}
      {usd && <span className={`inline-flex items-center gap-1.5 font-medium text-text-secondary ${compact ? "text-xs" : "mt-1 text-sm"}`}><span className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs font-semibold">ARS</span><span>{ars}</span></span>}
    </span>
  );
}

const sections = [
  { name: "Resumen", icon: LayoutDashboard, title: "Resumen de plataforma", description: "Una vista clara de la actividad y el estado de PlatoRest." },
  { name: "Cuentas", icon: Users, title: "Cuentas de usuario", description: "Encontrá una cuenta y consultá sus negocios." },
  { name: "Negocios y menús", icon: Building2, title: "Negocios y restaurantes", description: "Revisá los planes, restaurantes y menús registrados." },
  { name: "Pedidos", icon: ClipboardList, title: "Pedidos recientes", description: "Consultá la actividad reciente de los restaurantes." },
] as const;

export function PlatformOverview({ initialSnapshot }: { initialSnapshot: PlatformSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [streamStatus, setStreamStatus] = useState<"connecting" | "live" | "reconnecting" | "stale">("connecting");
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [rateStatus, setRateStatus] = useState<"loading" | "current" | "stale" | "unavailable">("loading");
  const [section, setSection] = useState<(typeof sections)[number]["name"]>("Resumen");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const stream = new EventSource("/api/platform-admin/stream");
    let receivedSnapshot = false;
    stream.addEventListener("error", () => setStreamStatus(receivedSnapshot ? "stale" : "reconnecting"));
    stream.addEventListener("status", () => setStreamStatus("stale"));
    stream.addEventListener("snapshot", (event) => {
      try {
        const nextSnapshot = JSON.parse((event as MessageEvent<string>).data) as PlatformSnapshot;
        if (!nextSnapshot.generatedAt || !nextSnapshot.metrics || !Array.isArray(nextSnapshot.users) || !Array.isArray(nextSnapshot.businesses) || !Array.isArray(nextSnapshot.orders)) throw new Error("Invalid platform snapshot");
        setSnapshot(nextSnapshot);
        receivedSnapshot = true;
        setStreamStatus("live");
      } catch {
        setStreamStatus("stale");
      }
    });
    return () => stream.close();
  }, []);

  useEffect(() => {
    let active = true;
    let hasValidRate = false;
    let controller: AbortController | null = null;
    let timeout: number | undefined;
    const updateExchangeRate = async () => {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      timeout = window.setTimeout(() => requestController.abort(), 10_000);
      try {
        const response = await fetch("https://dolarapi.com/v1/dolares/oficial", { cache: "no-store", signal: requestController.signal });
        if (!response.ok) throw new Error("No se pudo consultar la cotización");
        const data = await response.json() as { venta?: number; fechaActualizacion?: string };
        if (typeof data.venta !== "number" || !Number.isFinite(data.venta) || data.venta <= 0) throw new Error("Cotización inválida");
        const updatedAt = data.fechaActualizacion && Number.isFinite(Date.parse(data.fechaActualizacion)) ? data.fechaActualizacion : new Date().toISOString();
        if (active) {
          hasValidRate = true;
          setExchangeRate({ value: data.venta, updatedAt });
          setRateStatus("current");
        }
      } catch {
        if (active) setRateStatus(hasValidRate ? "stale" : "unavailable");
      } finally {
        if (timeout !== undefined) window.clearTimeout(timeout);
      }
    };
    void updateExchangeRate();
    const timer = window.setInterval(() => { void updateExchangeRate(); }, 15 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); controller?.abort(); if (timeout !== undefined) window.clearTimeout(timeout); };
  }, []);

  const businesses = useMemo(() => snapshot.businesses.filter((business) => `${business.name} ${business.owner.name} ${business.owner.email}`.toLowerCase().includes(query.toLowerCase())), [snapshot.businesses, query]);
  const users = useMemo(() => snapshot.users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())), [snapshot.users, query]);
  const activeSection = sections.find((item) => item.name === section) ?? sections[0];
  const streamStatusLabel = streamStatus === "live" ? "En vivo" : streamStatus === "stale" ? "Datos desactualizados" : streamStatus === "connecting" ? "Conectando" : "Reconectando";
  const streamStatusTone = streamStatus === "live" ? "bg-success" : streamStatus === "stale" ? "bg-danger" : "bg-text-secondary";

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="grid gap-5 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Secciones de plataforma" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-background p-2 lg:sticky lg:top-0 lg:flex-col lg:self-start">
          <p className="hidden px-3 pb-2 pt-1 text-sm font-medium text-text-primary lg:block">Secciones</p>
          {sections.map(({ name, icon: Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => { setSection(name); setQuery(""); }}
              aria-current={section === name ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${section === name ? "bg-muted text-text-primary" : "text-text-secondary hover:bg-muted/70 hover:text-text-primary"}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${section === name ? "text-primary" : ""}`} aria-hidden="true" />
              {name}
              {section === name && <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-primary lg:block" aria-hidden="true" />}
            </button>
          ))}
          <p className="mt-3 hidden border-t border-border px-3 pt-3 text-xs leading-relaxed text-text-secondary lg:block">Datos de toda la plataforma, actualizados en vivo.</p>
        </nav>

        <div className="min-w-0 space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{activeSection.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{activeSection.description}</p>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-secondary" role="status" aria-live="polite">
              <span className={`h-2 w-2 shrink-0 rounded-full ${streamStatusTone}`} />
              <span className="font-medium text-text-primary">{streamStatusLabel}</span>
              <span aria-hidden="true">·</span>
              <span>Datos al {dateTime(snapshot.generatedAt)}</span>
              {streamStatus === "stale" && <span className="w-full text-danger">No se pudo actualizar. Conservamos los últimos datos recibidos.</span>}
            </div>
          </header>

          <div className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg border border-border bg-background px-4 py-3 text-sm" role="status" aria-live="polite">
            <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium text-text-primary">ARS es la moneda original · USD es una referencia</p>
              {exchangeRate ? <p className="mt-1 text-xs leading-relaxed text-text-secondary">1 USD = ARS {arsNumber.format(exchangeRate.value)} · Dólar oficial vendedor · cotización al {dateTime(exchangeRate.updatedAt)}{rateStatus === "stale" ? " · no se pudo actualizar; usando última cotización disponible" : ""}</p> : <p className="mt-1 text-xs leading-relaxed text-text-secondary">{rateStatus === "loading" ? "Consultando dólar oficial vendedor…" : "Cotización no disponible; los importes se muestran en ARS."}</p>}
            </div>
          </div>

          {section === "Resumen" && <Overview snapshot={snapshot} exchangeRate={exchangeRate} />}

          {section === "Cuentas" && <section className="rounded-xl border border-border bg-background p-4 md:p-5">
            <SectionHeading icon={Users} title="Cuentas registradas" detail={`${snapshot.metrics.users.toLocaleString("es-AR")} en total`} />
            <SearchField value={query} onChange={setQuery} placeholder="Buscar por nombre o email" />
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-surface text-xs text-text-secondary"><tr><th className="px-4 py-3 font-medium">Nombre</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Negocios</th><th className="px-4 py-3 font-medium">Fecha de alta</th><th className="px-4 py-3 font-medium">Último ingreso</th></tr></thead>
                <tbody className="divide-y divide-border">{users.map((user) => <tr key={user.id} className="transition-colors hover:bg-muted/50"><td className="px-4 py-3 font-medium">{user.name}{user.platformRole === "ADMIN" && <span className="ml-2 inline-flex rounded-full bg-primary-light px-2 py-1 text-xs font-medium text-text-primary">Admin de plataforma</span>}</td><td className="px-4 py-3 text-text-secondary">{user.email}{user.phone && <span className="block text-xs">{user.phone}</span>}</td><td className="px-4 py-3">{user.businesses.length ? user.businesses.join(", ") : <span className="text-text-secondary">Sin negocio</span>}</td><td className="px-4 py-3 text-text-secondary">{dateTime(user.createdAt)}</td><td className="px-4 py-3 text-text-secondary">{user.lastLoginAt ? dateTime(user.lastLoginAt) : "Nunca"}</td></tr>)}</tbody>
              </table>
              {!users.length && <EmptyState message="No encontramos cuentas con esos datos." />}
            </div>
          </section>}

          {section === "Negocios y menús" && <section className="rounded-xl border border-border bg-background p-4 md:p-5">
            <SectionHeading icon={Building2} title="Negocios y restaurantes" detail={`${snapshot.metrics.businesses.toLocaleString("es-AR")} negocios`} />
            <SearchField value={query} onChange={setQuery} placeholder="Buscar por negocio, responsable o email" />
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-surface text-xs text-text-secondary"><tr><th className="px-4 py-3 font-medium">Negocio</th><th className="px-4 py-3 font-medium">Responsable</th><th className="px-4 py-3 font-medium">Plan</th><th className="px-4 py-3 font-medium">Restaurantes y menús</th><th className="px-4 py-3 font-medium">Pedidos</th></tr></thead>
                <tbody className="divide-y divide-border">{businesses.map((business) => <tr key={business.id} className="align-top transition-colors hover:bg-muted/50"><td className="px-4 py-4"><span className="font-medium">{business.name}</span><span className="mt-1 block text-xs text-text-secondary">/{business.slug}</span><span className="mt-1 block text-xs text-text-secondary">Alta {dateTime(business.createdAt)}</span></td><td className="px-4 py-4">{business.owner.name}<span className="mt-1 block text-xs text-text-secondary">{business.owner.email}</span></td><td className="px-4 py-4"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize">{business.plan}</span>{business.trialEndsAt && <span className="mt-2 block text-xs text-text-secondary">Prueba hasta {dateTime(business.trialEndsAt)}</span>}</td><td className="max-w-sm px-4 py-4">{business.restaurants.length ? business.restaurants.map((restaurant) => <div key={restaurant.id} className="border-b border-border py-2 last:border-0 first:pt-0 last:pb-0"><a className="font-medium underline decoration-border underline-offset-2 hover:text-primary" href={`/menu/${restaurant.slug}`} target="_blank" rel="noreferrer">{restaurant.name}</a><span className="ml-2 text-xs text-text-secondary">{restaurant._count.orders} pedidos</span><details className="mt-1 text-xs"><summary className="w-fit cursor-pointer text-text-secondary hover:text-text-primary">Ver menú ({restaurant.products.length} productos)</summary><ul className="mt-2 max-h-56 space-y-2 overflow-y-auto border-l border-border pl-3">{restaurant.products.map((product) => <li key={product.id}><span className={product.active ? "font-medium" : "text-text-secondary line-through"}>{product.name}</span>{product.category && <span className="ml-1 text-text-secondary">· {product.category.name}</span>}{product.description && <span className="block text-text-secondary">{product.description}</span>}<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-text-secondary">{product.variants.map((variant) => <span key={variant.name}>{variant.name}: <MoneyValue amount={Number(variant.price)} rate={exchangeRate} compact /></span>)}</div></li>)}</ul></details></div>) : <span className="text-text-secondary">Sin restaurantes</span>}</td><td className="px-4 py-4 tabular-nums">{business.restaurants.reduce((total, restaurant) => total + restaurant._count.orders, 0).toLocaleString("es-AR")}</td></tr>)}</tbody>
              </table>
              {!businesses.length && <EmptyState message="No encontramos negocios con esos datos." />}
            </div>
          </section>}

          {section === "Pedidos" && <section className="rounded-xl border border-border bg-background p-4 md:p-5">
            <SectionHeading icon={Clock3} title="Pedidos recientes" detail={`${snapshot.orders.length} más recientes`} />
            <div className="mt-4 divide-y divide-border">{snapshot.orders.map((order) => <OrderRow key={order.id} order={order} exchangeRate={exchangeRate} />)}</div>
            {!snapshot.orders.length && <EmptyState message="Todavía no hay pedidos registrados." />}
          </section>}
        </div>
      </div>
    </div>
  );
}

function Overview({ snapshot, exchangeRate }: { snapshot: PlatformSnapshot; exchangeRate: ExchangeRate | null }) {
  return (
    <>
      <section aria-label="Indicadores de plataforma" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric icon={Users} label="Cuentas" value={snapshot.metrics.users.toLocaleString("es-AR")} />
        <Metric icon={Building2} label="Negocios" value={snapshot.metrics.businesses.toLocaleString("es-AR")} />
        <Metric icon={Store} label="Restaurantes" value={snapshot.metrics.restaurants.toLocaleString("es-AR")} />
        <Metric icon={CircleDollarSign} label="Ingreso mensual estimado (MRR)" value={<MoneyValue amount={snapshot.metrics.monthlyRecurringRevenue} rate={exchangeRate} />} detail={`${snapshot.metrics.activePlans} planes Pro`} />
        <Metric icon={ArrowUpRight} label="Ingreso anual estimado (ARR)" value={<MoneyValue amount={snapshot.metrics.annualRecurringRevenue} rate={exchangeRate} />} />
        <Metric icon={ArrowDownRight} label="Bajas" value="Sin datos" detail="Todavía no se registran bajas" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <div className="min-w-0 rounded-xl border border-border bg-background p-4 md:p-5">
          <SectionHeading icon={Activity} title="Actividad de pedidos" detail={`${snapshot.metrics.orders.toLocaleString("es-AR")} pedidos en total`} />
          <div className="mt-3 divide-y divide-border">{snapshot.orders.slice(0, 8).map((order) => <OrderRow key={order.id} order={order} exchangeRate={exchangeRate} />)}</div>
          {!snapshot.orders.length && <EmptyState message="Todavía no hay pedidos registrados." />}
        </div>
        <div className="rounded-xl border border-border bg-background p-4 md:p-5">
          <SectionHeading icon={RefreshCw} title="Estado operativo" detail="Actualizado en vivo" />
          <div className="mt-3 divide-y divide-border">
            {Object.entries(snapshot.metrics.orderCounts).map(([status, count]) => <div key={status} className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>{orderStatus[status] ?? status}</span><span className="font-semibold tabular-nums">{count.toLocaleString("es-AR")}</span></div>)}
            <DataRow label="Productos de menú" value={snapshot.metrics.menuProducts.toLocaleString("es-AR")} />
            <DataRow label="Cajas abiertas" value={snapshot.metrics.openRegisterSessions.toLocaleString("es-AR")} />
            <DataRow label="Ventas completadas" value={<MoneyValue amount={snapshot.metrics.orderGrossTotal} rate={exchangeRate} />} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-text-secondary">Las visitas y sesiones del menú no se muestran porque no se registran en los datos actuales.</p>
        </div>
      </section>
    </>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: React.ReactNode; detail?: string }) {
  return <article className="min-w-0 rounded-xl border border-border bg-background p-4 md:p-5"><div className="flex items-center gap-2 text-sm text-text-secondary"><Icon className="h-4 w-4" aria-hidden="true" />{label}</div><p className="mt-3 truncate text-xl font-semibold tabular-nums md:text-2xl">{value}</p>{detail && <p className="mt-1 text-xs text-text-secondary">{detail}</p>}</article>;
}

function SectionHeading({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-base font-semibold"><Icon className="h-4 w-4 text-text-secondary" aria-hidden="true" />{title}</h2>{detail && <span className="text-xs text-text-secondary">{detail}</span>}</div>;
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="relative mt-4 block max-w-md"><label className="block"><span className="sr-only">{placeholder}</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" /><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-11 w-full rounded-lg border border-border bg-background py-2 pl-9 pr-10 text-sm outline-none placeholder:text-text-secondary focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-search-cancel-button]:hidden" /></label>{value && <button type="button" onClick={() => onChange("")} aria-label="Limpiar búsqueda" className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-secondary hover:bg-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="h-4 w-4" aria-hidden="true" /></button>}</div>;
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-text-secondary">{message}</p>;
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>{label}</span><span className="font-semibold tabular-nums">{value}</span></div>;
}

function OrderRow({ order, exchangeRate }: { order: PlatformSnapshot["orders"][number]; exchangeRate: ExchangeRate | null }) {
  const statusStyle = order.status === "COMPLETED" || order.status === "READY" ? "bg-success/10 text-success" : order.status === "CANCELLED" ? "bg-danger/10 text-danger" : "bg-muted text-text-secondary";
  return <article className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 py-3 text-sm first:pt-4 last:pb-0"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="font-medium">{order.businessName}</span><span className="text-text-secondary">· {order.restaurantName}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle}`}>{orderStatus[order.status] ?? order.status}</span></div><p className="mt-1 truncate text-xs text-text-secondary">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ") || "Sin detalle de productos"}{order.customerName ? ` · ${order.customerName}` : ""}</p></div><div className="shrink-0 text-right"><p className="font-semibold tabular-nums"><MoneyValue amount={order.total} rate={exchangeRate} /></p><p className="mt-1 text-xs text-text-secondary">{dateTime(order.createdAt)}</p></div></article>;
}
