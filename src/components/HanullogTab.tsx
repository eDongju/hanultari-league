import React, { useState, useEffect } from 'react';
import { Calendar, Heart, MessageCircle, Send, Share2, PlusCircle, X } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const HanullogTab = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('hanullog_liked');
    return saved ? JSON.parse(saved) : {};
  });
  const [comments, setComments] = useState<Record<string, {text: string, date: string}[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const [isWriting, setIsWriting] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', tags: '', content: '' });

  useEffect(() => {
    // Firebase Firestore에서 실시간으로 글 목록 가져오기 (최신순 정렬)
    const q = query(collection(db, 'hanullog'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts: any[] = [];
      const initialLikes: Record<string, number> = {};
      const initialComments: Record<string, {text: string, date: string}[]> = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedPosts.push({ id: doc.id, ...data });
        
        // 좋아요/댓글 상태가 DB에 있으면 사용하고, 없으면 빈 값으로 렌더링
        initialLikes[doc.id] = data.likes || 0;
        initialComments[doc.id] = data.comments || [];
      });
      
      setPosts(fetchedPosts);
      setLikes(initialLikes);
      setComments(initialComments);
    });

    return () => unsubscribe();
  }, []);

  const handleLike = async (id: string) => {
    const isLiked = likedPosts[id];
    const newCount = isLiked ? Math.max(0, (likes[id] || 0) - 1) : (likes[id] || 0) + 1;
    
    const newLikedState = { ...likedPosts, [id]: !isLiked };
    setLikedPosts(newLikedState);
    localStorage.setItem('hanullog_liked', JSON.stringify(newLikedState));

    try {
      const postRef = doc(db, 'hanullog', id);
      await updateDoc(postRef, { likes: newCount });
    } catch (error) {
      console.error("Error updating likes:", error);
    }
  };

  const handleCommentChange = (id: string, value: string) => {
    setCommentInputs(prev => ({ ...prev, [id]: value }));
  };

  const submitComment = async (id: string) => {
    const text = commentInputs[id];
    if (!text || text.trim() === '') return;
    
    const newComment = {
      text: text.trim(),
      date: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };

    const updatedComments = [...(comments[id] || []), newComment];
    
    setComments(prev => ({ ...prev, [id]: updatedComments }));
    setCommentInputs(prev => ({ ...prev, [id]: '' }));

    try {
      const postRef = doc(db, 'hanullog', id);
      await updateDoc(postRef, { comments: updatedComments });
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("댓글 저장에 실패했습니다.");
    }
  };

  const submitPost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) {
      alert("제목과 내용을 입력해주세요.");
      return;
    }

    try {
      await addDoc(collection(db, 'hanullog'), {
        title: newPost.title,
        tags: newPost.tags.split(',').map(t => t.trim()).filter(t => t),
        content: newPost.content,
        createdAt: new Date().toISOString(),
        date: new Date().toISOString(),
        likes: 0,
        comments: []
      });
      setIsWriting(false);
      setNewPost({ title: '', tags: '', content: '' });
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("게시글 작성에 실패했습니다.");
    }
  };

  const handleShare = async (post: any) => {
    const shareData = {
      title: post.title,
      text: post.content.substring(0, 100) + '...',
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${post.title}\n${window.location.href}`);
        alert('링크가 복사되었습니다!');
      }
    } catch (err) {
      console.log('공유하기 실패', err);
    }
  };

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#1E3A8A', margin: '0 0 5px 0' }}>AI 코치의 테니스 매거진</h2>
        <p style={{ color: '#6B7280', fontSize: '0.9rem', margin: 0 }}>매일매일 업데이트되는 유용한 테니스 꿀팁!</p>
        <button 
          onClick={() => setIsWriting(true)}
          style={{ marginTop: '12px', background: '#2563EB', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <PlusCircle size={16} /> 새 글 쓰기
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {isWriting && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#111827' }}>새 글 작성</h3>
              <button onClick={() => setIsWriting(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={20} /></button>
            </div>
            <input 
              type="text" 
              placeholder="제목" 
              value={newPost.title}
              onChange={e => setNewPost({...newPost, title: e.target.value})}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', boxSizing: 'border-box' }}
            />
            <input 
              type="text" 
              placeholder="태그 (쉼표로 구분)" 
              value={newPost.tags}
              onChange={e => setNewPost({...newPost, tags: e.target.value})}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', boxSizing: 'border-box' }}
            />
            <textarea 
              placeholder="내용을 입력하세요..." 
              value={newPost.content}
              onChange={e => setNewPost({...newPost, content: e.target.value})}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #D1D5DB', minHeight: '100px', boxSizing: 'border-box', resize: 'vertical' }}
            />
            <div style={{ textAlign: 'right' }}>
              <button 
                onClick={submitPost}
                style={{ background: '#10B981', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                등록하기
              </button>
            </div>
          </div>
        )}

        {posts.length === 0 && !isWriting && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6B7280', background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
            <Calendar size={40} color="#D1D5DB" style={{ marginBottom: '10px' }} />
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>아직 등록된 매거진이 없습니다.</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>새 글 쓰기를 눌러 첫 글을 작성해보세요!</p>
          </div>
        )}
        
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
              {/* 본문 타이틀 영역 */}
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#111827', lineHeight: '1.4' }}>
                {post.title}
              </h3>
              
              {/* 태그 및 날짜 영역 */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {(post.tags || []).map((tag: string, idx: number) => (
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

              {/* 본문 콘텐츠 영역 */}
              <div style={{ 
                color: '#4B5563', 
                fontSize: '0.95rem', 
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                marginBottom: '10px'
              }}>
                {(post.content || '').split('\n').map((line: string, i: number) => {
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

              {/* 구분선 */}
              <hr style={{ border: 'none', borderTop: '1px solid #E5E7EB', margin: '16px 0' }} />

              {/* 인터랙션 버튼 (좋아요/댓글/공유) 영역 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
                <button 
                  onClick={() => handleLike(post.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: likedPosts[post.id] ? '#EF4444' : '#6B7280', fontWeight: 'bold', padding: 0 }}
                >
                  <Heart size={22} fill={likedPosts[post.id] ? '#EF4444' : 'none'} color={likedPosts[post.id] ? '#EF4444' : '#6B7280'} />
                  좋아요 {likes[post.id] || 0}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', fontWeight: 'bold' }}>
                  <MessageCircle size={22} />
                  댓글 {(comments[post.id] || []).length}
                </div>
                <button 
                  onClick={() => handleShare(post)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontWeight: 'bold', padding: 0, marginLeft: 'auto' }}
                >
                  <Share2 size={20} />
                  공유
                </button>
              </div>

              {/* 댓글 리스트 출력 영역 */}
              {(comments[post.id] && comments[post.id].length > 0) && (
                <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '12px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {comments[post.id].map((c: any, idx: number) => (
                    <div key={idx} style={{ fontSize: '0.9rem', color: '#374151' }}>
                      <strong style={{ color: '#1E3A8A' }}>회원:</strong> {c.text} 
                      <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginLeft: '6px' }}>{c.date}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 댓글 입력 폼 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="응원이나 질문을 남겨보세요..." 
                  value={commentInputs[post.id] || ''}
                  onChange={(e) => handleCommentChange(post.id, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '24px', border: '1px solid #D1D5DB', fontSize: '0.95rem', outline: 'none', background: '#F3F4F6' }}
                />
                <button 
                  onClick={() => submitComment(post.id)}
                  style={{ background: '#2563EB', color: 'white', border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  <Send size={18} />
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HanullogTab;
