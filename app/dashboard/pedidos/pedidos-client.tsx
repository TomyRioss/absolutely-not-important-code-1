"use client";

import { useState, useTransition } from "react";
import {
  HiOutlineClock,
  HiOutlineFire,
  HiOutlineTruck,
  HiOutlineCheckCircle,
  HiXMark,
  HiOutlinePencil,
} from "react-icons/hi2";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { updateOrderStatus, updateOrderItems } from "./actions";
import { EditOrderDialog, type CatalogVariant } from "./edit-order-dialog";

type Order = {
  id: string;
  source: "POS" | "WEB";
  fulfillment: "PICKUP" | "DELIVERY" | "DINE_IN";
  status: "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  total: number;
  createdAt: string;
  customerName: string | null;
  items: { variantId: string; name: string; variantName: string; quantity: number }[];
};

const QUICK_ACTIONS: {
  label: string;
  status: Order["status"];
  icon: typeof HiOutlineFire;
  idleClass: string;
  activeClass: string;
}[] = [
  {
    label: "Preparar",
    status: "PREPARING",
    icon: HiOutlineFire,
    idleClass: "border-amber-200 bg-amber-50/60 text-amber-700",
    activeClass: "border-amber-500 bg-amber-100 text-amber-800",
  },
  {
    label: "Enviado",
    status: "READY",
    icon: HiOutlineTruck,
    idleClass: "border-blue-200 bg-blue-50/60 text-blue-700",
    activeClass: "border-blue-500 bg-blue-100 text-blue-800",
  },
  {
    label: "Completado",
    status: "COMPLETED",
    icon: HiOutlineCheckCircle,
    idleClass: "border-green-200 bg-green-50/60 text-green-700",
    activeClass: "border-green-500 bg-green-100 text-green-800",
  },
];

const KANBAN_COLUMNS: {
  status: Order["status"];
  label: string;
  headerClass: string;
  icon: typeof HiOutlineFire;
}[] = [
  { status: "PENDING", label: "Pendiente", headerClass: "border-border bg-muted text-text-secondary", icon: HiOutlineClock },
  { status: "PREPARING", label: "Preparando", headerClass: "border-amber-200 bg-amber-50 text-amber-700", icon: HiOutlineFire },
  { status: "READY", label: "Enviado", headerClass: "border-blue-200 bg-blue-50 text-blue-700", icon: HiOutlineTruck },
  { status: "COMPLETED", label: "Completado", headerClass: "border-green-200 bg-green-50 text-green-700", icon: HiOutlineCheckCircle },
  { status: "CANCELLED", label: "Cancelado", headerClass: "border-red-200 bg-red-50 text-red-700", icon: HiXMark },
];

function KanbanColumn({
  status,
  label,
  headerClass,
  icon: Icon,
  count,
  children,
}: {
  status: Order["status"];
  label: string;
  headerClass: string;
  icon: typeof HiOutlineFire;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div
        className={`flex shrink-0 items-center justify-between border-b px-4 py-3 text-sm font-semibold ${headerClass}`}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {label}
        </span>
        <span>{count}</span>
      </div>
      <ul
        ref={setNodeRef}
        className={`flex-1 space-y-3 overflow-y-auto p-3 ${isOver ? "bg-accent/40" : ""}`}
      >
        {count === 0 && (
          <li className="rounded-lg border border-dashed border-border p-3 text-xs text-text-secondary">
            Sin pedidos.
          </li>
        )}
        {children}
      </ul>
    </div>
  );
}

function OrderCardContent({
  order,
  isPending,
  onStatusChange,
  onEdit,
  size = "compact",
}: {
  order: Order;
  isPending: boolean;
  onStatusChange: (orderId: string, status: Order["status"]) => void;
  onEdit: (order: Order) => void;
  size?: "compact" | "comfortable";
}) {
  const comfortable = size === "comfortable";
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate font-medium text-text-primary ${comfortable ? "text-base" : ""}`}>
            #{order.id.slice(-8)} · {order.source} · {order.fulfillment}
          </p>
          <p className="text-sm text-text-secondary">
            {order.customerName ?? "Sin cliente"} ·{" "}
            {new Date(order.createdAt).toLocaleString("es-AR")}
          </p>
        </div>
        {order.status === "PENDING" && (
          <Button
            type="button"
            variant="outline"
            size={comfortable ? "icon" : "icon-sm"}
            title="Editar pedido"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onEdit(order)}
          >
            <HiOutlinePencil className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className={`mt-3 grid grid-cols-3 ${comfortable ? "gap-2.5" : "gap-2"}`}>
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.status}
            type="button"
            disabled={isPending}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onStatusChange(order.id, a.status)}
            className={`flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded border transition-colors hover:brightness-95 disabled:cursor-not-allowed ${
              comfortable ? "px-2 py-2.5 text-sm" : "px-2 py-1.5 text-xs"
            } ${order.status === a.status ? a.activeClass : a.idleClass}`}
          >
            <a.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{a.label}</span>
          </button>
        ))}
        <button
          type="button"
          title="Cancelar pedido"
          disabled={isPending}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onStatusChange(order.id, "CANCELLED")}
          className={`col-span-3 flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded border transition-colors hover:brightness-95 disabled:cursor-not-allowed ${
            comfortable ? "px-2 py-2.5 text-sm" : "px-2 py-1.5 text-xs"
          } ${
            order.status === "CANCELLED"
              ? "border-red-500 bg-red-100 text-red-800"
              : "border-red-200 bg-red-50/60 text-red-700"
          }`}
        >
          <HiXMark className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Cancelar</span>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-border pt-2">
        <ul className="text-sm text-text-primary">
          {order.items.map((item, i) => (
            <li key={i}>
              {item.quantity}x {item.name}
            </li>
          ))}
        </ul>
        <p className="font-medium text-text-primary">
          Total: ${formatMoney(order.total)}
        </p>
      </div>
    </>
  );
}

function KanbanCard({
  order,
  isPending,
  onStatusChange,
  onEdit,
}: {
  order: Order;
  isPending: boolean;
  onStatusChange: (orderId: string, status: Order["status"]) => void;
  onEdit: (order: Order) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
  });

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`touch-none cursor-grab rounded-lg border border-border bg-background p-4 shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <OrderCardContent
        order={order}
        isPending={isPending}
        onStatusChange={onStatusChange}
        onEdit={onEdit}
      />
    </li>
  );
}

export function PedidosClient({
  orders: initialOrders,
  catalog,
}: {
  orders: Order[];
  catalog: CatalogVariant[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [mobileStatus, setMobileStatus] = useState<Order["status"]>("PENDING");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleStatusChange(orderId: string, newStatus: Order["status"]) {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, newStatus);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const order = orders.find((o) => o.id === event.active.id);
    setActiveOrder(order ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveOrder(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as Order["status"];
    const order = orders.find((o) => o.id === active.id);
    if (!order || order.status === newStatus) return;
    handleStatusChange(order.id, newStatus);
  }

  function handleItemsSave(
    orderId: string,
    items: { variantId: string; name: string; variantName: string; quantity: number }[],
    total: number,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderItems(
        orderId,
        items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, items, total } : o)),
      );
      setEditingOrder(null);
    });
  }

  return (
    <main className="-m-4 flex h-[calc(100%+2rem)] flex-col bg-surface md:-m-6 md:h-[calc(100%+3rem)]">
      {error && (
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        </div>
      )}

      {/* Desktop / tablet: drag-and-drop kanban */}
      <div className="hidden flex-1 overflow-hidden md:flex">
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="grid flex-1 grid-cols-5 divide-x divide-border overflow-hidden">
                {KANBAN_COLUMNS.map((col) => {
                  const columnOrders = orders.filter((o) => o.status === col.status);
                  return (
                    <KanbanColumn
                      key={col.status}
                      status={col.status}
                      label={col.label}
                      headerClass={col.headerClass}
                      icon={col.icon}
                      count={columnOrders.length}
                    >
                      {columnOrders.map((order) => (
                        <KanbanCard
                          key={order.id}
                          order={order}
                          isPending={isPending}
                          onStatusChange={handleStatusChange}
                          onEdit={setEditingOrder}
                        />
                      ))}
                    </KanbanColumn>
                  );
                })}
              </div>
              <DragOverlay>
                {activeOrder && (
                  <div className="w-72 cursor-grabbing rounded-lg border border-border bg-background p-4 shadow-lg ring-2 ring-primary">
                    <OrderCardContent
                      order={activeOrder}
                      isPending={isPending}
                      onStatusChange={handleStatusChange}
                      onEdit={setEditingOrder}
                    />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>

      {/* Mobile: status tabs + vertical list */}
      <div className="flex flex-1 flex-col overflow-hidden md:hidden">
            <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-surface px-3 py-2.5">
              {KANBAN_COLUMNS.map((col) => {
                const count = orders.filter((o) => o.status === col.status).length;
                const isActive = mobileStatus === col.status;
                return (
                  <button
                    key={col.status}
                    type="button"
                    onClick={() => setMobileStatus(col.status)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? col.headerClass
                        : "border-border bg-background text-text-secondary"
                    }`}
                  >
                    <col.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {col.label}
                    <span
                      className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
                        isActive ? "bg-background/60" : "bg-muted"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <ul className="flex-1 space-y-3 overflow-y-auto p-3">
              {orders.filter((o) => o.status === mobileStatus).length === 0 && (
                <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text-secondary">
                  Sin pedidos en este estado.
                </li>
              )}
              {orders
                .filter((o) => o.status === mobileStatus)
                .map((order) => (
                  <li
                    key={order.id}
                    className="rounded-lg border border-border bg-background p-4 shadow-sm"
                  >
                    <OrderCardContent
                      order={order}
                      isPending={isPending}
                      onStatusChange={handleStatusChange}
                      onEdit={setEditingOrder}
                      size="comfortable"
                    />
                  </li>
                ))}
            </ul>
      </div>

      {editingOrder && (
        <EditOrderDialog
          order={editingOrder}
          catalog={catalog}
          isPending={isPending}
          onSave={(items, total) => handleItemsSave(editingOrder.id, items, total)}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </main>
  );
}
