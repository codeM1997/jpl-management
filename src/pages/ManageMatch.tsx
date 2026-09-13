import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Match, AppUser, Position } from '../types';
import { Navbar } from '../components/Navbar';
import { DndContext, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Users, Shield, Save, X, PlusCircle, Share2, Sparkles } from 'lucide-react';

// --- Sortable Player Item Component ---
interface SortablePlayerProps {
  user: AppUser;
  disabled?: boolean;
  onRemove?: (uid: string) => void;
  isPaid?: boolean;
  onTogglePaid?: (uid: string) => void;
}

const SortablePlayer: React.FC<SortablePlayerProps> = ({ user, disabled, onRemove, isPaid, onTogglePaid }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: user.uid, disabled });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`bg-white p-2 rounded-lg border shadow-sm mb-2 flex justify-between items-center ${isDragging ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200 hover:border-emerald-300'}`}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="flex-grow cursor-grab active:cursor-grabbing"
      >
        <div className="font-bold text-gray-900 text-sm flex items-center gap-1">
          {user.name}
        </div>
        <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
          [{Array.isArray(user.preferredPos) ? user.preferredPos.join(', ') : user.preferredPos}]
        </div>
        <div className="text-[10px] font-mono text-gray-500 mt-0.5">
          A:{user.attackRating} D:{user.defRating} P:{user.passingRating || 5} G:{user.gkRating || 5} IQ:{user.iqRating || 5}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {onTogglePaid && (
          <button 
            onClick={() => onTogglePaid(user.uid)}
            className={`px-2 py-0.5 rounded text-xs font-black border transition-colors ${
              isPaid 
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' 
                : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
            }`}
            title="Toggle Payment Status"
          >
            {isPaid ? '✓ PAID' : 'UNPAID'}
          </button>
        )}
        {!disabled && onRemove && (
          <button onClick={() => onRemove(user.uid)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Remove from Match">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// --- Droppable Container Component ---
import { useDroppable } from '@dnd-kit/core';

interface DroppableContainerProps {
  id: string;
  items: string[];
  children: React.ReactNode;
}

const DroppableContainer: React.FC<DroppableContainerProps> = ({ id, items, children }) => {
  const { setNodeRef } = useDroppable({ id });
  
  return (
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="flex-grow flex flex-col gap-2 min-h-[200px]">
        {children}
      </div>
    </SortableContext>
  );
};


// --- Main Page Component ---
export const ManageMatch: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Record<string, AppUser>>({});
  
  // DND State (Arrays of UIDs)
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [teamRed, setTeamRed] = useState<string[]>([]);
  const [teamWhite, setTeamWhite] = useState<string[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');


  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !matchId || !match) return;
    
    // Roster full check
    const maxPlayers = match.maxPlayers || 12;
    if (match.roster.length >= maxPlayers) {
      alert(`Roster is full (${maxPlayers} players). Remove someone before adding a guest.`);
      return;
    }

    try {
      const guestUid = `guest:${guestName.trim()}:${Date.now()}`;
      const newRoster = [...match.roster, guestUid];
      await updateDoc(doc(db, 'matches', matchId), { roster: newRoster });
      
      // Update local unassigned state so the drag-and-drop pool catches it immediately
      setUnassigned(prev => [...prev, guestUid]);
      setGuestName('');
    } catch (err) {
      console.error(err);
      alert('Failed to add guest.');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const dndInitialized = React.useRef(false);

  // Fetch Match Data
  useEffect(() => {
    if (!matchId) return;
    const unsubscribe = onSnapshot(doc(db, 'matches', matchId), async (docSnap) => {
      if (docSnap.exists()) {
        const m = { id: docSnap.id, ...docSnap.data() } as Match;
        setMatch(m);
        
        // Load the users that are in the roster and waitlist
        const allUids = [...m.roster, ...m.waitlist];
        if (allUids.length > 0) {
          const userMap: Record<string, AppUser> = {};
          
          const realUids = allUids.filter(uid => !uid.startsWith('guest:'));
          const guestUids = allUids.filter(uid => uid.startsWith('guest:'));
          
          // Inject guests seamlessly into local state
          guestUids.forEach(uid => {
            const guestName = uid.split(':')[1];
            userMap[uid] = {
              uid: uid,
              name: guestName + ' (Guest)',
              email: 'guest@temp.com',
              phone: 'N/A',
              createdAt: Date.now(),
              role: 'player',
              tier: 2,
              preferredPos: ['MID' as Position],
              attackRating: 5,
              defRating: 5,
              passingRating: 5,
              gkRating: 5,
              iqRating: 5,
            } as AppUser;
          });
          
          // Firebase in queries limit is 10, chunk it
          const chunkSize = 10;
          for (let i = 0; i < realUids.length; i += chunkSize) {
            const chunk = realUids.slice(i, i + chunkSize);
            if (chunk.length > 0) {
              const q = query(collection(db, 'users'), where('uid', 'in', chunk));
              const usersSnap = await getDocs(q);
              usersSnap.forEach(u => {
                userMap[u.id] = u.data() as AppUser;
              });
            }
          }
          
          setPlayers(userMap);
          
          // Populate DND states ONLY on first load
          if (!dndInitialized.current) {
            if (m.teamRed.length > 0 || m.teamWhite.length > 0) {
              setTeamRed(m.teamRed);
              setTeamWhite(m.teamWhite);
              const assigned = new Set([...m.teamRed, ...m.teamWhite]);
              setUnassigned(m.roster.filter(uid => !assigned.has(uid)));
            } else {
              setUnassigned(m.roster);
            }
            dndInitialized.current = true;
          }
        }
      }
    });
    return () => unsubscribe();
  }, [matchId]);

  // Synchronize dynamic roster additions (e.g. if someone RSVPs while admin is editing)
  useEffect(() => {
    if (!match || !dndInitialized.current) return;
    
    // We use functional state updates to safely read the latest DND arrays without dependency loops
    setUnassigned(prevUnassigned => {
      let isUpdated = false;
      let newUnassigned = [...prevUnassigned];
      
      // We need to check teamRed and teamWhite to know if a player is truly unassigned.
      // Since we can't easily read them here without stale state, we'll sync using the last known arrays.
      // A safe trick is to just add any ID from match.roster that doesn't exist in ANY of the 3 arrays.
      setTeamRed(prevRed => {
        setTeamWhite(prevWhite => {
          const existing = new Set([...newUnassigned, ...prevRed, ...prevWhite]);
          match.roster.forEach(uid => {
            if (!existing.has(uid)) {
              newUnassigned.push(uid);
              isUpdated = true;
            }
          });
          return prevWhite;
        });
        return prevRed;
      });
      
      return isUpdated ? newUnassigned : prevUnassigned;
    });
  }, [match?.roster]);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const findContainer = (id: string) => {
    if (id === 'unassigned' || unassigned.includes(id)) return 'unassigned';
    if (id === 'teamRed' || teamRed.includes(id)) return 'teamRed';
    if (id === 'teamWhite' || teamWhite.includes(id)) return 'teamWhite';
    return null;
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    const moveItem = (sourceId: string, destId: string) => {
      if (activeContainer === 'unassigned') setUnassigned(prev => prev.filter(id => id !== sourceId));
      if (activeContainer === 'teamRed') setTeamRed(prev => prev.filter(id => id !== sourceId));
      if (activeContainer === 'teamWhite') setTeamWhite(prev => prev.filter(id => id !== sourceId));

      const insertInto = (arr: string[]) => {
        const overIndex = arr.indexOf(destId);
        const newArr = [...arr];
        if (overIndex >= 0) {
          newArr.splice(overIndex, 0, sourceId);
        } else {
          newArr.push(sourceId);
        }
        return newArr;
      };

      if (overContainer === 'unassigned') setUnassigned(prev => insertInto(prev));
      if (overContainer === 'teamRed') setTeamRed(prev => insertInto(prev));
      if (overContainer === 'teamWhite') setTeamWhite(prev => insertInto(prev));
    };

    moveItem(activeId, overId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      if (activeContainer === 'unassigned') {
        setUnassigned((items) => arrayMove(items, items.indexOf(activeId), items.indexOf(overId)));
      } else if (activeContainer === 'teamRed') {
        setTeamRed((items) => arrayMove(items, items.indexOf(activeId), items.indexOf(overId)));
      } else if (activeContainer === 'teamWhite') {
        setTeamWhite((items) => arrayMove(items, items.indexOf(activeId), items.indexOf(overId)));
      }
    }
  };

  const handleReset = () => {
    if (!match) return;
    setTeamRed([]);
    setTeamWhite([]);
    setUnassigned([...match.roster]); // Bring everyone back to unassigned
  };

  const handleAutoGenerate = () => {
    if (!match) return;

    // Gather all players from all pools
    const allPlayers = [...unassigned, ...teamRed, ...teamWhite];

    if (allPlayers.length < 2) {
      alert('Need at least 2 players to generate teams.');
      return;
    }

    // Outfield score only (GK rating excluded): A + D + P + IQ
    const getScore = (uid: string) => {
      const p = players[uid];
      if (!p) return 0;
      return (p.attackRating || 0) + (p.defRating || 0) + (p.passingRating || 5) + (p.iqRating || 5);
    };

    // --- Phase 1: Lock dedicated GKs ---
    const dedicatedGKs = allPlayers.filter(uid => {
      const p = players[uid];
      return p && Array.isArray(p.preferredPos) && p.preferredPos.includes('GK' as Position);
    });

    let lockedRed: string[] = [];
    let lockedWhite: string[] = [];
    let remaining = [...allPlayers];

    if (dedicatedGKs.length >= 2) {
      // Distribute one dedicated GK per team
      lockedRed.push(dedicatedGKs[0]);
      lockedWhite.push(dedicatedGKs[1]);
      remaining = remaining.filter(uid => uid !== dedicatedGKs[0] && uid !== dedicatedGKs[1]);
    } else if (dedicatedGKs.length === 1) {
      // Only one dedicated GK → assign to Red
      lockedRed.push(dedicatedGKs[0]);
      remaining = remaining.filter(uid => uid !== dedicatedGKs[0]);

      // White needs a fallback: pick the player with the highest GK rating from remaining
      if (remaining.length > 0) {
        const bestFallback = remaining.reduce((best, uid) =>
          (players[uid]?.gkRating || 5) > (players[best]?.gkRating || 5) ? uid : best
        );
        lockedWhite.push(bestFallback);
        remaining = remaining.filter(uid => uid !== bestFallback);
      }
    }
    // If 0 dedicated GKs → symmetric situation, no locking needed

    // --- Phase 2: Brute-force balance remaining using A + D + P + IQ ---
    const teamSize = Math.floor(allPlayers.length / 2);
    const redToFill = teamSize - lockedRed.length;

    if (redToFill <= 0) {
      // Edge case: locked players already fill the team
      setTeamRed(lockedRed.slice(0, teamSize));
      setTeamWhite([...lockedWhite, ...remaining]);
      setUnassigned([]);
      return;
    }

    const lockedRedScore = lockedRed.reduce((sum, uid) => sum + getScore(uid), 0);
    const lockedWhiteScore = lockedWhite.reduce((sum, uid) => sum + getScore(uid), 0);
    const remainingTotal = remaining.reduce((sum, uid) => sum + getScore(uid), 0);
    const totalScore = lockedRedScore + lockedWhiteScore + remainingTotal;
    const targetRedFromRemaining = (totalScore / 2) - lockedRedScore;

    let bestCombo: string[] = [];
    let bestDiff = Infinity;

    const findBest = (start: number, current: string[], currentScore: number) => {
      if (current.length === redToFill) {
        const diff = Math.abs(currentScore - targetRedFromRemaining);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestCombo = [...current];
        }
        return;
      }
      const needed = redToFill - current.length;
      for (let i = start; i <= remaining.length - needed; i++) {
        current.push(remaining[i]);
        findBest(i + 1, current, currentScore + getScore(remaining[i]));
        current.pop();
      }
    };

    findBest(0, [], 0);

    const redSet = new Set(bestCombo);
    const whiteFromRemaining = remaining.filter(uid => !redSet.has(uid));

    setTeamRed([...lockedRed, ...bestCombo]);
    setTeamWhite([...lockedWhite, ...whiteFromRemaining]);
    setUnassigned([]);
  };

  const handleSave = async () => {
    if (!matchId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        teamRed,
        teamWhite,
        status: teamRed.length > 0 || teamWhite.length > 0 ? 'teams_generated' : 'active'
      });
      alert('Teams saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save teams.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!matchId || !match) return;
    
    if (match.status !== 'published') {
      const maxPlayers = match.maxPlayers || 12;
      if (match.roster.length < maxPlayers) {
        alert(`You cannot publish the match until the roster is full (${match.roster.length}/${maxPlayers} players).`);
        return;
      }
    }

    if (unassigned.length > 0) {
      if (!window.confirm("There are still players in the Roster Pool. Are you sure you want to publish the match?")) {
        return;
      }
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        teamRed,
        teamWhite,
        status: match.status === 'published' ? 'teams_generated' : 'published'
      });
      alert(match.status === 'published' ? 'Match unpublished (returned to draft).' : 'Match Published! Players can now see the teams.');
    } catch (err) {
      console.error(err);
      alert('Failed to publish match.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromRoster = async (uid: string) => {
    if (!match || !matchId) return;
    if (!window.confirm(`Are you sure you want to remove this player from the roster?`)) return;
    try {
      const newRoster = match.roster.filter(id => id !== uid);
      await updateDoc(doc(db, 'matches', matchId), { roster: newRoster });
      setUnassigned(prev => prev.filter(id => id !== uid));
      setTeamRed(prev => prev.filter(id => id !== uid));
      setTeamWhite(prev => prev.filter(id => id !== uid));
    } catch (err) {
      console.error(err);
      alert('Failed to remove player.');
    }
  };

  const handlePromoteFromWaitlist = async (uid: string) => {
    if (!match || !matchId) return;
    const maxPlayers = match.maxPlayers || 12;
    if (match.roster.length >= maxPlayers) {
      alert(`Roster is full (${maxPlayers} players). Remove someone before promoting.`);
      return;
    }
    try {
      const newWaitlist = match.waitlist.filter(id => id !== uid);
      const newRoster = [...match.roster, uid];
      await updateDoc(doc(db, 'matches', matchId), { roster: newRoster, waitlist: newWaitlist });
      setUnassigned(prev => [...prev, uid]);
    } catch (err) {
      console.error(err);
      alert('Failed to promote player.');
    }
  };

  const handleTogglePaid = async (uid: string) => {
    if (!match || !matchId) return;
    try {
      const currentPaid = match.paidPlayers || [];
      let newPaid;
      if (currentPaid.includes(uid)) {
        newPaid = currentPaid.filter(id => id !== uid);
      } else {
        newPaid = [...currentPaid, uid];
      }
      await updateDoc(doc(db, 'matches', matchId), { paidPlayers: newPaid });
    } catch (err) {
      console.error(err);
      alert('Failed to update payment status.');
    }
  };

  const handleShareTeams = () => {
    if (!match) return;

    const [h, min] = match.time.split(':');
    const hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hrs12 = hours % 12 || 12;
    const timeAMPM = `${hrs12}:${min} ${ampm}`;
    const d = new Date(match.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

    const getPlayerName = (uid: string) => uid.startsWith('guest:') ? uid.split(':')[1] : (players[uid]?.name || 'Unknown');
    
    let redNames = teamRed.map((uid, i) => `${i + 1}. ${getPlayerName(uid)}`);
    let whiteNames = teamWhite.map((uid, i) => `${i + 1}. ${getPlayerName(uid)}`);
    
    const text = `🔥 *Match Teams are SET!* 🔥\n\n📅 ${d}  |  ⏰ ${timeAMPM}\n📍 ${match.venue}\n🗺️ Map: ${match.mapsLink}\n\n🔴 *TEAM RED*\n${redNames.join('\n')}\n\n⚪ *TEAM WHITE*\n${whiteNames.join('\n')}\n\nSee you on the pitch! ⚽`;

    navigator.clipboard.writeText(text).then(() => {
      alert("Teams copied to clipboard! Paste this into your WhatsApp group.");
    }).catch(err => {
      console.error("Could not copy text: ", err);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    });
  };

  if (!match) return <div className="p-8 text-center">Loading match...</div>;

  const activeUser = activeId ? players[activeId] : null;
  const isLocked = match.status === 'published' || match.status === 'completed';
  const isPublished = match.status === 'published';
  const maxPlayers = match.maxPlayers || 12;
  const canPublish = match.roster.length >= maxPlayers;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <main className="flex-grow max-w-6xl w-full mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <button onClick={() => navigate('/admin')} className="flex items-center text-gray-600 hover:text-gray-900 font-medium self-start sm:self-auto">
            <ArrowLeft className="w-5 h-5 mr-1" /> Back to Dashboard
          </button>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button 
              onClick={handleReset} 
              disabled={isLocked}
              className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center justify-center shadow-sm transition disabled:opacity-50"
            >
              Reset Teams
            </button>
            <button 
              onClick={handleAutoGenerate} 
              disabled={isLocked}
              className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" /> Auto Balance
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving || isLocked}
              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Save
            </button>
            <button 
              onClick={handleShareTeams} 
              disabled={!isPublished}
              className="flex-1 sm:flex-none bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
              title={!isPublished ? 'You must publish the match first' : 'Copy Teams to Clipboard'}
            >
              <Share2 className="w-4 h-4" /> Share Teams
            </button>
            <button 
              onClick={handlePublish} 
              disabled={saving || match.status === 'completed' || (!isPublished && !canPublish)}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50 ${isPublished ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
              title={!isPublished && !canPublish ? 'Roster must be full to publish' : ''}
            >
              {isPublished ? 'Unpublish' : 'Publish Match'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-gray-900 leading-tight">Match Roster Management</h2>
            <p className="text-gray-500 mt-1">{new Date(match.date).toDateString()} at {match.time} • {match.venue}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-emerald-600">{match.paidPlayers?.length || 0}<span className="text-gray-400 text-lg">/{match.roster.length}</span></div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Paid</div>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            {/* Unassigned Pool */}
            <div className="bg-gray-100 rounded-xl p-4 border border-gray-200 flex flex-col h-full min-h-[400px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500" /> Roster Pool
                </h3>
                <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">{unassigned.length}</span>
              </div>
              <DroppableContainer id="unassigned" items={unassigned}>
                {unassigned.map(uid => players[uid] ? <SortablePlayer key={uid} user={players[uid]} disabled={isLocked} onRemove={handleRemoveFromRoster} isPaid={match.paidPlayers?.includes(uid)} onTogglePaid={handleTogglePaid} /> : null)}
                {unassigned.length === 0 && (
                  <div className="text-center text-gray-400 text-sm mt-8 border-2 border-dashed border-gray-300 rounded-lg py-8">
                    All players assigned.
                  </div>
                )}
              </DroppableContainer>
              
              {!isLocked && (
                <form onSubmit={handleAddGuest} className="mt-4 pt-4 border-t border-gray-200">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Add Temporary Guest</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Guest Name..." 
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      className="flex-grow text-sm border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button 
                      type="submit" 
                      disabled={!guestName.trim()}
                      className="bg-gray-200 hover:bg-emerald-600 hover:text-white disabled:opacity-50 text-gray-700 font-bold px-3 rounded-lg transition"
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Team Red */}
            <div className="bg-red-50 rounded-xl p-4 border border-red-100 flex flex-col h-full min-h-[400px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-red-800 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-600" /> Team Red
                </h3>
                <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-1 rounded-full">{teamRed.length}</span>
              </div>
              <DroppableContainer id="teamRed" items={teamRed}>
                {teamRed.map(uid => players[uid] ? <SortablePlayer key={uid} user={players[uid]} disabled={isLocked} onRemove={handleRemoveFromRoster} isPaid={match.paidPlayers?.includes(uid)} onTogglePaid={handleTogglePaid} /> : null)}
                {teamRed.length === 0 && (
                  <div className="text-center text-red-300 text-sm mt-8 border-2 border-dashed border-red-200 rounded-lg py-8">
                    Drag players here
                  </div>
                )}
              </DroppableContainer>
            </div>

            {/* Team White */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col h-full min-h-[400px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-slate-500" /> Team White
                </h3>
                <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">{teamWhite.length}</span>
              </div>
              <DroppableContainer id="teamWhite" items={teamWhite}>
                {teamWhite.map(uid => players[uid] ? <SortablePlayer key={uid} user={players[uid]} disabled={isLocked} onRemove={handleRemoveFromRoster} isPaid={match.paidPlayers?.includes(uid)} onTogglePaid={handleTogglePaid} /> : null)}
                {teamWhite.length === 0 && (
                  <div className="text-center text-slate-400 text-sm mt-8 border-2 border-dashed border-slate-300 rounded-lg py-8">
                    Drag players here
                  </div>
                )}
              </DroppableContainer>
            </div>

          </div>

          {/* Waitlist Section */}
          {match.waitlist.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-6 mb-6">
              <h3 className="text-xl font-bold text-amber-800 mb-4 flex items-center gap-2">
                Waitlist ({match.waitlist.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {match.waitlist.map((uid, idx) => {
                  const user = players[uid];
                  if (!user) return null;
                  return (
                    <div key={uid} className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex flex-col justify-between h-full">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-amber-900">{idx + 1}. {user.name}</span>
                        </div>
                        <div className="text-[10px] font-bold text-amber-800 mb-0.5">
                          [{Array.isArray(user.preferredPos) ? user.preferredPos.join(', ') : user.preferredPos}]
                        </div>
                        <div className="text-[10px] font-mono text-amber-700 mb-3">Tier {user.tier} | A:{user.attackRating} D:{user.defRating} P:{user.passingRating || 5} G:{user.gkRating || 5} IQ:{user.iqRating || 5}</div>
                      </div>
                      <button 
                        onClick={() => handlePromoteFromWaitlist(uid)}
                        disabled={isPublished}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold py-2 rounded flex justify-center items-center gap-1 transition"
                      >
                        <PlusCircle className="w-3 h-3" /> Promote to Roster
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drag Overlay for smooth animations */}
          <DragOverlay>
            {activeUser ? (
              <div className="bg-white p-3 rounded-lg border-2 border-emerald-500 shadow-xl opacity-90 scale-105 flex justify-between items-center w-full max-w-sm cursor-grabbing">
                <div>
                  <div className="font-bold text-gray-900 text-sm">{activeUser.name}</div>
                  <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
                    [{Array.isArray(activeUser.preferredPos) ? activeUser.preferredPos.join(', ') : activeUser.preferredPos}]
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 mt-0.5">
                    A:{activeUser.attackRating} D:{activeUser.defRating} P:{activeUser.passingRating || 5} G:{activeUser.gkRating || 5} IQ:{activeUser.iqRating || 5}
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>

        </DndContext>
      </main>
    </div>
  );
};
