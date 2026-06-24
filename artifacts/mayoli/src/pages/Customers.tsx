import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Users, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

export function Customers() {
  const { customers, addCustomer } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    cpf: "",
    birthday: ""
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  const handleSave = () => {
    addCustomer(formData);
    setIsAdding(false);
    setFormData({ name: "", phone: "", cpf: "", birthday: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-serif text-primary-foreground">Clientes</h1>
        <Button onClick={() => setIsAdding(true)}><Plus className="w-4 h-4 mr-2" /> Novo Cliente</Button>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 border-b bg-secondary/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou telefone..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
        </div>

        <div className="divide-y divide-border">
          {filteredCustomers.map(c => (
            <Link key={c.id} href={`/clientes/${c.id}`}>
              <div className="flex items-center justify-between p-4 hover:bg-secondary/40 cursor-pointer transition-colors group">
                <div>
                  <div className="font-medium text-foreground">{c.name}</div>
                  <div className="text-sm text-muted-foreground flex gap-4 mt-1">
                    {c.phone && <span>{c.phone}</span>}
                    {c.birthday && <span>Aniversário: {formatDate(c.birthday)}</span>}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>Nenhum cliente encontrado.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Nome Completo *</label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">Telefone / WhatsApp</label>
              <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">CPF</label>
                <Input value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Data de Nascimento</label>
                <Input type="date" value={formData.birthday} onChange={e => setFormData({...formData, birthday: e.target.value})} />
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-2 border-t">
              <Button variant="outline" onClick={() => setIsAdding(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!formData.name}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
