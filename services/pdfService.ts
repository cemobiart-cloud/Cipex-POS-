
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { SaleRecord, AppSettings } from '../types';
import { getDirectDriveUrl } from './apiService';

export const generateReceiptPDF = async (sale: SaleRecord, settings?: AppSettings) => {
  // Use settings or defaults
  const currency = settings?.currency || 'MAD';
  const receiptSize = settings?.receiptSize || 'thermal';
  const logoUrl = settings?.storeLogo ? getDirectDriveUrl(settings.storeLogo) : '';
  const storeName = settings?.storeName || 'نظام نقاط البيع';

  // Create a hidden container for the receipt
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = 'Tajawal, sans-serif'; 
  container.style.boxSizing = 'border-box';
  
  // Set dimensions based on size preference
  if (receiptSize === 'a4') {
      container.style.width = '210mm'; // A4 Width
      container.style.padding = '15mm';
      container.style.fontSize = '14px';
  } else {
      container.style.width = '80mm'; // Thermal Width
      container.style.padding = '5mm';
      container.style.fontSize = '11px'; 
  }

  // Check if it's a multi-item order
  const isMultiItem = sale.cartItems && sale.cartItems.length > 0;
  const itemsToRender = isMultiItem ? sale.cartItems! : [
      {
          name: sale.product.name,
          quantity: sale.quantity,
          price: sale.product.price,
          finalTotal: sale.subtotal 
      }
  ];

  // Generate QR Code Data URL
  let qrDataUri = '';
  try {
    const qrData = JSON.stringify({
      id: sale.id,
      date: sale.timestamp,
      total: sale.total,
      client: sale.customer.name,
      items: itemsToRender.length
    });
    qrDataUri = await QRCode.toDataURL(qrData, { width: 100, margin: 0, color: { dark: '#000000', light: '#ffffff' } });
  } catch (err) {
    console.error('QR Gen Error', err);
  }

  // Format Date
  const dateObj = new Date(sale.timestamp);
  const dateStr = dateObj.toLocaleDateString('en-GB');
  const timeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // --- HTML TEMPLATE CONSTRUCTION ---
  
  // Logo Logic (Centered and fitting)
  const logoHtml = logoUrl ? `<div style="display: flex; justify-content: center; margin-bottom: 5px;"><img src="${logoUrl}" style="${receiptSize === 'a4' ? 'height: 80px;' : 'width: 60px; height: 60px;'} object-fit: contain;" /></div>` : '';

  // Rows Logic 
  const rowsHtml = itemsToRender.map(item => `
    <div style="width: 100%; display: flex; margin-bottom: 4px; align-items: flex-start; border-bottom: 1px solid #eee; padding: 4px 0;">
        <span style="width: 35%; text-align: right; word-break: break-word; padding-left: 2px;">${item.name}</span>
        <span style="width: 20%; text-align: center;">${item.price}</span>
        <span style="width: 15%; text-align: center;">${item.quantity}</span>
        <span style="width: 30%; text-align: left; direction: ltr;">${(item.quantity * item.price).toFixed(2)}</span>
    </div>
  `).join('');

  const thermalTemplate = `
    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; direction: rtl;">
      ${logoHtml}
      <h2 style="margin: 0; font-size: 16px; font-weight: 800; margin-bottom: 5px;">${storeName}</h2>
      <p style="margin: 0; font-size: 10px; margin-bottom: 10px; direction: ltr;">#${sale.id.slice(-8).toUpperCase()}</p>
      
      <div style="width: 100%; display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px;">
        <span>${timeStr}</span>
        <span>${dateStr}</span>
      </div>

      <div style="width: 100%; text-align: right; margin-bottom: 10px;">
        <p style="margin: 0; font-size: 11px; font-weight: bold;">العميل:</p>
        <p style="margin: 0; font-size: 11px;">${sale.customer.name}</p>
        ${sale.customer.phone ? `<p style="margin: 0; font-size: 10px; direction: ltr; text-align: right;">${sale.customer.phone}</p>` : ''}
      </div>

      <!-- Header Row -->
      <div style="width: 100%; display: flex; font-size: 10px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 5px;">
        <span style="width: 35%; text-align: right;">المنتج</span>
        <span style="width: 20%; text-align: center;">السعر</span>
        <span style="width: 15%; text-align: center;">الكمية</span>
        <span style="width: 30%; text-align: left;">الإجمالي</span>
      </div>

      <div style="width: 100%; font-size: 10px;">
        ${rowsHtml}
      </div>

      <div style="width: 100%; border-top: 1px dashed #000; margin: 5px 0;"></div>

      <div style="width: 100%; font-size: 11px;">
        <!-- Subtotal Removed as requested -->
        ${sale.discount > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span>الخصم:</span><span style="direction: ltr;">-${sale.discount.toFixed(2)}</span></div>` : ''}
        ${sale.taxAmount > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span>الضريبة:</span><span style="direction: ltr;">+${sale.taxAmount.toFixed(2)}</span></div>` : ''}
        <div style="display: flex; justify-content: space-between; margin-top: 5px; font-weight: 800; font-size: 14px;">
           <span>الإجمالي:</span>
           <span style="direction: ltr;">${sale.total.toFixed(2)} ${currency}</span>
        </div>
      </div>

      <div style="margin-top: 15px; margin-bottom: 10px;">
        <img src="${qrDataUri}" style="width: 80px; height: 80px;" />
      </div>

      <p style="margin: 0; font-size: 10px; font-weight: bold;">شكراً لزيارتكم!</p>
    </div>
  `;

  const a4Template = `
    <div style="display: flex; flex-direction: column; direction: rtl; width: 100%;">
      <!-- A4 Header: Logo above Store Name -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px;">
          <div style="display: flex; flex-direction: column; text-align: right;">
             ${logoUrl ? `<img src="${logoUrl}" style="height: 80px; object-fit: contain; margin-bottom: 10px; display: block;" />` : ''}
             <h1 style="margin: 0; font-size: 28px; font-weight: bold;">${storeName}</h1>
             <p style="margin: 5px 0; color: #555;">فاتورة بيع</p>
          </div>
          <div style="text-align: left; direction: ltr; margin-top: 10px;">
             <p style="margin: 2px 0; font-weight: bold;">Invoice #${sale.id.slice(-8).toUpperCase()}</p>
             <p style="margin: 2px 0;">Date: ${dateStr}</p>
             <p style="margin: 2px 0;">Time: ${timeStr}</p>
          </div>
      </div>

      <!-- Customer Info -->
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between;">
         <div>
            <h3 style="margin: 0 0 5px 0; font-size: 16px; font-weight: bold;">بيانات العميل:</h3>
            <p style="margin: 2px 0;">${sale.customer.name}</p>
            <p style="margin: 2px 0;">${sale.customer.phone}</p>
            <p style="margin: 2px 0;">${sale.customer.address}</p>
         </div>
         <div style="text-align: left;">
            <img src="${qrDataUri}" style="width: 80px; height: 80px;" />
         </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
            <tr style="background-color: #eee; text-align: right;">
                <th style="padding: 10px; border: 1px solid #ddd;">المنتج</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">السعر الفردي</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">الكمية</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">الإجمالي</th>
            </tr>
        </thead>
        <tbody>
            ${itemsToRender.map(item => `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.name}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.price}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: left; direction: ltr;">${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="display: flex; justify-content: flex-end;">
          <div style="width: 250px;">
              <!-- Subtotal Removed as requested -->
              ${sale.discount > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; color: green;">
                  <span>الخصم:</span>
                  <span style="direction: ltr;">-${sale.discount.toFixed(2)}</span>
              </div>` : ''}
              ${sale.taxAmount > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;">
                  <span>الضريبة:</span>
                  <span style="direction: ltr;">+${sale.taxAmount.toFixed(2)}</span>
              </div>` : ''}
              <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; font-weight: bold; border-top: 2px solid #000; margin-top: 5px;">
                  <span>الإجمالي النهائي:</span>
                  <span style="direction: ltr;">${sale.total.toFixed(2)} ${currency}</span>
              </div>
          </div>
      </div>
      
      <div style="margin-top: 50px; text-align: center; color: #777; border-top: 1px solid #eee; padding-top: 20px;">
          شكراً لتعاملكم معنا!
      </div>
    </div>
  `;

  container.innerHTML = receiptSize === 'a4' ? a4Template : thermalTemplate;

  document.body.appendChild(container);

  try {
    // Convert DOM to Canvas
    const canvas = await html2canvas(container, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      logging: false,
      allowTaint: true 
    });

    let pdf;

    if (receiptSize === 'a4') {
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf = new jsPDF('p', 'mm', 'a4');
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        
    } else {
        const imgWidth = 80; // mm
        const pageHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [80, pageHeight] 
        });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, pageHeight);
    }
    
    pdf.autoPrint(); 
    pdf.save(`Receipt_${sale.id}.pdf`);

  } catch (err) {
    console.error('Error generating receipt:', err);
    alert('حدث خطأ أثناء طباعة الوصل');
  } finally {
    document.body.removeChild(container);
  }
};
