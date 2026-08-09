const xlsx = require('xlsx');
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

const workbook = xlsx.readFile('D:/00_AI_Agent/docs/기존값.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet);

async function updateFirebase() {
  const snapshot = await getDocs(collection(db, 'members'));
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(d => {
    const member = d.data();
    const excelRow = data.find(row => row['__EMPTY_1'] === member.name);
    
      batch.update(doc(db, 'members', d.id), { 
        score: String(member.gamePoint || 0),
        gamePoint: "0"
      });
  });
  
  await batch.commit();
  console.log("Firebase updated with Excel data!");
  process.exit(0);
}

updateFirebase();
