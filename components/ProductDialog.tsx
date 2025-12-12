
import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Package, Percent, ShoppingCart } from 'lucide-react';
import { Product, CartItem } from '../types';
import { getDirectDriveUrl } from '../services/apiService';

interface ProductDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
  taxRate: number;
  currency: string;
}

const ProductDialog: React.FC<ProductDialogProps> = ({ product, isOpen, onClose, onAddToCart, taxRate, currency }) => {
  const [quantity, setQuantity] = useState(1);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState<string>('0');
  
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setDiscountType('fixed');
      setDiscountValue('0');
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  // Calculations
  const subtotal = product.price * quantity;
  const parsedDiscountValue = parseFloat(discountValue) || 0;
  
  let discountAmount = 0;
  if (discountType === 'percentage') {
      discountAmount = subtotal * (Math.min(parsedDiscountValue, 100) / 100);
  } else {
      discountAmount = Math.min(parsedDiscountValue, subtotal);
  }
  
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (taxRate / 100);
  const finalTotal = taxableAmount + taxAmount;

  const handleAddToCart = () => {
    const cartItem: CartItem = {
        ...product,
        cartId: Date.now().toString(),
        quantity,
        subtotal,
        discount: discountAmount,
        discountType,
        discountValue: parsedDiscountValue,
        taxRate: taxRate / 100,
        taxAmount,
        finalTotal
    };
    
    onAddToCart(cartItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">إضافة للسلة</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {/* Product Summary */}
            <div className="flex items-center space-x-4 space-x-reverse bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
              <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden relative flex-shrink-0">
                  <Package className="text-gray-400 w-8 h-8" strokeWidth={1} />
                  <img 
                    src={getDirectDriveUrl(product.image)} 
                    alt={product.name} 
                    className="absolute inset-0 w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">{product.name}</h4>
                <div className="flex items-center space-x-2 space-x-reverse mt-1">
                    <span className="text-primary font-bold">{product.price} {currency}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">المتوفر: {product.stock}</span>
                </div>
              </div>
            </div>

            {/* Quantity Controls */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300 font-medium">الكمية:</span>
              <div className="flex items-center space-x-4 space-x-reverse bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-600 rounded shadow-sm text-gray-600 dark:text-white active:scale-95 transition"
                >
                  <Minus size={16} />
                </button>
                <span className="text-lg font-bold w-8 text-center text-gray-800 dark:text-white">{quantity}</span>
                <button 
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-600 rounded shadow-sm text-primary active:scale-95 transition"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Discount Section */}
            <div className="space-y-2">
                <span className="text-gray-600 dark:text-gray-300 font-medium text-sm">التخفيض (Discount):</span>
                <div className="flex space-x-2 space-x-reverse">
                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                        <button 
                            onClick={() => setDiscountType('fixed')}
                            className={`px-3 py-2 rounded-md text-sm font-bold transition ${discountType === 'fixed' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            {currency}
                        </button>
                        <button 
                             onClick={() => setDiscountType('percentage')}
                             className={`px-3 py-2 rounded-md text-sm font-bold transition ${discountType === 'percentage' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            %
                        </button>
                    </div>
                    <div className="flex-1 relative">
                        <input 
                            type="number" 
                            min="0"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value)}
                            className="w-full h-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 outline-none focus:ring-2 focus:ring-primary dir-ltr text-right font-bold"
                            placeholder="0"
                        />
                         <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                            {discountType === 'percentage' ? <Percent size={14} /> : <span className="text-xs">{currency}</span>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t dark:border-gray-700 pt-4 space-y-2">
               <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                 <span>المجموع الفرعي:</span>
                 <span>{subtotal.toFixed(2)} {currency}</span>
               </div>
               {discountAmount > 0 && (
                 <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400">
                    <span>خصم ({discountType === 'percentage' ? `%${discountValue}` : 'ثابت'}):</span>
                    <span>-{discountAmount.toFixed(2)} {currency}</span>
                 </div>
               )}
               {taxRate > 0 && (
                 <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                    <span>ضريبة ({taxRate}%):</span>
                    <span>+{taxAmount.toFixed(2)} {currency}</span>
                 </div>
               )}
               <div className="flex justify-between items-center text-2xl font-bold bg-gray-50 dark:bg-gray-700 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                 <span className="text-gray-800 dark:text-white">الإجمالي:</span>
                 <span className="text-primary">{finalTotal.toFixed(2)} {currency}</span>
               </div>
            </div>

            <button 
              onClick={handleAddToCart}
              className="w-full bg-primary hover:bg-secondary text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center space-x-2 space-x-reverse transition-all active:scale-95"
            >
              <ShoppingCart size={20} />
              <span>إضافة للسلة</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDialog;
