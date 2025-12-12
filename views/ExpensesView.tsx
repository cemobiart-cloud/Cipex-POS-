
import React, { useState, useRef } from 'react';
import { DollarSign, Plus, X, Calendar, Upload, Loader2, FileText, Image as ImageIcon, Edit, Trash2, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { Expense, NotificationType, AppUser } from '../types';
import { uploadImageToDrive, saveExpenseToSheets, updateExpenseInSheets, deleteExpenseFromSheets, getDirectDriveUrl } from '../services/apiService';

interface ExpensesViewProps {
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onUpdateExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onRefreshData: () => Promise<void> | void; // New prop for syncing
  notify: (msg: string, type: NotificationType) => void;
  currentUser: AppUser | null;
  currency: string; // New
}

const ExpensesView: React.FC<ExpensesViewProps> = ({ expenses, onAddExpense, onUpdateExpense, onDeleteExpense, onRefreshData, notify, currentUser, currency }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [existingImageUrl, setExistingImageUrl] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'file' | 'url'>('file');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === 'admin';
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);

  const openAddModal = () => {
    setEditingExpense(null);
    setTitle('');
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setExistingImageUrl('');
    setSelectedFile(null);
    setImageInputMode('file');
    setIsModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setTitle(expense.title);
    setAmount(expense.amount.toString());
    setDescription(expense.description || '');
    setDate(expense.date);
    setExistingImageUrl(expense.image || '');
    setSelectedFile(null);
    setImageInputMode('file');
    setIsModalOpen(true);
  };

  const requestDelete = (id: string) => {
    setDeleteConfirmationId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmationId) return;

    const id = deleteConfirmationId;
    onDeleteExpense(id);
    setDeleteConfirmationId(null);
    
    const success = await deleteExpenseFromSheets(id);
    if (!success) {
      notify('فشل الحذف من قاعدة البيانات', 'error');
    } else {
      notify('تم حذف النفقة', 'success');
      onRefreshData(); // Sync
    }
  };

  const handleSaveExpense = async () => {
    if (!title || !amount) {
      notify('المرجو إدخال عنوان ومبلغ النفقة', 'error');
      return;
    }

    setIsUploading(true);
    let imageUrl = existingImageUrl;
    
    // Use URL if mode is URL and value exists
    if (imageInputMode === 'url' && existingImageUrl) {
        imageUrl = existingImageUrl;
    }

    if (selectedFile && imageInputMode === 'file') {
        const uploadedUrl = await uploadImageToDrive(selectedFile);
        if (uploadedUrl) {
            imageUrl = uploadedUrl;
        } else {
            notify('فشل رفع الصورة', 'error');
        }
    }

    const expenseData: Expense = {
      id: editingExpense ? editingExpense.id : Date.now().toString(),
      title,
      amount: parseFloat(amount),
      date: date,
      description,
      image: imageUrl
    };

    if (editingExpense) {
      onUpdateExpense(expenseData);
      const success = await updateExpenseInSheets(expenseData);
      if (success) {
         notify('تم تحديث النفقة', 'success');
         onRefreshData(); // Sync
      } else {
         notify('فشل التحديث في قاعدة البيانات', 'error');
      }
    } else {
      onAddExpense(expenseData);
      const success = await saveExpenseToSheets(expenseData);
      if (success) {
         notify('تم إضافة النفقة', 'success');
         onRefreshData(); // Sync
      } else {
         notify('فشل النسخ لقاعدة البيانات', 'info');
      }
    }

    setIsUploading(false);
    setIsModalOpen(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">النفقات</h1>
        {isAdmin && (
            <button 
            onClick={openAddModal}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl flex items-center space-x-2 space-x-reverse shadow-md transition-transform active:scale-95"
            >
            <Plus size={20} />
            <span>إضافة نفقة</span>
            </button>
        )}
      </header>

      {/* Summary Card */}
      <div className="bg-gradient-to-l from-red-500 to-red-600 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center space-x-4 space-x-reverse mb-2">
          <div className="bg-white/20 p-2 rounded-lg">
            <DollarSign size={24} />
          </div>
          <p className="text-red-100">إجمالي المصروفات</p>
        </div>
        <h2 className="text-4xl font-bold dir-ltr text-right" dir="ltr">{totalExpenses} {currency}</h2>
      </div>

      {/* Expenses List */}
      <div className="space-y-4">
        <h3 className="font-bold text-gray-700">سجل المصروفات</h3>
        {expenses.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300">
            لا توجد نفقات مسجلة
          </div>
        ) : (
          expenses.slice().reverse().map((expense) => (
            <div key={expense.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative group">
              <div className="flex justify-between items-start">
                  <div className="flex space-x-4 space-x-reverse">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden relative cursor-pointer" onClick={() => expense.image && window.open(expense.image, '_blank')}>
                          <FileText className="text-gray-400 w-6 h-6" />
                          {expense.image && (
                              <img 
                                src={getDirectDriveUrl(expense.image)} 
                                alt="Receipt" 
                                className="absolute inset-0 w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                          )}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{expense.title}</h4>
                        {expense.description && (
                            <p className="text-sm text-gray-500">{expense.description}</p>
                        )}
                        <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2 space-x-reverse">
                        <Calendar size={12} className="ml-1"/> 
                        <span className="dir-ltr">{new Date(expense.date).toLocaleDateString('en-GB')}</span>
                        </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-red-600 block" dir="ltr">-{expense.amount} {currency}</span>
                  </div>
              </div>

              {/* Action Buttons (visible on hover) */}
              {isAdmin && (
                  <div className="absolute top-2 left-2 flex space-x-2 space-x-reverse opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(expense)} className="bg-gray-100 hover:bg-blue-100 text-blue-600 p-1.5 rounded-full transition">
                    <Edit size={16} />
                    </button>
                    <button onClick={() => requestDelete(expense.id)} className="bg-gray-100 hover:bg-red-100 text-red-600 p-1.5 rounded-full transition">
                    <Trash2 size={16} />
                    </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-fade-in-up h-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">{editingExpense ? 'تعديل النفقة' : 'تسجيل نفقة جديدة'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">عنوان النفقة *</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="مثال: فاتورة الكهرباء"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف (اختياري)</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="تفاصيل إضافية..."
                  rows={2}
                />
              </div>

              <div className="flex space-x-3 space-x-reverse">
                 <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ ({currency}) *</label>
                    <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none dir-ltr text-right"
                    placeholder="0.00"
                    />
                 </div>
                 <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                    <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none"
                    />
                 </div>
              </div>

              {/* Receipt Image Upload or URL */}
              <div>
                 <div className="flex items-center justify-between mb-2">
                     <label className="text-sm font-medium text-gray-700">صورة الفاتورة/الإيصال</label>
                     <button 
                         onClick={() => {
                             setImageInputMode(prev => prev === 'file' ? 'url' : 'file');
                             setSelectedFile(null); 
                         }} 
                         className="text-xs text-red-600 hover:underline flex items-center"
                       >
                         {imageInputMode === 'file' ? 'أو استخدم رابط صورة' : 'أو ارفع ملف'}
                         {imageInputMode === 'file' ? <LinkIcon size={12} className="mr-1" /> : <Upload size={12} className="mr-1" />}
                       </button>
                 </div>
                 
                 {imageInputMode === 'file' ? (
                     <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-50 transition relative overflow-hidden"
                    >
                        {(selectedFile || (existingImageUrl && !existingImageUrl.startsWith('http'))) ? (
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <ImageIcon className="text-red-500" size={20} />
                                <span className="text-sm text-gray-700">{selectedFile ? selectedFile.name : 'الصورة الحالية'}</span>
                            </div>
                        ) : (
                            <>
                                <Upload className="text-gray-400 mb-1" size={20} />
                                <span className="text-xs text-gray-500">اختر صورة من الجهاز</span>
                            </>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]); }} />
                    </div>
                 ) : (
                     <div className="space-y-2">
                         <input 
                            type="text" 
                            placeholder="https://example.com/receipt.png" 
                            value={existingImageUrl}
                            onChange={(e) => setExistingImageUrl(e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 outline-none dir-ltr text-left focus:ring-2 focus:ring-red-500"
                         />
                         {existingImageUrl && (
                             <div className="h-20 w-20 mx-auto border rounded overflow-hidden">
                                 <img src={getDirectDriveUrl(existingImageUrl)} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="preview" />
                             </div>
                         )}
                     </div>
                 )}
              </div>

              <button 
                onClick={handleSaveExpense}
                disabled={isUploading}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition mt-4 flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-70"
              >
                {isUploading ? <Loader2 className="animate-spin" /> : <DollarSign size={20} />}
                <span>{isUploading ? 'جاري الحفظ...' : 'حفظ النفقة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                <p className="text-gray-500">هل أنت متأكد من حذف هذه النفقة؟</p>
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

export default ExpensesView;
