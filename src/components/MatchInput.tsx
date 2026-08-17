import { useState, useEffect } from 'react';
import { ArrowUpDown, Edit, CheckCircle, Trash2 } from 'lucide-react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import combinations from '../data/combinations.json';

const charToIndex = (c: string) => {
  if (c >= '1' && c <= '9') return parseInt(c) - 1;
  return c.charCodeAt(0) - 'A'.charCodeAt(0) + 9;
};

interface MatchInputProps {
  allMembers: any[];
  participatingMembers: any[];
  bracketOption: string;
  matchScores: Record<string, { t1: string, t2: string }>;
  setMatchScores: (scores: Record<string, { t1: string, t2: string }>) => void;
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
    
    const memberRef = doc(db, 'members', pointMemberId);
    const fieldToUpdate = pointType === 'R' ? 'roundPoint' : 'gamePoint';
    
    try {
      await updateDoc(memberRef, {
        [fieldToUpdate]: increment(amount)
      });
      
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
    if (!pointHistory || !setPointHistory) return;
    const memberRef = doc(db, 'members', entry.memberId);
    const fieldToUpdate = entry.type === 'R' ? 'roundPoint' : 'gamePoint';
    
    try {
      await updateDoc(memberRef, {
        [fieldToUpdate]: increment(-entry.amount)
      });
      
      setPointHistory(pointHistory.filter(h => h.id !== entry.id));
    } catch (e) {
      alert('포인트 취소에 실패했습니다.');
    }
  };

  return (
    <div className="content-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px', marginBottom: '20px' }}>
          <h2 style={{ color: '#1E3A8A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit size={24} /> 결과 입력
          </h2>
          <div style={{ display: 'flex', gap: '10px' }}>
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
      
      <div style={{ marginBottom: '20px', background: '#F3F4F6', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 5px 0' }}>현재 참가 인원: {participatingMembers.length}명 (설정: {bracketOption})</h3>
          <p style={{ color: '#6B7280', margin: 0, fontSize: '0.9rem' }}>자동 생성된 대진표에 각 라운드의 경기 결과를 입력하세요.</p>
        </div>
      </div>

      {currentCombinations.length === 0 ? (
        <p>선택된 대진이 없습니다. 1번 탭에서 인원을 설정해주세요.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* 코트 정보 입력 */}
          <div style={{ display: 'flex', gap: '15px', background: '#EFF6FF', padding: '15px', borderRadius: '8px', border: '1px solid #BFDBFE', flexWrap: 'wrap' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 10px 0' }}>
                  <h4 style={{ margin: 0, color: '#374151' }}>{matchIdx + 1} 경기</h4>
                  {matchesInRound.map((_, idx) => {
                    const matchId = `${matchIdx}-${idx}`;
                    const isEditing = editModes[matchId];
                    return (
                      <button 
                        key={matchId}
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
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F9FAFB', padding: '10px', borderRadius: '6px', marginBottom: '10px' }}>
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
                            <button onClick={() => handleSwapCourt(matchId, 0, 1, p1Id || '', p2Id || '')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#9CA3AF' }} title="듀스/애드 변경"><ArrowUpDown size={14} /></button>
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button 
                          onClick={() => { if (!isFinished) setScoreModal({ matchId, t1Name, t2Name }) }}
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
                            <button onClick={() => handleSwapCourt(matchId, 2, 3, p3Id || '', p4Id || '')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#9CA3AF' }} title="듀스/애드 변경"><ArrowUpDown size={14} /></button>
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
      <div style={{ marginTop: '30px', padding: '15px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#1F2937', fontSize: '1.1rem' }}>🎁 일일 포인트 추가</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select 
            value={pointMemberId} 
            onChange={e => setPointMemberId(e.target.value)}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', flex: 1, minWidth: '120px', fontSize: '1rem' }}
          >
            <option value="">선수 선택</option>
            {allMembers.filter(Boolean).map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select
            value={pointType}
            onChange={e => setPointType(e.target.value)}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', width: '110px', fontSize: '1rem' }}
          >
            <option value="G">G.Point</option>
            <option value="R">R.Point</option>
          </select>
          <input
            type="number"
            value={pointAmount}
            onChange={e => setPointAmount(e.target.value)}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', width: '70px', textAlign: 'center', fontSize: '1rem' }}
          />
          <input
            type="text"
            placeholder="내역 (예: 화성배 우승, 커피)"
            value={pointDesc}
            onChange={e => setPointDesc(e.target.value)}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', flex: 2, minWidth: '150px', fontSize: '1rem' }}
          />
          <button 
            onClick={handleAddPoint}
            style={{ padding: '10px 18px', background: '#10B981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
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
                  <button onClick={() => handleRemovePoint(entry)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }} title="취소"><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 팝업 모달 */}
      {scoreModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
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
                  style={{ width: '100px', padding: '15px', fontSize: '2.5rem', textAlign: 'center', border: '2px solid #6D28D9', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={() => setScoreModal(null)}
                style={{ flex: 1, padding: '15px', fontSize: '1.2rem', background: '#E5E7EB', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                닫기
              </button>
              <button 
                onClick={() => {
                  setScoreModal(null);
                  if (forceSave) forceSave();
                }}
                style={{ flex: 1, padding: '15px', fontSize: '1.2rem', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
