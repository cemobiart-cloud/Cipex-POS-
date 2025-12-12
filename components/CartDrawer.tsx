
import React, { useState } from 'react';
import { X, Trash2, ShoppingCart, User, Phone, MapPin, CheckCircle, Loader2, Plus, Minus, AlertCircle } from 'lucide-react';
import { CartItem, Customer } from '../types';
import { getDirectDriveUrl } from '../services/apiService';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onRemoveItem: (cartId: string) => void;
  onUpdateQuantity: (cartId: string, newQuantity: number) => void; // New prop
  onCheckout: (customer: Customer) => Promise<void>;
  isProcessing: boolean;
  currency: string; // New prop
}

const CartDrawer: React.FC<CartDrawerProps> = ({ 
  isOpen, onClose, cart, onRemoveItem, onUpdateQuantity, onCheckout, isProcessing, currency
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [errors, setErrors] = useState<{name?: boolean, phone?: boolean}>({});

  const totalAmount = cart.reduce((sum, item) => sum + item.finalTotal, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckoutClick = () => {
      const newErrors: {name?: boolean, phone?: boolean} = {};
      if (!customerName) newErrors.name = true;
      if (!customerPhone) newErrors.phone = true;

      if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          return;
      }

      const customer: Customer = {
          id: '', // Will be handled by logic or match existing
          name: customerName,
          phone: customerPhone,
          address: customerAddress
      };

      onCheckout(customer);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col animate-slide-in-left">
        
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 z-10">
           <div className="flex items-center space-x-2 space-x-reverse">
              <ShoppingCart className="text-primary" />
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">سلة المشتريات ({cart.length})</h2>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500">
             <X size={24} />
           </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
           {cart.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                   <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-full">
                       <ShoppingCart size={48} opacity={0.5} />
                   </div>
                   <p>السلة فارغة</p>
                   <button onClick={onClose} className="text-primary font-bold hover:underline">تصفح المنتجات</button>
               </div>
           ) : (
               cart.map((item) => {
                   const isMaxStock = item.quantity >= item.stock;
                   return (
                   <div key={item.cartId} className="flex flex-col bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                       <div className="flex">
                           {/* Image */}
                           <div className="w-16 h-16 bg-white dark:bg-gray-700 rounded-lg flex-shrink-0 overflow-hidden relative border border-gray-200 dark:border-gray-600">
                               <img 
                                  src={getDirectDriveUrl(item.image)} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=IMG'; }}
                               />
                           </div>
                           
                           {/* Details */}
                           <div className="flex-1 mr-3 flex flex-col justify-between">
                               <div className="flex justify-between items-start">
                                   <h4 className="font-bold text-gray-800 dark:text-white text-sm line-clamp-1">{item.name}</h4>
                                   <button onClick={() => onRemoveItem(item.cartId)} className="text-red-400 hover:text-red-600 p-1">
                                       <Trash2 size={16} />
                                   </button>
                               </div>
                               
                               <div className="flex justify-between items-center mt-2">
                                   {/* Quantity Controls */}
                                   <div className="flex items-center bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                                       <button 
                                          onClick={() => onUpdateQuantity(item.cartId, item.quantity - 1)}
                                          disabled={item.quantity <= 1}
                                          className="p-1 px-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition"
                                       >
                                           <Minus size={12} />
                                       </button>
                                       <span className="text-sm font-bold w-6 text-center text-gray-800 dark:text-white">{item.quantity}</span>
                                       <button 
                                          onClick={() => onUpdateQuantity(item.cartId, item.quantity + 1)}
                                          disabled={isMaxStock}
                                          className={`p-1 px-2 transition ${isMaxStock ? 'text-gray-300' : 'text-primary hover:bg-blue-50 dark:hover:bg-gray-700'}`}
                                       >
                                           <Plus size={12} />
                                       </button>
                                   </div>

                                   <span className="font-bold text-primary dir-ltr">{item.finalTotal.toFixed(2)} {currency}</span>
                               </div>
                           </div>
                       </div>
                       
                       {/* Extra Info */}
                       {(item.discount > 0 || isMaxStock) && (
                           <div className="mt-2 flex justify-between items-center text-[10px] pt-2 border-t border-gray-100 dark:border-gray-700">
                               {item.discount > 0 ? (
                                   <span className="text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded">
                                       خصم: -{item.discount.toFixed(1)}
                                   </span>
                               ) : <span></span>}
                               
                               {isMaxStock && (
                                   <span className="text-orange-500 flex items-center">
                                       <AlertCircle size={10} className="ml-1" />
                                       الحد الأقصى للمخزون
                                   </span>
                               )}
                           </div>
                       )}
                   </div>
               )})
           )}
        </div>

        {/* Footer (Customer & Checkout) */}
        {cart.length > 0 && (
            <div className="p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                
                {/* Customer Inputs */}
                <div className="space-y-3 mb-4">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center">
                        <User size={16} className="ml-2" /> بيانات العميل
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                             <input 
                                type="text" 
                                placeholder="الاسم *" 
                                value={customerName}
                                onChange={e => { setCustomerName(e.target.value); setErrors({...errors, name: false}) }}
                                className={`w-full bg-gray-50 dark:bg-gray-800 border rounded-lg p-2 text-sm outline-none ${errors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                             />
                        </div>
                        <div>
                             <input 
                                type="tel" 
                                placeholder="الهاتف *" 
                                value={customerPhone}
                                onChange={e => { setCustomerPhone(e.target.value); setErrors({...errors, phone: false}) }}
                                className={`w-full bg-gray-50 dark:bg-gray-800 border rounded-lg p-2 text-sm outline-none ${errors.phone ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                             />
                        </div>
                    </div>
                    <input 
                        type="text" 
                        placeholder="العنوان (اختياري)" 
                        value={customerAddress}
                        onChange={e => setCustomerAddress(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-sm outline-none"
                    />
                </div>

                {/* Totals */}
                <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">الإجمالي ({totalItems} عنصر):</span>
                    <span className="text-2xl font-bold text-primary dir-ltr">{totalAmount.toFixed(2)} {currency}</span>
                </div>

                <button 
                    onClick={handleCheckoutClick}
                    disabled={isProcessing}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center space-x-2 space-x-reverse transition active:scale-95 disabled:opacity-70 disabled:scale-100"
                >
                    {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
                    <span>{isProcessing ? 'جاري التنفيذ...' : 'تأكيد الطلب وطباعة'}</span>
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;
