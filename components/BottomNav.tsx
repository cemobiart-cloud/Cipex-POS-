
import React from 'react';
import { Package, ShoppingCart, DollarSign, Users, Settings, LayoutDashboard } from 'lucide-react';
import { Tab, AppSettings } from '../types';
import { getDirectDriveUrl } from '../services/apiService';

interface BottomNavProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  settings?: AppSettings; // Added settings prop
}

const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange, settings }) => {
  const navItems = [
    { id: Tab.DASHBOARD, label: 'الرئيسية', icon: LayoutDashboard },
    { id: Tab.PRODUCTS, label: 'المنتجات', icon: Package },
    { id: Tab.SALES, label: 'المبيعات', icon: ShoppingCart },
    { id: Tab.EXPENSES, label: 'النفقات', icon: DollarSign },
    { id: Tab.CUSTOMERS, label: 'العملاء', icon: Users },
    { id: Tab.SETTINGS, label: 'الإعدادات', icon: Settings },
  ];

  const storeName = settings?.storeName || 'POS System';
  const logoUrl = settings?.storeLogo ? getDirectDriveUrl(settings.storeLogo) : '';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 md:sticky md:top-0 md:h-screen md:w-64 md:flex-col md:border-r md:border-t-0 md:justify-start md:p-4 transition-colors duration-300">
      <div className="flex justify-around items-center h-16 md:flex-col md:h-auto md:space-y-4 md:items-stretch">
        
        {/* Brand Section (Hidden on Mobile, Visible on Desktop) */}
        <div className="hidden md:flex flex-col items-center mb-6 px-2 text-center">
            {logoUrl ? (
                <div className="w-24 h-24 mb-3 rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                    <img 
                        src={logoUrl} 
                        alt={storeName} 
                        className="w-full h-full object-contain" 
                        referrerPolicy="no-referrer"
                    />
                </div>
            ) : null}
            <div className="text-xl font-bold text-primary dark:text-blue-400 break-words w-full">{storeName}</div>
        </div>

        {/* Navigation Items */}
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col md:flex-row md:space-x-4 md:space-x-reverse items-center justify-center w-full h-full md:h-12 md:rounded-xl md:px-4 transition-all duration-200 group ${
              currentTab === item.id
                ? 'text-primary md:bg-blue-50 dark:md:bg-blue-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <item.icon className={`w-6 h-6 md:w-5 md:h-5 mb-1 md:mb-0 transition-transform ${currentTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span className="text-[10px] md:text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BottomNav;
