import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product, Customer, Sale, CustomCatalog, Expense, AppSettings } from '../lib/types';

interface StoreContextType {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  catalogs: CustomCatalog[];
  expenses: Expense[];
  settings: AppSettings;
  
  addProduct: (p: Omit<Product, 'id' | 'createdAt' | 'status' | 'code'>) => void;
  updateProduct: (id: number, p: Partial<Product>) => void;
  deleteProduct: (id: number) => void;
  
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt'>) => void;
  updateCustomer: (id: number, c: Partial<Customer>) => void;
  deleteCustomer: (id: number) => void;
  
  addSale: (s: Omit<Sale, 'id' | 'createdAt'>) => void;
  updateSale: (id: number, s: Partial<Sale>) => void;
  
  addCatalog: (c: Omit<CustomCatalog, 'id' | 'createdAt'>) => void;
  deleteCatalog: (id: number) => void;
  
  addExpense: (e: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: number) => void;
  
  updateSettings: (s: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  packagingCost: 0,
  customCategories: ['Colar', 'Brinco', 'Anel', 'Pulseira', 'Bracelete', 'Tornozeleira'],
  nextProductId: 1,
  nextSaleId: 1,
  nextCustomerId: 1,
  nextCatalogId: 1,
  nextExpenseId: 1,
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [catalogs, setCatalogs] = useState<CustomCatalog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadData = () => {
      const p = localStorage.getItem('mayoli_products');
      const c = localStorage.getItem('mayoli_customers');
      const s = localStorage.getItem('mayoli_sales');
      const cat = localStorage.getItem('mayoli_catalogs');
      const e = localStorage.getItem('mayoli_expenses');
      const set = localStorage.getItem('mayoli_settings');

      if (p) setProducts(JSON.parse(p));
      if (c) setCustomers(JSON.parse(c));
      if (s) setSales(JSON.parse(s));
      if (cat) setCatalogs(JSON.parse(cat));
      if (e) setExpenses(JSON.parse(e));
      if (set) setSettings(JSON.parse(set));
      
      setIsLoaded(true);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('mayoli_products', JSON.stringify(products));
    localStorage.setItem('mayoli_customers', JSON.stringify(customers));
    localStorage.setItem('mayoli_sales', JSON.stringify(sales));
    localStorage.setItem('mayoli_catalogs', JSON.stringify(catalogs));
    localStorage.setItem('mayoli_expenses', JSON.stringify(expenses));
    localStorage.setItem('mayoli_settings', JSON.stringify(settings));
  }, [products, customers, sales, catalogs, expenses, settings, isLoaded]);

  const addProduct = (p: Omit<Product, 'id' | 'createdAt' | 'status' | 'code'>) => {
    const id = settings.nextProductId;
    const code = String(id).padStart(3, '0');
    
    let status: Product['status'] = 'available';
    if (p.quantity === null) status = 'untracked';
    else if (p.quantity === 0) status = 'out';
    else if ((p.initialQuantity || 0) > 1 && p.quantity === 1) status = 'ending';

    const newProduct: Product = {
      ...p,
      id,
      code,
      status,
      createdAt: new Date().toISOString()
    };

    setProducts(prev => [...prev, newProduct]);
    setSettings(prev => ({ ...prev, nextProductId: prev.nextProductId + 1 }));
  };

  const updateProduct = (id: number, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, ...updates };
      
      if (updated.quantity === null) updated.status = 'untracked';
      else if (updated.quantity === 0) updated.status = 'out';
      else if ((updated.initialQuantity || 0) > 1 && updated.quantity === 1) updated.status = 'ending';
      else updated.status = 'available';
      
      return updated;
    }));
  };

  const deleteProduct = (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const addCustomer = (c: Omit<Customer, 'id' | 'createdAt'>) => {
    const newCustomer: Customer = {
      ...c,
      id: settings.nextCustomerId,
      createdAt: new Date().toISOString()
    };
    setCustomers(prev => [...prev, newCustomer]);
    setSettings(prev => ({ ...prev, nextCustomerId: prev.nextCustomerId + 1 }));
  };

  const updateCustomer = (id: number, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCustomer = (id: number) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const addSale = (s: Omit<Sale, 'id' | 'createdAt'>) => {
    const newSale: Sale = {
      ...s,
      id: settings.nextSaleId,
      createdAt: new Date().toISOString()
    };
    setSales(prev => [...prev, newSale]);
    setSettings(prev => ({ ...prev, nextSaleId: prev.nextSaleId + 1 }));

    // Decrement product quantities
    s.items.forEach(item => {
      setProducts(prev => prev.map(p => {
        if (p.id === item.productId && p.quantity !== null) {
          const newQty = Math.max(0, p.quantity - 1);
          return {
            ...p,
            quantity: newQty,
            status: newQty === 0 ? 'out' : ((p.initialQuantity || 0) > 1 && newQty === 1) ? 'ending' : 'available'
          };
        }
        return p;
      }));
    });
  };

  const updateSale = (id: number, updates: Partial<Sale>) => {
    setSales(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addCatalog = (c: Omit<CustomCatalog, 'id' | 'createdAt'>) => {
    const newCatalog: CustomCatalog = {
      ...c,
      id: settings.nextCatalogId,
      createdAt: new Date().toISOString()
    };
    setCatalogs(prev => [...prev, newCatalog]);
    setSettings(prev => ({ ...prev, nextCatalogId: prev.nextCatalogId + 1 }));
  };

  const deleteCatalog = (id: number) => {
    setCatalogs(prev => prev.filter(c => c.id !== id));
  };

  const addExpense = (e: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...e,
      id: settings.nextExpenseId,
    };
    setExpenses(prev => [...prev, newExpense]);
    setSettings(prev => ({ ...prev, nextExpenseId: prev.nextExpenseId + 1 }));
  };

  const deleteExpense = (id: number) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  if (!isLoaded) return null; // or a spinner

  return (
    <StoreContext.Provider value={{
      products, customers, sales, catalogs, expenses, settings,
      addProduct, updateProduct, deleteProduct,
      addCustomer, updateCustomer, deleteCustomer,
      addSale, updateSale,
      addCatalog, deleteCatalog,
      addExpense, deleteExpense,
      updateSettings
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
}
