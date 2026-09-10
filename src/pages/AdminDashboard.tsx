import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { AppUser, Tier, UserRole } from '../types';
import { Check, X, ShieldAlert, Star, Edit2 } from 'lucide-react';
import { AdminMatches } from '../components/AdminMatches';
import { useAuth } from '../context/AuthContext';

export const AdminDashboard: React.FC = () => {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const [pendingUsers, setPendingUsers] = useState<AppUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<AppUser[]>([]);
  const [activeTab, setActiveTab] = useState<'matches' | 'queue' | 'players'>('matches');
  
  // State for the form data of each pending user
  const [approvalData, setApprovalData] = useState<Record<string, { tier: Tier, att: number, def: number, role: UserRole }>>({});

  // Editing Player State
  const [editingPlayer, setEditingPlayer] = useState<AppUser | null>(null);
  const [editData, setEditData] = useState<{ tier: Tier, att: number, def: number, role: UserRole }>({ tier: 2, att: 5, def: 5, role: 'player' });

  useEffect(() => {
    // Listen for pending users
    const qPending = query(collection(db, 'users'), where('role', '==', 'pending'));
    const unsubscribePending = onSnapshot(qPending, (snapshot) => {
      const users: AppUser[] = [];
      const newApprovalData = { ...approvalData };
      
      snapshot.forEach(doc => {
        const u = doc.data() as AppUser;
        users.push(u);
        if (!newApprovalData[u.uid]) {
          newApprovalData[u.uid] = { tier: 2, att: 5, def: 5, role: 'player' }; // Defaults
        }
      });
      
      setPendingUsers(users);
      setApprovalData(newApprovalData);
    });

    // Listen for approved players (including admins and organizers, basically anyone not pending)
    const qPlayers = query(collection(db, 'users'), where('role', '!=', 'pending'));
    const unsubscribePlayers = onSnapshot(qPlayers, (snapshot) => {
      const users: AppUser[] = [];
      snapshot.forEach(doc => users.push(doc.data() as AppUser));
      setApprovedUsers(users);
    });

    return () => {
      unsubscribePending();
      unsubscribePlayers();
    };
  }, []);

  const handleUpdate = (uid: string, field: 'tier' | 'att' | 'def' | 'role', value: any) => {
    setApprovalData(prev => ({
      ...prev,
      [uid]: { ...prev[uid], [field]: value }
    }));
  };

  const handleApprove = async (uid: string) => {
    const data = approvalData[uid];
    if (!data) return;
    
    // Organizers can only approve as player, admins can choose role
    const finalRole = isAdmin ? data.role : 'player';

    try {
      await updateDoc(doc(db, 'users', uid), {
        role: finalRole,
        tier: data.tier,
        attackRating: data.att,
        defRating: data.def
      });
    } catch (err) {
      console.error("Failed to approve user:", err);
      alert("Failed to approve. Check console.");
    }
  };

  const handleReject = async (uid: string) => {
    if (window.confirm('Are you sure you want to completely remove this player? They will be deleted from all matches.')) {
      try {
        // First scrub them from all matches so counts update correctly
        const matchesSnap = await getDocs(collection(db, 'matches'));
        matchesSnap.forEach(async (matchDoc) => {
          const data = matchDoc.data() as any;
          if (
            (data.roster && data.roster.includes(uid)) || 
            (data.waitlist && data.waitlist.includes(uid)) || 
            (data.teamRed && data.teamRed.includes(uid)) || 
            (data.teamWhite && data.teamWhite.includes(uid))
          ) {
            await updateDoc(doc(db, 'matches', matchDoc.id), {
              roster: data.roster ? data.roster.filter((id: string) => id !== uid) : [],
              waitlist: data.waitlist ? data.waitlist.filter((id: string) => id !== uid) : [],
              teamRed: data.teamRed ? data.teamRed.filter((id: string) => id !== uid) : [],
              teamWhite: data.teamWhite ? data.teamWhite.filter((id: string) => id !== uid) : []
            });
          }
        });

        // Then delete the user profile
        await deleteDoc(doc(db, 'users', uid));
      } catch (err) {
        console.error("Failed to remove user:", err);
      }
    }
  };

  const openEditModal = (user: AppUser) => {
    setEditingPlayer(user);
    setEditData({ tier: user.tier || 2, att: user.attackRating || 5, def: user.defRating || 5, role: user.role });
  };

  const handleSaveEdit = async () => {
    if (!editingPlayer) return;
    try {
      await updateDoc(doc(db, 'users', editingPlayer.uid), {
        tier: editData.tier,
        attackRating: editData.att,
        defRating: editData.def,
        role: editData.role
      });
      setEditingPlayer(null);
    } catch (err) {
      console.error("Failed to update user:", err);
      alert("Failed to update user.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-5xl w-full mx-auto p-4 sm:p-6">
        <div className="mb-6 flex space-x-1 bg-white p-1 rounded-lg shadow-sm border border-gray-200 inline-flex overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition whitespace-nowrap ${activeTab === 'matches' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Matches
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition whitespace-nowrap ${activeTab === 'queue' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Approval Queue ({pendingUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition whitespace-nowrap ${activeTab === 'players' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Approved Players ({approvedUsers.length})
          </button>
        </div>

        {activeTab === 'matches' && <AdminMatches />}

        {activeTab === 'queue' && (
          <div className="space-y-4">
            {pendingUsers.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                No pending users in the queue.
              </div>
            ) : (
              pendingUsers.map(user => (
                <div key={user.uid} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:flex sm:items-start sm:justify-between gap-4">
                  <div className="flex-grow mb-4 sm:mb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                        {user.preferredPos}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 space-y-0.5">
                      <p>📞 {user.phone}</p>
                      <p>✉️ {user.email}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 sm:w-72 border border-gray-100 shrink-0">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-gray-700 block mb-1">Invite Tier</label>
                        <select 
                          value={approvalData[user.uid]?.tier || 2} 
                          onChange={(e) => handleUpdate(user.uid, 'tier', Number(e.target.value))}
                          className="w-full text-sm rounded border-gray-300 focus:ring-emerald-500 py-1"
                        >
                          <option value={1}>Tier 1 (Priority)</option>
                          <option value={2}>Tier 2 (Standard)</option>
                          <option value={3}>Tier 3 (Waitlist likely)</option>
                        </select>
                      </div>

                      {isAdmin && (
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Role</label>
                          <select 
                            value={approvalData[user.uid]?.role || 'player'} 
                            onChange={(e) => handleUpdate(user.uid, 'role', e.target.value)}
                            className="w-full text-sm rounded border-gray-300 focus:ring-emerald-500 py-1"
                          >
                            <option value="player">Player</option>
                            <option value="organizer">Organizer</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1">
                            ATT <Star className="w-3 h-3 text-amber-500" />
                          </label>
                          <input 
                            type="number" min="1" max="10" 
                            value={approvalData[user.uid]?.att || 5} 
                            onChange={(e) => handleUpdate(user.uid, 'att', Number(e.target.value))}
                            className="w-full text-sm rounded border-gray-300 focus:ring-emerald-500 py-1"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1">
                            DEF <ShieldAlert className="w-3 h-3 text-blue-500" />
                          </label>
                          <input 
                            type="number" min="1" max="10" 
                            value={approvalData[user.uid]?.def || 5} 
                            onChange={(e) => handleUpdate(user.uid, 'def', Number(e.target.value))}
                            className="w-full text-sm rounded border-gray-300 focus:ring-emerald-500 py-1"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex gap-2">
                        <button 
                          onClick={() => handleApprove(user.uid)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-1 transition"
                        >
                          <Check className="w-4 h-4" /> Approve
                        </button>
                        <button 
                          onClick={() => handleReject(user.uid)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-2 rounded flex items-center justify-center transition border border-red-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'players' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {approvedUsers.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No approved players yet.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ratings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {approvedUsers.map((user) => (
                    <tr key={user.uid}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.preferredPos}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.phone}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">
                          Tier {user.tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ATT: {user.attackRating} | DEF: {user.defRating}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-3">
                        {isAdmin && (
                          <button onClick={() => openEditModal(user)} className="text-emerald-600 hover:text-emerald-900 flex items-center gap-1">
                            <Edit2 className="w-4 h-4" /> Edit
                          </button>
                        )}
                        <button onClick={() => handleReject(user.uid)} className="text-red-600 hover:text-red-900">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Edit Player Modal */}
        {editingPlayer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Edit {editingPlayer.name}</h3>
                <button onClick={() => setEditingPlayer(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1">Role</label>
                  <select 
                    value={editData.role} 
                    onChange={e => setEditData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                    className="w-full rounded border-gray-300 focus:ring-emerald-500"
                  >
                    <option value="player">Player</option>
                    <option value="organizer">Organizer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 block mb-1">Tier</label>
                  <select 
                    value={editData.tier} 
                    onChange={e => setEditData(prev => ({ ...prev, tier: Number(e.target.value) as Tier }))}
                    className="w-full rounded border-gray-300 focus:ring-emerald-500"
                  >
                    <option value={1}>Tier 1 (Priority)</option>
                    <option value={2}>Tier 2 (Standard)</option>
                    <option value={3}>Tier 3 (Waitlist likely)</option>
                  </select>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-bold text-gray-700 block mb-1">ATT</label>
                    <input type="number" min="1" max="10" value={editData.att} onChange={e => setEditData(prev => ({ ...prev, att: Number(e.target.value) }))} className="w-full rounded border-gray-300" />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-bold text-gray-700 block mb-1">DEF</label>
                    <input type="number" min="1" max="10" value={editData.def} onChange={e => setEditData(prev => ({ ...prev, def: Number(e.target.value) }))} className="w-full rounded border-gray-300" />
                  </div>
                </div>
                <div className="pt-4 flex gap-2">
                  <button onClick={handleSaveEdit} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg">
                    Save Changes
                  </button>
                  <button onClick={() => setEditingPlayer(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
