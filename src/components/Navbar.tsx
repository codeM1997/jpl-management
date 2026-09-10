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
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 bg-emerald-800/40 rounded-lg mr-1 sm:mr-2">
                <span 
                  onClick={() => navigate('/player')}
                  className={`cursor-pointer text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-colors duration-200 ${!isAdminRoute ? 'text-white' : 'text-emerald-500 hover:text-emerald-400'}`}
                >
                  Player
                </span>
                <button
                  onClick={() => navigate(isAdminRoute ? '/player' : '/admin')}
                  className={`w-9 h-5 rounded-full relative p-0.5 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-emerald-700 ${isAdminRoute ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  title={isAdminRoute ? "Switch to Player View" : "Switch to Admin Dashboard"}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 flex items-center justify-center ${isAdminRoute ? 'translate-x-4' : 'translate-x-0'}`}>
                    {isAdminRoute ? <Shield className="w-2.5 h-2.5 text-amber-500" /> : <User className="w-2.5 h-2.5 text-emerald-500" />}
                  </div>
                </button>
                <span 
                  onClick={() => navigate('/admin')}
                  className={`cursor-pointer text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-colors duration-200 ${isAdminRoute ? 'text-white' : 'text-emerald-500 hover:text-emerald-400'}`}
                >
                  Admin
                </span>
              </div>
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
