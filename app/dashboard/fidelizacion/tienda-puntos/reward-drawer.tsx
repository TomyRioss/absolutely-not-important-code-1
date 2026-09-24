"use client";

import Image from "next/image";

import { useEffect, useState } from "react";
import { Plus, X, GripVertical, Trash2, ChevronDown, ChevronUp, Sparkles, Loader2, RotateCcw, Info, Download } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
  SheetPortal,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ProductImageUploader } from "@/app/dashboard/menu/product-image-uploader";
import { listMenuProductsForImport, type RewardVariantInput, type MenuProductOption } from "./actions";
import { RewardModifierGroupsEditor, type RewardModifierGroupData } from "./reward-modifier-groups-editor";

function generateSku(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const rand = (n: number, chars: string) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${rand(6, letters)}-${rand(9, "0123456789")}-${rand(3, letters)}`;
}

type Variant = { id: string; name: string; pointsCost: number; costPrice: number | null; packagingPrice: number | null; sku: string | null; isDefault: boolean };
type Reward = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  pointsCost: number;
  imageUrl: string | null;
  variants: Variant[];
  modifierGroups: RewardModifierGroupData[];
};

export type DrawerState =
  | { mode: "create"; categoryId: string }
  | { mode: "edit"; reward: Reward; categoryId: string }
  | null;

type Row = {
  key: string;
  id?: string;
  name: string;
  pointsCost: string;
  costPrice: string;
  packagingPrice: string;
  sku: string;
  showCosto: boolean;
  showEmbalaje: boolean;
  showSku: boolean;
  collapsed: boolean;
};

function rowFromVariant(v?: Variant, name = "Único"): Row {
  return {
    key: v?.id ?? crypto.randomUUID(),
    id: v?.id,
    name: v?.name ?? name,
    pointsCost: v ? String(v.pointsCost) : "",
    costPrice: v?.costPrice != null ? String(v.costPrice) : "",
    packagingPrice: v?.packagingPrice != null ? String(v.packagingPrice) : "",
    sku: v?.sku ?? "",
    showCosto: v?.costPrice != null,
    showEmbalaje: v?.packagingPrice != null,
    showSku: !!v?.sku,
    collapsed: false,
  };
}

function PointsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-text-secondary">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
        <input
          type="text"
          inputMode="numeric"
          value={value ? Number(value).toLocaleString("es-AR") : ""}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder="0"
          className="w-full min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
        />
        <span className="shrink-0 text-sm text-text-secondary">pts</span>
      </div>
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  onRemove,
  info,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
  info?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <p className="text-xs text-text-secondary">{label}</p>
        {info && (
          <Tooltip>
            <TooltipTrigger className="text-text-secondary hover:text-text-primary">
              <Info className="h-3 w-3" />
            </TooltipTrigger>
            <TooltipContent>{info}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
        <span className="shrink-0 text-sm text-text-secondary">ARS $</span>
        <input
          type="text"
          inputMode="numeric"
          value={value ? Number(value).toLocaleString("es-AR") : ""}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder="0"
          className="w-full min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
        />
        {onRemove && (
          <button type="button" onClick={onRemove} className="shrink-0 text-text-secondary hover:text-danger">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function PillRow({ row, updateRow }: { row: Row; updateRow: (key: string, patch: Partial<Row>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!row.showCosto && (
        <button
          type="button"
          onClick={() => updateRow(row.key, { showCosto: true })}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
        >
          <Plus className="h-3 w-3" /> Costo
        </button>
      )}
      {!row.showEmbalaje && (
        <button
          type="button"
          onClick={() => updateRow(row.key, { showEmbalaje: true })}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
        >
          <Plus className="h-3 w-3" /> Embalaje
        </button>
      )}
      {!row.showSku && (
        <button
          type="button"
          onClick={() => updateRow(row.key, { showSku: true })}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface"
        >
          <Plus className="h-3 w-3" /> SKU
        </button>
      )}
    </div>
  );
}

function ExtraFields({ row, updateRow }: { row: Row; updateRow: (key: string, patch: Partial<Row>) => void }) {
  if (!row.showCosto && !row.showEmbalaje && !row.showSku) return null;
  return (
    <div className="space-y-3">
      {(row.showCosto || row.showEmbalaje) && (
        <div className={row.showCosto && row.showEmbalaje ? "grid grid-cols-2 gap-3" : ""}>
          {row.showCosto && (
            <MoneyField
              label="Costo"
              info="Cuánto te cuesta este premio, se usa para métricas de margen."
              value={row.costPrice}
              onChange={(v) => updateRow(row.key, { costPrice: v })}
              onRemove={() => updateRow(row.key, { showCosto: false, costPrice: "" })}
            />
          )}
          {row.showEmbalaje && (
            <MoneyField
              label="Embalaje"
              info="Costo del embalaje o packaging si corresponde."
              value={row.packagingPrice}
              onChange={(v) => updateRow(row.key, { packagingPrice: v })}
              onRemove={() => updateRow(row.key, { showEmbalaje: false, packagingPrice: "" })}
            />
          )}
        </div>
      )}
      {row.showSku && (
        <div>
          <div className="mb-1 flex items-center gap-1">
            <p className="text-xs text-text-secondary">SKU</p>
            <Tooltip>
              <TooltipTrigger className="text-text-secondary hover:text-text-primary">
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent>Código único para identificar este premio en tu inventario.</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
            <input
              value={row.sku}
              onChange={(e) => updateRow(row.key, { sku: e.target.value })}
              placeholder="SKU-001"
              className="w-full min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
            />
            <button
              type="button"
              onClick={() => updateRow(row.key, { sku: generateSku() })}
              className="shrink-0 text-text-secondary hover:text-text-primary"
              title="Autogenerar SKU"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => updateRow(row.key, { showSku: false, sku: "" })}
              className="shrink-0 text-text-secondary hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RewardDrawer({
  businessId,
  state,
  isPending,
  onClose,
  onSave,
  onImageChange,
  onModifiersSaved,
}: {
  businessId: string;
  state: DrawerState;
  isPending: boolean;
  onClose: () => void;
  onSave: (input: { rewardId?: string; categoryId: string; name: string; description: string; variants: RewardVariantInput[]; imageDataUrl?: string; importedImageUrl?: string }) => void;
  onImageChange: (rewardId: string, dataUrl: string) => void;
  onModifiersSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMode, setPriceMode] = useState<"simple" | "variants">("simple");
  const [rows, setRows] = useState<Row[]>([rowFromVariant()]);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiGenerated, setAiGenerated] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiInstructionsOpen, setAiInstructionsOpen] = useState(false);
  const [importedImageUrl, setImportedImageUrl] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importProducts, setImportProducts] = useState<MenuProductOption[] | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSearch, setImportSearch] = useState("");

  useEffect(() => {
    if (!state) return;
    const id = setTimeout(() => {
      if (state.mode === "edit") {
        setName(state.reward.name);
        setDescription(state.reward.description ?? "");
        const variants = state.reward.variants.length > 0 ? state.reward.variants : undefined;
        setRows(variants ? variants.map((v) => rowFromVariant(v)) : [rowFromVariant()]);
        setPriceMode(variants && variants.length > 1 ? "variants" : "simple");
      } else {
        setName("");
        setDescription("");
        setRows([rowFromVariant()]);
        setPriceMode("simple");
      }
      setPendingImage(null);
    }, 0);
    return () => clearTimeout(id);
    setImportedImageUrl(null);
  }, [state]);

  async function openImportModal() {
    setImportModalOpen(true);
    if (importProducts) return;
    setImportLoading(true);
    try {
      const products = await listMenuProductsForImport(businessId);
      setImportProducts(products);
    } finally {
      setImportLoading(false);
    }
  }

  function applyImportedProduct(product: MenuProductOption) {
    setName(product.name);
    setDescription(product.description ?? "");
    setImportedImageUrl(product.imageUrl);
    setPendingImage(null);
    if (product.variants.length > 0) {
      setRows(product.variants.map((v) => ({
        key: crypto.randomUUID(),
        name: v.name,
        pointsCost: String(v.suggestedPoints),
        costPrice: "",
        packagingPrice: "",
        sku: "",
        showCosto: false,
        showEmbalaje: false,
        showSku: false,
        collapsed: false,
      })));
      setPriceMode(product.variants.length > 1 ? "variants" : "simple");
    }
    setImportModalOpen(false);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addVariantRow() {
    setRows((prev) => [...prev, rowFromVariant(undefined, "")]);
  }

  function removeVariantRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  async function generateDescription() {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai/describe-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, instructions: aiInstructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al generar");
      setAiGenerated(data.description);
    } catch (err) {
      console.error("[RewardDrawer] generateDescription failed", err);
      setAiError(err instanceof Error ? err.message : "No se pudo generar la descripción");
    } finally {
      setAiLoading(false);
    }
  }

  function openAiModal() {
    setAiGenerated("");
    setAiError("");
    setAiInstructions("");
    setAiModalOpen(true);
    generateDescription();
  }

  function applyAiDescription() {
    setDescription(aiGenerated);
    setAiModalOpen(false);
  }

  function handleSave() {
    if (!state) return;
    const activeRows = priceMode === "simple" ? [rows[0]] : rows;
    const variants: RewardVariantInput[] = activeRows.map((r, i) => ({
      id: r.id,
      name: priceMode === "simple" ? "Único" : r.name || `Variante ${i + 1}`,
      pointsCost: Number(r.pointsCost) || 0,
      costPrice: r.showCosto && r.costPrice ? Number(r.costPrice) : null,
      packagingPrice: r.showEmbalaje && r.packagingPrice ? Number(r.packagingPrice) : null,
      sku: r.showSku && r.sku ? r.sku : null,
      isDefault: i === 0,
    }));
    onSave({
      rewardId: state.mode === "edit" ? state.reward.id : undefined,
      categoryId: state.categoryId,
      name,
      description,
      variants,
      imageDataUrl: pendingImage ?? undefined,
      importedImageUrl: importedImageUrl ?? undefined,
    });
  }

  return (
    <Sheet
      open={!!state}
      onOpenChange={(open, eventDetails) => {
        if (open) return;
        if (eventDetails.reason === "outside-press" || eventDetails.reason === "focus-out") return;
        onClose();
      }}
      modal={false}
    >
      <SheetContent
        showOverlay={false}
        className="flex w-full flex-col sm:max-w-md data-[side=right]:top-16 data-[side=right]:h-[calc(100%-4rem)]"
      >
        <SheetHeader>
          <SheetTitle>{state?.mode === "create" ? "Nuevo premio" : "Editar premio"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex gap-3">
            <ProductImageUploader
              size="lg"
              image={state?.mode === "edit" ? state.reward.imageUrl : (importedImageUrl ?? pendingImage)}
              onChange={(dataUrl) => {
                setImportedImageUrl(null);
                if (state?.mode === "edit") onImageChange(state.reward.id, dataUrl);
                else setPendingImage(dataUrl);
              }}
            />
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-xs text-text-secondary">Nombre</p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded border border-border px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {state?.mode === "create" && (
            <button
              type="button"
              onClick={openImportModal}
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-surface"
            >
              <Download className="h-3.5 w-3.5 text-primary" /> Importar producto del menú
            </button>
          )}

          <div>
            <p className="text-xs text-text-secondary">Descripción</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded border border-border px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={openAiModal}
              disabled={!name.trim()}
              title={!name.trim() ? "Ingresá el nombre del premio primero" : undefined}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Generar descripción
            </button>
            {!name.trim() && (
              <p className="mt-1 text-xs text-text-secondary">Ingresá el nombre del premio para generar la descripción.</p>
            )}
          </div>

          <Separator />

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-text-primary">Costo en puntos</p>
              <div className="inline-flex rounded-md border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setPriceMode("simple")}
                  className={`rounded px-3 py-1 text-xs font-medium ${priceMode === "simple" ? "bg-primary text-white" : "text-text-secondary"}`}
                >
                  Simple
                </button>
                <button
                  type="button"
                  onClick={() => setPriceMode("variants")}
                  className={`rounded px-3 py-1 text-xs font-medium ${priceMode === "variants" ? "bg-primary text-white" : "text-text-secondary"}`}
                >
                  Variantes{rows.length > 1 ? ` ${rows.length}` : ""}
                </button>
              </div>
            </div>

            {priceMode === "simple" ? (
              <div className="space-y-3">
                <PointsField label="Puntos" value={rows[0]?.pointsCost ?? ""} onChange={(v) => updateRow(rows[0].key, { pointsCost: v })} />
                <ExtraFields row={rows[0]} updateRow={updateRow} />
                <PillRow row={rows[0]} updateRow={updateRow} />
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <div key={row.key} className="rounded-lg border border-border p-3">
                    <div className={row.collapsed ? "" : "mb-2"}>
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0 text-text-secondary" />
                        <input
                          value={row.name}
                          onChange={(e) => updateRow(row.key, { name: e.target.value })}
                          placeholder="Nombre de la variante"
                          className="flex-1 border-b border-border bg-transparent px-1 py-0.5 text-sm font-medium outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => updateRow(row.key, { collapsed: !row.collapsed })}
                          className="rounded-full p-1 text-text-secondary hover:bg-surface"
                        >
                          {row.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </button>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariantRow(row.key)}
                            className="rounded-full p-1 text-text-secondary hover:bg-surface"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {!row.collapsed && (
                      <div className="space-y-3">
                        <PointsField label="Puntos" value={row.pointsCost} onChange={(v) => updateRow(row.key, { pointsCost: v })} />
                        <ExtraFields row={row} updateRow={updateRow} />
                        <PillRow row={row} updateRow={updateRow} />
                      </div>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addVariantRow}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" /> Añadir variante
                </button>
              </div>
            )}
          </div>

          <Separator />

          {state?.mode === "edit" ? (
            <RewardModifierGroupsEditor
              businessId={businessId}
              rewardId={state.reward.id}
              groups={state.reward.modifierGroups}
              onSaved={onModifiersSaved}
            />
          ) : (
            <p className="text-sm text-text-secondary">Guardá el premio para poder agregar modificadores.</p>
          )}
        </div>

        <Separator />
        <SheetFooter className="flex-row justify-end gap-3">
          <SheetClose className="text-sm text-text-secondary hover:underline">Cancelar</SheetClose>
          <button
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            Guardar
          </button>
        </SheetFooter>
      </SheetContent>

      {importModalOpen && (
        <SheetPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Importar producto del menú</h2>
              <button type="button" onClick={() => setImportModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <input
              value={importSearch}
              onChange={(e) => setImportSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="mb-3 w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />

            <div className="flex-1 overflow-y-auto">
              {importLoading && (
                <p className="flex items-center gap-2 py-6 text-sm text-text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando productos...
                </p>
              )}
              {!importLoading && importProducts?.length === 0 && (
                <p className="py-6 text-sm text-text-secondary">No hay productos en el menú todavía.</p>
              )}
              {!importLoading &&
                importProducts
                  ?.filter((p) => p.name.toLowerCase().includes(importSearch.trim().toLowerCase()))
                  .map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => applyImportedProduct(product)}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-surface"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-background">
                        {product.imageUrl && <Image src={product.imageUrl} alt="" fill unoptimized className="object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">{product.name}</p>
                        <p className="truncate text-xs text-text-secondary">
                          {product.variants.map((v) => `${v.suggestedPoints} pts`).join(" · ") || "Sin variantes"}
                        </p>
                      </div>
                    </button>
                  ))}
            </div>
          </div>
        </div>
        </SheetPortal>
      )}

      {aiModalOpen && (
        <SheetPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Generar descripción con IA</h2>
              <button type="button" onClick={() => setAiModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-1 text-xs text-text-secondary">Descripción actual</p>
            <textarea
              value={description}
              readOnly
              rows={2}
              className="mb-4 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-secondary outline-none"
            />

            <button
              type="button"
              onClick={() => setAiInstructionsOpen((prev) => !prev)}
              className="mb-1 flex w-full items-center justify-between text-xs text-text-secondary"
            >
              Instrucciones para la IA (opcional)
              {aiInstructionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {aiInstructionsOpen && (
              <textarea
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                rows={2}
                placeholder="Ej: mencionar que incluye bebida, resaltar que es por tiempo limitado..."
                className="mb-4 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
              />
            )}

            <div className="mb-1 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-text-secondary">Descripción generada</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <Sparkles className="h-2.5 w-2.5" /> IA
                </span>
              </div>
              {!aiError && (
                <button
                  type="button"
                  onClick={generateDescription}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Regenerar
                </button>
              )}
            </div>
            {aiError ? (
              <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{aiError}</p>
            ) : (
              <textarea
                value={aiGenerated}
                onChange={(e) => setAiGenerated(e.target.value)}
                rows={3}
                placeholder={aiLoading ? "Generando descripción..." : ""}
                className="mb-4 w-full resize-none rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-text-primary outline-none"
              />
            )}

            <p className="mb-4 flex items-start gap-1.5 text-xs text-text-secondary">
              Podés editar la descripción antes de aplicar los cambios al premio.
            </p>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setAiModalOpen(false)} className="text-sm text-text-secondary hover:underline">
                Volver
              </button>
              {aiError ? (
                <button
                  type="button"
                  onClick={generateDescription}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                >
                  Reintentar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applyAiDescription}
                  disabled={aiLoading || !aiGenerated}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {aiLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {aiLoading ? "Generando descripción" : "Aplicar descripción"}
                </button>
              )}
            </div>
          </div>
        </div>
        </SheetPortal>
      )}
    </Sheet>
  );
}
