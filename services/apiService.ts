
import { SaleRecord, Product, Expense, AppData, Customer, AppUser, AppSettings } from '../types';
import { GOOGLE_SCRIPT_URL } from '../constants';

export const getApiUrl = (): string => {
  return localStorage.getItem('pos_api_url') || GOOGLE_SCRIPT_URL;
};

export const saveApiUrl = (url: string): void => {
  localStorage.setItem('pos_api_url', url);
};

// Helper to convert File to Base64
export const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove the Data-URL prefix (e.g. "data:image/jpeg;base64,")
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// Helper to convert Google Drive View URLs to Direct Image URLs
export const getDirectDriveUrl = (url: string | undefined): string => {
  if (!url) return '';
  
  // If it's a data URL, return as is
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  // Handle Google Drive Links
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    let id = '';
    
    // Pattern 1: /file/d/ID/view or /file/d/ID
    const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch && fileMatch[1]) {
      id = fileMatch[1];
    } 
    // Pattern 2: ?id=ID or &id=ID (Catch ID from query params)
    else {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        id = idMatch[1];
      }
    }

    if (id) {
      // Use the thumbnail endpoint with a large size (w1000)
      // This is much more reliable for <img> tags than uc?export=view
      return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    }
  }
  
  return url;
};

// --- Generic Request Helper ---
const sendRequest = async (body: any): Promise<any> => {
  const apiUrl = getApiUrl();
  
  if (apiUrl.includes('YOUR_GOOGLE_SCRIPT') || !apiUrl) {
    // Simulate delay for mock mode
    return new Promise(resolve => setTimeout(() => resolve({ status: 'success' }), 800));
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    
    if (response.ok) {
        return await response.json();
    } else {
        return { status: 'error', message: 'Network response was not ok' };
    }
  } catch (error) {
    console.error('API Request Error:', error);
    return { status: 'error', message: String(error) };
  }
};

// --- NEW: Fetch All Data (GET) ---
export const fetchDataFromSheets = async (): Promise<AppData | null> => {
  const apiUrl = getApiUrl();
  if (apiUrl.includes('YOUR_GOOGLE_SCRIPT') || !apiUrl) {
    return null;
  }

  try {
    // doGet in Apps Script works with GET request
    const response = await fetch(apiUrl);
    if (response.ok) {
      const data = await response.json();
      return data as AppData;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch data from sheets', error);
    return null;
  }
};

// --- API Methods ---

export const setupSheetStructure = async (): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'setup' });
    return result.status === 'success';
  } catch (e) {
    console.error(e);
    return false;
  }
};

// PRODUCTS
export const saveProductToSheets = async (product: Product): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'save_product', ...product });
    return result.status === 'success';
  } catch (e) { return false; }
};

export const updateProductInSheets = async (product: Product): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'update_product', ...product });
    return result.status === 'success';
  } catch (e) { return false; }
};

export const deleteProductFromSheets = async (id: string): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'delete_product', id });
    return result.status === 'success';
  } catch (e) { return false; }
};

// EXPENSES
export const saveExpenseToSheets = async (expense: Expense): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'save_expense', ...expense });
    return result.status === 'success';
  } catch (e) { return false; }
};

export const updateExpenseInSheets = async (expense: Expense): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'update_expense', ...expense });
    return result.status === 'success';
  } catch (e) { return false; }
};

export const deleteExpenseFromSheets = async (id: string): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'delete_expense', id });
    return result.status === 'success';
  } catch (e) { return false; }
};

// SALES
export const saveSaleToSheets = async (sale: SaleRecord): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'sale', ...sale });
    return result.status === 'success';
  } catch (e) { return false; }
};

export const deleteSaleFromSheets = async (id: string): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'delete_sale', id });
    return result.status === 'success';
  } catch (e) { return false; }
};

// CUSTOMERS
export const updateCustomerInSheets = async (customer: Customer): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'update_customer', ...customer });
    return result.status === 'success';
  } catch (e) { return false; }
};

export const deleteCustomerFromSheets = async (id: string): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'delete_customer', id });
    return result.status === 'success';
  } catch (e) { return false; }
};

// USERS
export const saveUserToSheets = async (user: AppUser): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'save_user', ...user });
    return result.status === 'success';
  } catch (e) { return false; }
};

export const updateUserInSheets = async (user: AppUser): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'update_user', ...user });
    return result.status === 'success';
  } catch (e) { return false; }
};

export const deleteUserFromSheets = async (id: string): Promise<boolean> => {
  try {
    const result = await sendRequest({ action: 'delete_user', id });
    return result.status === 'success';
  } catch (e) { return false; }
};

// SETTINGS
export const saveSettingsToSheets = async (settings: AppSettings): Promise<boolean> => {
    try {
        const result = await sendRequest({ 
            action: 'save_settings', 
            categories: JSON.stringify(settings.categories),
            taxRate: settings.taxRate.toString(),
            language: settings.language,
            currency: settings.currency,
            receipt_size: settings.receiptSize,
            store_logo: settings.storeLogo,
            store_name: settings.storeName
        });
        return result.status === 'success';
    } catch (e) { return false; }
};

export const uploadImageToDrive = async (file: File): Promise<string | null> => {
  const apiUrl = getApiUrl();
  if (apiUrl.includes('YOUR_GOOGLE_SCRIPT') || !apiUrl) {
    console.warn('Script URL not set. Returning fake URL.');
    return URL.createObjectURL(file);
  }

  try {
    const base64 = await convertFileToBase64(file);
    
    const result = await sendRequest({
        action: 'upload_image',
        imageName: file.name,
        mimeType: file.type,
        imageBase64: base64
    });

    if (result.status === 'success') {
      return result.url;
    } else {
      console.error('Upload failed:', result.message);
      return null;
    }
  } catch (error) {
    console.error('Error uploading image:', error);
    return URL.createObjectURL(file); 
  }
};
