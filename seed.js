import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs, query, orderBy, limit, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDCaA2JSvVWcXkRZBPPJS5FTlUkkTO-8iE",
  authDomain: "football-organizer-7a1ae.firebaseapp.com",
  projectId: "football-organizer-7a1ae",
  storageBucket: "football-organizer-7a1ae.firebasestorage.app",
  messagingSenderId: "1001772577694",
  appId: "1:1001772577694:web:8149d63860441e94e79c8f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const POSITIONS = ['GK', 'DEF', 'MID', 'ST'];
const NAMES = ['Alex', 'Brian', 'Charlie', 'David', 'Evan', 'Frank', 'George', 'Harry', 'Ian', 'Jack', 'Kevin', 'Liam', 'Mike', 'Noah', 'Oscar'];

async function seed() {
  console.log("Seeding 13 test players...");
  
  const generatedUids = [];

  // 1. Create 13 users
  for (let i = 0; i < 13; i++) {
    const uid = `test_user_${Date.now()}_${i}`;
    generatedUids.push(uid);
    
    await setDoc(doc(db, 'users', uid), {
      uid: uid,
      name: `${NAMES[i]} (Test)`,
      email: `test${i}@example.com`,
      phone: `55500000${i.toString().padStart(2, '0')}`,
      role: 'player',
      tier: 1, // Make them tier 1 so they are active
      preferredPos: POSITIONS[i % 4],
      attackRating: Math.floor(Math.random() * 5) + 5, // 5-9
      defRating: Math.floor(Math.random() * 5) + 5,
      createdAt: new Date()
    });
    console.log(`Created user: ${NAMES[i]} (${uid})`);
  }

  // 2. Add them to the latest match
  console.log("\nFetching latest match...");
  const q = query(collection(db, 'matches'), orderBy('createdAt', 'desc'), limit(1));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.log("No match found. Please create a match first.");
    return;
  }

  const matchDoc = snapshot.docs[0];
  console.log(`Found match: ${matchDoc.id}`);

  const roster = generatedUids.slice(0, 12);
  const waitlist = generatedUids.slice(12, 13); // The 13th player

  await updateDoc(doc(db, 'matches', matchDoc.id), {
    roster: roster,
    waitlist: waitlist
  });

  console.log(`\nSuccessfully added 12 players to the Roster and 1 to the Waitlist!`);
  process.exit(0);
}

seed().catch(console.error);
