import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle } from 'lucide-react';
import type { Match } from '../types';

interface PaymentModalProps {
  match: Match;
  userId: string;
  onClose: () => void;
  onSuccess: (screenshotUrl: string) => Promise<void> | void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ match, userId, onClose, onSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const price = match.pricePerPerson || 0;
  const upiId = match.upiId || '';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic compression using Canvas
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality
        setPreview(compressedDataUrl);
      };
    };
  };

  const handleUpload = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      // Option B: Store 100% free base64 in Firestore instead of Firebase Storage
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const proofId = `${match.id}_${userId}`;
      await setDoc(doc(db, 'payment_proofs', proofId), {
        matchId: match.id,
        userId: userId,
        dataUrl: preview,
        createdAt: new Date().toISOString()
      });

      // Wait for the RSVP transaction to complete before stopping the spinner
      await onSuccess("firestore_stored");
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload screenshot. Please try again.");
    } finally {
      setUploading(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up">
        <div className="bg-emerald-600 p-4 text-white flex justify-between items-center relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          <h2 className="text-xl font-black relative z-10">Secure Your Spot</h2>
          <button onClick={onClose} className="text-emerald-100 hover:text-white transition relative z-10">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-gray-500 text-sm font-medium mb-1">Match Fee</p>
            <div className="text-5xl font-black text-gray-900">₹{price}</div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">1. Send Payment To</p>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-xl md:text-2xl font-black text-emerald-700 select-all tracking-wide">{upiId}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(upiId);
                  alert("UPI ID copied to clipboard!");
                }}
                className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition"
                title="Copy UPI ID"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-500 font-medium">Open any UPI app (GPay, PhonePe, Paytm) and send exactly <span className="font-bold text-gray-800">₹{price}</span></p>
          </div>

          <div className="mb-6">
            <p className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">2. Upload Screenshot</p>
            {!preview ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50 transition hover:border-emerald-400"
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-600">Tap to upload payment screenshot</p>
              </div>
            ) : (
              <div className="relative">
                <img src={preview} alt="Preview" className="w-full h-48 object-cover rounded-xl border border-gray-200" />
                <button 
                  onClick={() => setPreview(null)}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          <button 
            onClick={handleUpload}
            disabled={!preview || uploading}
            className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Verify & Join Match
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
