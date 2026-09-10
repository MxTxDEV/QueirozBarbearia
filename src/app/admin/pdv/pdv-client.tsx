"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2, Scissors, Package, CalendarClock, X } from "lucide-react";
import { createSaleAction, cancelSaleAction } from "@/actions/pdv";
import { formatCurrency, formatTime, cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentMethod } from "@prisma/client";

type Barber = { id: string; name: string };
type CatalogItem = { id: string; name: string; price: number; durationMinutes?: number };
type Appointment = {
  id: string;
  customerId: string;
  customerName: string;
  barberId: string;
  barberName: string;
  startTime: string;
  serviceIds: string[];
  serviceNames: string;
};
type Customer = { id: string; fullName: string; whatsapp: string };
type TodaySale = {
  id: string;
  barberName: string;
  customerName: string | null;
  itemsLabel: string;
  total: number;
  discount: number;
  paymentMethod: string;
  status: string;
  soldAt: string;
};
type Summary = { salesCount: number; cancelledCount: number; totalRevenue: number; totalDiscount: number; byMethod: Record<string, number> };

type CartLine = { type: "SERVICE" | "PRODUCT"; id: string; name: string; unitPrice: number; quantity: number };

const PAYMENT_METHODS: PaymentMethod[] = ["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD", "OTHER"];

export function PdvClient({
  barbers,
  services,
  products,
  todayAppointments,
  customers,
  summary,
  todaySales,
  lockedBarberId,
}: {
  barbers: Barber[];
  services: CatalogItem[];
  products: CatalogItem[];
  todayAppointments: Appointment[];
  customers: Customer[];
  summary: Summary;
  todaySales: TodaySale[];
  lockedBarberId?: string;
}) {
  const [barberId, setBarberId] = useState(lockedBarberId ?? "");
  const [customerId, setCustomerId] = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountInput, setDiscountInput] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [pending, startTransition] = useTransition();
  const [catalogTab, setCatalogTab] = useState<"SERVICE" | "PRODUCT">("SERVICE");

  const barberAppointments = todayAppointments.filter((a) => !barberId || a.barberId === barberId);

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const discount = Math.min(Math.max(0, Number(discountInput) || 0), subtotal);
  const total = Math.max(0, subtotal - discount);

  function addToCart(type: "SERVICE" | "PRODUCT", item: CatalogItem) {
    setCart((prev) => {
      const existing = prev.find((l) => l.type === type && l.id === item.id);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { type, id: item.id, name: item.name, unitPrice: item.price, quantity: 1 }];
    });
  }

  function changeQuantity(type: "SERVICE" | "PRODUCT", id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.type === type && l.id === id ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(type: "SERVICE" | "PRODUCT", id: string) {
    setCart((prev) => prev.filter((l) => !(l.type === type && l.id === id)));
  }

  function startFromAppointment(appt: Appointment) {
    setBarberId(appt.barberId);
    setCustomerId(appt.customerId);
    setAppointmentId(appt.id);
    const lines: CartLine[] = appt.serviceIds
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is CatalogItem => !!s)
      .map((s) => ({ type: "SERVICE" as const, id: s.id, name: s.name, unitPrice: s.price, quantity: 1 }));
    setCart(lines);
  }

  function resetCart() {
    setCart([]);
    setDiscountInput("0");
    setPaymentMethod("PIX");
    setAppointmentId(null);
    setCustomerId("");
    if (!lockedBarberId) setBarberId("");
  }

  function finalizeSale() {
    if (!barberId || cart.length === 0) return;
    startTransition(async () => {
      const result = await createSaleAction({
        barberId,
        customerId: customerId || undefined,
        appointmentId: appointmentId || undefined,
        items: cart.map((l) => ({ type: l.type, id: l.id, quantity: l.quantity })),
        discount,
        paymentMethod,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Venda fechada — ${formatCurrency(total)}`);
      resetCart();
    });
  }

  function cancelSale(id: string) {
    startTransition(async () => {
      const result = await cancelSaleAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Venda cancelada.");
    });
  }

  const catalog = catalogTab === "SERVICE" ? services : products;

  return (
    <div className="space-y-6 pb-32 lg:pb-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">PDV</h1>
        <p className="text-sm text-foreground-muted">Registre atendimentos e vendas rapidamente no balcão.</p>
      </div>

      {/* Resumo do dia */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-foreground-muted">Faturamento hoje</p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-foreground-muted">Vendas</p>
            <p className="text-lg font-semibold text-foreground">{summary.salesCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-foreground-muted">Descontos</p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(summary.totalDiscount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-foreground-muted">Cancelamentos</p>
            <p className="text-lg font-semibold text-foreground">{summary.cancelledCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-3">
          {/* Barbeiro + cliente */}
          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Barbeiro</Label>
                <Select
                  value={barberId}
                  onChange={(e) => setBarberId(e.target.value)}
                  disabled={!!lockedBarberId}
                  aria-label="Barbeiro responsável"
                >
                  <option value="">Selecione</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cliente (opcional)</Label>
                <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-label="Cliente">
                  <option value="">Avulso / não identificado</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} — {c.whatsapp}
                    </option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Agendamentos de hoje — atalho */}
          {barberAppointments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CalendarClock className="h-4 w-4" /> Agendamentos de hoje
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 p-4 pt-0">
                {barberAppointments.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => startFromAppointment(a)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                      appointmentId === a.id ? "border-secondary bg-secondary/15" : "bg-[var(--surface-subtle)] hover:bg-[var(--surface-subtle-hover)]"
                    )}
                  >
                    <p className="font-medium text-foreground">{formatTime(a.startTime)} · {a.customerName}</p>
                    <p className="text-foreground-muted">{a.barberName} · {a.serviceNames || "sem serviço"}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Catálogo */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <div className="inline-flex items-center gap-1 rounded-full border p-1">
                <button
                  type="button"
                  onClick={() => setCatalogTab("SERVICE")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
                    catalogTab === "SERVICE" ? "bg-secondary-dark text-white" : "text-foreground-muted"
                  )}
                >
                  <Scissors className="h-3.5 w-3.5" /> Serviços
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogTab("PRODUCT")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
                    catalogTab === "PRODUCT" ? "bg-secondary-dark text-white" : "text-foreground-muted"
                  )}
                >
                  <Package className="h-3.5 w-3.5" /> Produtos
                </button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 p-4 pt-0 sm:grid-cols-2">
              {catalog.length === 0 && (
                <p className="col-span-2 py-4 text-center text-sm text-foreground-muted">
                  {catalogTab === "SERVICE" ? "Nenhum serviço cadastrado." : "Nenhum produto cadastrado."}
                </p>
              )}
              {catalog.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(catalogTab, item)}
                  className="flex items-center justify-between rounded-xl border bg-[var(--surface-subtle)] p-3 text-left text-sm transition-colors hover:bg-[var(--surface-subtle-hover)]"
                >
                  <span className="text-foreground">{item.name}</span>
                  <span className="font-medium text-secondary-light">{formatCurrency(item.price)}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Vendas de hoje */}
          {todaySales.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Vendas de hoje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0">
                {todaySales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border p-2.5 text-sm">
                    <div className="min-w-0">
                      <p className={cn("truncate font-medium", s.status === "CANCELLED" ? "text-foreground-muted line-through" : "text-foreground")}>
                        {s.itemsLabel || "Venda"}
                      </p>
                      <p className="truncate text-xs text-foreground-muted">
                        {s.barberName}{s.customerName ? ` · ${s.customerName}` : ""} · {PAYMENT_METHOD_LABEL[s.paymentMethod]}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-medium text-foreground">{formatCurrency(s.total)}</span>
                      {s.status === "COMPLETED" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => cancelSale(s.id)}
                          className="text-foreground-muted hover:text-danger disabled:opacity-50"
                          aria-label="Cancelar venda"
                          title="Cancelar venda"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Carrinho */}
        <div className="lg:col-span-2">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle>Carrinho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="py-6 text-center text-sm text-foreground-muted">Adicione serviços ou produtos ao carrinho.</p>
              ) : (
                <div className="space-y-2">
                  {cart.map((line) => (
                    <div key={`${line.type}-${line.id}`} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-foreground">{line.name}</p>
                        <p className="text-xs text-foreground-muted">{formatCurrency(line.unitPrice)} cada</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => changeQuantity(line.type, line.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-4 text-center text-foreground">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(line.type, line.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(line.type, line.id)}
                          className="ml-1 text-foreground-muted hover:text-danger"
                          aria-label="Remover item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 border-t pt-3">
                <div className="flex items-center justify-between text-sm">
                  <Label htmlFor="discount">Desconto (R$)</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    className="h-8 w-28 text-right"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Forma de pagamento</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                        paymentMethod === m ? "border-secondary bg-secondary/15 text-foreground" : "text-foreground-muted hover:bg-[var(--surface-subtle-hover)]"
                      )}
                    >
                      {PAYMENT_METHOD_LABEL[m]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between text-foreground-muted">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-foreground-muted">
                  <span>Desconto</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-foreground">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                disabled={pending || !barberId || cart.length === 0}
                onClick={finalizeSale}
              >
                {pending ? "Fechando..." : "Finalizar venda"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
