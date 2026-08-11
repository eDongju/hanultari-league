import { useState, useEffect, useMemo, useRef } from 'react';
import { Camera, Plus, Trash2, ArrowUpDown, X, User } from 'lucide-react';
import './index.css';
import membersData from './members.json';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import hanulLogo from './assets/hanul_logo.jpg';
import PlayerSetup from './components/PlayerSetup';
import MatchInput from './components/MatchInput';
import RankingsView from './components/RankingsView';
import LeagueHistory from './components/LeagueHistory';
import combinations from './data/combinations.json';

const charToIndex = (c: string) => {
  if (c >= '1' && c <= '9') return parseInt(c) - 1;
  return c.charCodeAt(0) - 'A'.charCodeAt(0) + 9;
};

interface Member {
  id: string;
  name: string;
  score: string | number; // LeaguePoint 역할
  previousScore?: string | number; // 롤백용 이전 점수
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
      <div style={{ width: size, height: size, borderRadius: '8px', background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', flexShrink: 0, border: size > 50 ? '2px dashed #D1D5DB' : 'none' }}>
        {size > 50 ? <Camera size={32} /> : <User size={20} />}
      </div>
    );
  }

  return (
    <img 
      src={imgSrc as string} 
      alt={member.name} 
      onError={handleError}
      style={{ width: size, height: size, borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid #E5E7EB' }} 
    />
  );
};

function App() {
  const [activeTab, setActiveTab] = useState<'match' | 'members' | 'playerSetup' | 'matchInput' | 'rankings' | 'history'>(() => {
    return (localStorage.getItem('activeTab') as any) || 'playerSetup';
  });
  
  // 저장된 리그 기록 상태
  const [savedSessions, setSavedSessions] = useState<Record<string, any>>({});

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return localStorage.getItem('currentSessionId') || null;
  });
  const [currentSessionDate, setCurrentSessionDate] = useState<string>(() => {
    const savedDate = localStorage.getItem('currentSessionDate');
    if (savedDate) return savedDate;
    const today = new Date();
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  
  const [participatingMembers, setParticipatingMembers] = useState<(Member | null)[]>(() => {
    const saved = localStorage.getItem('participatingMembers');
    return saved ? JSON.parse(saved) : Array(5).fill(null);
  });
  
  const [bracketOption, setBracketOption] = useState<string>(() => {
    return localStorage.getItem('bracketOption') || "5";
  });
  
  const [matchScores, setMatchScores] = useState<Record<string, { t1: string, t2: string }>>(() => {
    const saved = localStorage.getItem('matchScores');
    return saved ? JSON.parse(saved) : {};
  });

  const [matchOverrides, setMatchOverrides] = useState<Record<string, Record<number, string>>>(() => {
    const saved = localStorage.getItem('matchOverrides');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [courtName, setCourtName] = useState<string>(() => localStorage.getItem('courtName') || '');
  const [courtType, setCourtType] = useState<string>(() => localStorage.getItem('courtType') || '인조잔디');

  const touchStartPos = useRef<{x: number, y: number} | null>(null);
  const touchEndPos = useRef<{x: number, y: number} | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndPos.current = null;
    touchStartPos.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndPos.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const onTouchEndFn = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !touchEndPos.current) return;
    
    // 테이블과 같이 좌우 스크롤이 있는 요소 내에서의 터치면 탭 전환 무시
    const target = e.target as HTMLElement;
    if (target.closest('table') || target.closest('select') || target.closest('input')) return;

    const xDistance = touchStartPos.current.x - touchEndPos.current.x;
    const yDistance = Math.abs(touchStartPos.current.y - touchEndPos.current.y);
    
    // 상하 스크롤 중이면 무시
    if (yDistance > Math.abs(xDistance)) return;

    const isLeftSwipe = xDistance > 80;
    const isRightSwipe = xDistance < -80;
    
    if (isLeftSwipe || isRightSwipe) {
      const TABS = ['playerSetup', 'matchInput', 'rankings', 'history', 'members'];
      const currentIndex = TABS.indexOf(activeTab);
      
      if (isLeftSwipe && currentIndex < TABS.length - 1) {
        setActiveTab(TABS[currentIndex + 1] as any);
      }
      if (isRightSwipe && currentIndex > 0) {
        setActiveTab(TABS[currentIndex - 1] as any);
      }
    }
  };

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const [allMembers, setAllMembers] = useState<Member[]>([]);

  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      if (!snapshot.empty) {
        setAllMembers(snapshot.docs.map(doc => doc.data() as Member));
      } else {
        const defaultMembers = membersData as any;
        setAllMembers(defaultMembers);
        const batch = writeBatch(db);
        defaultMembers.forEach((m: Member) => batch.set(doc(db, 'members', m.id), m));
        batch.commit();
      }
    });

    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      const sessions: Record<string, any> = {};
      snapshot.forEach(doc => { sessions[doc.id] = doc.data(); });
      setSavedSessions(sessions);
    });

    return () => {
      unsubMembers();
      unsubSessions();
    };
  }, []);

  // 상태 변경 시 자동 저장 로직 (Auto-save)
  useEffect(() => {
    if (participatingMembers.filter(Boolean).length === 0) return;
    if (Object.keys(matchScores).length === 0 && Object.keys(matchOverrides).length === 0) {}

    const timeoutId = setTimeout(async () => {
      let idToSave = currentSessionId;
      if (!idToSave) {
        idToSave = `${currentSessionDate}_${Date.now()}`;
        setCurrentSessionId(idToSave);
      }
      
      const newSession = {
        id: idToSave,
        date: currentSessionDate,
        participatingMembers,
        bracketOption,
        matchScores,
        matchOverrides,
        courtName,
        courtType
      };

      localStorage.setItem('currentSessionId', idToSave);
      localStorage.setItem('currentSessionDate', currentSessionDate);
      localStorage.setItem('participatingMembers', JSON.stringify(participatingMembers));
      localStorage.setItem('bracketOption', bracketOption);
      localStorage.setItem('matchScores', JSON.stringify(matchScores));
      localStorage.setItem('matchOverrides', JSON.stringify(matchOverrides));
      localStorage.setItem('courtName', courtName);
      localStorage.setItem('courtType', courtType);

      await setDoc(doc(db, 'sessions', idToSave), newSession);
    }, 1500); // 1.5초 디바운스

    return () => clearTimeout(timeoutId);
  }, [participatingMembers, bracketOption, matchScores, matchOverrides, currentSessionDate, currentSessionId, courtName, courtType]);

  const globalStats = useMemo(() => {
    const stats: Record<string, { matches: number, wins: number, losses: number, sessionMatches: number, sessionWins: number, sessionLosses: number }> = {};
    allMembers.forEach(m => {
      const bWins = Number((m as any).baseWins) || 0;
      const bLosses = Number((m as any).baseLosses) || 0;
      stats[m.id] = { 
        matches: bWins + bLosses, 
        wins: bWins, 
        losses: bLosses,
        sessionMatches: 0,
        sessionWins: 0,
        sessionLosses: 0
      };
    });

    Object.values(savedSessions).forEach((session: any) => {
      const currentCombinations = (combinations as Record<string, string[]>)[session.bracketOption] || [];
      const mScores = session.matchScores || {};
      const mOverrides = session.matchOverrides || {};
      const pMembers = session.participatingMembers || [];

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

              t1Ids.forEach(pid => {
                if (pid && stats[pid]) {
                  stats[pid].matches += 1;
                  stats[pid].sessionMatches += 1;
                  if (s1 > s2) {
                    stats[pid].wins += 1;
                    stats[pid].sessionWins += 1;
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
    });

    return stats;
  }, [savedSessions, allMembers]);

  // 리그 불러오기 함수
  const loadSession = (session: any) => {
    setCurrentSessionId(session.id);
    setCurrentSessionDate(session.date);
    setParticipatingMembers(session.participatingMembers || Array(5).fill(null));
    setBracketOption(session.bracketOption || '5');
    setMatchScores(session.matchScores || {});
    setMatchOverrides(session.matchOverrides || {});
    setCourtName(session.courtName || '');
    setCourtType(session.courtType || '인조잔디');
    setActiveTab('rankings'); // 불러오면 결과 화면으로 이동

    localStorage.setItem('currentSessionId', session.id);
    localStorage.setItem('currentSessionDate', session.date);
    localStorage.setItem('participatingMembers', JSON.stringify(session.participatingMembers || Array(5).fill(null)));
    localStorage.setItem('bracketOption', session.bracketOption || '5');
    localStorage.setItem('matchScores', JSON.stringify(session.matchScores || {}));
    localStorage.setItem('matchOverrides', JSON.stringify(session.matchOverrides || {}));
    localStorage.setItem('courtName', session.courtName || '');
    localStorage.setItem('courtType', session.courtType || '인조잔디');
  };

  // 리그 삭제 함수
  const deleteSession = async (id: string) => {
    await deleteDoc(doc(db, 'sessions', id));
  };

  const leagueDate = new Date().toISOString().slice(0, 10);

  const [sortConfig, setSortConfig] = useState<{ key: keyof Member | 'rank' | 'sumPoint'; direction: 'asc' | 'desc' }>({ key: 'rank', direction: 'asc' });
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);


  const sortedMembers = useMemo(() => {
    // 순위(RANK)는 이제 SumPoint(dynamic L.Point + GamePoint) 기준으로 계산합니다.
    const getSum = (m: Member) => {
      const sStats = globalStats[m.id] || { sessionMatches: 0, sessionWins: 0 };
      const dynamicLPoint = (Number(m.score) || 0) + (sStats.sessionWins * 2) + (sStats.sessionMatches * 0.5);
      return (Number(m.gamePoint) || 0) + dynamicLPoint;
    };

    const baseSorted = [...allMembers].sort((a, b) => getSum(b) - getSum(a));
    const membersWithRank = baseSorted.map((m, idx) => ({ ...m, rank: idx + 1, sumPoint: getSum(m) }));

    return membersWithRank.sort((a, b) => {
      let valA = a[sortConfig.key as keyof typeof a];
      let valB = b[sortConfig.key as keyof typeof b];

      if (sortConfig.key === 'score') {
        const sStatsA = globalStats[a.id] || { sessionMatches: 0, sessionWins: 0 };
        const lPointA = (Number(a.score) || 0) + (sStatsA.sessionWins * 2) + (sStatsA.sessionMatches * 0.5);
        const sStatsB = globalStats[b.id] || { sessionMatches: 0, sessionWins: 0 };
        const lPointB = (Number(b.score) || 0) + (sStatsB.sessionWins * 2) + (sStatsB.sessionMatches * 0.5);
        if (lPointA < lPointB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (lPointA > lPointB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }

      if (sortConfig.key === 'gamePoint') {
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

  const handleSaveMember = async () => {
    if (!selectedMember) return;
    await setDoc(doc(db, 'members', selectedMember.id), selectedMember);
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

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    const pwd = window.prompt(`"${memberName}" 회원을 목록에서 완전히 삭제하시려면 암호(0000)를 입력하세요.`);
    if (pwd === '0000') {
      await deleteDoc(doc(db, 'members', memberId));
      if (selectedMember && selectedMember.id === memberId) {
        setSelectedMember(null);
      }
      alert('삭제되었습니다.');
    } else if (pwd !== null) {
      alert('암호가 일치하지 않습니다.');
    }
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
    <div 
      className="container" 
      style={{ position: 'relative' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEndFn}
    >
      <div className="card" style={{ position: 'relative' }}>
        <div style={{ position: 'fixed', bottom: '15px', right: '20px', fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 'bold', zIndex: 1000, background: 'rgba(255, 255, 255, 0.8)', padding: '2px 8px', borderRadius: '4px' }}>
          v1.6 (2026.08.11)
        </div>
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
            <img src={hanulLogo} alt="Hanul Logo" style={{ height: '50px', flexShrink: 0, borderRadius: '8px', objectFit: 'cover' }} />
            <h1 style={{ margin: 0 }}>한울타리 주말리그</h1>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '1rem', alignItems: 'center' }}>
            {/* 새로운 주말리그용 탭 4개 */}
            <button onClick={() => setActiveTab('playerSetup')} style={{ padding: '0.6rem 1.2rem', fontSize: '1.15rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'playerSetup' ? 'var(--primary)' : '#E5E7EB', color: activeTab === 'playerSetup' ? 'white' : '#374151' }}>1. 선수 입력</button>
            <button onClick={() => setActiveTab('matchInput')} style={{ padding: '0.6rem 1.2rem', fontSize: '1.15rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'matchInput' ? 'var(--primary)' : '#E5E7EB', color: activeTab === 'matchInput' ? 'white' : '#374151' }}>2. 대진표 및 결과 입력</button>
            <button onClick={() => setActiveTab('rankings')} style={{ padding: '0.6rem 1.2rem', fontSize: '1.15rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'rankings' ? 'var(--primary)' : '#E5E7EB', color: activeTab === 'rankings' ? 'white' : '#374151' }}>3. 결과 및 순위</button>
            <button onClick={() => setActiveTab('history')} style={{ padding: '0.6rem 1.2rem', fontSize: '1.15rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'history' ? 'var(--primary)' : '#E5E7EB', color: activeTab === 'history' ? 'white' : '#374151' }}>4. 리그결과 (기록)</button>
            <button onClick={() => setActiveTab('members')} style={{ padding: '0.6rem 1.2rem', fontSize: '1.15rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'members' ? 'var(--primary)' : '#E5E7EB', color: activeTab === 'members' ? 'white' : '#374151' }}>5. 한울랭킹 ({allMembers.length}명)</button>
            
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
                      setCourtName('');
                      setCourtType('인조잔디');
                      setActiveTab('playerSetup');
                      
                      localStorage.removeItem('currentSessionId');
                      localStorage.removeItem('currentSessionDate');
                      localStorage.removeItem('participatingMembers');
                      localStorage.removeItem('bracketOption');
                      localStorage.removeItem('matchScores');
                      localStorage.removeItem('matchOverrides');
                      localStorage.removeItem('courtName');
                      localStorage.removeItem('courtType');
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
            courtName={courtName}
            setCourtName={setCourtName}
            courtType={courtType}
            setCourtType={setCourtType}
          />
        )}
        {activeTab === 'rankings' && (
          <RankingsView 
            allMembers={allMembers}
            participatingMembers={participatingMembers}
            bracketOption={bracketOption}
            matchScores={matchScores}
            matchOverrides={matchOverrides}
            courtName={courtName}
            courtType={courtType}
          />
        )}
        {activeTab === 'history' && (
          <LeagueHistory 
            savedSessions={savedSessions}
            onLoadSession={loadSession}
            onDeleteSession={deleteSession}
          />
        )}

        {activeTab === 'members' && (
          <div style={{ padding: '0' }}>
            <div style={{ background: '#002865', color: 'white', padding: '2rem', borderRadius: '12px 12px 0 0', marginBottom: '0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '2rem', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '2px' }}>Singles Rankings</h2>
                <p style={{ color: '#93C5FD', margin: 0 }}>Hanultari Official Rankings • {leagueDate}</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={handleAddNewMember}
                  style={{ 
                    background: '#10B981', color: 'white', border: 'none', padding: '0.75rem 1.5rem', 
                    borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
                  }}>
                  <Plus size={18} />
                  신규 회원 추가
                </button>
              </div>
            </div>
            
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '0 0 12px 12px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '550px' }}>
                <thead style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                  <tr>
                    <th onClick={() => handleSort('rank')} style={{ padding: '8px 4px', width: '7%', color: '#6B7280', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center' }}>
                      RANK <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                    <th onClick={() => handleSort('name')} style={{ padding: '8px 4px', width: '18%', color: '#6B7280', fontSize: '0.85rem', cursor: 'pointer' }}>
                      PLAYER <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                    <th onClick={() => handleSort('score')} style={{ padding: '8px 4px', width: '11%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer' }}>
                      L.POINT <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                    <th style={{ padding: '8px 4px', width: '11%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right' }}>
                      R.POINT
                    </th>
                    <th onClick={() => handleSort('gamePoint')} style={{ padding: '8px 4px', width: '11%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer' }}>
                      G.POINT <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                    <th style={{ padding: '8px 4px', width: '10%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right' }}>
                      승률
                    </th>
                    <th style={{ padding: '8px 4px', width: '9%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right' }}>
                      전체승
                    </th>
                    <th style={{ padding: '8px 4px', width: '9%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right' }}>
                      전체패
                    </th>
                    <th onClick={() => handleSort('sumPoint')} style={{ padding: '8px 4px', width: '14%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer', fontWeight: 'bold' }}>
                      SUM <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member) => {
                    const gStats = globalStats[member.id] || { matches: 0, wins: 0, losses: 0, sessionMatches: 0, sessionWins: 0, sessionLosses: 0 };
                    const winRate = gStats.matches > 0 ? ((gStats.wins / gStats.matches) * 100).toFixed(1) + '%' : '-';
                    const baseLPoint = Number(member.score) || 0;
                    const roundPoint = (gStats.sessionWins * 2) + (gStats.sessionMatches * 0.5) + (Number(member.roundPoint) || 0);
                    const gamePoint = Number(member.gamePoint) || 0;
                    const sumPoint = baseLPoint + roundPoint + gamePoint;
                    
                    const rank = member.rank;
                    let baseBg = 'white';
                    let hoverBg = '#F3F4F6';
                    if (rank <= 3) {
                      baseBg = 'rgba(254, 240, 138, 0.4)'; // #FEF08A with opacity
                      hoverBg = 'rgba(254, 240, 138, 0.7)';
                    } else if (rank <= 10) {
                      baseBg = 'rgba(219, 234, 254, 0.5)'; // Light blue (#DBEAFE)
                      hoverBg = 'rgba(219, 234, 254, 0.8)'; // Slightly darker blue on hover
                    }

                    return (
                      <tr 
                      key={member.id} 
                      onClick={() => setSelectedMember(member)}
                      style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.2s', cursor: 'pointer', background: baseBg }} 
                      onMouseOver={e => e.currentTarget.style.background = hoverBg} 
                      onMouseOut={e => e.currentTarget.style.background = baseBg}
                    >
                      <td style={{ padding: '10px 4px', fontSize: '1.1rem', fontWeight: 'bold', color: '#374151', textAlign: 'center' }}>
                        {member.rank}
                      </td>
                      <td style={{ padding: '10px 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ProfileImage member={member} size={40} />
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#002865' }}>
                          {member.name}
                        </div>
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', color: '#4B5563', fontSize: '1rem', fontWeight: 'bold' }}>
                        {baseLPoint.toFixed(1)}
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', color: '#8B5CF6', fontSize: '1rem', fontWeight: 'bold' }}>
                        {roundPoint.toFixed(1)}
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', color: '#4B5563', fontSize: '1rem' }}>
                        {gamePoint.toFixed(0)}
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', color: '#2563EB', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        {winRate}
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', color: '#10B981', fontSize: '0.9rem' }}>
                        {gStats.wins}승
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', color: '#EF4444', fontSize: '0.9rem' }}>
                        {gStats.losses}패
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 'bold', color: '#002865', fontSize: '1.05rem' }}>
                        {sumPoint.toFixed(1)}
                      </td>
                    </tr>
                  )})}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px 20px 0 20px' }}>
              <div style={{ fontSize: '0.9rem', color: '#6B7280' }}>
                * 점수(L.Point)는 리그결과(기록)에 따라 자동으로 갱신됩니다.
              </div>
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
                      <label style={{ display: 'block', fontSize: '0.85rem', color: '#6B7280', marginBottom: '4px' }}>RoundPoint</label>
                      <input type="number" value={selectedMember.roundPoint || 0} onChange={e => setSelectedMember({...selectedMember, roundPoint: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: '#6B7280', marginBottom: '4px' }}>GansigPoint</label>
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

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#6B7280', marginBottom: '4px' }}>입회날짜</label>
                <input type="date" value={selectedMember.joinDate || ''} onChange={e => setSelectedMember({...selectedMember, joinDate: e.target.value})} style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }} />
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
                  onClick={() => handleDeleteMember(selectedMember.id, selectedMember.name)} 
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
