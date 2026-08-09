import { useState, useRef, useEffect, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { Camera, Plus, Trash2, Trophy, ArrowUpDown, X, User, Download, Upload } from 'lucide-react';
import './index.css';
import membersData from './members.json';

import PlayerSetup from './components/PlayerSetup';
import MatchInput from './components/MatchInput';
import RankingsView from './components/RankingsView';
import LeagueHistory from './components/LeagueHistory';
interface Player {
  id: string;
  no: string;
  name: string;
  wins: number | '';
  losses: number | '';
  ptsFor: number | '';
  ptsAgainst: number | '';
  ptsDiff: number;
  rank: number;
}

interface Member {
  id: string;
  name: string;
  score: string | number; // LeaguePoint 역할
  gamePoint?: string | number; // 새롭게 추가된 GamePoint
  birthdate: string;
  age: number | string;
  photoUrl: string;
  extraInfo?: string;
}

const ProfileImage = ({ member, size = 45 }: { member: Member, size?: number }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(member.photoUrl || `/player/${member.name}.png`);
  const [hasError, setHasError] = useState(false);
  const [retryJpg, setRetryJpg] = useState(false);

  useEffect(() => {
    setImgSrc(member.photoUrl || `/player/${member.name}.png`);
    setHasError(false);
    setRetryJpg(false);
  }, [member.photoUrl, member.name]);

  const handleError = () => {
    if (!retryJpg && !member.photoUrl) {
      setImgSrc(`/player/${member.name}.jpg`);
      setRetryJpg(true);
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', flexShrink: 0, border: size > 50 ? '2px dashed #D1D5DB' : 'none' }}>
        {size > 50 ? <Camera size={32} /> : <User size={20} />}
      </div>
    );
  }

  return (
    <img 
      src={imgSrc as string} 
      alt={member.name} 
      onError={handleError}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} 
    />
  );
};

function App() {
  const [activeTab, setActiveTab] = useState<'match' | 'members' | 'playerSetup' | 'matchInput' | 'rankings' | 'history'>('playerSetup');
  
  // 저장된 리그 기록 상태
  const [savedSessions, setSavedSessions] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem('hanultari_league_sessions');
    return saved ? JSON.parse(saved) : {};
  });

  // 현재 진행 중인 리그의 고유 ID (새로 작성 중일 경우 null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionDate, setCurrentSessionDate] = useState<string>(() => {
    const today = new Date();
    // YYYY-MM-DD 형식 (한국 시간 기준)
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  
  // 주말리그에 참가할 선수들 상태 (PlayerSetup에서 설정하고 BracketView에서 사용)
  const [participatingMembers, setParticipatingMembers] = useState<(Member | null)[]>(Array(5).fill(null));
  
  // 대진표 옵션 상태 (예: "5", "12-2c" 등)
  const [bracketOption, setBracketOption] = useState<string>("5");
  
  // 경기 결과 점수 상태 { matchId: { t1: score, t2: score } }
  const [matchScores, setMatchScores] = useState<Record<string, { t1: string, t2: string }>>({});

  // 경기 중 선수 교체 오버라이드 상태 { matchId: { 0: memberId, 1: memberId, 2: memberId, 3: memberId } }
  const [matchOverrides, setMatchOverrides] = useState<Record<string, Record<number, string>>>({});

  const [players, setPlayers] = useState<Player[]>([]);
  
  const [allMembers, setAllMembers] = useState<Member[]>(() => {
    const saved = localStorage.getItem('hanultari_members');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return membersData.members;
  });

  useEffect(() => {
    localStorage.setItem('hanultari_members', JSON.stringify(allMembers));
  }, [allMembers]);

  // 상태 변경 시 자동 저장 로직 (Auto-save)
  useEffect(() => {
    // 아직 선수가 한 명도 선택되지 않은 초기 상태면 자동 저장하지 않음
    if (participatingMembers.filter(Boolean).length === 0) return;
    
    // 리그 초기 세팅 시에 빈 값이 불필요하게 저장되는 것을 방지
    if (Object.keys(matchScores).length === 0 && Object.keys(matchOverrides).length === 0) {
       // 점수나 오버라이드가 없고, 그냥 인원만 설정한 상태라도 저장은 해둠 (단, 최초 로드 시 무한루프 방지)
    }

    setSavedSessions(prev => {
      let idToSave = currentSessionId;
      if (!idToSave) {
        idToSave = `${currentSessionDate}_${Date.now()}`;
        // setTimeout을 사용하여 비동기적으로 id를 업데이트해 렌더링 충돌 방지
        setTimeout(() => setCurrentSessionId(idToSave), 0);
      }
      
      const newSession = {
        id: idToSave,
        date: currentSessionDate,
        participatingMembers,
        bracketOption,
        matchScores,
        matchOverrides
      };

      const updated = { ...prev, [idToSave]: newSession };
      localStorage.setItem('hanultari_league_sessions', JSON.stringify(updated));
      return updated;
    });
  }, [participatingMembers, bracketOption, matchScores, matchOverrides, currentSessionDate, currentSessionId]);

  // 리그 불러오기 함수
  const loadSession = (session: any) => {
    setCurrentSessionId(session.id);
    setCurrentSessionDate(session.date);
    setParticipatingMembers(session.participatingMembers);
    setBracketOption(session.bracketOption);
    setMatchScores(session.matchScores || {});
    setMatchOverrides(session.matchOverrides || {});
    setActiveTab('rankings'); // 불러오면 결과 화면으로 이동
  };

  // 리그 삭제 함수
  const deleteSession = (id: string) => {
    const updated = { ...savedSessions };
    delete updated[id];
    setSavedSessions(updated);
    localStorage.setItem('hanultari_league_sessions', JSON.stringify(updated));
  };

  const [leagueDate, setLeagueDate] = useState(new Date().toISOString().slice(0, 10));
  const tableRef = useRef<HTMLDivElement>(null);

  const [sortConfig, setSortConfig] = useState<{ key: keyof Member | 'rank' | 'sumPoint'; direction: 'asc' | 'desc' }>({ key: 'rank', direction: 'asc' });
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  useEffect(() => {
    const updatedPlayers = players.map(p => {
      const pFor = Number(p.ptsFor) || 0;
      const pAgainst = Number(p.ptsAgainst) || 0;
      return { ...p, ptsDiff: pFor - pAgainst };
    });

    const sorted = [...updatedPlayers].sort((a, b) => {
      const aWins = Number(a.wins) || 0;
      const bWins = Number(b.wins) || 0;
      if (aWins !== bWins) return bWins - aWins;
      if (a.ptsDiff !== b.ptsDiff) return b.ptsDiff - a.ptsDiff;
      const aFor = Number(a.ptsFor) || 0;
      const bFor = Number(b.ptsFor) || 0;
      return bFor - aFor;
    });

    const rankedPlayers = updatedPlayers.map(p => {
      const rank = sorted.findIndex(s => s.id === p.id) + 1;
      return { ...p, rank };
    });

    const isDifferent = rankedPlayers.some((p, i) => p.ptsDiff !== players[i].ptsDiff || p.rank !== players[i].rank);
    if (isDifferent) {
      setPlayers(rankedPlayers);
    }
  }, [players]);

  const handleCapture = async () => {
    if (!tableRef.current) return;
    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        ignoreElements: (element) => element.classList.contains('no-capture')
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `한울타리결과_${leagueDate}.png`;
      link.click();
    } catch (err) {
      console.error('Failed to capture image', err);
      alert('이미지 저장에 실패했습니다.');
    }
  };

  const addPlayer = () => {
    const newNo = String(players.length + 1);
    setPlayers([...players, { 
      id: Date.now().toString(), 
      no: newNo, 
      name: '', 
      wins: '', losses: '', ptsFor: '', ptsAgainst: '', ptsDiff: 0, rank: players.length + 1 
    }]);
  };

  const removePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const updatePlayer = (id: string, field: keyof Player, value: any) => {
    setPlayers(players.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const sortedMembers = useMemo(() => {
    // 순위(RANK)는 이제 SumPoint(LeaguePoint + GamePoint) 기준으로 계산합니다.
    const getSum = (m: Member) => (Number(m.score) || 0) + (Number(m.gamePoint) || 0);

    const baseSorted = [...allMembers].sort((a, b) => getSum(b) - getSum(a));
    const membersWithRank = baseSorted.map((m, idx) => ({ ...m, rank: idx + 1, sumPoint: getSum(m) }));

    return membersWithRank.sort((a, b) => {
      let valA = a[sortConfig.key as keyof typeof a];
      let valB = b[sortConfig.key as keyof typeof b];

      if (sortConfig.key === 'score' || sortConfig.key === 'gamePoint') {
        let vA = a[sortConfig.key];
        let vB = b[sortConfig.key];
        
        if (typeof vA === 'string' && typeof vB === 'string') {
          return sortConfig.direction === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
        }
        
        const numA = Number(vA) ?? 0;
        const numB = Number(vB) ?? 0;
        if (numA < numB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (numA > numB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }

      if (valA! < valB!) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA! > valB!) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allMembers, sortConfig]);

  const handleSort = (key: keyof Member | 'rank' | 'sumPoint') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleSaveMember = () => {
    if (!selectedMember) return;
    const exists = allMembers.some(m => m.id === selectedMember.id);
    if (exists) {
      setAllMembers(allMembers.map(m => m.id === selectedMember.id ? selectedMember : m));
    } else {
      setAllMembers([...allMembers, selectedMember]);
    }
    setSelectedMember(null);
  };

  const handleAddNewMember = () => {
    const newMember: Member = {
      id: 'm_new_' + Date.now(),
      name: '새 회원',
      score: '0',
      gamePoint: '0',
      birthdate: '-',
      age: '-',
      photoUrl: '',
      extraInfo: ''
    };
    setSelectedMember(newMember);
  };

  const handleDeleteMember = () => {
    if (!selectedMember) return;
    if (window.confirm(`${selectedMember.name} 회원을 목록에서 완전히 삭제하시겠습니까?`)) {
      setAllMembers(allMembers.filter(m => m.id !== selectedMember.id));
      setSelectedMember(null);
    }
  };

  const handleBackupDB = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allMembers, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `hanultari_db_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  };

  const handleRestoreDB = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (Array.isArray(json)) {
          setAllMembers(json);
          alert('DB 복원이 완료되었습니다!');
        }
      } catch (err) {
        alert('잘못된 DB 파일입니다.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedMember) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        canvas.width = MAX_WIDTH;
        canvas.height = MAX_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, MAX_WIDTH, MAX_HEIGHT);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setSelectedMember({ ...selectedMember, photoUrl: dataUrl });
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    event.target.value = ''; 
  };

  return (
    <div className="container" style={{ position: 'relative' }}>
      <div className="card">
        <div className="header">
          <h1>한울타리 주말리그</h1>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '1rem', alignItems: 'center' }}>
            {/* 새로운 주말리그용 탭 4개 */}
            <button onClick={() => setActiveTab('playerSetup')} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'playerSetup' ? 'var(--primary)' : '#E5E7EB', color: activeTab === 'playerSetup' ? 'white' : '#374151' }}>1. 선수 입력</button>
            <button onClick={() => setActiveTab('matchInput')} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'matchInput' ? 'var(--primary)' : '#E5E7EB', color: activeTab === 'matchInput' ? 'white' : '#374151' }}>2. 대진표 및 결과 입력</button>
            <button onClick={() => setActiveTab('rankings')} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'rankings' ? 'var(--primary)' : '#E5E7EB', color: activeTab === 'rankings' ? 'white' : '#374151' }}>3. 결과 및 순위</button>
            <button onClick={() => setActiveTab('history')} style={{ padding: '0.5rem 1rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'history' ? 'var(--primary)' : '#E5E7EB', color: activeTab === 'history' ? 'white' : '#374151' }}>4. 리그결과 (기록)</button>
            
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {currentSessionId && (
                <button 
                  onClick={() => {
                    if (window.confirm("현재 진행 상황을 초기화하고 새 리그를 시작하시겠습니까?")) {
                      setCurrentSessionId(null);
                      setParticipatingMembers(Array(5).fill(null));
                      setBracketOption('5');
                      setMatchScores({});
                      setMatchOverrides({});
                      setActiveTab('playerSetup');
                    }
                  }}
                  style={{ padding: '8px 16px', background: '#F59E0B', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  새 리그 시작
                </button>
              )}
              <input 
                type="date" 
                value={currentSessionDate}
                onChange={(e) => setCurrentSessionDate(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
              />
            </div>
            
            <div style={{ width: '100%', height: '1px', background: '#E5E7EB', margin: '5px 0' }}></div>
            {/* 기존 탭 (Legacy) */}
            <button onClick={() => setActiveTab('match')} style={{ padding: '0.5rem 1.5rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'match' ? '#6B7280' : '#F3F4F6', color: activeTab === 'match' ? 'white' : '#9CA3AF' }}>[이전] 대진 결과 관리</button>
            <button onClick={() => setActiveTab('members')} style={{ padding: '0.5rem 1.5rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'members' ? '#6B7280' : '#F3F4F6', color: activeTab === 'members' ? 'white' : '#9CA3AF' }}>[이전] 회원 정보 ({allMembers.length}명)</button>
          </div>
        </div>

        {/* 신규 화면 컴포넌트 렌더링 */}
        {activeTab === 'playerSetup' && (
          <PlayerSetup 
            allMembers={allMembers} 
            participatingMembers={participatingMembers} 
            setParticipatingMembers={setParticipatingMembers}
            bracketOption={bracketOption}
            setBracketOption={setBracketOption}
          />
        )}
        {activeTab === 'matchInput' && (
          <MatchInput 
            allMembers={allMembers}
            participatingMembers={participatingMembers}
            bracketOption={bracketOption}
            matchScores={matchScores}
            setMatchScores={setMatchScores}
            matchOverrides={matchOverrides}
            setMatchOverrides={setMatchOverrides}
          />
        )}
        {activeTab === 'rankings' && (
          <RankingsView 
            allMembers={allMembers}
            participatingMembers={participatingMembers}
            bracketOption={bracketOption}
            matchScores={matchScores}
            matchOverrides={matchOverrides}
          />
        )}
        {activeTab === 'history' && (
          <LeagueHistory 
            savedSessions={savedSessions}
            onLoadSession={loadSession}
            onDeleteSession={deleteSession}
          />
        )}

        {activeTab === 'match' && (
          <>
            <div className="actions" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontWeight: 'bold', marginRight: '10px' }}>리그일:</label>
                <input 
                  type="date" 
                  value={leagueDate} 
                  onChange={(e) => setLeagueDate(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="button-primary" style={{ background: '#3B82F6' }} onClick={addPlayer}>
                  <Plus size={18} />
                  선수 추가
                </button>
                <button className="button-primary" style={{ background: '#10B981' }} onClick={handleCapture}>
                  <Camera size={18} />
                  결과 이미지 저장
                </button>
              </div>
            </div>

            <div className="table-wrapper" ref={tableRef} style={{ padding: '20px', background: 'white' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.8rem', color: '#1E3A8A', margin: 0 }}>한울타리 주말리그 경기결과</h2>
                <p style={{ color: '#6B7280', fontSize: '0.9rem', marginTop: '5px' }}>{leagueDate} | 참석인원: {players.length}명</p>
              </div>

              <datalist id="members-list">
                {allMembers.map((m) => (
                  <option key={m.id} value={m.name} />
                ))}
              </datalist>

              <table>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>No</th>
                    <th style={{ width: '120px' }}>이름</th>
                    <th style={{ width: '80px' }}>승</th>
                    <th style={{ width: '80px' }}>패</th>
                    <th style={{ width: '80px' }}>득점</th>
                    <th style={{ width: '80px' }}>실점</th>
                    <th style={{ width: '80px' }}>득실</th>
                    <th style={{ width: '80px' }}>순위</th>
                    <th className="no-capture" style={{ width: '50px' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {players.sort((a,b) => a.rank - b.rank).map((player) => (
                    <tr key={player.id}>
                      <td>
                        <input 
                          type="text" 
                          className="input-cell" 
                          value={player.no} 
                          onChange={(e) => updatePlayer(player.id, 'no', e.target.value)} 
                        />
                      </td>
                      <td>
                        <input 
                          type="text" 
                          className="input-cell" 
                          style={{ width: '100px', fontWeight: 'bold' }}
                          value={player.name}
                          list="members-list"
                          onChange={(e) => updatePlayer(player.id, 'name', e.target.value)} 
                        />
                      </td>
                      <td>
                        <input type="number" className="input-cell" value={player.wins} onChange={(e) => updatePlayer(player.id, 'wins', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" className="input-cell" value={player.losses} onChange={(e) => updatePlayer(player.id, 'losses', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" className="input-cell" value={player.ptsFor} onChange={(e) => updatePlayer(player.id, 'ptsFor', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" className="input-cell" value={player.ptsAgainst} onChange={(e) => updatePlayer(player.id, 'ptsAgainst', e.target.value)} />
                      </td>
                      <td style={{ fontWeight: 'bold', color: player.ptsDiff > 0 ? '#10B981' : player.ptsDiff < 0 ? '#EF4444' : '#6B7280' }}>
                        {player.ptsDiff > 0 ? `+${player.ptsDiff}` : player.ptsDiff}
                      </td>
                      <td>
                        <span className={`rank-badge rank-${player.rank}`}>
                          {player.rank === 1 ? <Trophy size={14} style={{marginRight:'2px'}}/> : null}
                          {player.rank}
                        </span>
                      </td>
                      <td className="no-capture">
                        <button 
                          onClick={() => removePlayer(player.id)}
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '5px' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'right', marginTop: '10px', fontSize: '0.75rem', color: '#9CA3AF' }}>
                Generated by AI Agent
              </div>
            </div>
          </>
        )}

        {activeTab === 'members' && (
          <div style={{ padding: '0' }}>
            <div style={{ background: '#002865', color: 'white', padding: '2rem', borderRadius: '12px 12px 0 0', marginBottom: '0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '2rem', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '2px' }}>Singles Rankings</h2>
                <p style={{ color: '#93C5FD', margin: 0 }}>Hanultari Official Rankings • {leagueDate}</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="file" id="restore-db" accept=".json" style={{ display: 'none' }} onChange={handleRestoreDB} />
                <button 
                  onClick={() => document.getElementById('restore-db')?.click()}
                  style={{ 
                    background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', padding: '0.75rem 1rem', 
                    borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' 
                  }}>
                  <Upload size={16} /> DB 복원
                </button>
                <button 
                  onClick={handleBackupDB}
                  style={{ 
                    background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', padding: '0.75rem 1rem', 
                    borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' 
                  }}>
                  <Download size={16} /> DB 백업
                </button>
                <button 
                  onClick={handleAddNewMember}
                  style={{ 
                    background: '#10B981', color: 'white', border: 'none', padding: '0.75rem 1.5rem', 
                    borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginLeft: '10px'
                  }}>
                  <Plus size={18} />
                  신규 회원 추가
                </button>
              </div>
            </div>
            
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                  <tr>
                    <th onClick={() => handleSort('rank')} style={{ padding: '15px 20px', width: '80px', color: '#6B7280', fontSize: '0.85rem', cursor: 'pointer' }}>
                      RANK <ArrowUpDown size={12} style={{display:'inline', marginLeft:'4px'}}/>
                    </th>
                    <th onClick={() => handleSort('name')} style={{ padding: '15px 20px', color: '#6B7280', fontSize: '0.85rem', cursor: 'pointer' }}>
                      PLAYER <ArrowUpDown size={12} style={{display:'inline', marginLeft:'4px'}}/>
                    </th>
                    <th onClick={() => handleSort('score')} style={{ padding: '15px 10px', width: '110px', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer' }}>
                      LeaguePoint <ArrowUpDown size={12} style={{display:'inline', marginLeft:'4px'}}/>
                    </th>
                    <th onClick={() => handleSort('gamePoint')} style={{ padding: '15px 10px', width: '110px', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer' }}>
                      GamePoint <ArrowUpDown size={12} style={{display:'inline', marginLeft:'4px'}}/>
                    </th>
                    <th onClick={() => handleSort('sumPoint')} style={{ padding: '15px 10px', width: '110px', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer', fontWeight: 'bold' }}>
                      SumPoint <ArrowUpDown size={12} style={{display:'inline', marginLeft:'4px'}}/>
                    </th>
                    <th onClick={() => handleSort('age')} style={{ padding: '15px 20px', width: '100px', color: '#6B7280', fontSize: '0.85rem', textAlign: 'center', cursor: 'pointer' }}>
                      AGE <ArrowUpDown size={12} style={{display:'inline', marginLeft:'4px'}}/>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member) => (
                    <tr 
                      key={member.id} 
                      onClick={() => setSelectedMember(member)}
                      style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.2s', cursor: 'pointer' }} 
                      onMouseOver={e => e.currentTarget.style.background = '#F3F4F6'} 
                      onMouseOut={e => e.currentTarget.style.background = 'white'}
                    >
                      <td style={{ padding: '15px 20px', fontSize: '1.2rem', fontWeight: 'bold', color: '#374151' }}>
                        {member.rank}
                      </td>
                      <td style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <ProfileImage member={member} size={50} />
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#002865' }}>
                          {member.name}
                        </div>
                      </td>
                      <td style={{ padding: '15px 10px', textAlign: 'right', color: '#4B5563', fontSize: '1.05rem' }}>
                        {member.score === '-' ? '0' : Number(member.score).toFixed(0)}
                      </td>
                      <td style={{ padding: '15px 10px', textAlign: 'right', color: '#4B5563', fontSize: '1.05rem' }}>
                        {member.gamePoint === undefined ? '0' : Number(member.gamePoint).toFixed(0)}
                      </td>
                      <td style={{ padding: '15px 10px', textAlign: 'right', fontWeight: 'bold', color: '#002865', fontSize: '1.15rem' }}>
                        {(Number(member.score) || 0) + (Number(member.gamePoint) || 0)}
                      </td>
                      <td style={{ padding: '15px 20px', textAlign: 'center', color: '#4B5563' }}>
                        {member.age}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 회원 상세정보 수정 모달 */}
      {selectedMember && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ background: '#002865', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>선수 프로필 편집</h3>
              <button onClick={() => setSelectedMember(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div style={{ padding: '20px' }}>
              
              <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                <input type="file" id="photo-upload" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                <div 
                  onClick={() => document.getElementById('photo-upload')?.click()}
                  style={{ position: 'relative', cursor: 'pointer', width: '110px', height: '110px' }}
                >
                  <ProfileImage member={selectedMember} size={110} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '0.7rem', textAlign: 'center', padding: '4px 0', borderBottomLeftRadius: '55px', borderBottomRightRadius: '55px' }}>사진 등록</div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#6B7280', marginBottom: '4px' }}>이름</label>
                  <input type="text" value={selectedMember.name} onChange={e => setSelectedMember({...selectedMember, name: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', marginBottom: '10px' }} />
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: '#6B7280', marginBottom: '4px' }}>LeaguePoint</label>
                      <input type="number" value={selectedMember.score} onChange={e => setSelectedMember({...selectedMember, score: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: '#6B7280', marginBottom: '4px' }}>GamePoint</label>
                      <input type="number" value={selectedMember.gamePoint || 0} onChange={e => setSelectedMember({...selectedMember, gamePoint: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#6B7280', marginBottom: '4px' }}>생년월일</label>
                  <input type="date" value={selectedMember.birthdate !== '-' ? selectedMember.birthdate : ''} onChange={e => setSelectedMember({...selectedMember, birthdate: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }} />
                </div>
                <div style={{ width: '80px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#6B7280', marginBottom: '4px' }}>나이</label>
                  <input type="text" value={selectedMember.age} readOnly style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', background: '#F3F4F6' }} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#6B7280', marginBottom: '4px' }}>선수 추가 정보 (특이사항)</label>
                <textarea rows={6} value={selectedMember.extraInfo || ''} onChange={e => setSelectedMember({...selectedMember, extraInfo: e.target.value})} placeholder="우승 경력, 주특기 등 추가 정보 입력..." style={{ width: '100%', padding: '12px', border: '1px solid #D1D5DB', borderRadius: '6px', resize: 'vertical', lineHeight: '1.5' }}></textarea>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="button-primary" onClick={handleSaveMember} style={{ flex: 1, justifyContent: 'center' }}>
                  정보 저장하기
                </button>
                <button 
                  onClick={handleDeleteMember} 
                  style={{ background: '#EF4444', color: 'white', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
