export type UserRole = 'admin' | 'organizer' | 'player' | 'pending';
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
export type Tier = 1 | 2 | 3;

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  tier: Tier | null;
  
  // Positions
  primaryPosition?: Position;
  secondaryPosition?: Position;
  happyAnywhere?: boolean;
  preferredPos?: Position[]; // legacy

  // 7 Core attributes + GK (1-10)
  pace?: number;
  stamina?: number;
  dribbling?: number;
  passing?: number;
  finishing?: number;
  defending?: number;
  gameIQ?: number;
  gkRating?: number | null;

  // Legacy rating fields
  attackRating?: number; // 1-10
  defRating?: number;    // 1-10
  passingRating?: number; // 1-10
  iqRating?: number;      // 1-10

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
  teamRedPositions?: Record<string, Position>;
  teamWhitePositions?: Record<string, Position>;
  teamRedStrength?: number;
  teamWhiteStrength?: number;
  splitScore?: number;
  paidPlayers?: string[]; // Legacy array of UIDs who have paid (can keep for manual cash overrides)
  pricePerPerson?: number;
  requirePaymentTier1?: boolean;
  requirePaymentTier23?: boolean;
  upiId?: string;
  payments?: {
    [uid: string]: {
      screenshotUrl: string;
      verified: boolean;
      uploadedAt: string;
    }
  };
  createdAt: any;
}

