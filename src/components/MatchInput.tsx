import { useState, useEffect, useRef } from 'react';
import { ArrowUpDown, Edit, CheckCircle, Trash2, Camera } from 'lucide-react';
import html2canvas from 'html2canvas';
import combinations from '../data/combinations.json';
import ImagePreviewModal, { type ImagePreviewData } from './ImagePreviewModal';
import hanulLogo from '../assets/hanul_logo.jpg';

const charToIndex = (c: string) => {
  if (c >= '1' && c <= '9') return parseInt(c) - 1;
  return c.charCodeAt(0) - 'A'.charCodeAt(0) + 9;
};

interface MatchInputProps {
  allMembers: any[];
  participatingMembers: any[];
  bracketOption: string;
  matchScores: Record<string, { t1: string, t2: string, video?: string }>;
  setMatchScores: (scores: Record<string, { t1: string, t2: string, video?: string }>) => void;
  matchOverrides: Record<string, Record<number, string>>;
  setMatchOverrides: (overrides: Record<string, Record<number, string>>) => void;
  courtName: string;
  setCourtName: (name: string) => void;
  courtType: string;
  setCourtType: (type: string) => void;
  courtEnv: string;
  setCourtEnv: (env: string) => void;
  pointHistory?: any[];
  setPointHistory?: (history: any[]) => void;
  isFinished?: boolean;
  setIsFinished?: (val: boolean) => void;
  forceSave?: () => void;
}

export default function MatchInput({ allMembers, participatingMembers, bracketOption, matchScores, setMatchScores, matchOverrides, setMatchOverrides, courtName, setCourtName, courtType, setCourtType, courtEnv, setCourtEnv, pointHistory, setPointHistory, isFinished = false, setIsFinished, forceSave }: MatchInputProps) {
  
  const [editModes, setEditModes] = useState<Record<string, boolean>>({});
  const [scoreModal, setScoreModal] = useState<{ matchId: string, t1Name: string, t2Name: string } | null>(null);
  const activeMatchIdRef = useRef<string | null>(null);
  const savedScrollYRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewImage, setPreviewImage] = useState<ImagePreviewData | null>(null);

  const handleClosePreview = () => {
    if (previewImage) {
      URL.revokeObjectURL(previewImage.url);
      setPreviewImage(null);
    }
  };

  const handleOpenScoreModal = (matchId: string, t1Name: string, t2Name: string) => {
    if (isFinished) return;
    savedScrollYRef.current = window.scrollY;
    activeMatchIdRef.current = matchId;
    setScoreModal({ matchId, t1Name, t2Name });
  };

  const handleCloseScoreModal = (save = false) => {
    const currentMatchId = activeMatchIdRef.current;
    const savedY = savedScrollYRef.current;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setScoreModal(null);

    if (save && forceSave) {
      forceSave();
    }

    const restoreScroll = () => {
      if (currentMatchId) {
        const el = document.getElementById(`match-row-${currentMatchId}`);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
      }
      if (savedY !== null && savedY !== undefined) {
        window.scrollTo({ top: savedY, behavior: 'smooth' });
      }
    };

    requestAnimationFrame(restoreScroll);
    setTimeout(restoreScroll, 50);
    setTimeout(restoreScroll, 150);
    setTimeout(restoreScroll, 300);
  };

  const handleDownloadImage = async () => {
    if (!contentRef.current || isCapturing) return;
    setIsCapturing(true);

    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;

    // 스크롤을 최상단으로 옮긴 후 렌더링 대기 (모바일 밀림 현상 방지)
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 200));

    const CAPTURE_WIDTH = 760;

    try {
      // 모바일 기기에서도 고정 너비(760px) 기준 3배수(2280px) 초고해상도로 렌더링
      const canvas = await html2canvas(contentRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: CAPTURE_WIDTH,
        onclone: (clonedDoc) => {
          // 1. 헤더 전환: 저장용 고화질 헤더 표시, 앱 상단 헤더 숨김
          const printTitle = clonedDoc.querySelector('.match-print-title') as HTMLElement;
          if (printTitle) printTitle.style.display = 'flex';

          const appHeader = clonedDoc.querySelector('.match-app-header') as HTMLElement;
          if (appHeader) appHeader.style.display = 'none';

          // 2. 포인트 내역이 비어있으면 포인트 섹션 전체 숨기기
          const pointSection = clonedDoc.querySelector('.match-point-section') as HTMLElement;
          if (pointSection && (!pointHistory || pointHistory.length === 0)) {
            pointSection.style.display = 'none';
          }

          // 3. 캡처 대상 컨테이너를 가로 760px 고정으로 설정하여 모바일에서도 데스크톱 비율로 정돈
          const clonedCard = clonedDoc.querySelector('.match-input-container') as HTMLElement || clonedDoc.querySelector('.content-card') as HTMLElement;
          if (clonedCard) {
            clonedCard.style.width = `${CAPTURE_WIDTH}px`;
            clonedCard.style.maxWidth = `${CAPTURE_WIDTH}px`;
            clonedCard.style.minWidth = `${CAPTURE_WIDTH}px`;
            clonedCard.style.margin = '0 auto';
            clonedCard.style.padding = '20px';
            clonedCard.style.boxSizing = 'border-box';
            clonedCard.style.background = '#ffffff';
          }

          if (clonedDoc.body) {
            clonedDoc.body.style.width = `${CAPTURE_WIDTH}px`;
            clonedDoc.body.style.minWidth = `${CAPTURE_WIDTH}px`;
          }

          // 4. 점수 버튼 투명도 복원 (마감 상태에서도 선명한 그린으로 표시)
          const scoreBtns = clonedDoc.querySelectorAll('button');
          scoreBtns.forEach((btn) => {
            if (btn.style && btn.style.opacity) {
              btn.style.opacity = '1';
            }
          });

          // 5. 텍스트 안티앨리어싱
          const allTextElements = clonedDoc.querySelectorAll('*');
          allTextElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style) {
              (htmlEl.style as any).webkitFontSmoothing = 'antialiased';
              htmlEl.style.textRendering = 'optimizeLegibility';
            }
          });
        }
      });

      window.scrollTo(originalScrollX, originalScrollY);

      const today = new Date();
      const dateStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const filename = `한울타리_결과입력_${dateStr}.png`;

      canvas.toBlob(async (blob) => {
        setIsCapturing(false);
        if (!blob) {
          alert('이미지 생성에 실패했습니다.');
          return;
        }

        const isAndroid = /Android/i.test(navigator.userAgent);
        const isKakao = /KAKAOTALK/i.test(navigator.userAgent);
        const imageUrl = URL.createObjectURL(blob);

        // 1. 안드로이드 및 카카오톡 인앱 브라우저: 이미지 저장 화면(모달) 표시
        if (isAndroid || isKakao) {
          setPreviewImage({ url: imageUrl, blob, filename });
          return;
        }

        // 2. iOS 등 Web Share API 지원 환경
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], filename, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: '한울타리 결과 입력',
              });
              URL.revokeObjectURL(imageUrl);
              return;
            } catch (err: any) {
              if (err?.name !== 'AbortError') {
                console.log('Share API cancelled or failed:', err);
              }
            }
          }
        }

        // 3. 데스크톱 등 일반 다운로드 (Fallback)
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(imageUrl);
      }, 'image/png');
    } catch (error) {
      setIsCapturing(false);
      window.scrollTo(originalScrollX, originalScrollY);
      console.error('Failed to generate image', error);
      alert('이미지 생성에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (Object.keys(matchScores).length === 0 && setIsFinished) {
      setIsFinished(false);
      localStorage.setItem('matchInput_isFinished', 'false');
    }
  }, [matchScores]);

  const [pointMemberId, setPointMemberId] = useState('');
  const [pointType, setPointType] = useState('G');
  const [pointAmount, setPointAmount] = useState('1');
  const [pointDesc, setPointDesc] = useState('');
  
  let currentCombinations = [...((combinations as Record<string, string[]>)[bracketOption] || [])];
  const maxMatchIdx = Math.max(-1, ...Object.keys(matchScores).map(k => parseInt(k.split('-')[0], 10)));
  if (maxMatchIdx >= currentCombinations.length) {
    const padCount = maxMatchIdx - currentCombinations.length + 1;
    for (let i = 0; i < padCount; i++) {
      currentCombinations.push("1234");
    }
  }

  const handleScoreChange = (matchId: string, team: 't1' | 't2', value: string) => {
    if (value !== '') {
      let numValue = parseInt(value, 10);
      if (numValue > 6) value = "6";
      if (numValue < 0) value = "0";
    }
    setMatchScores({
      ...matchScores,
      [matchId]: {
        ...(matchScores[matchId] || { t1: '', t2: '' }),
        [team]: value
      }
    });
  };

  const handleVideoChange = (matchId: string, value: string) => {
    setMatchScores({
      ...matchScores,
      [matchId]: {
        ...(matchScores[matchId] || { t1: '', t2: '' }),
        video: value
      }
    });
  };

  const handleOverrideChange = (matchId: string, posIdx: number, memberId: string) => {
    setMatchOverrides({
      ...matchOverrides,
      [matchId]: {
        ...(matchOverrides[matchId] || {}),
        [posIdx]: memberId
      }
    });
  };

  const toggleEditMode = (matchId: string) => {
    setEditModes({
      ...editModes,
      [matchId]: !editModes[matchId]
    });
  };

  const handleSwapCourt = (matchId: string, pos1: number, pos2: number, id1: string, id2: string) => {
    setMatchOverrides({
      ...matchOverrides,
      [matchId]: {
        ...(matchOverrides[matchId] || {}),
        [pos1]: id2,
        [pos2]: id1
      }
    });
  };

  const handleFinishMatches = () => {
    let missing = false;
    currentCombinations.forEach((matchStr, matchIdx) => {
      let matchSubIdx = 0;
      for (let i = 0; i < matchStr.length; i += 4) {
        const sub = matchStr.slice(i, i + 4);
        if (sub.length === 4) {
          const matchId = `${matchIdx}-${matchSubIdx}`;
          const score = matchScores[matchId];
          if (!score || score.t1 === '' || score.t2 === '') {
            missing = true;
          }
          matchSubIdx++;
        }
      }
    });

    if (missing) {
      alert('입력되지 않은 경기 결과가 있습니다. 모든 경기 결과를 확인해주세요!');
    } else {
      if (setIsFinished) setIsFinished(true);
      localStorage.setItem('matchInput_isFinished', 'true');
      alert('마감되었습니다. 점수를 수정하시려면 [수정] 버튼을 클릭하세요.');
      if (forceSave) forceSave();
    }
  };

  const handleEditMode = () => {
    const pwd = window.prompt("마감을 해제하시려면 암호를 입력하세요:");
    if (pwd === "1982") {
      if (setIsFinished) setIsFinished(false);
      localStorage.setItem('matchInput_isFinished', 'false');
    } else if (pwd !== null) {
      alert("암호가 일치하지 않습니다.");
    }
  };

  const handleAddPoint = async () => {
    if (!pointMemberId || !pointHistory || !setPointHistory) return;
    const amount = parseInt(pointAmount) || 1;
    
    try {
      const member = allMembers.find(m => m && m.id === pointMemberId);
      const newEntry = {
        id: Date.now().toString(),
        memberId: pointMemberId,
        memberName: member ? member.name : '',
        type: pointType,
        amount,
        timestamp: Date.now(),
        description: pointDesc.trim()
      };
      setPointHistory([...pointHistory, newEntry]);
      
      setPointMemberId('');
      setPointAmount('1');
      setPointDesc('');
    } catch (e) {
      alert('포인트 저장에 실패했습니다.');
    }
  };

  const handleRemovePoint = async (entry: any) => {
    if (!window.confirm(`'${entry.description}' 내역을 삭제하시겠습니까?`)) return;
    if (!pointHistory || !setPointHistory) return;
    try {
      setPointHistory(pointHistory.filter(h => h.id !== entry.id));
    } catch (e) {
      alert('포인트 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="content-card match-input-container" ref={contentRef}>
      {/* 캡처/저장용 고화질 상단 헤더 */}
      <div className="match-print-title" style={{ display: 'none', alignItems: 'center', justifyContent: 'center', gap: '15px', padding: '10px 0 16px 0', borderBottom: '2px solid #E5E7EB', marginBottom: '16px' }}>
        <img src={hanulLogo} alt="Hanul Logo" style={{ height: '48px', flexShrink: 0, borderRadius: '8px', objectFit: 'cover' }} />
        <div>
          <h1 style={{ margin: 0, color: '#1E3A8A', fontSize: '1.6rem', fontWeight: '800' }}>한울타리 주말리그 경기 결과</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.9rem', color: '#4B5563', flexWrap: 'wrap' }}>
            <span>📅 {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
            <span>·</span>
            <span>👥 참가 {participatingMembers.filter(Boolean).length}명 ({bracketOption})</span>
            <span>·</span>
            <span style={{ fontWeight: '600', color: '#1E40AF' }}>📍 {courtName ? `${courtName} (${courtType}, ${courtEnv})` : `${courtType} (${courtEnv})`}</span>
          </div>
        </div>
      </div>

      {/* 웹 화면용 상단 헤더 */}
      <div className="match-app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px', marginBottom: '20px' }}>
        <h2 style={{ color: '#1E3A8A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Edit size={24} /> 결과 입력
        </h2>
        <div style={{ display: 'flex', gap: '10px' }} data-html2canvas-ignore="true">
          <button 
            onClick={handleDownloadImage}
            disabled={isCapturing}
            style={{ background: isCapturing ? '#9CA3AF' : '#4B5563', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: isCapturing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
          >
            <Camera size={18} />
            {isCapturing ? '이미지 생성 중...' : '이미지 저장'}
          </button>
          {isFinished && (
            <button 
              onClick={handleEditMode}
              style={{ background: '#3B82F6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
            >
              <Edit size={18} />
              수정
            </button>
          )}
          <button 
            onClick={handleFinishMatches}
            disabled={isFinished}
            style={{ background: isFinished ? '#9CA3AF' : '#10B981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: isFinished ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
          >
            <CheckCircle size={18} />
            {isFinished ? '마감됨' : '마감'}
          </button>
        </div>
      </div>
      
      {/* 안내 박스 - 캡처 시 무시 */}
      <div data-html2canvas-ignore="true" style={{ marginBottom: '20px', background: '#F3F4F6', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 5px 0' }}>현재 참가 인원: {participatingMembers.length}명 (설정: {bracketOption})</h3>
          <p style={{ color: '#6B7280', margin: 0, fontSize: '0.9rem' }}>자동 생성된 대진표에 각 라운드의 경기 결과를 입력하세요.</p>
        </div>
      </div>

      {currentCombinations.length === 0 ? (
        <p>선택된 대진이 없습니다. 1번 탭에서 인원을 설정해주세요.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* 코트 정보 입력 - 캡처 시 무시 (헤더에 이미 포함됨) */}
          <div className="match-court-input-section" data-html2canvas-ignore="true" style={{ display: 'flex', gap: '15px', background: '#EFF6FF', padding: '15px', borderRadius: '8px', border: '1px solid #BFDBFE', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: '#1E3A8A', fontWeight: 'bold', marginBottom: '5px' }}>코트명 입력</label>
              <input 
                type="text" 
                list="court-list"
                value={courtName} 
                onChange={e => setCourtName(e.target.value)} 
                placeholder="직접 입력 또는 선택" 
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #93C5FD', fontSize: '1rem' }} 
              />
              <datalist id="court-list">
                <option value="화성-상신리" />
                <option value="수원-북중" />
                <option value="화성-도로공사" />
                <option value="화성-테니스연구소" />
                <option value="화성-루트82" />
                <option value="화성-팔탄" />
                <option value="군포-산본IC" />
                <option value="군포-시립" />
                <option value="안양-안양교도소" />
                <option value="의왕-구치소" />
                <option value="안양-새물공원" />
                <option value="안성-종합" />
                <option value="안산-시립" />
                <option value="수원-만석" />
                <option value="수원-호매실" />
                <option value="오산-시립" />
                <option value="오산-죽미" />
              </datalist>
            </div>
            <div style={{ width: '120px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: '#1E3A8A', fontWeight: 'bold', marginBottom: '5px' }}>장소</label>
              <select value={courtEnv} onChange={e => setCourtEnv(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #93C5FD', fontSize: '1rem' }}>
                <option value="야외">야외(실외)</option>
                <option value="실내">실내</option>
              </select>
            </div>
            <div style={{ width: '130px' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: '#1E3A8A', fontWeight: 'bold', marginBottom: '5px' }}>코트종류</label>
              <select value={courtType} onChange={e => setCourtType(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #93C5FD', fontSize: '1rem' }}>
                <option value="인조잔디">인조잔디</option>
                <option value="하드코트">하드코트</option>
                <option value="클레이코트">클레이코트</option>
              </select>
            </div>
          </div>

          {currentCombinations.map((matchStr, matchIdx) => {
            const matchesInRound = [];
            for (let i = 0; i < matchStr.length; i += 4) {
              const sub = matchStr.slice(i, i + 4);
              if (sub.length === 4) matchesInRound.push(sub);
            }

            return (
              <div key={matchIdx} style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '15px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 10px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h4 style={{ margin: 0, color: '#374151' }}>{matchIdx + 1} 경기</h4>
                    {matchesInRound.map((_, idx) => {
                      const matchId = `${matchIdx}-${idx}`;
                      const isEditing = editModes[matchId];
                      return (
                        <button 
                          key={matchId}
                          data-html2canvas-ignore="true"
                          onClick={() => toggleEditMode(matchId)}
                          style={{ 
                            padding: '2px 8px', 
                            fontSize: '0.8rem', 
                            background: isEditing ? '#EF4444' : '#E5E7EB', 
                            color: isEditing ? 'white' : '#4B5563', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer' 
                          }}
                        >
                          {isEditing ? '완료' : (matchesInRound.length > 1 ? `${idx + 1}코트 선수수정` : '선수수정')}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {matchesInRound.map((_, idx) => {
                      const matchId = `${matchIdx}-${idx}`;
                      const score = matchScores[matchId] || { t1: '', t2: '' };
                      return (
                        <div key={`video-${matchId}`} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div data-html2canvas-ignore="true" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {matchesInRound.length > 1 && <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{idx + 1}코트:</span>}
                            <input
                              type="text"
                              placeholder="유튜브 URL"
                              value={score.video || ''}
                              onChange={(e) => handleVideoChange(matchId, e.target.value)}
                              disabled={isFinished}
                              style={{
                                width: '100px',
                                padding: '4px 6px',
                                fontSize: '0.75rem',
                                borderRadius: '4px',
                                border: '1px solid #D1D5DB',
                                background: isFinished ? '#F3F4F6' : 'white',
                                color: isFinished ? '#9CA3AF' : 'inherit'
                              }}
                            />
                          </div>
                          {score.video && (
                            <a href={score.video} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#EF4444', textDecoration: 'none', fontWeight: 'bold' }}>
                              ▶ 영상보기
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ width: '100%' }}>
                  {matchesInRound.map((mStr, idx) => {
                    const matchId = `${matchIdx}-${idx}`;
                  const p1 = participatingMembers[charToIndex(mStr[0])];
                  const p2 = participatingMembers[charToIndex(mStr[1])];
                  const p3 = participatingMembers[charToIndex(mStr[2])];
                  const p4 = participatingMembers[charToIndex(mStr[3])];
                  
                  const p1Id = matchOverrides[matchId]?.[0] || p1?.id;
                  const p2Id = matchOverrides[matchId]?.[1] || p2?.id;
                  const p3Id = matchOverrides[matchId]?.[2] || p3?.id;
                  const p4Id = matchOverrides[matchId]?.[3] || p4?.id;

                  const isEditing = editModes[matchId];

                  const getPlayerName = (pId: string | undefined, fallbackStr: string) => {
                    const member = allMembers.find(m => m.id === pId);
                    return member ? member.name : fallbackStr;
                  };

                  const p1NameStr = getPlayerName(p1Id, p1 ? p1.name : `선수${charToIndex(mStr[0]) + 1}`);
                  const p2NameStr = getPlayerName(p2Id, p2 ? p2.name : `선수${charToIndex(mStr[1]) + 1}`);
                  const p3NameStr = getPlayerName(p3Id, p3 ? p3.name : `선수${charToIndex(mStr[2]) + 1}`);
                  const p4NameStr = getPlayerName(p4Id, p4 ? p4.name : `선수${charToIndex(mStr[3]) + 1}`);
                  
                  const t1Name = `${p1NameStr} & ${p2NameStr}`;
                  const t2Name = `${p3NameStr} & ${p4NameStr}`;

                  const PlayerSelect = ({ posIdx, val }: { posIdx: number, val: string }) => (
                    <select 
                      value={val || ''}
                      onChange={(e) => handleOverrideChange(matchId, posIdx, e.target.value)}
                      style={{ padding: '2px 4px', borderRadius: '4px', border: '1px solid #D1D5DB', fontSize: '0.85rem', width: '80px' }}
                    >
                      <option value="">--선택--</option>
                      {[...allMembers].sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  );

                  const score = matchScores[matchId] || { t1: '', t2: '' };

                  return (
                    <div key={idx} id={`match-row-${matchId}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F9FAFB', padding: '10px', borderRadius: '6px', marginBottom: '10px', scrollMargin: '120px' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end', paddingRight: '5px' }}>
                        {isEditing ? (
                          <>
                            <PlayerSelect posIdx={0} val={p1Id} />
                            <PlayerSelect posIdx={1} val={p2Id} />
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                              <span style={{ fontWeight: 'bold', color: '#0369A1', whiteSpace: 'nowrap' }}><span style={{color:'#6B7280', marginRight:'4px'}}>(A)</span>{p1NameStr}</span>
                              <span style={{ fontWeight: 'bold', color: '#0369A1', whiteSpace: 'nowrap' }}><span style={{color:'#6B7280', marginRight:'4px'}}>(D)</span>{p2NameStr}</span>
                            </div>
                            <button data-html2canvas-ignore="true" onClick={() => handleSwapCourt(matchId, 0, 1, p1Id || '', p2Id || '')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#9CA3AF' }} title="듀스/애드 변경"><ArrowUpDown size={14} /></button>
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button 
                          onClick={() => handleOpenScoreModal(matchId, t1Name, t2Name)}
                          disabled={isFinished}
                          style={{ 
                            padding: '8px 12px', 
                            fontSize: '1.2rem', 
                            fontWeight: 'bold', 
                            background: (score.t1 !== '' || score.t2 !== '') ? '#10B981' : '#F3F4F6',
                            color: (score.t1 !== '' || score.t2 !== '') ? 'white' : '#9CA3AF',
                            border: (score.t1 !== '' || score.t2 !== '') ? 'none' : '1px dashed #D1D5DB',
                            borderRadius: '8px',
                            cursor: isFinished ? 'not-allowed' : 'pointer',
                            minWidth: '80px',
                            whiteSpace: 'nowrap',
                            opacity: isFinished ? 0.8 : 1
                          }}
                        >
                          {score.t1 !== '' || score.t2 !== '' ? `${score.t1} : ${score.t2}` : '점수 입력'}
                        </button>
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-start', paddingLeft: '5px' }}>
                        {isEditing ? (
                          <>
                            <PlayerSelect posIdx={2} val={p3Id} />
                            <PlayerSelect posIdx={3} val={p4Id} />
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <button data-html2canvas-ignore="true" onClick={() => handleSwapCourt(matchId, 2, 3, p3Id || '', p4Id || '')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#9CA3AF' }} title="듀스/애드 변경"><ArrowUpDown size={14} /></button>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
                              <span style={{ fontWeight: 'bold', color: '#6D28D9', whiteSpace: 'nowrap' }}>{p3NameStr}<span style={{color:'#6B7280', marginLeft:'4px'}}>(D)</span></span>
                              <span style={{ fontWeight: 'bold', color: '#6D28D9', whiteSpace: 'nowrap' }}>{p4NameStr}<span style={{color:'#6B7280', marginLeft:'4px'}}>(A)</span></span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 포인트 부여 미니 입력창 */}
      <div className="match-point-section" style={{ marginTop: '30px', padding: '15px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#1F2937', fontSize: '1.1rem' }}>🎁 일일 포인트 추가</h3>
        <div data-html2canvas-ignore="true" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select 
            value={pointMemberId} 
            onChange={e => setPointMemberId(e.target.value)}
            disabled={isFinished}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', flex: 1, minWidth: '120px', fontSize: '1rem', background: isFinished ? '#F3F4F6' : 'white', color: isFinished ? '#9CA3AF' : 'inherit' }}
          >
            <option value="">선수 선택</option>
            {[...allMembers].filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)).map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select
            value={pointType}
            onChange={e => setPointType(e.target.value)}
            disabled={isFinished}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', width: '110px', fontSize: '1rem', background: isFinished ? '#F3F4F6' : 'white', color: isFinished ? '#9CA3AF' : 'inherit' }}
          >
            <option value="G">G.Point</option>
            <option value="R">R.Point</option>
          </select>
          <input
            type="number"
            value={pointAmount}
            onChange={e => setPointAmount(e.target.value)}
            disabled={isFinished}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', width: '70px', textAlign: 'center', fontSize: '1rem', background: isFinished ? '#F3F4F6' : 'white', color: isFinished ? '#9CA3AF' : 'inherit' }}
          />
          <input
            type="text"
            placeholder="내역 (예: 화성배 우승, 커피)"
            value={pointDesc}
            onChange={e => setPointDesc(e.target.value)}
            disabled={isFinished}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', flex: 2, minWidth: '150px', fontSize: '1rem', background: isFinished ? '#F3F4F6' : 'white', color: isFinished ? '#9CA3AF' : 'inherit' }}
          />
          <button 
            onClick={handleAddPoint}
            disabled={isFinished}
            style={{ padding: '10px 18px', background: isFinished ? '#9CA3AF' : '#10B981', color: 'white', border: 'none', borderRadius: '6px', cursor: isFinished ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
          >
            부여
          </button>
        </div>
        
        {pointHistory && pointHistory.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#6B7280' }}>오늘 부여 내역</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {pointHistory.map(entry => (
                <li key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E5E7EB', fontSize: '0.9rem' }}>
                  <span>
                    <strong style={{ color: '#111827' }}>{entry.memberName}</strong> ({entry.type}.Point) 
                    <span style={{ color: entry.amount > 0 ? '#10B981' : '#EF4444', marginLeft: '4px', fontWeight: 'bold' }}>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</span>
                    {entry.description && <span style={{ color: '#6B7280', marginLeft: '8px', fontSize: '0.85rem' }}>- {entry.description}</span>}
                  </span>
                  <button data-html2canvas-ignore="true" onClick={() => handleRemovePoint(entry)} disabled={isFinished} style={{ background: 'transparent', border: 'none', color: isFinished ? '#9CA3AF' : '#EF4444', cursor: isFinished ? 'not-allowed' : 'pointer', padding: '2px' }} title="취소"><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 팝업 모달 */}
      {scoreModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseScoreModal(false);
            }
          }}
          style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '30px', fontSize: '1.8rem', color: '#1F2937' }}>점수 입력</h2>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#0369A1', marginBottom: '15px' }}>{scoreModal.t1Name}</div>
                <input 
                  type="number"
                  min="0" max="6"
                  value={matchScores[scoreModal.matchId]?.t1 || ''} 
                  onChange={(e) => handleScoreChange(scoreModal.matchId, 't1', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCloseScoreModal(true);
                  }}
                  style={{ width: '100px', padding: '15px', fontSize: '2.5rem', textAlign: 'center', border: '2px solid #0369A1', borderRadius: '8px' }}
                  autoFocus
                />
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#9CA3AF', padding: '0 20px' }}>:</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#6D28D9', marginBottom: '15px' }}>{scoreModal.t2Name}</div>
                <input 
                  type="number"
                  min="0" max="6"
                  value={matchScores[scoreModal.matchId]?.t2 || ''} 
                  onChange={(e) => handleScoreChange(scoreModal.matchId, 't2', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCloseScoreModal(true);
                  }}
                  style={{ width: '100px', padding: '15px', fontSize: '2.5rem', textAlign: 'center', border: '2px solid #6D28D9', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={() => handleCloseScoreModal(false)}
                style={{ flex: 1, padding: '15px', fontSize: '1.2rem', background: '#E5E7EB', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                닫기
              </button>
              <button 
                onClick={() => handleCloseScoreModal(true)}
                style={{ flex: 1, padding: '15px', fontSize: '1.2rem', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 안드로이드 / 모바일용 고화질 이미지 저장 팝업 모달 */}
      <ImagePreviewModal
        preview={previewImage}
        onClose={handleClosePreview}
        title="결과 입력표 저장"
        shareTitle="한울타리 결과 입력"
      />
    </div>
  );
}
