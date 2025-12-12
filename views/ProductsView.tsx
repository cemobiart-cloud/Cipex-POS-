
import React, { useState, useRef, useEffect } from 'react';
import { Product, SaleRecord, NotificationType, AppUser, CartItem, Customer, AppSettings } from '../types';
import ProductDialog from '../components/ProductDialog';
import BarcodeScanner from '../components/BarcodeScanner';
import CartDrawer from '../components/CartDrawer';
import { Search, Plus, X, Upload, Loader2, Package, CheckCircle, AlertTriangle, Edit, Trash2, QrCode, Download, ScanBarcode, Link as LinkIcon, Image as ImageIcon, RefreshCw, ShoppingCart } from 'lucide-react';
import { uploadImageToDrive, saveProductToSheets, updateProductInSheets, deleteProductFromSheets, getDirectDriveUrl, saveSaleToSheets } from '../services/apiService';
import QRCode from 'qrcode';
import { generateReceiptPDF } from '../services/pdfService';

interface ProductsViewProps {
  products: Product[];
  onSaleComplete: (sale: SaleRecord) => void;
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onRefreshData: () => Promise<void> | void; // New prop for syncing
  notify: (msg: string, type: NotificationType) => void;
  currentUser: AppUser | null;
  viewMode?: 'grid' | 'list'; 
  categories: string[]; // From App
  taxRate: number; // From App
  customers: Customer[]; // Pass customers to check existing ones
  settings: AppSettings; // Use settings for receipt logic
}

const ProductsView: React.FC<ProductsViewProps> = ({ 
  products, onSaleComplete, onAddProduct, onUpdateProduct, onDeleteProduct, onRefreshData, notify, currentUser, viewMode = 'grid',
  categories, taxRate, customers, settings
}) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanContext, setScanContext] = useState<'search' | 'form'>('search');

  // QR Modal State
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  
  // Form State
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('10');
  const [productCategory, setProductCategory] = useState(''); 
  const [productBarcode, setProductBarcode] = useState(''); 
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Image Input Mode (File vs URL)
  const [imageInputMode, setImageInputMode] = useState<'file' | 'url'>('file');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = currentUser?.role === 'admin';
  const currency = settings.currency || 'MAD';

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    // Search in Name OR Barcode
    const matchesSearch = p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.toLowerCase().includes(term));
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Cart Handlers
  const handleAddToCart = (item: CartItem) => {
      setCart(prev => [...prev, item]);
      notify('تمت الإضافة للسلة', 'success');
  };

  const handleUpdateQuantity = (cartId: string, newQuantity: number) => {
      setCart(prevCart => prevCart.map(item => {
          if (item.cartId === cartId) {
              // Stock check
              if (newQuantity > item.stock) {
                  notify(`الكمية المتاحة فقط ${item.stock}`, 'warning');
                  return item;
              }
              if (newQuantity < 1) return item; // Don't allow less than 1 via buttons

              // Recalculate financials
              const subtotal = item.price * newQuantity;
              
              let discountAmount = 0;
              // We assume 'discountValue' is the parameter entered (either % or fixed amt)
              if (item.discountType === 'percentage') {
                  discountAmount = subtotal * (Math.min(item.discountValue, 100) / 100);
              } else {
                  discountAmount = Math.min(item.discountValue, subtotal);
              }
              
              const taxableAmount = subtotal - discountAmount;
              const taxAmount = taxableAmount * item.taxRate; // taxRate is stored as decimal e.g., 0.20
              const finalTotal = taxableAmount + taxAmount;

              return { 
                  ...item, 
                  quantity: newQuantity, 
                  subtotal, 
                  discount: discountAmount, 
                  taxAmount, 
                  finalTotal 
              };
          }
          return item;
      }));
  };

  const handleRemoveFromCart = (cartId: string) => {
      setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const handleCheckout = async (customerInput: Customer) => {
    setIsCheckoutProcessing(true);
    const timestamp = new Date().toISOString();
    
    // Check if customer exists by phone to ensure we reuse the correct ID
    // If new, generate a UNIQUE ID (CUST-TIMESTAMP-RANDOM)
    const existingCustomer = customers.find(c => c.phone === customerInput.phone);
    
    const finalCustomer: Customer = {
        ...customerInput,
        id: existingCustomer ? existingCustomer.id : `CUST-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    };

    // Loop through cart items and save each as a sale record for the backend
    let lastSaleRecord: SaleRecord | null = null;
    let successCount = 0;

    // Use a unified ID for grouping in the frontend/receipt if needed
    const orderId = "ORDER-" + Date.now().toString().slice(-6);

    for (const item of cart) {
        const saleRecord: SaleRecord = {
            id: Date.now().toString() + Math.floor(Math.random() * 1000), // Unique ID for DB row
            product: { id: item.id, name: item.name, price: item.price, image: item.image, stock: item.stock, category: item.category, barcode: item.barcode },
            quantity: item.quantity,
            total: item.finalTotal,
            subtotal: item.subtotal,
            discount: item.discount,
            discountValue: item.discountValue,
            discountType: item.discountType,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            customer: finalCustomer,
            timestamp: timestamp // Share same timestamp for grouping
        };

        const success = await saveSaleToSheets(saleRecord);
        if (success) {
            onSaleComplete(saleRecord); // Update local state (this adds individual rows)
            lastSaleRecord = saleRecord; 
            successCount++;
        }
    }

    setIsCheckoutProcessing(false);

    if (successCount === cart.length) {
        notify('تم إكمال الطلب بنجاح', 'success');
        
        // --- PRINT PROFESSIONAL RECEIPT ---
        // Construct a "Master" SaleRecord just for the receipt generator
        // This contains the list of all items
        if (lastSaleRecord) {
             const masterSale: SaleRecord = {
                 ...lastSaleRecord,
                 id: orderId,
                 product: { ...lastSaleRecord.product, name: 'طلب مجمع' }, // Placeholder
                 // Calculate Totals
                 quantity: cart.reduce((acc, i) => acc + i.quantity, 0),
                 subtotal: cart.reduce((acc, i) => acc + i.subtotal, 0),
                 discount: cart.reduce((acc, i) => acc + i.discount, 0),
                 taxAmount: cart.reduce((acc, i) => acc + i.taxAmount, 0),
                 total: cart.reduce((acc, i) => acc + i.finalTotal, 0),
                 // CRITICAL: Pass the cart items to the PDF generator
                 cartItems: cart 
             };
             
             generateReceiptPDF(masterSale, settings); 
        }

        setCart([]); // Clear cart
        setIsCartOpen(false);
    } else if (successCount > 0) {
        notify(`تم حفظ ${successCount} من ${cart.length} منتجات`, 'warning');
        setCart([]);
        setIsCartOpen(false);
    } else {
        notify('فشل إتمام الطلب', 'error');
    }
  };


  // QR Code Generation Effect
  useEffect(() => {
    if (qrProduct) {
      const qrData = JSON.stringify({
          id: qrProduct.id,
          name: qrProduct.name,
          price: qrProduct.price
      });
      
      QRCode.toDataURL(qrData, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => {
          console.error(err);
          notify('فشل توليد رمز QR', 'error');
        });
    } else {
      setQrCodeDataUrl('');
    }
  }, [qrProduct, notify]);

  // Handle Scan Result
  const handleScanSuccess = (decodedText: string) => {
      setIsScannerOpen(false);
      
      if (scanContext === 'form') {
          setProductBarcode(decodedText);
          notify('تم قراءة الباركود بنجاح', 'success');
          return;
      }

      // Search Mode logic
      let foundProduct: Product | undefined;
      
      // Try to parse as JSON (internal QR code)
      try {
          const data = JSON.parse(decodedText);
          if (data && data.id) foundProduct = products.find(p => p.id === data.id);
      } catch (e) {
          // It's a raw barcode or string
          foundProduct = products.find(p => p.id === decodedText || p.name === decodedText || p.barcode === decodedText);
      }

      if (foundProduct) {
          notify(`تم التعرف على: ${foundProduct.name}`, 'success');
          setSelectedProduct(foundProduct);
      } else {
          // If not found, populate the search bar so the user can see what was scanned or add it
          setSearchTerm(decodedText);
          notify('لم يتم العثور على المنتج، تم وضع الكود في البحث', 'warning');
      }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setProductName('');
    setProductPrice('');
    setProductStock('10');
    setProductCategory(categories.length > 0 ? categories[0] : '');
    setProductBarcode('');
    setExistingImageUrl('');
    setSelectedFile(null);
    setImageInputMode('file');
    setIsModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setEditingProduct(product);
    setProductName(product.name);
    setProductPrice(product.price.toString());
    setProductStock(product.stock.toString());
    setProductCategory(product.category || (categories.length > 0 ? categories[0] : ''));
    setProductBarcode(product.barcode || '');
    setExistingImageUrl(product.image);
    setSelectedFile(null);
    setImageInputMode('file');
    setIsModalOpen(true);
  };

  const openQrModal = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setQrProduct(product);
  };

  const requestDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmationId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmationId) return;
    const id = deleteConfirmationId;
    onDeleteProduct(id);
    setDeleteConfirmationId(null);
    const success = await deleteProductFromSheets(id);
    if (!success) {
      notify('فشل الحذف من قاعدة البيانات', 'error');
    } else {
      notify('تم حذف المنتج بنجاح', 'success');
      onRefreshData(); // Sync
    }
  };

  // Generate Unique Moroccan Barcode
  const handleGenerateBarcode = () => {
    // Morocco Prefix 611
    const prefix = "611";
    let isUnique = false;
    let generatedCode = "";
    
    // Attempt to generate a unique code (limit loops for safety)
    let attempts = 0;
    while (!isUnique && attempts < 100) {
       // Generate 10 random digits
       const randomPart = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
       generatedCode = `${prefix}${randomPart}`;
       
       // Check if this code exists in products
       const exists = products.some(p => p.barcode === generatedCode);
       if (!exists) {
         isUnique = true;
       }
       attempts++;
    }

    if (isUnique) {
      setProductBarcode(generatedCode);
      notify('تم توليد باركود مغربي جديد', 'success');
    } else {
      notify('فشل توليد كود فريد، حاول مرة أخرى', 'error');
    }
  };

  const handleSaveProduct = async () => {
    if (!productName || !productPrice) {
      notify('المرجو إدخال اسم المنتج والسعر', 'error');
      return;
    }

    // Check Barcode Uniqueness
    if (productBarcode) {
        const existingProduct = products.find(p => p.barcode === productBarcode);
        // If it exists AND (we are adding new OR we are editing and the IDs don't match)
        if (existingProduct && (!editingProduct || existingProduct.id !== editingProduct.id)) {
            notify(`الباركود "${productBarcode}" مستخدم بالفعل لمنتج: ${existingProduct.name}`, 'error');
            return;
        }
    }

    setIsUploading(true);
    let imageUrl = existingImageUrl;
    
    // If user provided a direct URL but no file, use that URL
    if (imageInputMode === 'url' && existingImageUrl) {
        imageUrl = existingImageUrl;
    } 
    else if (!imageUrl && !selectedFile) {
        imageUrl = `https://picsum.photos/200/200?random=${Date.now()}`;
    }

    if (selectedFile && imageInputMode === 'file') {
        const uploadedUrl = await uploadImageToDrive(selectedFile);
        if (uploadedUrl) imageUrl = uploadedUrl;
        else notify('فشل رفع الصورة، سيتم استخدام صورة افتراضية', 'error');
    }

    const productData: Product = {
      id: editingProduct ? editingProduct.id : Date.now().toString(),
      name: productName,
      price: parseFloat(productPrice),
      image: imageUrl,
      stock: parseInt(productStock) || 0,
      category: productCategory,
      barcode: productBarcode
    };

    if (editingProduct) {
      onUpdateProduct(productData);
      const success = await updateProductInSheets(productData);
      if (success) {
         notify('تم تحديث المنتج', 'success');
         onRefreshData(); // Sync
      } else {
         notify('فشل تحديث المنتج في قاعدة البيانات', 'error');
      }
    } else {
      onAddProduct(productData);
      const success = await saveProductToSheets(productData);
      if (success) {
         notify('تم إضافة المنتج', 'success');
         onRefreshData(); // Sync
      } else {
         notify('تم الحفظ محلياً ولكن فشل النسخ لقاعدة البيانات', 'info');
      }
    }

    setIsUploading(false);
    setIsModalOpen(false);
  };

  const handleOpenScanner = (mode: 'search' | 'form') => {
      setScanContext(mode);
      setIsScannerOpen(true);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8 relative">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">المنتجات</h1>
        <div className="flex space-x-2 space-x-reverse">
            <button onClick={() => handleOpenScanner('search')} className="bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-xl flex items-center space-x-2 space-x-reverse shadow-md transition-transform active:scale-95">
                <ScanBarcode size={20} />
                <span className="hidden md:inline">مسح كود</span>
            </button>
            {isAdmin && (
                <button onClick={openAddModal} className="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-xl flex items-center space-x-2 space-x-reverse shadow-md transition-transform active:scale-95">
                <Plus size={20} />
                <span className="hidden md:inline">إضافة منتج</span>
                </button>
            )}
        </div>
      </header>

      <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input 
            type="text" 
            placeholder="بحث عن منتج (الاسم أو الباركود)..." 
            className="w-full pl-4 pr-12 py-3 rounded-xl border-none shadow-sm bg-white dark:bg-gray-800 dark:text-white ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary outline-none transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute right-4 top-3.5 text-gray-400" size={20} />
          </div>

          {/* Categories Filter Bar */}
          {categories.length > 0 && (
              <div className="flex space-x-2 space-x-reverse overflow-x-auto pb-2 custom-scrollbar">
                  <button 
                      onClick={() => setSelectedCategory('All')}
                      className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedCategory === 'All' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                      الكل
                  </button>
                  {categories.map((cat, idx) => (
                      <button 
                          key={idx}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                          {cat}
                      </button>
                  ))}
              </div>
          )}
      </div>

      {/* Render Products based on ViewMode */}
      {viewMode === 'grid' ? (
          // GRID VIEW
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.slice().reverse().map((product) => {
              const isLowStock = product.stock <= 5;
              return (
                <div 
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border ${isLowStock ? 'border-red-300 ring-2 ring-red-100 dark:ring-red-900/50' : 'border-gray-100 dark:border-gray-700'} overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-95 flex flex-col h-full group`}
                >
                  <div className="aspect-square w-full bg-gray-100 dark:bg-gray-700 relative flex items-center justify-center overflow-hidden">
                    <Package className="text-gray-300 dark:text-gray-600 w-12 h-12" strokeWidth={1} />
                    <img 
                      src={getDirectDriveUrl(product.image)} 
                      alt={product.name} 
                      className="absolute inset-0 w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400?text=No+Image'; }}
                    />
                    <div className={`absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center z-20 ${isLowStock ? 'bg-red-500 text-white animate-pulse' : 'bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300'}`}>
                        {isLowStock ? <AlertTriangle size={12} className="ml-1" /> : <Package size={12} className="ml-1" />}
                        {product.stock}
                    </div>
                     {product.category && (
                        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm bg-black/60 text-white z-20">
                            {product.category}
                        </div>
                     )}
                    
                    {/* Action Buttons Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2 space-x-reverse z-30" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => openQrModal(e, product)} className="bg-white p-2 rounded-full text-gray-700 hover:bg-gray-100 transition transform hover:scale-110" title="QR Code">
                            <QrCode size={18} />
                        </button>
                        {isAdmin && (
                            <>
                                <button onClick={(e) => openEditModal(e, product)} className="bg-white p-2 rounded-full text-blue-600 hover:bg-blue-50 transition transform hover:scale-110" title="تعديل">
                                    <Edit size={18} />
                                </button>
                                <button onClick={(e) => requestDelete(e, product.id)} className="bg-white p-2 rounded-full text-red-600 hover:bg-red-50 transition transform hover:scale-110" title="حذف">
                                    <Trash2 size={18} />
                                </button>
                            </>
                        )}
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-grow justify-between">
                    <h3 className="font-bold text-gray-800 dark:text-white text-sm md:text-base mb-1 line-clamp-2">{product.name}</h3>
                    <div className="flex justify-between items-end">
                       <p className="text-primary font-bold dir-ltr text-right">{product.price} {currency}</p>
                       {isLowStock && <span className="text-[10px] text-red-600 font-bold bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">مخزون منخفض</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      ) : (
          // LIST VIEW
          <div className="space-y-3">
             {filteredProducts.slice().reverse().map((product) => {
               const isLowStock = product.stock <= 5;
               return (
                   <div 
                     key={product.id}
                     onClick={() => setSelectedProduct(product)}
                     className={`bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border ${isLowStock ? 'border-red-300 dark:border-red-900' : 'border-gray-100 dark:border-gray-700'} flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition group`}
                   >
                       <div className="flex items-center space-x-4 space-x-reverse">
                           <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0 relative overflow-hidden flex items-center justify-center">
                                <Package className="text-gray-300 dark:text-gray-600 w-8 h-8" strokeWidth={1} />
                                <img 
                                  src={getDirectDriveUrl(product.image)} 
                                  alt={product.name} 
                                  className="absolute inset-0 w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image'; }}
                                />
                           </div>
                           <div>
                               <h3 className="font-bold text-gray-800 dark:text-white">{product.name}</h3>
                               <div className="flex items-center space-x-2 space-x-reverse mt-1">
                                   <span className="text-primary font-bold text-sm dir-ltr">{product.price} {currency}</span>
                                   {product.category && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md">{product.category}</span>}
                                   {product.barcode && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-md flex items-center"><ScanBarcode size={10} className="ml-1"/>{product.barcode}</span>}
                               </div>
                           </div>
                       </div>
                       
                       <div className="flex items-center space-x-4 space-x-reverse">
                            <div className={`text-sm font-bold ${isLowStock ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                {product.stock} قطعة
                            </div>
                            
                            {/* List Actions */}
                            <div className="hidden md:flex items-center space-x-2 space-x-reverse">
                                 <button onClick={(e) => openQrModal(e, product)} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"><QrCode size={18} /></button>
                                 {isAdmin && (
                                     <>
                                        <button onClick={(e) => openEditModal(e, product)} className="p-2 text-blue-500 hover:text-blue-700"><Edit size={18} /></button>
                                        <button onClick={(e) => requestDelete(e, product.id)} className="p-2 text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                     </>
                                 )}
                            </div>
                       </div>
                   </div>
               )
             })}
          </div>
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && (
          <button 
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-24 md:bottom-10 left-6 bg-primary hover:bg-secondary text-white p-4 rounded-full shadow-2xl z-[80] animate-bounce-in flex items-center justify-center"
          >
              <div className="relative">
                 <ShoppingCart size={28} />
                 <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-primary">
                    {cart.length}
                 </span>
              </div>
          </button>
      )}

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onRemoveItem={handleRemoveFromCart}
        onUpdateQuantity={handleUpdateQuantity}
        onCheckout={handleCheckout}
        isProcessing={isCheckoutProcessing}
        currency={currency} // Pass currency
      />

      <ProductDialog 
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
        taxRate={taxRate} 
        currency={currency} // Pass currency
      />

      {/* QR Code Scanner */}
      {isScannerOpen && (
          <BarcodeScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScannerOpen(false)} />
      )}

      {/* QR Code Modal */}
      {qrProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4" onClick={() => setQrProduct(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-fade-in-up text-center" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-bold text-gray-800 dark:text-white">QR Code للمنتج</h3>
                 <button onClick={() => setQrProduct(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
             </div>
             
             <div className="flex justify-center mb-4 bg-white p-2 rounded-xl border border-gray-100">
                {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR Code" className="w-64 h-64 object-contain" /> : <Loader2 className="animate-spin" />}
             </div>
             <h4 className="font-bold text-lg text-primary">{qrProduct.name}</h4>
             <button onClick={() => { if(qrCodeDataUrl) { const a = document.createElement('a'); a.download = 'qr.png'; a.href = qrCodeDataUrl; a.click(); } }} disabled={!qrCodeDataUrl} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition flex items-center justify-center space-x-2 space-x-reverse mt-4"><Download size={20} /><span>تحميل</span></button>
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl p-6 animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">{editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <div className="space-y-4">
               {/* Image Input Section */}
              <div className="flex flex-col items-center mb-4">
                 <div className="w-full flex justify-end mb-1">
                      <button 
                         onClick={() => {
                             setImageInputMode(prev => prev === 'file' ? 'url' : 'file');
                             setSelectedFile(null); // Reset selection when switching
                         }} 
                         className="text-xs text-primary hover:underline flex items-center"
                       >
                         {imageInputMode === 'file' ? 'أو استخدم رابط صورة' : 'أو ارفع ملف'}
                         {imageInputMode === 'file' ? <LinkIcon size={12} className="mr-1" /> : <Upload size={12} className="mr-1" />}
                       </button>
                 </div>
                 
                 {imageInputMode === 'file' ? (
                     <div onClick={() => fileInputRef.current?.click()} className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-blue-50 dark:hover:bg-gray-700 transition relative overflow-hidden bg-gray-50 dark:bg-gray-800">
                        {(selectedFile || (existingImageUrl && !existingImageUrl.startsWith('http'))) ? 
                            <img src={selectedFile ? URL.createObjectURL(selectedFile) : getDirectDriveUrl(existingImageUrl)} className="w-full h-full object-cover" alt="Preview" referrerPolicy="no-referrer" onError={(e) => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image'}/> 
                            : (existingImageUrl && existingImageUrl.startsWith('http') ? <img src={getDirectDriveUrl(existingImageUrl)} className="w-full h-full object-cover" alt="Preview" referrerPolicy="no-referrer" onError={(e) => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image'}/> : <><Upload className="text-gray-400 mb-2" /><span className="text-xs text-gray-500 dark:text-gray-400">اختر صورة</span></>)
                        }
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]); }} />
                    </div>
                 ) : (
                     <div className="w-full">
                         <div className="w-32 h-32 mx-auto rounded-2xl border border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800 mb-2">
                            {existingImageUrl ? (
                                <img src={getDirectDriveUrl(existingImageUrl)} className="w-full h-full object-cover" alt="Preview" referrerPolicy="no-referrer" onError={(e) => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image'}/>
                            ) : (
                                <ImageIcon className="text-gray-300" size={32} />
                            )}
                         </div>
                         <input 
                            type="text" 
                            placeholder="https://example.com/image.png" 
                            value={existingImageUrl}
                            onChange={(e) => setExistingImageUrl(e.target.value)}
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-2 outline-none dir-ltr text-left"
                         />
                         <p className="text-[10px] text-gray-500 mt-1 text-center">يقبل روابط Google Drive مباشرة</p>
                     </div>
                 )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المنتج</label>
                <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-3 outline-none" placeholder="مثال: سماعة بلوتوث" />
              </div>
              
              {/* Barcode Field */}
              <div>
                 <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">الباركود (اختياري)</label>
                    <button 
                        onClick={handleGenerateBarcode}
                        className="text-xs text-primary hover:underline flex items-center font-bold"
                        type="button"
                    >
                        <RefreshCw size={12} className="ml-1"/>
                        توليد كود مغربي (611)
                    </button>
                 </div>
                 <div className="flex space-x-2 space-x-reverse">
                    <input type="text" value={productBarcode} onChange={(e) => setProductBarcode(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-3 outline-none" placeholder="123456789" />
                    <button onClick={() => handleOpenScanner('form')} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 p-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition" title="مسح باركود">
                        <ScanBarcode size={24} />
                    </button>
                 </div>
              </div>

              {/* Category Selector */}
              <div>
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الفئة</label>
                 {categories.length > 0 ? (
                    <select 
                        value={productCategory} 
                        onChange={(e) => setProductCategory(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-3 outline-none bg-white"
                    >
                        <option value="">بدون فئة</option>
                        {categories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                    </select>
                 ) : (
                    <input type="text" value={productCategory} onChange={(e) => setProductCategory(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-3 outline-none" placeholder="اسم الفئة" />
                 )}
              </div>

              <div className="flex space-x-3 space-x-reverse">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">السعر ({currency})</label>
                    <input type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-3 outline-none dir-ltr text-right" placeholder="0.00" />
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المخزون</label>
                    <input type="number" value={productStock} onChange={(e) => setProductStock(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg p-3 outline-none dir-ltr text-right" placeholder="10" />
                </div>
              </div>
              <button onClick={handleSaveProduct} disabled={isUploading} className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-secondary transition mt-4 flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-70">
                {isUploading ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
                <span>{isUploading ? 'جاري الحفظ...' : 'حفظ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmationId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-fade-in-up">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400"><AlertTriangle size={32} /></div>
              <div><h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">تأكيد الحذف</h3><p className="text-gray-500 dark:text-gray-400">هل أنت متأكد من رغبتك في حذف هذا المنتج؟</p></div>
              <div className="flex space-x-3 space-x-reverse w-full pt-2">
                <button onClick={() => setDeleteConfirmationId(null)} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition">إلغاء</button>
                <button onClick={confirmDelete} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition">حذف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsView;
