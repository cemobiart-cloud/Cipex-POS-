
import React, { useState, useEffect, useRef } from 'react';
import { Save, Link as LinkIcon, AlertCircle, CheckCircle, Loader2, Database, Users, Trash2, Edit, Plus, X, LogOut, User, Tag, Percent, Moon, Sun, LayoutGrid, List, Globe, Receipt, Store, Upload, Image as ImageIcon } from 'lucide-react';
import { GOOGLE_SCRIPT_URL } from '../constants';
import { setupSheetStructure, saveUserToSheets, updateUserInSheets, deleteUserFromSheets, uploadImageToDrive, getDirectDriveUrl } from '../services/apiService';
import { AppUser, NotificationType, UserRole, AppSettings, Language, ReceiptSize } from '../types';

interface SettingsViewProps {
  onRefreshData?: () => void;
  currentUser: AppUser | null;
  users: AppUser[];
  onAddUser: (user: AppUser) => void;
  onUpdateUser: (user: AppUser) => void;
  onDeleteUser: (id: string) => void;
  onLogout: () => void;
  notify: (msg: string, type: NotificationType) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (val: 'grid' | 'list') => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => Promise<boolean>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
  onRefreshData, currentUser, users, onAddUser, onUpdateUser, onDeleteUser, onLogout, notify,
  isDarkMode, setIsDarkMode, viewMode, setViewMode, settings, onUpdateSettings
}) => {
  const [apiUrl, setApiUrl] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [setupMessage, setSetupMessage] = useState('');

  // General Settings State
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [newCategory, setNewCategory] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // Logo Upload State
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // User Management State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [userScriptUrl, setUserScriptUrl] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    const savedUrl = localStorage.getItem('pos_api_url');
    setApiUrl(savedUrl || GOOGLE_SCRIPT_URL);
  }, []);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSaveApi = () => {
    localStorage.setItem('pos_api_url', apiUrl);
    setIsSaved(true);
    setTestStatus('idle'); 
    setSetupMessage('');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleSaveSettings = async () => {
      setIsSavingSettings(true);
      
      let finalLogoUrl = localSettings.storeLogo;

      // Handle Logo Upload if file selected
      if (logoFile) {
          setIsUploadingLogo(true);
          const url = await uploadImageToDrive(logoFile);
          if (url) {
              finalLogoUrl = url;
          } else {
              notify('فشل رفع الشعار', 'error');
          }
          setIsUploadingLogo(false);
      }

      const newSettings = { ...localSettings, storeLogo: finalLogoUrl };
      setLocalSettings(newSettings);
      
      const success = await onUpdateSettings(newSettings);
      
      setIsSavingSettings(false);
      setLogoFile(null);

      if (success) {
         notify('تم حفظ الإعدادات بنجاح', 'success');
      } else {
         notify('تم الحفظ محلياً ولكن فشل الحفظ في قاعدة البيانات', 'warning');
      }
  };

  const handleAddCategory = () => {
      if (newCategory && !localSettings.categories.includes(newCategory)) {
          setLocalSettings({
              ...localSettings,
              categories: [...localSettings.categories, newCategory]
          });
          setNewCategory('');
      }
  };

  const handleDeleteCategory = (cat: string) => {
      setLocalSettings({
          ...localSettings,
          categories: localSettings.categories.filter(c => c !== cat)
      });
  };

  const handleTestConnection = async () => {
    handleSaveApi();
    
    if (!apiUrl || apiUrl.includes('YOUR_GOOGLE_SCRIPT')) {
      alert('الرجاء إدخال رابط السكربت الصحيح أولاً');
      return;
    }

    setTestStatus('loading');
    setSetupMessage('جاري الاتصال والتحقق من هيكل البيانات...');

    try {
      const isSuccess = await setupSheetStructure();

      if (isSuccess) {
        setTestStatus('success');
        setSetupMessage('تم الاتصال بنجاح! تم إنشاء/التحقق من الصفحات وجاري مزامنة البيانات...');
        if (onRefreshData) setTimeout(() => onRefreshData(), 1000);
      } else {
        throw new Error('Setup failed');
      }
      
    } catch (error) {
      console.error("Test failed", error);
      setTestStatus('error');
      setSetupMessage('فشل الاتصال. تأكد من الرابط وصلاحيات السكربت.');
    }
  };

  // User Management Logic
  const openUserModal = (user?: AppUser) => {
    if (user) {
      setEditingUser(user);
      setUserName(user.name);
      setUserEmail(user.email);
      setUserRole(user.role);
      setUserScriptUrl(user.scriptUrl || '');
    } else {
      setEditingUser(null);
      setUserName('');
      setUserEmail('');
      setUserRole('user');
      setUserScriptUrl(localStorage.getItem('pos_api_url') || '');
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!userName || !userEmail) {
      notify('المرجو ملء جميع الحقول', 'error');
      return;
    }

    setIsSavingUser(true);
    
    const userPayload: AppUser = {
      id: editingUser ? editingUser.id : Date.now().toString(),
      name: userName,
      email: userEmail,
      role: userRole,
      scriptUrl: userScriptUrl 
    };

    if (editingUser) {
      onUpdateUser(userPayload);
      const success = await updateUserInSheets(userPayload);
      if(success) notify('تم تحديث المستخدم', 'success'); else notify('فشل الحفظ في قاعدة البيانات', 'error');
    } else {
      onAddUser(userPayload);
      const success = await saveUserToSheets(userPayload);
      if(success) notify('تم إضافة المستخدم', 'success'); else notify('فشل الحفظ في قاعدة البيانات', 'error');
    }

    setIsSavingUser(false);
    setIsUserModalOpen(false);
  };

  const handleDeleteUserClick = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
       onDeleteUser(id);
       const success = await deleteUserFromSheets(id);
       if(success) notify('تم حذف المستخدم', 'success');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">
      <div className="flex justify-between items-center">
         <h1 className="text-3xl font-bold text-gray-800 dark:text-white">الإعدادات</h1>
         
         <div className="flex items-center space-x-4 space-x-reverse">
            <div className="flex flex-col items-end">
                <span className="font-bold text-gray-900 dark:text-gray-100">{currentUser?.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">{currentUser?.role === 'admin' ? 'مسؤول' : 'مستخدم'}</span>
            </div>
            <button 
              onClick={onLogout}
              className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white p-2 rounded-xl transition"
              title="تسجيل الخروج"
            >
                <LogOut size={20} />
            </button>
         </div>
      </div>

      {/* APPEARANCE (For Everyone) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 max-w-2xl">
          <div className="flex items-center space-x-3 space-x-reverse mb-6">
            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg text-gray-600 dark:text-gray-200">
              {isDarkMode ? <Moon size={24} /> : <Sun size={24} />}
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">المظهر والعرض</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl flex justify-between items-center">
                 <span className="font-bold text-gray-700 dark:text-gray-200">الوضع الليلي</span>
                 <button 
                   onClick={() => setIsDarkMode(!isDarkMode)}
                   className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isDarkMode ? 'bg-primary' : 'bg-gray-300'}`}
                 >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 transform ${isDarkMode ? 'left-1' : 'left-7'}`}></div>
                 </button>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl flex justify-between items-center">
                 <span className="font-bold text-gray-700 dark:text-gray-200">طريقة عرض المنتجات</span>
                 <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-600">
                     <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-gray-200 dark:bg-gray-600 text-primary dark:text-blue-300' : 'text-gray-400'}`}>
                        <LayoutGrid size={18} />
                     </button>
                     <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-600 text-primary dark:text-blue-300' : 'text-gray-400'}`}>
                        <List size={18} />
                     </button>
                 </div>
              </div>
          </div>
      </div>

      {/* ADMIN ONLY SECTIONS */}
      {isAdmin && (
        <>
            {/* Store & Receipts Settings */}
           <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 max-w-2xl">
              <div className="flex items-center space-x-3 space-x-reverse mb-6">
                <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded-lg text-orange-600 dark:text-orange-300">
                  <Store size={24} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">إعدادات المتجر والفواتير</h2>
              </div>

              <div className="space-y-6">
                  {/* Store Name & Logo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">اسم المتجر</label>
                          <input 
                              type="text" 
                              value={localSettings.storeName}
                              onChange={(e) => setLocalSettings({...localSettings, storeName: e.target.value})}
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">شعار المتجر</label>
                          <div 
                            onClick={() => logoInputRef.current?.click()}
                            className="w-full h-10 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                             {logoFile ? (
                                 <span className="text-xs text-green-600 flex items-center"><CheckCircle size={12} className="ml-1"/> تم اختيار الملف</span>
                             ) : localSettings.storeLogo ? (
                                 <span className="text-xs text-blue-600 flex items-center"><ImageIcon size={12} className="ml-1"/> شعار موجود</span>
                             ) : (
                                 <span className="text-xs text-gray-500 flex items-center"><Upload size={12} className="ml-1"/> رفع صورة</span>
                             )}
                          </div>
                          <input 
                             type="file" 
                             ref={logoInputRef} 
                             className="hidden" 
                             accept="image/*" 
                             onChange={(e) => { if(e.target.files && e.target.files[0]) setLogoFile(e.target.files[0]); }} 
                          />
                      </div>
                  </div>

                  {/* Language & Currency */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                              <Globe size={16} className="ml-2"/> اللغة
                          </label>
                          <select 
                             value={localSettings.language}
                             onChange={(e) => setLocalSettings({...localSettings, language: e.target.value as Language})}
                             className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                          >
                              <option value="ar">العربية</option>
                              <option value="en">English</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">العملة</label>
                          <input 
                              type="text" 
                              value={localSettings.currency}
                              onChange={(e) => setLocalSettings({...localSettings, currency: e.target.value})}
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                              placeholder="MAD, $, €"
                          />
                      </div>
                  </div>

                  {/* Receipt Size & Tax */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                              <Receipt size={16} className="ml-2"/> حجم الإيصال
                          </label>
                          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                              <button 
                                onClick={() => setLocalSettings({...localSettings, receiptSize: 'thermal'})}
                                className={`flex-1 py-1.5 text-sm rounded-md transition ${localSettings.receiptSize === 'thermal' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                              >
                                  Thermal (80mm)
                              </button>
                              <button 
                                onClick={() => setLocalSettings({...localSettings, receiptSize: 'a4'})}
                                className={`flex-1 py-1.5 text-sm rounded-md transition ${localSettings.receiptSize === 'a4' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                              >
                                  A4
                              </button>
                          </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                            <Percent size={16} className="ml-2"/>
                            الضريبة (%)
                        </label>
                        <input
                            type="number"
                            value={localSettings.taxRate}
                            onChange={(e) => setLocalSettings({...localSettings, taxRate: parseFloat(e.target.value) || 0})}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white dir-ltr text-right"
                        />
                     </div>
                  </div>

                 {/* Categories */}
                 <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center"><Tag size={16} className="ml-2"/> فئات المنتجات</label>
                    <div className="flex space-x-2 space-x-reverse mb-3">
                        <input
                            type="text"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 dark:text-white"
                            placeholder="اسم الفئة الجديدة"
                        />
                        <button onClick={handleAddCategory} className="bg-primary text-white p-2 rounded-lg hover:bg-secondary"><Plus size={20}/></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {localSettings.categories.map((cat, idx) => (
                            <span key={idx} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-medium flex items-center border border-blue-100 dark:border-blue-800">
                                {cat}
                                <button onClick={() => handleDeleteCategory(cat)} className="mr-2 text-blue-400 hover:text-red-500"><X size={14} /></button>
                            </span>
                        ))}
                    </div>
                 </div>

                 <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings || isUploadingLogo}
                  className="w-full bg-gray-800 dark:bg-gray-700 text-white font-bold py-3 rounded-xl hover:bg-gray-900 transition flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-70"
                >
                   {(isSavingSettings || isUploadingLogo) ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                   <span>{(isSavingSettings || isUploadingLogo) ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
                </button>
              </div>
           </div>

          {/* Database Connection */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 max-w-2xl">
            <div className="flex items-center space-x-3 space-x-reverse mb-6">
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg text-primary dark:text-blue-300">
                <LinkIcon size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">ربط قاعدة البيانات</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  رابط Google Apps Script (Web App URL)
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none dir-ltr text-left dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="flex space-x-3 space-x-reverse">
                <button
                  onClick={handleSaveApi}
                  className={`flex-1 flex items-center justify-center space-x-2 space-x-reverse py-3 rounded-xl font-bold text-white transition-all ${
                    isSaved ? 'bg-green-600' : 'bg-primary hover:bg-secondary'
                  }`}
                >
                  {isSaved ? <><CheckCircle size={20} /><span>تم الحفظ</span></> : <><Save size={20} /><span>حفظ الرابط</span></>}
                </button>

                <button
                  onClick={handleTestConnection}
                  disabled={testStatus === 'loading'}
                  className={`flex-1 flex items-center justify-center space-x-2 space-x-reverse py-3 rounded-xl font-bold text-white transition-all ${
                    testStatus === 'loading' ? 'bg-gray-400' : 'bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600'
                  }`}
                >
                  {testStatus === 'loading' ? <Loader2 size={20} className="animate-spin" /> : <Database size={20} />}
                  <span>فحص ومزامنة</span>
                </button>
              </div>
              
              {testStatus === 'success' && (
                <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 p-4 rounded-xl flex items-start">
                  <CheckCircle size={24} className="ml-3 flex-shrink-0 mt-0.5" />
                  <div><p className="font-bold">تمت العملية!</p><p className="text-sm">{setupMessage}</p></div>
                </div>
              )}
              {testStatus === 'error' && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-xl flex items-start">
                  <AlertCircle size={24} className="ml-3 flex-shrink-0 mt-0.5" />
                  <div><p className="font-bold">خطأ!</p><p className="text-sm">{setupMessage}</p></div>
                </div>
              )}
            </div>
          </div>

          {/* User Management */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 max-w-2xl">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg text-purple-600 dark:text-purple-300">
                        <Users size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">إدارة المستخدمين</h2>
                </div>
                <button onClick={() => openUserModal()} className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 transition">
                    <Plus size={20} />
                </button>
            </div>

            <div className="space-y-3">
                {users.length === 0 ? <p className="text-gray-400 text-center">لا يوجد مستخدمين</p> : 
                  users.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                       <div className="flex items-center space-x-3 space-x-reverse">
                          <div className="bg-gray-200 dark:bg-gray-600 p-2 rounded-full"><User size={20} className="text-gray-600 dark:text-gray-300"/></div>
                          <div>
                              <p className="font-bold text-gray-800 dark:text-gray-200">{user.name} {user.id === currentUser?.id && '(أنت)'}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                              {user.scriptUrl && <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">✓ رابط السكربت موجود</p>}
                          </div>
                       </div>
                       <div className="flex items-center space-x-2 space-x-reverse">
                           <span className={`text-xs px-2 py-1 rounded-lg font-bold ${user.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'}`}>
                               {user.role === 'admin' ? 'مسؤول' : 'مستخدم'}
                           </span>
                           {user.id !== currentUser?.id && (
                               <>
                                <button onClick={() => openUserModal(user)} className="text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900 p-1 rounded transition"><Edit size={16} /></button>
                                <button onClick={() => handleDeleteUserClick(user.id)} className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900 p-1 rounded transition"><Trash2 size={16} /></button>
                               </>
                           )}
                           {user.id === currentUser?.id && (
                                <button onClick={() => openUserModal(user)} className="text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900 p-1 rounded transition"><Edit size={16} /></button>
                           )}
                       </div>
                    </div>
                  ))
                }
            </div>
          </div>
        </>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-fade-in-up">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-bold text-gray-800 dark:text-white">{editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم'}</h3>
                 <button onClick={() => setIsUserModalOpen(false)}><X size={24} className="text-gray-400" /></button>
             </div>
             <div className="space-y-4">
                 <div>
                     <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">الاسم</label>
                     <input className="w-full border p-2 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={userName} onChange={e => setUserName(e.target.value)} />
                 </div>
                 <div>
                     <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">البريد الإلكتروني</label>
                     <input className="w-full border p-2 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" type="email" value={userEmail} onChange={e => setUserEmail(e.target.value)} />
                 </div>
                 <div>
                     <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">الصلاحية</label>
                     <div className="flex space-x-2 space-x-reverse">
                         <button 
                            onClick={() => setUserRole('admin')}
                            className={`flex-1 py-2 rounded-lg border ${userRole === 'admin' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                         >مسؤول</button>
                         <button 
                            onClick={() => setUserRole('user')}
                            className={`flex-1 py-2 rounded-lg border ${userRole === 'user' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                         >مستخدم</button>
                     </div>
                 </div>
                 
                 {/* Script URL Input for Everyone (Visible) */}
                 <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                    <label className="block text-xs font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center justify-between">
                        <span>رابط السكربت الخاص بالمستخدم</span>
                        <LinkIcon size={12} />
                    </label>
                    <input 
                        className="w-full border border-blue-200 dark:border-blue-700 p-2 rounded-lg text-xs dir-ltr text-left dark:bg-gray-700 dark:text-white" 
                        type="text" 
                        value={userScriptUrl} 
                        onChange={e => setUserScriptUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/..."
                    />
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                        * سيتم استخدام هذا الرابط تلقائياً عند تسجيل الدخول بهذا البريد الإلكتروني.
                    </p>
                 </div>

                 <button onClick={handleSaveUser} disabled={isSavingUser} className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-secondary mt-2 flex justify-center items-center">
                    {isSavingUser ? <Loader2 className="animate-spin" /> : 'حفظ'}
                 </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
