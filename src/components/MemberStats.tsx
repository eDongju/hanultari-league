import { useMemo, useState } from 'react';
import { ArrowUpDown, BarChart2 } from 'lucide-react';
import { ProfileImage, type Member } from '../App';

interface MemberStatsProps {
  allMembers: any[];
  savedSessions: Record<string, any>;
  globalStats: Record<string, any>;
  memberPoints: Record<string, { g: number, r: number }>;
}

export default function MemberStats({ allMembers, globalStats, memberPoints }: MemberStatsProps) {
  const [sortKey, setSortKey] = useState<string>('attendances');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const renderHeader = (label: string, key: string, width?: string) => (
    <th 
      onClick={() => handleSort(key)} 
      style={{ cursor: 'pointer', userSelect: 'none', width: width || 'auto', transition: 'background 0.2s' }}
      onMouseOver={(e) => e.currentTarget.style.background = '#F3F4F6'}
      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {label} <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '4px', color: sortKey === key ? '#2563EB' : '#9CA3AF' }} />
    </th>
  );

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
        rPt: memberPoints[m.name]?.r || 0,
        gPt: memberPoints[m.name]?.g || 0,
        deuceCount: stats.deuceCount || 0,
        adCount: stats.adCount || 0,
        original: m as Member,
      };
    }).sort((a, b) => {
      let result = 0;
      if (sortKey === 'attendances') result = b.attendances - a.attendances;
      else if (sortKey === 'winRate') result = b.winRate - a.winRate || b.matches - a.matches;
      else if (sortKey === 'rPt') result = b.rPt - a.rPt;
      else if (sortKey === 'gPt') result = b.gPt - a.gPt;
      else if (sortKey === 'deuceCount') result = b.deuceCount - a.deuceCount;
      else if (sortKey === 'adCount') result = b.adCount - a.adCount;
      
      return sortDirection === 'asc' ? -result : result;
    });
  }, [allMembers, globalStats, sortKey, sortDirection]);

  return (
    <div className="content-card">
      <h2 style={{ color: '#1E3A8A', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={24} /> 멤버 통계
        </div>
      </h2>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: '60px' }}>선수</th>
              {renderHeader('참석', 'attendances')}
              {renderHeader('승률', 'winRate')}
              <th>베스트듀오</th>
              {renderHeader('대회(R.PT)', 'rPt')}
              {renderHeader('간식(G.PT)', 'gPt')}
              {renderHeader('듀스(D)', 'deuceCount')}
              {renderHeader('애드(A)', 'adCount')}
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
