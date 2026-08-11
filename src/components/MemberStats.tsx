import { useMemo, useState } from 'react';
import { ProfileImage, Member } from '../App';

interface MemberStatsProps {
  allMembers: any[];
  savedSessions: Record<string, any>;
  globalStats: Record<string, any>;
}

export default function MemberStats({ allMembers, globalStats }: MemberStatsProps) {
  const [sortKey, setSortKey] = useState<string>('attendances');

  const memberStatsList = useMemo(() => {
    return allMembers.map(m => {
      const stats = globalStats[m.id] || { 
        matches: 0, wins: 0, losses: 0, 
        deuceCount: 0, adCount: 0, duoStats: {}, attendances: 0 
      };
      
      const winRate = stats.matches > 0 ? (stats.wins / stats.matches) * 100 : 0;
      
      // 베스트 듀오 찾기
      let bestDuoId: string | null = null;
      let bestDuoWins = -1;
      Object.entries(stats.duoStats || {}).forEach(([partnerId, dStats]: [string, any]) => {
        if (dStats.wins > bestDuoWins) {
          bestDuoWins = dStats.wins;
          bestDuoId = partnerId;
        }
      });
      const bestDuoName = bestDuoId ? allMembers.find(mem => mem.id === bestDuoId)?.name || '알수없음' : '-';

      return {
        id: m.id,
        name: m.name,
        photoUrl: m.photoUrl,
        attendances: stats.attendances || 0,
        matches: stats.matches,
        wins: stats.wins,
        winRate: winRate,
        bestDuo: bestDuoWins > 0 ? `${bestDuoName} (${bestDuoWins}승)` : '-',
        rPt: Number(m.roundPoint) || 0,
        gPt: Number(m.gamePoint) || 0,
        deuceCount: stats.deuceCount || 0,
        adCount: stats.adCount || 0,
        original: m as Member,
      };
    }).sort((a, b) => {
      if (sortKey === 'attendances') return b.attendances - a.attendances;
      if (sortKey === 'winRate') return b.winRate - a.winRate || b.matches - a.matches;
      if (sortKey === 'rPt') return b.rPt - a.rPt;
      if (sortKey === 'gPt') return b.gPt - a.gPt;
      if (sortKey === 'deuceCount') return b.deuceCount - a.deuceCount;
      if (sortKey === 'adCount') return b.adCount - a.adCount;
      return 0;
    });
  }, [allMembers, globalStats, sortKey]);

  return (
    <div className="content-card">
      <h2 style={{ color: '#1E3A8A', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        6. 멤버 통계
        <select 
          value={sortKey} 
          onChange={e => setSortKey(e.target.value)}
          style={{ fontSize: '0.9rem', padding: '5px 10px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
        >
          <option value="attendances">참석순</option>
          <option value="winRate">승률순</option>
          <option value="rPt">대회왕 (R.PT)순</option>
          <option value="gPt">간식왕 (G.PT)순</option>
          <option value="deuceCount">듀스코트순</option>
          <option value="adCount">애드코트순</option>
        </select>
      </h2>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: '60px' }}>선수</th>
              <th>참석</th>
              <th>승률</th>
              <th>베스트듀오</th>
              <th>대회(R.PT)</th>
              <th>간식(G.PT)</th>
              <th>듀스(D)</th>
              <th>애드(A)</th>
            </tr>
          </thead>
          <tbody>
            {memberStatsList.map((m) => (
              <tr key={m.id}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                    <ProfileImage member={m.original} size={40} />
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1F2937' }}>{m.name}</span>
                  </div>
                </td>
                <td style={{ fontWeight: 'bold', color: '#0369A1' }}>{m.attendances}회</td>
                <td>
                  <div style={{ fontWeight: 'bold', color: m.winRate >= 50 ? '#10B981' : '#EF4444' }}>
                    {m.winRate.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                    {m.wins}승 / {m.matches}전
                  </div>
                </td>
                <td style={{ fontSize: '0.9rem', color: '#4B5563' }}>{m.bestDuo}</td>
                <td style={{ fontWeight: 'bold', color: '#D97706' }}>{m.rPt > 0 ? m.rPt.toFixed(1) : '-'}</td>
                <td style={{ fontWeight: 'bold', color: '#059669' }}>{m.gPt > 0 ? m.gPt.toFixed(1) : '-'}</td>
                <td style={{ color: '#6B7280' }}>{m.deuceCount}회</td>
                <td style={{ color: '#6B7280' }}>{m.adCount}회</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
