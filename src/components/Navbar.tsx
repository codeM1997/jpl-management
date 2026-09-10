import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Shield, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-emerald-700 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-2xl">⚽</span>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide">6v6 Match Organizer</h1>
            <span className="text-xs text-emerald-200">Amateur League</span>
          </div>
        </div>

        {userData && (
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold">{userData.name}</div>
              <div className="text-xs flex items-center justify-end gap-1.5 text-emerald-200">
                <span className="uppercase px-1.5 py-0.5 rounded bg-emerald-800 text-[10px] font-bold">
                  {userData.role}
                </span>
                {(userData.role === 'admin' || userData.role === 'organizer') && userData.tier && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 text-[10px] font-bold">
                    Tier {userData.tier}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300 text-[10px] font-bold">
                  {userData.preferredPos}
                </span>
              </div>
            </div>

            {(userData.role === 'admin' || userData.role === 'organizer') && (
              isAdminRoute ? (
                <button
                  onClick={() => navigate('/player')}
                  title="Player View"
                  className="p-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 transition flex items-center text-xs gap-1"
                >
                  <User className="w-4 h-4 text-emerald-200" />
                  <span className="hidden md:inline font-medium">Player View</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/admin')}
                  title="Admin Dashboard"
                  className="p-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 transition flex items-center text-xs gap-1"
                >
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="hidden md:inline font-medium">Admin Dashboard</span>
                </button>
              )
            )}

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-lg bg-emerald-800 hover:bg-red-700 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
