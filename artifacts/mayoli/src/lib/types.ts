export type ProductStatus = 'available' | 'ending' | 'out' | 'untracked';

export interface Product {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  costPrice: number;
  salePrice: number;
  quantity: number | null;
  initialQuantity: number | null;
  photos: string[];
  status: ProductStatus;
  createdAt: string;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  cpf?: string;
  birthday?: string;
  createdAt: string;
}

export interface SaleItem {
  productId: number;
  productCode: string;
  productName: string;
  salePrice: number;
  discount: number;
}

export interface Installment {
  amount: number;
  dueDate: string;
  paid: boolean;
  paidAt?: string;
  partialPaid?: number;
}

export type PaymentMethod = 'dinheiro' | 'credito' | 'debito' | 'pix' | 'outros' | 'fiado';
export type SaleStatus = 'paid' | 'pending' | 'conditional' | 'cancelled';

export interface Sale {
  id: number;
  customerId?: number;
  customerName?: string;
  items: SaleItem[];
  paymentMethod: PaymentMethod;
  total: number;
  discount: number;
  includesPackaging: boolean;
  packagingCost: number;
  installments?: Installment[];
  status: SaleStatus;
  isConditional: boolean;
  conditionalReturnDate?: string;
  createdAt: string;
}

export interface CustomCatalog {
  id: number;
  name: string;
  productIds: number[];
  createdAt: string;
}

export interface Expense {
  id: number;
  description: string;
  amount: number;
  date: string;
  category: string;
}

export interface AppSettings {
  packagingCost: number;
  customCategories: string[];
  nextProductId: number;
  nextSaleId: number;
  nextCustomerId: number;
  nextCatalogId: number;
  nextExpenseId: number;
}
