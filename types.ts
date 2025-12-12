
export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  stock: number;
  category?: string; 
  barcode?: string; 
}

export interface CartItem extends Product {
  cartId: string; 
  quantity: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  finalTotal: number;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  lastVisit?: string;
  totalSpent?: number;
  visitCount?: number;
}

export interface SaleRecord {
  id: string;
  product: Product;
  quantity: number;
  total: number;       
  subtotal: number;    
  discount: number;    
  discountValue: number;
  discountType: 'percentage' | 'fixed';
  taxRate: number;      
  taxAmount: number;    
  customer: Customer;
  timestamp: string;
  cartItems?: CartItem[]; 
}

export interface Expense {
  id: string;
  title: string;
  description?: string;
  amount: number;
  date: string;
  image?: string;
}

export type UserRole = 'admin' | 'user';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  scriptUrl?: string;
}

export interface SettingEntry {
  key: string;
  value: string;
}

export interface AppData {
  products: Product[];
  sales: SaleRecord[];
  expenses: Expense[];
  users?: AppUser[];
  settings?: SettingEntry[];
}

export enum Tab {
  DASHBOARD = 'dashboard',
  PRODUCTS = 'products',
  SALES = 'sales',
  EXPENSES = 'expenses',
  CUSTOMERS = 'customers',
  SETTINGS = 'settings',
}

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

// NEW SETTINGS TYPES
export type Language = 'ar' | 'en';
export type ReceiptSize = 'thermal' | 'a4';

export interface AppSettings {
  language: Language;
  currency: string;
  receiptSize: ReceiptSize;
  storeLogo: string;
  storeName: string;
  taxRate: number;
  categories: string[];
}
