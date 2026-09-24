"use client";

import Image from "next/image";

import { useState, useTransition } from "react";
import { Plus, Eye, EyeOff, Pencil, Trash2, Gift } from "lucide-react";
import { ProductImageUploader } from "@/app/dashboard/menu/product-image-uploader";
import {
  saveGiftReward,
  toggleGiftRewardActive,
  deleteGiftReward,
  uploadGiftRewardImage,
  updateGiftRewardImage,
} from "./actions";

type GiftReward = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  visitMilestone: number;
};

type FormState = { id?: string; name: string; description: string; visitMilestone: string; imageUrl: string | null };

const EMPTY_FORM: FormState = { name: "", description: "", visitMilestone: "1", imageUrl: null };

export function RegalosClient({ businessId, rewards: initialRewards }: { businessId: string; rewards: GiftReward[] }) {
  const [rewards, setRewards] = useState(initialRewards);
  const [form, setForm] = useState<FormState | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setPendingImage(null);
    setError(null);
  }

  function openEdit(reward: GiftReward) {
    setForm({
      id: reward.id,
      name: reward.name,
      description: reward.description ?? "",
      visitMilestone: String(reward.visitMilestone),
      imageUrl: reward.imageUrl,
    });
    setPendingImage(null);
    setError(null);
  }

  function handleSave() {
    if (!form) return;
    setError(null);
    startTransition(async () => {
      const result = await saveGiftReward({
        rewardId: form.id,
        businessId,
        name: form.name,
        description: form.description,
        visitMilestone: Number(form.visitMilestone),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      let imageUrl = form.imageUrl;
      if (pendingImage) {
        const uploaded = await uploadGiftRewardImage(businessId, result.rewardId, pendingImage);
        if (uploaded.ok) {
          await updateGiftRewardImage(result.rewardId, uploaded.url);
          imageUrl = uploaded.url;
        }
      }
      setRewards((prev) => {
        const next = {
          id: result.rewardId,
          name: form.name.trim(),
          description: form.description.trim() || null,
          imageUrl,
          active: prev.find((r) => r.id === result.rewardId)?.active ?? true,
          visitMilestone: Number(form.visitMilestone),
        };
        const exists = prev.some((r) => r.id === result.rewardId);
        return exists ? prev.map((r) => (r.id === result.rewardId ? next : r)) : [...prev, next];
      });
      setForm(null);
      setPendingImage(null);
    });
  }

  function handleToggleActive(rewardId: string, active: boolean) {
    startTransition(async () => {
      const result = await toggleGiftRewardActive(rewardId, active);
      if (result.ok) {
        setRewards((prev) => prev.map((r) => (r.id === rewardId ? { ...r, active } : r)));
      }
    });
  }

  function handleDelete(rewardId: string) {
    startTransition(async () => {
      const result = await deleteGiftReward(rewardId);
      if (result.ok) {
        setRewards((prev) => prev.filter((r) => r.id !== rewardId));
      }
    });
  }

  return (
    <main className="min-h-screen bg-surface p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Regalos por visita</h1>
          <p className="text-sm text-text-secondary">Premiá a tus clientes al alcanzar una cantidad de visitas.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          Regalo
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {rewards.length === 0 ? (
        <p className="text-sm text-text-secondary">Todavía no creaste ningún regalo por visita.</p>
      ) : (
        <ol className="relative">
          {rewards.map((reward, i) => (
            <li key={reward.id} className="relative flex gap-4 pb-6 last:pb-0">
              {i < rewards.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px ${reward.active ? "bg-primary/30" : "bg-border"}`}
                />
              )}
              <div
                className={`z-10 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full border-2 bg-background text-xs font-semibold leading-none ${
                  reward.active ? "border-primary text-primary" : "border-border text-text-secondary"
                }`}
                title={`A las ${reward.visitMilestone} visitas`}
              >
                <span className="text-sm">{reward.visitMilestone}</span>
                <span className="text-[9px] font-normal">vis.</span>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-background p-3 ring-1 ring-border">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface">
                  {reward.imageUrl ? (
                    <Image src={reward.imageUrl} alt="" fill unoptimized className="object-cover" />
                  ) : (
                    <Gift className="h-5 w-5 text-text-secondary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${reward.active ? "text-text-primary" : "text-text-secondary"}`}>
                    {reward.name}
                  </p>
                  <p className="text-xs text-text-secondary">A las {reward.visitMilestone} visitas</p>
                </div>
                <button
                  onClick={() => handleToggleActive(reward.id, !reward.active)}
                  disabled={isPending}
                  className={reward.active ? "text-primary" : "text-text-secondary"}
                  title={reward.active ? "Desactivar" : "Activar"}
                >
                  {reward.active ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
                <button onClick={() => openEdit(reward)} className="text-text-secondary hover:text-text-primary" title="Editar">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(reward.id)} className="text-text-secondary hover:text-danger" title="Borrar">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {form && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-md rounded-xl bg-background p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-base font-semibold text-text-primary">{form.id ? "Editar regalo" : "Nuevo regalo"}</h2>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <ProductImageUploader image={pendingImage ?? form.imageUrl} onChange={(dataUrl) => setPendingImage(dataUrl)} size="lg" />
                <div className="flex-1">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-secondary">Nombre</span>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="rounded border border-border px-2 py-1.5 text-sm outline-none focus:border-primary"
                    />
                  </label>
                </div>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary">Descripción</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="rounded border border-border px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-secondary">Cantidad de visitas</span>
                <input
                  type="number"
                  min={1}
                  value={form.visitMilestone}
                  onChange={(e) => setForm({ ...form, visitMilestone: e.target.value })}
                  className="w-32 rounded border border-border px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setForm(null)}
                className="rounded px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !form.name.trim()}
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
