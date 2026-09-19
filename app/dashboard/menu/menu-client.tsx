"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { FaLink, FaFacebook, FaWhatsapp, FaArrowUpRightFromSquare, FaShareNodes } from "react-icons/fa6";
import { Menu, ChevronDown, ChevronUp, GripVertical, MoreVertical, Plus, Settings2, FoldVertical, UnfoldVertical, Eye, EyeOff, Pencil, Trash2, Copy, FolderInput, Link as LinkIcon, ShoppingBag } from "lucide-react";
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
  createCategory,
  deleteCategory,
  renameCategory,
  reorderCategories,
  saveProduct,
  toggleProductActive,
  toggleProductTakeAway,
  deleteProduct,
  duplicateProduct,
  moveProductCategory,
  updateRestaurant,
  uploadRestaurantAsset,
  uploadProductImage,
  updateProductImage,
  type VariantInput,
} from "./actions";
import { LogoUploader } from "./logo-uploader";
import { BannerUploader } from "./banner-uploader";
import { ProductImageUploader } from "./product-image-uploader";
import { ProductDrawer, type DrawerState } from "./product-drawer";
import type { ModifierGroupData } from "./modifier-groups-editor";

type Variant = { id: string; name: string; price: number; costPrice: number | null; packagingPrice: number | null; sku: string | null; isDefault: boolean };
type Product = { id: string; name: string; description: string | null; active: boolean; takeAway: boolean; price: number; imageUrl: string | null; variants: Variant[]; modifierGroups: ModifierGroupData[] };
type Category = { id: string; name: string; isFeatured: boolean; products: Product[] };

export function MenuClient({
  restaurantId,
  restaurantSlug,
  restaurantName,
  restaurantLogo,
  restaurantBanner,
  categories: initialCategories,
  readOnly = false,
}: {
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  restaurantLogo: string | null;
  restaurantBanner: string | null;
  categories: Category[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const pinFeatured = (list: Category[]) =>
    [...list].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  const [categories, setCategories] = useState(pinFeatured(initialCategories));
  useEffect(() => setCategories(pinFeatured(initialCategories)), [initialCategories]);
  const [name, setName] = useState(restaurantName);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(restaurantBanner);
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

  const [previewKey, setPreviewKey] = useState(0);

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

  function handleCreateCategory() {
    const name = newCategoryName;
    run(() => createCategory(restaurantId, name), () => {
      setCategories((prev) => pinFeatured([...prev, { id: crypto.randomUUID(), name: name.trim(), isFeatured: false, products: [] }]));
      setNewCategoryName("");
      setIsAddingCategory(false);
    });
  }

  function handleRenameCategory(categoryId: string, name: string) {
    if (!name.trim()) return;
    run(() => renameCategory(categoryId, name), () => {
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, name: name.trim() } : c)),
      );
    });
  }

  function handleDeleteCategory(categoryId: string) {
    run(() => deleteCategory(categoryId), () => {
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

  function handleOpenAllCategories() {
    setCollapsedCategoryIds(new Set());
  }

  function handleCloseAllCategories() {
    setCollapsedCategoryIds(new Set(categories.map((c) => c.id)));
  }

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = categories.findIndex((c) => c.id === active.id);
    const toIndex = categories.findIndex((c) => c.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = pinFeatured(arrayMove(categories, fromIndex, toIndex));
    setCategories(next);
    run(() => reorderCategories(next.map((c) => c.id)));
  }

  function handleSaveProduct(input: {
    productId?: string;
    categoryId: string;
    name: string;
    description: string;
    variants: VariantInput[];
    imageDataUrl?: string;
  }) {
    setError(null);
    startTransition(async () => {
      const result = await saveProduct({
        productId: input.productId,
        restaurantId,
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
        const uploaded = await uploadProductImage(restaurantId, result.productId, input.imageDataUrl);
        if (uploaded.ok) await updateProductImage(result.productId, uploaded.url);
      }
      setPreviewKey((k) => k + 1);
      router.refresh();
      setDrawerState(null);
    });
  }

  function handleDuplicateProduct(productId: string) {
    run(() => duplicateProduct(productId), () => router.refresh());
  }

  function handleMoveProductCategory(productId: string, categoryId: string) {
    run(() => moveProductCategory(productId, categoryId), () => router.refresh());
  }

  function handleToggleActive(productId: string, active: boolean) {
    run(() => toggleProductActive(productId, active), () => {
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          products: c.products.map((p) => (p.id === productId ? { ...p, active } : p)),
        })),
      );
    });
  }

  function handleToggleTakeAway(productId: string, takeAway: boolean) {
    run(() => toggleProductTakeAway(productId, takeAway), () => {
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          products: c.products.map((p) => (p.id === productId ? { ...p, takeAway } : p)),
        })),
      );
    });
  }

  async function handleProductImageChange(productId: string, dataUrl: string) {
    setError(null);
    startTransition(async () => {
      const uploaded = await uploadProductImage(restaurantId, productId, dataUrl);
      if (!uploaded.ok) {
        setError(uploaded.error);
        return;
      }
      const result = await updateProductImage(productId, uploaded.url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          products: c.products.map((p) => (p.id === productId ? { ...p, imageUrl: uploaded.url } : p)),
        })),
      );
      setPreviewKey((k) => k + 1);
    });
  }

  const [copiedProductId, setCopiedProductId] = useState<string | null>(null);

  async function handleCopyProductLink(productId: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/menu/${restaurantSlug}#prod-${productId}`);
      setCopiedProductId(productId);
      setTimeout(() => setCopiedProductId(null), 2000);
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  }

  function handleDeleteProduct(productId: string) {
    run(() => deleteProduct(productId), () => {
      setCategories((prev) =>
        prev.map((c) => ({ ...c, products: c.products.filter((p) => p.id !== productId) })),
      );
    });
  }

  const [copied, setCopied] = useState(false);

  function getShareUrl() {
    return `${window.location.origin}/menu/${restaurantSlug}`;
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

  return (
    <main className="min-h-screen bg-surface p-4 md:p-6">
      {readOnly && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary-light px-4 py-3 text-sm font-medium text-primary">
          Tu prueba gratuita terminó. Suscribite para volver a editar el menú.{" "}
          <a href="/dashboard/pricing" className="underline underline-offset-2">
            Mejorá tu plan
          </a>
        </div>
      )}
      <div
        className={readOnly ? "pointer-events-none select-none opacity-60" : undefined}
        aria-disabled={readOnly}
      >
      <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_375px]">
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
                className="w-full max-w-xs border-b border-border bg-transparent font-medium text-text-primary outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

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
                <DropdownMenuItem onClick={handleOpenAllCategories}>
                  <UnfoldVertical className="h-4 w-4" />
                  Abrir todas las categorías
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCloseAllCategories}>
                  <FoldVertical className="h-4 w-4" />
                  Cerrar todas las categorías
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex flex-1 gap-4 overflow-x-auto border-b border-border">
              {categories.map((category, i) => (
                <span
                  key={category.id}
                  className={`shrink-0 border-b-2 px-1 py-2 text-sm font-medium ${
                    i === 0
                      ? "border-primary text-primary"
                      : "border-transparent text-text-primary"
                  }`}
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

        {error && (
          <p className="mb-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-4">
          {categories.length === 0 && (
            <p className="text-sm text-text-secondary">Sin categorías todavía.</p>
          )}
          <DndContext id="categories-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
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
                  {category.products.length}
                </span>
                <button
                  onClick={() => setDrawerState({ mode: "create", categoryId: category.id })}
                  className="order-4 shrink-0 whitespace-nowrap rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary-light sm:order-none"
                >
                  + Producto
                </button>
                {!category.isFeatured && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="order-5 shrink-0 rounded-full p-1 text-text-secondary outline-none hover:bg-background sm:order-none">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDeleteCategory(category.id)}>
                        Borrar categoría
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <button
                  onClick={() => toggleCategoryCollapsed(category.id)}
                  className="order-2 ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-text-secondary hover:text-primary sm:order-none sm:ml-0"
                >
                  {collapsedCategoryIds.has(category.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              </div>

              {!isReordering && !collapsedCategoryIds.has(category.id) && (
              <>
              <ul className="divide-y divide-border">
                {category.products.map((product) => (
                  <li key={product.id} className="flex items-center gap-2 py-2">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setDrawerState({ mode: "edit", product, categoryId: category.id })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDrawerState({ mode: "edit", product, categoryId: category.id });
                        }
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <ProductImageUploader
                        image={product.imageUrl}
                        onChange={(dataUrl) => handleProductImageChange(product.id, dataUrl)}
                      />
                      <div className="min-w-0 max-w-xs">
                        <p className={`truncate text-sm font-medium ${product.active ? "text-text-primary" : "text-text-secondary"}`}>
                          {product.name}
                        </p>
                        {!product.active && (
                          <p className="text-xs font-medium text-danger">Agotado</p>
                        )}
                      </div>
                    </div>
                    <Separator orientation="vertical" className="h-4 !w-px !self-center" />
                    <div className="flex shrink-0 items-center gap-3">
                      <p className="text-sm font-medium text-text-primary">${product.price.toLocaleString("es-AR")}</p>
                      <button
                        onClick={() => handleToggleTakeAway(product.id, !product.takeAway)}
                        disabled={isPending}
                        className={product.takeAway ? "text-primary" : "text-text-secondary"}
                        title={product.takeAway ? "Disponible para take away" : "No disponible para take away"}
                      >
                        <ShoppingBag className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(product.id, !product.active)}
                        disabled={isPending}
                        className={product.active ? "text-primary" : "text-text-secondary"}
                        title={product.active ? "Desactivar" : "Activar"}
                      >
                        {product.active ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded-full p-1 text-text-secondary outline-none hover:bg-background">
                          <MoreVertical className="h-5 w-5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDrawerState({ mode: "edit", product, categoryId: category.id })}>
                            <Pencil className="h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateProduct(product.id)}>
                            <Copy className="h-4 w-4" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem closeOnClick={false} onClick={() => handleCopyProductLink(product.id)}>
                            <LinkIcon className="h-4 w-4" />
                            {copiedProductId === product.id ? "¡Enlace copiado!" : "Copiar enlace"}
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
                                      <DropdownMenuItem
                                        key={c.id}
                                        onClick={() => handleMoveProductCategory(product.id, c.id)}
                                      >
                                        {c.name}
                                      </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Borrar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>

              {category.products.length === 0 && (
                <button
                  type="button"
                  onClick={() => setDrawerState({ mode: "create", categoryId: category.id })}
                  className="flex w-full items-center gap-1.5 py-2 text-sm font-medium text-orange-500 hover:text-orange-600"
                >
                  <Plus className="h-4 w-4" />
                  Añadir producto
                </button>
              )}
              </>
              )}
            </SortableCategoryRow>
          ))}
            </SortableContext>
          </DndContext>
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
            src={`/menu/${restaurantSlug}?v=${previewKey}`}
            className="w-[300px] flex-1"
            title="Vista previa del menú"
          />
        </div>
        <div className="mt-3 flex w-[300px] gap-2">
          <a
            href={`/menu/${restaurantSlug}`}
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
      </div>
      <ProductDrawer
        restaurantId={restaurantId}
        state={drawerState}
        isPending={isPending}
        onClose={() => setDrawerState(null)}
        onSave={handleSaveProduct}
        onImageChange={handleProductImageChange}
        onModifiersSaved={() => router.refresh()}
      />
    </main>
  );
}

function SortableCategoryRow({ categoryId, children }: { categoryId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: categoryId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg bg-surface p-3 transition-opacity ${isDragging ? "opacity-50" : ""}`}
    >
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
