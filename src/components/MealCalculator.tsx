import { useState, useMemo } from 'react';
import combinations from '../data/combinations.json';
import { type Member, ProfileImage } from '../App';

interface MealCalculatorProps {
  allMembers: Member[];
  savedSessions: Record<string, any>;
  currentSessionId: string | null;
  participatingMembers: (Member | null)[];
  matchScores: Record<string, any>;
  matchOverrides: Record<string, any>;
  bracketOption: string;
}

const charToIndex = (c: string) => {
  if (c >= '1' && c <= '9') return parseInt(c) - 1;
  return c.charCodeAt(0) - 'A'.charCodeAt(0) + 9;
};

export default function MealCalculator({ 
  allMembers, 
  savedSessions, 
  participatingMembers,
  matchScores,
  matchOverrides,
  bracketOption
}: MealCalculatorProps) {
  const [selectedSessions, setSelectedSessions] = useState<string[]>(['current']);
  const [eatingMembers, setEatingMembers] = useState<string[]>([]); // id array
  const [totalCost, setTotalCost] = useState<string>('');
  const [coffeeCost, setCoffeeCost] = useState<string>('');
  const [costGap, setCostGap] = useState<number>(1000); // 갭 설정 기본값 1000원
  
  // 최초 한 번만 디폴트로 모두 식사한다고 설정하기 위한 플래그
  const [initializedEaters, setInitializedEaters] = useState(false);

  const currentSessionData = useMemo(() => {
    return {
      date: new Date().toISOString().split('T')[0],
      participatingMembers,
      bracketOption,
      matchScores,
      matchOverrides
    };
  }, [participatingMembers, bracketOption, matchScores, matchOverrides]);

  const allAvailableSessions = useMemo(() => {
    const list = Object.entries(savedSessions).map(([id, s]) => ({
      id,
      date: s.date || '날짜없음',
      label: `저장된 리그: ${s.date || id} (${(s.participatingMembers||[]).filter((m:any)=>m).length}인)`
    })).sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [savedSessions]);

  const handleSessionToggle = (id: string) => {
    if (selectedSessions.includes(id)) {
      setSelectedSessions(selectedSessions.filter(sid => sid !== id));
    } else {
      setSelectedSessions([...selectedSessions, id]);
    }
  };

  const combinedRankings = useMemo(() => {
    const playerStatsMap: Record<string, any> = {};

    const initPlayer = (member: any) => {
      if (member && !playerStatsMap[member.id]) {
        playerStatsMap[member.id] = {
          id: member.id,
          name: member.name,
          matches: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          ptsFor: 0,
          ptsAgainst: 0,
          ptsDiff: 0,
          age: parseInt(member.age as string) || 0,
          memberObj: member
        };
      }
    };

    const processSession = (session: any) => {
      const pMembers = session.participatingMembers || [];
      const mScores = session.matchScores || {};
      const mOverrides = session.matchOverrides || {};
      const bOption = session.bracketOption || '5';

      pMembers.forEach(initPlayer);
      Object.values(mOverrides).forEach((overrides: any) => {
        Object.values(overrides).forEach((memberId: any) => {
          const member = allMembers.find(m => m.id === memberId);
          if (member) initPlayer(member);
        });
      });

      const currentCombinations = (combinations as Record<string, string[]>)[bOption] || [];
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
              
              const p1 = mOverrides[matchId]?.[0] ? allMembers.find(m => m.id === mOverrides[matchId][0]) : pMembers[charToIndex(sub[0])];
              const p2 = mOverrides[matchId]?.[1] ? allMembers.find(m => m.id === mOverrides[matchId][1]) : pMembers[charToIndex(sub[1])];
              const p3 = mOverrides[matchId]?.[2] ? allMembers.find(m => m.id === mOverrides[matchId][2]) : pMembers[charToIndex(sub[2])];
              const p4 = mOverrides[matchId]?.[3] ? allMembers.find(m => m.id === mOverrides[matchId][3]) : pMembers[charToIndex(sub[3])];
              
              const t1Players = [p1, p2];
              const t2Players = [p3, p4];
              
              t1Players.forEach(pObj => {
                const p = pObj ? playerStatsMap[pObj.id] : null;
                if (p) {
                  p.matches += 1;
                  p.ptsFor += s1;
                  p.ptsAgainst += s2;
                  p.ptsDiff = p.ptsFor - p.ptsAgainst;
                  if (s1 > s2) p.wins += 1;
                  else if (s1 < s2) p.losses += 1;
                  else p.ties += 1;
                }
              });

              t2Players.forEach(pObj => {
                const p = pObj ? playerStatsMap[pObj.id] : null;
                if (p) {
                  p.matches += 1;
                  p.ptsFor += s2;
                  p.ptsAgainst += s1;
                  p.ptsDiff = p.ptsFor - p.ptsAgainst;
                  if (s2 > s1) p.wins += 1;
                  else if (s2 < s1) p.losses += 1;
                  else p.ties += 1;
                }
              });
            }
            matchSubIdx++;
          }
        }
      });
    };

    if (selectedSessions.includes('current')) {
      processSession(currentSessionData);
    }
    selectedSessions.forEach(id => {
      if (id !== 'current' && savedSessions[id]) processSession(savedSessions[id]);
    });

    const sortedStats = Object.values(playerStatsMap).filter(p => p.matches > 0).sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.ptsDiff !== b.ptsDiff) return b.ptsDiff - a.ptsDiff;
      if (a.ptsFor !== b.ptsFor) return b.ptsFor - a.ptsFor;
      return b.age - a.age;
    });

    return sortedStats;
  }, [selectedSessions, currentSessionData, savedSessions, allMembers]);

  // 첫 렌더링 시, 또는 세션이 변경되어 참가자가 바뀌었을 때 먹는 사람 목록 초기화
  if (!initializedEaters && combinedRankings.length > 0) {
    setEatingMembers(combinedRankings.map(p => p.id));
    setInitializedEaters(true);
  }

  const toggleEating = (id: string) => {
    if (eatingMembers.includes(id)) {
      setEatingMembers(eatingMembers.filter(eid => eid !== id));
    } else {
      setEatingMembers([...eatingMembers, id]);
    }
  };

  const resultTable = useMemo(() => {
    // 밥 먹는 사람들만 추출하여 순위대로 정렬
    const eaters = combinedRankings.filter(p => eatingMembers.includes(p.id));
    const N = eaters.length;
    const C = parseInt(totalCost) || 0;
    const coffee = parseInt(coffeeCost) || 0;
    
    if (N === 0) return { results: [], gap: 0, base: 0 };
    
    // N명이 먹을 때, 1등은 0원. 나머지 N-1명이 낸다.
    // offsets = mealCosts[N][rank] (rank: 1 to N)
    // Base = (C - sum(offsets)) / (N-1)
    
    // 수학적 공식: 각 순위(r)의 오프셋 = (r - (N+1)/2) * costGap
    // N-1명(2등~N등)의 오프셋 총합 = ((N-1) / 2) * costGap
    const sumOffsets = ((N - 1) / 2) * costGap;
    
    let base = 0;
    if (N > 1) {
      // 정확한 기준 금액 계산 (여기서는 절사하지 않음)
      base = (C - sumOffsets) / (N - 1);
    }
    
    const results = eaters.map((p, idx) => {
      const mealRank = idx + 1;
      let pay = 0;
      if (mealRank === 1) {
        pay = 0;
      } else {
        const offset = (mealRank - (N + 1) / 2) * costGap;
        // 부족하지 않고 남게 걷기 위해 최종 금액에서 1000원 단위 올림(Math.ceil) 처리
        pay = Math.ceil((base + offset + coffee) / 1000) * 1000;
      }
      
      // 혹시라도 pay가 음수면 0으로 처리
      if (pay < 0) pay = 0;
      
      return {
        ...p,
        mealRank,
        pay
      };
    });

    const sumPay = results.reduce((acc, curr) => acc + curr.pay, 0);
    const expectedTotal = C + coffee * (N - 1);
    const gap = expectedTotal - sumPay;

    // 만약 gap이 발생하면? (차액 발생 시 2등에게 얹거나 n빵)
    // 1000원 단위 절사로 인해 보통 양수의 gap이 발생함.
    // 여기서는 가장 많이 내야하는(혹은 2등) 사람에게 더하거나, 결과를 그대로 보여주고 gap을 표기
    
    return {
      results,
      gap,
      base
    };
  }, [combinedRankings, eatingMembers, totalCost, costGap, coffeeCost]);

  return (
    <div className="content-card">
      <h2 style={{ color: '#1E3A8A', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px' }}>
        7. 밥값 정산
      </h2>
      <p style={{ color: '#6B7280', fontSize: '0.9rem', marginBottom: '20px' }}>
        경기가 끝난 후 식사 비용을 등수에 따라 차등 계산합니다. 1등은 식사비가 면제되며, 식사하지 않은 인원은 제외할 수 있습니다. 계산할 리그(세션)를 복수 선택하여 합산할 수 있습니다.
      </p>

      {/* 세션 선택 */}
      <div style={{ marginBottom: '20px', background: '#F9FAFB', padding: '15px', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '10px', color: '#374151' }}>계산에 포함할 리그 선택</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={selectedSessions.includes('current')} 
              onChange={() => handleSessionToggle('current')}
            />
            <span style={{ fontWeight: 'bold', color: '#2563EB' }}>현재 진행/입력 중인 리그 (미저장 데이터 포함)</span>
          </label>
          
          {allAvailableSessions.map(s => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={selectedSessions.includes(s.id)} 
                onChange={() => handleSessionToggle(s.id)}
              />
              <span style={{ color: '#4B5563' }}>{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 밥값 및 갭 입력 */}
      {combinedRankings.length > 0 ? (
        <>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ flex: '1 1 200px', background: '#EFF6FF', padding: '15px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: '#1E3A8A', fontWeight: 'bold', marginBottom: '10px' }}>
                총 식비 입력 (원)
              </label>
              <input 
                type="number" 
                placeholder="예: 120000"
                value={totalCost}
                onChange={e => setTotalCost(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #93C5FD', fontSize: '1.2rem', fontWeight: 'bold' }}
              />
            </div>
            
            <div style={{ flex: '1 1 200px', background: '#F5F3FF', padding: '15px', borderRadius: '8px', border: '1px solid #DDD6FE' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: '#4C1D95', fontWeight: 'bold', marginBottom: '10px' }}>
                순위별 갭(Gap) 설정 (원)
              </label>
              <input 
                type="number" 
                placeholder="예: 1000"
                value={costGap}
                onChange={e => setCostGap(parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #C4B5FD', fontSize: '1.2rem', fontWeight: 'bold', color: '#4C1D95' }}
              />
            </div>
            
            <div style={{ flex: '1 1 200px', background: '#FEF3C7', padding: '15px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: '#92400E', fontWeight: 'bold', marginBottom: '10px' }}>
                인당 커피값 추가 (원)
              </label>
              <input 
                type="number" 
                placeholder="예: 3000"
                value={coffeeCost}
                onChange={e => setCoffeeCost(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #FCD34D', fontSize: '1.2rem', fontWeight: 'bold', color: '#92400E' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '10px', color: '#374151' }}>식사 인원 선택 ({eatingMembers.length}명)</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {combinedRankings.map(p => {
                const isEating = eatingMembers.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleEating(p.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '20px',
                      border: `1px solid ${isEating ? '#10B981' : '#D1D5DB'}`,
                      background: isEating ? '#D1FAE5' : '#F3F4F6',
                      color: isEating ? '#065F46' : '#6B7280',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isEating ? '#10B981' : '#9CA3AF' }} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 결과 테이블 */}
          {(!Array.isArray(resultTable) && resultTable.results.length > 0) && (
            <div className="table-wrapper" style={{ border: '2px solid #1E3A8A', borderRadius: '8px', overflowX: 'auto' }}>
              <div style={{ background: '#1E3A8A', color: 'white', padding: '15px', textAlign: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>밥값 정산 결과</h3>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#93C5FD' }}>총 {eatingMembers.length}명 식사 (1위 무료)</p>
              </div>
              <table style={{ margin: 0 }}>
                <thead>
                  <tr style={{ background: '#F3F4F6' }}>
                    <th style={{ width: '60px', textAlign: 'center' }}>식사순위</th>
                    <th>선수</th>
                    <th>경기성적</th>
                    <th style={{ textAlign: 'right' }}>납부 금액</th>
                  </tr>
                </thead>
                <tbody>
                  {resultTable.results.map((r) => (
                    <tr key={r.id} style={{ background: r.pay === 0 ? '#FEF3C7' : 'white' }}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: r.mealRank === 1 ? '#D97706' : '#4B5563' }}>
                        {r.mealRank}위
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <ProfileImage member={r.memberObj} size={35} />
                          <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1F2937' }}>{r.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#6B7280' }}>
                        {r.wins}승 {r.losses}패 (득실 {r.ptsDiff > 0 ? `+${r.ptsDiff}` : r.ptsDiff})
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: r.pay === 0 ? '#10B981' : '#EF4444' }}>
                        {r.pay === 0 ? '면제 🥳' : `${r.pay.toLocaleString()}원`}
                      </td>
                    </tr>
                  ))}
                  {resultTable.gap > 0 && (
                    <tr style={{ background: '#FEE2E2' }}>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold', color: '#991B1B' }}>식비부족(절사차액)</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#991B1B' }}>{resultTable.gap.toLocaleString()}원</td>
                    </tr>
                  )}
                  {resultTable.gap < 0 && (
                    <tr style={{ background: '#FEF3C7' }}>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold', color: '#D97706' }}>식비초과(절사차액)</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#D97706' }}>{Math.abs(resultTable.gap).toLocaleString()}원</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', background: '#F3F4F6', borderRadius: '8px', color: '#6B7280' }}>
          선택된 리그에 참가자가 없거나 진행된 경기가 없습니다.
        </div>
      )}
    </div>
  );
}
