import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import samplePosts from '../../sample_posts.json';

const HanullogTab = () => {
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    // 임시로 로컬 JSON 데이터를 로드. 추후 Firebase Firestore 연동 필요
    setPosts(samplePosts);
  }, []);

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#1E3A8A', margin: '0 0 5px 0' }}>AI 코치의 테니스 매거진</h2>
        <p style={{ color: '#6B7280', fontSize: '0.9rem', margin: 0 }}>매일매일 업데이트되는 유용한 테니스 꿀팁!</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {posts.map((post) => {
          const dateObj = new Date(post.date);
          const formattedDate = `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')}`;

          return (
            <div key={post.id} style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              border: '1px solid #E5E7EB'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#111827', lineHeight: '1.4' }}>
                {post.title}
              </h3>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {post.tags.map((tag: string, idx: number) => (
                  <span key={idx} style={{ 
                    background: '#EFF6FF', 
                    color: '#2563EB', 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    fontSize: '0.75rem',
                    fontWeight: 'bold' 
                  }}>
                    {tag}
                  </span>
                ))}
                <span style={{ 
                  display: 'flex', alignItems: 'center', gap: '4px', 
                  color: '#9CA3AF', fontSize: '0.8rem', marginLeft: 'auto' 
                }}>
                  <Calendar size={12} />
                  {formattedDate}
                </span>
              </div>

              <div style={{ 
                color: '#4B5563', 
                fontSize: '0.95rem', 
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
                {/* 
                  본문에 포함된 💡 아이콘 부분이나 특정 텍스트 등을 강조 처리하기 위한 간단한 렌더링.
                  추후 Markdown 파서를 쓰면 더 좋습니다.
                */}
                {post.content.split('\n').map((line: string, i: number) => {
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <strong key={i} style={{ display: 'block', marginTop: '10px', color: '#1E3A8A' }}>{line.replace(/\*\*/g, '')}</strong>;
                  }
                  if (line.includes('💡')) {
                    return (
                      <div key={i} style={{ 
                        marginTop: '15px', padding: '12px', background: '#FEF3C7', 
                        borderRadius: '8px', color: '#92400E', fontWeight: 'bold' 
                      }}>
                        {line.replace(/\*\*/g, '')}
                      </div>
                    );
                  }
                  return <React.Fragment key={i}>{line}<br/></React.Fragment>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HanullogTab;
