export type UserRole = 'admin' | 'organizer' | 'player' | 'pending';
export type Position = 'GK' | 'DEF' | 'MID' | 'ST';
export type Tier = 1 | 2 | 3;

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  tier: Tier | null;
  preferredPos: Position;
  attackRating: number; // 1-10
  defRating: number;    // 1-10
  passingRating?: number; // 1-10
  gkRating?: number;      // 1-10
  fcmToken?: string | null;
  createdAt: any;
}

export type MatchStatus = 'dormant' | 'active' | 'teams_generated' | 'published' | 'completed';

export interface Match {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  venue: string;
  mapsLink: string;
  tier1UnlockTime: string; // ISO string
  tier2UnlockTime: string; // ISO string
  tier3UnlockTime: string; // ISO string
  maxPlayers: number;
  youtubeLink?: string;
  status: MatchStatus;
  roster: string[]; // Array of UIDs
  waitlist: string[]; // Array of UIDs
  teamRed: string[]; // Array of UIDs
  teamWhite: string[]; // Array of UIDs
  createdAt: any;
}
