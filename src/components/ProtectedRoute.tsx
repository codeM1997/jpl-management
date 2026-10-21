import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { currentUser, userData, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-emerald-700">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="font-medium">Loading match data...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Still fetching Firestore user data but authenticated
  if (!userData) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-emerald-700 p-4">
        <div className="text-center max-w-sm w-full bg-white p-6 rounded-2xl shadow-md border border-gray-100">
          <div className="w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="font-bold text-gray-900 text-base mb-1">Loading profile...</p>
          <p className="text-xs text-gray-500 mb-4">
            Connecting for <span className="font-semibold text-gray-700">{currentUser.email || currentUser.phoneNumber || 'User'}</span>
          </p>

          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => window.location.reload()}
              className="w-full text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-2.5 px-3 rounded-lg transition"
            >
              Retry
            </button>
            <button
              onClick={async () => {
                await logout();
                window.location.href = '/login';
              }}
              className="w-full text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 py-2.5 px-3 rounded-lg transition"
            >
              Sign Out & Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check role authorization
  if (allowedRoles && !allowedRoles.includes(userData.role)) {
    // Redirect based on their actual role if they try to access something they shouldn't
    if (userData.role === 'pending') return <Navigate to="/pending" replace />;
    if (userData.role === 'admin') return <Navigate to="/admin" replace />;
    if (userData.role === 'player') return <Navigate to="/player" replace />;
  }

  return <Outlet />;
};
