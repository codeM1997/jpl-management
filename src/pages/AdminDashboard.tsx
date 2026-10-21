import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { AppUser, Tier, UserRole, Position } from '../types';
import { Check, X, ShieldAlert, Edit2 } from 'lucide-react';
import { AdminMatches } from '../components/AdminMatches';
import { useAuth } from '../context/AuthContext';
import { calculatePositionRatings, normalizePlayer } from '../utils/ratingEngine';
import { OFFICIAL_PLAYERS } from '../data/officialPlayers';

interface AdminPlayerFormData {
  name: string;
  tier: Tier;
  role: UserRole;
  primaryPosition: Position;
  secondaryPosition: Position | '';
  happyAnywhere: boolean;
  pace: number;
  stamina: number;
  dribbling: number;
  passing: number;
  finishing: number;
  defending: number;
  gameIQ: number;
  gkRating: number | null;
}

const DEFAULT_FORM_DATA: AdminPlayerFormData = {
  name: '',
  tier: 2,
  role: 'player',
  primaryPosition: 'MID',
  secondaryPosition: '',
  happyAnywhere: false,
  pace: 5,
  stamina: 5,
  dribbling: 5,
  passing: 5,
  finishing: 5,
  defending: 5,
  gameIQ: 5,
  gkRating: null,
};

export const AdminDashboard: React.FC = () => {
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const isOrganizer = userData?.role === 'organizer';
  const [pendingUsers, setPendingUsers] = useState<AppUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<AppUser[]>([]);
  const [activeTab, setActiveTab] = useState<'matches' | 'queue' | 'players'>('matches');
  
  // State for the form data of each pending user
  const [approvalData, setApprovalData] = useState<Record<string, AdminPlayerFormData>>({});

  // Editing Player State
  const [editingPlayer, setEditingPlayer] = useState<AppUser | null>(null);
  const [editData, setEditData] = useState<AdminPlayerFormData>(DEFAULT_FORM_DATA);

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
          const norm = normalizePlayer(u);
          newApprovalData[u.uid] = { 
            name: u.name || '',
            tier: u.tier || 2, 
            role: 'player',
            primaryPosition: norm.primaryPosition,
            secondaryPosition: norm.secondaryPosition || '',
            happyAnywhere: norm.happyAnywhere,
            pace: norm.attributes.pace,
            stamina: norm.attributes.stamina,
            dribbling: norm.attributes.dribbling,
            passing: norm.attributes.passing,
            finishing: norm.attributes.finishing,
            defending: norm.attributes.defending,
            gameIQ: norm.attributes.gameIQ,
            gkRating: norm.attributes.gkRating ?? null,
          };
        }
      });
      
      setPendingUsers(users);
      setApprovalData(newApprovalData);
    });

    // Listen for approved players
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

  const handleUpdate = (uid: string, field: keyof AdminPlayerFormData, value: any) => {
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
        primaryPosition: data.primaryPosition,
        secondaryPosition: data.secondaryPosition || null,
        happyAnywhere: data.happyAnywhere,
        pace: data.pace,
        stamina: data.stamina,
        dribbling: data.dribbling,
        passing: data.passing,
        finishing: data.finishing,
        defending: data.defending,
        gameIQ: data.gameIQ,
        gkRating: data.gkRating,
      });
    } catch (err) {
      console.error("Failed to approve user:", err);
      alert("Failed to approve. Check console.");
    }
  };

  const handleReject = async (uid: string) => {
    if (window.confirm('Are you sure you want to completely remove this player? They will be deleted from all matches.')) {
      try {
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

        await deleteDoc(doc(db, 'users', uid));
      } catch (err) {
        console.error("Failed to remove user:", err);
      }
    }
  };

  const openEditModal = (user: AppUser) => {
    const norm = normalizePlayer(user);
    setEditingPlayer(user);
    setEditData({ 
      name: user.name,
      tier: user.tier || 2, 
      role: user.role,
      primaryPosition: norm.primaryPosition,
      secondaryPosition: norm.secondaryPosition || '',
      happyAnywhere: norm.happyAnywhere,
      pace: norm.attributes.pace,
      stamina: norm.attributes.stamina,
      dribbling: norm.attributes.dribbling,
      passing: norm.attributes.passing,
      finishing: norm.attributes.finishing,
      defending: norm.attributes.defending,
      gameIQ: norm.attributes.gameIQ,
      gkRating: norm.attributes.gkRating ?? null,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPlayer) return;

    try {
      await updateDoc(doc(db, 'users', editingPlayer.uid), {
        name: editData.name.trim() || editingPlayer.name,
        role: editData.role,
        tier: editData.tier,
        primaryPosition: editData.primaryPosition,
        secondaryPosition: editData.secondaryPosition || null,
        happyAnywhere: editData.happyAnywhere,
        pace: editData.pace,
        stamina: editData.stamina,
        dribbling: editData.dribbling,
        passing: editData.passing,
        finishing: editData.finishing,
        defending: editData.defending,
        gameIQ: editData.gameIQ,
        gkRating: editData.gkRating,
      });
      setEditingPlayer(null);
    } catch (err) {
      console.error("Failed to update user:", err);
      alert("Failed to update user.");
    }
  };

  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedOfficialPlayers = async () => {
    if (!window.confirm("Seed/Update all 24 official players from the template? This will safely update existing players (including Anshul) and create any missing ones.")) {
      return;
    }
    setIsSeeding(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const existingByName = new Map<string, any>();
      const existingByEmail = new Map<string, any>();

      usersSnapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d.name) existingByName.set(d.name.trim().toLowerCase(), { uid: docSnap.id, ...d });
        if (d.email) existingByEmail.set(d.email.trim().toLowerCase(), { uid: docSnap.id, ...d });
      });

      for (let i = 0; i < OFFICIAL_PLAYERS.length; i++) {
        const p = OFFICIAL_PLAYERS[i];
        const nameLower = p.name.trim().toLowerCase();
        const firstWord = nameLower.split(' ')[0];

        let existing = existingByName.get(nameLower)
          || existingByName.get(firstWord)
          || existingByEmail.get(`${firstWord}@test.com`)
          || existingByEmail.get(`${firstWord}@jpl.com`);

        if (!existing && nameLower.includes('anshul')) {
          for (const [k, v] of existingByName.entries()) {
            if (k.includes('anshul')) {
              existing = v;
              break;
            }
          }
        }

        const uid = existing ? existing.uid : `player_official_${i + 1}`;
        const role = existing ? (existing.role || 'player') : 'player';
        const tier = existing?.tier ? existing.tier : 1;
        const phone = existing?.phone ? existing.phone : `98100${(i + 1).toString().padStart(5, '0')}`;
        const email = existing?.email ? existing.email : `${firstWord}_${i + 1}@jpl.com`;

        const playerDoc: any = {
          uid,
          name: p.name,
          email,
          phone,
          role,
          tier,
          primaryPosition: p.primaryPosition,
          secondaryPosition: p.secondaryPosition,
          happyAnywhere: p.happyAnywhere,
          pace: p.pace,
          stamina: p.stamina,
          dribbling: p.dribbling,
          passing: p.passing,
          finishing: p.finishing,
          defending: p.defending,
          gameIQ: p.gameIQ,
          gkRating: p.gkRating,
          createdAt: existing?.createdAt || new Date(),
          updatedAt: new Date(),
        };

        if (!existing) {
          playerDoc.pin = '123456';
        }

        await setDoc(doc(db, 'users', uid), playerDoc, { merge: true });
      }

      alert("🎉 Successfully seeded/updated all 24 official players!");
    } catch (err: any) {
      console.error("Seeding error:", err);
      alert(`Failed to seed players: ${err.message || err}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-screen-2xl w-full mx-auto p-4 sm:p-6 lg:p-8">
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
              pendingUsers.map(user => {
                const formData = approvalData[user.uid] || DEFAULT_FORM_DATA;
                const calculated = calculatePositionRatings({
                  pace: formData.pace,
                  stamina: formData.stamina,
                  dribbling: formData.dribbling,
                  passing: formData.passing,
                  finishing: formData.finishing,
                  defending: formData.defending,
                  gameIQ: formData.gameIQ,
                  gkRating: formData.gkRating,
                });

                return (
                  <div key={user.uid} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 lg:flex lg:items-start lg:justify-between gap-6">
                    <div className="flex-grow mb-4 lg:mb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
                        {formData.happyAnywhere && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Flex Player
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-gray-500 mb-2">
                        Position: <span className="text-emerald-700 font-bold">{formData.primaryPosition}</span>
                        {formData.secondaryPosition && <span className="text-gray-400"> / {formData.secondaryPosition}</span>}
                      </div>
                      <div className="text-sm text-gray-500 space-y-0.5">
                        <p>📞 {user.phone}</p>
                        <p>✉️ {user.email}</p>
                      </div>

                      {/* Live Calculated Position Ratings Preview */}
                      <div className="mt-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-3 rounded-xl max-w-sm">
                        <div className="flex justify-between items-center text-xs font-bold text-emerald-900 mb-2">
                          <span>Auto Calculated Ratings</span>
                          <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
                            Best: {calculated.bestPosition}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center font-mono text-sm">
                          <div className="bg-white py-1.5 rounded-lg border border-emerald-100 shadow-sm">
                            <span className="text-[10px] block text-gray-500 font-sans font-bold">DEF</span>
                            <span className="font-bold text-blue-700">{calculated.def}</span>
                          </div>
                          <div className="bg-white py-1.5 rounded-lg border border-emerald-100 shadow-sm">
                            <span className="text-[10px] block text-gray-500 font-sans font-bold">MID</span>
                            <span className="font-bold text-emerald-700">{calculated.mid}</span>
                          </div>
                          <div className="bg-white py-1.5 rounded-lg border border-emerald-100 shadow-sm">
                            <span className="text-[10px] block text-gray-500 font-sans font-bold">FWD</span>
                            <span className="font-bold text-amber-700">{calculated.fwd}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 sm:w-80 border border-gray-200 shrink-0 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Invite Tier</label>
                          <select 
                            value={formData.tier} 
                            onChange={(e) => handleUpdate(user.uid, 'tier', Number(e.target.value) as Tier)}
                            className="w-full text-xs rounded border-gray-300 focus:ring-emerald-500 py-1.5"
                          >
                            <option value={1}>Tier 1 (Priority)</option>
                            <option value={2}>Tier 2 (Standard)</option>
                            <option value={3}>Tier 3 (Waitlist)</option>
                          </select>
                        </div>
                        {isAdmin && (
                          <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">Role</label>
                            <select 
                              value={formData.role} 
                              onChange={(e) => handleUpdate(user.uid, 'role', e.target.value as UserRole)}
                              className="w-full text-xs rounded border-gray-300 focus:ring-emerald-500 py-1.5"
                            >
                              <option value="player">Player</option>
                              <option value="organizer">Organizer</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Position selection */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Primary Pos</label>
                          <select
                            value={formData.primaryPosition}
                            onChange={(e) => handleUpdate(user.uid, 'primaryPosition', e.target.value as Position)}
                            className="w-full text-xs rounded border-gray-300 py-1.5"
                          >
                            <option value="GK">GK</option>
                            <option value="DEF">DEF</option>
                            <option value="MID">MID</option>
                            <option value="FWD">FWD</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Secondary Pos</label>
                          <select
                            value={formData.secondaryPosition || ''}
                            onChange={(e) => handleUpdate(user.uid, 'secondaryPosition', e.target.value as Position || '')}
                            className="w-full text-xs rounded border-gray-300 py-1.5"
                          >
                            <option value="">None</option>
                            <option value="GK">GK</option>
                            <option value="DEF">DEF</option>
                            <option value="MID">MID</option>
                            <option value="FWD">FWD</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-emerald-50 p-2 rounded border border-emerald-100">
                        <input
                          id={`happy-${user.uid}`}
                          type="checkbox"
                          checked={formData.happyAnywhere}
                          onChange={(e) => handleUpdate(user.uid, 'happyAnywhere', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                        />
                        <label htmlFor={`happy-${user.uid}`} className="text-xs font-bold text-emerald-900 cursor-pointer">
                          Happy anywhere (Flex)
                        </label>
                      </div>

                      {/* 7 Attribute Sliders */}
                      <div className="space-y-2 pt-2 border-t border-gray-200">
                        <div>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-bold text-gray-700">Pace</span>
                            <span className="font-black text-amber-600">{formData.pace}</span>
                          </div>
                          <input type="range" min="1" max="10" step="0.5" value={formData.pace} onChange={(e) => handleUpdate(user.uid, 'pace', Number(e.target.value))} className="w-full accent-amber-500 h-1.5" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-bold text-gray-700">Stamina / Work rate</span>
                            <span className="font-black text-emerald-600">{formData.stamina}</span>
                          </div>
                          <input type="range" min="1" max="10" step="0.5" value={formData.stamina} onChange={(e) => handleUpdate(user.uid, 'stamina', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-bold text-gray-700">Control & Dribbling</span>
                            <span className="font-black text-indigo-600">{formData.dribbling}</span>
                          </div>
                          <input type="range" min="1" max="10" step="0.5" value={formData.dribbling} onChange={(e) => handleUpdate(user.uid, 'dribbling', Number(e.target.value))} className="w-full accent-indigo-500 h-1.5" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-bold text-gray-700">Passing & Vision</span>
                            <span className="font-black text-blue-600">{formData.passing}</span>
                          </div>
                          <input type="range" min="1" max="10" step="0.5" value={formData.passing} onChange={(e) => handleUpdate(user.uid, 'passing', Number(e.target.value))} className="w-full accent-blue-500 h-1.5" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-bold text-gray-700">Finishing</span>
                            <span className="font-black text-rose-600">{formData.finishing}</span>
                          </div>
                          <input type="range" min="1" max="10" step="0.5" value={formData.finishing} onChange={(e) => handleUpdate(user.uid, 'finishing', Number(e.target.value))} className="w-full accent-rose-500 h-1.5" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-bold text-gray-700">Defending</span>
                            <span className="font-black text-cyan-600">{formData.defending}</span>
                          </div>
                          <input type="range" min="1" max="10" step="0.5" value={formData.defending} onChange={(e) => handleUpdate(user.uid, 'defending', Number(e.target.value))} className="w-full accent-cyan-500 h-1.5" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-bold text-gray-700">Game IQ</span>
                            <span className="font-black text-purple-600">{formData.gameIQ}</span>
                          </div>
                          <input type="range" min="1" max="10" step="0.5" value={formData.gameIQ} onChange={(e) => handleUpdate(user.uid, 'gameIQ', Number(e.target.value))} className="w-full accent-purple-500 h-1.5" />
                        </div>
                        <div className="pt-1.5 border-t border-gray-200">
                          <div className="flex justify-between items-center text-xs mb-0.5">
                            <span className="font-bold text-gray-700">GK Rating</span>
                            {formData.gkRating !== null ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-purple-600">{formData.gkRating}</span>
                                <button type="button" onClick={() => handleUpdate(user.uid, 'gkRating', null)} className="text-[10px] text-red-500 hover:underline">Clear</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => handleUpdate(user.uid, 'gkRating', 5)} className="text-[10px] text-emerald-600 font-bold hover:underline">+ Rate GK</button>
                            )}
                          </div>
                          {formData.gkRating !== null && (
                            <input type="range" min="1" max="10" step="0.5" value={formData.gkRating} onChange={(e) => handleUpdate(user.uid, 'gkRating', Number(e.target.value))} className="w-full accent-purple-600 h-1.5" />
                          )}
                        </div>
                      </div>

                      <div className="pt-2 flex gap-2">
                        <button 
                          onClick={() => handleApprove(user.uid)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition shadow-sm"
                        >
                          <Check className="w-4 h-4" /> Approve
                        </button>
                        <button 
                          onClick={() => handleReject(user.uid)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-2 rounded-lg flex items-center justify-center transition border border-red-200"
                          title="Reject / Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'players' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Approved Players Directory</h3>
                <p className="text-xs text-gray-500">Official Sunday 6v6 Player Ratings & Position Preferences</p>
              </div>
              {isAdmin && import.meta.env.DEV && (
                <button
                  onClick={handleSeedOfficialPlayers}
                  disabled={isSeeding}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer"
                  title="Visible only in local development"
                >
                  <span>🌱</span>
                  <span>{isSeeding ? 'Seeding Official Players...' : 'Seed Official Players (24)'}</span>
                  <span className="text-[9px] bg-emerald-800 text-emerald-200 px-1.5 py-0.5 rounded font-mono uppercase tracking-wide">Dev Only</span>
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position Ratings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {approvedUsers.map((user) => {
                    const norm = normalizePlayer(user);
                    return (
                      <tr key={user.uid}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                {user.name}
                                {norm.happyAnywhere && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded" title="Happy anywhere">
                                    Flex
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                <span className="font-bold text-emerald-700 bg-emerald-50 px-1 rounded">{norm.primaryPosition}</span>
                                {norm.secondaryPosition && (
                                  <span className="text-gray-600 bg-gray-100 px-1 rounded">/ {norm.secondaryPosition}</span>
                                )}
                              </div>
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1.5 text-xs font-mono">
                              <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-bold border border-blue-200">DEF {norm.calculated.def}</span>
                              <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold border border-emerald-200">MID {norm.calculated.mid}</span>
                              <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-bold border border-amber-200">FWD {norm.calculated.fwd}</span>
                              {norm.attributes.gkRating !== null && norm.attributes.gkRating !== undefined && (
                                <span className="bg-purple-50 text-purple-800 px-2 py-0.5 rounded font-bold border border-purple-200">GK {norm.attributes.gkRating}</span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-gray-600 uppercase bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                              Best: {norm.calculated.bestPosition}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                        {(isAdmin || (isOrganizer && user.role === 'player')) && (
                          <div className="flex items-center gap-3">
                            <button onClick={() => openEditModal(user)} className="text-emerald-600 hover:text-emerald-900 flex items-center gap-1 font-semibold">
                              <Edit2 className="w-4 h-4" /> Edit
                            </button>
                            <button onClick={() => handleReject(user.uid)} className="text-red-600 hover:text-red-900 font-semibold">
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

        {/* Edit Player Modal */}
        {editingPlayer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 my-auto max-h-[92vh] flex flex-col">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100 shrink-0 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Edit {editingPlayer.name}</h3>
                  <p className="text-xs text-gray-500">Update player details, positions, and skill attributes</p>
                </div>
                <button onClick={() => setEditingPlayer(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto pr-1 flex-grow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Player Info, Positions & Calculated Ratings */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Name</label>
                      <input type="text" value={editData.name} onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))} className="w-full text-sm rounded-lg border-gray-300 focus:ring-emerald-500 py-1.5" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {isAdmin && (
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Role</label>
                          <select 
                            value={editData.role} 
                            onChange={e => setEditData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                            className="w-full text-xs rounded-lg border-gray-300 focus:ring-emerald-500 py-1.5"
                          >
                            <option value="player">Player</option>
                            <option value="organizer">Organizer</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      )}
                      <div className={isAdmin ? "" : "col-span-2"}>
                        <label className="text-xs font-bold text-gray-700 block mb-1">Tier</label>
                        <select 
                          value={editData.tier} 
                          onChange={e => setEditData(prev => ({ ...prev, tier: Number(e.target.value) as Tier }))}
                          className="w-full text-xs rounded-lg border-gray-300 focus:ring-emerald-500 py-1.5"
                        >
                          <option value={1}>Tier 1 (Priority)</option>
                          <option value={2}>Tier 2 (Standard)</option>
                          <option value={3}>Tier 3 (Waitlist likely)</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Position selection */}
                    <div className="pt-2 border-t border-gray-100 space-y-2.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Primary Pos</label>
                          <select
                            value={editData.primaryPosition}
                            onChange={(e) => setEditData(prev => ({ ...prev, primaryPosition: e.target.value as Position }))}
                            className="w-full text-xs rounded-lg border-gray-300 py-1.5"
                          >
                            <option value="GK">GK</option>
                            <option value="DEF">DEF</option>
                            <option value="MID">MID</option>
                            <option value="FWD">FWD</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Secondary Pos</label>
                          <select
                            value={editData.secondaryPosition || ''}
                            onChange={(e) => setEditData(prev => ({ ...prev, secondaryPosition: e.target.value as Position || '' }))}
                            className="w-full text-xs rounded-lg border-gray-300 py-1.5"
                          >
                            <option value="">None</option>
                            <option value="GK">GK</option>
                            <option value="DEF">DEF</option>
                            <option value="MID">MID</option>
                            <option value="FWD">FWD</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                        <input
                          id="editHappyAnywhere"
                          type="checkbox"
                          checked={editData.happyAnywhere}
                          onChange={(e) => setEditData(prev => ({ ...prev, happyAnywhere: e.target.checked }))}
                          className="w-4 h-4 text-emerald-600 rounded border-gray-300"
                        />
                        <label htmlFor="editHappyAnywhere" className="text-xs font-bold text-emerald-900 cursor-pointer">
                          Happy anywhere (Flex Player)
                        </label>
                      </div>
                    </div>

                    {/* Live Preview in Edit Modal */}
                    {(() => {
                      const calculated = calculatePositionRatings({
                        pace: editData.pace,
                        stamina: editData.stamina,
                        dribbling: editData.dribbling,
                        passing: editData.passing,
                        finishing: editData.finishing,
                        defending: editData.defending,
                        gameIQ: editData.gameIQ,
                        gkRating: editData.gkRating,
                      });
                      return (
                        <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/50 border border-emerald-200 p-3 rounded-xl shadow-xs">
                          <div className="flex justify-between items-center text-xs font-bold text-emerald-900 mb-2">
                            <span>Live Position Ratings</span>
                            <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide">
                              Best: {calculated.bestPosition}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center font-mono">
                            <div className="bg-white py-2 rounded-lg border border-emerald-100 shadow-xs">
                              <span className="text-[10px] block text-gray-500 font-sans font-bold">DEF</span>
                              <span className="font-bold text-sm text-blue-700">{calculated.def}</span>
                            </div>
                            <div className="bg-white py-2 rounded-lg border border-emerald-100 shadow-xs">
                              <span className="text-[10px] block text-gray-500 font-sans font-bold">MID</span>
                              <span className="font-bold text-sm text-emerald-700">{calculated.mid}</span>
                            </div>
                            <div className="bg-white py-2 rounded-lg border border-emerald-100 shadow-xs">
                              <span className="text-[10px] block text-gray-500 font-sans font-bold">FWD</span>
                              <span className="font-bold text-sm text-amber-700">{calculated.fwd}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right Column: 7 Attribute Sliders + GK Rating */}
                  <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-200/80 space-y-2.5">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-700 pb-1 border-b border-gray-200">
                      <span>Core Attributes</span>
                      <span className="text-[10px] text-gray-400 font-normal">Scale: 1 – 10</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-bold text-gray-700">Pace</span>
                        <span className="font-black text-amber-600">{editData.pace}</span>
                      </div>
                      <input type="range" min="1" max="10" step="0.5" value={editData.pace} onChange={(e) => setEditData(prev => ({ ...prev, pace: Number(e.target.value) }))} className="w-full accent-amber-500 h-1.5" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-bold text-gray-700">Stamina / Work rate</span>
                        <span className="font-black text-emerald-600">{editData.stamina}</span>
                      </div>
                      <input type="range" min="1" max="10" step="0.5" value={editData.stamina} onChange={(e) => setEditData(prev => ({ ...prev, stamina: Number(e.target.value) }))} className="w-full accent-emerald-500 h-1.5" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-bold text-gray-700">Control & Dribbling</span>
                        <span className="font-black text-indigo-600">{editData.dribbling}</span>
                      </div>
                      <input type="range" min="1" max="10" step="0.5" value={editData.dribbling} onChange={(e) => setEditData(prev => ({ ...prev, dribbling: Number(e.target.value) }))} className="w-full accent-indigo-500 h-1.5" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-bold text-gray-700">Passing & Vision</span>
                        <span className="font-black text-blue-600">{editData.passing}</span>
                      </div>
                      <input type="range" min="1" max="10" step="0.5" value={editData.passing} onChange={(e) => setEditData(prev => ({ ...prev, passing: Number(e.target.value) }))} className="w-full accent-blue-500 h-1.5" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-bold text-gray-700">Finishing</span>
                        <span className="font-black text-rose-600">{editData.finishing}</span>
                      </div>
                      <input type="range" min="1" max="10" step="0.5" value={editData.finishing} onChange={(e) => setEditData(prev => ({ ...prev, finishing: Number(e.target.value) }))} className="w-full accent-rose-500 h-1.5" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-bold text-gray-700">Defending</span>
                        <span className="font-black text-cyan-600">{editData.defending}</span>
                      </div>
                      <input type="range" min="1" max="10" step="0.5" value={editData.defending} onChange={(e) => setEditData(prev => ({ ...prev, defending: Number(e.target.value) }))} className="w-full accent-cyan-500 h-1.5" />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-bold text-gray-700">Game IQ</span>
                        <span className="font-black text-purple-600">{editData.gameIQ}</span>
                      </div>
                      <input type="range" min="1" max="10" step="0.5" value={editData.gameIQ} onChange={(e) => setEditData(prev => ({ ...prev, gameIQ: Number(e.target.value) }))} className="w-full accent-purple-500 h-1.5" />
                    </div>

                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center text-xs mb-0.5">
                        <span className="font-bold text-gray-700">GK Rating</span>
                        {editData.gkRating !== null ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-purple-600">{editData.gkRating}</span>
                            <button type="button" onClick={() => setEditData(prev => ({ ...prev, gkRating: null }))} className="text-[10px] text-red-500 hover:underline">Clear</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setEditData(prev => ({ ...prev, gkRating: 5 }))} className="text-[10px] text-emerald-600 font-bold hover:underline">+ Rate GK</button>
                        )}
                      </div>
                      {editData.gkRating !== null && (
                        <input type="range" min="1" max="10" step="0.5" value={editData.gkRating} onChange={(e) => setEditData(prev => ({ ...prev, gkRating: Number(e.target.value) }))} className="w-full accent-purple-600 h-1.5" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-gray-100 flex gap-3 shrink-0">
                <button onClick={handleSaveEdit} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-sm">
                  Save Changes
                </button>
                <button onClick={() => setEditingPlayer(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 px-4 rounded-xl transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
