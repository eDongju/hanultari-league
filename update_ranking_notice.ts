import { collection, getDocs, doc, updateDoc, query } from 'firebase/firestore';
import { db } from './src/firebase';

const targetTitleSubstring = '한울랭킹 포인트 안내';
const newTitle = '[공지] 한울랭킹 포인트 산정 기준 안내';
const newTags = ['공지사항', '랭킹포인트', '전국대회', '한울랭킹', '규칙'];

const newContent = `# 🎾 한울랭킹 포인트 산정 기준 안내

한울타리 카페에 공지된 공식 랭킹 포인트 산정 기준을 회원 여러분이 언제든 확인하실 수 있도록 안내드립니다.
(원문 참조: https://naver.me/GRDemedb)

한울랭킹 종합 순위는 **L.Point (리그) + G.Point (기여) + R.Point (전국대회)**의 총합으로 결정됩니다.

---

## 1. 📊 한울랭킹 3대 포인트 체계
| 구분 | 명칭 | 대상 활동 | 산정 방식 |
| :---: | :---: | :---: | :--- |
| **L.PT** | League Point | 주말리그 경기 출전 & 승리 | 출전 1.0p + 승리 2.0p (자동 합산) |
| **G.PT** | Gansik Point | 간식/식사 찬조 및 코트 관리 봉사 | 건당 +1.0p ~ +3.0p |
| **R.PT** | Round Point | 전국대회 본선 입상 성적 | 성적 및 페어 구분에 따른 배점 |

---

## 2. 🏸 주말리그 L.Point 산정표
| 경기 결과 | 참가 점수 | 승리 보너스 | 게임당 획득 점수 | 4게임 완주 기준 |
| :---: | :---: | :---: | :---: | :---: |
| **승리 (Win)** | 1.0p | +2.0p | **3.0p** | 4승 전승: **12.0p** |
| **패배 (Loss)** | 1.0p | - | **1.0p** | 4패 완주: **4.0p** |

💡 **L.Point 안내:**
- 주말리그에 참석하여 4경기를 치르면 경기 결과에 따라 최소 4점 ~ 최대 12점이 자동으로 누적됩니다.
- 점수 입력 후 1.5초 내에 클라우드 DB에 즉시 자동 반영됩니다.

---

## 3. 🏆 전국대회 R.Point 배점표
| 대회 성적 | 🥇 한울타리 회원 페어 | 🥈 타클럽 페어 / 혼복 / 단식 |
| :---: | :---: | :---: |
| **우승** | **45p** | **35p** |
| **준우승** | **30p** | **23p** |
| **4강** | **20p** | **15p** |
| **8강** | **13p** | **9p** |
| **16강** | **8p** | **5p** |
| **32강** | **5p** | **3p** |

💡 **R.Point 규정:**
- 한울타리 회원끼리 페어를 이루어 입상할 경우 더 높은 포인트가 부여됩니다.
- 대회 성적 증빙 후 집행부 확인을 거쳐 랭킹에 합산됩니다.

---

## 4. ☕ G.Point (찬조 및 기여 포인트)
| 항목 | 배점 | 비고 |
| :--- | :---: | :--- |
| **커피 / 음료 / 간식 찬조** | **+1p** | 주말리그 회원 나눔 |
| **점심 식사 협찬** | **+1p ~ +3p** | 규모에 따라 집행부 협의 |
| **코트 브러쉬 / 환경 정비 봉사** | **+1p ~ +3p** | 시설 유지 관리 기여 |`;

async function main() {
  console.log('한울랭킹 포인트 공지사항 업데이트를 시작합니다...');

  const q = query(collection(db, 'hanullog'));
  const snapshot = await getDocs(q);

  let targetDoc: any = null;
  snapshot.forEach((d) => {
    const data = d.data();
    if (data.title && data.title.includes(targetTitleSubstring)) {
      targetDoc = d;
    }
  });

  if (targetDoc) {
    console.log(`기존 게시글을 찾았습니다 (ID: ${targetDoc.id}). 표 형태로 갱신합니다.`);
    await updateDoc(doc(db, 'hanullog', targetDoc.id), {
      title: newTitle,
      tags: newTags,
      content: newContent,
      date: new Date().toISOString()
    });
    console.log('✅ 공지사항이 성공적으로 갱신되었습니다!');
  } else {
    console.error('❌ 대상 게시글을 찾지 못했습니다.');
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ 업데이트 중 오류 발생:', err);
  process.exit(1);
});
