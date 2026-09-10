import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot, serverTimestamp, orderBy, updateDoc, doc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import type { Match } from '../types';
import { Calendar, MapPin, Clock, Edit2, Trash2, X, PlusCircle, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AdminMatches: React.FC = () => {
  const { userData } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Venues State
  const [venues, setVenues] = useState<{id: string, name: string, mapsLink: string}[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [isAddingVenue, setIsAddingVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueLink, setNewVenueLink] = useState('');

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [tier1Unlock, setTier1Unlock] = useState('');
  const [tier2Unlock, setTier2Unlock] = useState('');
  const [tier3Unlock, setTier3Unlock] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(12);

  const toLocalFormat = (d: Date) => {
    const local = new Date(d);
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    return local.toISOString().slice(0, 16);
  };

  const setDefaultTimes = () => {
    const now = new Date();
    setTier1Unlock(toLocalFormat(now));
    const d2 = new Date(now);
    d2.setDate(d2.getDate() + 2);
    setTier2Unlock(toLocalFormat(d2));
    const d3 = new Date(d2);
    d3.setDate(d3.getDate() + 2);
    setTier3Unlock(toLocalFormat(d3));
  };

  useEffect(() => {
    setDefaultTimes();
    
    // Fetch matches
    const qMatches = query(collection(db, 'matches'), orderBy('createdAt', 'desc'));
    const unsubscribeMatches = onSnapshot(qMatches, (snapshot) => {
      const fetchedMatches: Match[] = [];
      snapshot.forEach(d => fetchedMatches.push({ id: d.id, ...d.data() } as Match));
      setMatches(fetchedMatches);
    });

    // Fetch venues
    const qVenues = query(collection(db, 'venues'), orderBy('name', 'asc'));
    const unsubscribeVenues = onSnapshot(qVenues, (snapshot) => {
      const fetchedVenues: any[] = [];
      snapshot.forEach(d => fetchedVenues.push({ id: d.id, ...d.data() }));
      setVenues(fetchedVenues);
    });

    return () => {
      unsubscribeMatches();
      unsubscribeVenues();
    };
  }, []);

  const handleSaveNewVenue = async () => {
    if (!newVenueName.trim() || !newVenueLink.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'venues'), {
        name: newVenueName.trim(),
        mapsLink: newVenueLink.trim()
      });
      setSelectedVenueId(docRef.id);
      setIsAddingVenue(false);
      setNewVenueName('');
      setNewVenueLink('');
    } catch (err) {
      console.error(err);
      alert('Failed to save venue');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setDate('');
    setSelectedVenueId('');
    setDefaultTimes();
    setMaxPlayers(12);
  };

  const handleEditClick = (m: Match) => {
    setEditingId(m.id);
    setDate(m.date);
    setTime(m.time);
    
    // Find venue by name to set dropdown
    const foundVenue = venues.find(v => v.name === m.venue);
    if (foundVenue) {
      setSelectedVenueId(foundVenue.id);
    } else {
      // Legacy match with string venue not in DB
      // We can just add it silently or leave it unselected
      setSelectedVenueId('');
      alert(`Warning: This match uses a legacy venue "${m.venue}". Please select a venue from the dropdown to continue saving.`);
    }
    
    setTier1Unlock(toLocalFormat(new Date(m.tier1UnlockTime)));
    setTier2Unlock(toLocalFormat(new Date(m.tier2UnlockTime || (m as any).tier23UnlockTime)));
    setTier3Unlock(toLocalFormat(new Date(m.tier3UnlockTime || (m as any).tier23UnlockTime)));
    setMaxPlayers(m.maxPlayers || 12);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (m: Match) => {
    if (window.confirm('Are you sure you want to delete this match?')) {
      await deleteDoc(doc(db, 'matches', m.id));
    }
  };

  const handleShare = (m: Match) => {
    const d = new Date(m.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const text = `⚽ *New Football Match!* ⚽\n\n📅 Date: ${d}\n⏰ Time: ${m.time}\n📍 Venue: ${m.venue}\n\n👉 *RSVP Now:* ${window.location.origin}\n_(Tap the link to join the roster)_`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      alert("Match details copied to clipboard! Paste this into your WhatsApp Broadcast List.");
    }).catch(err => {
      console.error("Could not copy text: ", err);
      // Fallback
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    });
  };

  const handleJoinMatch = async (matchId: string) => {
    if (!userData) return;
    const matchRef = doc(db, 'matches', matchId);
    
    try {
      await runTransaction(db, async (transaction) => {
        const matchDoc = await transaction.get(matchRef);
        if (!matchDoc.exists()) throw new Error("Match not found");
        
        const data = matchDoc.data() as Match;
        let roster = [...data.roster];
        let waitlist = [...data.waitlist];
        const mMaxPlayers = data.maxPlayers || 12;

        if (roster.includes(userData.uid) || waitlist.includes(userData.uid)) {
          alert("You are already in the roster or waitlist!");
          return;
        }

        if (roster.length < mMaxPlayers) {
          if (waitlist.length === 0) {
            roster.push(userData.uid);
          } else {
            // Check tier
            if (userData.tier === 1 || userData.role === 'admin' || userData.role === 'organizer') {
              let hasTier1InWaitlist = false;
              for (const uid of waitlist) {
                const uDoc = await transaction.get(doc(db, 'users', uid));
                if (uDoc.exists()) {
                  const uData = uDoc.data();
                  if (uData.tier === 1 || uData.role === 'admin' || uData.role === 'organizer') {
                    hasTier1InWaitlist = true;
                    break;
                  }
                }
              }
              
              if (!hasTier1InWaitlist) {
                roster.push(userData.uid);
              } else {
                waitlist.push(userData.uid);
              }
            } else {
              waitlist.push(userData.uid);
            }
          }
        } else {
          waitlist.push(userData.uid);
        }

        transaction.update(matchRef, { roster, waitlist });
      });
      
      alert("Successfully joined match!");
    } catch (err) {
      console.error("Join Transaction failed:", err);
      alert("Failed to process join. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isAddingVenue) {
      alert("Please click 'Save & Select Venue' to finish adding your new venue before saving the match.");
      return;
    }

    setLoading(true);
    
    if (!selectedVenueId) {
      alert("Please select a venue!");
      setLoading(false);
      return;
    }

    const selectedVenue = venues.find(v => v.id === selectedVenueId);
    if (!selectedVenue) {
      alert("Selected venue not found.");
      setLoading(false);
      return;
    }

    // Date Validation
    const matchDateObj = new Date(`${date}T${time}`);
    const t1 = new Date(tier1Unlock);
    const t2 = new Date(tier2Unlock);
    const t3 = new Date(tier3Unlock);
    
    if (t1 >= matchDateObj || t2 >= matchDateObj || t3 >= matchDateObj) {
      alert("Error: Tier unlock times cannot be at or after the match kickoff time!");
      setLoading(false);
      return;
    }
    
    if (t2 <= t1) {
      alert("Error: Tier 2 must unlock after Tier 1.");
      setLoading(false);
      return;
    }
    if (t3 <= t2) {
      alert("Error: Tier 3 must unlock after Tier 2.");
      setLoading(false);
      return;
    }

    try {
      const matchData = {
        date,
        time,
        venue: selectedVenue.name,
        mapsLink: selectedVenue.mapsLink,
        tier1UnlockTime: new Date(tier1Unlock).toISOString(),
        tier2UnlockTime: new Date(tier2Unlock).toISOString(),
        tier3UnlockTime: new Date(tier3Unlock).toISOString(),
        maxPlayers
      };

      if (editingId) {
        await updateDoc(doc(db, 'matches', editingId), matchData);
      } else {
        await addDoc(collection(db, 'matches'), {
          ...matchData,
          status: 'dormant',
          roster: [],
          waitlist: [],
          teamRed: [],
          teamWhite: [],
          createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      console.error("Error saving match:", error);
      alert("Failed to save match");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create / Edit Match Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
        {editingId && (
          <button onClick={resetForm} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-xl font-bold text-gray-900 mb-4">{editingId ? 'Edit Match' : 'Create New Match'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kickoff Time</label>
              <input type="time" required value={time} onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Players</label>
              <input type="number" required min="4" max="30" value={maxPlayers} onChange={e => setMaxPlayers(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
              {isAddingVenue ? (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-900 text-sm">Add New Venue</h4>
                    <button type="button" onClick={() => setIsAddingVenue(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Venue Name</label>
                    <input type="text" placeholder="e.g. Central Park Pitch 1" value={newVenueName} onChange={e => setNewVenueName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Google Maps Link</label>
                    <input type="url" placeholder="https://maps.google.com/..." value={newVenueLink} onChange={e => setNewVenueLink(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 text-sm" />
                  </div>
                  <button type="button" onClick={handleSaveNewVenue} disabled={!newVenueName.trim() || !newVenueLink.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-sm disabled:opacity-50">
                    Save & Select Venue
                  </button>
                </div>
              ) : (
                <select 
                  required
                  value={selectedVenueId}
                  onChange={e => {
                    if (e.target.value === 'ADD_NEW') setIsAddingVenue(true);
                    else setSelectedVenueId(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="" disabled>Select a Venue...</option>
                  {venues.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                  <option value="ADD_NEW" className="font-bold text-emerald-600">+ Add New Venue...</option>
                </select>
              )}
            </div>
            
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
              <label className="block text-sm font-bold text-emerald-800 mb-1">Tier 1 Unlock Time</label>
              <input type="datetime-local" required value={tier1Unlock} onChange={e => setTier1Unlock(e.target.value)}
                max={date && time ? `${date}T${time}` : undefined}
                className="w-full px-3 py-2 border border-emerald-200 rounded-md focus:ring-emerald-500 bg-white" />
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <label className="block text-sm font-bold text-blue-800 mb-1">Tier 2 Unlock Time</label>
              <input type="datetime-local" required value={tier2Unlock} onChange={e => setTier2Unlock(e.target.value)}
                max={date && time ? `${date}T${time}` : undefined}
                className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-500 bg-white" />
            </div>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
              <label className="block text-sm font-bold text-amber-800 mb-1">Tier 3 Unlock Time</label>
              <input type="datetime-local" required value={tier3Unlock} onChange={e => setTier3Unlock(e.target.value)}
                max={date && time ? `${date}T${time}` : undefined}
                className="w-full px-3 py-2 border border-amber-200 rounded-md focus:ring-amber-500 bg-white" />
            </div>
          </div>
          <button type="submit" disabled={loading || isAddingVenue}
            className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 px-4 rounded-lg mt-4 disabled:opacity-50">
            {loading ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Match Draft (Dormant)')}
          </button>
        </form>
      </div>

      {/* Match List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Matches</h2>
        {matches.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No matches created yet.</p>
        ) : (
          matches.map(match => (
            <div key={match.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 relative">
              <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                    {new Date(match.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} at {match.time}
                  </h3>
                  <p className="text-gray-600 flex items-center gap-1 mt-1 text-sm">
                    <MapPin className="w-4 h-4" /> {match.venue}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    match.status === 'dormant' ? 'bg-gray-100 text-gray-600' : 
                    match.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {match.status}
                  </span>
                  
                  <div className="flex gap-2">
                    <button onClick={() => handleShare(match)} className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg" title="Share via WhatsApp">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEditClick(match)} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg" title="Edit Match">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(match)} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg" title="Delete Match">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-3 text-sm">
                <div>
                  <span className="text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Tier 1</span>
                  <span className="font-semibold">{new Date(match.tier1UnlockTime).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Tier 2</span>
                  <span className="font-semibold">{match.tier2UnlockTime ? new Date(match.tier2UnlockTime).toLocaleString() : new Date((match as any).tier23UnlockTime).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Tier 3</span>
                  <span className="font-semibold">{match.tier3UnlockTime ? new Date(match.tier3UnlockTime).toLocaleString() : new Date((match as any).tier23UnlockTime).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="mt-4 flex gap-2">
                <button 
                  onClick={() => handleJoinMatch(match.id)}
                  disabled={match.roster.includes(userData?.uid || '') || match.waitlist.includes(userData?.uid || '')}
                  className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-2 rounded text-sm text-center transition flex items-center justify-center gap-1"
                >
                  <PlusCircle className="w-4 h-4" /> Join Match
                </button>
                <Link to={`/admin/match/${match.id}`} className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold py-2 rounded text-sm text-center transition">
                  Manage Roster ({match.roster.length}/{match.maxPlayers || 12})
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
