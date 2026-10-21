import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
// Run with: node --experimental-strip-types seed-official-players.js (Node 23.6+ needs no flag)
import { OFFICIAL_PLAYERS } from './src/data/officialPlayers.ts';
import { calculatePositionRatings } from './src/utils/ratingEngine.ts';

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
const auth = getAuth(app);

async function seedOfficialPlayers() {
  console.log("================================================================================");
  console.log(" 🌱 Seeding 24 Official Players from Sunday 6v6 Rating Template into Firestore");
  console.log("================================================================================\n");

  const identifier = process.argv[2];
  const pin = process.argv[3];

  if (identifier && pin) {
    let loginEmail = identifier.trim();
    if (!loginEmail.includes('@')) {
      const digits = loginEmail.replace(/\D/g, '');
      const phoneVariants = [
        digits,
        `+91${digits}`,
        `+91 ${digits}`,
        `91${digits}`,
        `0${digits}`,
        `+91-${digits}`,
        `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
      ];
      const q = query(collection(db, 'users'), where('phone', 'in', phoneVariants));
      const snap = await getDocs(q);
      if (!snap.empty) {
        loginEmail = snap.docs[0].data().email;
      }
    }
    console.log(`🔐 Authenticating as ${loginEmail}...`);
    await signInWithEmailAndPassword(auth, loginEmail, pin);
    console.log(`✅ Authentication successful!\n`);
  } else {
    console.log("ℹ️  Note: If Firestore write rules require authentication, provide your admin credentials:");
    console.log("    node --experimental-strip-types seed-official-players.js <admin_phone_or_email> <6_digit_pin>\n");
  }

  // Fetch all existing users to safely match and preserve admin role/credentials
  console.log("🔍 Fetching existing users in Firestore...");
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const existingUsersByName = new Map();
  const existingUsersByEmail = new Map();

  usersSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.name) {
      existingUsersByName.set(data.name.trim().toLowerCase(), { uid: docSnap.id, ...data });
    }
    if (data.email) {
      existingUsersByEmail.set(data.email.trim().toLowerCase(), { uid: docSnap.id, ...data });
    }
  });

  console.log(`Found ${usersSnapshot.size} existing user documents.\n`);

  let updatedCount = 0;
  let createdCount = 0;

  for (let i = 0; i < OFFICIAL_PLAYERS.length; i++) {
    const p = OFFICIAL_PLAYERS[i];
    const nameLower = p.name.trim().toLowerCase();
    const firstWord = nameLower.split(' ')[0];

    // Check if user already exists by full name, first name (e.g. "anshul"), or email
    let existing = existingUsersByName.get(nameLower) 
      || existingUsersByName.get(firstWord)
      || existingUsersByEmail.get(`${firstWord}@test.com`)
      || existingUsersByEmail.get(`${firstWord}@jpl.com`);

    // Special check for Anshul
    if (!existing && nameLower.includes('anshul')) {
      for (const [key, val] of existingUsersByName.entries()) {
        if (key.includes('anshul')) {
          existing = val;
          break;
        }
      }
    }

    const uid = existing ? existing.uid : `player_official_${i + 1}`;
    const role = existing ? (existing.role || 'player') : 'player';
    const tier = existing?.tier ? existing.tier : 1;
    const phone = existing?.phone ? existing.phone : `98100${(i + 1).toString().padStart(5, '0')}`;
    const email = existing?.email ? existing.email : `${firstWord}_${i + 1}@jpl.com`;

    const calculated = calculatePositionRatings(p);

    const playerDoc = {
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

    if (existing) {
      updatedCount++;
      console.log(`[UPDATE] ${p.name.padEnd(20)} | Pos: ${p.primaryPosition.padEnd(3)} / ${(p.secondaryPosition || '-').padEnd(3)} | Flex: ${p.happyAnywhere ? 'Yes' : 'No '} | DEF: ${calculated.def}  MID: ${calculated.mid}  FWD: ${calculated.fwd}  GK: ${p.gkRating} | Best: ${calculated.bestPosition} | (UID: ${uid}, Role: ${role})`);
    } else {
      createdCount++;
      console.log(`[CREATE] ${p.name.padEnd(20)} | Pos: ${p.primaryPosition.padEnd(3)} / ${(p.secondaryPosition || '-').padEnd(3)} | Flex: ${p.happyAnywhere ? 'Yes' : 'No '} | DEF: ${calculated.def}  MID: ${calculated.mid}  FWD: ${calculated.fwd}  GK: ${p.gkRating} | Best: ${calculated.bestPosition} | (UID: ${uid}, Phone: ${phone})`);
    }
  }

  console.log("\n================================================================================");
  console.log(`✅ Success! Seeded all 24 players (${updatedCount} updated, ${createdCount} created).`);
  console.log("================================================================================\n");
  process.exit(0);
}

seedOfficialPlayers().catch(err => {
  console.error("❌ Seeding failed with error:", err);
  process.exit(1);
});
