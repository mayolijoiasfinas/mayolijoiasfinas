import { useState, useMemo } from "react";
import { useSearch } from "wouter";
import { useStore } from "@/context/StoreContext";
import { formatBRL, formatDate, isToday } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Search, ShoppingBag, Trash2, History, PlusCircle,
  Edit2, XCircle, AlertTriangle, ChevronDown, ChevronUp
} from "lucide-react";
import { SaleItem, PaymentMethod, Sale } from "@/lib/types";
import { toast } from "sonner";

const PAY_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  credito: 'Cartão de Crédito',
  debito: 'Cartão de Débito',
  fiado: 'Fiado / Crediário',
  outros: 'Outros',
};

type Tab = 'pos' | 'historico';

export function Sales() {
  const { products, customers, sales, addSale, updateSale, updateProduct, settings } = useStore();

  // ── Tab (reads ?tab=historico from URL on mount) ───────────────────────────
  const search = useSearch();
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    new URLSearchParams(search).get('tab') === 'historico' ? 'historico' : 'pos'
  );

  // ── POS state ─────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]               = useState("");
  const [selectedCategory, setSelectedCategory]   = useState<string | null>(null);
  const [cart, setCart]                           = useState<SaleItem[]>([]);
  const [discount, setDiscount]                   = useState(0);
  const [includesPackaging, setIncludesPackaging] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod]         = useState<PaymentMethod>('dinheiro');

  // ── History state ─────────────────────────────────────────────────────────
  const [historySearch, setHistorySearch]         = useState("");
  const [expandedId, setExpandedId]               = useState<number | null>(null);
  const [editSale, setEditSale]                   = useState<Sale | null>(null);
  const [cancelTarget, setCancelTarget]           = useState<Sale | null>(null);

  // Edit modal working copies
  const [editItems, setEditItems]         = useState<SaleItem[]>([]);
  const [editPayment, setEditPayment]     = useState<PaymentMethod>('dinheiro');
  const [editDiscount, setEditDiscount]   = useState(0);
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null);

  // ── POS derived data ──────────────────────────────────────────────────────
  const availableProducts = products.filter(p => p.status !== 'out');
  const categories        = Array.from(new Set(availableProducts.map(p => p.category)));

  const filteredProducts = availableProducts.filter(p => {
    const q = searchTerm.toLowerCase();
    return (
      (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) &&
      (selectedCategory ? p.category === selectedCategory : true)
    );
  });

  const subtotal = cart.reduce((acc, item) => acc + item.salePrice - item.discount, 0);
  const total    = subtotal - discount + (includesPackaging ? settings.packagingCost : 0);

  // ── POS handlers ──────────────────────────────────────────────────────────
  function addToCart(product: typeof products[0]) {
    setCart(prev => [...prev, {
      productId:   product.id,
      productCode: product.code,
      productName: product.name,
      salePrice:   product.salePrice,
      discount:    0,
    }]);
  }

  function removeFromCart(index: number) {
    setCart(prev => prev.filter((_, i) => i !== index));
  }

  function handleCloseSale(isConditional: boolean) {
    if (cart.length === 0) return;
    addSale({
      customerId:              selectedCustomerId ?? undefined,
      customerName:            customers.find(c => c.id === selectedCustomerId)?.name,
      items:                   cart,
      paymentMethod,
      total,
      discount,
      includesPackaging,
      packagingCost:           settings.packagingCost,
      status:                  isConditional ? 'conditional' : 'paid',
      isConditional,
      conditionalReturnDate:   isConditional
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
    });
    setCart([]);
    setDiscount(0);
    setIncludesPackaging(false);
    setSelectedCustomerId(null);
    setPaymentMethod('dinheiro');
    toast.success(isConditional ? 'Condicional registrada com sucesso.' : 'Venda concluída com sucesso.');
  }

  // ── History derived data ──────────────────────────────────────────────────
  const historySales = useMemo(() => {
    const q = historySearch.toLowerCase();
    return [...sales]
      .filter(s => {
        if (!q) return true;
        return (
          (s.customerName || '').toLowerCase().includes(q) ||
          s.items.some(i => i.productName.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, historySearch]);

  const todayCount = sales.filter(
    s => isToday(s.createdAt) && !s.isConditional && s.status !== 'cancelled'
  ).length;

  // ── History: open edit modal ──────────────────────────────────────────────
  function openEdit(s: Sale) {
    setEditSale(s);
    setEditItems([...s.items]);
    setEditPayment(s.paymentMethod);
    setEditDiscount(s.discount ?? 0);
    setEditCustomerId(s.customerId ?? null);
  }

  function removeEditItem(index: number) {
    setEditItems(prev => prev.filter((_, i) => i !== index));
  }

  const editTotal = useMemo(
    () => editItems.reduce((acc, i) => acc + i.salePrice - i.discount, 0) - editDiscount,
    [editItems, editDiscount]
  );

  function handleEditSave() {
    if (!editSale) return;

    // Count original vs new item occurrences per product
    const origCounts: Record<number, number> = {};
    editSale.items.forEach(i => { origCounts[i.productId] = (origCounts[i.productId] || 0) + 1; });
    const newCounts: Record<number, number> = {};
    editItems.forEach(i => { newCounts[i.productId] = (newCounts[i.productId] || 0) + 1; });

    // Restore stock for items that were removed
    Object.keys(origCounts).forEach(idStr => {
      const id   = Number(idStr);
      const diff = (origCounts[id] || 0) - (newCounts[id] || 0);
      if (diff > 0) {
        const p = products.find(p => p.id === id);
        if (p && p.quantity !== null) {
          updateProduct(id, { quantity: p.quantity + diff });
        }
      }
    });

    const customer = customers.find(c => c.id === editCustomerId);
    updateSale(editSale.id, {
      items:        editItems,
      paymentMethod: editPayment,
      discount:     editDiscount,
      total:        editTotal,
      customerId:   editCustomerId ?? undefined,
      customerName: editCustomerId
        ? customer?.name
        : editSale.customerName,
    });

    toast.success('Venda atualizada com sucesso.');
    setEditSale(null);
  }

  // ── History: cancel / void ────────────────────────────────────────────────
  function handleCancelSale() {
    if (!cancelTarget) return;

    // Only restore stock for non-cancelled, non-conditional-active sales
    if (cancelTarget.status !== 'cancelled') {
      cancelTarget.items.forEach(item => {
        const p = products.find(p => p.id === item.productId);
        if (p && p.quantity !== null) {
          updateProduct(p.id, { quantity: p.quantity + 1 });
        }
      });
    }

    updateSale(cancelTarget.id, { status: 'cancelled' });
    toast.success('Venda cancelada e estoque restaurado.');
    setCancelTarget(null);
  }

  // ── Status badge ──────────────────────────────────────────────────────────
  function statusBadge(s: Sale) {
    if (s.status === 'cancelled')
      return <Badge className="bg-[#C94A4A]/10 text-[#C94A4A] border-[#C94A4A]/20 shrink-0">Cancelado</Badge>;
    if (s.isConditional && s.status === 'conditional')
      return <Badge className="bg-blue-500/10 text-blue-700 border-blue-200 shrink-0">Condicional</Badge>;
    if (s.status === 'paid')
      return <Badge className="bg-green-500/10 text-green-700 border-green-200 shrink-0">Pago</Badge>;
    if (s.status === 'pending')
      return <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 shrink-0">Pendente</Badge>;
    return null;
  }

  return (
    <div className="space-y-4">
      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-serif text-primary-foreground">Vendas</h1>
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'pos'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-secondary'
            }`}
            data-testid="tab-nova-venda"
          >
            <PlusCircle className="w-4 h-4" />
            Nova Venda
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-l border-border ${
              activeTab === 'historico'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-secondary'
            }`}
            data-testid="tab-historico"
          >
            <History className="w-4 h-4" />
            Histórico
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: NOVA VENDA (POS)
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pos' && (
        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-11rem)]">
          {/* Left: products */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center gap-4 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou código..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
              <Badge
                variant={selectedCategory === null ? "default" : "secondary"}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setSelectedCategory(null)}
              >
                Todos
              </Badge>
              {categories.map(c => (
                <Badge
                  key={c}
                  variant={selectedCategory === c ? "default" : "secondary"}
                  className="cursor-pointer whitespace-nowrap"
                  onClick={() => setSelectedCategory(c)}
                >
                  {c}
                </Badge>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-4 pb-12 pr-2">
              {filteredProducts.map(p => (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:border-primary transition-colors flex flex-col"
                  onClick={() => addToCart(p)}
                >
                  <div className="aspect-square bg-secondary/50 p-2">
                    {p.photos?.[0]
                      ? <img src={p.photos[0]} alt="" className="w-full h-full object-cover rounded" />
                      : <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ShoppingBag className="w-8 h-8 opacity-20" />
                        </div>
                    }
                  </div>
                  <CardContent className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-muted-foreground">{p.code}</div>
                      <div className="font-serif leading-tight mt-1 line-clamp-2">{p.name}</div>
                    </div>
                    <div className="font-medium text-sm mt-2">{formatBRL(p.salePrice)}</div>
                  </CardContent>
                </Card>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  Nenhum produto encontrado.
                </div>
              )}
            </div>
          </div>

          {/* Right: cart */}
          <div className="w-full md:w-[350px] lg:w-[400px] flex flex-col bg-card border rounded-lg shrink-0 overflow-hidden shadow-sm">
            <div className="p-4 border-b font-serif text-lg font-medium flex items-center gap-2 bg-secondary/30">
              <ShoppingBag className="w-5 h-5" /> Carrinho
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
                  <ShoppingBag className="w-12 h-12 mb-3" />
                  <p className="text-sm">Carrinho vazio</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item, i) => (
                    <div key={i} className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium">{item.productName}</div>
                        <div className="text-xs text-muted-foreground">{item.productCode}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">{formatBRL(item.salePrice)}</span>
                        <button
                          onClick={() => removeFromCart(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-secondary/10 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cliente</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={selectedCustomerId ?? ""}
                  onChange={e => setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Cliente Avulso</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Desconto (R$)</label>
                <Input type="number" min="0" value={discount || ""} onChange={e => setDiscount(Number(e.target.value))} className="h-9" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pagamento</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  {Object.entries(PAY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={includesPackaging}
                  onChange={e => setIncludesPackaging(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Incluir Embalagem Padrão (+{formatBRL(settings.packagingCost)})
              </label>

              <div className="pt-2 border-t flex justify-between items-center">
                <span className="font-serif text-lg">Total</span>
                <span className="font-serif text-2xl text-primary">{formatBRL(total)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" className="w-full" onClick={() => handleCloseSale(true)} disabled={cart.length === 0}>
                  Condicional
                </Button>
                <Button className="w-full" onClick={() => handleCloseSale(false)} disabled={cart.length === 0}>
                  Fechar Venda
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: HISTÓRICO DE VENDAS
         ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'historico' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou produto..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="pl-9 bg-background"
                data-testid="input-history-search"
              />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {todayCount} venda(s) hoje
            </span>
          </div>

          {historySales.length === 0 ? (
            <div className="bg-card border rounded-lg py-16 text-center text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-3 opacity-20" />
              Nenhuma venda registrada ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {historySales.map(s => {
                const isExpanded = expandedId === s.id;
                const isCancelled = s.status === 'cancelled';

                return (
                  <div
                    key={s.id}
                    className={`bg-card border rounded-lg overflow-hidden transition-opacity ${isCancelled ? 'opacity-60' : ''}`}
                    data-testid={`sale-row-${s.id}`}
                  >
                    {/* Summary row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Date + ID */}
                      <div className="shrink-0 text-center w-14">
                        <div className="text-xs text-muted-foreground font-mono">#{s.id}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</div>
                      </div>

                      {/* Customer + items */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {s.customerName || 'Cliente Avulso'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {s.items.map(i => i.productName).join(', ')}
                        </div>
                      </div>

                      {/* Payment + total */}
                      <div className="shrink-0 text-right hidden sm:block">
                        <div className="font-medium text-sm">{formatBRL(s.total)}</div>
                        <div className="text-xs text-muted-foreground">{PAY_LABELS[s.paymentMethod]}</div>
                      </div>

                      {/* Status */}
                      <div className="shrink-0">
                        {statusBadge(s)}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!isCancelled && (
                          <>
                            <button
                              onClick={() => openEdit(s)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                              title="Editar venda"
                              data-testid={`button-edit-sale-${s.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setCancelTarget(s)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-[#C94A4A] hover:bg-[#C94A4A]/10 transition-colors"
                              title="Cancelar venda"
                              data-testid={`button-cancel-sale-${s.id}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary transition-colors"
                          data-testid={`button-expand-${s.id}`}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t bg-secondary/20 px-4 py-3 space-y-2">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                          Itens da venda
                        </div>
                        {s.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              <span className="font-mono text-xs mr-2">{item.productCode}</span>
                              {item.productName}
                            </span>
                            <span>{formatBRL(item.salePrice)}</span>
                          </div>
                        ))}
                        {s.discount > 0 && (
                          <div className="flex justify-between text-sm text-[#C94A4A]">
                            <span>Desconto</span>
                            <span>-{formatBRL(s.discount)}</span>
                          </div>
                        )}
                        {s.includesPackaging && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Embalagem</span>
                            <span>+{formatBRL(s.packagingCost)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium text-sm pt-1 border-t border-border">
                          <span>Total</span>
                          <span>{formatBRL(s.total)}</span>
                        </div>
                        {/* Mobile: show payment here */}
                        <div className="sm:hidden text-xs text-muted-foreground">
                          Pagamento: {PAY_LABELS[s.paymentMethod]}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          EDIT SALE MODAL
         ══════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!editSale} onOpenChange={v => { if (!v) setEditSale(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="modal-edit-sale">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Editar Venda #{editSale?.id}</DialogTitle>
          </DialogHeader>

          {editSale && (
            <div className="space-y-5 py-1">
              {/* Items */}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Itens — clique no lixo para remover e restaurar ao estoque
                </label>
                {editItems.length === 0 ? (
                  <div className="text-sm text-[#C94A4A] bg-[#C94A4A]/10 rounded-md p-3">
                    Nenhum item. A venda ficará zerada.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editItems.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/20"
                        data-testid={`edit-item-${i}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.productCode} · {formatBRL(item.salePrice)}</div>
                        </div>
                        <button
                          onClick={() => removeEditItem(i)}
                          className="text-muted-foreground hover:text-[#C94A4A] transition-colors shrink-0"
                          data-testid={`button-remove-edit-item-${i}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer */}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cliente</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={editCustomerId ?? ""}
                  onChange={e => setEditCustomerId(e.target.value ? Number(e.target.value) : null)}
                  data-testid="select-edit-customer"
                >
                  <option value="">Cliente Avulso</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Payment */}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Forma de Pagamento</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={editPayment}
                  onChange={e => setEditPayment(e.target.value as PaymentMethod)}
                  data-testid="select-edit-payment"
                >
                  {Object.entries(PAY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Discount */}
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Desconto (R$)</label>
                <Input
                  type="number"
                  min="0"
                  value={editDiscount || ""}
                  onChange={e => setEditDiscount(Number(e.target.value))}
                  data-testid="input-edit-discount"
                />
              </div>

              {/* New total preview */}
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-muted-foreground text-sm">Novo total</span>
                <span className="font-serif text-xl text-primary">{formatBRL(editTotal)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditSale(null)}>Cancelar</Button>
            <Button onClick={handleEditSave} data-testid="button-save-edit-sale">
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════
          CANCEL CONFIRMATION MODAL
         ══════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!cancelTarget} onOpenChange={v => { if (!v) setCancelTarget(null); }}>
        <DialogContent className="sm:max-w-sm" data-testid="modal-cancel-sale">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2 text-[#C94A4A]">
              <AlertTriangle className="w-5 h-5" />
              Cancelar Venda #{cancelTarget?.id}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta ação irá <strong className="text-foreground">cancelar a venda</strong> e devolver automaticamente os produtos ao estoque. A operação não pode ser desfeita.
            </p>
            {cancelTarget && (
              <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Itens que serão restaurados</div>
                {cancelTarget.items.map((item, i) => (
                  <div key={i} className="text-sm flex justify-between">
                    <span>{item.productName}</span>
                    <span className="text-muted-foreground">{formatBRL(item.salePrice)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Manter Venda
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSale}
              data-testid="button-confirm-cancel-sale"
            >
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
