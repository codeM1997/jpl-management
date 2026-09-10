import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { currentUser, userData, loading } = useAuth();
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
      <div className="flex h-screen items-center justify-center bg-gray-50 text-emerald-700">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="font-medium">Loading profile...</p>
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
