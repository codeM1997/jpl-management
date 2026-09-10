import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock } from 'lucide-react';
import { Navbar } from '../components/Navbar';

export const PendingApproval: React.FC = () => {
  const { userData } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-2xl p-8 text-center border border-gray-100">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 mb-6">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Pending</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Hi {userData?.name?.split(' ')[0] || 'Player'}, your registration was successful! 
            However, your account is currently pending approval from the League Organizer.
          </p>
          <div className="bg-emerald-50 rounded-lg p-4 mb-2 text-sm text-emerald-800 text-left border border-emerald-100">
            <h3 className="font-bold mb-1">What happens next?</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>The Admin will review your profile.</li>
              <li>You will be assigned an Invite Tier and skill ratings.</li>
              <li>Once approved, you can RSVP to active matches here.</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};
