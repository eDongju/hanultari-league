import React from 'react';
import combinations from '../data/combinations.json';

interface PlayerSetupProps {
  allMembers: any[];
  participatingMembers: any[];
  setParticipatingMembers: (members: any[]) => void;
  bracketOption: string;
  setBracketOption: (opt: string) => void;
}

export default function PlayerSetup({ allMembers, participatingMembers, setParticipatingMembers, bracketOption, setBracketOption }: PlayerSetupProps) {
  
  // 참가 옵션(인원 및 코트) 변경 처리
  const handleOptionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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
    const count = parts[0];
    const court = parts[1] ? parts[1].replace('c', '코트') : '1코트';
    return `${count}명 (${court})`;
  };

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
    const selectedMember = allMembers.find(m => m.id === memberId) || null;
    const newMembers = [...participatingMembers];
    newMembers[index] = selectedMember;
    setParticipatingMembers(newMembers);
  };

  return (
    <div className="content-card">
      <h2 style={{ color: '#1E3A8A', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px' }}>
        1. 주말리그 선수 입력
      </h2>
      
      <div style={{ marginBottom: '20px', background: '#F3F4F6', padding: '15px', borderRadius: '8px' }}>
        <label style={{ fontWeight: 'bold', marginRight: '10px' }}>참가 인원 및 코트 옵션:</label>
        <select 
          value={bracketOption} 
          onChange={handleOptionChange}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '1rem', minWidth: '150px' }}
        >
          {Object.keys(combinations).map(key => (
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
              background: isSeed ? '#FEF3C7' : (member ? '#EFF6FF' : 'white')
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
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
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
