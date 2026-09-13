import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Image as ImageIcon, X, Eye } from 'lucide-react';

export const PaymentProofImage: React.FC<{ matchId: string; userId: string; small?: boolean; legacyUrl?: string }> = ({ matchId, userId, small, legacyUrl }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(legacyUrl || null);
  const [loading, setLoading] = useState(!legacyUrl);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (legacyUrl) return; // Don't fetch if we already have a legacy URL

    const fetchProof = async () => {
      try {
        const docRef = doc(db, 'payment_proofs', `${matchId}_${userId}`);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setDataUrl(snap.data().dataUrl);
        }
      } catch (err) {
        console.error("Failed to load payment proof", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProof();
  }, [matchId, userId, legacyUrl]);

  const wrapperClass = small ? "w-8 h-8 rounded shrink-0" : "w-20 h-28 rounded-lg shrink-0";
  const iconClass = small ? "w-4 h-4 text-gray-400" : "w-6 h-6 text-gray-400";
  const imgClass = small ? "w-8 h-8 object-cover rounded shadow-sm border border-gray-300 hover:opacity-80 transition" : "w-20 h-28 object-cover rounded-lg shadow-sm border border-gray-300 hover:opacity-80 transition";

  const modal = isModalOpen && dataUrl && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
      <div className="relative max-w-2xl max-h-[90vh] w-full flex justify-center" onClick={e => e.stopPropagation()}>
        <button onClick={() => setIsModalOpen(false)} className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors">
          <X className="w-8 h-8" />
        </button>
        <img src={dataUrl} alt="Payment Proof Full" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
      </div>
    </div>
  );

  if (loading) {
    return <div className={`${wrapperClass} bg-gray-200 animate-pulse flex items-center justify-center border border-gray-300`}><ImageIcon className={iconClass} /></div>;
  }

  if (!dataUrl) {
    if (small) return null;
    return <div className={`${wrapperClass} bg-red-50 text-red-400 flex items-center justify-center text-xs text-center p-2 border border-red-200`}>No Image</div>;
  }

  return (
    <>
      {small ? (
        <button onClick={() => setIsModalOpen(true)} className="text-gray-400 hover:text-emerald-600 transition inline-flex items-center justify-center p-1" title="View Uploaded Screenshot">
          <Eye className="w-5 h-5" />
        </button>
      ) : (
        <button onClick={() => setIsModalOpen(true)} className="block shrink-0 focus:outline-none" title="Click to view full screenshot">
          <img src={dataUrl} alt="Payment" className={imgClass} />
        </button>
      )}
      {modal}
    </>
  );
};
