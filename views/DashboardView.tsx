
import React from 'react';
import { SaleRecord, Product, Expense, Customer, AppUser, Tab } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, Package, Clock, ArrowRight } from 'lucide-react';
import { getDirectDriveUrl } from '../services/apiService';

interface DashboardViewProps {
  sales: SaleRecord[];
  products: Product[];
  expenses: Expense[];
  customers: Customer[];
  currentUser: AppUser | null;
  onNavigate: (tab: Tab) => void;
  currency: string; // New
}

const DashboardView: React.FC<DashboardViewProps> = ({ 
  sales, products, expenses, customers, currentUser, onNavigate, currency
}) => {
  
  // Calculations
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const lowStockProducts = products.filter(p => p.stock <= 5);
  const recentSales = sales.slice(-5).reverse();
  const today = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.timestamp.startsWith(today)).reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">لوحة التحكم</h1>
        <p className="text-gray-500 mt-1">مرحباً بك، <span className="font-bold text-primary">{currentUser?.name}</span></p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm mb-1">إجمالي المبيعات</p>
            <h3 className="text-2xl font-bold text-gray-900 dir-ltr text-right">{totalRevenue.toFixed(2)} {currency}</h3>
            <p className="text-xs text-green-600 mt-1 font-medium flex items-center">
              <TrendingUp size={12} className="ml-1" />
              اليوم: {todaySales.toFixed(2)} {currency}
            </p>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm mb-1">المصروفات</p>
            <h3 className="text-2xl font-bold text-red-600 dir-ltr text-right">{totalExpenses.toFixed(2)} {currency}</h3>
          </div>
          <div className="bg-red-50 p-3 rounded-xl text-red-600">
            <TrendingDown size={24} />
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm mb-1">صافي الربح</p>
            <h3 className={`text-2xl font-bold dir-ltr text-right ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {netProfit.toFixed(2)} {currency}
            </h3>
          </div>
          <div className={`p-3 rounded-xl ${netProfit >= 0 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Customers */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm mb-1">العملاء</p>
            <h3 className="text-2xl font-bold text-gray-900">{customers.length}</h3>
          </div>
          <div className="bg-purple-50 p-3 rounded-xl text-purple-600">
            <Users size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Sales Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">آخر العمليات</h2>
            <button onClick={() => onNavigate(Tab.SALES)} className="text-sm text-primary flex items-center hover:underline">
              عرض الكل <ArrowRight size={14} className="mr-1" />
            </button>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {recentSales.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {recentSales.map(sale => (
                  <div key={sale.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition">
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <div className="bg-blue-100 p-2 rounded-lg text-primary">
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{sale.product.name}</p>
                        <p className="text-xs text-gray-500 flex items-center mt-0.5">
                          <Clock size={10} className="ml-1" />
                          {new Date(sale.timestamp).toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})}
                          <span className="mx-1">•</span>
                          {sale.customer.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                       <span className="font-bold text-gray-900 dir-ltr block text-sm">{sale.total.toFixed(2)} {currency}</span>
                       <span className="text-xs text-gray-400">x{sale.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">لا توجد عمليات حديثة</div>
            )}
          </div>
        </div>

        {/* Alerts & Quick Status Column */}
        <div className="space-y-6">
           {/* Low Stock Alert */}
           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <AlertTriangle size={20} className="ml-2 text-orange-500" />
                تنبيهات المخزون
              </h2>
              
              {lowStockProducts.length > 0 ? (
                <div className="space-y-3">
                  {lowStockProducts.slice(0, 5).map(prod => (
                    <div key={prod.id} className="flex justify-between items-center bg-orange-50 p-3 rounded-xl border border-orange-100">
                       <div className="flex items-center space-x-2 space-x-reverse">
                         <div className="w-8 h-8 rounded bg-white flex items-center justify-center overflow-hidden">
                            <img 
                              src={getDirectDriveUrl(prod.image)} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                         </div>
                         <span className="text-sm font-medium text-gray-800 line-clamp-1">{prod.name}</span>
                       </div>
                       <span className="text-xs font-bold text-red-600 bg-white px-2 py-1 rounded-lg shadow-sm border border-red-100">
                         باقي {prod.stock}
                       </span>
                    </div>
                  ))}
                  {lowStockProducts.length > 5 && (
                     <button onClick={() => onNavigate(Tab.PRODUCTS)} className="w-full text-center text-xs text-gray-500 hover:text-primary mt-2">
                        +{lowStockProducts.length - 5} منتجات أخرى
                     </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                   <CheckCircleIcon />
                   <p className="mt-2">المخزون بحالة جيدة</p>
                </div>
              )}
           </div>

           {/* Quick Actions (Admin only) */}
           {currentUser?.role === 'admin' && (
             <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-lg p-5 text-white">
                <h3 className="font-bold mb-4">إجراءات سريعة</h3>
                <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => onNavigate(Tab.PRODUCTS)} className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-center transition">
                      <Package size={20} className="mx-auto mb-2" />
                      <span className="text-xs">إضافة منتج</span>
                   </button>
                   <button onClick={() => onNavigate(Tab.EXPENSES)} className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-center transition">
                      <DollarSign size={20} className="mx-auto mb-2" />
                      <span className="text-xs">تسجيل نفقة</span>
                   </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

// Helper Icon for Empty State
const CheckCircleIcon = () => (
  <svg className="w-10 h-10 text-green-100 bg-green-500 rounded-full p-2 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export default DashboardView;
