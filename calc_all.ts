import { collection, getDocs } from 'firebase/firestore';
import { db } from './src/firebase';

async function calc() {
  const sessionsSnapshot = await getDocs(collection(db, 'sessions'));
  
  const memberPoints: Record<string, { g: number, r: number }> = {};
  
  sessionsSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.pointHistory && Array.isArray(data.pointHistory)) {
      data.pointHistory.forEach((p: any) => {
        // old data has memberName, new data has memberName and memberId
        const name = p.memberName;
        if (!name) return;
        
        if (!memberPoints[name]) {
          memberPoints[name] = { g: 0, r: 0 };
        }
        
        const amount = Number(p.amount) || 0;
        if (p.type === 'G') {
          memberPoints[name].g += amount;
        } else if (p.type === 'R') {
          memberPoints[name].r += amount;
        }
      });
    }
  });

  const membersSnapshot = await getDocs(collection(db, 'members'));
  
  console.log('Member points calculated from ALL session histories:');
  for (const docSnap of membersSnapshot.docs) {
    const data = docSnap.data();
    const actual = memberPoints[data.name] || { g: 0, r: 0 };
    const currentG = Number(data.gamePoint) || 0;
    const currentR = Number(data.roundPoint) || 0;
    
    console.log(`${data.name}: History G(${actual.g}), R(${actual.r}) | DB G(${currentG}), R(${currentR})`);
  }
  process.exit(0);
}

calc().catch(console.error);
