import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import { formatBRL, isToday, isThisMonth, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { useLocation } from "wouter";
import { PlusCircle, Package, RotateCcw, ShoppingBag, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SaleItem } from "@/lib/types";

type ItemDecision = 'returned' | 'purchased';

export function Home() {
  const { sales, products, customers, expenses, settings, updateSale, updateProduct, addSale, addExpense } = useStore();
  const [, setLocation] = useLocation();

  // ── Quick expense modal ───────────────────────────────────────────────────
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Reconciliation modal ──────────────────────────────────────────────────
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileSaleId, setReconcileSaleId] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<Record<number, ItemDecision>>({});
  const [reconcilePayment, setReconcilePayment] = useState<'dinheiro' | 'pix' | 'credito' | 'debito' | 'fiado' | 'outros'>('dinheiro');
  const [reconciling, setReconciling] = useState(false);

  // ── Derived data ──────────────────────────────────────────────────────────
  const todaySales = sales.filter(s => isToday(s.createdAt) && !s.isConditional && s.status !== 'cancelled');
  const totalVendasHoje = todaySales.reduce((acc, s) => acc + s.total, 0);
  const todayExpenses = expenses.filter(e => isToday(e.date)).reduce((acc, e) => acc + e.amount, 0);

  // ── Stock metrics (real-time, recomputed on every product change) ────────────
  const totalPieces  = products.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
  const availableQty = products.filter(p => p.status === 'available').length;
  const endingQty    = products.filter(p => p.status === 'ending').length;
  const outQty       = products.filter(p => p.status === 'out').length;
  const untrackedQty = products.filter(p => p.status === 'untracked').length;
  // "Disponíveis" for the card means SKUs with any stock (available + ending)
  const inStockSkus  = availableQty + endingQty;

  const birthdaysThisMonth = customers.filter(c => c.birthday && isThisMonth(c.birthday));

  const unpaidInstallments = sales
    .flatMap(s =>
      (s.installments || []).map((inst, index) => ({
        saleId: s.id,
        customerName: s.customerName,
        ...inst,
        index,
      }))
    )
    .filter(i => !i.paid)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const activeCond = sales
    .filter(s => s.isConditional && s.status === 'conditional')
    .sort((a, b) => new Date(a.conditionalReturnDate!).getTime() - new Date(b.conditionalReturnDate!).getTime());

  // ── Handlers: quick expense ───────────────────────────────────────────────
  function openExpenseModal() {
    setExpenseDesc('');
    setExpenseAmount('');
    setExpenseOpen(true);
  }

  function handleSaveExpense() {
    const desc = expenseDesc.trim();
    const raw = expenseAmount.replace(',', '.').replace(/[^\d.]/g, '');
    const amount = parseFloat(raw);
    if (!desc) { toast.error('Informe o nome da despesa.'); return; }
    if (!raw || isNaN(amount) || amount <= 0) { toast.error('Informe um valor válido.'); return; }
    setSaving(true);
    addExpense({ description: desc, amount, date: new Date().toISOString(), category: 'Geral' });
    toast.success(`Despesa "${desc}" registrada: ${formatBRL(amount)}`);
    setSaving(false);
    setExpenseOpen(false);
  }

  function handleDarBaixa(saleId: number, index: number) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale || !sale.installments) return;
    const newInstallments = [...sale.installments];
    newInstallments[index] = { ...newInstallments[index], paid: true, paidAt: new Date().toISOString() };
    const allPaid = newInstallments.every(i => i.paid);
    updateSale(saleId, { installments: newInstallments, status: allPaid ? 'paid' : sale.status });
  }

  // ── Handlers: reconciliation ──────────────────────────────────────────────
  function openReconcile(saleId: number) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    // Default: all items marked as returned
    const initial: Record<number, ItemDecision> = {};
    sale.items.forEach((_, i) => { initial[i] = 'returned'; });
    setDecisions(initial);
    setReconcilePayment('dinheiro');
    setReconcileSaleId(saleId);
    setReconcileOpen(true);
  }

  function toggleDecision(idx: number, val: ItemDecision) {
    setDecisions(prev => ({ ...prev, [idx]: val }));
  }

  function handleReconcile() {
    if (reconcileSaleId === null) return;
    const sale = sales.find(s => s.id === reconcileSaleId);
    if (!sale) return;
    setReconciling(true);

    const returnedItems: SaleItem[] = [];
    const purchasedItems: SaleItem[] = [];

    sale.items.forEach((item, i) => {
      if (decisions[i] === 'returned') returnedItems.push(item);
      else purchasedItems.push(item);
    });

    // Restore stock for returned items
    returnedItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product || product.quantity === null) return;
      const newQty = product.quantity + 1;
      let newStatus: 'available' | 'ending' | 'out' | 'untracked' = 'available';
      if ((product.initialQuantity || 0) > 1 && newQty === 1) newStatus = 'ending';
      updateProduct(item.productId, { quantity: newQty, status: newStatus });
    });

    // Close the conditional sale (mark as resolved)
    updateSale(reconcileSaleId, { status: 'paid', isConditional: false });

    // Create a new real sale for purchased items if any
    if (purchasedItems.length > 0) {
      const newTotal = purchasedItems.reduce((acc, i) => acc + i.salePrice - i.discount, 0);
      addSale({
        customerId: sale.customerId,
        customerName: sale.customerName,
        items: purchasedItems,
        paymentMethod: reconcilePayment,
        total: newTotal,
        discount: 0,
        includesPackaging: false,
        packagingCost: 0,
        status: 'paid',
        isConditional: false,
      });
    }

    const returnedCount  = returnedItems.length;
    const purchasedCount = purchasedItems.length;
    const msg = [
      purchasedCount > 0 && `${purchasedCount} peça(s) vendida(s)`,
      returnedCount  > 0 && `${returnedCount} devolvida(s) ao estoque`,
    ].filter(Boolean).join(' · ');
    toast.success(`Condicional encerrada — ${msg}`);

    setReconciling(false);
    setReconcileOpen(false);
    setReconcileSaleId(null);
  }

  const reconcileSale = reconcileSaleId !== null ? sales.find(s => s.id === reconcileSaleId) : null;
  const purchasedTotal = reconcileSale
    ? reconcileSale.items
        .filter((_, i) => decisions[i] === 'purchased')
        .reduce((acc, item) => acc + item.salePrice - item.discount, 0)
    : 0;

  function daysUntil(iso: string) {
    const diff = new Date(iso).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-serif text-primary-foreground">Visão Geral</h1>
        <Button onClick={openExpenseModal} className="gap-2 shrink-0" data-testid="button-quick-expense">
          <PlusCircle className="w-4 h-4" />
          Lançar Despesa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Block 1 — Vendas Hoje (clickable → history) */}
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setLocation('/vendas?tab=historico')}
          data-testid="card-vendas-hoje"
        >
          <CardHeader>
            <CardTitle className="text-lg font-serif flex items-center justify-between">
              Vendas Hoje
              <span className="text-xs font-normal text-muted-foreground normal-case tracking-normal">
                Ver histórico
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-light text-primary-foreground">{formatBRL(totalVendasHoje)}</div>
            <p className="text-sm text-muted-foreground mt-2">{todaySales.length} venda(s) registrada(s) hoje</p>
            {todayExpenses > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Despesas hoje:{' '}
                <span className="text-[#C94A4A] font-medium">{formatBRL(todayExpenses)}</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Block 2 — Resumo do Estoque */}
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setLocation('/estoque')}
          data-testid="card-stock-summary"
        >
          <CardHeader>
            <CardTitle className="text-lg font-serif flex items-center justify-between">
              Resumo do Estoque
              <span className="text-xs font-normal text-muted-foreground normal-case tracking-normal">
                Ver estoque
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem produtos cadastrados</p>
            ) : (
              <>
                {/* Total em Estoque — destaque principal */}
                <div className="flex items-end justify-between border-b border-border pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total em Estoque</p>
                    <p className="text-4xl font-light text-primary-foreground">{totalPieces}</p>
                    <p className="text-xs text-muted-foreground mt-1">peça(s) registrada(s)</p>
                  </div>
                  {untrackedQty > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{untrackedQty} não controlado(s)</p>
                    </div>
                  )}
                </div>

                {/* Métricas secundárias */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-green-500/10 border border-green-200 p-3 text-center">
                    <p className="text-2xl font-semibold text-green-700">{inStockSkus}</p>
                    <p className="text-[11px] text-green-700/80 mt-0.5 leading-tight">Disponíveis</p>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 border border-amber-200 p-3 text-center">
                    <p className="text-2xl font-semibold text-amber-700">{endingQty}</p>
                    <p className="text-[11px] text-amber-700/80 mt-0.5 leading-tight">Acabando</p>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${outQty > 0 ? 'bg-[#C94A4A]/10 border border-[#C94A4A]/20' : 'bg-secondary border border-border'}`}>
                    <p className={`text-2xl font-semibold ${outQty > 0 ? 'text-[#C94A4A]' : 'text-muted-foreground'}`}>{outQty}</p>
                    <p className={`text-[11px] mt-0.5 leading-tight ${outQty > 0 ? 'text-[#C94A4A]/80' : 'text-muted-foreground'}`}>Esgotados</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Block 3 — Condicionais Ativas */}
        {(activeCond.length > 0 || true) && (
          <Card className="md:col-span-2" data-testid="card-active-conditionals">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Condicionais Ativas
                </CardTitle>
                {activeCond.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {activeCond.length} em aberto
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {activeCond.length === 0 ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground py-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  Nenhuma malinha em aberto no momento.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeCond.map(sale => {
                    const days = daysUntil(sale.conditionalReturnDate!);
                    const isLate = days < 0;
                    const isDueToday = days === 0;
                    const urgentStyle = isLate
                      ? 'bg-[#C94A4A]/10 border-[#C94A4A]/30'
                      : isDueToday
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-secondary/40 border-border';

                    return (
                      <div
                        key={sale.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border ${urgentStyle}`}
                        data-testid={`card-conditional-${sale.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">
                              {sale.customerName || 'Cliente Avulso'}
                            </span>
                            {isLate ? (
                              <Badge className="bg-[#C94A4A] text-white text-[10px] shrink-0">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                {Math.abs(days)}d em atraso
                              </Badge>
                            ) : isDueToday ? (
                              <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px] shrink-0">
                                Retorna hoje
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                Retorna em {days}d
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {sale.items.length} peça(s) ·{' '}
                            {formatDate(sale.createdAt)} →{' '}
                            <span className={isLate ? 'text-[#C94A4A] font-medium' : ''}>
                              {formatDate(sale.conditionalReturnDate!)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {sale.items.map(i => i.productName).join(', ')}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isLate ? 'destructive' : 'outline'}
                          className="gap-2 shrink-0"
                          onClick={() => openReconcile(sale.id)}
                          data-testid={`button-reconcile-${sale.id}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Encerrar Condicional
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Block 4 — Aniversariantes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Aniversariantes do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            {birthdaysThisMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aniversariante este mês.</p>
            ) : (
              <ul className="space-y-3">
                {birthdaysThisMonth.map(c => (
                  <li key={c.id} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground">{c.birthday ? formatDate(c.birthday) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Block 5 — Alertas de Cobrança */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Alertas de Cobrança</CardTitle>
          </CardHeader>
          <CardContent>
            {unpaidInstallments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma cobrança pendente.</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {unpaidInstallments.map(inst => {
                  const isOverdue = new Date(inst.dueDate).getTime() < Date.now();
                  return (
                    <div
                      key={`${inst.saleId}-${inst.index}`}
                      className={`flex justify-between items-center p-3 rounded-md border ${isOverdue ? 'bg-[#C94A4A]/10 border-[#C94A4A]/20' : 'bg-secondary border-border'}`}
                    >
                      <div>
                        <div className="font-medium text-sm">{inst.customerName || 'Cliente Indefinido'}</div>
                        <div className="text-xs text-muted-foreground">Vence: {formatDate(inst.dueDate)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-semibold ${isOverdue ? 'text-[#C94A4A]' : 'text-foreground'}`}>
                          {formatBRL(inst.amount)}
                        </span>
                        <Button
                          size="sm"
                          variant={isOverdue ? 'destructive' : 'secondary'}
                          onClick={() => handleDarBaixa(inst.saleId, inst.index)}
                        >
                          Dar Baixa
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Expense Modal ─────────────────────────────────────────────── */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="modal-quick-expense">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Lançar Despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-desc">Descrição</Label>
              <Input
                id="expense-desc"
                placeholder="Ex: Sacolas, Transporte, Taxa..."
                value={expenseDesc}
                onChange={e => setExpenseDesc(e.target.value)}
                autoFocus
                data-testid="input-expense-description"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Valor (R$)</Label>
              <Input
                id="expense-amount"
                placeholder="0,00"
                value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveExpense()}
                inputMode="decimal"
                data-testid="input-expense-amount"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveExpense} disabled={saving} data-testid="button-expense-save">
              Salvar Despesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reconciliation Modal ────────────────────────────────────────────── */}
      <Dialog open={reconcileOpen} onOpenChange={setReconcileOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="modal-reconcile">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Encerrar Condicional</DialogTitle>
            {reconcileSale && (
              <p className="text-sm text-muted-foreground pt-1">
                Cliente: <strong className="text-foreground">{reconcileSale.customerName || 'Avulso'}</strong>
                {' · '}Saiu em {formatDate(reconcileSale.createdAt)}
              </p>
            )}
          </DialogHeader>

          {reconcileSale && (
            <div className="space-y-4 py-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Selecione o destino de cada peça
              </p>

              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {reconcileSale.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/20"
                    data-testid={`row-reconcile-item-${i}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">{item.productCode} · {formatBRL(item.salePrice)}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => toggleDecision(i, 'returned')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                          decisions[i] === 'returned'
                            ? 'bg-secondary border-border text-foreground shadow-sm'
                            : 'border-transparent text-muted-foreground hover:border-border'
                        }`}
                        data-testid={`button-return-${i}`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Devolveu
                      </button>
                      <button
                        onClick={() => toggleDecision(i, 'purchased')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                          decisions[i] === 'purchased'
                            ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
                            : 'border-transparent text-muted-foreground hover:border-border'
                        }`}
                        data-testid={`button-purchase-${i}`}
                      >
                        <ShoppingBag className="w-3 h-3" />
                        Comprou
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {purchasedTotal > 0 && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total a cobrar</span>
                    <span className="font-serif text-lg text-primary">{formatBRL(purchasedTotal)}</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reconcile-payment" className="text-xs uppercase tracking-wider text-muted-foreground">
                      Forma de pagamento
                    </Label>
                    <select
                      id="reconcile-payment"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={reconcilePayment}
                      onChange={e => setReconcilePayment(e.target.value as typeof reconcilePayment)}
                      data-testid="select-reconcile-payment"
                    >
                      <option value="dinheiro">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="credito">Cartão de Crédito</option>
                      <option value="debito">Cartão de Débito</option>
                      <option value="fiado">Fiado / Crediário</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReconcileOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleReconcile}
              disabled={reconciling}
              data-testid="button-confirm-reconcile"
            >
              Confirmar Encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
