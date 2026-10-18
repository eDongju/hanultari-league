import React, { useState, useEffect } from 'react';
import { Calendar, Heart, MessageCircle, Send, Share2, PlusCircle, X, Trash2, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

const renderInlineFormatting = (text: string) => {
  if (!text) return null;
  // Match bold (**text**) or URLs
  const regex = /(\*\*[^*]+\*\*|https?:\/\/[^\s]+)/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={index} style={{ color: '#1E3A8A', fontWeight: 'bold' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    return part;
  });
};

const renderFormattedContent = (content: string) => {
  if (!content) return null;
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = (keyPrefix: string) => {
    if (tableBuffer.length === 0) return;
    
    // Parse table rows
    const rows = tableBuffer.map(row => 
      row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
    );
    // filter out separator lines (e.g. |---|---|)
    const validRows = rows.filter(r => !r.every(c => /^[-:\s]+$/.test(c)));
    
    if (validRows.length > 0) {
      const header = validRows[0];
      const dataRows = validRows.slice(1);
      
      elements.push(
        <div key={keyPrefix} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '12px 0', borderRadius: '8px', border: '1px solid #CBD5E1', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', minWidth: '340px', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'center', background: '#FFFFFF' }}>
            <thead>
              <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #94A3B8', color: '#1E3A8A' }}>
                {header.map((col, idx) => (
                  <th key={idx} style={{ padding: '9px 12px', fontWeight: 'bold', whiteSpace: 'nowrap', borderRight: idx < header.length - 1 ? '1px solid #E2E8F0' : 'none' }}>
                    {renderInlineFormatting(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} style={{ borderBottom: '1px solid #E2E8F0', background: rIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#334155', borderRight: cIdx < row.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      {renderInlineFormatting(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableBuffer = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableBuffer.push(trimmed);
      return;
    }
    
    // Flush pending table
    if (tableBuffer.length > 0) {
      flushTable(`table-${i}`);
    }

    if (trimmed === '---') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '14px 0' }} />);
      return;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={i} style={{ margin: '16px 0 6px 0', color: '#1D4ED8', fontSize: '1rem', fontWeight: 'bold' }}>
          {renderInlineFormatting(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={i} style={{ margin: '20px 0 8px 0', color: '#1E3A8A', fontSize: '1.1rem', fontWeight: 'bold', borderBottom: '2px solid #DBEAFE', paddingBottom: '4px' }}>
          {renderInlineFormatting(trimmed.replace(/^##\s+/, ''))}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={i} style={{ margin: '22px 0 10px 0', color: '#1E3A8A', fontSize: '1.2rem', fontWeight: 'bold' }}>
          {renderInlineFormatting(trimmed.replace(/^#\s+/, ''))}
        </h2>
      );
      return;
    }

    if (line.includes('💡')) {
      elements.push(
        <div key={i} style={{ marginTop: '12px', marginBottom: '8px', padding: '10px 14px', background: '#FEF3C7', borderRadius: '8px', color: '#92400E', fontWeight: '500', fontSize: '0.9rem', lineHeight: '1.5' }}>
          {renderInlineFormatting(line)}
        </div>
      );
      return;
    }

    if (trimmed === '') {
      elements.push(<div key={i} style={{ height: '6px' }} />);
      return;
    }

    elements.push(
      <div key={i} style={{ lineHeight: '1.6', wordBreak: 'break-word' }}>
        {renderInlineFormatting(line)}
      </div>
    );
  });

  if (tableBuffer.length > 0) {
    flushTable('table-end');
  }

  return elements;
};

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
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [newPost, setNewPost] = useState({ title: '', tags: '', content: '' });
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
      
      // 공지사항(태그나 제목에 '공지' 포함)을 위로 올림
      fetchedPosts.sort((a, b) => {
        const aIsNotice = (a.tags && (a.tags.includes('공지사항') || a.tags.includes('공지'))) || (a.title && (a.title.includes('[공지]') || a.title.includes('공지사항')));
        const bIsNotice = (b.tags && (b.tags.includes('공지사항') || b.tags.includes('공지'))) || (b.title && (b.title.includes('[공지]') || b.title.includes('공지사항')));
        
        if (aIsNotice && !bIsNotice) return -1;
        if (!aIsNotice && bIsNotice) return 1;
        return 0; // createdAt 기준 desc 정렬은 이미 Firestore 쿼리에서 적용됨
      });

      setPosts(fetchedPosts);
      setLikes(initialLikes);
      setComments(initialComments);

      // 공지사항은 기본으로 펼침 상태로 설정하여 바로 볼 수 있도록 함
      setExpandedPosts(prev => {
        const next = { ...prev };
        fetchedPosts.forEach(post => {
          const isNotice = (post.tags && (post.tags.includes('공지사항') || post.tags.includes('공지'))) || (post.title && (post.title.includes('[공지]') || post.title.includes('공지사항')));
          if (isNotice && next[post.id] === undefined) {
            next[post.id] = true;
          }
        });
        return next;
      });
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

  const deleteComment = async (postId: string, commentIndex: number) => {
    if (window.confirm("이 댓글을 삭제하시겠습니까?")) {
      const updatedComments = [...(comments[postId] || [])];
      updatedComments.splice(commentIndex, 1);
      
      setComments(prev => ({ ...prev, [postId]: updatedComments }));

      try {
        const postRef = doc(db, 'hanullog', postId);
        await updateDoc(postRef, { comments: updatedComments });
      } catch (error) {
        console.error("Error deleting comment:", error);
        alert("댓글 삭제에 실패했습니다.");
      }
    }
  };

  const handleDelete = async (id: string) => {
    const pwd = window.prompt("게시물을 삭제하시려면 암호를 입력하세요.");
    if (pwd === "1982") {
      if (window.confirm("정말 게시글을 삭제하시겠습니까?")) {
        try {
          await deleteDoc(doc(db, 'hanullog', id));
        } catch (error) {
          console.error("Error deleting post:", error);
          alert("삭제에 실패했습니다.");
        }
      }
    } else if (pwd !== null) {
      alert("암호가 일치하지 않습니다.");
    }
  };

  const submitPost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) {
      alert("제목과 내용을 입력해주세요.");
      return;
    }

    try {
      if (editingPostId) {
        await updateDoc(doc(db, 'hanullog', editingPostId), {
          title: newPost.title,
          tags: newPost.tags.split(',').map(t => t.trim()).filter(t => t),
          content: newPost.content,
        });
        setEditingPostId(null);
      } else {
        await addDoc(collection(db, 'hanullog'), {
          title: newPost.title,
          tags: newPost.tags.split(',').map(t => t.trim()).filter(t => t),
          content: newPost.content,
          createdAt: new Date().toISOString(),
          date: new Date().toISOString(),
          likes: 0,
          comments: []
        });
      }
      setIsWriting(false);
      setNewPost({ title: '', tags: '', content: '' });
    } catch (error) {
      console.error("Error adding/updating document: ", error);
      alert("게시글 저장에 실패했습니다.");
    }
  };

  const startEdit = (post: any) => {
    const pwd = window.prompt("게시물을 수정하시려면 암호를 입력하세요.");
    if (pwd === "1982") {
      setEditingPostId(post.id);
      setNewPost({ title: post.title, tags: post.tags ? post.tags.join(', ') : '', content: post.content });
      setIsWriting(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (pwd !== null) {
      alert("암호가 일치하지 않습니다.");
    }
  };

  const handleShare = async (post: any) => {
    const shareUrl = window.location.origin + window.location.pathname + '?tab=hanullog';
    const shareData = {
      title: post.title,
      text: post.content.substring(0, 100) + '...',
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${post.title}\n${shareUrl}`);
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
              <h3 style={{ margin: 0, color: '#111827' }}>{editingPostId ? '글 수정' : '새 글 작성'}</h3>
              <button onClick={() => { setIsWriting(false); setEditingPostId(null); setNewPost({ title: '', tags: '', content: '' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><X size={20} /></button>
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
          const isNotice = (post.tags && (post.tags.includes('공지사항') || post.tags.includes('공지'))) || (post.title && (post.title.includes('[공지]') || post.title.includes('공지사항')));

          return (
            <div key={post.id} style={{
              background: isNotice ? '#FAFCFF' : 'white',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: isNotice ? '0 4px 12px rgba(37, 99, 235, 0.08)' : '0 2px 8px rgba(0,0,0,0.05)',
              border: isNotice ? '1.5px solid #3B82F6' : '1px solid #E5E7EB'
            }}>
              {/* 본문 타이틀 및 삭제 버튼 영역 */}
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', marginBottom: expandedPosts[post.id] ? '10px' : '0' }}
                onClick={() => toggleExpand(post.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                  <div style={{ marginTop: '2px' }}>
                    {expandedPosts[post.id] ? <ChevronDown size={20} color="#6B7280" /> : <ChevronRight size={20} color="#6B7280" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    {isNotice && (
                      <span style={{ display: 'inline-block', background: '#EF4444', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', marginBottom: '4px' }}>
                        공지사항
                      </span>
                    )}
                    <h3 style={{ margin: '0', fontSize: '1.08rem', color: isNotice ? '#1E3A8A' : '#111827', lineHeight: '1.4' }}>
                      {post.title}
                    </h3>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(post); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', padding: '0 8px' }}
                    title="수정"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '0 0 0 8px' }}
                    title="삭제"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              {expandedPosts[post.id] && (
                <>
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
                marginBottom: '10px'
              }}>
                {renderFormattedContent(post.content || '')}
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
                    <div key={idx} style={{ fontSize: '0.9rem', color: '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ color: '#1E3A8A' }}>회원:</strong> {c.text} 
                        <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginLeft: '6px' }}>{c.date}</span>
                      </div>
                      <button
                        onClick={() => deleteComment(post.id, idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '0 4px' }}
                        title="댓글 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
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
              </>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HanullogTab;
