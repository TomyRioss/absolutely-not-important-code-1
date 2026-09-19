"use client";

import { useState, useTransition } from "react";
import { FaLink, FaFacebook, FaWhatsapp, FaArrowUpRightFromSquare, FaShareNodes } from "react-icons/fa6";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateRestaurant, uploadRestaurantAsset, updateSocialLink, createBranch, deleteBranch, resolveMapsShortLink, saveOpeningHours, type OpeningHoursInput } from "../actions";
import { FaTrashCan, FaPlus, FaPen, FaClock } from "react-icons/fa6";
import { LogoUploader } from "../logo-uploader";
import { BannerUploader } from "../banner-uploader";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_META, type SocialPlatformValue } from "@/lib/social-platforms";
import AddressAutocomplete from "@/app/onboarding/_components/AddressAutocomplete";
import { parseGoogleMapsLink } from "@/lib/parse-maps-link";
import { reverseGeocode } from "@/lib/geo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TIMEZONES = [
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)" },
  { value: "America/Bogota", label: "Colombia (Bogotá)" },
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "America/Lima", label: "Perú (Lima)" },
  { value: "America/Montevideo", label: "Uruguay (Montevideo)" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
}).concat("23:59");

async function parseMapsLinkMaybeShort(link: string): Promise<{ lat: number; lng: number } | null> {
  const direct = parseGoogleMapsLink(link);
  if (direct) return direct;
  const resolved = await resolveMapsShortLink(link).catch(() => null);
  return resolved ? parseGoogleMapsLink(resolved) : null;
}

export function DesignClient({
  restaurantId,
  restaurantName,
  restaurantLogo,
  restaurantBanner,
  businessId,
  businessSlug,
  socialLinks,
  branches,
  openingHours,
  timezone: initialTimezone,
}: {
  restaurantId: string;
  restaurantName: string;
  restaurantLogo: string | null;
  restaurantBanner: string | null;
  businessId: string;
  businessSlug: string;
  socialLinks: { platform: SocialPlatformValue; url: string }[];
  branches: { id: string; name: string; address: string | null; lat: number | null; lng: number | null }[];
  openingHours: OpeningHoursInput[];
  timezone: string;
}) {
  const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [hoursByDay, setHoursByDay] = useState<{ open: string; close: string }[][]>(() => {
    const byDay: { open: string; close: string }[][] = Array.from({ length: 7 }, () => []);
    for (const h of openingHours) byDay[h.dayOfWeek]?.push({ open: h.openTime, close: h.closeTime });
    return byDay;
  });
  const [hoursSaved, setHoursSaved] = useState(false);

  function toggleDayOpen(day: number, isOpen: boolean) {
    setHoursByDay((prev) => {
      const next = [...prev];
      next[day] = isOpen ? [{ open: "09:00", close: "18:00" }] : [];
      return next;
    });
  }

  function updateDaySlot(day: number, index: number, field: "open" | "close", value: string) {
    setHoursByDay((prev) => {
      const next = [...prev];
      next[day] = next[day].map((slot, i) => (i === index ? { ...slot, [field]: value } : slot));
      return next;
    });
  }

  function addDaySlot(day: number) {
    setHoursByDay((prev) => {
      const next = [...prev];
      next[day] = [...next[day], { open: "09:00", close: "18:00" }];
      return next;
    });
  }

  function removeDaySlot(day: number, index: number) {
    setHoursByDay((prev) => {
      const next = [...prev];
      next[day] = next[day].filter((_, i) => i !== index);
      return next;
    });
  }

  function handleSaveHours() {
    setHoursSaved(false);
    const flat: OpeningHoursInput[] = hoursByDay.flatMap((slots, day) =>
      slots.map((s) => ({ dayOfWeek: day, openTime: s.open, closeTime: s.close })),
    );
    run(() => saveOpeningHours(restaurantId, flat, timezone), () => setHoursSaved(true));
  }

  const [name, setName] = useState(restaurantName);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(restaurantBanner);
  const [branchList, setBranchList] = useState(branches);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchAddress, setNewBranchAddress] = useState("");
  const [newBranchCoords, setNewBranchCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newBranchMapsLink, setNewBranchMapsLink] = useState("");
  const [newBranchMapsLinkError, setNewBranchMapsLinkError] = useState("");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editMapsLink, setEditMapsLink] = useState("");
  const [editMapsLinkError, setEditMapsLinkError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [socials, setSocials] = useState<Record<SocialPlatformValue, string>>(() => {
    const initial = {} as Record<SocialPlatformValue, string>;
    for (const p of SOCIAL_PLATFORMS) initial[p] = "";
    for (const l of socialLinks) initial[l.platform] = l.url;
    return initial;
  });

  function handleBranchNameBlur(branchId: string, nextName: string) {
    if (!nextName.trim()) return;
    run(() => updateRestaurant(branchId, { name: nextName }));
  }

  function handleBranchAddressChange(branchId: string, next: string, nextCoords: { lat: number; lng: number } | null) {
    setBranchList((list) =>
      list.map((b) => (b.id === branchId ? { ...b, address: next, lat: nextCoords?.lat ?? null, lng: nextCoords?.lng ?? null } : b)),
    );
    run(() => updateRestaurant(branchId, { address: next, lat: nextCoords?.lat ?? null, lng: nextCoords?.lng ?? null }));
  }

  function handleApplyBranchMapsLink(branchId: string) {
    setEditMapsLinkError("");
    startTransition(async () => {
      const parsed = await parseMapsLinkMaybeShort(editMapsLink);
      if (!parsed) {
        setEditMapsLinkError("No se pudo leer la ubicación de ese link.");
        return;
      }
      const address = (await reverseGeocode(parsed.lat, parsed.lng).catch(() => null)) ?? undefined;
      setBranchList((list) =>
        list.map((b) => (b.id === branchId ? { ...b, lat: parsed.lat, lng: parsed.lng, address: address ?? b.address } : b)),
      );
      await updateRestaurant(branchId, { lat: parsed.lat, lng: parsed.lng, ...(address ? { address } : {}) });
    });
  }

  async function handleAddBranch() {
    if (!newBranchName.trim()) return;
    setError(null);
    setNewBranchMapsLinkError("");

    let coords = newBranchCoords;
    let linkAddress: string | null = null;
    if (newBranchMapsLink.trim()) {
      const parsed = await parseMapsLinkMaybeShort(newBranchMapsLink);
      if (!parsed) {
        setNewBranchMapsLinkError("No se pudo leer la ubicación de ese link.");
        return;
      }
      coords = parsed;
      linkAddress = await reverseGeocode(parsed.lat, parsed.lng).catch(() => null);
    }

    startTransition(async () => {
      const result = await createBranch(businessId, newBranchName);
      if (!result.ok || !result.branch) {
        setError(!result.ok ? result.error : "No se pudo crear la sucursal.");
        return;
      }
      const branch = { id: result.branch.id, name: result.branch.name, address: result.branch.address, lat: result.branch.lat, lng: result.branch.lng };
      if (newBranchAddress.trim() || coords) {
        branch.address = newBranchAddress.trim() || linkAddress || branch.address;
        if (coords) {
          branch.lat = coords.lat;
          branch.lng = coords.lng;
        }
        await updateRestaurant(branch.id, { address: branch.address, lat: branch.lat, lng: branch.lng });
      }
      setBranchList((list) => [...list, branch]);
      setNewBranchName("");
      setNewBranchAddress("");
      setNewBranchCoords(null);
      setNewBranchMapsLink("");
    });
  }

  function handleDeleteBranch(branchId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteBranch(branchId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBranchList((list) => list.filter((b) => b.id !== branchId));
    });
  }

  function handleSocialBlur(platform: SocialPlatformValue) {
    run(() => updateSocialLink(businessId, platform, socials[platform]));
  }

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreviewKey((k) => k + 1);
      onOk?.();
    });
  }

  async function handleBannerChange(next: string | null) {
    setBanner(next);
    if (!next) {
      run(() => updateRestaurant(restaurantId, { banner: null }));
      return;
    }
    setError(null);
    startTransition(async () => {
      const uploaded = await uploadRestaurantAsset(restaurantId, "banner", next);
      if (!uploaded.ok) {
        setError(uploaded.error);
        return;
      }
      const result = await updateRestaurant(restaurantId, { banner: uploaded.url });
      if (!result.ok) setError(result.error);
      else setPreviewKey((k) => k + 1);
    });
  }

  async function handleLogoChange(next: string | null) {
    setLogoPreview(next);
    if (!next) {
      run(() => updateRestaurant(restaurantId, { logo: null }));
      return;
    }
    setError(null);
    startTransition(async () => {
      const uploaded = await uploadRestaurantAsset(restaurantId, "logo", next);
      if (!uploaded.ok) {
        setError(uploaded.error);
        return;
      }
      const result = await updateRestaurant(restaurantId, { logo: uploaded.url });
      if (!result.ok) setError(result.error);
      else setPreviewKey((k) => k + 1);
    });
  }

  function getShareUrl() {
    return `${window.location.origin}/${businessSlug}`;
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  }

  function handleShareFacebook() {
    const url = encodeURIComponent(getShareUrl());
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "noopener,noreferrer");
  }

  function handleShareWhatsapp() {
    const text = encodeURIComponent(`${restaurantName} - ${getShareUrl()}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen bg-surface p-4 md:p-6">
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[1fr_375px] lg:items-stretch">
        <div className="w-full">
          <div className="mb-4">
            <div
              className="relative flex h-28 w-full items-center justify-center rounded-xl bg-gradient-to-r from-primary-light to-primary/20 bg-cover bg-center md:h-36"
              style={banner ? { backgroundImage: `url(${banner})` } : undefined}
            >
              <BannerUploader banner={banner} onChange={handleBannerChange} />
            </div>
            <div className="-mt-10 flex items-end gap-3 px-4">
              <div className="relative h-24 w-32 shrink-0">
                <div className="flex h-24 w-32 items-center justify-center overflow-hidden rounded-lg border-4 border-background bg-surface shadow-sm">
                  {logoPreview || restaurantLogo ? (
                    <img src={logoPreview ?? restaurantLogo!} alt={restaurantName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-semibold text-text-secondary">
                      {restaurantName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <LogoUploader logo={logoPreview ?? restaurantLogo} onChange={handleLogoChange} />
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="text-xs text-text-secondary">Restaurante</p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => {
                    if (name.trim() && name.trim() !== restaurantName) {
                      run(() => updateRestaurant(restaurantId, { name }));
                    }
                  }}
                  disabled={isPending}
                  className="w-full max-w-xs border-b border-border bg-transparent font-medium text-text-primary outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="mb-4 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="rounded-xl border border-border bg-background p-4">
            <p className="mb-3 text-sm font-semibold text-text-primary">Redes sociales</p>
            <div className="flex flex-col gap-2">
              {SOCIAL_PLATFORMS.map((platform) => {
                const meta = SOCIAL_PLATFORM_META[platform];
                const Icon = meta.icon;
                return (
                  <div key={platform} className="flex items-center gap-2">
                    <Icon className="h-5 w-5 shrink-0" style={{ color: meta.color }} />
                    <input
                      value={socials[platform]}
                      onChange={(e) => setSocials((s) => ({ ...s, [platform]: e.target.value }))}
                      onBlur={() => handleSocialBlur(platform)}
                      disabled={isPending}
                      placeholder={platform === "WHATSAPP" ? "Número de WhatsApp" : `Link de ${meta.label}`}
                      className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-text-primary outline-none focus:border-primary"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-background p-4">
            <p className="mb-3 text-sm font-semibold text-text-primary">Horarios de atención</p>
            <button
              type="button"
              onClick={() => setHoursModalOpen(true)}
              className="flex w-fit items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-light"
            >
              <FaClock className="h-3.5 w-3.5" />
              Configurar mis horarios
            </button>
          </div>

          <Dialog open={hoursModalOpen} onOpenChange={setHoursModalOpen}>
            <DialogContent className="max-h-[85vh] overflow-x-hidden overflow-y-auto p-0 sm:max-w-lg">
              <DialogHeader className="rounded-t-lg bg-primary p-4">
                <DialogTitle className="text-white">Configurar mis horarios</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 px-4 pb-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <FaClock className="h-4 w-4" />
                  Horario de atención
                </p>

                <div>
                  <p className="mb-1 text-xs text-text-secondary">Zona horaria</p>
                  <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-3">
                  {DAY_LABELS.map((label, day) => {
                    const slots = hoursByDay[day];
                    const isOpen = slots.length > 0;
                    return (
                      <div key={day} className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3">
                          <Switch
                            checked={isOpen}
                            onCheckedChange={(checked) => toggleDayOpen(day, checked)}
                          />
                          <span className="w-20 shrink-0 text-sm font-medium text-text-primary">
                            {isOpen ? "Abierto" : "Cerrado"}
                          </span>
                          <span className="w-24 shrink-0 text-sm text-text-secondary">{label}</span>
                          {isOpen && slots[0] && (
                            <div className="flex items-center gap-1.5">
                              <Select value={slots[0].open} onValueChange={(v) => v && updateDaySlot(day, 0, "open", v)}>
                                <SelectTrigger className="h-8 w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIME_OPTIONS.map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-text-secondary">-</span>
                              <Select value={slots[0].close} onValueChange={(v) => v && updateDaySlot(day, 0, "close", v)}>
                                <SelectTrigger className="h-8 w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIME_OPTIONS.map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        {isOpen && slots.slice(1).map((slot, i) => (
                          <div key={i + 1} className="ml-[7.75rem] flex items-center gap-1.5">
                            <Select value={slot.open} onValueChange={(v) => v && updateDaySlot(day, i + 1, "open", v)}>
                              <SelectTrigger className="h-8 w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIME_OPTIONS.map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-text-secondary">-</span>
                            <Select value={slot.close} onValueChange={(v) => v && updateDaySlot(day, i + 1, "close", v)}>
                              <SelectTrigger className="h-8 w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIME_OPTIONS.map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <button type="button" onClick={() => removeDaySlot(day, i + 1)} className="text-text-secondary hover:text-danger">
                              <FaTrashCan className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {isOpen && (
                          <button
                            type="button"
                            onClick={() => addDaySlot(day)}
                            className="ml-[7.75rem] flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <FaPlus className="h-2.5 w-2.5" />
                            Agregar otro horario
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <DialogFooter className="p-4 pt-2">
                <DialogClose
                  onClick={handleSaveHours}
                  disabled={isPending}
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {hoursSaved ? "¡Guardado!" : "Guardar y cerrar"}
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-4 rounded-xl border border-border bg-background p-4">
            <p className="mb-3 text-sm font-semibold text-text-primary">Sucursales</p>

            <div className="rounded-lg border border-dashed border-border p-3">
              <p className="mb-2 text-xs font-medium text-text-secondary">Nueva sucursal</p>
              <input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                disabled={isPending}
                placeholder="Nombre de la nueva sucursal"
                className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-text-primary outline-none focus:border-primary"
              />

              <p className="mb-1 mt-2 text-xs text-text-secondary">Dirección (opcional)</p>
              <AddressAutocomplete
                value={newBranchAddress}
                onChange={(addr, c) => {
                  setNewBranchAddress(addr);
                  setNewBranchCoords(c);
                }}
              />

              <p className="mb-1 mt-2 text-xs text-text-secondary">O pegá un link de Google Maps</p>
              <input
                value={newBranchMapsLink}
                onChange={(e) => {
                  setNewBranchMapsLink(e.target.value);
                  setNewBranchMapsLinkError("");
                }}
                disabled={isPending}
                placeholder="https://maps.google.com/..."
                className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-text-primary outline-none focus:border-primary"
              />
              {newBranchMapsLinkError && <p className="mt-1 text-xs text-danger">{newBranchMapsLinkError}</p>}

              <button
                type="button"
                onClick={handleAddBranch}
                disabled={isPending || !newBranchName.trim()}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-light disabled:opacity-50"
              >
                <FaPlus className="h-3 w-3" />
                Agregar sucursal
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {branchList.map((b) => (
                <div key={b.id} className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <FaPen className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                  <div className="min-w-0 flex-1">
                    <input
                      defaultValue={b.name}
                      onBlur={(e) => handleBranchNameBlur(b.id, e.target.value)}
                      disabled={isPending}
                      className="w-full border-b border-border bg-transparent text-sm font-medium text-text-primary outline-none focus:border-primary"
                    />
                    {editingAddressId === b.id ? (
                      <div className="mt-1">
                        <AddressAutocomplete
                          value={b.address ?? ""}
                          onChange={(next, nextCoords) => handleBranchAddressChange(b.id, next, nextCoords)}
                        />
                        <p className="mb-1 mt-2 text-xs text-text-secondary">O pegá un link de Google Maps</p>
                        <div className="flex gap-2">
                          <input
                            value={editMapsLink}
                            onChange={(e) => {
                              setEditMapsLink(e.target.value);
                              setEditMapsLinkError("");
                            }}
                            disabled={isPending}
                            placeholder="https://maps.google.com/..."
                            className="w-full rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-text-primary outline-none focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => handleApplyBranchMapsLink(b.id)}
                            disabled={isPending || !editMapsLink.trim()}
                            className="shrink-0 rounded-lg border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-light disabled:opacity-50"
                          >
                            Usar link
                          </button>
                        </div>
                        {editMapsLinkError && <p className="mt-1 text-xs text-danger">{editMapsLinkError}</p>}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAddressId(null);
                            setEditMapsLink("");
                            setEditMapsLinkError("");
                          }}
                          className="mt-2 text-xs font-medium text-primary hover:underline"
                        >
                          Listo
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingAddressId(b.id)}
                        className="mt-1 block text-left text-xs text-text-secondary hover:text-primary hover:underline"
                      >
                        {b.address || "Sin dirección cargada — click para agregar"}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteBranch(b.id)}
                    disabled={isPending || branchList.length <= 1}
                    className="shrink-0 rounded p-2 text-text-secondary hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                    title={branchList.length <= 1 ? "Debe quedar al menos una sucursal" : "Eliminar sucursal"}
                  >
                    <FaTrashCan className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden items-start justify-end lg:flex">
          <div className="sticky top-6 flex flex-col">
            <div className="flex h-[560px] w-[300px] flex-col overflow-hidden rounded-lg border border-border bg-background">
              <div className="shrink-0 border-b border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary">
                Vista previa en vivo
              </div>
              <iframe
                key={previewKey}
                src={`/${businessSlug}?v=${previewKey}`}
                className="w-[300px] flex-1"
                title="Vista previa del menú"
              />
            </div>
            <div className="mt-3 flex w-[300px] gap-2">
              <a
                href={`/${businessSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary-light"
              >
                <FaArrowUpRightFromSquare className="h-3.5 w-3.5" />
                Visitar página
              </a>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex flex-1 items-center justify-center gap-1.5 rounded border border-primary px-3 py-2 text-sm font-medium text-primary outline-none hover:bg-primary-light">
                  <FaShareNodes className="h-3.5 w-3.5" />
                  Compartir
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuItem closeOnClick={false} onClick={handleCopyLink}>
                    <FaLink className="h-4 w-4 text-text-secondary" />
                    {copied ? "¡Enlace copiado!" : "Copiar enlace"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareFacebook}>
                    <FaFacebook className="h-4 w-4 text-[#1877F2]" />
                    Facebook
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareWhatsapp}>
                    <FaWhatsapp className="h-4 w-4 text-[#25D366]" />
                    Whatsapp
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
