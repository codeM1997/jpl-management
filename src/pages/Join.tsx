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
  const [position, setPosition] = useState<Position>('MID');
  const [attackRating, setAttackRating] = useState(5);
  const [defRating, setDefRating] = useState(5);
  const [passingRating, setPassingRating] = useState(5);
  const [gkRating, setGkRating] = useState(5);
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
        preferredPos: position,
        attackRating,
        defRating,
        passingRating,
        gkRating,
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
              <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">Preferred Position</label>
              <select
                id="position" value={position} onChange={(e) => setPosition(e.target.value as Position)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
              >
                <option value="GK">Goalkeeper (GK)</option>
                <option value="DEF">Defender (DEF)</option>
                <option value="MID">Midfielder (MID)</option>
                <option value="ST">Striker (ST)</option>
              </select>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2">Self-Rate Your Skills (1-10)</h3>
              
              <div>
                <div className="flex justify-between">
                  <label className="text-xs font-bold text-gray-700">Attack</label>
                  <span className="text-xs font-black text-emerald-600">{attackRating}/10</span>
                </div>
                <input type="range" min="1" max="10" value={attackRating} onChange={(e) => setAttackRating(Number(e.target.value))} className="w-full mt-1 accent-emerald-600" />
              </div>

              <div>
                <div className="flex justify-between">
                  <label className="text-xs font-bold text-gray-700">Defense</label>
                  <span className="text-xs font-black text-blue-600">{defRating}/10</span>
                </div>
                <input type="range" min="1" max="10" value={defRating} onChange={(e) => setDefRating(Number(e.target.value))} className="w-full mt-1 accent-blue-600" />
              </div>

              <div>
                <div className="flex justify-between">
                  <label className="text-xs font-bold text-gray-700">Passing</label>
                  <span className="text-xs font-black text-amber-600">{passingRating}/10</span>
                </div>
                <input type="range" min="1" max="10" value={passingRating} onChange={(e) => setPassingRating(Number(e.target.value))} className="w-full mt-1 accent-amber-600" />
              </div>

              <div>
                <div className="flex justify-between">
                  <label className="text-xs font-bold text-gray-700">Goalkeeping</label>
                  <span className="text-xs font-black text-purple-600">{gkRating}/10</span>
                </div>
                <input type="range" min="1" max="10" value={gkRating} onChange={(e) => setGkRating(Number(e.target.value))} className="w-full mt-1 accent-purple-600" />
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
