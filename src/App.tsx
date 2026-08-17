import { useState, useEffect, useMemo, useRef } from 'react';
import { Camera, Plus, Trash2, ArrowUpDown, X, User, Users, Edit, Medal, List, Award, BarChart2, Utensils, BookOpen, Download, TrendingUp } from 'lucide-react';
import './index.css';
import membersData from './members.json';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import hanulLogo from './assets/hanul_logo.jpg';
import PlayerSetup from './components/PlayerSetup';
import MatchInput from './components/MatchInput';
import RankingsView from './components/RankingsView';
import LeagueHistory from './components/LeagueHistory';
import MemberStats from './components/MemberStats';
import MealCalculator from './components/MealCalculator';
import HanullogTab from './components/HanullogTab';
import StockRecommendations from './components/StockRecommendations';
import combinations from './data/combinations.json';
import html2canvas from 'html2canvas';

const charToIndex = (c: string) => {
  if (c >= '1' && c <= '9') return parseInt(c) - 1;
  return c.charCodeAt(0) - 'A'.charCodeAt(0) + 9;
};

export interface Member {
  id: string;
  name: string;
  score: number | string;
  previousScore?: number | string;
  gamePoint?: number | string;
  roundPoint?: number | string;
  birthdate: string;
  joinDate?: string;
  age: number | string;
  photoUrl: string;
  nationalPrize?: string;
  snackScoreText?: string;
  extraInfo?: string;
}

export const ProfileImage = ({ member, size = 45 }: { member: Member, size?: number }) => {
  const baseUrl = import.meta.env.BASE_URL;
  const defaultPng = `${baseUrl}player/${member.name}.png`;
  const defaultJpg = `${baseUrl}player/${member.name}.jpg`;
  
  let initialUrl = member.photoUrl;
  if (initialUrl && initialUrl.startsWith('/player/')) {
    initialUrl = baseUrl + 'player/' + initialUrl.split('/player/')[1];
  }
  
  const [imgSrc, setImgSrc] = useState<string | null>(initialUrl || defaultPng);
  const [hasError, setHasError] = useState(false);
  const [retryJpg, setRetryJpg] = useState(false);

  useEffect(() => {
    setImgSrc(initialUrl || defaultPng);
    setHasError(false);
    setRetryJpg(false);
  }, [initialUrl, defaultPng]);

  const handleError = () => {
    if (imgSrc === initialUrl && initialUrl) {
      // 만약 DB에 저장된 photoUrl이 깨졌다면 기본 png로 재시도
      setImgSrc(defaultPng);
    } else if (!retryJpg) {
      setImgSrc(defaultJpg);
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
      style={{ width: size, height: size, aspectRatio: '1/1', borderRadius: '8px', objectFit: 'cover', objectPosition: 'center 15%', flexShrink: 0, border: '1px solid #E5E7EB' }} 
    />
  );
};

function App() {
  const [activeTab, setActiveTab] = useState<'hanullog' | 'match' | 'members' | 'playerSetup' | 'matchInput' | 'rankings' | 'history' | 'stats' | 'meal' | 'aipick'>(() => {
    return (localStorage.getItem('activeTab') as any) || 'members';
  });
  const [slideDir, setSlideDir] = useState<'left'|'right'|''>('');

  const handleTabChange = (newTab: any) => {
    const TABS = ['hanullog', 'playerSetup', 'matchInput', 'rankings', 'history', 'members', 'stats', 'meal'];
    const oldIdx = TABS.indexOf(activeTab);
    const newIdx = TABS.indexOf(newTab);
    if (newIdx > oldIdx) setSlideDir('left');
    else if (newIdx < oldIdx) setSlideDir('right');
    setActiveTab(newTab);
    // 안드로이드 뒤로가기 지원을 위해 history 에 탭 상태 기록
    history.pushState({ tab: newTab }, '', '');
  };
  
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
  const [courtEnv, setCourtEnv] = useState<string>(() => localStorage.getItem('courtEnv') || '야외');

  const [isFinished, setIsFinished] = useState<boolean>(() => {
    return localStorage.getItem('matchInput_isFinished') === 'true';
  });

  type PointHistoryEntry = {
    id: string;
    memberId: string;
    memberName: string;
    type: 'R' | 'G';
    amount: number;
    timestamp: number;
    description?: string;
  };

  const [pointHistory, setPointHistory] = useState<PointHistoryEntry[]>(() => {
    const saved = localStorage.getItem('pointHistory');
    return saved ? JSON.parse(saved) : [];
  });

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
    const yDistanceRaw = touchStartPos.current.y - touchEndPos.current.y;
    const yDistance = Math.abs(yDistanceRaw);
    
    // 상하 스크롤 중이면 무시하되, 맨 위에서 아래로 크게 당기면 새로고침
    if (yDistance > Math.abs(xDistance)) {
      if (window.scrollY <= 0 && yDistanceRaw < -120) {
        window.location.reload();
      }
      return;
    }

    const isLeftSwipe = xDistance > 80;
    const isRightSwipe = xDistance < -80;
    
    if (isLeftSwipe || isRightSwipe) {
      const TABS = ['hanullog', 'playerSetup', 'matchInput', 'rankings', 'history', 'members', 'stats', 'meal'];
      const currentIndex = TABS.indexOf(activeTab);
      
      if (isLeftSwipe && currentIndex < TABS.length - 1) {
        setSlideDir('left');
        setActiveTab(TABS[currentIndex + 1] as any);
      }
      if (isRightSwipe && currentIndex > 0) {
        setSlideDir('right');
        setActiveTab(TABS[currentIndex - 1] as any);
      }
    }
  };

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // 안드로이드 뿔로가기 버튼 처리
  useEffect(() => {
    // 최초 마운트 시 초기 history state 설정
    if (!history.state?.tab) {
      history.replaceState({ tab: activeTab }, '', '');
    }
    const handlePopState = (e: PopStateEvent) => {
      const TABS = ['playerSetup', 'matchInput', 'rankings', 'history', 'members', 'stats', 'meal'];
      const prevTab = e.state?.tab;
      if (prevTab && TABS.includes(prevTab)) {
        const oldIdx = TABS.indexOf(activeTab);
        const newIdx = TABS.indexOf(prevTab);
        if (newIdx > oldIdx) setSlideDir('left');
        else if (newIdx < oldIdx) setSlideDir('right');
        setActiveTab(prevTab);
      } else {
        // 이전 상태가 없으면 첫 탭으로
        history.pushState({ tab: activeTab }, '', '');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab]);

  // 진행 중인 세션이 없을 때는 날짜를 항상 오늘로 유지 (과거 날짜로 새 리그가 생성되는 것 방지)
  useEffect(() => {
    if (!currentSessionId) {
      const today = new Date();
      const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      if (currentSessionDate !== todayStr) {
        setCurrentSessionDate(todayStr);
      }
    }
  }, [currentSessionId, currentSessionDate]);

  const [allMembers, setAllMembers] = useState<Member[]>([]);

  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      if (!snapshot.empty) {
        setAllMembers(snapshot.docs.map(doc => doc.data() as Member));
      } else {
        // 일시적인 네트워크 오류 등으로 snapshot이 비어있을 때 DB 전체가 초기화되는 대참사 방지
        const defaultMembers = membersData as any;
        setAllMembers(defaultMembers);
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

  // 읽기 전용 모드 판단 (7일 초과)
  const isReadOnly = useMemo(() => {
    if (!currentSessionDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionDate = new Date(currentSessionDate);
    sessionDate.setHours(0, 0, 0, 0);
    const diffDays = (today.getTime() - sessionDate.getTime()) / (1000 * 3600 * 24);
    return diffDays > 7;
  }, [currentSessionDate]);

  const forceSaveSession = async (explicitSave = false) => {
    if (isReadOnly) return;
    if (participatingMembers.filter(Boolean).length === 0) return;

    let idToSave = currentSessionId;
    if (!idToSave) {
      idToSave = `${currentSessionDate}_${Date.now()}`;
      setCurrentSessionId(idToSave);
    }

    let finalMatchScores = { ...matchScores };
    let finalOverrides = { ...matchOverrides };
    
    // Defeat Ghost User: filter out stale points from old days
    let finalPointHistory = [...pointHistory];
    let finalMembers = [...participatingMembers];
    let finalIsFinished = localStorage.getItem('matchInput_isFinished') === 'true';

    const existingSession = savedSessions[idToSave];
    
    // Safety: Protect DB from being overwritten by partial/empty local state during auto-save
    if (!explicitSave && existingSession) {
      if (existingSession.matchScores) {
        for (const key of Object.keys(existingSession.matchScores)) {
          if (!finalMatchScores[key]) finalMatchScores[key] = existingSession.matchScores[key];
        }
      }
      if (existingSession.matchOverrides) {
        for (const key of Object.keys(existingSession.matchOverrides)) {
          if (!finalOverrides[key]) finalOverrides[key] = existingSession.matchOverrides[key];
        }
      }
      if (existingSession.participatingMembers && existingSession.participatingMembers.filter(Boolean).length > finalMembers.filter(Boolean).length) {
        finalMembers = existingSession.participatingMembers;
      }
    }
    
    const newSession = {
      id: idToSave,
      date: currentSessionDate,
      participatingMembers: finalMembers,
      bracketOption,
      matchScores: finalMatchScores,
      matchOverrides: finalOverrides,
      courtName,
      courtType,
      courtEnv,
      pointHistory: finalPointHistory,
      isFinished: finalIsFinished,
      isLeagueClosed: finalIsFinished
    };

    localStorage.setItem('currentSessionId', idToSave);
    localStorage.setItem('currentSessionDate', currentSessionDate);
    localStorage.setItem('participatingMembers', JSON.stringify(finalMembers));
    localStorage.setItem('bracketOption', bracketOption);
    localStorage.setItem('matchScores', JSON.stringify(finalMatchScores));
    localStorage.setItem('matchOverrides', JSON.stringify(finalOverrides));
    localStorage.setItem('courtName', courtName);
    localStorage.setItem('courtType', courtType);
    localStorage.setItem('courtEnv', courtEnv);
    localStorage.setItem('pointHistory', JSON.stringify(finalPointHistory));

    try {
      await setDoc(doc(db, 'sessions', idToSave), newSession);
    } catch (e) {
      console.error(e);
    }
  };

  const isInitialMount = useRef(true);

  // Sync isFinished from DB
  useEffect(() => {
    if (currentSessionId && savedSessions[currentSessionId]) {
      const session = savedSessions[currentSessionId];
      const localIsFinished = localStorage.getItem('matchInput_isFinished') === 'true';
      // Sync isFinished from DB with protection against ghost user overwrites
      if (session.isLeagueClosed !== undefined) {
        if (session.isLeagueClosed !== localIsFinished) {
          setIsFinished(session.isLeagueClosed);
          localStorage.setItem('matchInput_isFinished', session.isLeagueClosed.toString());
        }
      } else if (session.isFinished !== undefined) {
        // Legacy fallback: Ghost user might delete isLeagueClosed and set isFinished to false
        // Only accept true from legacy field to prevent ghost user reverting our finish state
        if (session.isFinished === true && !localIsFinished) {
          setIsFinished(true);
          localStorage.setItem('matchInput_isFinished', 'true');
        }
      }
      
      // Sync pointHistory while filtering out ghost user's stale data
      if (session.pointHistory) {
        if (JSON.stringify(session.pointHistory) !== localStorage.getItem('pointHistory')) {
          setPointHistory(session.pointHistory);
          localStorage.setItem('pointHistory', JSON.stringify(session.pointHistory));
        }
      }
      
      // Sync matchScores
      if (session.matchScores && JSON.stringify(session.matchScores) !== localStorage.getItem('matchScores')) {
        setMatchScores(session.matchScores);
        localStorage.setItem('matchScores', JSON.stringify(session.matchScores));
      }
      
      // Sync matchOverrides
      if (session.matchOverrides && JSON.stringify(session.matchOverrides) !== localStorage.getItem('matchOverrides')) {
        setMatchOverrides(session.matchOverrides);
        localStorage.setItem('matchOverrides', JSON.stringify(session.matchOverrides));
      }
      
      // Sync participatingMembers
      if (session.participatingMembers && JSON.stringify(session.participatingMembers) !== localStorage.getItem('participatingMembers')) {
        setParticipatingMembers(session.participatingMembers);
        localStorage.setItem('participatingMembers', JSON.stringify(session.participatingMembers));
      }
      
      // Sync bracketOption
      if (session.bracketOption && session.bracketOption !== localStorage.getItem('bracketOption')) {
        setBracketOption(session.bracketOption);
        localStorage.setItem('bracketOption', session.bracketOption);
      }
    }
  }, [savedSessions, currentSessionId, currentSessionDate]);

  // 주기적 자동 저장 (Auto-save)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      forceSaveSession(false);
    }, 1500); // 1.5초 디바운스

    return () => clearTimeout(timeoutId);
  }, [participatingMembers, bracketOption, matchScores, matchOverrides, currentSessionDate, currentSessionId, courtName, courtType, courtEnv, pointHistory, isFinished]);

  const memberPoints = useMemo(() => {
    const points: Record<string, { g: number, r: number }> = {};
    Object.values(savedSessions).forEach((session: any) => {
      if (session.pointHistory && Array.isArray(session.pointHistory)) {
        session.pointHistory.forEach((p: any) => {
          const name = p.memberName;
          if (!name) return;
          if (!points[name]) points[name] = { g: 0, r: 0 };
          const amt = Number(p.amount) || 0;
          if (p.type === 'G') points[name].g += amt;
          if (p.type === 'R') points[name].r += amt;
        });
      }
    });
    return points;
  }, [savedSessions]);

  const globalStats = useMemo(() => {
    const stats: Record<string, { matches: number, wins: number, losses: number, sessionMatches: number, sessionWins: number, sessionLosses: number, deuceCount: number, adCount: number, duoStats: Record<string, { wins: number, matches: number }>, attendances: number }> = {};
    allMembers.forEach(m => {
      const bWins = Number((m as any).baseWins) || 0;
      const bLosses = Number((m as any).baseLosses) || 0;
      stats[m.id] = { 
        matches: bWins + bLosses, 
        wins: bWins, 
        losses: bLosses,
        sessionMatches: 0,
        sessionWins: 0,
        sessionLosses: 0,
        deuceCount: 0,
        adCount: 0,
        duoStats: {},
        attendances: 0
      };
    });

    Object.values(savedSessions).forEach((session: any) => {
      const mScores = session.matchScores || {};
      let currentCombinations = [...((combinations as Record<string, string[]>)[session.bracketOption] || [])];
      const maxMatchIdx = Math.max(-1, ...Object.keys(mScores).map(k => parseInt(k.split('-')[0], 10)));
      if (maxMatchIdx >= currentCombinations.length) {
        const padCount = maxMatchIdx - currentCombinations.length + 1;
        for (let i = 0; i < padCount; i++) {
          currentCombinations.push("1234");
        }
      }
      const mOverrides = session.matchOverrides || {};
      const pMembers = session.participatingMembers || [];

      pMembers.forEach((m: any) => {
        if (m && m.id && stats[m.id]) {
          stats[m.id].attendances += 1;
        }
      });

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
    setCourtEnv(session.courtEnv || '야외');
    setPointHistory(session.pointHistory || []);
    setActiveTab('rankings'); // 불러오면 결과 화면으로 이동

    localStorage.setItem('currentSessionId', session.id);
    localStorage.setItem('currentSessionDate', session.date);
    localStorage.setItem('participatingMembers', JSON.stringify(session.participatingMembers || Array(5).fill(null)));
    localStorage.setItem('bracketOption', session.bracketOption || '5');
    localStorage.setItem('matchScores', JSON.stringify(session.matchScores || {}));
    localStorage.setItem('matchOverrides', JSON.stringify(session.matchOverrides || {}));
    localStorage.setItem('courtName', session.courtName || '');
    localStorage.setItem('courtType', session.courtType || '인조잔디');
    localStorage.setItem('courtEnv', session.courtEnv || '야외');
  };

  // 리그 삭제 함수 (30일 보관을 위한 백업 포함)
  const deleteSession = async (id: string) => {
    try {
      const sessionToBackup = savedSessions[id];
      if (sessionToBackup) {
        const deletedAt = new Date().toISOString();
        const expireAt = new Date();
        expireAt.setDate(expireAt.getDate() + 30); // 30일 후

        await setDoc(doc(db, 'deleted_sessions', id), {
          ...sessionToBackup,
          deletedAt,
          expireAt: expireAt.toISOString()
        });
      }
      
      await deleteDoc(doc(db, 'sessions', id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      setParticipatingMembers(Array(5).fill(null));
      setBracketOption('5');
      setMatchScores({});
      setMatchOverrides({});
      setCourtName('');
      setCourtType('인조잔디');
      setCourtEnv('야외');
      setPointHistory([]);
      
      const today = new Date();
      const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      setCurrentSessionDate(todayStr);
      
      localStorage.removeItem('currentSessionId');
      localStorage.removeItem('currentSessionDate');
      localStorage.removeItem('participatingMembers');
      localStorage.removeItem('bracketOption');
      localStorage.removeItem('matchScores');
      localStorage.removeItem('matchOverrides');
      localStorage.removeItem('courtName');
      localStorage.removeItem('courtType');
      localStorage.removeItem('courtEnv');
      localStorage.removeItem('pointHistory');
    }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const leagueDate = new Date().toISOString().slice(0, 10);

  const [sortConfig, setSortConfig] = useState<{ key: keyof Member | 'rank' | 'sumPoint' | 'winRate' | 'totalWins' | 'totalLosses'; direction: 'asc' | 'desc' }>({ key: 'rank', direction: 'asc' });
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const rankingTableRef = useRef<HTMLDivElement>(null);

  const handleDownloadBackup = () => {
    try {
      const backupData = {
        members: allMembers,
        sessions: savedSessions,
        timestamp: new Date().toISOString()
      };
      
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const dateStr = new Date().toISOString().split('T')[0];
      const a = document.createElement('a');
      a.href = url;
      a.download = `hanultari_db_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('DB 백업 파일이 성공적으로 다운로드되었습니다.');
    } catch (err) {
      console.error(err);
      alert('백업 다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleCaptureMembersRanking = async () => {
    if (!rankingTableRef.current) return;
    
    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;

    const originalWidth = rankingTableRef.current.style.width;
    const originalMargin = rankingTableRef.current.style.margin;
    
    const captureHeader = document.getElementById('members-capture-header');
    if (captureHeader) {
      captureHeader.style.display = 'flex';
    }

    // 캡처 시 좌우 잘림이나 밀림 방지를 위해 너비는 넓히되 여백을 0으로 강제
    rankingTableRef.current.style.width = 'max-content';
    rankingTableRef.current.style.margin = '0';

    // 스크롤을 최상단으로 옮긴 후 렌더링을 기다림 (iOS 밀림 현상 방지)
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 200));

    try {
      const canvas = await html2canvas(rankingTableRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        width: rankingTableRef.current.scrollWidth,
        windowWidth: rankingTableRef.current.scrollWidth
      });
      
      if (captureHeader) captureHeader.style.display = 'none';
      rankingTableRef.current.style.width = originalWidth;
      rankingTableRef.current.style.margin = originalMargin;
      window.scrollTo(originalScrollX, originalScrollY);

      const filename = `Hanultari_Members_Ranking_${new Date().toISOString().slice(0,10)}.png`;
      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('이미지 생성에 실패했습니다.');
          return;
        }

        // 1. 모바일 및 iOS PWA 환경을 위한 Web Share API 시도
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], filename, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: '한울타리 랭킹',
              });
              return; // 성공 시 종료
            } catch (err) {
              console.log('Share API cancelled or failed:', err);
              // 실패 시 아래 fallback으로 이동
            }
          }
        }

        // 2. 데스크톱 등 Share API 미지원 환경을 위한 일반 다운로드 (Fallback)
        const image = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = image;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(image);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to capture ranking table', err);
      if (captureHeader) captureHeader.style.display = 'none';
      rankingTableRef.current.style.width = originalWidth;
      rankingTableRef.current.style.margin = originalMargin;
      window.scrollTo(originalScrollX, originalScrollY);
      alert('이미지 저장에 실패했습니다.');
    }
  };


  const sortedMembers = useMemo(() => {
    // 순위(RANK)는 이제 SumPoint(dynamic L.Point + GamePoint) 기준으로 계산합니다.
      const getSum = (m: Member) => {
        const sStats = globalStats[m.id] || { sessionMatches: 0, sessionWins: 0 };
        const dynamicLPoint = (Number(m.score) || 0) + (sStats.sessionWins * 2) + (sStats.sessionMatches * 1);
        const computedGPoint = memberPoints[m.name]?.g || 0;
        return computedGPoint + dynamicLPoint;
      };

    const baseSorted = [...allMembers].sort((a, b) => getSum(b) - getSum(a));
    const membersWithRank = baseSorted.map((m, idx) => ({ ...m, rank: idx + 1, sumPoint: getSum(m) }));

    return membersWithRank.sort((a, b) => {
      let valA = a[sortConfig.key as keyof typeof a];
      let valB = b[sortConfig.key as keyof typeof b];

      if (sortConfig.key === 'score') {
        const sStatsA = globalStats[a.id] || { sessionMatches: 0, sessionWins: 0 };
        const lPointA = (Number(a.score) || 0) + (sStatsA.sessionWins * 2) + (sStatsA.sessionMatches * 1);
        const sStatsB = globalStats[b.id] || { sessionMatches: 0, sessionWins: 0 };
        const lPointB = (Number(b.score) || 0) + (sStatsB.sessionWins * 2) + (sStatsB.sessionMatches * 1);
        if (lPointA < lPointB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (lPointA > lPointB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }

      if (sortConfig.key === 'gamePoint') {
        let vA = memberPoints[a.name]?.g || 0;
        let vB = memberPoints[b.name]?.g || 0;
        if (vA < vB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (vA > vB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }

      if (sortConfig.key === 'winRate') {
        const statsA = globalStats[a.id] || { matches: 0, wins: 0 };
        const rateA = statsA.matches > 0 ? (statsA.wins / statsA.matches) : 0;
        const statsB = globalStats[b.id] || { matches: 0, wins: 0 };
        const rateB = statsB.matches > 0 ? (statsB.wins / statsB.matches) : 0;
        if (rateA < rateB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (rateA > rateB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }
      if (sortConfig.key === 'totalWins') {
        const winsA = (globalStats[a.id] || { wins: 0 }).wins;
        const winsB = (globalStats[b.id] || { wins: 0 }).wins;
        if (winsA < winsB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (winsA > winsB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }
      if (sortConfig.key === 'totalLosses') {
        const lossesA = (globalStats[a.id] || { losses: 0 }).losses;
        const lossesB = (globalStats[b.id] || { losses: 0 }).losses;
        if (lossesA < lossesB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (lossesA > lossesB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }

      if (valA! < valB!) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA! > valB!) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allMembers, sortConfig, globalStats]);

  const handleSort = (key: keyof Member | 'rank' | 'sumPoint' | 'winRate' | 'totalWins' | 'totalLosses') => {
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
    const pwd = window.prompt(`"${memberName}" 회원을 목록에서 완전히 삭제하시려면 암호(1982)를 입력하세요.`);
    if (pwd === '1982') {
      try {
        const memberToBackup = allMembers.find(m => m.id === memberId);
        if (memberToBackup) {
          const deletedAt = new Date().toISOString();
          const expireAt = new Date();
          expireAt.setDate(expireAt.getDate() + 30);
          
          await setDoc(doc(db, 'deleted_members', memberId), {
            ...memberToBackup,
            deletedAt,
            expireAt: expireAt.toISOString()
          });
        }
        await deleteDoc(doc(db, 'members', memberId));
      if (selectedMember && selectedMember.id === memberId) {
        setSelectedMember(null);
      }
      alert('삭제되었습니다. (서버의 휴지통에 30일간 보관됩니다.)');
      } catch (err) {
        console.error('Failed to delete member:', err);
        alert('삭제 중 오류가 발생했습니다.');
      }
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
        const SIZE = 300; // 고해상도로 저장
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // cover-crop: 비율 유지하면서 정사각형으로 자르기
          const scale = Math.max(SIZE / img.width, SIZE / img.height);
          const scaledW = img.width * scale;
          const scaledH = img.height * scale;
          // 가로: 중앙 정렬, 세로: 인물(얼굴) 상단 중심 (상단에서 20% 위치)
          const offsetX = (SIZE - scaledW) / 2;
          const offsetY = -(scaledH - SIZE) * 0.2;
          ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
            <img src={hanulLogo} alt="Hanul Logo" style={{ height: '50px', flexShrink: 0, borderRadius: '8px', objectFit: 'cover' }} />
            <h1 style={{ margin: 0, color: '#1E3A8A' }}>한울타리 주말리그</h1>
          </div>
          <div className="tab-nav">
            {/* 새로운 주말리그용 탭 4개 */}
            <button onClick={() => handleTabChange('hanullog')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1.2rem', fontSize: '0.95rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'hanullog' ? 'var(--primary)' : '#EFF6FF', color: activeTab === 'hanullog' ? 'white' : '#2563EB' }}><BookOpen size={18} /> 한울로그</button>
            <button onClick={() => handleTabChange('playerSetup')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1.2rem', fontSize: '0.95rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'playerSetup' ? 'var(--primary)' : '#EFF6FF', color: activeTab === 'playerSetup' ? 'white' : '#2563EB' }}><Users size={18} /> 참가선수</button>
            <button onClick={() => handleTabChange('matchInput')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1.2rem', fontSize: '0.95rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'matchInput' ? 'var(--primary)' : '#EFF6FF', color: activeTab === 'matchInput' ? 'white' : '#2563EB' }}><Edit size={18} /> 결과입력</button>
            <button onClick={() => handleTabChange('rankings')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1.2rem', fontSize: '0.95rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'rankings' ? 'var(--primary)' : '#EFF6FF', color: activeTab === 'rankings' ? 'white' : '#2563EB' }}><Medal size={18} /> 리그순위</button>
            <button onClick={() => handleTabChange('history')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1.2rem', fontSize: '0.95rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'history' ? 'var(--primary)' : '#EFF6FF', color: activeTab === 'history' ? 'white' : '#2563EB' }}><List size={18} /> 리그목록</button>
            <button onClick={() => handleTabChange('members')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1.2rem', fontSize: '0.95rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'members' ? 'var(--primary)' : '#EFF6FF', color: activeTab === 'members' ? 'white' : '#2563EB' }}><Award size={18} /> 한울랭킹</button>
            <button onClick={() => handleTabChange('stats')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1.2rem', fontSize: '0.95rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'stats' ? 'var(--primary)' : '#EFF6FF', color: activeTab === 'stats' ? 'white' : '#2563EB' }}><BarChart2 size={18} /> 멤버통계</button>
            <button onClick={() => handleTabChange('meal')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1.2rem', fontSize: '0.95rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'meal' ? 'var(--primary)' : '#EFF6FF', color: activeTab === 'meal' ? 'white' : '#2563EB' }}><Utensils size={18} /> 밥값정산</button>
            <button onClick={() => handleTabChange('aipick')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1.2rem', fontSize: '0.95rem', borderRadius: '25px', border: 'none', cursor: 'pointer', fontWeight: 'bold', background: activeTab === 'aipick' ? '#3B82F6' : '#EFF6FF', color: activeTab === 'aipick' ? 'white' : '#2563EB' }}><TrendingUp size={18} /> AI 픽</button>
            
            <div className="new-league-wrapper">
                <button 
                  onClick={() => {
                    if (window.confirm("현재 진행 상황을 초기화하고 새 리그를 시작하시겠습니까?")) {
                      const pwd = window.prompt("새 리그 시작을 위한 암호를 입력해주세요.");
                      if (pwd === "1982") {
                        setCurrentSessionId(null);
                        setParticipatingMembers(Array(5).fill(null));
                        setBracketOption('5');
                        setMatchScores({});
                        setMatchOverrides({});
                      setCourtName('');
                      setCourtType('인조잔디');
                      setCourtEnv('야외');
                      setPointHistory([]);
                      setActiveTab('playerSetup');
                      
                      const today = new Date();
                      const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                      setCurrentSessionDate(todayStr);
                      
                      localStorage.removeItem('currentSessionId');
                      localStorage.removeItem('currentSessionDate');
                      localStorage.removeItem('participatingMembers');
                      localStorage.removeItem('bracketOption');
                      localStorage.removeItem('matchScores');
                      localStorage.removeItem('matchOverrides');
                      localStorage.removeItem('courtName');
                      localStorage.removeItem('courtType');
                      localStorage.removeItem('courtEnv');
      localStorage.removeItem('pointHistory');
                      } else if (pwd !== null) {
                        window.alert("암호가 틀렸습니다.");
                      }
                    }
                  }}
                  style={{ padding: '8px 16px', background: '#F59E0B', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  새 리그 시작
                </button>
            </div>
            
          </div>
        </div>

        {/* 신규 화면 컴포넌트 렌더링 */}
        <div key={activeTab} className={slideDir ? (slideDir === 'left' ? 'slide-left' : 'slide-right') : ''} style={{ width: '100%' }}>
        {activeTab === 'hanullog' && (
          <HanullogTab />
        )}
        {activeTab === 'playerSetup' && (
          <div style={isReadOnly ? { pointerEvents: 'none', opacity: 0.8 } : {}}>
            {isReadOnly && <div style={{ padding: '10px', background: '#FEE2E2', color: '#991B1B', textAlign: 'center', fontWeight: 'bold', marginBottom: '15px', borderRadius: '8px' }}>⚠️ 7일이 지난 리그는 읽기 전용입니다. (수정 불가)</div>}
            <PlayerSetup 
              allMembers={allMembers} 
              participatingMembers={participatingMembers} 
              setParticipatingMembers={setParticipatingMembers}
              bracketOption={bracketOption}
              setBracketOption={setBracketOption}
            />
          </div>
        )}
        {activeTab === 'matchInput' && (
          <div style={isReadOnly ? { pointerEvents: 'none', opacity: 0.8 } : {}}>
            {isReadOnly && <div style={{ padding: '10px', background: '#FEE2E2', color: '#991B1B', textAlign: 'center', fontWeight: 'bold', marginBottom: '15px', borderRadius: '8px' }}>⚠️ 7일이 지난 리그는 읽기 전용입니다. (수정 불가)</div>}
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
              courtEnv={courtEnv}
              setCourtEnv={setCourtEnv}
              pointHistory={pointHistory}
              setPointHistory={setPointHistory}
              isFinished={isFinished}
              setIsFinished={setIsFinished}
              forceSave={forceSaveSession}
            />
          </div>
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
            courtEnv={courtEnv}
          />
        )}
        {activeTab === 'history' && (
          <LeagueHistory 
            savedSessions={savedSessions}
            onLoadSession={loadSession}
            onDeleteSession={deleteSession}
          />
        )}
        {activeTab === 'stats' && (
          <MemberStats 
            allMembers={allMembers}
            savedSessions={savedSessions}
            globalStats={globalStats}
            memberPoints={memberPoints}
          />
        )}
        {activeTab === 'aipick' && (
          <StockRecommendations />
        )}
        {activeTab === 'meal' && (
          <MealCalculator 
            allMembers={allMembers}
            savedSessions={savedSessions}
          />
        )}

        {activeTab === 'members' && (
          <div className="content-card">
            <h2 style={{ color: '#1E3A8A', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={24} /> 한울랭킹
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={handleCaptureMembersRanking}
                  style={{ 
                    background: '#3B82F6', color: 'white', border: 'none', padding: '0.5rem 1rem', 
                    borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.9rem'
                  }}>
                  <Camera size={16} /> 전체캡처
                </button>
                <button 
                  onClick={handleDownloadBackup}
                  style={{ 
                    background: '#6B7280', color: 'white', border: 'none', padding: '0.5rem 1rem', 
                    borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.9rem'
                  }}>
                  <Download size={16} /> DB 백업
                </button>
                <button 
                  onClick={handleAddNewMember}
                  style={{ 
                    background: '#10B981', color: 'white', border: 'none', padding: '0.5rem 1rem', 
                    borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.9rem'
                  }}>
                  <Plus size={16} /> 신규 회원
                </button>
              </div>
            </h2>
            <p style={{ color: '#6B7280', margin: '0 0 15px 0', fontSize: '0.9rem' }}>Hanultari Official Rankings • {leagueDate}</p>
            
            <div ref={rankingTableRef} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', overflowX: 'auto' }}>
              <div id="members-capture-header" style={{ display: 'none', alignItems: 'center', justifyContent: 'center', gap: '15px', padding: '20px', background: 'white' }}>
                <img src={hanulLogo} alt="Hanul Logo" style={{ height: '60px', flexShrink: 0, borderRadius: '8px', objectFit: 'cover' }} />
                <div style={{ textAlign: 'center' }}>
                  <h1 style={{ margin: 0, color: '#1E3A8A', fontSize: '1.8rem' }}>한울타리 랭킹</h1>
                  <p style={{ margin: '5px 0 0 0', color: '#6B7280', fontSize: '1rem', fontWeight: 'bold' }}>Hanultari Official Rankings • {leagueDate}</p>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left', minWidth: '550px' }}>
                <thead style={{ background: '#F9FAFB' }}>
                  <tr>
                    <th onClick={() => handleSort('rank')} className="sticky-th-rank" style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB', padding: '8px 2px', width: '40px', minWidth: '40px', color: '#6B7280', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center' }}>
                      RANK
                    </th>
                    <th onClick={() => handleSort('name')} className="sticky-th-player" style={{ background: '#F9FAFB', borderBottom: '2px solid #E5E7EB', padding: '8px 4px', width: '120px', minWidth: '120px', color: '#6B7280', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)' }}>
                      PLAYER <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                    <th onClick={() => handleSort('score')} style={{ padding: '8px 4px', borderBottom: '2px solid #E5E7EB', width: '11%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer' }}>
                      L.PT <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                    <th style={{ padding: '8px 4px', borderBottom: '2px solid #E5E7EB', width: '11%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right' }}>
                      R.PT
                    </th>
                    <th onClick={() => handleSort('gamePoint')} style={{ padding: '8px 4px', borderBottom: '2px solid #E5E7EB', width: '11%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer' }}>
                      G.PT <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                    <th onClick={() => handleSort('winRate')} style={{ padding: '8px 4px', borderBottom: '2px solid #E5E7EB', width: '10%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer' }}>
                      승률 <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                    <th onClick={() => handleSort('totalWins')} style={{ padding: '8px 4px', borderBottom: '2px solid #E5E7EB', width: '9%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer' }}>
                      전체승 <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                    <th onClick={() => handleSort('totalLosses')} style={{ padding: '8px 4px', borderBottom: '2px solid #E5E7EB', width: '9%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer' }}>
                      전체패 <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                    <th onClick={() => handleSort('sumPoint')} style={{ padding: '8px 4px', borderBottom: '2px solid #E5E7EB', width: '14%', color: '#6B7280', fontSize: '0.85rem', textAlign: 'right', cursor: 'pointer', fontWeight: 'bold' }}>
                      SUM <ArrowUpDown size={12} style={{display:'inline', marginLeft:'2px'}}/>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member) => {
                    const gStats = globalStats[member.id] || { matches: 0, wins: 0, losses: 0, sessionMatches: 0, sessionWins: 0, sessionLosses: 0 };
                    const winRate = gStats.matches > 0 ? ((gStats.wins / gStats.matches) * 100).toFixed(1) + '%' : '-';
                    const baseLPoint = (gStats.sessionWins * 2) + (gStats.sessionMatches * 1) + (Number(member.score) || 0);
                    const roundPoint = memberPoints[member.name]?.r || 0;
                    const gamePoint = memberPoints[member.name]?.g || 0;
                    const sumPoint = baseLPoint + roundPoint + gamePoint;
                    
                    const rank = member.rank;
                    let baseBg = 'white';
                    let hoverBg = '#F3F4F6';
                    if (rank <= 3) {
                      baseBg = '#FFF9D0'; // rgba(254, 240, 138, 0.4) on white
                      hoverBg = '#FDF39E'; // rgba(254, 240, 138, 0.7) on white
                    } else if (rank <= 10) {
                      baseBg = '#EDF5FF'; // rgba(219, 234, 254, 0.5) on white
                      hoverBg = '#E2EDFE'; // rgba(219, 234, 254, 0.8) on white
                    }

                    return (
                      <tr 
                      key={member.id} 
                      className="ranking-row"
                      onClick={() => setSelectedMember(member)}
                      style={{ transition: 'background 0.2s', cursor: 'pointer', background: 'var(--base-bg)', '--base-bg': baseBg, '--hover-bg': hoverBg } as any}
                    >
                      <td className="sticky-col sticky-td-rank" style={{ background: 'var(--base-bg)', borderBottom: '1px solid #E5E7EB', padding: '10px 2px', fontSize: '1.1rem', fontWeight: 'bold', color: '#374151', textAlign: 'center', width: '40px', minWidth: '40px' }}>
                        {member.rank}
                      </td>
                      <td className="sticky-col sticky-td-player" style={{ background: 'var(--base-bg)', borderBottom: '1px solid #E5E7EB', padding: '8px 4px', boxShadow: '2px 0 5px -2px rgba(0,0,0,0.1)', minWidth: '60px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <ProfileImage member={member} size={44} />
                          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#002865', whiteSpace: 'nowrap' }}>
                            {member.name}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 4px', borderBottom: '1px solid #E5E7EB', textAlign: 'right', color: '#4B5563', fontSize: '1rem', fontWeight: 'bold' }}>
                        {baseLPoint.toFixed(1)}
                      </td>
                      <td style={{ padding: '10px 4px', borderBottom: '1px solid #E5E7EB', textAlign: 'right', color: '#8B5CF6', fontSize: '1rem', fontWeight: 'bold' }}>
                        {roundPoint.toFixed(1)}
                      </td>
                      <td style={{ padding: '10px 4px', borderBottom: '1px solid #E5E7EB', textAlign: 'right', color: '#4B5563', fontSize: '1rem' }}>
                        {gamePoint.toFixed(1)}
                      </td>
                      <td style={{ padding: '10px 4px', borderBottom: '1px solid #E5E7EB', textAlign: 'right', color: '#2563EB', fontSize: '0.9rem', fontWeight: 'bold' }}>
                        {winRate}
                      </td>
                      <td style={{ padding: '10px 4px', borderBottom: '1px solid #E5E7EB', textAlign: 'right', color: '#10B981', fontSize: '0.9rem' }}>
                        {gStats.wins}승
                      </td>
                      <td style={{ padding: '10px 4px', borderBottom: '1px solid #E5E7EB', textAlign: 'right', color: '#EF4444', fontSize: '0.9rem' }}>
                        {gStats.losses}패
                      </td>
                      <td style={{ padding: '10px 4px', borderBottom: '1px solid #E5E7EB', textAlign: 'right', fontWeight: 'bold', color: '#002865', fontSize: '1.05rem' }}>
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
        <div style={{ textAlign: 'right', marginTop: '20px', fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 'bold' }}>
          v1.7 (2026.08.12)
        </div>
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
            <div style={{ padding: '20px', maxHeight: '75vh', overflowY: 'auto' }}>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '15px' }}>
                <input type="file" id="photo-upload" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                <div 
                  onClick={() => document.getElementById('photo-upload')?.click()}
                  style={{ position: 'relative', cursor: 'pointer', width: '90px', height: '90px', flexShrink: 0 }}
                >
                  <ProfileImage member={selectedMember} size={90} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '0.65rem', textAlign: 'center', padding: '3px 0', borderBottomLeftRadius: '45px', borderBottomRightRadius: '45px' }}>사진 등록</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#6B7280', marginBottom: '4px' }}>이름</label>
                  <input type="text" value={selectedMember.name} onChange={e => setSelectedMember({...selectedMember, name: e.target.value})} style={{ width: '100%', padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: '6px', marginBottom: '8px', fontSize: '0.9rem' }} />
                  
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#6B7280', marginBottom: '3px' }}>L.Point</label>
                      <input type="number" readOnly value={(() => { const s = globalStats[selectedMember.id] || { sessionWins: 0, sessionMatches: 0 }; return (Number(selectedMember.score) || 0) + s.sessionWins * 2 + s.sessionMatches; })()} style={{ width: '100%', padding: '6px 4px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.9rem', background: '#F3F4F6' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#6B7280', marginBottom: '3px' }}>R.Point</label>
                      <input type="number" readOnly value={memberPoints[selectedMember.name]?.r || 0} style={{ width: '100%', padding: '6px 4px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.9rem', background: '#F3F4F6' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#6B7280', marginBottom: '3px' }}>G.Point</label>
                      <input type="number" readOnly value={memberPoints[selectedMember.name]?.g || 0} style={{ width: '100%', padding: '6px 4px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.9rem', background: '#F3F4F6' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#6B7280', marginBottom: '4px' }}>생년월일</label>
                  <input type="date" value={selectedMember.birthdate !== '-' ? selectedMember.birthdate : ''} onChange={e => setSelectedMember({...selectedMember, birthdate: e.target.value})} style={{ display: 'block', width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.85rem' }} />
                </div>
                <div style={{ width: '60px', flexShrink: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#6B7280', marginBottom: '4px' }}>나이</label>
                  <input type="text" value={selectedMember.age} readOnly style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '8px 4px', border: '1px solid #D1D5DB', borderRadius: '6px', background: '#F3F4F6', textAlign: 'center', fontSize: '0.9rem' }} />
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#6B7280', marginBottom: '4px' }}>입회날짜</label>
                <input type="date" value={selectedMember.joinDate || ''} onChange={e => setSelectedMember({...selectedMember, joinDate: e.target.value})} style={{ display: 'block', width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.9rem' }} />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#6B7280', marginBottom: '4px' }}>전국 대회 입상</label>
                <textarea rows={6} value={selectedMember.nationalPrize || ''} onChange={e => setSelectedMember({...selectedMember, nationalPrize: e.target.value})} placeholder={`(2026-08-09) 수원화성배 32강 : 5점\n\n(한울타리페어 점수)\n우승(45), 준우승(30), 입상(20), 8강(13), 16강(8), 32강(5)\n(타클럽페어 점수, 복식/단식/혼복)\n우승(35), 준우승(23), 입상(15), 8강(9), 16강(5), 32강(3)\n(단체전 점수)\n우승(15), 준우승(10), 입상(5점)`} style={{ width: '100%', padding: '12px', border: '1px solid #D1D5DB', borderRadius: '6px', resize: 'vertical', lineHeight: '1.5' }}></textarea>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#6B7280', marginBottom: '4px' }}>간식점수</label>
                <textarea rows={6} value={selectedMember.snackScoreText || ''} onChange={e => setSelectedMember({...selectedMember, snackScoreText: e.target.value})} placeholder={`(2026-08-09) 메가 커피 : 1점\n(간식 점수)\n커피(1), 식사(2)`} style={{ width: '100%', padding: '12px', border: '1px solid #D1D5DB', borderRadius: '6px', resize: 'vertical', lineHeight: '1.5' }}></textarea>
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
