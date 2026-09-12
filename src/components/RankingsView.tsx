import { useMemo, useRef, useState } from 'react';
import combinations from '../data/combinations.json';
import html2canvas from 'html2canvas';
import { Camera, Medal, Download, Share2, X } from 'lucide-react';
import hanulLogo from '../assets/hanul_logo.jpg';

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
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; blob: Blob; filename: string } | null>(null);

  const handleClosePreview = () => {
    if (previewImage) {
      URL.revokeObjectURL(previewImage.url);
      setPreviewImage(null);
    }
  };

  const handleDownloadDirect = () => {
    if (!previewImage) return;
    const link = document.createElement('a');
    link.href = previewImage.url;
    link.download = previewImage.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareFromModal = async () => {
    if (!previewImage) return;
    if (navigator.share && navigator.canShare) {
      const file = new File([previewImage.blob], previewImage.filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: '한울타리 주말리그 결과',
          });
          return;
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.log('Share API error:', err);
          }
        }
      }
    } else {
      alert('현재 브라우저에서는 공유 기능을 지원하지 않습니다. 이미지를 꾹 눌러 저장해 주세요.');
    }
  };

  const handleCapture = async () => {
    if (!tableRef.current || isCapturing) return;
    setIsCapturing(true);
    
    // 캡처 전 모바일 가로 스크롤 이슈를 피하기 위해 일시적으로 스크롤 컨테이너 해제
    const scrollContainer = tableRef.current.querySelector('.ranking-scroll-container') as HTMLElement;
    let originalOverflow = '';
    if (scrollContainer) {
      originalOverflow = scrollContainer.style.overflowX;
      scrollContainer.style.overflowX = 'visible';
    }

    const printTitle = tableRef.current.querySelector('.print-title') as HTMLElement;
    if (printTitle) {
      printTitle.style.display = 'flex';
    }

    const printMatches = tableRef.current.querySelector('.print-matches') as HTMLElement;
    if (printMatches) {
      printMatches.style.display = 'block';
    }

    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;

    const originalWidth = tableRef.current.style.width;
    const originalMargin = tableRef.current.style.margin;
    
    // 캡처 시 좌우 잘림이나 밀림 방지를 위해 너비는 넓히되 여백을 0으로 강제
    tableRef.current.style.width = 'max-content';
    tableRef.current.style.margin = '0';

    // 스크롤을 최상단으로 옮긴 후 렌더링을 기다림 (iOS 밀림 현상 방지)
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 200));

    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        width: tableRef.current.scrollWidth,
        windowWidth: tableRef.current.scrollWidth
      });
      
      tableRef.current.style.width = originalWidth;
      tableRef.current.style.margin = originalMargin;
      window.scrollTo(originalScrollX, originalScrollY);

      if (printTitle) {
        printTitle.style.display = 'none';
      }
      if (printMatches) {
        printMatches.style.display = 'none';
      }
      if (scrollContainer) {
        scrollContainer.style.overflowX = originalOverflow;
      }
      const today = new Date();
      const dateStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const filename = `한울타리_경기결과_${dateStr}.png`;

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
                title: '한울타리 주말리그 결과',
              });
              URL.revokeObjectURL(imageUrl);
              return; // 성공 시 종료
            } catch (err: any) {
              if (err.name !== 'AbortError') {
                console.log('Share API cancelled or failed:', err);
              }
              // 실패 시 아래 fallback으로 이동
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
      
    } catch (err) {
      console.error('Failed to capture image', err);
      setIsCapturing(false);
      // 에러 발생 시에도 복구
      tableRef.current.style.width = originalWidth;
      window.scrollTo(originalScrollX, originalScrollY);

      if (printTitle) {
        printTitle.style.display = 'none';
      }
      if (printMatches) {
        printMatches.style.display = 'none';
      }
      if (scrollContainer) {
        scrollContainer.style.overflowX = originalOverflow;
      }
      alert('이미지 저장 중 오류가 발생했습니다.');
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
    let currentCombinations = [...((combinations as Record<string, string[]>)[bracketOption] || [])];
    const maxMatchIdx = Math.max(-1, ...Object.keys(matchScores).map(k => parseInt(k.split('-')[0], 10)));
    if (maxMatchIdx >= currentCombinations.length) {
      const padCount = maxMatchIdx - currentCombinations.length + 1;
      for (let i = 0; i < padCount; i++) {
        currentCombinations.push("1234");
      }
    }
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
        <h2 style={{ color: '#1E3A8A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Medal size={24} /> 리그 순위
        </h2>
        <div style={{ display: 'flex', gap: '10px' }}>

          <button 
            onClick={handleCapture}
            disabled={isCapturing}
            style={{ 
              background: isCapturing ? '#9CA3AF' : '#10B981', color: 'white', border: 'none', padding: '8px 16px', 
              borderRadius: '6px', cursor: isCapturing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold'
            }}
          >
            <Camera size={18} />
            {isCapturing ? '이미지 생성 중...' : '결과 이미지 저장'}
          </button>
        </div>
      </div>
      <p style={{ color: '#6B7280', marginBottom: '20px' }}>현재까지 입력된 점수를 바탕으로 실시간 순위가 자동 계산됩니다.</p>
      
      <div ref={tableRef} style={{ background: 'white', padding: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px' }}>
          <div className="print-title" style={{ display: 'none', alignItems: 'center', justifyContent: 'center', gap: '15px', padding: '15px 0 25px 0' }}>
            <img src={hanulLogo} alt="Hanul Logo" style={{ height: '50px', flexShrink: 0, borderRadius: '8px', objectFit: 'cover' }} />
            <h1 style={{ margin: 0, color: '#1E3A8A', fontSize: '2.4rem', fontWeight: '800' }}>한울타리 주말리그</h1>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: '0.9rem', color: '#4B5563', fontWeight: 'bold', background: '#F3F4F6', padding: '6px 12px', borderRadius: '4px' }}>
              {courtName ? `${courtName} - ${courtType} (${courtEnv})` : `${courtType} (${courtEnv})`}
            </div>
          </div>
        </div>

      {stats.length === 0 ? (
        <p>참가 선수가 없습니다.</p>
      ) : (
        <div className="ranking-scroll-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'center' }}>
            <thead style={{ background: '#F3F4F6' }}>
              <tr>
                <th style={{ padding: '8px 5px', whiteSpace: 'nowrap', borderBottom: '2px solid #E5E7EB' }}>순위</th>
                <th style={{ padding: '8px 5px', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid #E5E7EB' }}>이름</th>
                <th style={{ padding: '8px 5px', whiteSpace: 'nowrap', borderBottom: '2px solid #E5E7EB' }}>경기수</th>
                <th style={{ padding: '8px 5px', whiteSpace: 'nowrap', borderBottom: '2px solid #E5E7EB' }}>승</th>
                <th style={{ padding: '8px 5px', whiteSpace: 'nowrap', borderBottom: '2px solid #E5E7EB' }}>패</th>
                <th style={{ padding: '8px 5px', whiteSpace: 'nowrap', borderBottom: '2px solid #E5E7EB' }}>득점</th>
                <th style={{ padding: '8px 5px', whiteSpace: 'nowrap', borderBottom: '2px solid #E5E7EB' }}>실점</th>
                <th style={{ padding: '8px 5px', whiteSpace: 'nowrap', borderBottom: '2px solid #E5E7EB' }}>득실차</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: '8px 5px', fontWeight: 'bold', borderBottom: '1px solid #E5E7EB' }}>
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: p.rank === 1 ? '#FBBF24' : p.rank === 2 ? '#9CA3AF' : p.rank === 3 ? '#D97706' : 'transparent',
                      color: p.rank <= 3 ? 'white' : '#374151',
                      borderRadius: '50%', width: '24px', height: '24px', fontSize: '0.85rem'
                    }}>
                      {p.rank}
                    </span>
                  </td>
                  <td style={{ padding: '8px 5px', textAlign: 'left', fontWeight: 'bold', color: '#1E3A8A', whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>
                    {p.name}
                  </td>
                  <td style={{ padding: '8px 5px', borderBottom: '1px solid #E5E7EB' }}>{p.matches}</td>
                  <td style={{ padding: '8px 5px', color: '#0369A1', fontWeight: 'bold', borderBottom: '1px solid #E5E7EB' }}>{p.wins}</td>
                  <td style={{ padding: '8px 5px', color: '#6D28D9', fontWeight: 'bold', borderBottom: '1px solid #E5E7EB' }}>{p.losses}</td>
                  <td style={{ padding: '8px 5px', borderBottom: '1px solid #E5E7EB' }}>{p.ptsFor}</td>
                  <td style={{ padding: '8px 5px', borderBottom: '1px solid #E5E7EB' }}>{p.ptsAgainst}</td>
                  <td style={{ padding: '8px 5px', fontWeight: 'bold', color: p.ptsDiff > 0 ? '#10B981' : p.ptsDiff < 0 ? '#EF4444' : '#6B7280', borderBottom: '1px solid #E5E7EB' }}>
                    {p.ptsDiff > 0 ? `+${p.ptsDiff}` : p.ptsDiff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 캡처용 경기 결과 요약 (평소엔 숨김, 캡처 시에만 표시) */}
      <div className="print-matches" style={{ display: 'none', marginTop: '30px' }}>
        <h3 style={{ borderBottom: '2px solid #E5E7EB', paddingBottom: '10px', color: '#1E3A8A' }}>경기 결과 요약</h3>
        
        {(() => {
          let currentCombinations = [...((combinations as Record<string, string[]>)[bracketOption] || [])];
          const maxMatchIdx = Math.max(-1, ...Object.keys(matchScores).map(k => parseInt(k.split('-')[0], 10)));
          if (maxMatchIdx >= currentCombinations.length) {
            const padCount = maxMatchIdx - currentCombinations.length + 1;
            for (let i = 0; i < padCount; i++) {
              currentCombinations.push("1234");
            }
          }

          return currentCombinations.map((matchStr, matchIdx) => {
            const matchesInRound = [];
            for (let i = 0; i < matchStr.length; i += 4) {
              const sub = matchStr.slice(i, i + 4);
              if (sub.length === 4) matchesInRound.push(sub);
            }

            const hasAnyScore = matchesInRound.some((_, idx) => {
              const matchId = `${matchIdx}-${idx}`;
              const s = matchScores[matchId];
              return s && (s.t1 !== '' || s.t2 !== '');
            });
            if (!hasAnyScore) return null;

            return (
              <div key={matchIdx} style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#374151', fontSize: '1.1rem' }}>{matchIdx + 1} 경기</h4>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  {matchesInRound.map((mStr, idx) => {
                    const matchId = `${matchIdx}-${idx}`;
                    const score = matchScores[matchId] || { t1: '', t2: '' };
                    if (score.t1 === '' && score.t2 === '') return null;

                    const p1 = participatingMembers[charToIndex(mStr[0])];
                    const p2 = participatingMembers[charToIndex(mStr[1])];
                    const p3 = participatingMembers[charToIndex(mStr[2])];
                    const p4 = participatingMembers[charToIndex(mStr[3])];
                    
                    const p1Id = matchOverrides[matchId]?.[0] || p1?.id;
                    const p2Id = matchOverrides[matchId]?.[1] || p2?.id;
                    const p3Id = matchOverrides[matchId]?.[2] || p3?.id;
                    const p4Id = matchOverrides[matchId]?.[3] || p4?.id;

                    const getPlayerName = (pId: string | undefined, fallbackStr: string) => {
                      const member = allMembers.find(m => m.id === pId);
                      return member ? member.name : fallbackStr;
                    };

                    const p1NameStr = getPlayerName(p1Id, p1 ? p1.name : `선수${charToIndex(mStr[0]) + 1}`);
                    const p2NameStr = getPlayerName(p2Id, p2 ? p2.name : `선수${charToIndex(mStr[1]) + 1}`);
                    const p3NameStr = getPlayerName(p3Id, p3 ? p3.name : `선수${charToIndex(mStr[2]) + 1}`);
                    const p4NameStr = getPlayerName(p4Id, p4 ? p4.name : `선수${charToIndex(mStr[3]) + 1}`);

                    const s1 = parseInt(score.t1) || 0;
                    const s2 = parseInt(score.t2) || 0;

                    return (
                      <div key={idx} style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', background: '#F9FAFB', padding: '8px 20px', borderRadius: '6px', border: '1px solid #E5E7EB', margin: '0 auto' }}>
                        <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#0369A1' }}>
                          {p1NameStr}, {p2NameStr}
                        </div>
                        <div style={{ padding: '0 15px', fontWeight: 'bold', fontSize: '1.2rem', color: '#1F2937' }}>
                          <span style={{ color: s1 > s2 ? '#10B981' : '#4B5563' }}>{score.t1}</span>
                          <span style={{ margin: '0 8px', color: '#9CA3AF' }}>:</span>
                          <span style={{ color: s2 > s1 ? '#10B981' : '#4B5563' }}>{score.t2}</span>
                        </div>
                        <div style={{ textAlign: 'left', fontWeight: 'bold', color: '#6D28D9' }}>
                          {p3NameStr}, {p4NameStr}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>

      </div>

      {/* 안드로이드 / 모바일용 이미지 저장 팝업 모달 */}
      {previewImage && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClosePreview();
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '12px',
            boxSizing: 'border-box'
          }}
        >
          <div 
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '540px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden'
            }}
          >
            {/* 모달 헤더 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid #E5E7EB',
              backgroundColor: '#F9FAFB'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} color="#1E3A8A" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1E3A8A', fontWeight: 'bold' }}>이미지 저장</h3>
              </div>
              <button
                onClick={handleClosePreview}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6B7280'
                }}
              >
                <X size={22} />
              </button>
            </div>

            {/* 모달 본문 */}
            <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
              {/* 안드로이드 갤러리 저장 안내 */}
              <div style={{
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '14px',
                fontSize: '0.88rem',
                color: '#1E40AF',
                lineHeight: '1.5'
              }}>
                📱 <strong>안드로이드 갤러리 저장 방법:</strong><br />
                아래 이미지를 <strong>1~2초간 꾹 길게 터치</strong>한 후 나타나는 메뉴에서 <strong>[이미지 저장]</strong> 또는 <strong>[이미지 다운로드]</strong>를 누르시면 사진첩(갤러리)에 바로 저장됩니다.
              </div>

              {/* 생성된 이미지 미리보기 */}
              <div style={{
                textAlign: 'center',
                backgroundColor: '#F3F4F6',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid #E5E7EB'
              }}>
                <img 
                  src={previewImage.url} 
                  alt="리그 순위 결과" 
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    maxHeight: '52vh',
                    objectFit: 'contain',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    display: 'block',
                    margin: '0 auto',
                    userSelect: 'auto',
                    WebkitTouchCallout: 'default'
                  }}
                />
              </div>
            </div>

            {/* 모달 하단 버튼 영역 */}
            <div style={{
              padding: '12px 18px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              gap: '8px',
              backgroundColor: '#F9FAFB',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={handleDownloadDirect}
                style={{
                  flex: '1 1 120px',
                  padding: '10px 14px',
                  backgroundColor: '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Download size={16} />
                파일 다운로드
              </button>
              {typeof navigator !== 'undefined' && !!navigator.share && (
                <button
                  onClick={handleShareFromModal}
                  style={{
                    flex: '1 1 100px',
                    padding: '10px 14px',
                    backgroundColor: '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Share2 size={16} />
                  공유하기
                </button>
              )}
              <button
                onClick={handleClosePreview}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#E5E7EB',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
