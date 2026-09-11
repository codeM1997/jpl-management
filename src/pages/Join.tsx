import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { PinInput } from '../components/PinInput';
import type { Position } from '../types';
import { UserPlus, ArrowLeft } from 'lucide-react';

export const Join: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [positions, setPositions] = useState<Position[]>(['MID']);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length !== 6) {
      setError('Please enter a full 6-digit PIN.');
      return;
    }

    setLoading(true);

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pin);
      const user = userCredential.user;

      // 2. Create Firestore user profile
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: 'pending', // Awaits admin approval
        tier: null,
        preferredPos: positions,
        attackRating: 5,
        defRating: 5,
        passingRating: 5,
        gkRating: 5,
        iqRating: 5,
        fcmToken: null,
        createdAt: serverTimestamp()
      });

      // Navigate to root, which will push them to /pending because their role is 'pending'
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else {
        setError(err.message || 'Failed to create account.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-5xl">⚽</div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Join the League
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Register for the 6v6 Match Organizer
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-5" onSubmit={handleRegister}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm text-center font-medium">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                placeholder="e.g. Lionel Messi"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
              <input
                id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                placeholder="e.g. 5551234567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Positions (Select multiple)</label>
              <div className="flex gap-2">
                {(['GK', 'DEF', 'MID', 'ST'] as Position[]).map(pos => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      if (positions.includes(pos)) {
                        if (positions.length > 1) setPositions(positions.filter(p => p !== pos));
                      } else {
                        setPositions([...positions, pos]);
                      }
                    }}
                    className={`flex-1 py-2 px-1 text-xs font-bold rounded-lg border transition-colors ${positions.includes(pos) ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <PinInput value={pin} onChange={setPin} label="Create a 6-digit PIN for login" />
            </div>

            <div className="pt-2">
              <button
                type="submit" disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                {loading ? 'Registering...' : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Register Account
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-5">
            <Link to="/login" className="flex items-center justify-center text-sm font-medium text-emerald-600 hover:text-emerald-500">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
