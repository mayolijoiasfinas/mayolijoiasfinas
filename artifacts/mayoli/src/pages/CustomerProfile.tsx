import { useParams, Link } from "wouter";
import { useStore } from "@/context/StoreContext";
import { formatBRL, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, User, Phone, Calendar, ShoppingBag } from "lucide-react";

export function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const { customers, sales } = useStore();
  
  const customer = customers.find(c => c.id === Number(id));
  const customerSales = sales.filter(s => s.customerId === Number(id)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (!customer) {
    return <div className="p-12 text-center text-muted-foreground">Cliente não encontrado.</div>;
  }

  const totalSpent = customerSales.filter(s => !s.isConditional).reduce((acc, s) => acc + s.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/clientes">
          <Button variant="ghost" size="icon" className="shrink-0"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <h1 className="text-3xl font-serif text-primary-foreground">{customer.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-primary/20 bg-secondary/10">
          <CardContent className="p-6 space-y-6">
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-serif">
                {customer.name.charAt(0)}
              </div>
            </div>
            <div className="space-y-4">
              {customer.phone && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" /> {customer.phone}
                </div>
              )}
              {customer.birthday && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" /> Nasc: {formatDate(customer.birthday)}
                </div>
              )}
              <div className="pt-4 border-t border-border">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Total Comprado</div>
                <div className="text-2xl font-serif text-foreground">{formatBRL(totalSpent)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <h2 className="text-xl font-serif border-b pb-2">Histórico de Compras</h2>
          {customerSales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              <ShoppingBag className="w-8 h-8 mx-auto mb-3 opacity-20" />
              Nenhuma compra registrada para este cliente.
            </div>
          ) : (
            <div className="space-y-4">
              {customerSales.map(sale => (
                <Card key={sale.id} className="overflow-hidden">
                  <div className="bg-secondary/30 px-4 py-3 border-b flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">{formatDate(sale.createdAt)}</div>
                    <div className="flex gap-2">
                      <Badge variant={sale.status === 'paid' ? "default" : "secondary"}>
                        {sale.status === 'paid' ? 'Paga' : sale.status === 'conditional' ? 'Condicional' : 'Pendente'}
                      </Badge>
                      <Badge variant="outline" className="uppercase text-[10px]">{sale.paymentMethod}</Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="space-y-2 mb-4">
                      {sale.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{item.productName} <span className="text-xs text-muted-foreground">({item.productCode})</span></span>
                          <span className="text-muted-foreground">{formatBRL(item.salePrice)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t">
                      <span className="font-medium text-sm">Total da Venda</span>
                      <span className="font-serif text-lg">{formatBRL(sale.total)}</span>
                    </div>
                    
                    {sale.paymentMethod === 'fiado' && sale.installments && sale.installments.length > 0 && (
                      <div className="mt-4 pt-4 border-t bg-secondary/10 -mx-4 -mb-4 px-4 pb-4">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Parcelas (Fiado)</div>
                        <div className="space-y-2">
                          {sale.installments.map((inst, i) => (
                            <div key={i} className="flex justify-between items-center text-sm p-2 bg-background border rounded">
                              <div className="flex items-center gap-3">
                                <span className={inst.paid ? 'text-muted-foreground line-through' : 'font-medium'}>{formatBRL(inst.amount)}</span>
                                <span className="text-xs text-muted-foreground">Venc: {formatDate(inst.dueDate)}</span>
                              </div>
                              {inst.paid ? (
                                <Badge className="bg-green-500/10 text-green-700 border-green-200">Paga</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-amber-600">Pendente</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
