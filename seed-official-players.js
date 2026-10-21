import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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

function calculatePositionRatings(attrs) {
  const { pace, stamina, dribbling, passing, finishing, defending, gameIQ } = attrs;
  const def = Number((0.15 * pace + 0.15 * stamina + 0.10 * dribbling + 0.10 * passing + 0.00 * finishing + 0.35 * defending + 0.15 * gameIQ).toFixed(1));
  const mid = Number((0.05 * pace + 0.20 * stamina + 0.15 * dribbling + 0.25 * passing + 0.10 * finishing + 0.10 * defending + 0.15 * gameIQ).toFixed(1));
  const fwd = Number((0.15 * pace + 0.10 * stamina + 0.20 * dribbling + 0.10 * passing + 0.30 * finishing + 0.00 * defending + 0.15 * gameIQ).toFixed(1));

  let bestPosition = 'DEF';
  let bestVal = def;
  if (mid > bestVal) {
    bestPosition = 'MID';
    bestVal = mid;
  }
  if (fwd > bestVal) {
    bestPosition = 'FWD';
    bestVal = fwd;
  }

  return { def, mid, fwd, bestPosition };
}

// 24 official players extracted from the Sunday 6v6 Player Rating Template
export const OFFICIAL_PLAYERS = [
  { name: 'Anshul Mittal', primaryPosition: 'DEF', secondaryPosition: '', happyAnywhere: false, pace: 7.5, stamina: 8.5, dribbling: 6.0, passing: 6.5, finishing: 5.5, defending: 8.0, gameIQ: 6.5, gkRating: 5.5 },
  { name: 'Aditya Bakshi', primaryPosition: 'GK', secondaryPosition: 'DEF', happyAnywhere: false, pace: 4.0, stamina: 4.0, dribbling: 3.0, passing: 3.0, finishing: 4.0, defending: 4.5, gameIQ: 3.5, gkRating: 5.0 },
  { name: 'Aditya Bhandari', primaryPosition: 'DEF', secondaryPosition: 'MID', happyAnywhere: true, pace: 6.5, stamina: 7.5, dribbling: 8.0, passing: 5.5, finishing: 6.5, defending: 7.5, gameIQ: 4.5, gkRating: 6.5 },
  { name: 'Dhruv', primaryPosition: 'DEF', secondaryPosition: 'FWD', happyAnywhere: false, pace: 4.5, stamina: 5.0, dribbling: 4.5, passing: 4.5, finishing: 5.0, defending: 5.5, gameIQ: 4.0, gkRating: 3.5 },
  { name: 'Shivesh', primaryPosition: 'DEF', secondaryPosition: 'MID', happyAnywhere: true, pace: 6.5, stamina: 5.0, dribbling: 8.0, passing: 7.0, finishing: 6.0, defending: 7.5, gameIQ: 7.5, gkRating: 6.5 },
  { name: 'Akshat Mittal', primaryPosition: 'GK', secondaryPosition: 'DEF', happyAnywhere: false, pace: 5.5, stamina: 6.0, dribbling: 3.5, passing: 4.5, finishing: 3.0, defending: 6.0, gameIQ: 4.0, gkRating: 7.0 },
  { name: 'Kartik Tripathi', primaryPosition: 'DEF', secondaryPosition: 'MID', happyAnywhere: false, pace: 5.0, stamina: 6.5, dribbling: 5.5, passing: 5.5, finishing: 6.0, defending: 7.0, gameIQ: 5.5, gkRating: 6.0 },
  { name: 'Paritosh Sinha', primaryPosition: 'GK', secondaryPosition: 'FWD', happyAnywhere: false, pace: 5.0, stamina: 4.0, dribbling: 3.0, passing: 4.0, finishing: 4.0, defending: 4.0, gameIQ: 4.0, gkRating: 7.5 },
  { name: 'Ayush Narang', primaryPosition: 'DEF', secondaryPosition: 'FWD', happyAnywhere: false, pace: 5.0, stamina: 4.0, dribbling: 4.5, passing: 4.5, finishing: 3.5, defending: 5.0, gameIQ: 4.5, gkRating: 4.5 },
  { name: 'Vedu', primaryPosition: 'GK', secondaryPosition: '', happyAnywhere: false, pace: 3.0, stamina: 3.5, dribbling: 3.0, passing: 5.0, finishing: 3.0, defending: 4.5, gameIQ: 7.0, gkRating: 8.5 },
  { name: 'Mandi', primaryPosition: 'MID', secondaryPosition: 'FWD', happyAnywhere: true, pace: 7.5, stamina: 8.0, dribbling: 8.5, passing: 8.0, finishing: 8.5, defending: 8.5, gameIQ: 8.0, gkRating: 6.5 },
  { name: 'Gaurav', primaryPosition: 'FWD', secondaryPosition: 'MID', happyAnywhere: false, pace: 7.0, stamina: 5.5, dribbling: 8.0, passing: 7.5, finishing: 8.0, defending: 4.0, gameIQ: 7.0, gkRating: 4.0 },
  { name: 'Shivanu', primaryPosition: 'FWD', secondaryPosition: '', happyAnywhere: false, pace: 8.5, stamina: 6.0, dribbling: 4.0, passing: 3.5, finishing: 7.5, defending: 4.5, gameIQ: 4.5, gkRating: 4.0 },
  { name: 'Kashish Rana', primaryPosition: 'FWD', secondaryPosition: '', happyAnywhere: false, pace: 7.5, stamina: 7.0, dribbling: 5.0, passing: 5.0, finishing: 6.5, defending: 5.0, gameIQ: 4.0, gkRating: 6.0 },
  { name: 'Shaambhav Shankar', primaryPosition: 'FWD', secondaryPosition: 'DEF', happyAnywhere: false, pace: 6.5, stamina: 5.0, dribbling: 7.0, passing: 6.5, finishing: 6.5, defending: 6.0, gameIQ: 5.0, gkRating: 5.5 },
  { name: 'Abeeral', primaryPosition: 'FWD', secondaryPosition: 'MID', happyAnywhere: true, pace: 8.0, stamina: 8.5, dribbling: 8.5, passing: 6.5, finishing: 8.5, defending: 7.0, gameIQ: 6.5, gkRating: 4.5 },
  { name: 'Hardik Vij', primaryPosition: 'FWD', secondaryPosition: 'MID', happyAnywhere: false, pace: 6.0, stamina: 7.0, dribbling: 7.5, passing: 6.5, finishing: 7.0, defending: 4.5, gameIQ: 6.5, gkRating: 4.0 },
  { name: 'Akshay Jadli', primaryPosition: 'FWD', secondaryPosition: '', happyAnywhere: false, pace: 8.0, stamina: 7.5, dribbling: 7.0, passing: 6.0, finishing: 8.0, defending: 6.5, gameIQ: 6.5, gkRating: 6.0 },
  { name: 'Pankaj', primaryPosition: 'MID', secondaryPosition: 'FWD', happyAnywhere: false, pace: 4.5, stamina: 5.0, dribbling: 7.0, passing: 5.0, finishing: 6.0, defending: 4.0, gameIQ: 5.0, gkRating: 4.0 },
  { name: 'Arunabh', primaryPosition: 'GK', secondaryPosition: 'DEF', happyAnywhere: false, pace: 6.0, stamina: 4.0, dribbling: 3.5, passing: 4.0, finishing: 4.5, defending: 3.5, gameIQ: 3.5, gkRating: 5.5 },
  { name: 'Karun', primaryPosition: 'MID', secondaryPosition: 'DEF', happyAnywhere: true, pace: 7.0, stamina: 8.0, dribbling: 8.5, passing: 8.5, finishing: 7.0, defending: 8.0, gameIQ: 8.5, gkRating: 4.0 },
  { name: 'Shivam Arora', primaryPosition: 'DEF', secondaryPosition: 'GK', happyAnywhere: false, pace: 3.0, stamina: 5.0, dribbling: 6.0, passing: 6.0, finishing: 6.0, defending: 5.5, gameIQ: 6.5, gkRating: 8.0 },
  { name: 'Kartik Srivastava', primaryPosition: 'FWD', secondaryPosition: 'DEF', happyAnywhere: true, pace: 5.0, stamina: 6.5, dribbling: 6.5, passing: 8.0, finishing: 7.0, defending: 7.0, gameIQ: 8.5, gkRating: 5.5 },
  { name: 'Abhinav', primaryPosition: 'MID', secondaryPosition: '', happyAnywhere: false, pace: 5.5, stamina: 6.0, dribbling: 6.0, passing: 6.0, finishing: 6.0, defending: 5.0, gameIQ: 6.0, gkRating: 4.0 },
];

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
    console.log("    node seed-official-players.js <admin_phone_or_email> <6_digit_pin>\n");
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

    const preferredPos = [p.primaryPosition];
    if (p.secondaryPosition && p.secondaryPosition !== p.primaryPosition) {
      preferredPos.push(p.secondaryPosition);
    }

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
      // Legacy fields compatibility
      preferredPos,
      attackRating: p.finishing,
      defRating: p.defending,
      passingRating: p.passing,
      iqRating: p.gameIQ,
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
