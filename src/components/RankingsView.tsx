import { useMemo, useRef } from 'react';
import combinations from '../data/combinations.json';
import html2canvas from 'html2canvas';
import { Camera } from 'lucide-react';

const charToIndex = (c: string) => {
  if (c >= '1' && c <= '9') return parseInt(c) - 1;
  return c.charCodeAt(0) - 'A'.charCodeAt(0) + 9;
};

interface RankingsViewProps {
  allMembers: any[];
  participatingMembers: any[];
  bracketOption: string;
  matchScores: Record<string, { t1: string, t2: string }>;
  matchOverrides: Record<string, Record<number, string>>;
  courtName: string;
  courtType: string;
  courtEnv: string;
}

interface PlayerStats {
  id: string;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  ties: number;
  ptsFor: number;
  ptsAgainst: number;
  ptsDiff: number;
  age: number;
  rank: number;
}

export default function RankingsView({ allMembers, participatingMembers, bracketOption, matchScores, matchOverrides, courtName, courtType, courtEnv }: RankingsViewProps) {
  const tableRef = useRef<HTMLDivElement>(null);

  const handleCapture = async () => {
    if (!tableRef.current) return;
    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      
      const today = new Date();
      const dateStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      link.download = `한울타리_경기결과_${dateStr}.png`;
      link.click();
    } catch (err) {
      console.error('Failed to capture image', err);
      alert('이미지 저장에 실패했습니다.');
    }
  };
  
  const stats = useMemo(() => {
    // 1. 기초 스탯 초기화 (참가 멤버 및 오버라이드된 멤버 모두 포함)
    const playerStatsMap: Record<string, PlayerStats> = {};
    
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
          rank: 0,
        };
      }
    };

    participatingMembers.forEach(initPlayer);
    
    // 오버라이드된 멤버도 초기화
    Object.values(matchOverrides).forEach(overrides => {
      Object.values(overrides).forEach(memberId => {
        const member = allMembers.find(m => m.id === memberId);
        if (member) initPlayer(member);
      });
    });

    // 2. 점수 합산
    const currentCombinations = (combinations as Record<string, string[]>)[bracketOption] || [];
    currentCombinations.forEach((matchStr, matchIdx) => {
      let matchSubIdx = 0;
      for (let i = 0; i < matchStr.length; i += 4) {
        const sub = matchStr.slice(i, i + 4);
        if (sub.length === 4) {
          const matchId = `${matchIdx}-${matchSubIdx}`;
          const score = matchScores[matchId];
          
          if (score && score.t1 !== '' && score.t2 !== '') {
            const s1 = parseInt(score.t1) || 0;
            const s2 = parseInt(score.t2) || 0;
            
            const p1 = matchOverrides[matchId]?.[0] ? allMembers.find(m => m.id === matchOverrides[matchId][0]) : participatingMembers[charToIndex(sub[0])];
            const p2 = matchOverrides[matchId]?.[1] ? allMembers.find(m => m.id === matchOverrides[matchId][1]) : participatingMembers[charToIndex(sub[1])];
            const p3 = matchOverrides[matchId]?.[2] ? allMembers.find(m => m.id === matchOverrides[matchId][2]) : participatingMembers[charToIndex(sub[2])];
            const p4 = matchOverrides[matchId]?.[3] ? allMembers.find(m => m.id === matchOverrides[matchId][3]) : participatingMembers[charToIndex(sub[3])];
            
            const t1Players = [p1, p2];
            const t2Players = [p3, p4];
            
            // Team 1 처리
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

            // Team 2 처리
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

    // 3. 정렬 (다승 -> 득실차 -> 득점 -> 나이(연장자 우선)) (경기를 1번이라도 뛴 선수만 포함)
    const sortedStats = Object.values(playerStatsMap).filter(p => p.matches > 0).sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins; // 1. 다승(승점)
      if (a.ptsDiff !== b.ptsDiff) return b.ptsDiff - a.ptsDiff; // 2. 득실차
      if (a.ptsFor !== b.ptsFor) return b.ptsFor - a.ptsFor; // 3. 다득점
      return b.age - a.age; // 4. 나이순(연장자 우선)
    });

    // 4. 순위 부여
    sortedStats.forEach((stat, i) => {
      stat.rank = i + 1;
    });

    return sortedStats;
  }, [participatingMembers, bracketOption, matchScores]);

  return (
    <div className="content-card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px', marginBottom: '10px' }}>
        <h2 style={{ color: '#1E3A8A', margin: 0 }}>
          3. 경기 결과 및 순위
        </h2>
        <div style={{ display: 'flex', gap: '10px' }}>

          <button 
            onClick={handleCapture}
            style={{ 
              background: '#10B981', color: 'white', border: 'none', padding: '8px 16px', 
              borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold'
            }}
          >
            <Camera size={18} />
            결과 이미지 저장
          </button>
        </div>
      </div>
      <p style={{ color: '#6B7280', marginBottom: '20px' }}>현재까지 입력된 점수를 바탕으로 실시간 순위가 자동 계산됩니다.</p>
      
      <div ref={tableRef} style={{ background: 'white', padding: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, color: '#1E3A8A', display: 'none' }} className="print-title">
            한울타리 주말리그 경기결과
          </h3>
          <div style={{ marginLeft: 'auto', fontSize: '0.9rem', color: '#4B5563', fontWeight: 'bold', background: '#F3F4F6', padding: '6px 12px', borderRadius: '4px' }}>
            {courtName ? `${courtName} - ${courtType} (${courtEnv})` : `${courtType} (${courtEnv})`}
          </div>
        </div>

      {stats.length === 0 ? (
        <p>참가 선수가 없습니다.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead style={{ background: '#F3F4F6', borderBottom: '2px solid #E5E7EB' }}>
              <tr>
                <th style={{ padding: '12px 10px' }}>순위</th>
                <th style={{ padding: '12px 10px', textAlign: 'left' }}>이름</th>
                <th style={{ padding: '12px 10px' }}>경기수</th>
                <th style={{ padding: '12px 10px' }}>승</th>
                <th style={{ padding: '12px 10px' }}>패</th>
                <th style={{ padding: '12px 10px' }}>득점</th>
                <th style={{ padding: '12px 10px' }}>실점</th>
                <th style={{ padding: '12px 10px' }}>득실차</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: p.rank === 1 ? '#FBBF24' : p.rank === 2 ? '#9CA3AF' : p.rank === 3 ? '#D97706' : 'transparent',
                      color: p.rank <= 3 ? 'white' : '#374151',
                      borderRadius: '50%', width: '28px', height: '28px'
                    }}>
                      {p.rank}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 'bold', color: '#1E3A8A' }}>
                    {p.name}
                  </td>
                  <td style={{ padding: '12px 10px' }}>{p.matches}</td>
                  <td style={{ padding: '12px 10px', color: '#0369A1', fontWeight: 'bold' }}>{p.wins}</td>
                  <td style={{ padding: '12px 10px', color: '#6D28D9', fontWeight: 'bold' }}>{p.losses}</td>
                  <td style={{ padding: '12px 10px' }}>{p.ptsFor}</td>
                  <td style={{ padding: '12px 10px' }}>{p.ptsAgainst}</td>
                  <td style={{ padding: '12px 10px', fontWeight: 'bold', color: p.ptsDiff > 0 ? '#10B981' : p.ptsDiff < 0 ? '#EF4444' : '#6B7280' }}>
                    {p.ptsDiff > 0 ? `+${p.ptsDiff}` : p.ptsDiff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
