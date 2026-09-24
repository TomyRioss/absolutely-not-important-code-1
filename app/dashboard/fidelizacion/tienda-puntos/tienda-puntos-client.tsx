"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Menu, ChevronDown, ChevronUp, GripVertical, MoreVertical, Plus, FoldVertical, UnfoldVertical, Eye, EyeOff, Pencil, Copy, FolderInput, Trash2, Settings2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createRewardCategory,
  renameRewardCategory,
  reorderRewardCategories,
  deleteRewardCategory,
  saveReward,
  toggleRewardActive,
  deleteReward,
  duplicateReward,
  moveRewardCategory,
  uploadRewardImage,
  updateRewardImage,
  type RewardVariantInput,
} from "./actions";
import { ProductImageUploader } from "@/app/dashboard/menu/product-image-uploader";
import { RewardDrawer, type DrawerState } from "./reward-drawer";
import type { RewardModifierGroupData } from "./reward-modifier-groups-editor";

type Variant = { id: string; name: string; pointsCost: number; costPrice: number | null; packagingPrice: number | null; sku: string | null; isDefault: boolean };
type Reward = { id: string; name: string; description: string | null; active: boolean; pointsCost: number; imageUrl: string | null; variants: Variant[]; modifierGroups: RewardModifierGroupData[] };
type Category = { id: string; name: string; isFeatured: boolean; rewards: Reward[] };

export function TiendaPuntosClient({
  businessId,
  categories: initialCategories,
}: {
  businessId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const pinFeatured = (list: Category[]) =>
    [...list].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  const [categories, setCategories] = useState(pinFeatured(initialCategories));
  useEffect(() => {
    const id = setTimeout(() => setCategories(pinFeatured(initialCategories)), 0);
    return () => clearTimeout(id);
  }, [initialCategories]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(new Set());
  const [isReordering, setIsReordering] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );
  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onOk?.();
    });
  }

  function handleCreateCategory() {
    const name = newCategoryName;
    run(() => createRewardCategory(businessId, name), () => {
      setCategories((prev) => pinFeatured([...prev, { id: crypto.randomUUID(), name: name.trim(), isFeatured: false, rewards: [] }]));
      setNewCategoryName("");
      setIsAddingCategory(false);
    });
  }

  function handleRenameCategory(categoryId: string, name: string) {
    if (!name.trim()) return;
    run(() => renameRewardCategory(categoryId, name), () => {
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, name: name.trim() } : c)));
    });
  }

  function handleDeleteCategory(categoryId: string) {
    run(() => deleteRewardCategory(categoryId), () => {
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    });
  }

  function toggleCategoryCollapsed(categoryId: string) {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = categories.findIndex((c) => c.id === active.id);
    const toIndex = categories.findIndex((c) => c.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = pinFeatured(arrayMove(categories, fromIndex, toIndex));
    setCategories(next);
    run(() => reorderRewardCategories(next.map((c) => c.id)));
  }

  function handleSaveReward(input: { rewardId?: string; categoryId: string; name: string; description: string; variants: RewardVariantInput[]; imageDataUrl?: string; importedImageUrl?: string }) {
    setError(null);
    startTransition(async () => {
      const result = await saveReward({
        rewardId: input.rewardId,
        businessId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        variants: input.variants,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (input.imageDataUrl) {
        const uploaded = await uploadRewardImage(businessId, result.rewardId, input.imageDataUrl);
        if (uploaded.ok) await updateRewardImage(result.rewardId, uploaded.url);
      } else if (input.importedImageUrl) {
        await updateRewardImage(result.rewardId, input.importedImageUrl);
      }
      router.refresh();
      setDrawerState(null);
    });
  }

  function handleDuplicateReward(rewardId: string) {
    run(() => duplicateReward(rewardId), () => router.refresh());
  }

  function handleMoveRewardCategory(rewardId: string, categoryId: string) {
    run(() => moveRewardCategory(rewardId, categoryId), () => router.refresh());
  }

  function handleToggleActive(rewardId: string, active: boolean) {
    run(() => toggleRewardActive(rewardId, active), () => {
      setCategories((prev) => prev.map((c) => ({ ...c, rewards: c.rewards.map((r) => (r.id === rewardId ? { ...r, active } : r)) })));
    });
  }

  async function handleRewardImageChange(rewardId: string, dataUrl: string) {
    setError(null);
    startTransition(async () => {
      const uploaded = await uploadRewardImage(businessId, rewardId, dataUrl);
      if (!uploaded.ok) {
        setError(uploaded.error);
        return;
      }
      const result = await updateRewardImage(rewardId, uploaded.url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCategories((prev) => prev.map((c) => ({ ...c, rewards: c.rewards.map((r) => (r.id === rewardId ? { ...r, imageUrl: uploaded.url } : r)) })));
    });
  }

  function handleDeleteReward(rewardId: string) {
    run(() => deleteReward(rewardId), () => {
      setCategories((prev) => prev.map((c) => ({ ...c, rewards: c.rewards.filter((r) => r.id !== rewardId) })));
    });
  }

  return (
    <main className="min-h-screen bg-surface p-4 md:p-6">
      <h1 className="mb-4 text-lg font-semibold text-text-primary">Tienda de puntos</h1>

      {categories.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex shrink-0 items-center gap-1.5 rounded-md bg-orange-500 px-3 py-2 text-sm font-medium text-white outline-none hover:bg-orange-600">
              <Menu className="h-4 w-4" />
              Categorías
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              <DropdownMenuItem
                onClick={() => {
                  setIsAddingCategory(true);
                  requestAnimationFrame(() => newCategoryInputRef.current?.focus());
                }}
              >
                <Plus className="h-4 w-4" />
                Crear categoría
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsReordering((prev) => !prev)}>
                <Settings2 className="h-4 w-4" />
                {isReordering ? "Terminar de configurar" : "Configurar categorías"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCollapsedCategoryIds(new Set())}>
                <UnfoldVertical className="h-4 w-4" />
                Abrir todas las categorías
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCollapsedCategoryIds(new Set(categories.map((c) => c.id)))}>
                <FoldVertical className="h-4 w-4" />
                Cerrar todas las categorías
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex flex-1 gap-4 overflow-x-auto border-b border-border">
            {categories.map((category) => (
              <span
                key={category.id}
                className={`shrink-0 border-b-2 px-1 py-2 text-sm font-medium ${category.isFeatured ? "border-primary text-primary" : "border-transparent text-text-primary"}`}
              >
                {category.name}
              </span>
            ))}
            {isAddingCategory ? (
              <input
                ref={newCategoryInputRef}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onBlur={() => {
                  if (!newCategoryName.trim()) setIsAddingCategory(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateCategory();
                  if (e.key === "Escape") {
                    setNewCategoryName("");
                    setIsAddingCategory(false);
                  }
                }}
                placeholder="Nueva categoría"
                disabled={isPending}
                className="w-32 shrink-0 rounded border border-border px-2 py-1 text-sm outline-none focus:border-primary"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAddingCategory(true);
                  requestAnimationFrame(() => newCategoryInputRef.current?.focus());
                }}
                className="flex shrink-0 items-center gap-1 px-1 py-2 text-sm font-medium text-orange-500 hover:text-orange-600"
              >
                <Plus className="h-4 w-4" />
                Añadir categoría
              </button>
            )}
          </div>
        </div>
      )}

      {categories.length === 0 && !isAddingCategory && (
        <button
          type="button"
          onClick={() => setIsAddingCategory(true)}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-orange-500 hover:text-orange-600"
        >
          <Plus className="h-4 w-4" /> Crear tu primera categoría de premios
        </button>
      )}
      {categories.length === 0 && isAddingCategory && (
        <div className="mb-4 flex items-center gap-2">
          <input
            ref={newCategoryInputRef}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
            placeholder="Nombre de la categoría"
            autoFocus
            className="rounded border border-border px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
          <button onClick={handleCreateCategory} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white">
            Crear
          </button>
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-4">
        <DndContext id="reward-categories-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {categories.map((category) => (
              <SortableCategoryRow key={category.id} categoryId={category.id}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:flex-nowrap sm:gap-3">
                  <div className="min-w-0 flex-1 basis-36">
                    <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                      Nombre de categoría
                      {category.isFeatured && (
                        <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">
                          Destacada
                        </span>
                      )}
                    </p>
                    <input
                      defaultValue={category.name}
                      onBlur={(e) => handleRenameCategory(category.id, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      className="w-full truncate border-b border-border bg-transparent pb-0.5 font-medium text-text-primary outline-none focus:border-primary"
                    />
                  </div>
                  <span className="order-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-medium text-text-secondary sm:order-none">
                    {category.rewards.length}
                  </span>
                  <button
                    onClick={() => setDrawerState({ mode: "create", categoryId: category.id })}
                    className="order-4 shrink-0 whitespace-nowrap rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary-light sm:order-none"
                  >
                    + Premio
                  </button>
                  {!category.isFeatured && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="order-5 shrink-0 rounded-full p-1 text-text-secondary outline-none hover:bg-background sm:order-none">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDeleteCategory(category.id)}>Borrar categoría</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <button
                    onClick={() => toggleCategoryCollapsed(category.id)}
                    className="order-2 ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-text-secondary hover:text-primary sm:order-none sm:ml-0"
                  >
                    {collapsedCategoryIds.has(category.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </button>
                </div>

                {!isReordering && !collapsedCategoryIds.has(category.id) && (
                  <>
                    <ul className="divide-y divide-border">
                      {category.rewards.map((reward) => (
                        <li key={reward.id} className="flex items-center gap-2 py-2">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setDrawerState({ mode: "edit", reward, categoryId: category.id })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setDrawerState({ mode: "edit", reward, categoryId: category.id });
                              }
                            }}
                            className="flex min-w-0 items-center gap-3 text-left"
                          >
                            <ProductImageUploader image={reward.imageUrl} onChange={(dataUrl) => handleRewardImageChange(reward.id, dataUrl)} />
                            <div className="min-w-0 max-w-xs">
                              <p className={`truncate text-sm font-medium ${reward.active ? "text-text-primary" : "text-text-secondary"}`}>
                                {reward.name}
                              </p>
                              {!reward.active && <p className="text-xs font-medium text-danger">No disponible</p>}
                            </div>
                          </div>
                          <Separator orientation="vertical" className="h-4 !w-px !self-center" />
                          <div className="flex shrink-0 items-center gap-3">
                            <p className="text-sm font-medium text-text-primary">{reward.pointsCost.toLocaleString("es-AR")} pts</p>
                            <button
                              onClick={() => handleToggleActive(reward.id, !reward.active)}
                              disabled={isPending}
                              className={reward.active ? "text-primary" : "text-text-secondary"}
                              title={reward.active ? "Desactivar" : "Activar"}
                            >
                              {reward.active ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="rounded-full p-1 text-text-secondary outline-none hover:bg-background">
                                <MoreVertical className="h-5 w-5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDrawerState({ mode: "edit", reward, categoryId: category.id })}>
                                  <Pencil className="h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicateReward(reward.id)}>
                                  <Copy className="h-4 w-4" />
                                  Duplicar
                                </DropdownMenuItem>
                                {categories.length > 1 && (
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      <FolderInput className="h-4 w-4" />
                                      Mover a categoría...
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuPortal>
                                      <DropdownMenuSubContent>
                                        {categories
                                          .filter((c) => c.id !== category.id)
                                          .map((c) => (
                                            <DropdownMenuItem key={c.id} onClick={() => handleMoveRewardCategory(reward.id, c.id)}>
                                              {c.name}
                                            </DropdownMenuItem>
                                          ))}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuPortal>
                                  </DropdownMenuSub>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => handleDeleteReward(reward.id)}>
                                  <Trash2 className="h-4 w-4" />
                                  Borrar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </li>
                      ))}
                    </ul>

                    {category.rewards.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setDrawerState({ mode: "create", categoryId: category.id })}
                        className="flex w-full items-center gap-1.5 py-2 text-sm font-medium text-orange-500 hover:text-orange-600"
                      >
                        <Plus className="h-4 w-4" />
                        Añadir premio
                      </button>
                    )}
                  </>
                )}
              </SortableCategoryRow>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <RewardDrawer
        businessId={businessId}
        state={drawerState}
        isPending={isPending}
        onClose={() => setDrawerState(null)}
        onSave={handleSaveReward}
        onImageChange={handleRewardImageChange}
        onModifiersSaved={() => router.refresh()}
      />
    </main>
  );
}

function SortableCategoryRow({ categoryId, children }: { categoryId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: categoryId });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`rounded-lg bg-surface p-3 transition-opacity ${isDragging ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-1 shrink-0 touch-none cursor-grab text-text-secondary active:cursor-grabbing"
          title="Arrastrar para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
