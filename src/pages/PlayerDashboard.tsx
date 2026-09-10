import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { collection, query, orderBy, limit, onSnapshot, doc, runTransaction, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Match } from '../types';
import { Calendar, MapPin, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

export const PlayerDashboard: React.FC = () => {
  const { userData } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});

  useEffect(() => {
    // Update current time every second for precise unlock logic
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Fetch latest match
    const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setMatch({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Match);
      } else {
        setMatch(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch team names if published
  useEffect(() => {
    const fetchNames = async () => {
      if (match?.status === 'published') {
        const uids = [...match.teamRed, ...match.teamWhite];
        if (uids.length > 0) {
          const names: Record<string, string> = {};
          
          // Firestore 'in' queries support max 10 items.
          const chunkSize = 10;
          for (let i = 0; i < uids.length; i += chunkSize) {
            const chunk = uids.slice(i, i + chunkSize);
            const uidsQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
            const snap = await getDocs(uidsQuery);
            snap.forEach((d: any) => {
              names[d.data().uid] = d.data().name;
            });
          }
          setTeamNames(names);
        }
      }
    };
    fetchNames();
  }, [match?.status, match?.teamRed, match?.teamWhite]);

  const handleRSVP = async (intent: 'in' | 'out') => {
    if (!match || !userData) return;

    const matchRef = doc(db, 'matches', match.id);
    const maxPlayers = match.maxPlayers || 12;

    try {
      await runTransaction(db, async (transaction) => {
        const matchDoc = await transaction.get(matchRef);
        if (!matchDoc.exists()) throw new Error("Match not found");
        
        const data = matchDoc.data() as Match;
        let roster = [...data.roster];
        let waitlist = [...data.waitlist];

        if (intent === 'in') {
          // If already in either list, do nothing
          if (roster.includes(userData.uid) || waitlist.includes(userData.uid)) return;

          if (roster.length < maxPlayers) {
            if (waitlist.length === 0) {
              roster.push(userData.uid);
            } else {
              // There is a waitlist, but roster has space (someone was removed).
              if (userData.tier === 1) {
                let hasTier1InWaitlist = false;
                for (const uid of waitlist) {
                  const uDoc = await transaction.get(doc(db, 'users', uid));
                  if (uDoc.exists() && uDoc.data().tier === 1) {
                    hasTier1InWaitlist = true;
                    break;
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
        } else if (intent === 'out') {
          // Remove from both lists if present
          roster = roster.filter(id => id !== userData.uid);
          waitlist = waitlist.filter(id => id !== userData.uid);
        }

        transaction.update(matchRef, { roster, waitlist });
      });

    } catch (err) {
      console.error("RSVP Transaction failed:", err);
      alert("Failed to process RSVP. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </main>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-grow max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            No matches scheduled currently.
          </div>
        </main>
      </div>
    );
  }

  const isRoster = match.roster.includes(userData!.uid);
  const isWaitlist = match.waitlist.includes(userData!.uid);
  
  // Visibility & Unlock Logic
  const tier1Time = new Date(match.tier1UnlockTime).getTime();
  const tier2Time = new Date(match.tier2UnlockTime || (match as any).tier23UnlockTime).getTime(); // Fallback for legacy
  const tier3Time = new Date(match.tier3UnlockTime || (match as any).tier23UnlockTime).getTime();
  
  let isUnlocked = false;
  
  if (userData?.tier === 1) {
    isUnlocked = now >= tier1Time;
  } else if (userData?.tier === 2) {
    isUnlocked = now >= tier2Time;
  } else {
    isUnlocked = now >= tier3Time;
  }

  const maxPlayers = match.maxPlayers || 12;

  // Requirement: Do not show the match to players if it has not opened for their tier,
  // EXCEPT if they are already in the match somehow (e.g. they were added or times changed).
  if (!isUnlocked && !isRoster && !isWaitlist) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-grow max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            No matches scheduled currently.
          </div>
        </main>
      </div>
    );
  }

  // --- Published Match Card UI ---
  if (match.status === 'published') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Navbar />
        <main className="flex-grow max-w-4xl w-full mx-auto p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-800 to-emerald-600 text-white p-8 text-center relative">
              <h2 className="text-4xl font-black mb-2 tracking-tight uppercase">Match Day</h2>
              <div className="flex items-center justify-center gap-2 text-emerald-100 text-lg font-medium">
                <Calendar className="w-5 h-5" />
                <span>{new Date(match.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-white mt-2 font-black text-2xl">
                <Clock className="w-6 h-6" />
                <span>{match.time} Kickoff</span>
              </div>
            </div>

            {/* Venue */}
            <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-center">
              <a 
                href={match.mapsLink} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-gray-50 transition border border-gray-200 shadow-sm"
              >
                <MapPin className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-gray-800">{match.venue}</span>
              </a>
            </div>

            {/* Teams */}
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Team Red */}
              <div className="p-6 md:border-r border-gray-200 bg-red-50">
                <h3 className="text-2xl font-black text-red-800 text-center mb-6 uppercase tracking-wider flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-red-600 block"></span> Team Red
                </h3>
                <div className="space-y-3">
                  {match.teamRed.map((uid, i) => (
                    <div key={i} className="flex justify-between items-center bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                      <span className="font-bold text-gray-900">{uid === userData?.uid ? <span className="text-emerald-600 font-black">{userData.name} (You)</span> : (teamNames[uid] || 'Loading...')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team White */}
              <div className="p-6 bg-slate-50">
                <h3 className="text-2xl font-black text-slate-700 text-center mb-6 uppercase tracking-wider flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-white border-2 border-slate-300 block"></span> Team White
                </h3>
                <div className="space-y-3">
                  {match.teamWhite.map((uid, i) => (
                    <div key={i} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <span className="font-bold text-gray-900">{uid === userData?.uid ? <span className="text-emerald-600 font-black">{userData.name} (You)</span> : (teamNames[uid] || 'Loading...')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-md w-full mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-emerald-700 text-white p-6 text-center">
            <h2 className="text-2xl font-black mb-1">Next Match</h2>
            <div className="flex items-center justify-center gap-2 text-emerald-100">
              <Calendar className="w-4 h-4" />
              <span>{new Date(match.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-emerald-100 mt-1 font-bold text-lg">
              <Clock className="w-4 h-4" />
              <span>{match.time} Kickoff</span>
            </div>
          </div>

          <div className="p-6">
            <a 
              href={match.mapsLink} target="_blank" rel="noreferrer"
              className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition border border-gray-200 mb-6"
            >
              <MapPin className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-gray-900 leading-tight">{match.venue}</p>
                <p className="text-sm text-gray-500 mt-1">Tap to open in Google Maps</p>
              </div>
            </a>

            {/* Status Section */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Roster Status</h3>
                <span className="font-black text-lg text-emerald-600">{match.roster.length} <span className="text-gray-400 text-sm font-medium">/ {maxPlayers}</span></span>
              </div>
              
              <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden flex">
                <div className="bg-emerald-500 h-3" style={{ width: `${Math.min((match.roster.length / maxPlayers) * 100, 100)}%` }}></div>
              </div>
              {match.waitlist.length > 0 && (
                <p className="text-xs text-amber-600 font-bold text-right">{match.waitlist.length} on waitlist</p>
              )}
            </div>

            <hr className="my-6 border-gray-100" />

            {/* Action Area */}
            {isRoster ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">You're In!</h3>
                <p className="text-gray-500 mb-6">See you on the pitch.</p>
                <button 
                  onClick={() => handleRSVP('out')}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 px-4 rounded-xl transition border border-red-200"
                >
                  Drop Out
                </button>
              </div>
            ) : isWaitlist ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-4">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">You're on the Waitlist</h3>
                <p className="text-gray-500 mb-6">Position: #{match.waitlist.indexOf(userData!.uid) + 1}</p>
                <button 
                  onClick={() => handleRSVP('out')}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 px-4 rounded-xl transition border border-red-200"
                >
                  Leave Waitlist
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {match.roster.length < maxPlayers ? (
                  <button 
                    onClick={() => handleRSVP('in')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg transition flex justify-center items-center gap-2 text-lg"
                  >
                    <CheckCircle className="w-6 h-6" /> I'm In
                  </button>
                ) : (
                  <button 
                    onClick={() => handleRSVP('in')}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 px-4 rounded-xl shadow-lg transition flex justify-center items-center gap-2 text-lg"
                  >
                    <AlertCircle className="w-6 h-6" /> Join Waitlist
                  </button>
                )}
                <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 px-4 rounded-xl transition flex justify-center items-center gap-2">
                  <XCircle className="w-5 h-5" /> Can't Make It
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
