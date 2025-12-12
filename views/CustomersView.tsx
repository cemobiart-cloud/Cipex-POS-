
import React, { useState } from 'react';
import { Customer, NotificationType, AppUser } from '../types';
import { Phone, MapPin, UserCircle, Edit, Trash2, X, Save, Loader2, AlertTriangle } from 'lucide-react';
import { updateCustomerInSheets, deleteCustomerFromSheets } from '../services/apiService';

interface CustomersViewProps {
  customers: Customer[];
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onRefreshData: () => Promise<void> | void; // New prop for syncing
  notify: (msg: string, type: NotificationType) => void;
  currentUser: AppUser | null;
  currency: string; // New
}

const CustomersView: React.FC<CustomersViewProps> = ({ customers, onUpdateCustomer, onDeleteCustomer, onRefreshData, notify, currentUser, currency }) => {
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const startEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditName(customer.name);
    setEditAddress(customer.address);
    setEditPhone(customer.phone);
  };

  const cancelEdit = () => {
    setEditingCustomer(null);
  };

  const handleSave = async () => {
    if (!editingCustomer) return;
    setIsSaving(true);
    
    const updatedCustomer: Customer = {
      ...editingCustomer,
      name: editName,
      address: editAddress,
      phone: editPhone
    };

    onUpdateCustomer(updatedCustomer);
    const success = await updateCustomerInSheets(updatedCustomer);
    
    if (success) {
      notify('تم تحديث بيانات العميل', 'success');
      onRefreshData(); // Sync
    } else {
      notify('فشل تحديث البيانات', 'error');
    }
    
    setIsSaving(false);
    setEditingCustomer(null);
  };

  const requestDelete = (id: string) => {
    setDeleteConfirmationId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmationId) return;

    const id = deleteConfirmationId;
    onDeleteCustomer(id);
    setDeleteConfirmationId(null);

    const success = await deleteCustomerFromSheets(id);
    if (success) {
       notify('تم حذف العميل', 'success');
       onRefreshData(); // Sync
    } else {
       notify('فشل حذف العميل', 'error');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">
      <h1 className="text-3xl font-bold text-gray-800">العملاء</h1>
      
      <div className="grid gap-4">
        {customers.length === 0 ? (
          <div className="text-center py-10 text-gray-400">لا يوجد عملاء مسجلين</div>
        ) : (
          customers.slice().reverse().map((customer, idx) => (
            <div key={customer.id || idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative group">
               {editingCustomer?.id === customer.id ? (
                 <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">اسم العميل</label>
                        <input className="w-full border rounded p-2 outline-none" value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">رقم الهاتف</label>
                        <input className="w-full border rounded p-2 outline-none" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">العنوان</label>
                        <input className="w-full border rounded p-2 outline-none" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
                    </div>
                    
                    <div className="flex space-x-2 space-x-reverse justify-end pt-2">
                       <button onClick={handleSave} disabled={isSaving} className="bg-green-600 text-white px-3 py-2 rounded-lg flex items-center hover:bg-green-700 transition">
                         {isSaving ? <Loader2 size={16} className="animate-spin ml-1" /> : <Save size={16} className="ml-1" />} حفظ
                       </button>
                       <button onClick={cancelEdit} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg flex items-center hover:bg-gray-200 transition">
                         <X size={16} className="ml-1" /> إلغاء
                       </button>
                    </div>
                 </div>
               ) : (
                 <div className="flex items-start justify-between">
                   <div className="flex space-x-4 space-x-reverse">
                      <div className="bg-gray-100 p-3 rounded-full text-gray-600">
                        <UserCircle size={32} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{customer.name}</h3>
                        <div className="space-y-1 mt-1">
                          <p className="text-sm text-gray-500 flex items-center dir-ltr justify-end md:justify-start">
                            {customer.phone} <Phone size={14} className="mr-2 md:mr-0 md:ml-2" /> 
                          </p>
                          <p className="text-sm text-gray-500 flex items-center">
                            <MapPin size={14} className="ml-2" /> {customer.address}
                          </p>
                        </div>
                      </div>
                   </div>
                   <div className="flex flex-col items-end space-y-2">
                       {isAdmin && (
                           <div className="flex space-x-2 space-x-reverse opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEdit(customer)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg transition"><Edit size={18} /></button>
                                <button onClick={() => requestDelete(customer.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition"><Trash2 size={18} /></button>
                           </div>
                       )}
                       {(customer as any).totalSpent !== undefined && (
                         <div className="bg-blue-50 px-2 py-1 rounded text-xs text-blue-700 font-bold dir-ltr">
                           {(customer as any).totalSpent} {currency}
                         </div>
                       )}
                   </div>
                 </div>
               )}
            </div>
          ))
        )}
      </div>

      {deleteConfirmationId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-fade-in-up">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">تأكيد الحذف</h3>
                <p className="text-gray-500">هل أنت متأكد من حذف هذا العميل؟</p>
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

export default CustomersView;
