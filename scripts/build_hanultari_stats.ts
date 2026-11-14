import fs from 'fs';
import path from 'path';
import { db } from '../src/firebase';
import { collection, getDocs } from 'firebase/firestore';
import combinations from '../src/data/combinations.json';

const charToIndex = (c: string) => {
  if (c >= '1' && c <= '9') return parseInt(c) - 1;
  return c.charCodeAt(0) - 'A'.charCodeAt(0) + 9;
};

// 프로필 사진 Base64 로드 헬퍼
function getMemberPhotoBase64(member: any, logoBase64: string): string {
  if (member.photoUrl && member.photoUrl.startsWith('data:image')) {
    return member.photoUrl;
  }
  const pngPath = path.resolve(process.cwd(), `public/player/${member.name}.png`);
  if (fs.existsSync(pngPath)) {
    return `data:image/png;base64,${fs.readFileSync(pngPath).toString('base64')}`;
  }
  const jpgPath = path.resolve(process.cwd(), `public/player/${member.name}.jpg`);
  if (fs.existsSync(jpgPath)) {
    return `data:image/jpeg;base64,${fs.readFileSync(jpgPath).toString('base64')}`;
  }
  if (member.photoUrl && member.photoUrl.startsWith('http')) {
    return member.photoUrl;
  }
  return logoBase64;
}

async function buildReport() {
  console.log('Fetching Firestore data...');
  const memDocs = await getDocs(collection(db, 'members'));
  const allMembers = memDocs.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  const sessDocs = await getDocs(collection(db, 'sessions'));
  const savedSessions = sessDocs.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  console.log(`Fetched ${allMembers.length} members and ${savedSessions.length} sessions.`);

  // 로고 Base64 로드
  const logoPath = path.resolve(process.cwd(), 'public/hanul_logo.jpg');
  const logoBase64 = fs.existsSync(logoPath)
    ? `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString('base64')}`
    : '';

  // 1. 포인트 집계 (memberPoints: G.PT, R.PT)
  const memberPoints: Record<string, { g: number; r: number; rDetails: { desc: string; pts: number; date?: string }[]; gDetails: string[] }> = {};
  savedSessions.forEach((session: any) => {
    if (session.pointHistory && Array.isArray(session.pointHistory)) {
      session.pointHistory.forEach((p: any) => {
        const name = p.memberName;
        if (!name) return;
        if (!memberPoints[name]) memberPoints[name] = { g: 0, r: 0, rDetails: [], gDetails: [] };
        const amt = Number(p.amount) || 0;
        const desc = p.description ? p.description.trim() : '';
        if (p.type === 'G') {
          memberPoints[name].g += amt;
          if (desc) memberPoints[name].gDetails.push(desc);
        }
        if (p.type === 'R') {
          memberPoints[name].r += amt;
          const cleanDesc = desc ? desc.replace(/_/g, ' ') : '전국대회 출전';
          memberPoints[name].rDetails.push({ desc: cleanDesc, pts: amt, date: session.date });
        }
      });
    }
  });

  allMembers.forEach(m => {
    if (m.nationalPrize) {
      console.log(`[Member nationalPrize] ${m.name}: "${m.nationalPrize}"`);
    }
  });

  // 2. 전체 통계 구조체 초기화
  interface PlayerStats {
    id: string;
    name: string;
    photoUrl: string;
    photoBase64: string;
    matches: number;
    wins: number;
    losses: number;
    sessionMatches: number;
    sessionWins: number;
    sessionLosses: number;
    attendances: number;
    fourWinsCount: number;
    deuceCount: number;
    adCount: number;
    duoStats: Record<string, { matches: number; wins: number }>;
    // 9월 이후 전적
    sepDeuceMatches: number;
    sepDeuceWins: number;
    sepAdMatches: number;
    sepAdWins: number;
  }

  const stats: Record<string, PlayerStats> = {};
  allMembers.forEach(m => {
    const bWins = Number(m.baseWins) || 0;
    const bLosses = Number(m.baseLosses) || 0;
    stats[m.id] = {
      id: m.id,
      name: m.name,
      photoUrl: m.photoUrl,
      photoBase64: getMemberPhotoBase64(m, logoBase64),
      matches: bWins + bLosses,
      wins: bWins,
      losses: bLosses,
      sessionMatches: 0,
      sessionWins: 0,
      sessionLosses: 0,
      attendances: 0,
      fourWinsCount: 0,
      deuceCount: 0,
      adCount: 0,
      duoStats: {},
      sepDeuceMatches: 0,
      sepDeuceWins: 0,
      sepAdMatches: 0,
      sepAdWins: 0,
    };
  });

  // 3. 월별 세션 집계
  const monthlySessions: Record<string, string[]> = {};
  let totalSepMatches = 0;
  let totalSepDeuceWins = 0;
  let totalSepAdWins = 0;

  const courtStats = {
    names: {} as Record<string, number>,
    types: {} as Record<string, number>,
    envs: {} as Record<string, number>,
  };

  savedSessions.forEach(session => {
    const cName = session.courtName?.trim() || '기타 코트';
    const cType = session.courtType?.trim() || '인조잔디';
    const cEnv = session.courtEnv?.trim() || '야외';
    courtStats.names[cName] = (courtStats.names[cName] || 0) + 1;
    courtStats.types[cType] = (courtStats.types[cType] || 0) + 1;
    courtStats.envs[cEnv] = (courtStats.envs[cEnv] || 0) + 1;

    const date = session.date || '';
    if (date) {
      const monthKey = date.substring(0, 7);
      if (!monthlySessions[monthKey]) monthlySessions[monthKey] = [];
      monthlySessions[monthKey].push(date);
    }

    const isAfterSep = date >= '2026-09-01';

    const mScores = session.matchScores || {};
    let currentCombinations = [...((combinations as Record<string, string[]>)[session.bracketOption] || [])];
    const maxMatchIdx = Math.max(-1, ...Object.keys(mScores).map(k => parseInt(k.split('-')[0], 10)));
    if (maxMatchIdx >= currentCombinations.length) {
      const pad = maxMatchIdx - currentCombinations.length + 1;
      for (let i = 0; i < pad; i++) currentCombinations.push('1234');
    }

    const mOverrides = session.matchOverrides || {};
    const pMembers = session.participatingMembers || [];

    pMembers.forEach((m: any) => {
      if (m && m.id && stats[m.id]) stats[m.id].attendances += 1;
    });

    const sessionPlayerWins: Record<string, number> = {};

    currentCombinations.forEach((matchStr, matchIdx) => {
      let matchSubIdx = 0;
      for (let i = 0; i < matchStr.length; i += 4) {
        const sub = matchStr.slice(i, i + 4);
        if (sub.length === 4) {
          const matchId = `${matchIdx}-${matchSubIdx}`;
          const score = mScores[matchId];
          if (score && score.t1 !== '' && score.t2 !== '') {
            const s1 = parseInt(score.t1) || 0;
            const s2 = parseInt(score.t2) || 0;

            const p1Id = mOverrides[matchId]?.[0] || pMembers[charToIndex(sub[0])]?.id;
            const p2Id = mOverrides[matchId]?.[1] || pMembers[charToIndex(sub[1])]?.id;
            const p3Id = mOverrides[matchId]?.[2] || pMembers[charToIndex(sub[2])]?.id;
            const p4Id = mOverrides[matchId]?.[3] || pMembers[charToIndex(sub[3])]?.id;

            const t1Ids = [p1Id, p2Id];
            const t2Ids = [p3Id, p4Id];

            if (p1Id && stats[p1Id]) stats[p1Id].deuceCount += 1;
            if (p2Id && stats[p2Id]) stats[p2Id].adCount += 1;
            if (p3Id && stats[p3Id]) stats[p3Id].deuceCount += 1;
            if (p4Id && stats[p4Id]) stats[p4Id].adCount += 1;

            // 9월 1일 이후 통계
            if (isAfterSep) {
              totalSepMatches += 1;
              if (s1 > s2) totalSepDeuceWins += 1;
              if (s2 > s1) totalSepAdWins += 1;

              // p1(Team 1 Deuce), p2(Team 1 Ad)
              if (p1Id && stats[p1Id]) {
                stats[p1Id].sepDeuceMatches += 1;
                if (s1 > s2) stats[p1Id].sepDeuceWins += 1;
              }
              if (p2Id && stats[p2Id]) {
                stats[p2Id].sepAdMatches += 1;
                if (s1 > s2) stats[p2Id].sepAdWins += 1;
              }
              // p3(Team 2 Deuce), p4(Team 2 Ad)
              if (p3Id && stats[p3Id]) {
                stats[p3Id].sepDeuceMatches += 1;
                if (s2 > s1) stats[p3Id].sepDeuceWins += 1;
              }
              if (p4Id && stats[p4Id]) {
                stats[p4Id].sepAdMatches += 1;
                if (s2 > s1) stats[p4Id].sepAdWins += 1;
              }
            }

            // 베스트 듀오 집계
            const updateDuo = (pid1: string, pid2: string, win: boolean) => {
              if (pid1 && pid2 && stats[pid1] && stats[pid2]) {
                if (!stats[pid1].duoStats[pid2]) stats[pid1].duoStats[pid2] = { matches: 0, wins: 0 };
                if (!stats[pid2].duoStats[pid1]) stats[pid2].duoStats[pid1] = { matches: 0, wins: 0 };
                stats[pid1].duoStats[pid2].matches += 1;
                stats[pid2].duoStats[pid1].matches += 1;
                if (win) {
                  stats[pid1].duoStats[pid2].wins += 1;
                  stats[pid2].duoStats[pid1].wins += 1;
                }
              }
            };

            updateDuo(p1Id, p2Id, s1 > s2);
            updateDuo(p3Id, p4Id, s2 > s1);

            t1Ids.forEach(pid => {
              if (pid && stats[pid]) {
                stats[pid].matches += 1;
                stats[pid].sessionMatches += 1;
                if (s1 > s2) {
                  stats[pid].wins += 1;
                  stats[pid].sessionWins += 1;
                  sessionPlayerWins[pid] = (sessionPlayerWins[pid] || 0) + 1;
                } else if (s1 < s2) {
                  stats[pid].losses += 1;
                  stats[pid].sessionLosses += 1;
                }
              }
            });

            t2Ids.forEach(pid => {
              if (pid && stats[pid]) {
                stats[pid].matches += 1;
                stats[pid].sessionMatches += 1;
                if (s2 > s1) {
                  stats[pid].wins += 1;
                  stats[pid].sessionWins += 1;
                  sessionPlayerWins[pid] = (sessionPlayerWins[pid] || 0) + 1;
                } else if (s2 < s1) {
                  stats[pid].losses += 1;
                  stats[pid].sessionLosses += 1;
                }
              }
            });
          }
          matchSubIdx++;
        }
      }
    });

    Object.entries(sessionPlayerWins).forEach(([pid, wins]) => {
      if (wins >= 4 && stats[pid]) {
        stats[pid].fourWinsCount += 1;
      }
    });
  });

  console.log('Court Stats:', JSON.stringify(courtStats, null, 2));

  // ========================================================
  // ① 월별 테니스 횟수 & 전체 누적 횟수
  // ========================================================
  const sortedMonths = Object.keys(monthlySessions).sort();
  const totalSessionsCount = savedSessions.length;
  const monthlyData = sortedMonths.map(m => {
    const dates = monthlySessions[m];
    const uniqueDates = Array.from(new Set(dates)).sort();
    return {
      monthKey: m,
      monthLabel: `${parseInt(m.split('-')[1])}월`,
      count: dates.length,
      daysCount: uniqueDates.length,
      dates: uniqueDates,
    };
  });
  const maxMonthCount = Math.max(...monthlyData.map(m => m.count), 1);
  const avgMonthCount = (totalSessionsCount / (monthlyData.length || 1)).toFixed(1);

  // ========================================================
  // ② 한울랭킹 1~10위 및 베스트 듀오 (Best Duo)
  // ========================================================
  const membersRanking = allMembers.map(m => {
    const s = stats[m.id] || { sessionMatches: 0, sessionWins: 0, matches: 0, wins: 0, duoStats: {} };
    const lPt = (s.sessionWins * 2) + (s.sessionMatches * 1);
    const gPt = memberPoints[m.name]?.g || 0;
    const rPt = memberPoints[m.name]?.r || 0;
    const sumPoint = lPt + gPt + rPt;

    // 베스트 듀오 탐색
    let bestDuoId: string | null = null;
    let bestDuoWins = -1;
    let bestDuoMatches = 0;
    Object.entries(s.duoStats || {}).forEach(([partnerId, dStats]) => {
      if (dStats.wins > bestDuoWins) {
        bestDuoWins = dStats.wins;
        bestDuoMatches = dStats.matches;
        bestDuoId = partnerId;
      }
    });
    const bestDuoMember = bestDuoId ? allMembers.find(mem => mem.id === bestDuoId) : null;
    const bestDuoName = bestDuoMember ? bestDuoMember.name : '-';
    const bestDuoPhoto = bestDuoMember ? getMemberPhotoBase64(bestDuoMember, logoBase64) : logoBase64;
    const duoWinRate = bestDuoMatches > 0 ? ((bestDuoWins / bestDuoMatches) * 100).toFixed(1) : '0.0';

    return {
      ...m,
      stats: s,
      photoBase64: getMemberPhotoBase64(m, logoBase64),
      lPt,
      gPt,
      rPt,
      sumPoint,
      bestDuoName,
      bestDuoWins,
      bestDuoMatches,
      bestDuoPhoto,
      duoWinRate,
    };
  }).sort((a, b) => b.sumPoint - a.sumPoint);

  const top10Rankers = membersRanking.slice(0, 10).map((m, idx) => ({
    ...m,
    rank: idx + 1,
  }));

  // ========================================================
  // ③ 4승 달성 횟수 랭킹 (TOP 5)
  // ========================================================
  const sortedFourWins = Object.values(stats)
    .filter(m => m.fourWinsCount > 0)
    .sort((a, b) => b.fourWinsCount - a.fourWinsCount || (b.wins / (b.matches || 1)) - (a.wins / (a.matches || 1)));

  const topFourWins: any[] = [];
  let currentRank = 1;
  for (let i = 0; i < sortedFourWins.length; i++) {
    const player = sortedFourWins[i];
    if (i > 0 && player.fourWinsCount < sortedFourWins[i - 1].fourWinsCount) {
      currentRank = i + 1;
    }
    if (currentRank > 5) break;
    topFourWins.push({
      ...player,
      displayRank: currentRank,
      winRate: player.matches > 0 ? ((player.wins / player.matches) * 100).toFixed(1) : '0.0',
    });
  }

  // ========================================================
  // ④ 리그 참석 횟수 랭킹 (TOP 5 / 개근상)
  // ========================================================
  const sortedAttendance = Object.values(stats)
    .filter(m => m.attendances > 0)
    .sort((a, b) => b.attendances - a.attendances || b.wins - a.wins);

  const topAttendance: any[] = [];
  let attRank = 1;
  for (let i = 0; i < sortedAttendance.length; i++) {
    const player = sortedAttendance[i];
    if (i > 0 && player.attendances < sortedAttendance[i - 1].attendances) {
      attRank = i + 1;
    }
    if (attRank > 5) break;
    topAttendance.push({
      ...player,
      displayRank: attRank,
      attRate: ((player.attendances / totalSessionsCount) * 100).toFixed(1),
    });
  }

  // ========================================================
  // ⑤ 승률 랭킹 (TOP 5) - 최소 20경기 이상 출전자
  // ========================================================
  const sortedWinRate = Object.values(stats)
    .filter(m => m.matches >= 20)
    .map(m => ({
      ...m,
      rateVal: (m.wins / m.matches) * 100,
      rateStr: ((m.wins / m.matches) * 100).toFixed(1),
    }))
    .sort((a, b) => b.rateVal - a.rateVal || b.wins - a.wins);

  const topWinRate: any[] = [];
  let wrRank = 1;
  for (let i = 0; i < sortedWinRate.length; i++) {
    const player = sortedWinRate[i];
    if (i > 0 && Math.abs(player.rateVal - sortedWinRate[i - 1].rateVal) > 0.05) {
      wrRank = i + 1;
    }
    if (wrRank > 5) break;
    topWinRate.push({
      ...player,
      displayRank: wrRank,
    });
  }

  // ========================================================
  // ⑥ 전국 대회 점수(R.PT) 랭킹 (TOP 5)
  // ========================================================
  const sortedRPt = allMembers
    .map(m => {
      const rVal = memberPoints[m.name]?.r || 0;
      const rDetails = (memberPoints[m.name]?.rDetails || []).sort((a, b) => b.pts - a.pts);
      const s = stats[m.id];
      return {
        id: m.id,
        name: m.name,
        photoBase64: getMemberPhotoBase64(m, logoBase64),
        rPt: rVal,
        rDetails,
        stats: s,
      };
    })
    .filter(m => m.rPt > 0)
    .sort((a, b) => b.rPt - a.rPt);

  const topRPt: any[] = [];
  let rRank = 1;
  for (let i = 0; i < sortedRPt.length; i++) {
    const player = sortedRPt[i];
    if (i > 0 && player.rPt < sortedRPt[i - 1].rPt) {
      rRank = i + 1;
    }
    if (rRank > 5) break;
    topRPt.push({
      ...player,
      displayRank: rRank,
    });
  }

  // ========================================================
  // ⑦ 간식/찬조 점수(G.PT) 랭킹 (TOP 5)
  // ========================================================
  const sortedGPt = allMembers
    .map(m => {
      const gVal = memberPoints[m.name]?.g || 0;
      const s = stats[m.id];
      return {
        id: m.id,
        name: m.name,
        photoBase64: getMemberPhotoBase64(m, logoBase64),
        gPt: gVal,
        stats: s,
      };
    })
    .filter(m => m.gPt > 0)
    .sort((a, b) => b.gPt - a.gPt);

  const topGPt: any[] = [];
  let gRank = 1;
  for (let i = 0; i < sortedGPt.length; i++) {
    const player = sortedGPt[i];
    if (i > 0 && player.gPt < sortedGPt[i - 1].gPt) {
      gRank = i + 1;
    }
    if (gRank > 5) break;
    topGPt.push({
      ...player,
      displayRank: gRank,
    });
  }

  // ========================================================
  // ⑧ 9월 이후 코트 위치별(듀스 vs 애드) 승률 통계
  // ========================================================
  const sepPlayers = Object.values(stats).filter(m => (m.sepDeuceMatches + m.sepAdMatches) > 0);

  // 듀스 코트 TOP 5 (최소 8경기 이상 출전)
  const topDeuce = sepPlayers
    .filter(m => m.sepDeuceMatches >= 8)
    .map(m => ({
      ...m,
      rateVal: (m.sepDeuceWins / m.sepDeuceMatches) * 100,
      rateStr: ((m.sepDeuceWins / m.sepDeuceMatches) * 100).toFixed(1),
    }))
    .sort((a, b) => b.rateVal - a.rateVal || b.sepDeuceWins - a.sepDeuceWins)
    .slice(0, 5);

  // 애드 코트 TOP 5 (최소 8경기 이상 출전)
  const topAd = sepPlayers
    .filter(m => m.sepAdMatches >= 8)
    .map(m => ({
      ...m,
      rateVal: (m.sepAdWins / m.sepAdMatches) * 100,
      rateStr: ((m.sepAdWins / m.sepAdMatches) * 100).toFixed(1),
    }))
    .sort((a, b) => b.rateVal - a.rateVal || b.sepAdWins - a.sepAdWins)
    .slice(0, 5);

  const overallDeuceRate = totalSepMatches > 0 ? ((totalSepDeuceWins / totalSepMatches) * 100).toFixed(1) : '50.0';
  const overallAdRate = totalSepMatches > 0 ? ((totalSepAdWins / totalSepMatches) * 100).toFixed(1) : '50.0';

  // ========================================================
  // ⑨ 올해 이용한 코트 장소 및 코트 종류별 개최 통계
  // ========================================================
  const venueMap: Record<string, { count: number; dates: string[] }> = {};
  const surfaceMap: Record<string, number> = { '인조잔디': 0, '하드코트': 0 };
  const envMap: Record<string, number> = { '야외': 0, '실내': 0 };

  savedSessions.forEach((session: any) => {
    let rawName = (session.courtName || '').trim();
    let normName = '한울타리 홈코트 / 정기 대관';
    if (rawName.includes('상신리')) normName = '화성 상신리 테니스장';
    else if (rawName.includes('북중')) normName = '수원 북중 테니스장';
    else if (rawName.includes('루트82')) normName = '화성 루트82 테니스장';
    else if (rawName.includes('팔탄')) normName = '화성 팔탄 테니스장';
    else if (rawName.includes('테니스연구소')) normName = '화성 테니스연구소';
    else if (rawName.includes('순성')) normName = '순성 체육공원 테니스장';
    else if (rawName.includes('향남')) normName = '향남 하수처리장 코트';
    else if (rawName.includes('프로원')) normName = '프로원 실내 테니스장';
    else if (rawName) normName = rawName;

    if (!venueMap[normName]) venueMap[normName] = { count: 0, dates: [] };
    venueMap[normName].count += 1;
    if (session.date) venueMap[normName].dates.push(session.date);

    let rawType = (session.courtType || '').trim();
    if (rawType.includes('하드')) surfaceMap['하드코트'] = (surfaceMap['하드코트'] || 0) + 1;
    else surfaceMap['인조잔디'] = (surfaceMap['인조잔디'] || 0) + 1;

    let rawEnv = (session.courtEnv || '').trim();
    if (rawEnv.includes('실내') || normName.includes('실내')) envMap['실내'] = (envMap['실내'] || 0) + 1;
    else envMap['야외'] = (envMap['야외'] || 0) + 1;
  });

  const sortedVenues = Object.entries(venueMap)
    .map(([name, data]) => ({
      name,
      count: data.count,
      rate: ((data.count / totalSessionsCount) * 100).toFixed(1),
    }))
    .sort((a, b) => b.count - a.count);

  const turfCount = surfaceMap['인조잔디'] || 0;
  const hardCount = surfaceMap['하드코트'] || 0;
  const turfRate = ((turfCount / totalSessionsCount) * 100).toFixed(1);
  const hardRate = ((hardCount / totalSessionsCount) * 100).toFixed(1);

  const outdoorCount = envMap['야외'] || 0;
  const indoorCount = envMap['실내'] || 0;
  const outdoorRate = ((outdoorCount / totalSessionsCount) * 100).toFixed(1);
  const indoorRate = ((indoorCount / totalSessionsCount) * 100).toFixed(1);

  const renderRptCard = (player: any) => {
    let rankClass = `rank-${player.displayRank}`;
    let rankLabel = `${player.displayRank}위`;
    let praise = '전국구 테니스 에이스';
    if (player.displayRank === 1) { rankLabel = '🥇 1위 (전국 대회 최고점)'; praise = '한울타리의 명예를 빛낸 슈퍼 에이스!'; }
    else if (player.displayRank === 2) { rankLabel = '🥈 2위'; praise = '전국 대회 무대 입상자'; }
    else if (player.displayRank === 3) { rankLabel = '🥉 3위'; praise = '전국구 강호 킬러'; }
    else if (player.displayRank === 4) { rankLabel = '🎖️ 4위'; praise = '코트를 압도하는 실력파'; }
    else if (player.displayRank === 5) { rankLabel = '🎖️ 5위'; praise = '언제나 든든한 대표 선수'; }

    return `
    <div class="leader-card ${rankClass}">
      <span class="leader-rank-badge">${rankLabel}</span>
      <img class="leader-avatar" src="${player.photoBase64}" alt="${player.name}" onerror="this.src='${logoBase64}'">
      <div class="leader-name">${player.name}</div>
      <div class="leader-main-val" style="color: #F59E0B;">${player.rPt.toFixed(1)}<span style="font-size: 1rem; color: #94A3B8;">점</span></div>
      <div class="leader-sub-text">전국대회 입상 누적 포인트</div>
      <span class="leader-tag">${praise}</span>

      <div class="leader-prize-box">
        <div class="leader-prize-title">
          <span>🏆</span> <span>대회 입상 및 성적 내역 (${player.rDetails.length}건)</span>
        </div>
        <ul class="leader-prize-list">
          ${player.rDetails && player.rDetails.length > 0 ? player.rDetails.map((item: any) => `
            <li class="leader-prize-item">
              <span class="prize-desc">${item.desc}</span>
              <span class="prize-pts">+${item.pts}점</span>
            </li>
          `).join('') : `
            <li class="leader-prize-item">
              <span class="prize-desc">전국대회 입상 포인트 획득</span>
              <span class="prize-pts">+${player.rPt.toFixed(1)}점</span>
            </li>
          `}
        </ul>
      </div>
    </div>
    `;
  };

  console.log('Generating comprehensive HTML Dashboard...');

  // HTML 문서 생성
  const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2026 한울타리 테니스클럽 연말 결산 대시보드 페스티벌</title>
  <link rel="preconnect" href="https://cdn.jsdelivr.net">
  <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
  <style>
    :root {
      --bg-dark: #0A1128;
      --card-bg: rgba(16, 27, 61, 0.88);
      --card-border: rgba(99, 102, 241, 0.28);
      --court-green: #10B981;
      --tennis-ball: #CCFF00;
      --gold: #F59E0B;
      --silver: #E2E8F0;
      --bronze: #D97706;
      --blue-accent: #3B82F6;
      --purple-accent: #8B5CF6;
      --rose-accent: #F43F5E;
      --text-main: #F8FAFC;
      --text-sub: #94A3B8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
    }

    body {
      background: radial-gradient(circle at 50% 8%, #1e295d 0%, #0a1128 60%, #050814 100%);
      color: var(--text-main);
      min-height: 100vh;
      padding: 30px 20px 90px 20px;
      overflow-x: hidden;
      position: relative;
    }

    /* 코트 라인 그리드 */
    body::before {
      content: "";
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: 
        linear-gradient(rgba(255,255,255,0.03) 2px, transparent 2px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 2px, transparent 2px);
      background-size: 80px 80px;
      pointer-events: none;
      z-index: 0;
    }

    .container {
      max-width: 1380px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }

    /* 상단 도구 모음 */
    .top-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .action-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #FFFFFF;
      padding: 9px 18px;
      border-radius: 20px;
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      backdrop-filter: blur(8px);
      transition: all 0.25s ease;
    }

    .action-btn:hover {
      background: rgba(204, 255, 0, 0.25);
      border-color: var(--tennis-ball);
      color: var(--tennis-ball);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(204, 255, 0, 0.3);
    }

    /* 메인 히어로 배너 */
    .hero-header {
      text-align: center;
      padding: 40px 24px 35px 24px;
      margin-bottom: 45px;
      background: linear-gradient(135deg, rgba(30, 58, 138, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 26px;
      box-shadow: 0 20px 45px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25);
      position: relative;
      overflow: hidden;
    }

    .hero-header::after {
      content: "🎾";
      position: absolute;
      right: -25px;
      bottom: -35px;
      font-size: 160px;
      opacity: 0.08;
      pointer-events: none;
      transform: rotate(-15deg);
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(204, 255, 0, 0.15);
      color: var(--tennis-ball);
      border: 1px solid rgba(204, 255, 0, 0.45);
      padding: 6px 20px;
      border-radius: 30px;
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }

    .hero-title {
      font-size: 3rem;
      font-weight: 900;
      letter-spacing: -1px;
      background: linear-gradient(to right, #FFFFFF, #E0E7FF, #FDE047);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 12px;
      text-shadow: 0 4px 25px rgba(0,0,0,0.4);
    }

    .hero-subtitle {
      font-size: 1.25rem;
      color: #94A3B8;
      font-weight: 500;
    }

    /* ========================================================
       모든 네모 박스 공통 컨테이너 및 우측 상단 로고 뱃지
       ======================================================== */
    .dashboard-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 26px;
      padding: 38px 36px;
      margin-bottom: 45px;
      box-shadow: 0 16px 36px rgba(0,0,0,0.48);
      position: relative;
      backdrop-filter: blur(16px);
      transition: transform 0.3s ease, border-color 0.3s ease;
    }

    .dashboard-card:hover {
      border-color: rgba(99, 102, 241, 0.55);
    }

    /* 모든 박스 우측 상단 한울타리 공식 로고 */
    .card-logo-badge {
      position: absolute;
      top: 28px;
      right: 28px;
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(15, 23, 42, 0.9);
      padding: 6px 14px 6px 8px;
      border-radius: 30px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      box-shadow: 0 4px 12px rgba(0,0,0,0.45);
      z-index: 10;
    }

    .card-logo-badge img {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid rgba(255,255,255,0.4);
    }

    .card-logo-badge span {
      font-size: 0.85rem;
      font-weight: 800;
      letter-spacing: 0.8px;
      color: #60A5FA;
    }

    .card-header {
      margin-bottom: 32px;
      padding-right: 190px; /* 로고 영역 침범 방지 */
    }

    .card-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .card-icon {
      font-size: 2.2rem;
    }

    .card-title {
      font-size: 1.95rem;
      font-weight: 900;
      color: #FFFFFF;
      letter-spacing: -0.5px;
    }

    .card-desc {
      font-size: 1.08rem;
      color: #94A3B8;
      font-weight: 500;
    }

    /* ========================================================
       박스 ①: 월별 테니스 횟수 & 전체 누적 통계
       ======================================================== */
    .summary-highlights {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
      margin-bottom: 35px;
    }

    .stat-kpi-card {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 18px;
      box-shadow: 0 8px 22px rgba(0,0,0,0.35);
    }

    .kpi-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      flex-shrink: 0;
    }

    .kpi-icon-wrap.green {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.45);
    }

    .kpi-icon-wrap.yellow {
      background: rgba(245, 158, 11, 0.2);
      border: 1px solid rgba(245, 158, 11, 0.45);
    }

    .kpi-icon-wrap.blue {
      background: rgba(59, 130, 246, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.45);
    }

    .kpi-content {
      flex: 1;
    }

    .kpi-val {
      font-size: 2.3rem;
      font-weight: 900;
      line-height: 1.1;
      color: #FFFFFF;
    }

    .kpi-val span {
      font-size: 1.15rem;
      color: #94A3B8;
      font-weight: 700;
      margin-left: 4px;
    }

    .kpi-label {
      font-size: 0.9rem;
      color: #94A3B8;
      font-weight: 600;
      margin-top: 4px;
    }

    .chart-section {
      background: rgba(15, 23, 42, 0.65);
      border-radius: 20px;
      padding: 28px 24px 20px 24px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 30px;
    }

    .chart-title-sub {
      font-size: 1.12rem;
      font-weight: 800;
      color: #E2E8F0;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .bars-wrapper {
      display: flex;
      align-items: flex-end;
      gap: 14px;
      height: 240px;
      padding-bottom: 32px;
      border-bottom: 2px solid rgba(255, 255, 255, 0.12);
      position: relative;
    }

    .bar-col {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      position: relative;
    }

    .bar-pill {
      width: 100%;
      max-width: 48px;
      border-radius: 10px 10px 4px 4px;
      background: linear-gradient(180deg, #60A5FA 0%, #2563EB 100%);
      transition: height 1s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s;
      position: relative;
      cursor: pointer;
    }

    .bar-pill:hover {
      background: linear-gradient(180deg, var(--tennis-ball) 0%, #10B981 100%);
      box-shadow: 0 0 16px rgba(204, 255, 0, 0.55);
    }

    .bar-pill.peak {
      background: linear-gradient(180deg, #FDE047 0%, #D97706 100%);
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.45);
    }

    .bar-tooltip {
      position: absolute;
      top: -34px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.95rem;
      font-weight: 900;
      color: #FFFFFF;
      white-space: nowrap;
    }

    .bar-label {
      position: absolute;
      bottom: -28px;
      font-size: 0.88rem;
      font-weight: 700;
      color: #94A3B8;
    }

    .monthly-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 16px;
      margin-top: 25px;
    }

    .month-mini-card {
      background: rgba(30, 41, 59, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: all 0.2s ease;
    }

    .month-mini-card:hover {
      background: rgba(30, 41, 59, 0.95);
      border-color: #38BDF8;
      transform: translateY(-3px);
    }

    .month-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .month-name {
      font-size: 1.15rem;
      font-weight: 800;
      color: #38BDF8;
    }

    .month-count-badge {
      font-size: 1.1rem;
      font-weight: 900;
      color: #FFFFFF;
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 10px;
      border-radius: 12px;
    }

    .month-sub-info {
      font-size: 0.82rem;
      color: #94A3B8;
      line-height: 1.4;
    }

    /* ========================================================
       박스 ②: 한울랭킹 1~10위 & 베스트 듀오 (Best Duo)
       ======================================================== */
    .duo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 22px;
    }

    .duo-card {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: all 0.3s ease;
      position: relative;
    }

    .duo-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 28px rgba(0,0,0,0.4);
      border-color: #60A5FA;
    }

    .duo-card.rank-1 {
      border-color: #F59E0B;
      background: linear-gradient(145deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 23, 42, 0.85) 60%);
    }

    .duo-card.rank-2 {
      border-color: #CBD5E1;
      background: linear-gradient(145deg, rgba(203, 213, 225, 0.15) 0%, rgba(15, 23, 42, 0.85) 60%);
    }

    .duo-card.rank-3 {
      border-color: #D97706;
      background: linear-gradient(145deg, rgba(217, 119, 6, 0.15) 0%, rgba(15, 23, 42, 0.85) 60%);
    }

    .duo-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .duo-rank-tag {
      font-size: 0.95rem;
      font-weight: 800;
      padding: 4px 12px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.1);
    }

    .rank-1 .duo-rank-tag { background: #F59E0B; color: #000; }
    .rank-2 .duo-rank-tag { background: #E2E8F0; color: #0F172A; }
    .rank-3 .duo-rank-tag { background: #D97706; color: #FFF; }

    .duo-score-badge {
      font-size: 1.15rem;
      font-weight: 900;
      color: #FBBF24;
    }

    .duo-matchup {
      display: flex;
      align-items: center;
      justify-content: space-around;
      background: rgba(0, 0, 0, 0.35);
      border-radius: 16px;
      padding: 16px 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .duo-player {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
      flex: 1;
    }

    .duo-player img {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center 15%;
      border: 2px solid rgba(255, 255, 255, 0.25);
    }

    .duo-player .name {
      font-size: 1.05rem;
      font-weight: 800;
      color: #FFFFFF;
    }

    .duo-player .role-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgba(59, 130, 246, 0.25);
      color: #93C5FD;
    }

    .duo-connector {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 0 10px;
    }

    .duo-heart {
      font-size: 1.8rem;
      animation: heartbeat 1.8s infinite;
    }

    @keyframes heartbeat {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }

    .duo-stats-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.04);
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 0.9rem;
    }

    .duo-win-highlight {
      color: var(--tennis-ball);
      font-weight: 800;
      font-size: 1.05rem;
    }

    /* ========================================================
       박스 ③: 4승 달성 랭킹 카드 그리드 (TOP 5)
       ======================================================== */
    .podium-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 24px;
    }

    .player-card {
      background: rgba(15, 23, 42, 0.75);
      border-radius: 22px;
      padding: 26px;
      border: 2px solid rgba(255, 255, 255, 0.08);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 18px;
      transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .player-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 16px 32px rgba(0,0,0,0.5);
    }

    .player-card.rank-1 {
      border-color: #F59E0B;
      background: linear-gradient(145deg, rgba(245, 158, 11, 0.18) 0%, rgba(15, 23, 42, 0.88) 60%);
      box-shadow: 0 10px 28px rgba(245, 158, 11, 0.25);
    }

    .player-card.rank-2 {
      border-color: #94A3B8;
      background: linear-gradient(145deg, rgba(148, 163, 184, 0.18) 0%, rgba(15, 23, 42, 0.88) 60%);
      box-shadow: 0 10px 28px rgba(148, 163, 184, 0.18);
    }

    .player-card.rank-3 {
      border-color: #D97706;
      background: linear-gradient(145deg, rgba(217, 119, 6, 0.18) 0%, rgba(15, 23, 42, 0.88) 60%);
      box-shadow: 0 10px 28px rgba(217, 119, 6, 0.18);
    }

    .player-card.rank-4 {
      border-color: rgba(59, 130, 246, 0.5);
      background: linear-gradient(145deg, rgba(59, 130, 246, 0.12) 0%, rgba(15, 23, 42, 0.88) 60%);
    }

    .card-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .rank-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 900;
      font-size: 0.95rem;
      letter-spacing: 0.5px;
    }

    .rank-1 .rank-tag {
      background: #F59E0B;
      color: #000;
      box-shadow: 0 0 15px rgba(245, 158, 11, 0.6);
    }

    .rank-2 .rank-tag {
      background: #E2E8F0;
      color: #0F172A;
    }

    .rank-3 .rank-tag {
      background: #D97706;
      color: #FFF;
    }

    .rank-4 .rank-tag {
      background: #3B82F6;
      color: #FFF;
    }

    .wins-badge {
      text-align: right;
    }

    .wins-number {
      font-size: 2.3rem;
      font-weight: 900;
      line-height: 1;
      color: var(--tennis-ball);
      text-shadow: 0 0 12px rgba(204, 255, 0, 0.4);
    }

    .wins-label {
      font-size: 0.8rem;
      color: #94A3B8;
      font-weight: 700;
      text-transform: uppercase;
    }

    .player-profile-row {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .avatar-wrapper {
      position: relative;
      flex-shrink: 0;
    }

    .player-avatar {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center 15%;
      border: 3px solid rgba(255, 255, 255, 0.22);
      box-shadow: 0 6px 18px rgba(0,0,0,0.45);
      background: #1E293B;
    }

    .rank-1 .player-avatar { border-color: #F59E0B; box-shadow: 0 0 20px rgba(245, 158, 11, 0.5); }
    .rank-2 .player-avatar { border-color: #CBD5E1; }
    .rank-3 .player-avatar { border-color: #D97706; }
    .rank-4 .player-avatar { border-color: #60A5FA; }

    .avatar-decor {
      position: absolute;
      bottom: -4px;
      right: -4px;
      font-size: 1.5rem;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
    }

    .player-meta {
      flex: 1;
    }

    .player-name {
      font-size: 1.7rem;
      font-weight: 900;
      color: #FFFFFF;
      margin-bottom: 6px;
    }

    .player-comment {
      font-size: 0.9rem;
      color: #93C5FD;
      font-weight: 600;
    }

    .stats-pills {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      background: rgba(0, 0, 0, 0.35);
      padding: 12px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .pill-item {
      text-align: center;
    }

    .pill-val {
      font-size: 1.2rem;
      font-weight: 800;
      color: #F1F5F9;
    }

    .pill-lbl {
      font-size: 0.74rem;
      color: #94A3B8;
      margin-top: 2px;
    }

    /* ========================================================
       박스 ④ ~ ⑦: 리더보드 카드 스타일 (공통 그리드)
       ======================================================== */
    .ranking-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
    }

    .leader-card {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;
      position: relative;
      transition: all 0.25s ease;
    }

    .leader-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 25px rgba(0,0,0,0.4);
      border-color: rgba(255, 255, 255, 0.3);
    }

    .leader-card.rank-1 {
      border-color: #F59E0B;
      background: linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 23, 42, 0.85) 70%);
    }

    .leader-rank-badge {
      position: absolute;
      top: 14px;
      left: 14px;
      font-size: 0.85rem;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.1);
    }

    .leader-card.rank-1 .leader-rank-badge { background: #F59E0B; color: #000; }
    .leader-card.rank-2 .leader-rank-badge { background: #CBD5E1; color: #000; }
    .leader-card.rank-3 .leader-rank-badge { background: #D97706; color: #FFF; }

    .leader-avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center 15%;
      border: 3px solid rgba(255, 255, 255, 0.2);
      margin-top: 10px;
    }

    .leader-name {
      font-size: 1.35rem;
      font-weight: 900;
      color: #FFFFFF;
    }

    .leader-main-val {
      font-size: 2rem;
      font-weight: 900;
      line-height: 1;
      color: var(--tennis-ball);
    }

    .leader-sub-text {
      font-size: 0.85rem;
      color: #94A3B8;
      font-weight: 600;
    }

    .leader-tag {
      font-size: 0.78rem;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.08);
      color: #93C5FD;
    }

    /* 전국대회 입상 내역 상세 상자 & 3명(위줄) 2명(아래줄) 레이아웃 */
    .rpt-cards-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .rpt-row-top {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 22px;
    }

    .rpt-row-bottom {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 22px;
      max-width: 900px;
      margin: 0 auto;
      width: 100%;
    }

    @media (max-width: 950px) {
      .rpt-row-top, .rpt-row-bottom {
        grid-template-columns: 1fr;
      }
    }

    .leader-prize-box {
      width: 100%;
      background: rgba(0, 0, 0, 0.45);
      border-radius: 14px;
      padding: 12px 14px;
      margin-top: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      text-align: left;
    }

    .leader-prize-title {
      font-size: 0.78rem;
      font-weight: 800;
      color: #FBBF24;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 5px;
      letter-spacing: 0.5px;
    }

    .leader-prize-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      /* 스크롤 없이 모든 내용 전수 표시 */
      max-height: none;
      overflow: visible;
    }

    .leader-prize-item {
      font-size: 0.8rem;
      line-height: 1.4;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
      padding-bottom: 5px;
    }

    .leader-prize-item:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .prize-desc {
      color: #E2E8F0;
      font-weight: 500;
      word-break: keep-all;
    }

    .prize-pts {
      color: #F59E0B;
      font-weight: 800;
      font-size: 0.85rem;
      white-space: nowrap;
    }

    /* ========================================================
       박스 ⑧: 코트 위치별(듀스 vs 애드) 승률 통계
       ======================================================== */
    .court-summary-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 30px;
    }

    .court-compare-box {
      background: rgba(15, 23, 42, 0.7);
      border-radius: 20px;
      padding: 24px;
      border: 2px solid rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .court-compare-box.deuce {
      border-color: #3B82F6;
      background: linear-gradient(145deg, rgba(59, 130, 246, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%);
    }

    .court-compare-box.ad {
      border-color: #10B981;
      background: linear-gradient(145deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%);
    }

    .court-box-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .court-box-title {
      font-size: 1.35rem;
      font-weight: 900;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .court-box-title.deuce { color: #60A5FA; }
    .court-box-title.ad { color: #34D399; }

    .court-rate-val {
      font-size: 2.4rem;
      font-weight: 900;
      color: #FFFFFF;
    }

    .court-sub-detail {
      font-size: 0.95rem;
      color: #94A3B8;
      font-weight: 600;
    }

    .court-split-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .specialist-table {
      width: 100%;
      border-collapse: collapse;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .specialist-table th {
      background: rgba(255, 255, 255, 0.06);
      padding: 12px 14px;
      font-size: 0.88rem;
      font-weight: 800;
      color: #94A3B8;
      text-align: left;
    }

    .specialist-table td {
      padding: 12px 14px;
      font-size: 0.95rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      color: #F8FAFC;
    }

    .specialist-table tr:hover td {
      background: rgba(255, 255, 255, 0.04);
    }

    .player-cell-mini {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .player-cell-mini img {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center 15%;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    /* ========================================================
       박스 ⑨: 코트 장소 & 코트 종류별 통계 스타일
       ======================================================== */
    .court-analytics-grid {
      display: grid;
      grid-template-columns: 1.25fr 0.85fr 0.85fr;
      gap: 22px;
    }

    @media (max-width: 1024px) {
      .court-analytics-grid {
        grid-template-columns: 1fr;
      }
    }

    .analytics-panel {
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .analytics-title {
      font-size: 1.2rem;
      font-weight: 800;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 12px;
    }

    .venue-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .venue-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .venue-item-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.92rem;
    }

    .venue-name {
      font-weight: 700;
      color: #F1F5F9;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .venue-count-badge {
      font-weight: 800;
      color: var(--tennis-ball);
      font-size: 0.95rem;
    }

    .venue-bar-track {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      overflow: hidden;
    }

    .venue-bar-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, #3B82F6 0%, #10B981 100%);
      transition: width 1s ease-in-out;
    }

    .ratio-breakdown-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .ratio-stat-row {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .ratio-stat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ratio-label {
      font-size: 1rem;
      font-weight: 800;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ratio-val {
      font-size: 1.35rem;
      font-weight: 900;
      color: #38BDF8;
    }

    .ratio-desc {
      font-size: 0.82rem;
      color: #94A3B8;
      line-height: 1.45;
    }

    /* ========================================================
       피날레 송년회 축하 배너
       ======================================================== */
    .party-banner {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.22) 0%, rgba(16, 185, 129, 0.22) 100%);
      border: 2px dashed rgba(204, 255, 0, 0.55);
      border-radius: 22px;
      padding: 35px 25px;
      text-align: center;
      margin-top: 15px;
    }

    .party-title {
      font-size: 2rem;
      font-weight: 900;
      color: var(--tennis-ball);
      margin-bottom: 14px;
    }

    .party-text {
      font-size: 1.2rem;
      line-height: 1.8;
      color: #E2E8F0;
      max-width: 950px;
      margin: 0 auto 24px auto;
    }

    .celebrate-btn {
      background: linear-gradient(90deg, #10B981 0%, #059669 100%);
      border: none;
      color: #FFFFFF;
      padding: 15px 36px;
      font-size: 1.15rem;
      font-weight: 900;
      border-radius: 35px;
      cursor: pointer;
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.45);
      transition: all 0.25s ease;
      display: inline-flex;
      align-items: center;
      gap: 12px;
    }

    .celebrate-btn:hover {
      transform: scale(1.05);
      background: linear-gradient(90deg, var(--tennis-ball) 0%, #10B981 100%);
      color: #0A1128;
      box-shadow: 0 10px 30px rgba(204, 255, 0, 0.55);
    }

    .footer-note {
      text-align: center;
      color: #64748B;
      font-size: 0.95rem;
      margin-top: 55px;
      font-weight: 500;
    }

    /* ========================================================
       총회 순서 (Agenda) 섹션 스타일
       ======================================================== */
    .agenda-timeline-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      gap: 20px;
      margin-top: 10px;
    }

    .agenda-step-card {
      background: linear-gradient(145deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.92) 100%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 24px 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .agenda-step-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 14px 30px rgba(0,0,0,0.5);
      border-color: var(--tennis-ball);
    }

    .agenda-step-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 5px;
      height: 100%;
      background: linear-gradient(180deg, #3B82F6 0%, #10B981 100%);
      border-radius: 4px 0 0 4px;
    }

    .agenda-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .agenda-step-num {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      font-weight: 900;
      letter-spacing: 1.5px;
      padding: 4px 12px;
      border-radius: 14px;
      background: rgba(204, 255, 0, 0.15);
      color: var(--tennis-ball);
      border: 1px solid rgba(204, 255, 0, 0.35);
    }

    .agenda-presenter-badge {
      font-size: 0.82rem;
      font-weight: 800;
      padding: 4px 12px;
      border-radius: 14px;
      background: rgba(59, 130, 246, 0.2);
      color: #93C5FD;
      border: 1px solid rgba(59, 130, 246, 0.4);
    }

    .agenda-step-main {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .agenda-step-icon {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    .agenda-step-info {
      flex: 1;
    }

    .agenda-step-title {
      font-size: 1.25rem;
      font-weight: 900;
      color: #FFFFFF;
      margin-bottom: 6px;
      line-height: 1.3;
    }

    .agenda-step-desc {
      font-size: 0.88rem;
      color: #94A3B8;
      line-height: 1.5;
      font-weight: 500;
    }

    .agenda-step-card.highlight {
      border-color: #F59E0B;
      background: linear-gradient(145deg, rgba(245, 158, 11, 0.16) 0%, rgba(15, 23, 42, 0.95) 80%);
      box-shadow: 0 10px 26px rgba(245, 158, 11, 0.22);
    }

    .agenda-step-card.highlight::before {
      background: linear-gradient(180deg, #F59E0B 0%, #D97706 100%);
    }

    .agenda-step-card.highlight .agenda-step-num {
      background: rgba(245, 158, 11, 0.25);
      color: #FDE047;
      border-color: rgba(245, 158, 11, 0.55);
    }

    .agenda-step-card.highlight .agenda-presenter-badge {
      background: rgba(245, 158, 11, 0.25);
      color: #FDE047;
      border-color: #F59E0B;
    }

    @media (max-width: 900px) {
      .hero-title { font-size: 2.2rem; }
      .card-title { font-size: 1.5rem; }
      .card-header { padding-right: 0; margin-top: 45px; }
      .court-summary-row, .court-split-grid { grid-template-columns: 1fr; }
      .bars-wrapper { gap: 8px; }
      .bar-tooltip { font-size: 0.8rem; top: -26px; }
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- 상단 도구 모음 -->
    <div class="top-actions">
      <button class="action-btn" onclick="toggleFullScreen()">
        <span>🖥️</span> <span>프레젠테이션 전체화면 (F11)</span>
      </button>
      <button class="action-btn" onclick="triggerConfetti()">
        <span>🎉</span> <span>축하 폭죽 터뜨리기</span>
      </button>
      <button class="action-btn" onclick="window.print()">
        <span>🖨️</span> <span>인쇄 / PDF 저장</span>
      </button>
    </div>

    <!-- 메인 타이틀 배너 -->
    <header class="hero-header">
      <div class="hero-badge">HANULTARI TENNIS CLUB • 2026 ANNUAL FESTIVAL</div>
      <h1 class="hero-title">🎾 2026 한울타리 연말 결산 대시보드 🏆</h1>
      <p class="hero-subtitle">열정과 랠리로 코트를 뜨겁게 달군 2026년 한울타리 테니스클럽 8대 결산 통계 & 정기 총회</p>
    </header>

    <!-- ========================================================
         네모 박스 0: 2026 한울타리 연말 정기 총회 순서 (Agenda)
         ======================================================== -->
    <section class="dashboard-card" id="section-agenda">
      <!-- 우측 상단 로고 -->
      <div class="card-logo-badge">
        <img src="${logoBase64}" alt="한울타리 로고">
        <span>한울타리 테니스</span>
      </div>

      <div class="card-header">
        <div class="card-title-group">
          <span class="card-icon">📋</span>
          <h2 class="card-title">한울타리 연말 정기 총회 순서 (Agenda)</h2>
        </div>
        <p class="card-desc">2026년 한 해의 열정을 돌아보고 2027년의 새로운 도약과 번영을 의결하는 정기 총회 공식 식순입니다.</p>
      </div>

      <div class="agenda-timeline-grid">
        <!-- 1. 회장님 인사말 -->
        <div class="agenda-step-card">
          <div class="agenda-card-top">
            <span class="agenda-step-num">STEP 01</span>
            <span class="agenda-presenter-badge">진행: 회장</span>
          </div>
          <div class="agenda-step-main">
            <div class="agenda-step-icon">🎤</div>
            <div class="agenda-step-info">
              <h3 class="agenda-step-title">1. 회장님 인사말</h3>
              <p class="agenda-step-desc">2026년 한 해 동안 함께 코트를 누빈 회원 여러분께 드리는 감사의 말씀과 총회 개회 선언</p>
            </div>
          </div>
        </div>

        <!-- 2. 26년 돌아보기 (경기이사) -->
        <div class="agenda-step-card">
          <div class="agenda-card-top">
            <span class="agenda-step-num">STEP 02</span>
            <span class="agenda-presenter-badge" style="background: rgba(16, 185, 129, 0.2); color: #6EE7B7; border-color: rgba(16, 185, 129, 0.4);">진행: 경기이사</span>
          </div>
          <div class="agenda-step-main">
            <div class="agenda-step-icon">🎾</div>
            <div class="agenda-step-info">
              <h3 class="agenda-step-title">2. 26년 돌아보기</h3>
              <p class="agenda-step-desc">총 112회 세션의 발자취, 4승 챔피언, 베스트 듀오, 승률 랭킹 등 시즌 8대 테니스 결산 통계 발표</p>
            </div>
          </div>
        </div>

        <!-- 3. 26년 결산보고 (총무이사) -->
        <div class="agenda-step-card">
          <div class="agenda-card-top">
            <span class="agenda-step-num">STEP 03</span>
            <span class="agenda-presenter-badge" style="background: rgba(245, 158, 11, 0.2); color: #FCD34D; border-color: rgba(245, 158, 11, 0.4);">진행: 총무이사</span>
          </div>
          <div class="agenda-step-main">
            <div class="agenda-step-icon">📊</div>
            <div class="agenda-step-info">
              <h3 class="agenda-step-title">3. 26년 결산보고</h3>
              <p class="agenda-step-desc">올 한 해 클럽 회비 수입 및 지출 내역, 잔액 결산 및 재정 집행 투명성 보고</p>
            </div>
          </div>
        </div>

        <!-- 4. 26년 신규 회원 인사 (총무이사) -->
        <div class="agenda-step-card">
          <div class="agenda-card-top">
            <span class="agenda-step-num">STEP 04</span>
            <span class="agenda-presenter-badge" style="background: rgba(245, 158, 11, 0.2); color: #FCD34D; border-color: rgba(245, 158, 11, 0.4);">진행: 총무이사</span>
          </div>
          <div class="agenda-step-main">
            <div class="agenda-step-icon">🤝</div>
            <div class="agenda-step-info">
              <h3 class="agenda-step-title">4. 26년 신규 회원 인사</h3>
              <p class="agenda-step-desc">2026년 한울타리 가족으로 새롭게 합류한 신규 회원 소개 및 환영과 포부 발표</p>
            </div>
          </div>
        </div>

        <!-- 5. 총회 안건 논의 (카페이사) -->
        <div class="agenda-step-card">
          <div class="agenda-card-top">
            <span class="agenda-step-num">STEP 05</span>
            <span class="agenda-presenter-badge" style="background: rgba(139, 92, 246, 0.2); color: #C4B5FD; border-color: rgba(139, 92, 246, 0.4);">진행: 카페이사</span>
          </div>
          <div class="agenda-step-main">
            <div class="agenda-step-icon">💡</div>
            <div class="agenda-step-info">
              <h3 class="agenda-step-title">5. 총회 안건 논의</h3>
              <p class="agenda-step-desc">클럽 회칙 및 운영 개선, 코트 대여 및 배정 규칙, 카페 활성화 방안 등 주요 안건 토의 및 의결</p>
            </div>
          </div>
        </div>

        <!-- 6. 27년 회장/감사 선출 (총무이사) -->
        <div class="agenda-step-card">
          <div class="agenda-card-top">
            <span class="agenda-step-num">STEP 06</span>
            <span class="agenda-presenter-badge" style="background: rgba(245, 158, 11, 0.2); color: #FCD34D; border-color: rgba(245, 158, 11, 0.4);">진행: 총무이사</span>
          </div>
          <div class="agenda-step-main">
            <div class="agenda-step-icon">🗳️</div>
            <div class="agenda-step-info">
              <h3 class="agenda-step-title">6. 27년 회장/감사 선출</h3>
              <p class="agenda-step-desc">2027년 한울타리 테니스클럽을 이끌어갈 차기 신임 회장 및 감사 후보 추천과 투표 선출</p>
            </div>
          </div>
        </div>

        <!-- 7. 27년 신임회장님 인사말 -->
        <div class="agenda-step-card highlight">
          <div class="agenda-card-top">
            <span class="agenda-step-num">STEP 07 (피날레)</span>
            <span class="agenda-presenter-badge">진행: 27년 신임회장</span>
          </div>
          <div class="agenda-step-main">
            <div class="agenda-step-icon">👑</div>
            <div class="agenda-step-info">
              <h3 class="agenda-step-title">7. 27년 신임회장님 인사말</h3>
              <p class="agenda-step-desc">신임 회장 당선 소감, 2027년 클럽 운영 비전 발표 및 회원 화합과 도약을 위한 다짐</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================================
         네모 박스 ①: 올해(2026) 월별 테니스 횟수 & 전체 누적 횟수 통계
         ======================================================== -->
    <section class="dashboard-card" id="section-monthly">
      <!-- 우측 상단 로고 -->
      <div class="card-logo-badge">
        <img src="${logoBase64}" alt="한울타리 로고">
        <span>한울타리 테니스</span>
      </div>

      <div class="card-header">
        <div class="card-title-group">
          <span class="card-icon">📅</span>
          <h2 class="card-title">① 2026 시즌 월별 테니스 횟수 & 총 개최 통계</h2>
        </div>
        <p class="card-desc">봄의 첫 랠리부터 초겨울의 마지막 스매싱까지 쉼 없이 달려온 2026년 주말리그 대기록</p>
      </div>

      <!-- 상단 핵심 3대 지표 (KPI) -->
      <div class="summary-highlights">
        <div class="stat-kpi-card">
          <div class="kpi-icon-wrap green">🎾</div>
          <div class="kpi-content">
            <div class="kpi-val">${totalSessionsCount}<span>회</span></div>
            <div class="kpi-label">2026 올해 누적 전체 테니스 세션</div>
          </div>
        </div>

        <div class="stat-kpi-card">
          <div class="kpi-icon-wrap yellow">🏆</div>
          <div class="kpi-content">
            <div class="kpi-val">${monthlyData.find(m => m.count === maxMonthCount)?.monthLabel || '1월'}<span>(${maxMonthCount}회)</span></div>
            <div class="kpi-label">시즌 최다 테니스 개최의 달</div>
          </div>
        </div>

        <div class="stat-kpi-card">
          <div class="kpi-icon-wrap blue">📊</div>
          <div class="kpi-content">
            <div class="kpi-val">${avgMonthCount}<span>회/월</span></div>
            <div class="kpi-label">월평균 주말리그 개최 빈도</div>
          </div>
        </div>
      </div>

      <!-- 월별 막대 그래프 차트 -->
      <div class="chart-section">
        <div class="chart-title-sub">
          <span>📊</span> <span>2026년 1월 ~ 11월 월별 개최 추이 (세션 수)</span>
        </div>
        <div class="bars-wrapper">
          ${monthlyData.map(m => {
            const heightPercent = Math.round((m.count / maxMonthCount) * 180);
            const isPeak = m.count === maxMonthCount;
            return `
            <div class="bar-col">
              <div class="bar-tooltip">${m.count}회</div>
              <div class="bar-pill ${isPeak ? 'peak' : ''}" style="height: ${heightPercent}px;" title="${m.monthLabel}: ${m.count}회 개최 (${m.dates.length}일간 진행)"></div>
              <div class="bar-label">${m.monthLabel}</div>
            </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 월별 상세 카드 그리드 -->
      <div class="monthly-cards-grid">
        ${monthlyData.map(m => {
          return `
          <div class="month-mini-card">
            <div class="month-top">
              <span class="month-name">${m.monthLabel}</span>
              <span class="month-count-badge">${m.count}회</span>
            </div>
            <div class="month-sub-info">
              <div>📅 ${m.daysCount}개 주말/공휴일 진행</div>
              <div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">세션 평균 ${(m.count / (m.daysCount || 1)).toFixed(1)}타임</div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </section>

    <!-- ========================================================
         네모 박스 ②: 한울랭킹 1~10위 선수들의 베스트 듀오 (Best Duo)
         ======================================================== -->
    <section class="dashboard-card" id="section-best-duo">
      <!-- 우측 상단 로고 -->
      <div class="card-logo-badge">
        <img src="${logoBase64}" alt="한울타리 로고">
        <span>한울타리 테니스</span>
      </div>

      <div class="card-header">
        <div class="card-title-group">
          <span class="card-icon">🤝</span>
          <h2 class="card-title">② 한울랭킹 TOP 10 에이스 & 베스트 듀오 (Best Duo)</h2>
        </div>
        <p class="card-desc">시즌을 호령한 한울랭킹 1위~10위 선수들과 환상의 호흡을 맞춘 최다승 파트너 콤비 매칭</p>
      </div>

      <div class="duo-grid">
        ${top10Rankers.map(ranker => {
          let rankClass = `rank-${ranker.rank}`;
          let rankLabel = `${ranker.rank}위`;
          if (ranker.rank === 1) rankLabel = '🥇 1위 (랭킹 1위)';
          else if (ranker.rank === 2) rankLabel = '🥈 2위 (랭킹 2위)';
          else if (ranker.rank === 3) rankLabel = '🥉 3위 (랭킹 3위)';

          return `
          <div class="duo-card ${rankClass}">
            <div class="duo-header-row">
              <span class="duo-rank-tag">${rankLabel}</span>
              <span class="duo-score-badge">${ranker.sumPoint.toLocaleString()}점 <span style="font-size: 0.78rem; color: #94A3B8;">(L:${ranker.lPt} G:${ranker.gPt} R:${ranker.rPt})</span></span>
            </div>

            <div class="duo-matchup">
              <div class="duo-player">
                <img src="${ranker.photoBase64}" alt="${ranker.name}" onerror="this.src='${logoBase64}'">
                <div class="name">${ranker.name}</div>
                <span class="role-badge">랭커 에이스</span>
              </div>

              <div class="duo-connector">
                <span class="duo-heart">🤝</span>
                <span style="font-size: 0.75rem; color: #94A3B8; font-weight: 700;">BEST DUO</span>
              </div>

              <div class="duo-player">
                <img src="${ranker.bestDuoPhoto}" alt="${ranker.bestDuoName}" onerror="this.src='${logoBase64}'">
                <div class="name">${ranker.bestDuoName}</div>
                <span class="role-badge" style="background: rgba(16, 185, 129, 0.25); color: #6EE7B7;">최고의 파트너</span>
              </div>
            </div>

            <div class="duo-stats-row">
              <div>함께 합작한 승리: <span class="duo-win-highlight">${ranker.bestDuoWins}승</span> (${ranker.bestDuoMatches}경기)</div>
              <div>듀오 승률: <strong style="color: ${parseFloat(ranker.duoWinRate) >= 60 ? '#34D399' : '#60A5FA'}">${ranker.duoWinRate}%</strong></div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </section>

    <!-- ========================================================
         네모 박스 ③: 4승 달성 횟수 랭킹 (TOP 5) ★ 사진 필수
         ======================================================== -->
    <section class="dashboard-card" id="section-four-wins">
      <!-- 우측 상단 로고 -->
      <div class="card-logo-badge">
        <img src="${logoBase64}" alt="한울타리 로고">
        <span>한울타리 테니스</span>
      </div>

      <div class="card-header">
        <div class="card-title-group">
          <span class="card-icon">👑</span>
          <h2 class="card-title">③ 2026 시즌 4승 달성 챔피언 명예의 전당 (TOP 5)</h2>
        </div>
        <p class="card-desc">하루 5경기 리그에서 4승 이상을 쟁취하며 코트를 지배한 최고의 챔피언 (실제 프로필 사진 탑재)</p>
      </div>

      <div class="podium-grid">
        ${topFourWins.map(player => {
          let rankClass = `rank-${player.displayRank}`;
          if (player.displayRank > 3) rankClass = 'rank-4';

          let rankTagText = '';
          let decorIcon = '🎾';
          let comment = '';

          if (player.displayRank === 1) {
            rankTagText = '🥇 1위 (챔피언)';
            decorIcon = '👑';
            comment = '코트의 절대강자! 압도적 4승 최다 달성 (9회)';
          } else if (player.displayRank === 2) {
            rankTagText = '🥈 2위 (실버)';
            decorIcon = '🥈';
            comment = '76회 출전! 꾸준함과 실력을 겸비한 에이스 (7회)';
          } else if (player.displayRank === 3) {
            rankTagText = '🥉 3위 (브론즈)';
            decorIcon = '🥉';
            comment = '27회 출전 중 6회 4승! 고효율의 지배자 (6회)';
          } else {
            rankTagText = `🎖️ 공동 4위`;
            decorIcon = '✨';
            if (player.name === '이동주') comment = '77회 최다 출석! 한울타리의 든든한 기둥 (5회)';
            else if (player.name === '정정태') comment = '승률 69.4%! 무시무시한 결정력의 스나이퍼 (5회)';
            else if (player.name === '김종혁') comment = '145승의 특급 활약! 든든한 4승 해결사 (5회)';
            else comment = '코트를 뜨겁게 달군 한울타리 대표 에이스';
          }

          return `
          <div class="player-card ${rankClass}">
            <div class="card-top-row">
              <span class="rank-tag">${rankTagText}</span>
              <div class="wins-badge">
                <div class="wins-number">${player.fourWinsCount}회</div>
                <div class="wins-label">4승 달성</div>
              </div>
            </div>

            <div class="player-profile-row">
              <div class="avatar-wrapper">
                <img class="player-avatar" src="${player.photoBase64}" alt="${player.name}" onerror="this.src='${logoBase64}'">
                <span class="avatar-decor">${decorIcon}</span>
              </div>
              <div class="player-meta">
                <div class="player-name">${player.name}</div>
                <div class="player-comment">${comment}</div>
              </div>
            </div>

            <div class="stats-pills">
              <div class="pill-item">
                <div class="pill-val">${player.attendances}회</div>
                <div class="pill-lbl">시즌 출석</div>
              </div>
              <div class="pill-item">
                <div class="pill-val">${player.wins}승</div>
                <div class="pill-lbl">${player.matches}전 총 승수</div>
              </div>
              <div class="pill-item">
                <div class="pill-val" style="color: ${parseFloat(player.winRate) >= 60 ? '#34D399' : '#60A5FA'}">${player.winRate}%</div>
                <div class="pill-lbl">시즌 승률</div>
              </div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </section>

    <!-- ========================================================
         네모 박스 ④: 리그 참석 횟수 랭킹 (TOP 5 / 개근상)
         ======================================================== -->
    <section class="dashboard-card" id="section-attendance">
      <!-- 우측 상단 로고 -->
      <div class="card-logo-badge">
        <img src="${logoBase64}" alt="한울타리 로고">
        <span>한울타리 테니스</span>
      </div>

      <div class="card-header">
        <div class="card-title-group">
          <span class="card-icon">🏃‍♂️</span>
          <h2 class="card-title">④ 리그 참석 횟수 랭킹 (TOP 5 / 개근상)</h2>
        </div>
        <p class="card-desc">눈이 오나 비가 오나 코트를 든든하게 지켜준 한울타리 성실의 아이콘</p>
      </div>

      <div class="ranking-cards-grid">
        ${topAttendance.map(player => {
          let rankClass = `rank-${player.displayRank}`;
          let rankLabel = `${player.displayRank}위`;
          let praise = '코트의 지박령';
          if (player.displayRank === 1) { rankLabel = '🥇 1위 (개근왕)'; praise = '한울타리 최다 출석 챔피언!'; }
          else if (player.displayRank === 2) { rankLabel = '🥈 2위'; praise = '코트를 지키는 든든한 버팀목'; }
          else if (player.displayRank === 3) { rankLabel = '🥉 3위'; praise = '열정 가득 테니스 마니아'; }
          else if (player.displayRank === 4) { rankLabel = '🎖️ 4위'; praise = '언제나 반가운 활력소'; }
          else if (player.displayRank === 5) { rankLabel = '🎖️ 5위'; praise = '코트의 든든한 동반자'; }

          return `
          <div class="leader-card ${rankClass}">
            <span class="leader-rank-badge">${rankLabel}</span>
            <img class="leader-avatar" src="${player.photoBase64}" alt="${player.name}" onerror="this.src='${logoBase64}'">
            <div class="leader-name">${player.name}</div>
            <div class="leader-main-val">${player.attendances}<span style="font-size: 1rem; color: #94A3B8;">회</span></div>
            <div class="leader-sub-text">시즌 출석률 ${player.attRate}% (${totalSessionsCount}회 중)</div>
            <span class="leader-tag">${praise}</span>
          </div>
          `;
        }).join('')}
      </div>
    </section>

    <!-- ========================================================
         네모 박스 ⑤: 승률 랭킹 (TOP 5)
         ======================================================== -->
    <section class="dashboard-card" id="section-winrate">
      <!-- 우측 상단 로고 -->
      <div class="card-logo-badge">
        <img src="${logoBase64}" alt="한울타리 로고">
        <span>한울타리 테니스</span>
      </div>

      <div class="card-header">
        <div class="card-title-group">
          <span class="card-icon">⚡</span>
          <h2 class="card-title">⑤ 시즌 승률 랭킹 (TOP 5)</h2>
        </div>
        <p class="card-desc">높은 집중력과 결정력으로 코트에서 가장 높은 승리 확률을 기록한 승률 마스터 (최소 20경기 이상)</p>
      </div>

      <div class="ranking-cards-grid">
        ${topWinRate.map(player => {
          let rankClass = `rank-${player.displayRank}`;
          let rankLabel = `${player.displayRank}위`;
          let praise = '원샷 원킬 스나이퍼';
          if (player.displayRank === 1) { rankLabel = '🥇 1위 (승률왕)'; praise = '코트의 무결점 승리 마스터!'; }
          else if (player.displayRank === 2) { rankLabel = '🥈 2위'; praise = '상대를 압도하는 파괴력'; }
          else if (player.displayRank === 3) { rankLabel = '🥉 3위'; praise = '흔들림 없는 경기 운영'; }
          else if (player.displayRank === 4) { rankLabel = '🎖️ 4위'; praise = '믿고 보는 특급 해결사'; }
          else if (player.displayRank === 5) { rankLabel = '🎖️ 5위'; praise = '강력한 승부사 기질'; }

          return `
          <div class="leader-card ${rankClass}">
            <span class="leader-rank-badge">${rankLabel}</span>
            <img class="leader-avatar" src="${player.photoBase64}" alt="${player.name}" onerror="this.src='${logoBase64}'">
            <div class="leader-name">${player.name}</div>
            <div class="leader-main-val" style="color: #34D399;">${player.rateStr}<span style="font-size: 1rem; color: #94A3B8;">%</span></div>
            <div class="leader-sub-text">${player.wins}승 ${player.losses}패 (${player.matches}전)</div>
            <span class="leader-tag">${praise}</span>
          </div>
          `;
        }).join('')}
      </div>
    </section>

    <!-- ========================================================
         네모 박스 ⑥: 전국 대회 점수(R.PT) 랭킹 (TOP 5)
         ======================================================== -->
    <section class="dashboard-card" id="section-rpt">
      <!-- 우측 상단 로고 -->
      <div class="card-logo-badge">
        <img src="${logoBase64}" alt="한울타리 로고">
        <span>한울타리 테니스</span>
      </div>

      <div class="card-header">
        <div class="card-title-group">
          <span class="card-icon">🎖️</span>
          <h2 class="card-title">⑥ 전국 대회 점수(R.PT) 랭킹 (TOP 5)</h2>
        </div>
        <p class="card-desc">KATA, KATO 등 전국 테니스 대회에 출전 및 입상하여 한울타리의 위상을 드높인 전국구 에이스</p>
      </div>

      <div class="rpt-cards-container">
        <!-- 윗줄: 1~3위 (3명) -->
        <div class="rpt-row-top">
          ${topRPt.slice(0, 3).map(renderRptCard).join('')}
        </div>
        <!-- 아랫줄: 4~5위 (2명) -->
        <div class="rpt-row-bottom">
          ${topRPt.slice(3, 5).map(renderRptCard).join('')}
        </div>
      </div>
    </section>

    <!-- ========================================================
         네모 박스 ⑦: 간식/찬조 점수(G.PT) 랭킹 (TOP 5)
         ======================================================== -->
    <section class="dashboard-card" id="section-gpt">
      <!-- 우측 상단 로고 -->
      <div class="card-logo-badge">
        <img src="${logoBase64}" alt="한울타리 로고">
        <span>한울타리 테니스</span>
      </div>

      <div class="card-header">
        <div class="card-title-group">
          <span class="card-icon">🍎</span>
          <h2 class="card-title">⑦ 간식/찬조 점수(G.PT) 랭킹 (TOP 5 / 나눔상)</h2>
        </div>
        <p class="card-desc">회원들을 위해 맛있는 간식과 음료, 물품을 아낌없이 찬조하며 클럽을 따뜻하게 밝혀준 나눔의 천사</p>
      </div>

      <div class="ranking-cards-grid">
        ${topGPt.map(player => {
          let rankClass = `rank-${player.displayRank}`;
          let rankLabel = `${player.displayRank}위`;
          let praise = '클럽의 따뜻한 나눔천사';
          if (player.displayRank === 1) { rankLabel = '🥇 1위 (최다 나눔상)'; praise = '한울타리 최고의 훈훈한 후원자!'; }
          else if (player.displayRank === 2) { rankLabel = '🥈 2위'; praise = '모두를 미소 짓게 만든 스위트 엔젤'; }
          else if (player.displayRank === 3) { rankLabel = '🥉 3위'; praise = '코트를 채운 풍성한 나눔'; }
          else if (player.displayRank === 4) { rankLabel = '🎖️ 4위'; praise = '언제나 든든한 간식 요정'; }
          else if (player.displayRank === 5) { rankLabel = '🎖️ 5위'; praise = '회원들을 아끼는 따뜻한 마음'; }

          return `
          <div class="leader-card ${rankClass}">
            <span class="leader-rank-badge">${rankLabel}</span>
            <img class="leader-avatar" src="${player.photoBase64}" alt="${player.name}" onerror="this.src='${logoBase64}'">
            <div class="leader-name">${player.name}</div>
            <div class="leader-main-val" style="color: #EC4899;">${player.gPt.toFixed(1)}<span style="font-size: 1rem; color: #94A3B8;">점</span></div>
            <div class="leader-sub-text">간식/음료 찬조 누적 포인트</div>
            <span class="leader-tag">${praise}</span>
          </div>
          `;
        }).join('')}
      </div>
    </section>

    <!-- ========================================================
         네모 박스 ⑧: 코트 위치별(듀스 vs 애드) 승률 통계 (★ 9월 1일 이후)
         ======================================================== -->
    <section class="dashboard-card" id="section-court-split">
      <!-- 우측 상단 로고 -->
      <div class="card-logo-badge">
        <img src="${logoBase64}" alt="한울타리 로고">
        <span>한울타리 테니스</span>
      </div>

      <div class="card-header">
        <div class="card-title-group">
          <span class="card-icon">🎾</span>
          <h2 class="card-title">⑧ 코트 위치별(듀스 vs 애드) 승률 분석 (9월 이후 한정)</h2>
        </div>
        <p class="card-desc">2026년 9월 1일 이후 정밀 기록된 듀스(Deuce) 코트와 애드(Ad) 코트의 포지션별 승률 및 스페셜리스트 비교</p>
      </div>

      <!-- 상단 듀스 vs 애드 전체 비교 -->
      <div class="court-summary-row">
        <div class="court-compare-box deuce">
          <div class="court-box-header">
            <div class="court-box-title deuce"><span>🟦</span> 듀스 코트 (Deuce Court)</div>
            <span style="font-size: 0.85rem; color: #93C5FD; font-weight: 700;">오른쪽 진영 (포핸드 리턴)</span>
          </div>
          <div class="court-rate-val">${overallDeuceRate}%</div>
          <div class="court-sub-detail">총 ${totalSepMatches}경기 중 ${totalSepDeuceWins}승 기록 (승률 50.0% 균형)</div>
        </div>

        <div class="court-compare-box ad">
          <div class="court-box-header">
            <div class="court-box-title ad"><span>🟩</span> 애드 코트 (Ad Court)</div>
            <span style="font-size: 0.85rem; color: #6EE7B7; font-weight: 700;">왼쪽 진영 (게임포인트 결정구)</span>
          </div>
          <div class="court-rate-val">${overallAdRate}%</div>
          <div class="court-sub-detail">총 ${totalSepMatches}경기 중 ${totalSepAdWins}승 기록 (승률 50.0% 균형)</div>
        </div>
      </div>

      <!-- 포지션별 TOP 5 스페셜리스트 테이블 -->
      <div class="court-split-grid">
        <!-- 듀스 스페셜리스트 -->
        <div>
          <h3 style="font-size: 1.25rem; font-weight: 800; color: #60A5FA; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span>🟦</span> 듀스 코트 승률 TOP 5 (8경기 이상)
          </h3>
          <table class="specialist-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>선수</th>
                <th>전적</th>
                <th>승률</th>
              </tr>
            </thead>
            <tbody>
              ${topDeuce.map((m, idx) => `
                <tr>
                  <td style="font-weight: 800; color: #F59E0B;">${idx + 1}위</td>
                  <td>
                    <div class="player-cell-mini">
                      <img src="${m.photoBase64}" alt="${m.name}" onerror="this.src='${logoBase64}'">
                      <strong>${m.name}</strong>
                    </div>
                  </td>
                  <td>${m.sepDeuceWins}승 ${m.sepDeuceMatches - m.sepDeuceWins}패 (${m.sepDeuceMatches}전)</td>
                  <td><strong style="color: #60A5FA; font-size: 1.05rem;">${m.rateStr}%</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 애드 스페셜리스트 -->
        <div>
          <h3 style="font-size: 1.25rem; font-weight: 800; color: #34D399; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span>🟩</span> 애드 코트 승률 TOP 5 (8경기 이상)
          </h3>
          <table class="specialist-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>선수</th>
                <th>전적</th>
                <th>승률</th>
              </tr>
            </thead>
            <tbody>
              ${topAd.map((m, idx) => `
                <tr>
                  <td style="font-weight: 800; color: #F59E0B;">${idx + 1}위</td>
                  <td>
                    <div class="player-cell-mini">
                      <img src="${m.photoBase64}" alt="${m.name}" onerror="this.src='${logoBase64}'">
                      <strong>${m.name}</strong>
                    </div>
                  </td>
                  <td>${m.sepAdWins}승 ${m.sepAdMatches - m.sepAdWins}패 (${m.sepAdMatches}전)</td>
                  <td><strong style="color: #34D399; font-size: 1.05rem;">${m.rateStr}%</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ========================================================
         네모 박스 ⑨: 올해 이용한 코트 장소 & 코트 종류별 개최 통계
         ======================================================== -->
    <section class="dashboard-card" id="section-courts-venues">
      <!-- 우측 상단 로고 -->
      <div class="card-logo-badge">
        <img src="${logoBase64}" alt="한울타리 로고">
        <span>한울타리 테니스</span>
      </div>

      <div class="card-header">
        <div class="card-title-group">
          <span class="card-icon">🏟️</span>
          <h2 class="card-title">⑨ 2026 시즌 이용 코트 장소 & 코트 종류별 통계 (Courts & Venues)</h2>
        </div>
        <p class="card-desc">올 한 해 회원들이 땀 흘리며 열정적인 랠리를 펼친 구장 장소, 바닥 재질(인조잔디 vs 하드), 환경(야외 vs 실내) 전수 분석</p>
      </div>

      <div class="court-analytics-grid">
        <!-- 1. 구장 장소별 개최 현황 -->
        <div class="analytics-panel">
          <h3 class="analytics-title">
            <span>📍</span> <span>구장 장소별 개최 순위 (${sortedVenues.length}개 장소)</span>
          </h3>
          <div class="venue-list">
            ${sortedVenues.map((v, idx) => {
              const barWidth = Math.max(Math.round((v.count / totalSessionsCount) * 100), 5);
              let medalIcon = '🎾';
              if (idx === 0) medalIcon = '🥇';
              else if (idx === 1) medalIcon = '🥈';
              else if (idx === 2) medalIcon = '🥉';

              return `
              <div class="venue-item">
                <div class="venue-item-top">
                  <span class="venue-name">
                    <span>${medalIcon}</span>
                    <span>${v.name}</span>
                  </span>
                  <span class="venue-count-badge">${v.count}회 <span style="font-size: 0.8rem; color: #94A3B8;">(${v.rate}%)</span></span>
                </div>
                <div class="venue-bar-track">
                  <div class="venue-bar-fill" style="width: ${barWidth}%;"></div>
                </div>
              </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2. 코트 바닥 재질별 분포 -->
        <div class="analytics-panel">
          <h3 class="analytics-title">
            <span>🌱</span> <span>코트 바닥 재질별 분포</span>
          </h3>
          <div class="ratio-breakdown-card">
            <!-- 인조잔디 -->
            <div class="ratio-stat-row">
              <div class="ratio-stat-header">
                <span class="ratio-label"><span>🌿</span> 인조잔디 (Turf)</span>
                <span class="ratio-val" style="color: #34D399;">${turfCount}회 <span style="font-size: 0.95rem; color: #94A3B8;">(${turfRate}%)</span></span>
              </div>
              <div class="venue-bar-track">
                <div class="venue-bar-fill" style="width: ${turfRate}%; background: linear-gradient(90deg, #10B981 0%, #34D399 100%);"></div>
              </div>
              <p class="ratio-desc">회원들의 관절 및 무릎 부담을 최소화하는 한울타리 최다 이용 주력 코트 재질</p>
            </div>

            <!-- 하드코트 -->
            <div class="ratio-stat-row">
              <div class="ratio-stat-header">
                <span class="ratio-label"><span>🟦</span> 하드코트 (Hard)</span>
                <span class="ratio-val" style="color: #60A5FA;">${hardCount}회 <span style="font-size: 0.95rem; color: #94A3B8;">(${hardRate}%)</span></span>
              </div>
              <div class="venue-bar-track">
                <div class="venue-bar-fill" style="width: ${hardRate}%; background: linear-gradient(90deg, #2563EB 0%, #60A5FA 100%);"></div>
              </div>
              <p class="ratio-desc">KATA, KATO 등 전국 테니스 대회 실전 감각 적응 및 스피디한 바운드 랠리 연습 구장</p>
            </div>
          </div>
        </div>

        <!-- 3. 코트 환경별 분포 (야외 vs 실내) -->
        <div class="analytics-panel">
          <h3 class="analytics-title">
            <span>🌤️</span> <span>코트 환경별 분포</span>
          </h3>
          <div class="ratio-breakdown-card">
            <!-- 야외 코트 -->
            <div class="ratio-stat-row">
              <div class="ratio-stat-header">
                <span class="ratio-label"><span>☀️</span> 야외 코트 (Outdoor)</span>
                <span class="ratio-val" style="color: #F59E0B;">${outdoorCount}회 <span style="font-size: 0.95rem; color: #94A3B8;">(${outdoorRate}%)</span></span>
              </div>
              <div class="venue-bar-track">
                <div class="venue-bar-fill" style="width: ${outdoorRate}%; background: linear-gradient(90deg, #D97706 0%, #F59E0B 100%);"></div>
              </div>
              <p class="ratio-desc">맑은 공기와 푸른 하늘 아래서 사계절 내내 활기차게 즐긴 야외 테니스 페스티벌</p>
            </div>

            <!-- 실내 코트 -->
            <div class="ratio-stat-row">
              <div class="ratio-stat-header">
                <span class="ratio-label"><span>🏢</span> 실내 코트 (Indoor)</span>
                <span class="ratio-val" style="color: #A78BFA;">${indoorCount}회 <span style="font-size: 0.95rem; color: #94A3B8;">(${indoorRate}%)</span></span>
              </div>
              <div class="venue-bar-track">
                <div class="venue-bar-fill" style="width: ${indoorRate}%; background: linear-gradient(90deg, #7C3AED 0%, #A78BFA 100%);"></div>
              </div>
              <p class="ratio-desc">혹서기 및 날씨 영향을 받지 않고 쾌적하게 진행된 실내 특별 대관 리그</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ========================================================
         송년회 피날레 & 축하 감사 배너
         ======================================================== -->
    <section class="dashboard-card" id="section-finale">
      <!-- 우측 상단 로고 -->
      <div class="card-logo-badge">
        <img src="${logoBase64}" alt="한울타리 로고">
        <span>한울타리 테니스</span>
      </div>

      <div class="card-header">
        <div class="card-title-group">
          <span class="card-icon">🎉</span>
          <h2 class="card-title">2026 한울타리 송년의 밤 피날레 & 감사 메시지</h2>
        </div>
        <p class="card-desc">라켓 하나로 울고 웃었던 소중한 2026년 1년, 함께해 주셔서 진심으로 감사합니다!</p>
      </div>

      <div class="party-banner">
        <div class="party-title">"코트 위에서 빛난 112번의 감동, 2027년에도 함께합니다!"</div>
        <p class="party-text">
          2026년 봄의 첫 서브부터 초겨울의 마지막 랠리까지 총 <strong>${totalSessionsCount}회</strong>의 열정 넘치는 리그를 함께 만들어 주셨습니다.<br>
          치열한 4승 챔피언 경쟁을 펼친 <strong>정종원, 박성규, 안태영, 이동주, 정정태, 김종혁</strong> 회원을 비롯해 한울타리를 빛내주신 모든 회원님들께 뜨거운 박수를 보냅니다!<br>
          다치지 않고 건강하게, 2027년에도 언제나 즐거운 테니스로 함께해요!
        </p>
        <button class="celebrate-btn" onclick="triggerConfetti()">
          <span>🎊</span> <span>다함께 한울타리 축하 박수! (폭죽 터뜨리기)</span>
        </button>
      </div>
    </section>

    <footer class="footer-note">
      <p>HANULTARI TENNIS CLUB ANNUAL REPORT 2026 • GENERATED BY AI AGENT FOR YEAR-END PARTY</p>
    </footer>
  </div>

  <script>
    // 꽃가루 축하 파티클 효과
    function triggerConfetti() {
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 140,
          spread: 90,
          origin: { y: 0.6 }
        });
        setTimeout(() => {
          confetti({
            particleCount: 90,
            angle: 60,
            spread: 60,
            origin: { x: 0 }
          });
          confetti({
            particleCount: 90,
            angle: 120,
            spread: 60,
            origin: { x: 1 }
          });
        }, 250);
      }
    }

    // 전체화면 토글 (F11)
    function toggleFullScreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          alert('전체화면 모드를 시작할 수 없습니다: ' + err.message);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    }

    // 페이지 진입 시 축하 팡파레 효과 1회 자동 실행
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(triggerConfetti, 800);
    });
  </script>
</body>
</html>`;

  const outputPath = path.resolve(process.cwd(), '../docs/hanultari_2026_stats.html');
  // Ensure docs dir exists
  const docsDir = path.dirname(outputPath);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, htmlContent, 'utf-8');
  console.log('Report successfully generated at:', outputPath);
  process.exit(0);
}

buildReport().catch(err => {
  console.error('Error building report:', err);
  process.exit(1);
});
