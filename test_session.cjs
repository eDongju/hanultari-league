const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');
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

async function test() {
  const q = query(collection(db, 'sessions'), limit(1));
  const snapshot = await getDocs(q);
  snapshot.forEach(doc => {
    console.log(doc.id, JSON.stringify(doc.data(), null, 2));
  });
  
  const m = query(collection(db, 'members'), limit(1));
  const ms = await getDocs(m);
  ms.forEach(doc => {
    console.log('Member:', doc.id, JSON.stringify(doc.data(), null, 2));
  });
  process.exit(0);
}
test();
