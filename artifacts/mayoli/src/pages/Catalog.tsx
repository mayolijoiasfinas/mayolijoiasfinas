import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import { formatBRL } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gem, Trash2 } from "lucide-react";

export function Catalog() {
  const { products, catalogs, addCatalog, deleteCatalog } = useStore();
  const [activeTab, setActiveTab] = useState("auto");
  const [isCreating, setIsCreating] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [viewingCatalogId, setViewingCatalogId] = useState<number | null>(null);

  const availableProducts = products.filter(p => p.status !== 'out');

  const handleCreateCatalog = () => {
    if (!newCatalogName.trim() || selectedProductIds.length === 0) return;
    addCatalog({ name: newCatalogName, productIds: selectedProductIds });
    setIsCreating(false);
    setNewCatalogName("");
    setSelectedProductIds([]);
  };

  const toggleProductSelection = (id: number) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const viewingCatalog = catalogs.find(c => c.id === viewingCatalogId);
  const displayProducts = viewingCatalogId 
    ? products.filter(p => viewingCatalog?.productIds.includes(p.id))
    : availableProducts;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-serif text-primary-foreground">Catálogo</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="auto">Automático</TabsTrigger>
          <TabsTrigger value="custom">Personalizado</TabsTrigger>
        </TabsList>

        <TabsContent value="auto" className="mt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {availableProducts.map(p => (
              <Card key={p.id} className="overflow-hidden border-border/50 hover:border-primary/30 transition-colors group">
                <div className="aspect-square bg-secondary flex items-center justify-center relative">
                  {p.photos?.[0] ? (
                    <img src={p.photos[0]} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Gem className="w-12 h-12 text-muted-foreground/30" />
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">{p.code}</div>
                  <h3 className="font-serif text-lg leading-tight mb-2 group-hover:text-primary transition-colors">{p.name}</h3>
                  <div className="font-medium text-foreground">{formatBRL(p.salePrice)}</div>
                </CardContent>
              </Card>
            ))}
            {availableProducts.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <Gem className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Nenhum produto disponível no momento.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="mt-0">
          {isCreating ? (
            <div className="space-y-6 bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-serif">Criar Novo Catálogo</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nome do Catálogo</label>
                  <Input 
                    value={newCatalogName} 
                    onChange={e => setNewCatalogName(e.target.value)} 
                    placeholder="Ex: Coleção Dia das Mães" 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Selecione os Produtos</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-1">
                    {availableProducts.map(p => (
                      <div 
                        key={p.id}
                        onClick={() => toggleProductSelection(p.id)}
                        className={`border rounded-md p-3 cursor-pointer transition-colors flex gap-3 items-center ${selectedProductIds.includes(p.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'}`}
                      >
                        <div className="w-10 h-10 bg-muted rounded shrink-0 flex items-center justify-center overflow-hidden">
                           {p.photos?.[0] ? <img src={p.photos[0]} alt="" className="w-full h-full object-cover" /> : <Gem className="w-4 h-4 opacity-50" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{formatBRL(p.salePrice)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <Button variant="outline" onClick={() => setIsCreating(false)}>Cancelar</Button>
                  <Button onClick={handleCreateCatalog} disabled={!newCatalogName.trim() || selectedProductIds.length === 0}>Salvar Catálogo</Button>
                </div>
              </div>
            </div>
          ) : viewingCatalogId ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" onClick={() => setViewingCatalogId(null)}>Voltar</Button>
                  <h2 className="text-xl font-serif">{viewingCatalog?.name}</h2>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {displayProducts.map(p => (
                  <Card key={p.id} className="overflow-hidden border-border/50 hover:border-primary/30 transition-colors group">
                    <div className="aspect-square bg-secondary flex items-center justify-center relative">
                      {p.photos?.[0] ? (
                        <img src={p.photos[0]} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Gem className="w-12 h-12 text-muted-foreground/30" />
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground mb-1">{p.code}</div>
                      <h3 className="font-serif text-lg leading-tight mb-2 group-hover:text-primary transition-colors">{p.name}</h3>
                      <div className="font-medium text-foreground">{formatBRL(p.salePrice)}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <Button onClick={() => setIsCreating(true)}>Criar Novo Catálogo</Button>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {catalogs.map(c => (
                  <Card key={c.id} className="flex flex-col hover:border-primary/50 transition-colors">
                    <CardContent className="p-5 flex-1 flex flex-col justify-between cursor-pointer" onClick={() => setViewingCatalogId(c.id)}>
                      <div>
                        <h3 className="font-serif text-lg mb-1">{c.name}</h3>
                        <p className="text-sm text-muted-foreground">{c.productIds.length} produtos</p>
                      </div>
                    </CardContent>
                    <div className="px-5 pb-4 flex justify-end">
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); deleteCatalog(c.id); }}>
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </Button>
                    </div>
                  </Card>
                ))}
                {catalogs.length === 0 && (
                  <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg bg-secondary/50">
                    <p>Você ainda não criou nenhum catálogo personalizado.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
