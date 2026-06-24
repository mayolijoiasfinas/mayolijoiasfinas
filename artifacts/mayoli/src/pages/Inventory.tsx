import { useState, useRef } from "react";
import { useStore } from "@/context/StoreContext";
import { formatBRL, compressImage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Package, Edit2, Trash2, ImagePlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const MAX_PHOTOS = 3;

const emptyForm = (defaultCategory: string) => ({
  name: "",
  description: "",
  category: defaultCategory,
  costPrice: "",
  salePrice: "",
  quantity: "",
  untracked: false,
  newCategory: "",
});

export function Inventory() {
  const { products, settings, addProduct, updateProduct, deleteProduct, updateSettings } = useStore();

  const [searchTerm, setSearchTerm]       = useState("");
  const [isAdding, setIsAdding]           = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData]           = useState(emptyForm(settings.customCategories[0]));
  const [photos, setPhotos]               = useState<string[]>([]);
  const [uploadingIdx, setUploadingIdx]   = useState<number | null>(null);
  const fileInputRef                      = useRef<HTMLInputElement>(null);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Photo upload ────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (photos.length + files.length > MAX_PHOTOS) {
      toast.error(`Máximo de ${MAX_PHOTOS} fotos por produto.`);
      e.target.value = '';
      return;
    }

    setUploadingIdx(photos.length);
    try {
      const compressed = await Promise.all(
        files.slice(0, MAX_PHOTOS - photos.length).map(f => compressImage(f, 300, 0.5))
      );
      setPhotos(prev => [...prev, ...compressed].slice(0, MAX_PHOTOS));
    } catch {
      toast.error('Não foi possível processar a imagem. Tente outra foto.');
    } finally {
      setUploadingIdx(null);
      e.target.value = '';
    }
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Form open/close ──────────────────────────────────────────────────────
  function openAdd() {
    setEditingProduct(null);
    setFormData(emptyForm(settings.customCategories[0]));
    setPhotos([]);
    setIsAdding(true);
  }

  function openEdit(p: any) {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      description: p.description,
      category: p.category,
      costPrice: String(p.costPrice),
      salePrice: String(p.salePrice),
      quantity: p.quantity === null ? "" : String(p.quantity),
      untracked: p.quantity === null,
      newCategory: "",
    });
    setPhotos(p.photos ?? []);
    setIsAdding(true);
  }

  function closeForm() {
    setIsAdding(false);
    setEditingProduct(null);
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function handleSave() {
    if (!formData.name.trim() || !formData.salePrice) {
      toast.error('Nome e preço de venda são obrigatórios.');
      return;
    }

    let finalCategory = formData.category;
    if (formData.category === "new" && formData.newCategory.trim()) {
      finalCategory = formData.newCategory.trim();
      updateSettings({ customCategories: [...settings.customCategories, finalCategory] });
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      category: finalCategory,
      costPrice: Number(formData.costPrice) || 0,
      salePrice: Number(formData.salePrice),
      quantity: formData.untracked ? null : Number(formData.quantity) || 0,
      initialQuantity: formData.untracked ? null : Number(formData.quantity) || 0,
      photos,
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, { ...payload, initialQuantity: editingProduct.initialQuantity });
      toast.success('Produto atualizado.');
    } else {
      addProduct(payload);
      toast.success('Produto adicionado.');
    }
    closeForm();
  }

  // ── Status badge ─────────────────────────────────────────────────────────
  function getStatusBadge(status: string) {
    switch (status) {
      case 'available': return <Badge className="bg-green-500/10 text-green-700 border-green-200">Disponível</Badge>;
      case 'ending':    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-200">Acabando</Badge>;
      case 'out':       return <Badge className="bg-[#C94A4A]/10 text-[#C94A4A] border-[#C94A4A]/20">Esgotado</Badge>;
      case 'untracked': return <Badge variant="secondary">Não Controlado</Badge>;
      default: return null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-serif text-primary-foreground">Estoque</h1>
        <Button onClick={openAdd} data-testid="button-add-product">
          <Plus className="w-4 h-4 mr-2" /> Adicionar Produto
        </Button>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 border-b bg-secondary/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 bg-background"
              data-testid="input-inventory-search"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium w-14">Foto</th>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Categoria</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Custo</th>
                <th className="px-4 py-3 font-medium text-right">Venda</th>
                <th className="px-4 py-3 font-medium text-center hidden sm:table-cell">Qtd</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-secondary/20 transition-colors" data-testid={`row-product-${p.id}`}>
                  {/* Thumbnail */}
                  <td className="px-4 py-3">
                    <div className="w-10 h-10 rounded-md bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                      {p.photos?.[0] ? (
                        <img
                          src={p.photos[0]}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          data-testid={`img-product-${p.id}`}
                        />
                      ) : (
                        <Package className="w-4 h-4 text-muted-foreground/30" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.code}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.category}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{formatBRL(p.costPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatBRL(p.salePrice)}</td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">{p.quantity === null ? '∞' : p.quantity}</td>
                  <td className="px-4 py-3">{getStatusBadge(p.status)}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      className="text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => openEdit(p)}
                      data-testid={`button-edit-${p.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => { deleteProduct(p.id); toast.success('Produto removido.'); }}
                      data-testid={`button-delete-${p.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={isAdding} onOpenChange={v => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="modal-product-form">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">

            {/* ── Photo upload ─────────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Fotos ({photos.length}/{MAX_PHOTOS})
              </label>
              <div className="flex gap-2 flex-wrap">
                {photos.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group" data-testid={`photo-preview-${i}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-remove-photo-${i}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {photos.length < MAX_PHOTOS && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingIdx !== null}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    data-testid="button-upload-photo"
                  >
                    {uploadingIdx !== null ? (
                      <span className="text-[10px] text-center leading-tight px-1">Processando...</span>
                    ) : (
                      <>
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-[10px]">Adicionar</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-photo-file"
              />
              <p className="text-[11px] text-muted-foreground">
                Fotos são comprimidas automaticamente para economizar espaço.
              </p>
            </div>

            {/* ── Name ─────────────────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Nome da Joia *</label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Colar Pérola Dourada"
                data-testid="input-product-name"
              />
            </div>

            {/* ── Description ──────────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Descrição</label>
              <Input
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição curta (opcional)"
                data-testid="input-product-description"
              />
            </div>

            {/* ── Category ─────────────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Categoria</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                data-testid="select-product-category"
              >
                {settings.customCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="new">+ Criar Nova Categoria</option>
              </select>
              {formData.category === 'new' && (
                <Input
                  value={formData.newCategory}
                  onChange={e => setFormData({ ...formData, newCategory: e.target.value })}
                  placeholder="Nome da nova categoria"
                  data-testid="input-new-category"
                />
              )}
            </div>

            {/* ── Prices ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Custo (R$)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="0,00"
                  data-testid="input-cost-price"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Venda (R$) *</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.salePrice}
                  onChange={e => setFormData({ ...formData, salePrice: e.target.value })}
                  placeholder="0,00"
                  data-testid="input-sale-price"
                />
              </div>
            </div>

            {/* ── Quantity ─────────────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Quantidade</label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min="0"
                  disabled={formData.untracked}
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-28"
                  placeholder="0"
                  data-testid="input-quantity"
                />
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.untracked}
                    onChange={e => setFormData({ ...formData, untracked: e.target.checked, quantity: '' })}
                    className="rounded border-gray-300"
                    data-testid="checkbox-untracked"
                  />
                  Não controlar estoque
                </label>
              </div>
            </div>

            {/* ── Actions ──────────────────────────────────────────────── */}
            <div className="pt-4 flex justify-end gap-2 border-t">
              <Button variant="outline" onClick={closeForm} data-testid="button-cancel-product">
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.name.trim() || !formData.salePrice || uploadingIdx !== null}
                data-testid="button-save-product"
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
