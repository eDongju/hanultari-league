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

async function checkMembers() {
  try {
    const querySnapshot = await getDocs(collection(db, "members"));
    let total = 0;
    let withPhoto = 0;
    querySnapshot.forEach((doc) => {
      total++;
      const data = doc.data();
      if (data.photoUrl && data.photoUrl.trim() !== '') {
        withPhoto++;
        console.log(`- ${data.name}: ${data.photoUrl.substring(0, 50)}...`);
      }
    });
    console.log(`\n총 회원 수: ${total}`);
    console.log(`사진이 등록된 회원 수: ${withPhoto}`);
    process.exit(0);
  } catch (error) {
    console.error("Error reading DB:", error);
    process.exit(1);
  }
}

checkMembers();
