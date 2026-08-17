import { doc, updateDoc } from 'firebase/firestore';
import { db } from './src/firebase';

const log = `
Updating 고봉현 (m_1): G(1 -> 0), R(0 -> 0)
Updating 박진우 (m_10): G(1 -> 0), R(0 -> 0)
Updating 배정관 (m_11): G(1 -> 0), R(0 -> 0)
Updating 성경훈 (m_14): G(1 -> 0), R(0 -> 0)
Updating 송송암 (m_15): G(12 -> 0), R(0 -> 0)
Updating 신동현 (m_16): G(8 -> 0), R(0 -> 0)
Updating 안태영 (m_18): G(3 -> 0), R(0 -> 0)
Updating 오세광 (m_19): G(3 -> 0), R(0 -> 0)
Updating 이동주 (m_20): G(20 -> 0), R(0 -> 0)
Updating 이서현 (m_21): G(2 -> 0), R(0 -> 0)
Updating 이용수 (m_22): G(4 -> 0), R(0 -> 0)
Updating 이재일 (m_23): G(1 -> 0), R(0 -> 0)
Updating 이정학 (m_24): G(7 -> 0), R(0 -> 0)
Updating 이지웅 (m_25): G(6 -> 0), R(0 -> 0)
Updating 이해찬 (m_27): G(4 -> 0), R(0 -> 0)
Updating 이형복 (m_28): G(5 -> 4), R(0 -> 0)
Updating 정정태 (m_29): G(1 -> 0), R(0 -> 0)
Updating 김영훈 (m_3): G(4 -> 0), R(0 -> 0)
Updating 정종원 (m_30): G(9 -> 0), R(0 -> 0)
Updating 정현돈 (m_31): G(5 -> 0), R(0 -> 0)
Updating 조진태 (m_32): G(2 -> 0), R(0 -> 0)
Updating 주동현 (m_33): G(4 -> 0), R(0 -> 0)
Updating 최종석 (m_34): G(2 -> 0), R(0 -> 0)
Updating 최진규 (m_35): G(1 -> 0), R(0 -> 0)
Updating 한국택 (m_38): G(3 -> 0), R(0 -> 0)
Updating 한상현 (m_39): G(2 -> 0), R(0 -> 0)
Updating 김정길 (m_4): G(1 -> 0), R(0 -> 0)
Updating 황봉연 (m_40): G(4 -> 0), R(0 -> 0)
Updating 황지건 (m_41): G(1 -> 0), R(0 -> 0)
Updating 김종혁 (m_5): G(4 -> 0), R(0 -> 0)
Updating 민재기 (m_6): G(3 -> 0), R(0 -> 0)
Updating 박현덕 (m_66): G(1 -> 0), R(0 -> 0)
Updating 신진남 (m_68): G(2 -> 0), R(0 -> 0)
Updating 임기영 (m_73): G(1 -> 0), R(0 -> 0)
Updating 박종철 (m_9): G(2 -> 0), R(0 -> 0)
`;

async function restore() {
  const lines = log.trim().split('\n');
  for (const line of lines) {
    const match = line.match(/Updating .*? \((m_\d+)\): G\((\d+) -> \d+\), R\((\d+) -> \d+\)/);
    if (match) {
      const memberId = match[1];
      const oldG = parseInt(match[2]);
      const oldR = parseInt(match[3]);
      
      console.log(`Restoring ${memberId} -> G:${oldG}, R:${oldR}`);
      await updateDoc(doc(db, 'members', memberId), {
        gamePoint: oldG,
        roundPoint: oldR
      });
    }
  }
  console.log('Restore complete!');
  process.exit(0);
}

restore().catch(console.error);
