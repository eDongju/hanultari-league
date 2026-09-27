import { Camera, Download, Share2, X } from 'lucide-react';

export interface ImagePreviewData {
  url: string;
  blob: Blob;
  filename: string;
}

interface ImagePreviewModalProps {
  preview: ImagePreviewData | null;
  onClose: () => void;
  title?: string;
  shareTitle?: string;
}

export default function ImagePreviewModal({
  preview,
  onClose,
  title = '이미지 저장',
  shareTitle = '한울타리'
}: ImagePreviewModalProps) {
  if (!preview) return null;

  const handleDownloadDirect = () => {
    const link = document.createElement('a');
    link.href = preview.url;
    link.download = preview.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      const file = new File([preview.blob], preview.filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: shareTitle || title,
          });
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            console.log('Share API error:', err);
          }
        }
      }
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={20} color="#1E3A8A" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1E3A8A', fontWeight: 'bold' }}>{title}</h3>
          </div>
          <button
            onClick={onClose}
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
          <div
            style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '14px',
              fontSize: '0.88rem',
              color: '#1E40AF',
              lineHeight: '1.5'
            }}
          >
            📱 <strong>초고화질 원본 저장 방법:</strong><br />
            아래 이미지를 <strong>1~2초간 꾹 길게 터치</strong>한 후 나타나는 메뉴에서 <strong>[이미지 저장]</strong> 또는 <strong>[이미지 다운로드]</strong>를 누르시면 원본 무손실 고화질 그대로 사진첩(갤러리)에 저장됩니다.
          </div>

          {/* 생성된 이미지 미리보기 */}
          <div
            style={{
              textAlign: 'center',
              backgroundColor: '#F3F4F6',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #E5E7EB'
            }}
          >
            <img
              src={preview.url}
              alt={title}
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
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            gap: '8px',
            backgroundColor: '#F9FAFB',
            flexWrap: 'wrap'
          }}
        >
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
              onClick={handleShare}
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
            onClick={onClose}
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
  );
}
