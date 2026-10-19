import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase';
import { PinInput } from '../components/PinInput';
import { KeyRound, CheckCircle2, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

export const ResetPin: React.FC = () => {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setCodeError('No reset code found in this link. Please request a new PIN reset link from the login page.');
      setVerifying(false);
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setVerifiedEmail(email);
        setVerifying(false);
      })
      .catch((err) => {
        console.error('Error verifying reset code:', err);
        if (err.code === 'auth/invalid-action-code' || err.code === 'auth/expired-action-code') {
          setCodeError('This reset link has expired or has already been used. Please request a fresh PIN reset from the sign-in page.');
        } else {
          setCodeError(err.message || 'Invalid reset link.');
        }
        setVerifying(false);
      });
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (newPin.length !== 6) {
      setSubmitError('Please enter a complete 6-digit PIN.');
      return;
    }

    if (newPin !== confirmPin) {
      setSubmitError('PINs do not match. Please make sure both PINs are identical.');
      return;
    }

    if (!oobCode) {
      setSubmitError('Invalid session. Please request a new link.');
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPin);
      setSuccess(true);
    } catch (err: any) {
      console.error('Failed to confirm PIN reset:', err);
      if (err.code === 'auth/invalid-action-code' || err.code === 'auth/expired-action-code') {
        setSubmitError('This reset link has expired. Please request a new one.');
      } else {
        setSubmitError(err.message || 'Failed to update PIN. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-5xl">⚽</div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Reset your 6-digit PIN
        </h2>
        {verifiedEmail && (
          <p className="mt-2 text-center text-sm text-gray-600">
            Setting new PIN for <span className="font-semibold text-gray-800">{verifiedEmail}</span>
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {verifying ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto text-emerald-600 animate-spin mb-3" />
              <p className="text-sm font-medium text-gray-600">Verifying your reset link...</p>
            </div>
          ) : codeError ? (
            <div className="text-center py-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Link Expired or Invalid</h3>
              <p className="text-sm text-gray-600 mb-6">{codeError}</p>
              <Link
                to="/login"
                className="w-full inline-flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none"
              >
                Back to Sign In
              </Link>
            </div>
          ) : success ? (
            <div className="text-center py-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 mb-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">PIN Updated Successfully!</h3>
              <p className="text-sm text-gray-600 mb-6">
                Your 6-digit PIN has been updated. You can now use it to sign in to your account.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none"
              >
                Sign In Now
              </button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {submitError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm text-center font-medium">
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Enter new 6-digit PIN
                </label>
                <PinInput value={newPin} onChange={setNewPin} label="" />
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Confirm new 6-digit PIN
                </label>
                <PinInput value={confirmPin} onChange={setConfirmPin} label="" />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={submitting || newPin.length !== 6 || confirmPin.length !== 6}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Updating PIN...' : (
                    <>
                      <KeyRound className="w-5 h-5 mr-2" />
                      Update PIN
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-500"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
