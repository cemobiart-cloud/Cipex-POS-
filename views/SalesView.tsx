
import React, { useState } from 'react';
import { SaleRecord, NotificationType, AppUser, CartItem, AppSettings } from '../types';
import { FileText, Clock, User, Trash2, AlertTriangle, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { generateReceiptPDF } from '../services/pdfService';
import { deleteSaleFromSheets } from '../services/apiService';

interface SalesViewProps {
  sales: SaleRecord[];
  onDeleteSale: (id: string) => void;
  notify: (msg: string, type: NotificationType) => void;
  currentUser: AppUser | null;
  settings?: AppSettings; // Added settings
}

// Helper to group flat sales into orders
const groupSalesIntoOrders = (sales: SaleRecord[]) => {
    const groups: { [key: string]: SaleRecord[] } = {};
    sales.forEach(sale => {
        // Use timestamp as key for grouping items in the same cart
        const key = sale.timestamp;
        if (!groups[key]) groups[key] = [];
        groups[key].push(sale);
    });
    return Object.entries(groups).map(([timestamp, items]) => ({
        timestamp,
        items,
        total: items.reduce((sum, item) => sum + item.total, 0),
        customer: items[0].customer,
        id: items[0].id // Use first item ID as representative
    })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const SalesView: React.FC<SalesViewProps> = ({ sales, onDeleteSale, notify, currentUser, settings }) => {
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const isAdmin = currentUser?.role === 'admin';
  const currency = settings?.currency || 'MAD';
  
  const groupedOrders = groupSalesIntoOrders(sales);

  const requestDelete = (id: string) => {
    setDeleteConfirmationId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmationId) return;
    
    const id = deleteConfirmationId;
    onDeleteSale(id); // Optimistic update
    setDeleteConfirmationId(null);

    const success = await deleteSaleFromSheets(id);
    if (!success) notify('فشل الحذف من قاعدة البيانات', 'error');
    else notify('تم حذف العملية واسترجاع المخزون', 'success');
  };

  const toggleExpand = (orderId: string) => {
      setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const handlePrintOrder = (order: { timestamp: string, items: SaleRecord[], total: number, customer: any }) => {
      // Reconstruct a "Master" SaleRecord from the grouped items
      const cartItems: CartItem[] = order.items.map(s => ({
          ...s.product,
          cartId: s.id,
          quantity: s.quantity,
          discount: s.discount,
          discountType: s.discountType,
          discountValue: s.discountValue,
          taxRate: s.taxRate,
          taxAmount: s.taxAmount,
          subtotal: s.subtotal,
          finalTotal: s.total
      }));

      const masterSale: SaleRecord = {
          ...order.items[0], // Borrow metadata from first item
          product: { ...order.items[0].product, name: 'طلب مجمع' }, // Placeholder
          quantity: cartItems.reduce((acc, i) => acc + i.quantity, 0),
          subtotal: cartItems.reduce((acc, i) => acc + i.subtotal, 0),
          discount: cartItems.reduce((acc, i) => acc + i.discount, 0),
          taxAmount: cartItems.reduce((acc, i) => acc + i.taxAmount, 0),
          total: order.total,
          cartItems: cartItems
      };

      generateReceiptPDF(masterSale, settings);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">
      <h1 className="text-3xl font-bold text-gray-800">المبيعات</h1>

      {/* Summary Card */}
      <div className="bg-gradient-to-l from-primary to-secondary text-white rounded-2xl p-6 shadow-lg">
        <p className="text-blue-100 mb-1">إجمالي الإيرادات</p>
        <h2 className="text-4xl font-bold dir-ltr text-right">{totalRevenue.toFixed(2)} {currency}</h2>
        <div className="mt-4 flex items-center text-sm text-blue-100">
          <span className="bg-white/20 px-2 py-1 rounded-lg mr-2">{groupedOrders.length} طلبات</span>
          <span className="bg-white/20 px-2 py-1 rounded-lg">{sales.length} منتجات مباعة</span>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        <h3 className="font-bold text-gray-700">سجل الطلبات</h3>
        {groupedOrders.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300">
            لا توجد مبيعات حتى الآن
          </div>
        ) : (
          groupedOrders.map((order) => {
             const isMulti = order.items.length > 1;
             const isExpanded = expandedOrderId === order.timestamp; // Use timestamp as unique ID for UI state

             return (
            <div key={order.timestamp} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative group transition-all">
              {/* Main Order Row */}
              <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50" onClick={() => isMulti && toggleExpand(order.timestamp)}>
                  <div className="flex space-x-4 space-x-reverse items-center">
                     <div className={`p-3 rounded-lg h-fit ${isMulti ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                       {isMulti ? <Layers size={24} /> : <FileText size={24} />}
                     </div>
                     <div>
                       <h4 className="font-bold text-gray-900 flex items-center">
                           {isMulti ? `طلب مجمع (${order.items.length} منتجات)` : order.items[0].product.name}
                           {isMulti && (isExpanded ? <ChevronUp size={16} className="mr-2 text-gray-400"/> : <ChevronDown size={16} className="mr-2 text-gray-400"/>)}
                       </h4>
                       <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2 space-x-reverse">
                         <span className="flex items-center dir-ltr"><Clock size={12} className="mr-1"/> {new Date(order.timestamp).toLocaleString('en-GB')}</span>
                         <span className="flex items-center"><User size={12} className="ml-1"/> {order.customer.name}</span>
                       </div>
                     </div>
                  </div>
                  <div className="text-left flex flex-col items-end z-10">
                    <span className="font-bold text-gray-800 dir-ltr">{order.total.toFixed(2)} {currency}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePrintOrder(order); }}
                      className="text-xs text-primary mt-1 hover:underline flex items-center bg-white px-2 py-1 rounded border border-blue-100"
                    >
                      طباعة وصل {isMulti ? 'مجمع' : ''}
                    </button>
                  </div>
              </div>

              {/* Expanded Items (Only for Multi Orders) */}
              {isMulti && isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100 p-2 space-y-1">
                      {order.items.map(item => (
                          <div key={item.id} className="flex justify-between items-center p-2 text-sm bg-white rounded border border-gray-100">
                               <div className="flex items-center">
                                   <span className="text-gray-500 w-6 text-center">{item.quantity}x</span>
                                   <span className="font-medium text-gray-700 mr-2">{item.product.name}</span>
                               </div>
                               <div className="flex items-center space-x-2 space-x-reverse">
                                   <span className="text-gray-600 dir-ltr">{item.total.toFixed(2)} {currency}</span>
                                   {isAdmin && (
                                       <button 
                                        onClick={(e) => { e.stopPropagation(); requestDelete(item.id); }}
                                        className="text-red-400 hover:text-red-600 p-1"
                                        title="حذف هذا العنصر"
                                       >
                                           <Trash2 size={14} />
                                       </button>
                                   )}
                               </div>
                          </div>
                      ))}
                  </div>
              )}

              {/* Delete Button (Single Order or Whole Order Logic - currently deletes item by item in expanded view, 
                  but for single item orders, show delete button on main card) */}
              {isAdmin && !isMulti && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); requestDelete(order.items[0].id); }}
                    className="absolute top-2 left-2 bg-red-50 text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                    title="حذف واسترجاع المخزون"
                  >
                    <Trash2 size={14} />
                  </button>
              )}
            </div>
          )})
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmationId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-fade-in-up">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">تأكيد الحذف</h3>
                <p className="text-gray-500">هل أنت متأكد من حذف هذه العملية؟ سيتم استرجاع الكمية للمخزون.</p>
              </div>
              <div className="flex space-x-3 space-x-reverse w-full pt-2">
                <button onClick={() => setDeleteConfirmationId(null)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition">إلغاء</button>
                <button onClick={confirmDelete} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition">حذف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesView;
