import React, { useState, useEffect } from 'react';
import BottomNav from './components/BottomNav';
import ProductsView from './views/ProductsView';
import SalesView from './views/SalesView';
import ExpensesView from './views/ExpensesView';
import CustomersView from './views/CustomersView';
import SettingsView from './views/SettingsView';
import DashboardView from './views/DashboardView';
import { Tab, SaleRecord, Product, Expense, Notification, NotificationType, Customer, AppUser, AppSettings, Language, ReceiptSize } from './types';
import { CheckCircle, AlertCircle, LogIn, Lock, Loader2, Database, Save, ArrowLeft, User } from 'lucide-react';
import { fetchDataFromSheets, getApiUrl, saveApiUrl, saveSettingsToSheets } from './services/apiService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loginEmail, setLoginEmail] = useState('');
  
  // Login Screen Config State
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState('');

  const [currentTab, setCurrentTab] = useState<Tab>(Tab.DASHBOARD);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Global Settings State
  const [settings, setSettings] = useState<AppSettings>({
      language: 'ar',
      currency: 'MAD',
      receiptSize: 'thermal',
      storeLogo: '',
      storeName: 'My Store',
      taxRate: 0,
      categories: ['عام', 'إلكترونيات', 'ملابس']
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // App Appearance State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Notification Helper
  const showNotification = (message: string, type: NotificationType = 'success') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  // Function to fetch data from cloud
  const refreshData = async () => {
    const url = getApiUrl();
    if (!url || url.includes('YOUR_GOOGLE_SCRIPT')) return;

    setIsSyncing(true);
    
    try {
      const data = await fetchDataFromSheets();
      if (data) {
        if (data.users) setUsers(data.users);
        if (data.products) setProducts(data.products);
        if (data.sales) setSales(data.sales);
        if (data.expenses) setExpenses(data.expenses);
        if ((data as any).customers) setCustomers((data as any).customers);
        
        // Update Settings
        if (data.settings) {
             const settingsMap = data.settings.reduce((acc: any, item: any) => ({...acc, [item.key]: item.value}), {});
             
             const newSettings: AppSettings = { ...settings };

             if (settingsMap.categories) {
                 try {
                    newSettings.categories = JSON.parse(settingsMap.categories);
                 } catch (e) { console.error('Error parsing categories', e); }
             }
             if (settingsMap.tax_rate) newSettings.taxRate = parseFloat(settingsMap.tax_rate) || 0;
             if (settingsMap.currency) newSettings.currency = settingsMap.currency;
             if (settingsMap.language) newSettings.language = settingsMap.language as Language;
             if (settingsMap.receipt_size) newSettings.receiptSize = settingsMap.receipt_size as ReceiptSize;
             if (settingsMap.store_logo) newSettings.storeLogo = settingsMap.store_logo;
             if (settingsMap.store_name) newSettings.storeName = settingsMap.store_name;

             setSettings(newSettings);
             localStorage.setItem('pos_settings', JSON.stringify(newSettings));
        }
        
        showNotification('تم تحديث البيانات والإعدادات بنجاح!', 'success');
        if (data.products) checkLowStock(data.products);
      } else {
        showNotification('فشل جلب البيانات. تحقق من الرابط.', 'error');
      }
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء المزامنة.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const checkLowStock = (prods: Product[]) => {
    const lowStockItems = prods.filter(p => p.stock <= 5);
    if (lowStockItems.length > 0) {
      setTimeout(() => {
         showNotification(`تنبيه: يوجد ${lowStockItems.length} منتجات أوشكت على النفاذ!`, 'error');
      }, 1000);
    }
  };

  // Load local data on mount
  useEffect(() => {
    const savedSales = localStorage.getItem('pos_sales_data');
    const savedProducts = localStorage.getItem('pos_products_data');
    const savedExpenses = localStorage.getItem('pos_expenses_data');
    const savedCustomers = localStorage.getItem('pos_customers_data');
    const savedUsers = localStorage.getItem('pos_users_data');
    const savedApiUrl = getApiUrl();
    
    // Load Settings
    const savedSettings = localStorage.getItem('pos_settings');
    if (savedSettings) {
        try {
            setSettings(JSON.parse(savedSettings));
        } catch (e) { console.error('Failed to parse settings'); }
    } else {
        // Legacy Fallback
        const savedCats = localStorage.getItem('pos_categories');
        const savedTax = localStorage.getItem('pos_tax_rate');
        if (savedCats || savedTax) {
             setSettings(prev => ({
                 ...prev,
                 categories: savedCats ? JSON.parse(savedCats) : prev.categories,
                 taxRate: savedTax ? parseFloat(savedTax) : prev.taxRate
             }));
        }
    }

    // Load App Settings
    const savedDarkMode = localStorage.getItem('pos_dark_mode');
    if (savedDarkMode === 'true') setIsDarkMode(true);
    
    const savedViewMode = localStorage.getItem('pos_view_mode');
    if (savedViewMode === 'list') setViewMode('list');

    if (savedApiUrl && !savedApiUrl.includes('YOUR_GOOGLE_SCRIPT')) {
        setTempApiUrl(savedApiUrl);
    }
    
    const loggedUser = localStorage.getItem('pos_current_user');
    if (loggedUser) setCurrentUser(JSON.parse(loggedUser));

    if (savedSales) try { setSales(JSON.parse(savedSales)); } catch (e) {}
    if (savedProducts) try { setProducts(JSON.parse(savedProducts)); } catch (e) {}
    if (savedExpenses) try { setExpenses(JSON.parse(savedExpenses)); } catch (e) {}
    if (savedCustomers) try { setCustomers(JSON.parse(savedCustomers)); } catch (e) {}
    if (savedUsers) try { setUsers(JSON.parse(savedUsers)); } catch (e) {}
    
    if (savedApiUrl && !savedApiUrl.includes('YOUR_GOOGLE_SCRIPT')) {
        setTimeout(() => refreshData(), 500);
    }
  }, []);

  // Save data effects
  useEffect(() => { localStorage.setItem('pos_sales_data', JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem('pos_products_data', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('pos_expenses_data', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('pos_customers_data', JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem('pos_users_data', JSON.stringify(users)); }, [users]);

  // Handle Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('pos_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('pos_dark_mode', 'false');
    }
  }, [isDarkMode]);
  
  // Handle Language Direction
  useEffect(() => {
      document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = settings.language;
  }, [settings.language]);

  useEffect(() => { localStorage.setItem('pos_view_mode', viewMode); }, [viewMode]);

  const handleUpdateSettings = async (newSettings: AppSettings) => {
      setSettings(newSettings);
      localStorage.setItem('pos_settings', JSON.stringify(newSettings));
      return await saveSettingsToSheets(newSettings);
  };

  // Handlers
  const handleLogin = async () => {
    if (!loginEmail) return;
    if (users.length === 0) {
      const currentUrl = getApiUrl();
      const defaultAdmin: AppUser = { id: 'admin', name: 'Admin', email: loginEmail, role: 'admin', scriptUrl: (currentUrl && !currentUrl.includes('YOUR_GOOGLE_SCRIPT')) ? currentUrl : undefined };
      setUsers([defaultAdmin]);
      setCurrentUser(defaultAdmin);
      localStorage.setItem('pos_current_user', JSON.stringify(defaultAdmin));
      return;
    }
    const foundUser = users.find(u => u.email.toLowerCase() === loginEmail.toLowerCase());
    if (foundUser) {
      if (foundUser.scriptUrl && foundUser.scriptUrl.startsWith('http')) {
         const currentApiUrl = getApiUrl();
         if (foundUser.scriptUrl !== currentApiUrl) {
             saveApiUrl(foundUser.scriptUrl);
             setTempApiUrl(foundUser.scriptUrl);
             setProducts([]); setSales([]); setExpenses([]); setCustomers([]);
             showNotification('تم العثور على قاعدة بيانات خاصة بالمستخدم. جاري التحويل والمزامنة...', 'info');
             await refreshData();
         }
      }
      setCurrentUser(foundUser);
      localStorage.setItem('pos_current_user', JSON.stringify(foundUser));
      if (!foundUser.scriptUrl) refreshData(); 
    } else {
      showNotification('البريد الإلكتروني غير مسجل', 'error');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pos_current_user');
  };
  
  const handleSaveApiUrlInLogin = () => {
      if(tempApiUrl) {
          saveApiUrl(tempApiUrl);
          showNotification('تم حفظ الرابط بنجاح! جاري جلب البيانات...', 'success');
          refreshData();
          setShowApiConfig(false);
      }
  };

  const handleSaleComplete = (sale: SaleRecord) => {
    setSales(prev => [...prev, sale]);
    setProducts(prev => {
        const updated = prev.map(p => p.id === sale.product.id ? { ...p, stock: p.stock - sale.quantity } : p);
        const updatedProduct = updated.find(p => p.id === sale.product.id);
        if (updatedProduct && updatedProduct.stock <= 5) showNotification(`تنبيه: مخزون ${updatedProduct.name} منخفض جداً!`, 'error');
        return updated;
    });
    setCustomers(prev => {
      const exists = prev.find(c => (sale.customer.id && c.id === sale.customer.id) || (!sale.customer.id && c.phone === sale.customer.phone));
      if (exists) {
        return prev.map(c => c.id === exists.id ? { ...c, totalSpent: (c.totalSpent || 0) + sale.total, lastVisit: sale.timestamp, visitCount: (c.visitCount || 0) + 1 } : c);
      } else {
        return [...prev, { ...sale.customer, id: sale.customer.id || sale.customer.phone, totalSpent: sale.total, lastVisit: sale.timestamp, visitCount: 1 }];
      }
    });
    showNotification('تمت عملية البيع بنجاح', 'success');
  };

  const handleDeleteSale = (id: string) => {
    const saleToDelete = sales.find(s => s.id === id);
    if (saleToDelete) {
      setProducts(prev => prev.map(p => p.id === saleToDelete.product.id ? { ...p, stock: p.stock + saleToDelete.quantity } : p));
    }
    setSales(prev => prev.filter(s => s.id !== id));
    // Trigger Sync
    refreshData();
  };

  const renderContent = () => {
    switch (currentTab) {
      case Tab.DASHBOARD:
        return <DashboardView 
            sales={sales} 
            products={products} 
            expenses={expenses} 
            customers={customers} 
            currentUser={currentUser} 
            onNavigate={setCurrentTab} 
            currency={settings.currency}
        />;
      case Tab.PRODUCTS:
        return <ProductsView 
            products={products} 
            categories={settings.categories}
            taxRate={settings.taxRate}
            customers={customers} 
            onSaleComplete={handleSaleComplete} 
            onAddProduct={p => setProducts(prev => [...prev, p])}
            onUpdateProduct={p => setProducts(prev => prev.map(curr => curr.id === p.id ? p : curr))}
            onDeleteProduct={id => setProducts(prev => prev.filter(p => p.id !== id))}
            onRefreshData={refreshData}
            notify={showNotification}
            currentUser={currentUser}
            viewMode={viewMode}
            settings={settings} // Pass all settings for Receipt Generation
          />;
      case Tab.SALES:
        return <SalesView 
            sales={sales} 
            onDeleteSale={handleDeleteSale} 
            notify={showNotification} 
            currentUser={currentUser}
            settings={settings} // For receipt printing
        />;
      case Tab.EXPENSES:
        return <ExpensesView 
            expenses={expenses} 
            onAddExpense={e => setExpenses(prev => [...prev, e])} 
            onUpdateExpense={e => setExpenses(prev => prev.map(curr => curr.id === e.id ? e : curr))} 
            onDeleteExpense={id => setExpenses(prev => prev.filter(e => e.id !== id))} 
            onRefreshData={refreshData} 
            notify={showNotification} 
            currentUser={currentUser}
            currency={settings.currency}
        />;
      case Tab.CUSTOMERS:
        return <CustomersView 
            customers={customers} 
            onUpdateCustomer={c => setCustomers(prev => prev.map(curr => curr.id === c.id ? { ...curr, ...c } : curr))} 
            onDeleteCustomer={id => setCustomers(prev => prev.filter(c => c.id !== id))} 
            onRefreshData={refreshData}
            notify={showNotification} 
            currentUser={currentUser}
            currency={settings.currency}
        />;
      case Tab.SETTINGS:
        return <SettingsView 
            onRefreshData={refreshData} 
            currentUser={currentUser}
            users={users}
            settings={settings} // Pass full settings object
            onUpdateSettings={handleUpdateSettings}
            onAddUser={u => setUsers(prev => [...prev, u])}
            onUpdateUser={u => setUsers(prev => prev.map(curr => curr.id === u.id ? u : curr))}
            onDeleteUser={id => setUsers(prev => prev.filter(u => u.id !== id))}
            onLogout={handleLogout}
            notify={showNotification}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />;
      default: return null;
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
             <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl"></div>
             <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-secondary/5 rounded-full blur-3xl"></div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-8 relative z-10 animate-fade-in-up border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 text-primary shadow-sm">
               <Lock size={32} strokeWidth={2} />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">نظام نقاط البيع</h1>
            <p className="text-gray-500 dark:text-gray-400">مرحباً بعودتك، يرجى تسجيل الدخول</p>
          </div>

          <div className="space-y-6">
             {!showApiConfig ? (
                 <>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">البريد الإلكتروني</label>
                        <div className="relative">
                            <input 
                                type="email" 
                                value={loginEmail} 
                                onChange={(e) => setLoginEmail(e.target.value)} 
                                className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition text-right dir-rtl" 
                                placeholder="name@example.com" 
                                onKeyDown={(e) => e.key === 'Enter' && handleLogin()} 
                            />
                            <div className="absolute right-3 top-3.5 text-gray-400 pointer-events-none">
                                <User size={20} />
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleLogin} 
                        className="w-full bg-primary hover:bg-secondary text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 space-x-reverse transition transform active:scale-95"
                    >
                        <LogIn size={20} />
                        <span>تسجيل الدخول</span>
                    </button>
                    
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
                        <button 
                            onClick={() => setShowApiConfig(true)} 
                            className="text-sm text-gray-400 hover:text-primary transition flex items-center justify-center mx-auto space-x-1 space-x-reverse"
                        >
                            <Database size={14} />
                            <span>إعدادات قاعدة البيانات</span>
                        </button>
                    </div>
                 </>
             ) : (
                 <>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">رابط Google Apps Script</label>
                        <div className="relative">
                           <input type="text" value={tempApiUrl} onChange={(e) => setTempApiUrl(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-primary dir-ltr text-left" placeholder="https://script.google.com/..." />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">يستخدم للربط مع جداول بيانات جوجل الخاصة بك.</p>
                    </div>
                    <div className="flex space-x-3 space-x-reverse pt-2">
                        <button onClick={handleSaveApiUrlInLogin} className="flex-1 bg-primary hover:bg-secondary text-white font-bold py-3 rounded-xl shadow transition flex items-center justify-center space-x-2 space-x-reverse">
                            <Save size={18} />
                            <span>حفظ ومزامنة</span>
                        </button>
                        <button onClick={() => setShowApiConfig(false)} className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                            <ArrowLeft size={20} />
                        </button>
                    </div>
                 </>
             )}
          </div>
        </div>
        
        <div className="absolute bottom-4 text-center text-gray-400 text-xs">
             <p>© 2026 نظام نقاط البيع الذكي</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 md:flex md:flex-row-reverse relative transition-colors duration-300">
       <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} settings={settings} />
       <main className="flex-1 max-w-5xl mx-auto w-full animate-fade-in text-gray-900 dark:text-gray-100">{renderContent()}</main>
        {isSyncing && (
            <div className="fixed inset-0 bg-black bg-opacity-30 z-[110] flex items-center justify-center backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center animate-fade-in-up">
                <Loader2 className="animate-spin text-primary mb-3" size={48} />
                <p className="font-bold text-gray-800 dark:text-white text-lg">جاري مزامنة البيانات...</p>
                </div>
            </div>
        )}
       {/* UPDATED: Notifications at the TOP */}
       <div className="fixed top-4 left-4 right-4 z-[200] flex flex-col space-y-2 pointer-events-none md:top-4 md:left-4 md:right-auto md:w-80">
          {notifications.map((note) => (
            <div key={note.id} className={`pointer-events-auto p-4 rounded-xl shadow-lg border flex items-center space-x-3 space-x-reverse animate-fade-in transform transition-all ${note.type === 'success' ? 'bg-white dark:bg-gray-800 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300' : note.type === 'error' ? 'bg-white dark:bg-gray-800 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300' : 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'}`}>
                {note.type === 'success' && <CheckCircle size={20} />} {note.type === 'error' && <AlertCircle size={20} />}
                <p className="font-bold text-sm">{note.message}</p>
            </div>
          ))}
       </div>
    </div>
  );
};

export default App;