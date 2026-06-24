import { useState, useRef } from "react";
import { useStore } from "@/context/StoreContext";
import { formatBRL, isThisMonth } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { TrendingUp, TrendingDown, Download, Upload, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const LS_KEYS = [
  'mayoli_products',
  'mayoli_customers',
  'mayoli_sales',
  'mayoli_catalogs',
  'mayoli_expenses',
  'mayoli_settings',
] as const;

export function Finance() {
  const { products, sales, expenses, settings } = useStore();
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const totalInvested = products
    .filter(p => p.status !== 'out')
    .reduce((acc, p) => acc + (p.costPrice * Math.max(p.quantity || 1, 0)), 0);

  const potentialRevenue = products
    .filter(p => p.status === 'available' || p.status === 'ending')
    .reduce((acc, p) => acc + (p.salePrice * (p.quantity || 1)), 0);

  const thisMonthExpenses = expenses.filter(e => isThisMonth(e.date)).reduce((acc, e) => acc + e.amount, 0);
  const thisMonthAcquisitionCosts = products.filter(p => isThisMonth(p.createdAt)).reduce((acc, p) => acc + (p.costPrice * (p.initialQuantity || 1)), 0);
  const targetRevenue = thisMonthAcquisitionCosts + thisMonthExpenses + 1000;
  const thisMonthRevenue = sales.filter(s => !s.isConditional && isThisMonth(s.createdAt)).reduce((acc, s) => acc + s.total, 0);
  const progressPercent = targetRevenue > 0 ? Math.min((thisMonthRevenue / targetRevenue) * 100, 100) : 0;

  const chartData = [
    { name: 'Sem 1', receitas: thisMonthRevenue * 0.2, despesas: thisMonthExpenses * 0.3 },
    { name: 'Sem 2', receitas: thisMonthRevenue * 0.4, despesas: thisMonthExpenses * 0.1 },
    { name: 'Sem 3', receitas: thisMonthRevenue * 0.1, despesas: thisMonthExpenses * 0.4 },
    { name: 'Sem 4', receitas: thisMonthRevenue * 0.3, despesas: thisMonthExpenses * 0.2 },
  ];

  function handleExport() {
    const backup: Record<string, unknown> = {
      _mayoli_backup_version: 1,
      _exported_at: new Date().toISOString(),
    };
    for (const key of LS_KEYS) {
      const raw = localStorage.getItem(key);
      backup[key] = raw ? JSON.parse(raw) : null;
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `mayoli-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup exportado com sucesso.');
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data._mayoli_backup_version !== 1) {
          toast.error('Arquivo de backup inválido ou incompatível.');
          setImporting(false);
          return;
        }
        for (const key of LS_KEYS) {
          if (data[key] !== undefined && data[key] !== null) {
            localStorage.setItem(key, JSON.stringify(data[key]));
          }
        }
        toast.success('Dados restaurados com sucesso. Recarregando...');
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        toast.error('Erro ao ler o arquivo. Verifique se é um backup válido.');
        setImporting(false);
      }
    };
    reader.readAsText(file);
    if (importRef.current) importRef.current.value = '';
  }

  return (
    <div className="space-y-6 pb-12">
      <h1 className="text-3xl font-serif text-primary-foreground">Finanças</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 1 */}
        <Card className="bg-gradient-to-br from-secondary/50 to-background border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4" /> Valor Total Investido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif">{formatBRL(totalInvested)}</div>
            <p className="text-xs text-muted-foreground mt-1">Custo do estoque atual</p>
          </CardContent>
        </Card>

        {/* Panel 2 */}
        <Card className="bg-gradient-to-br from-primary/5 to-background border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-primary flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Faturamento Potencial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-serif text-primary">{formatBRL(potentialRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Se todo estoque for vendido</p>
          </CardContent>
        </Card>

        {/* Panel 4: Meta Inteligente */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-serif">Meta Mensal Inteligente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Para cobrir seus custos de aquisição e despesas este mês, você precisa faturar{' '}
              <strong className="text-foreground">{formatBRL(targetRevenue)}</strong>.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>{formatBRL(thisMonthRevenue)} alcançado</span>
                <span>{progressPercent.toFixed(1)}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Panel 3: Fluxo */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-serif">Fluxo de Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="mensal" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="semanal">Semanal</TabsTrigger>
                <TabsTrigger value="mensal">Mensal</TabsTrigger>
                <TabsTrigger value="anual">Anual</TabsTrigger>
              </TabsList>
              <TabsContent value="mensal" className="h-[300px] mt-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(v) => `R$${v}`} />
                    <RechartsTooltip formatter={(v: number) => formatBRL(v)} cursor={{ fill: '#f5f5f5' }} />
                    <Legend />
                    <Bar dataKey="receitas" name="Receitas" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#C94A4A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>
              <TabsContent value="semanal" className="h-[300px] mt-0">
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Sem dados semanais suficientes para exibir.
                </div>
              </TabsContent>
              <TabsContent value="anual" className="h-[300px] mt-0">
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Sem dados anuais suficientes para exibir.
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Backup & Restore */}
        <Card className="md:col-span-2 border-dashed border-2 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Backup e Restauração de Dados
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Exporte todos os seus dados (estoque, clientes, vendas e finanças) em um arquivo JSON para guardar com segurança. 
              Use o mesmo arquivo para restaurar caso troque de dispositivo ou limpe o navegador.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleExport}
                className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-export-backup"
              >
                <Download className="w-4 h-4" />
                Exportar Backup (JSON)
              </Button>

              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => importRef.current?.click()}
                disabled={importing}
                data-testid="button-import-backup"
              >
                <Upload className="w-4 h-4" />
                {importing ? 'Restaurando...' : 'Restaurar Backup'}
              </Button>

              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImport}
                data-testid="input-backup-file"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Ao restaurar, os dados atuais serão substituídos pelos dados do arquivo. A página será recarregada automaticamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
