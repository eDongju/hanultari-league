import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface LeagueSession {
  id: string;
  date: string;
  participatingMembers: any[];
  bracketOption: string;
  matchScores: Record<string, { t1: string, t2: string }>;
  matchOverrides: Record<string, Record<number, string>>;
}

interface LeagueHistoryProps {
  savedSessions: Record<string, LeagueSession>;
  onLoadSession: (session: LeagueSession) => void;
  onDeleteSession: (id: string) => void;
}

export default function LeagueHistory({ savedSessions, onLoadSession, onDeleteSession }: LeagueHistoryProps) {
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const sessionsList = Object.values(savedSessions).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 월별로 세션 그룹화
  const groupedSessions: Record<string, LeagueSession[]> = {};
  sessionsList.forEach(session => {
    let year = '알 수 없음';
    let month = '';
    
    if (session.date && session.date.includes('-')) {
      const parts = session.date.split('-');
      if (parts.length >= 2) {
        year = parts[0];
        month = parts[1];
      }
    }
    
    const monthKey = month ? `${year}년 ${month}월` : '기타 날짜';
    if (!groupedSessions[monthKey]) {
      groupedSessions[monthKey] = [];
    }
    groupedSessions[monthKey].push(session);
  });
  const handleDeleteConfirm = () => {
    if (passwordInput === '0000') {
      if (deleteModal) onDeleteSession(deleteModal);
      setDeleteModal(null);
      setPasswordInput('');
    } else {
      alert('암호가 틀렸습니다. 삭제가 취소되었습니다.');
    }
  };

  return (
    <div className="content-card">
      <h2 style={{ color: '#1E3A8A', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px' }}>
        4. 리그 결과 (기록 보관함)
      </h2>
      <p style={{ color: '#6B7280', marginBottom: '20px' }}>저장된 과거의 주말리그 경기 결과들을 확인하고 수정할 수 있습니다.</p>

      {sessionsList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#F9FAFB', borderRadius: '8px', color: '#6B7280' }}>
          아직 저장된 리그 결과가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {Object.entries(groupedSessions).map(([monthKey, sessions], index) => {
            const isExpanded = expandedMonths[monthKey] ?? (index === 0);
            return (
            <div key={monthKey} style={{ background: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
              <h3 
                onClick={() => toggleMonth(monthKey)}
                style={{ cursor: 'pointer', margin: 0, padding: '15px 20px', fontSize: '1.2rem', color: '#1F2937', background: '#F9FAFB', borderBottom: isExpanded ? '1px solid #E5E7EB' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#F3F4F6'}
                onMouseOut={e => e.currentTarget.style.background = '#F9FAFB'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {monthKey} <span style={{ fontSize: '0.9rem', color: '#6B7280', fontWeight: 'normal', background: '#E5E7EB', padding: '2px 8px', borderRadius: '12px' }}>총 {sessions.length}회</span>
                </div>
                {isExpanded ? <ChevronDown size={20} color="#6B7280" /> : <ChevronRight size={20} color="#6B7280" />}
              </h3>
              {isExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px' }}>
                {sessions.map(session => {
                  let timeString = '';
                  if (session.id.includes('_')) {
                    const timestamp = parseInt(session.id.split('_')[1], 10);
                    if (!isNaN(timestamp)) {
                      const dateObj = new Date(timestamp);
                      const hours = dateObj.getHours().toString().padStart(2, '0');
                      const minutes = dateObj.getMinutes().toString().padStart(2, '0');
                      timeString = ` (${hours}:${minutes})`;
                    }
                  }

                  return (
                    <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#F9FAFB' }}>
                      <div>
                        <h3 style={{ margin: '0 0 10px 0', color: '#1F2937' }}>{session.date} 리그{timeString}</h3>
                        <div style={{ color: '#4B5563', fontSize: '0.9rem' }}>
                          <span style={{ marginRight: '15px' }}><strong>참가 인원:</strong> {session.participatingMembers ? session.participatingMembers.filter(Boolean).length : 0}명</span>
                          <span><strong>코트 옵션:</strong> {session.bracketOption}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          onClick={() => onLoadSession(session)}
                          style={{ padding: '8px 16px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          불러오기 / 수정
                        </button>
                        <button 
                          onClick={() => {
                            setDeleteModal(session.id);
                            setPasswordInput('');
                          }}
                          style={{ padding: '8px 16px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* 암호 확인 팝업 모달 */}
      {deleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '1.5rem', color: '#1F2937' }}>기록 삭제</h2>
            <p style={{ color: '#4B5563', marginBottom: '20px' }}>정말로 이 기록을 삭제하시겠습니까?<br/>삭제를 원하시면 암호를 입력해주세요.</p>
            
            <input 
              type="password" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDeleteConfirm();
              }}
              placeholder="암호 4자리"
              style={{ width: '150px', padding: '15px', fontSize: '1.5rem', textAlign: 'center', border: '2px solid #EF4444', borderRadius: '8px', marginBottom: '30px', letterSpacing: '5px' }}
              autoFocus
            />

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={() => setDeleteModal(null)}
                style={{ flex: 1, padding: '12px', fontSize: '1.1rem', background: '#E5E7EB', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                취소
              </button>
              <button 
                onClick={handleDeleteConfirm}
                style={{ flex: 1, padding: '12px', fontSize: '1.1rem', background: '#EF4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                삭제 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
