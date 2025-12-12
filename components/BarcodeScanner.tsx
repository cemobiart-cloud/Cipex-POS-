import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onClose }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true
      },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        // Stop scanning after success to prevent multiple triggers
        scanner.clear().then(() => {
             onScanSuccess(decodedText);
        }).catch(err => console.error(err));
      },
      (errorMessage) => {
        // Parse error, ignore usually
      }
    );

    scannerRef.current = scanner;

    // Cleanup on unmount
    return () => {
      if (scannerRef.current) {
        try {
            scannerRef.current.clear().catch(e => console.error("Failed to clear scanner", e));
        } catch(e) {}
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden relative animate-fade-in-up">
        <button 
            onClick={onClose} 
            className="absolute top-2 right-2 z-10 bg-white/80 p-2 rounded-full hover:bg-white text-gray-800"
        >
            <X size={24} />
        </button>
        
        <div className="p-4 bg-gray-50 border-b text-center">
            <h3 className="font-bold text-lg text-gray-800">مسح الباركود / QR</h3>
            <p className="text-xs text-gray-500">وجه الكاميرا نحو الكود</p>
        </div>
        
        <div id="reader" className="w-full"></div>
        
        <div className="p-4 text-center text-sm text-gray-500">
            يدعم النظام البحث عن طريق ID المنتج أو قراءة QR المولد من التطبيق.
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;