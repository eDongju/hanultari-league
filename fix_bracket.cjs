const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCEWWZucjBCgA5MUCefWBQdL_9UI6cwpRE",
  authDomain: "hanultari-league.firebaseapp.com",
  projectId: "hanultari-league",
  storageBucket: "hanultari-league.firebasestorage.app",
  messagingSenderId: "760515352116",
  appId: "1:760515352116:web:90ec808a421a6d6d3d5c61"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const sessionsSnap = await getDocs(collection(db, 'sessions'));
  
  let batch = writeBatch(db);
  let count = 0;

  sessionsSnap.forEach(d => {
    const session = d.data();
    if (!session.participatingMembers) return;
    
    const numMembers = session.participatingMembers.filter(Boolean).length;
    let newBracketOption = String(numMembers);
    
    // Choose suffix if needed based on court options, default to something sensible
    if (numMembers === 12) newBracketOption = "12-3c";
    else if (numMembers === 13) newBracketOption = "13-3c";
    else if (numMembers === 14) newBracketOption = "14-3c";
    else if (numMembers >= 16) newBracketOption = "16-4c";
    else if (numMembers === 15) newBracketOption = "15";
    else newBracketOption = String(numMembers);
    
    // Safety check: is the number of actual scores <= the combination's matches?
    // Actually, in combinations, the array length is the number of matches.
    // Let's just blindly update them as requested.
    
    batch.update(doc(db, 'sessions', d.id), {
      bracketOption: newBracketOption
    });
    count++;
  });
  
  console.log(`Updating ${count} sessions with correct bracketOption`);
  await batch.commit();
  console.log("Done");
  process.exit(0);
}

run().catch(console.error);
