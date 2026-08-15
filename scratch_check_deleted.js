import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

async function checkDeleted() {
  try {
    console.log("Checking deleted_members collection...");
    const querySnapshot = await getDocs(collection(db, "deleted_members"));
    let count = 0;
    querySnapshot.forEach((doc) => {
      count++;
      const data = doc.data();
      console.log(`- Deleted: ${data.name}, Photo: ${data.photoUrl ? 'YES' : 'NO'}`);
    });
    console.log(`Total deleted: ${count}`);
    process.exit(0);
  } catch (error) {
    console.error("Error reading DB:", error);
    process.exit(1);
  }
}

checkDeleted();
