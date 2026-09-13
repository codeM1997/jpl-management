import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAqYIS3jxaMEyN9_ASUtbINRRmQYTD7BKc",
  authDomain: "jpl-management-staging.firebaseapp.com",
  projectId: "jpl-management-staging",
  storageBucket: "jpl-management-staging.firebasestorage.app",
  messagingSenderId: "750515853108",
  appId: "1:750515853108:web:9c61291daaf84959b1b761"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 13 realistic test players with all 5 ratings
const PLAYERS = [
  { name: 'Arjun Mehta',     tier: 1, preferredPos: ['GK'],        attack: 3, def: 6, passing: 5, gk: 9, iq: 6 },
  { name: 'Rohan Sharma',    tier: 1, preferredPos: ['ST'],        attack: 9, def: 3, passing: 6, gk: 2, iq: 7 },
  { name: 'Vikram Singh',    tier: 1, preferredPos: ['DEF'],       attack: 4, def: 9, passing: 6, gk: 4, iq: 7 },
  { name: 'Karan Patel',     tier: 1, preferredPos: ['MID'],       attack: 7, def: 5, passing: 8, gk: 3, iq: 8 },
  { name: 'Aman Gupta',      tier: 1, preferredPos: ['ST', 'MID'], attack: 8, def: 4, passing: 7, gk: 2, iq: 6 },
  { name: 'Nikhil Joshi',    tier: 1, preferredPos: ['DEF', 'MID'],attack: 5, def: 8, passing: 7, gk: 5, iq: 7 },
  { name: 'Saurabh Yadav',   tier: 2, preferredPos: ['MID'],       attack: 6, def: 6, passing: 8, gk: 3, iq: 9 },
  { name: 'Prateek Verma',   tier: 2, preferredPos: ['ST'],        attack: 8, def: 3, passing: 5, gk: 2, iq: 5 },
  { name: 'Deepak Kumar',    tier: 2, preferredPos: ['DEF'],       attack: 3, def: 7, passing: 5, gk: 6, iq: 6 },
  { name: 'Rahul Tiwari',    tier: 1, preferredPos: ['MID', 'ST'], attack: 7, def: 5, passing: 9, gk: 3, iq: 8 },
  { name: 'Aditya Chauhan',  tier: 2, preferredPos: ['DEF', 'MID'],attack: 5, def: 7, passing: 6, gk: 4, iq: 6 },
  { name: 'Manish Dubey',    tier: 2, preferredPos: ['MID'],       attack: 6, def: 5, passing: 7, gk: 3, iq: 7 },
  { name: 'Tushar Saxena',   tier: 3, preferredPos: ['ST', 'MID'], attack: 7, def: 4, passing: 6, gk: 2, iq: 5 },
];

async function seed() {
  console.log("🌱 Seeding 13 test players with full ratings...\n");

  const generatedUids = [];

  // 1. Create 13 users
  for (let i = 0; i < PLAYERS.length; i++) {
    const p = PLAYERS[i];
    const uid = `test_user_${Date.now()}_${i}`;
    generatedUids.push(uid);

    await setDoc(doc(db, 'users', uid), {
      uid: uid,
      name: p.name,
      email: `${p.name.split(' ')[0].toLowerCase()}@test.com`,
      phone: `99900${i.toString().padStart(5, '0')}`,
      role: 'player',
      tier: p.tier,
      preferredPos: p.preferredPos,
      attackRating: p.attack,
      defRating: p.def,
      passingRating: p.passing,
      gkRating: p.gk,
      iqRating: p.iq,
      createdAt: new Date()
    });
    console.log(`  ✅ ${p.name}  [${p.preferredPos.join('/')}]  A:${p.attack} D:${p.def} P:${p.passing} G:${p.gk} IQ:${p.iq}`);
  }

  // 2. Create a new match with 12 players on roster and 1 on waitlist
  console.log("\n⚽ Creating a test match...\n");

  const matchDate = new Date();
  matchDate.setDate(matchDate.getDate() + 3); // 3 days from now
  const dateStr = matchDate.toISOString().split('T')[0]; // YYYY-MM-DD

  const now = new Date();
  const matchData = {
    date: dateStr,
    time: '17:30',
    venue: 'ClayGrounds, IMS Noida College, Sec 62, Noida',
    mapsLink: 'https://maps.app.goo.gl/bQPqSpkue37sBc1u8',
    tier1UnlockTime: now.toISOString(),
    tier2UnlockTime: now.toISOString(),
    tier3UnlockTime: now.toISOString(),
    maxPlayers: 12,
    status: 'active',
    roster: generatedUids.slice(0, 12),
    waitlist: generatedUids.slice(12, 13),
    teamRed: [],
    teamWhite: [],
    paidPlayers: [],
    createdAt: new Date()
  };

  const matchRef = await addDoc(collection(db, 'matches'), matchData);
  console.log(`  ✅ Match created: ${matchRef.id}`);
  console.log(`  📅 Date: ${dateStr} at 17:30`);
  console.log(`  📍 Venue: ${matchData.venue}`);
  console.log(`  👥 Roster: 12 players  |  Waitlist: 1 player`);

  console.log("\n🎉 Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);
