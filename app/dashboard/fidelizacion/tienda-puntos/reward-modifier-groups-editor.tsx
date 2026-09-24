"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  saveRewardModifierGroup,
  deleteRewardModifierGroup,
  type RewardModifierGroupInput,
} from "./actions";

export type RewardModifierGroupData = {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  modifiers: { id: string; name: string; pointsCost: number }[];
};

type GroupForm = {
  key: string;
  id?: string;
  name: string;
  required: boolean;
  multiple: boolean;
  modifiers: { key: string; id?: string; name: string; pointsCost: string }[];
};

function groupToForm(g?: RewardModifierGroupData): GroupForm {
  return {
    key: g?.id ?? crypto.randomUUID(),
    id: g?.id,
    name: g?.name ?? "",
    required: g?.required ?? false,
    multiple: g?.multiple ?? false,
    modifiers: g?.modifiers.map((m) => ({ key: m.id, id: m.id, name: m.name, pointsCost: String(m.pointsCost) })) ?? [
      { key: crypto.randomUUID(), name: "", pointsCost: "0" },
    ],
  };
}

export function RewardModifierGroupsEditor({
  businessId,
  rewardId,
  groups,
  onSaved,
}: {
  businessId: string;
  rewardId: string;
  groups: RewardModifierGroupData[];
  onSaved: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [forms, setForms] = useState<GroupForm[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
        f.key === key ? { ...f, modifiers: [...f.modifiers, { key: crypto.randomUUID(), name: "", pointsCost: "0" }] } : f,
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
    const input: RewardModifierGroupInput = {
      id: form.id,
      name: form.name,
      required: form.required,
      multiple: form.multiple,
      modifiers: form.modifiers.map((m) => ({ id: m.id, name: m.name, pointsCost: Number(m.pointsCost) || 0 })),
    };
    startTransition(async () => {
      const result = await saveRewardModifierGroup(businessId, rewardId, input);
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
      const result = await deleteRewardModifierGroup(groupId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

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
        <p className="text-sm text-text-secondary">Tamaño, color, extras...</p>
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
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeGroup(g.id)}
                  className="rounded-full p-1.5 text-text-secondary hover:bg-surface hover:text-danger"
                  aria-label="Borrar grupo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="flex w-full flex-col sm:max-w-sm data-[side=left]:left-56">
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
                      placeholder="Ej: Elegí el tamaño"
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
                              value={m.pointsCost}
                              onChange={(e) => updateModifier(form.key, m.key, { pointsCost: e.target.value.replace(/\D/g, "") })}
                              placeholder="0 pts"
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
    </div>
  );
}
