import React from 'react';
import { Users, Lock } from 'lucide-react';
import combinations from '../data/combinations.json';

interface PlayerSetupProps {
  currentSessionId?: string | null;
  allMembers: any[];
  participatingMembers: any[];
  setParticipatingMembers: (members: any[]) => void;
  bracketOption: string;
  setBracketOption: (opt: string) => void;
  isFinished?: boolean;
  isReadOnly?: boolean;
}

export default function PlayerSetup({ currentSessionId, allMembers, participatingMembers, setParticipatingMembers, bracketOption, setBracketOption, isFinished = false, isReadOnly = false }: PlayerSetupProps) {
  
  // 세션 ID가 없는 새 리그 시작 상태일 때는 마감 잠금을 적용하지 않음
  const isEffectivelyFinished = Boolean(currentSessionId && isFinished);
  const isLocked = isEffectivelyFinished || isReadOnly;

  // 참가 옵션(인원 및 코트) 변경 처리
  const handleOptionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isLocked) {
      alert('마감된 리그는 참가 인원 및 옵션을 수정할 수 없습니다.\n수정이 필요한 경우 [결과 입력] 탭에서 마감을 해제한 후 수정해주세요.');
      return;
    }
    const selectedOption = e.target.value;
    setBracketOption(selectedOption);
    
    // "12-2c" 같은 문자열에서 앞의 숫자만 추출하여 참가 인원 수로 사용
    const count = parseInt(selectedOption.split('-')[0]);
    const newMembers = [...participatingMembers];
    if (count > newMembers.length) {
      while (newMembers.length < count) newMembers.push(null);
    } else {
      newMembers.length = count;
    }
    setParticipatingMembers(newMembers);
  };

  // 포맷팅 헬퍼 함수
  const formatOptionLabel = (opt: string) => {
    const parts = opt.split('-');
    const count = parseInt(parts[0], 10);
    let court = '';

    if (parts[1]) {
      if (parts[1] === '23c') {
        court = '2~3코트';
      } else {
        court = parts[1].replace('c', '코트');
      }
    } else {
      if (count >= 5 && count <= 7) {
        court = '1코트';
      } else if (count >= 8 && count <= 11) {
        court = '2코트';
      } else if (count === 15) {
        court = '3코트';
      } else {
        court = '1코트';
      }
    }

    return `${count}명 (${court})`;
  };

  // 참가 옵션 정렬 (5명 ~ 16명 순서)
  const sortedOptionKeys = Object.keys(combinations).sort((a, b) => {
    const countA = parseInt(a.split('-')[0], 10);
    const countB = parseInt(b.split('-')[0], 10);
    if (countA !== countB) {
      return countA - countB;
    }
    return a.localeCompare(b);
  });

  // 시드 인덱스 계산
  const getSeedIndices = (opt: string) => {
    const seedStrs: Record<string, string> = {
      "5": "",
      "6": "14",
      "7": "14",
      "8": "14",
      "9": "148",
      "10": "145",
      "11": "1457",
      "12-2c": "15AC",
      "12-3c": "1459",
      "13-2c": "147AD",
      "13-3c": "1358",
      "14-2c": "1467B",
      "14-3c": "1359B",
      "15": "1458CD",
      "16-23c": "14679E",
      "16-4c": "1357A"
    };
    
    const charToIndex = (c: string) => {
      if (c >= '1' && c <= '9') return parseInt(c) - 1;
      return c.charCodeAt(0) - 'A'.charCodeAt(0) + 9;
    };
  
    const seedStr = seedStrs[opt] || "";
    return seedStr.split('').map(charToIndex);
  };

  const seedIndices = getSeedIndices(bracketOption);

  // 특정 슬롯의 선수 선택 처리
  const handleSelectMember = (index: number, memberId: string) => {
    if (isLocked) {
      alert('마감된 리그는 참가선수를 수정할 수 없습니다.\n수정이 필요한 경우 [결과 입력] 탭에서 마감을 해제한 후 수정해주세요.');
      return;
    }
    const selectedMember = allMembers.find(m => m.id === memberId) || null;
    const newMembers = [...participatingMembers];
    newMembers[index] = selectedMember;
    setParticipatingMembers(newMembers);
  };

  return (
    <div className="content-card">
      <h2 style={{ color: '#1E3A8A', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={24} /> 참가선수 설정
        </div>
        {isEffectivelyFinished && (
          <span style={{ fontSize: '0.85rem', background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B', padding: '4px 10px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
            <Lock size={14} /> 마감됨 (수정 불가)
          </span>
        )}
      </h2>

      {isEffectivelyFinished && (
        <div style={{ padding: '12px 16px', background: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '0.9rem' }}>
          <Lock size={18} style={{ flexShrink: 0 }} />
          <span>리그가 마감되어 참가선수 및 옵션을 변경할 수 없습니다. 수정이 필요하신 경우 [결과 입력] 탭에서 [수정] 버튼(암호 필요)을 통해 마감을 해제해주세요.</span>
        </div>
      )}
      
      <div style={{ marginBottom: '20px', background: isLocked ? '#E5E7EB' : '#F3F4F6', padding: '15px', borderRadius: '8px', opacity: isLocked ? 0.9 : 1 }}>
        <label style={{ fontWeight: 'bold', marginRight: '10px', color: isLocked ? '#4B5563' : '#111827' }}>참가 인원 및 코트 옵션:</label>
        <select 
          value={bracketOption} 
          onChange={handleOptionChange}
          disabled={isLocked}
          style={{ 
            padding: '8px 12px', 
            borderRadius: '6px', 
            border: '1px solid #D1D5DB', 
            fontSize: '1rem', 
            minWidth: '150px',
            backgroundColor: isLocked ? '#F3F4F6' : '#fff',
            color: isLocked ? '#6B7280' : '#000',
            cursor: isLocked ? 'not-allowed' : 'pointer'
          }}
        >
          {sortedOptionKeys.map(key => (
            <option key={key} value={key}>{formatOptionLabel(key)}</option>
          ))}
        </select>
        <span style={{ marginLeft: '15px', color: '#6B7280', fontSize: '0.9rem' }}>
          * 최적화 알고리즘에 기반하여 자동으로 대진표가 구성됩니다.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
        {participatingMembers.map((member, index) => {
          const isSeed = seedIndices.includes(index);
          return (
            <div key={index} style={{ 
              border: isSeed ? '2px solid #F59E0B' : '1px solid #E5E7EB', 
              borderRadius: '8px', 
              padding: '15px',
              display: 'flex',
              alignItems: 'center',
              background: isSeed ? '#FEF3C7' : (member ? '#EFF6FF' : 'white'),
              opacity: isLocked ? 0.95 : 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginRight: '15px' }}>
                <div style={{ 
                  width: '30px', height: '30px', 
                  background: isSeed ? '#D97706' : '#1E3A8A', 
                  color: 'white', 
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontWeight: 'bold'
                }}>
                  {index + 1}
                </div>
                {isSeed && (
                  <span style={{ marginLeft: '8px', color: '#D97706', fontWeight: '900', fontSize: '0.9rem' }}>
                    (시드)
                  </span>
                )}
              </div>
              
              <div style={{ flex: 1 }}>
                <select 
                  value={member ? member.id : ""}
                  onChange={(e) => handleSelectMember(index, e.target.value)}
                  disabled={isLocked}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    borderRadius: '6px', 
                    border: '1px solid #D1D5DB', 
                    fontSize: '16px', 
                    color: isLocked ? '#4B5563' : '#000', 
                    backgroundColor: isLocked ? '#F3F4F6' : '#fff',
                    cursor: isLocked ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="">-- 선수를 선택하세요 --</option>
                  {[...allMembers].sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                    // 이미 다른 슬롯에 선택된 선수는 비활성화 (현재 슬롯에 선택된 본인은 제외)
                    <option 
                      key={m.id} 
                      value={m.id}
                      disabled={participatingMembers.some((p, i) => p?.id === m.id && i !== index)}
                    >
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
