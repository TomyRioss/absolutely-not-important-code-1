"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  saveModifierGroup,
  deleteModifierGroup,
  unlinkModifierGroupFromProduct,
  getProductsForModifierGroup,
  setModifierGroupProductLink,
  type ModifierGroupInput,
  type ProductForAssociation,
} from "./actions";

export type ModifierGroupData = {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  modifiers: { id: string; name: string; price: number }[];
};

type GroupForm = {
  key: string;
  id?: string;
  name: string;
  required: boolean;
  multiple: boolean;
  modifiers: { key: string; id?: string; name: string; price: string }[];
};

function groupToForm(g?: ModifierGroupData): GroupForm {
  return {
    key: g?.id ?? crypto.randomUUID(),
    id: g?.id,
    name: g?.name ?? "",
    required: g?.required ?? false,
    multiple: g?.multiple ?? false,
    modifiers: g?.modifiers.map((m) => ({ key: m.id, id: m.id, name: m.name, price: String(m.price) })) ?? [
      { key: crypto.randomUUID(), name: "", price: "0" },
    ],
  };
}

export function ModifierGroupsEditor({
  restaurantId,
  productId,
  groups,
  onSaved,
}: {
  restaurantId: string;
  productId: string;
  groups: ModifierGroupData[];
  onSaved: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [forms, setForms] = useState<GroupForm[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [associateGroupId, setAssociateGroupId] = useState<string | null>(null);
  const [associateProducts, setAssociateProducts] = useState<ProductForAssociation[]>([]);
  const [associateQuery, setAssociateQuery] = useState("");
  const [associateLoading, setAssociateLoading] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const id = setTimeout(() => setForms((prev) => {
      const unsaved = prev.filter((f) => !f.id);
      const saved = groups.map((g) => prev.find((f) => f.id === g.id) ?? groupToForm(g));
      return [...saved, ...unsaved];
    }), 0);
    return () => clearTimeout(id);
  }, [groups, drawerOpen]);

  function openDrawer(expandKey: string | null) {
    setForms(groups.map((g) => groupToForm(g)));
    setExpandedKey(expandKey);
    setError(null);
    setDrawerOpen(true);
  }

  function openNewGroup() {
    const form = groupToForm();
    setForms(groups.map((g) => groupToForm(g)).concat(form));
    setExpandedKey(form.key);
    setError(null);
    setDrawerOpen(true);
  }

  function updateForm(key: string, patch: Partial<GroupForm>) {
    setForms((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function addModifier(key: string) {
    setForms((prev) =>
      prev.map((f) =>
        f.key === key ? { ...f, modifiers: [...f.modifiers, { key: crypto.randomUUID(), name: "", price: "0" }] } : f,
      ),
    );
  }

  function updateModifier(formKey: string, modKey: string, patch: Partial<GroupForm["modifiers"][number]>) {
    setForms((prev) =>
      prev.map((f) =>
        f.key === formKey
          ? { ...f, modifiers: f.modifiers.map((m) => (m.key === modKey ? { ...m, ...patch } : m)) }
          : f,
      ),
    );
  }

  function removeModifier(formKey: string, modKey: string) {
    setForms((prev) =>
      prev.map((f) =>
        f.key === formKey && f.modifiers.length > 1
          ? { ...f, modifiers: f.modifiers.filter((m) => m.key !== modKey) }
          : f,
      ),
    );
  }

  function removeUnsavedGroup(key: string) {
    setForms((prev) => prev.filter((f) => f.key !== key));
    setExpandedKey(null);
  }

  function saveGroup(form: GroupForm) {
    if (!form.name.trim()) {
      setError("Nombre del grupo requerido.");
      return;
    }
    setError(null);
    const input: ModifierGroupInput = {
      id: form.id,
      name: form.name,
      required: form.required,
      multiple: form.multiple,
      modifiers: form.modifiers.map((m) => ({ id: m.id, name: m.name, price: Number(m.price) || 0 })),
    };
    startTransition(async () => {
      const result = await saveModifierGroup(restaurantId, productId, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  function removeGroup(groupId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteModifierGroup(groupId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  function unlinkGroup(groupId: string) {
    setError(null);
    startTransition(async () => {
      const result = await unlinkModifierGroupFromProduct(productId, groupId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  async function openAssociate(groupId: string) {
    setAssociateGroupId(groupId);
    setAssociateQuery("");
    setAssociateLoading(true);
    const products = await getProductsForModifierGroup(restaurantId, groupId);
    setAssociateProducts(products);
    setAssociateLoading(false);
  }

  function toggleAssociation(product: ProductForAssociation) {
    if (!associateGroupId) return;
    const nextLinked = !product.linked;
    setAssociateProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, linked: nextLinked } : p)),
    );
    startTransition(async () => {
      const result = await setModifierGroupProductLink(product.id, associateGroupId, nextLinked);
      if (!result.ok) {
        setError(result.error);
        setAssociateProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, linked: !nextLinked } : p)),
        );
        return;
      }
      onSaved();
    });
  }

  const associateGroupsedByCategory = associateProducts
    .filter((p) => p.name.toLowerCase().includes(associateQuery.trim().toLowerCase()))
    .reduce<Record<string, ProductForAssociation[]>>((acc, p) => {
      (acc[p.categoryName] ??= []).push(p);
      return acc;
    }, {});
  const linkedCount = associateProducts.filter((p) => p.linked).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">
          Modificadores{groups.length > 0 ? ` (${groups.length})` : ""}
        </p>
        <button
          type="button"
          onClick={openNewGroup}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <Plus className="h-4 w-4" /> Agregar grupo
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-text-secondary">Ingredientes, sabores, cubiertos...</p>
      ) : (
        <div className="space-y-1.5">
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm text-text-primary"
            >
              <span className="truncate">{g.name}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => openDrawer(g.id)}
                  className="rounded-full p-1.5 text-text-secondary hover:bg-surface hover:text-primary"
                  aria-label="Editar grupo"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => unlinkGroup(g.id)}
                  className="rounded-full p-1.5 text-text-secondary hover:bg-surface hover:text-danger"
                  aria-label="Quitar grupo de este producto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="flex w-full flex-col sm:max-w-sm data-[side=left]:left-56"
        >
          <SheetHeader>
            <SheetTitle>Editar modificadores</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
            {error && <p className="text-sm text-danger">{error}</p>}

            {forms.map((form) => {
              const expanded = expandedKey === form.key;
              return (
                <div key={form.key} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={form.name}
                      onChange={(e) => updateForm(form.key, { name: e.target.value })}
                      placeholder="Ej: Elegí tu salsa"
                      className="flex-1 border-b border-border bg-transparent px-1 py-0.5 text-sm font-medium outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setExpandedKey(expanded ? null : form.key)}
                      className="rounded-full p-1 text-text-secondary hover:bg-surface"
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => (form.id ? removeGroup(form.id) : removeUnsavedGroup(form.key))}
                      className="rounded-full p-1 text-text-secondary hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-3 space-y-3">
                      {form.id && (
                        <button
                          type="button"
                          onClick={() => openAssociate(form.id!)}
                          className="flex w-full items-center justify-between rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
                        >
                          Asociar / Desasociar platillos
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm text-text-primary">
                        <label className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={form.required}
                            onChange={(e) => updateForm(form.key, { required: e.target.checked })}
                          />
                          Obligatorio
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={form.multiple}
                            onChange={(e) => updateForm(form.key, { multiple: e.target.checked })}
                          />
                          Selección múltiple
                        </label>
                      </div>

                      <div className="space-y-2">
                        {form.modifiers.map((m) => (
                          <div key={m.key} className="flex items-center gap-2">
                            <input
                              value={m.name}
                              onChange={(e) => updateModifier(form.key, m.key, { name: e.target.value })}
                              placeholder="Opción"
                              className="flex-1 rounded border border-border px-2 py-1.5 text-sm outline-none focus:border-primary"
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={m.price}
                              onChange={(e) => updateModifier(form.key, m.key, { price: e.target.value.replace(/\D/g, "") })}
                              placeholder="0"
                              className="w-24 rounded border border-border px-2 py-1.5 text-sm outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              onClick={() => removeModifier(form.key, m.key)}
                              className="shrink-0 text-text-secondary hover:text-danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addModifier(form.key)}
                          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <Plus className="h-3.5 w-3.5" /> Agregar opción
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => saveGroup(form)}
                        disabled={isPending}
                        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                      >
                        Guardar grupo
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={associateGroupId !== null} onOpenChange={(open) => !open && setAssociateGroupId(null)}>
        <SheetContent
          side="left"
          className="flex w-full flex-col sm:max-w-sm data-[side=left]:left-[28rem]"
        >
          <SheetHeader>
            <SheetTitle>Asociar platillos{linkedCount > 0 ? ` (${linkedCount})` : ""}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
            <div className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5">
              <Search className="h-4 w-4 shrink-0 text-text-secondary" />
              <input
                value={associateQuery}
                onChange={(e) => setAssociateQuery(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>

            {associateLoading ? (
              <p className="text-sm text-text-secondary">Cargando...</p>
            ) : (
              Object.entries(associateGroupsedByCategory).map(([categoryName, products]) => (
                <div key={categoryName}>
                  <p className="mb-1 text-xs font-semibold text-text-secondary">{categoryName}</p>
                  <div className="space-y-1">
                    {products.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-primary hover:bg-surface"
                      >
                        <input
                          type="checkbox"
                          checked={p.linked}
                          onChange={() => toggleAssociation(p)}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
