import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { PinInput } from '../components/PinInput';
import { LogIn, UserPlus } from 'lucide-react';

export const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (pin.length !== 6) {
      setError('Please enter a valid 6-digit PIN.');
      return;
    }
    if (!identifier.trim()) {
      setError('Please enter your email or phone number.');
      return;
    }

    setLoading(true);

    try {
      let loginEmail = identifier.trim();

      // If it looks like a phone number (no @ symbol), look up the email
      if (!loginEmail.includes('@')) {
        const usersRef = collection(db, 'users');
        // Simple query to find the user by phone number
        const q = query(usersRef, where('phone', '==', loginEmail));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          throw new Error('No account found with this phone number. Please sign up first.');
        }
        
        // Grab the first matched user's email
        loginEmail = querySnapshot.docs[0].data().email;
      }

      // We use the 6-digit PIN directly as the password
      await signInWithEmailAndPassword(auth, loginEmail, pin);
      
      // Navigate to root, ProtectedRoute will redirect them based on role
      navigate('/');
      
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Incorrect PIN or account not found.');
      } else {
        setError(err.message || 'Failed to sign in.');
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
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm text-center font-medium">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">
                Email Address or Phone Number
              </label>
              <div className="mt-1">
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="e.g., player@example.com or 5551234567"
                />
              </div>
            </div>

            <div className="pt-2">
              <PinInput value={pin} onChange={setPin} label="Enter your 6-digit PIN" />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign in
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">New player?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/join"
                className="w-full flex justify-center py-2.5 px-4 border-2 border-emerald-600 rounded-md shadow-sm text-sm font-medium text-emerald-700 bg-white hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                <UserPlus className="w-5 h-5 mr-2 text-emerald-600" />
                Join the Waitlist
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
