
/**
 * ==========================================
 * كود Google Apps Script المحدث (POS System v17 - Full Settings Support)
 * ==========================================
 */

function doGet(e) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var result = {
    products: getSheetData(doc, "Products"),
    sales: getSheetData(doc, "Sales"),
    expenses: getSheetData(doc, "Expenses"),
    customers: getSheetData(doc, "Customers"),
    users: getSheetData(doc, "Users"),
    settings: getSheetData(doc, "Settings")
  };
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// دالة مساعدة لقراءة البيانات من ورقة وتحويلها لمصفوفة كائنات
function getSheetData(doc, sheetName) {
  var sheet = doc.getSheetByName(sheetName);
  if (!sheet) return [];
  
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return []; // فقط العناوين أو فارغة
  
  var headers = rows[0];
  var data = [];
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var obj = {};
    if (sheetName === "Products") {
      obj = {
        id: String(row[0]),
        name: row[1],
        price: Number(row[2]),
        stock: Number(row[3]),
        image: row[4],
        category: row[5] || '', // Category Column
        barcode: row[6] ? String(row[6]) : '' // Barcode Column
      };
    } else if (sheetName === "Sales") {
      obj = {
        id: String(row[0]),
        timestamp: row[1],
        product: {
          name: row[2],
          price: Number(row[3])
        },
        quantity: Number(row[4]),
        total: Number(row[5]),
        customer: {
          name: row[6],
          phone: String(row[7]),
          address: row[8]
        },
        subtotal: row[9] ? Number(row[9]) : Number(row[5]), 
        discount: row[10] ? Number(row[10]) : 0,
        discountType: row[11] || 'fixed',
        discountValue: row[12] ? Number(row[12]) : 0,
        taxRate: row[13] ? Number(row[13]) : 0,  // Tax Rate
        taxAmount: row[14] ? Number(row[14]) : 0 // Tax Amount
      };
    } else if (sheetName === "Expenses") {
      obj = {
        id: String(row[0]),
        date: row[1],
        title: row[2],
        amount: Number(row[3]),
        description: row[4],
        image: row[5]
      };
    } else if (sheetName === "Customers") {
      obj = {
        id: String(row[0]),
        name: row[1],
        phone: String(row[2]),
        address: row[3],
        lastVisit: row[4],
        totalSpent: row[5],
        visitCount: row[6]
      };
    } else if (sheetName === "Users") {
      obj = {
        id: String(row[0]),
        name: row[1],
        email: row[2],
        role: row[3],
        scriptUrl: row[4] || '' 
      };
    } else if (sheetName === "Settings") {
      obj = {
        key: String(row[0]),
        value: String(row[1])
      };
    }
    data.push(obj);
  }
  return data;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    lock.waitLock(30000);
    
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var result = {};

    if (action === 'upload_image') {
      result = handleImageUpload(requestData);
    } else if (action === 'setup') {
      result = handleSetup();
    } 
    // Products
    else if (action === 'save_product') {
      result = handleSaveProduct(requestData);
    } else if (action === 'update_product') {
      result = handleUpdateProduct(requestData);
    } else if (action === 'delete_product') {
      result = handleDeleteRow("Products", requestData.id);
    } 
    // Expenses
    else if (action === 'save_expense') {
      result = handleSaveExpense(requestData);
    } else if (action === 'update_expense') {
      result = handleUpdateExpense(requestData);
    } else if (action === 'delete_expense') {
      result = handleDeleteRow("Expenses", requestData.id);
    } 
    // Sales
    else if (action === 'delete_sale') {
      result = handleDeleteSale(requestData.id);
    } 
    // Customers
    else if (action === 'update_customer') {
      result = handleUpdateCustomer(requestData);
    } else if (action === 'delete_customer') {
      result = handleDeleteRow("Customers", requestData.id);
    } 
    // Users
    else if (action === 'save_user') {
      result = handleSaveUser(requestData);
    } else if (action === 'update_user') {
      result = handleUpdateUser(requestData);
    } else if (action === 'delete_user') {
      result = handleDeleteRow("Users", requestData.id);
    }
    // Settings
    else if (action === 'save_settings') {
      result = handleSaveSettings(requestData);
    }
    else {
      // Default: save sale
      result = handleSaveSale(requestData);
    }

    output.setContent(JSON.stringify(result));
    return output;

  } catch (error) {
    output.setContent(JSON.stringify({ 
      'status': 'error', 
      'message': error.toString() 
    }));
    return output;
  } finally {
    lock.releaseLock();
  }
}

// === Generic Delete Helper ===
function handleDeleteRow(sheetName, id, idColIndex) {
  if (idColIndex === undefined) idColIndex = 0; // Default to first column (ID)
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName(sheetName);
  if (!sheet) return { 'status': 'error', 'message': 'Sheet not found' };

  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idColIndex]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { 'status': 'success', 'message': 'Item deleted' };
    }
  }
  return { 'status': 'error', 'message': 'Item not found' };
}

// === Handlers ===

function handleSetup() {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  
  // Define Schemas
  var schemas = {
    "Sales": ["ID", "Timestamp", "Product Name", "Unit Price", "Quantity", "Total", "Customer Name", "Customer Phone", "Customer Address", "Subtotal", "Discount Amount", "Discount Type", "Discount Value", "Tax Rate", "Tax Amount"],
    "Products": ["ID", "Name", "Price", "Stock", "Image URL", "Category", "Barcode"],
    "Expenses": ["ID", "Date", "Title", "Amount", "Description", "Receipt Image"],
    "Customers": ["ID", "Name", "Phone", "Address", "Last Visit", "Total Spent", "Visit Count"],
    "Users": ["ID", "Name", "Email", "Role", "Script URL"],
    "Settings": ["Key", "Value"]
  };

  // Ensure all sheets and headers are correct
  for (var sheetName in schemas) {
    ensureSheet(doc, sheetName, schemas[sheetName]);
  }
  
  // Ensure Admin exists
  var usersSheet = doc.getSheetByName("Users");
  if (usersSheet && usersSheet.getLastRow() === 1) { 
     usersSheet.appendRow([Utilities.getUuid(), "Admin", "admin@pos.com", "admin", ""]);
  }
  
  return { 'status': 'success', 'message': 'All sheets setup successfully' };
}

function ensureSheet(doc, sheetName, headers) {
  var sheet = doc.getSheetByName(sheetName);
  if (!sheet) {
    sheet = doc.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    styleHeaders(sheet);
  } else {
    // Check and add missing headers
    updateSheetHeaders(sheet, headers);
  }
  return sheet;
}

function updateSheetHeaders(sheet, expectedHeaders) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.appendRow(expectedHeaders);
    styleHeaders(sheet);
    return;
  }

  var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var missingHeaders = [];

  // Identify missing headers
  for (var i = 0; i < expectedHeaders.length; i++) {
    if (currentHeaders.indexOf(expectedHeaders[i]) === -1) {
      missingHeaders.push(expectedHeaders[i]);
    }
  }

  // Append missing headers
  if (missingHeaders.length > 0) {
    var startCol = lastCol + 1;
    sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
    // Apply style to new headers
    sheet.getRange(1, startCol, 1, missingHeaders.length).setFontWeight("bold").setBackground("#e6e6e6");
  }
}

function styleHeaders(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol > 0) {
    sheet.getRange(1, 1, 1, lastCol).setFontWeight("bold").setBackground("#e6e6e6");
  }
}

function handleSaveSale(data) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  // Ensure columns exist before saving (Auto-migration)
  var headers = ["ID", "Timestamp", "Product Name", "Unit Price", "Quantity", "Total", "Customer Name", "Customer Phone", "Customer Address", "Subtotal", "Discount Amount", "Discount Type", "Discount Value", "Tax Rate", "Tax Amount"];
  var saleSheet = ensureSheet(doc, "Sales", headers);
  
  saleSheet.appendRow([
    data.id || '', 
    data.timestamp || new Date().toISOString(),
    (data.product && data.product.name) ? data.product.name : '',
    (data.product && data.product.price) ? data.product.price : 0,
    data.quantity || 0, 
    data.total || 0,
    (data.customer && data.customer.name) ? data.customer.name : '',
    (data.customer && data.customer.phone) ? data.customer.phone : '',
    (data.customer && data.customer.address) ? data.customer.address : '',
    data.subtotal || 0,
    data.discount || 0,
    data.discountType || 'fixed',
    data.discountValue || 0,
    data.taxRate || 0,
    data.taxAmount || 0
  ]);

  try {
    var productSheet = doc.getSheetByName("Products");
    if (productSheet && data.product && data.product.id) {
      var textFinder = productSheet.getRange("A:A").createTextFinder(data.product.id).matchEntireCell(true);
      var result = textFinder.findNext();
      if (result) {
        var row = result.getRow();
        var stockCell = productSheet.getRange(row, 4);
        var currentStock = stockCell.getValue();
        if (typeof currentStock === 'number') {
          stockCell.setValue(currentStock - (data.quantity || 0));
        }
      }
    }
  } catch (e) { console.error(e); }

  if (data.customer && data.customer.phone) {
    saveOrUpdateCustomer(doc, data.customer, data.timestamp || new Date().toISOString(), data.total || 0);
  }
  
  return { 'status': 'success', 'message': 'Sales Saved & Stock Updated' };
}

function saveOrUpdateCustomer(doc, customer, timestamp, amount) {
  try {
    var sheet = ensureSheet(doc, "Customers", ["ID", "Name", "Phone", "Address", "Last Visit", "Total Spent", "Visit Count"]);
    var phone = customer.phone.toString().replace(/\s/g, ''); 
    var textFinder = sheet.getRange("C:C").createTextFinder(phone).matchEntireCell(true);
    var result = textFinder.findNext();
    
    if (result) {
      var row = result.getRow();
      sheet.getRange(row, 5).setValue(timestamp);
      var currentTotal = sheet.getRange(row, 6).getValue();
      sheet.getRange(row, 6).setValue((Number(currentTotal)||0) + (amount || 0));
      var currentCount = sheet.getRange(row, 7).getValue();
      sheet.getRange(row, 7).setValue((Number(currentCount)||0) + 1);
      if (customer.name) sheet.getRange(row, 2).setValue(customer.name);
      if (customer.address) sheet.getRange(row, 4).setValue(customer.address);
    } else {
      var newId = customer.id || Utilities.getUuid();
      sheet.appendRow([newId, customer.name, phone, customer.address, timestamp, amount || 0, 1]);
    }
  } catch (e) {}
}

function handleDeleteSale(saleId) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var saleSheet = doc.getSheetByName("Sales");
  var productSheet = doc.getSheetByName("Products");
  if (!saleSheet) return { 'status': 'error', 'message': 'Sales sheet not found' };
  var data = saleSheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(saleId)) {
      var productName = data[i][2]; 
      var quantity = Number(data[i][4]);
      if (productSheet) {
         var prodData = productSheet.getDataRange().getValues();
         for (var j = 1; j < prodData.length; j++) {
            if (prodData[j][1] === productName) { 
               var currentStock = Number(prodData[j][3]);
               productSheet.getRange(j + 1, 4).setValue(currentStock + quantity);
               break; 
            }
         }
      }
      saleSheet.deleteRow(i + 1);
      return { 'status': 'success', 'message': 'Sale deleted and stock reverted' };
    }
  }
  return { 'status': 'error', 'message': 'Sale not found' };
}

function handleSaveProduct(data) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  // Ensure "Barcode" column exists
  var productHeaders = ["ID", "Name", "Price", "Stock", "Image URL", "Category", "Barcode"];
  var sheet = ensureSheet(doc, "Products", productHeaders);
  
  sheet.appendRow([data.id, data.name, data.price, data.stock, data.image, data.category || '', data.barcode || '']);
  return { 'status': 'success', 'message': 'Product Saved' };
}

function handleUpdateProduct(data) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName("Products");
  var rows = sheet.getDataRange().getValues();
  
  // Ensure Headers exist in case they were added recently
  var productHeaders = ["ID", "Name", "Price", "Stock", "Image URL", "Category", "Barcode"];
  updateSheetHeaders(sheet, productHeaders);
  
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      sheet.getRange(i + 1, 2).setValue(data.name);
      sheet.getRange(i + 1, 3).setValue(data.price);
      sheet.getRange(i + 1, 4).setValue(data.stock);
      if (data.image) sheet.getRange(i + 1, 5).setValue(data.image);
      sheet.getRange(i + 1, 6).setValue(data.category || '');
      sheet.getRange(i + 1, 7).setValue(data.barcode || '');
      
      return { 'status': 'success', 'message': 'Product updated' };
    }
  }
  return { 'status': 'error', 'message': 'Product ID not found' };
}

function handleSaveExpense(data) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ensureSheet(doc, "Expenses", ["ID", "Date", "Title", "Amount", "Description", "Receipt Image"]);
  sheet.appendRow([data.id, data.date, data.title, data.amount, data.description || '', data.image || '' ]);
  return { 'status': 'success', 'message': 'Expense Saved' };
}
function handleUpdateExpense(data) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName("Expenses");
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      sheet.getRange(i + 1, 2).setValue(data.date);
      sheet.getRange(i + 1, 3).setValue(data.title);
      sheet.getRange(i + 1, 4).setValue(data.amount);
      sheet.getRange(i + 1, 5).setValue(data.description || '');
      if (data.image) sheet.getRange(i + 1, 6).setValue(data.image);
      return { 'status': 'success', 'message': 'Expense updated' };
    }
  }
  return { 'status': 'error', 'message': 'Expense ID not found' };
}
function handleUpdateCustomer(data) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName("Customers");
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      sheet.getRange(i + 1, 2).setValue(data.name);
      sheet.getRange(i + 1, 3).setValue(data.phone);
      sheet.getRange(i + 1, 4).setValue(data.address);
      return { 'status': 'success', 'message': 'Customer updated' };
    }
  }
  return { 'status': 'error', 'message': 'Customer ID not found' };
}

// === User Handlers ===
function handleSaveUser(data) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ensureSheet(doc, "Users", ["ID", "Name", "Email", "Role", "Script URL"]);
  sheet.appendRow([data.id, data.name, data.email, data.role, data.scriptUrl || '']);
  return { 'status': 'success', 'message': 'User Saved' };
}

function handleUpdateUser(data) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = doc.getSheetByName("Users");
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      sheet.getRange(i + 1, 2).setValue(data.name);
      sheet.getRange(i + 1, 3).setValue(data.email);
      sheet.getRange(i + 1, 4).setValue(data.role);
      sheet.getRange(i + 1, 5).setValue(data.scriptUrl || '');
      return { 'status': 'success', 'message': 'User updated' };
    }
  }
  return { 'status': 'error', 'message': 'User ID not found' };
}

// === Settings Handler ===
function handleSaveSettings(data) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  // FORCE CREATE SHEET IF NOT EXISTS
  var sheet = ensureSheet(doc, "Settings", ["Key", "Value"]);
  
  // Define Keys to Update
  var keysToUpdate = {};
  if (data.categories) keysToUpdate['categories'] = data.categories;
  if (data.taxRate) keysToUpdate['tax_rate'] = data.taxRate;
  if (data.language) keysToUpdate['language'] = data.language;
  if (data.currency) keysToUpdate['currency'] = data.currency;
  if (data.receipt_size) keysToUpdate['receipt_size'] = data.receipt_size;
  if (data.store_logo) keysToUpdate['store_logo'] = data.store_logo;
  if (data.store_name) keysToUpdate['store_name'] = data.store_name;
  
  var rows = sheet.getDataRange().getValues();
  
  for (var key in keysToUpdate) {
    var found = false;
    var value = keysToUpdate[key];
    
    // Look for existing key
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === key) {
         sheet.getRange(i + 1, 2).setValue(value);
         found = true;
         break;
      }
    }
    
    // If not found, append
    if (!found) {
       sheet.appendRow([key, value]);
       // Refresh rows for next iteration to avoid duplicates if saving multiple new keys
       rows = sheet.getDataRange().getValues();
    }
  }
  
  return { 'status': 'success', 'message': 'Settings saved' };
}

function handleImageUpload(data) {
  try {
    var folderName = "POS_Images";
    var folder;
    var folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) { folder = folders.next(); } else { folder = DriveApp.createFolder(folderName); }
    var decoded = Utilities.base64Decode(data.imageBase64);
    var blob = Utilities.newBlob(decoded, data.mimeType, data.imageName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { 'status': 'success', 'url': "https://drive.google.com/uc?export=view&id=" + file.getId() };
  } catch (err) {
    return { 'status': 'error', 'message': err.toString() };
  }
}
