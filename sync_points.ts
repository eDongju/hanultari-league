import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './src/firebase';

async function syncPoints() {
  console.log('Starting point sync...');
  
  // 1. Fetch all sessions
  const sessionsSnapshot = await getDocs(collection(db, 'sessions'));
  
  const memberPoints: Record<string, { g: number, r: number }> = {};
  
  sessionsSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.pointHistory && Array.isArray(data.pointHistory)) {
      data.pointHistory.forEach((p: any) => {
        if (!p.memberId) return;
        
        if (!memberPoints[p.memberId]) {
          memberPoints[p.memberId] = { g: 0, r: 0 };
        }
        
        const amount = Number(p.amount) || 0;
        if (p.type === 'G') {
          memberPoints[p.memberId].g += amount;
        } else if (p.type === 'R') {
          memberPoints[p.memberId].r += amount;
        }
      });
    }
  });

  console.log('Calculated actual points from history:', memberPoints);

  // 2. Fetch all members and update their points
  const membersSnapshot = await getDocs(collection(db, 'members'));
  
  let updatedCount = 0;
  for (const docSnap of membersSnapshot.docs) {
    const memberId = docSnap.id;
    const data = docSnap.data();
    const actual = memberPoints[memberId] || { g: 0, r: 0 };
    
    const currentG = Number(data.gamePoint) || 0;
    const currentR = Number(data.roundPoint) || 0;
    
    if (currentG !== actual.g || currentR !== actual.r) {
      console.log(`Updating ${data.name} (${memberId}): G(${currentG} -> ${actual.g}), R(${currentR} -> ${actual.r})`);
      await updateDoc(doc(db, 'members', memberId), {
        gamePoint: actual.g,
        roundPoint: actual.r
      });
      updatedCount++;
    }
  }
  
  console.log(`Sync complete! Updated ${updatedCount} members.`);
  process.exit(0);
}

syncPoints().catch(console.error);
