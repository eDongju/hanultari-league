const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const combinations = require('./src/data/combinations.json');

const firebaseConfig = {
  apiKey: "AIzaSyCEWWZucjBCgA5MUCefWBQdL_9UI6cwpRE",
  authDomain: "hanultari-league.firebaseapp.com",
  projectId: "hanultari-league",
  storageBucket: "hanultari-league.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const sessionsSnap = await getDocs(collection(db, 'sessions'));
  
  let issues = 0;
  sessionsSnap.forEach(d => {
    const session = d.data();
    const scores = session.matchScores || {};
    const bracketOption = session.bracketOption;
    
    const comb = combinations[bracketOption] || [];
    const maxMatchIdx = Math.max(-1, ...Object.keys(scores).map(k => parseInt(k.split('-')[0])));
    
    if (maxMatchIdx >= comb.length) {
      console.log(`Session ${session.id}: bracketOption=${bracketOption} (comb length ${comb.length}), but has scores up to matchIdx ${maxMatchIdx}`);
      issues++;
    }
  });
  
  console.log(`Found ${issues} issues`);
  process.exit(0);
}
run();
