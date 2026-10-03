import { useState, useMemo, useEffect } from 'react';
import { Utensils } from 'lucide-react';
import combinations from '../data/combinations.json';
import { type Member } from '../App';

interface MealCalculatorProps {
  allMembers: Member[];
  savedSessions: Record<string, any>;
}

const charToIndex = (c: string) => {
  if (c >= '1' && c <= '9') return parseInt(c) - 1;
  return c.charCodeAt(0) - 'A'.charCodeAt(0) + 9;
};

export default function MealCalculator({ 
  allMembers, 
  savedSessions
}: MealCalculatorProps) {
  const [selectedSessions, setSelectedSessions] = useState<string[]>(() => {
    const saved = localStorage.getItem('meal_selectedSessions');
    if (saved) {
      const parsed = JSON.parse(saved).filter((id: string) => id !== 'current');
      if (parsed.length > 0) return parsed;
    }
    const newest = Object.keys(savedSessions).sort((a, b) => b.localeCompare(a)).slice(0, 1);
    return newest;
  });
  const [eatingMembers, setEatingMembers] = useState<string[]>(() => {
    const saved = localStorage.getItem('meal_eatingMembers');
    return saved ? JSON.parse(saved) : [];
  });
  const [totalCost, setTotalCost] = useState<string>(() => {
    return localStorage.getItem('meal_totalCost') || '';
  });
  const [coffeeCost, setCoffeeCost] = useState<string>(() => {
    return localStorage.getItem('meal_coffeeCost') || '';
  });
  const [costGap, setCostGap] = useState<number>(() => {
    const saved = localStorage.getItem('meal_costGap');
    return saved ? JSON.parse(saved) : 1000;
  });
  
  // 최초 한 번만 디폴트로 모두 식사한다고 설정하기 위한 플래그
  const [initializedEaters, setInitializedEaters] = useState(() => {
    return localStorage.getItem('meal_initializedEaters') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('meal_selectedSessions', JSON.stringify(selectedSessions));
  }, [selectedSessions]);

  useEffect(() => {
    localStorage.setItem('meal_eatingMembers', JSON.stringify(eatingMembers));
  }, [eatingMembers]);

  useEffect(() => {
    localStorage.setItem('meal_totalCost', totalCost);
  }, [totalCost]);

  useEffect(() => {
    localStorage.setItem('meal_coffeeCost', coffeeCost);
  }, [coffeeCost]);

  useEffect(() => {
    localStorage.setItem('meal_costGap', JSON.stringify(costGap));
  }, [costGap]);

  useEffect(() => {
    localStorage.setItem('meal_initializedEaters', String(initializedEaters));
  }, [initializedEaters]);



  const allAvailableSessions = useMemo(() => {
    const list = Object.entries(savedSessions).map(([id, s]) => ({
      id,
      date: s.date || '날짜없음',
      label: `저장된 리그: ${s.date || id} (${(s.participatingMembers||[]).filter((m:any)=>m).length}인)`
    })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
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

      selectedSessions.forEach(id => {
        if (savedSessions[id]) processSession(savedSessions[id]);
      });

    const sortedStats = Object.values(playerStatsMap).filter(p => p.matches > 0).sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.ptsDiff !== b.ptsDiff) return b.ptsDiff - a.ptsDiff;
      if (a.ptsFor !== b.ptsFor) return b.ptsFor - a.ptsFor;
      return b.age - a.age;
    });

    return sortedStats;
  }, [selectedSessions, savedSessions, allMembers]);

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
    
    const C_total = C + coffee * Math.max(0, N - 1);
    
    if (N === 1) {
      return {
        results: eaters.map(p => ({ ...p, mealRank: 1, pay: 0 })),
        gap: C_total,
        base: 0
      };
    }

    if (N === 2) {
      return {
        results: eaters.map((p, idx) => ({
          ...p,
          mealRank: idx + 1,
          pay: idx === 0 ? 0 : C_total
        })),
        gap: 0,
        base: C_total
      };
    }

    const payingCount = N - 1; // 2위 ~ N위 (1위는 면제)
    const avg = C_total / payingCount;

    // 1. 2위 기본 타깃 결정 (사용자 요구: 10,000 ~ 12,000원 선)
    let p2Target = 11000;
    if (avg <= 10000) {
      p2Target = Math.max(1000, Math.round((avg * 0.5) / 1000) * 1000);
    } else if (avg <= 15000) {
      p2Target = 10000;
    } else if (avg <= 20000) {
      p2Target = 11000;
    } else {
      p2Target = 12000;
    }

    // 2. 꼴찌 상한선 (사용자 요구: 최대 25,000원이 넘지 않게)
    // 인당 평균 자체가 23,000원을 초과하는 고액 식비 시 유연하게 자동 상한 보정
    const maxLast = avg <= 23000 ? 25000 : Math.max(25000, Math.round((avg + 3000) / 1000) * 1000);

    // 3. 목표 꼴찌 금액 설정 (선형 기대치와 maxLast 중 최솟값)
    const idealLast = Math.min(maxLast, Math.max(p2Target + 2000, Math.round((2 * avg - p2Target) / 1000) * 1000));

    // 4. 순위별 초기 금액 계산 (선형 보간)
    const rawPays: number[] = [];
    for (let i = 0; i < payingCount; i++) {
      const ratio = payingCount > 1 ? i / (payingCount - 1) : 0;
      const val = p2Target + ratio * (idealLast - p2Target);
      rawPays.push(val);
    }

    // 1,000원 단위 반올림
    let pays = rawPays.map(p => Math.round(p / 1000) * 1000);

    // 사용자 설정 순위별 갭(costGap) 반영 (순위 간 최소 간격 확보)
    if (costGap > 1000) {
      for (let i = 1; i < payingCount; i++) {
        if (pays[i] < pays[i - 1] + costGap) {
          pays[i] = pays[i - 1] + costGap;
        }
      }
    }

    // 꼴찌 상한(25,000원) 및 단조 증가(역전 방지) 보정
    for (let i = 0; i < payingCount; i++) {
      if (pays[i] > maxLast) pays[i] = maxLast;
    }
    for (let i = payingCount - 2; i >= 0; i--) {
      if (pays[i] > pays[i + 1]) pays[i] = pays[i + 1];
    }

    // 2위 금액 가이드 (avg > 12000일 때 10,000 ~ 12,000원 유지)
    if (avg > 12000) {
      pays[0] = Math.min(12000, Math.max(10000, pays[0]));
    }

    // 5. 총액 100% 일치 보정 (diff를 1,000원씩 분배)
    let currentSum = pays.reduce((acc, curr) => acc + curr, 0);
    let diff = C_total - currentSum;

    let maxLoops = 100;
    while (diff !== 0 && maxLoops > 0) {
      maxLoops--;
      if (diff > 0) {
        // 총액 부족: 꼴찌 쪽부터(단, maxLast 안 넘게) 1,000원씩 보충
        let added = false;
        for (let i = payingCount - 1; i > 0; i--) {
          if (pays[i] + 1000 <= maxLast) {
            if (i === payingCount - 1 || pays[i] + 1000 <= pays[i + 1]) {
              pays[i] += 1000;
              diff -= 1000;
              added = true;
              if (diff === 0) break;
            }
          }
        }
        if (!added) {
          // 꼴찌 쪽이 다 찼으면 2위~중간 순위 순차 증가 (2위 12,000원 이하 우선)
          for (let i = 0; i < payingCount; i++) {
            if (i === 0 && pays[0] >= 12000 && avg <= 22000) continue;
            if (i === payingCount - 1 && pays[i] >= maxLast) continue;
            pays[i] += 1000;
            diff -= 1000;
            if (diff === 0) break;
          }
        }
      } else {
        // 총액 초과: 꼴찌 쪽부터 1,000원씩 차감 (앞 순위보다 낮아지지 않게)
        for (let i = payingCount - 1; i > 0; i--) {
          if (pays[i] - 1000 >= pays[i - 1]) {
            pays[i] -= 1000;
            diff += 1000;
            if (diff === 0) break;
          }
        }
      }
    }

    // 최종 결과 매핑: 1위 = 0원, 2위~N위 = pays
    const results = eaters.map((p, idx) => {
      const mealRank = idx + 1;
      const pay = mealRank === 1 ? 0 : pays[idx - 1];
      return {
        ...p,
        mealRank,
        pay
      };
    });

    const finalSum = results.reduce((acc, curr) => acc + curr.pay, 0);
    const gap = C_total - finalSum;

    return {
      results,
      gap,
      base: p2Target
    };
  }, [combinedRankings, eatingMembers, totalCost, costGap, coffeeCost]);

  return (
    <div className="content-card">
      <h2 style={{ color: '#1E3A8A', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Utensils size={24} /> 밥값 정산
      </h2>
      <p style={{ color: '#6B7280', fontSize: '0.9rem', marginBottom: '20px' }}>
        경기가 끝난 후 식사 비용을 등수에 따라 차등 계산합니다. 1등은 식사비가 전액 면제(0원)되며, 2등은 1만~1.2만원 선으로 완화하고 꼴찌는 최대 2.5만원 상한을 적용합니다. 순위별 갭(Gap)을 조절하여 세부 분담금을 조정할 수 있습니다.
      </p>

      {/* 세션 선택 */}
      <div style={{ marginBottom: '20px', background: '#F9FAFB', padding: '15px', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '10px', color: '#374151' }}>계산에 포함할 리그 선택</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

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
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', overflow: 'hidden' }}>
            <div style={{ flex: '1 1 200px', background: '#EFF6FF', padding: '10px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: '#1E3A8A', fontWeight: 'bold', marginBottom: '10px' }}>
                총 식비 입력 (원)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button onClick={() => setTotalCost(String(Math.max(0, (parseInt(totalCost) || 0) - 1000)))} style={{ padding: '10px 10px', fontSize: '1.2rem', fontWeight: 'bold', background: '#DBEAFE', border: 'none', borderRadius: '6px', color: '#1E3A8A', cursor: 'pointer' }}>-</button>
                <input 
                  type="number" 
                  step="1000"
                  placeholder="예: 120000"
                  value={totalCost}
                  onChange={e => setTotalCost(e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #93C5FD', fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center' }}
                />
                <button onClick={() => setTotalCost(String((parseInt(totalCost) || 0) + 1000))} style={{ padding: '10px 10px', fontSize: '1.2rem', fontWeight: 'bold', background: '#DBEAFE', border: 'none', borderRadius: '6px', color: '#1E3A8A', cursor: 'pointer' }}>+</button>
              </div>
            </div>
            
            <div style={{ flex: '1 1 200px', background: '#F5F3FF', padding: '10px', borderRadius: '8px', border: '1px solid #DDD6FE' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: '#4C1D95', fontWeight: 'bold', marginBottom: '10px' }}>
                순위별 갭(Gap) 설정 (원)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button onClick={() => setCostGap(Math.max(0, costGap - 1000))} style={{ padding: '10px 10px', fontSize: '1.2rem', fontWeight: 'bold', background: '#EDE9FE', border: 'none', borderRadius: '6px', color: '#4C1D95', cursor: 'pointer' }}>-</button>
                <input 
                  type="number" 
                  step="1000"
                  placeholder="예: 1000"
                  value={costGap}
                  onChange={e => setCostGap(parseInt(e.target.value) || 0)}
                  style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #C4B5FD', fontSize: '1.2rem', fontWeight: 'bold', color: '#4C1D95', textAlign: 'center' }}
                />
                <button onClick={() => setCostGap(costGap + 1000)} style={{ padding: '10px 10px', fontSize: '1.2rem', fontWeight: 'bold', background: '#EDE9FE', border: 'none', borderRadius: '6px', color: '#4C1D95', cursor: 'pointer' }}>+</button>
              </div>
            </div>
            
            <div style={{ flex: '1 1 200px', background: '#FEF3C7', padding: '10px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: '#92400E', fontWeight: 'bold', marginBottom: '10px' }}>
                인당 커피값 추가 (원)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button onClick={() => setCoffeeCost(String(Math.max(0, (parseInt(coffeeCost) || 0) - 1000)))} style={{ padding: '10px 10px', fontSize: '1.2rem', fontWeight: 'bold', background: '#FEF3C7', border: 'none', borderRadius: '6px', color: '#92400E', cursor: 'pointer' }}>-</button>
                <input 
                  type="number" 
                  step="1000"
                  placeholder="예: 3000"
                  value={coffeeCost}
                  onChange={e => setCoffeeCost(e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '10px', borderRadius: '6px', border: '1px solid #FCD34D', fontSize: '1.2rem', fontWeight: 'bold', color: '#92400E', textAlign: 'center' }}
                />
                <button onClick={() => setCoffeeCost(String((parseInt(coffeeCost) || 0) + 1000))} style={{ padding: '10px 10px', fontSize: '1.2rem', fontWeight: 'bold', background: '#FEF3C7', border: 'none', borderRadius: '6px', color: '#92400E', cursor: 'pointer' }}>+</button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '10px', color: '#374151' }}>식사 인원 선택 ({resultTable.results.length}명)</h3>
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
                <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#93C5FD' }}>총 {eatingMembers.length}명 식사 (1위 무료 · 2위 1만~1.2만 선 · 꼴찌 최대 2.5만 상한)</p>
              </div>
              <table style={{ margin: 0 }}>
                <thead>
                  <tr style={{ background: '#F3F4F6', fontSize: '0.9rem' }}>
                    <th style={{ width: '45px', textAlign: 'center', padding: '8px 4px' }}>순위</th>
                    <th style={{ padding: '8px 4px' }}>선수</th>
                    <th style={{ padding: '8px 4px' }}>성적</th>
                    <th style={{ textAlign: 'right', padding: '8px 4px' }}>납부액</th>
                  </tr>
                </thead>
                <tbody>
                  {resultTable.results.map((r) => (
                    <tr key={r.id} style={{ background: r.pay === 0 ? '#FEF3C7' : 'white' }}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: r.mealRank === 1 ? '#D97706' : '#4B5563', padding: '10px 4px', fontSize: '0.95rem' }}>
                        {r.mealRank}위
                      </td>
                      <td style={{ padding: '10px 4px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1F2937' }}>{r.name}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#6B7280', padding: '10px 4px', whiteSpace: 'nowrap' }}>
                        {r.wins}승{r.losses}패 ({r.ptsDiff > 0 ? '+' : ''}{r.ptsDiff})
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.05rem', color: r.pay === 0 ? '#10B981' : '#EF4444', padding: '10px 4px', whiteSpace: 'nowrap' }}>
                        {r.pay === 0 ? '면제 🎉' : `${r.pay.toLocaleString()}원`}
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
