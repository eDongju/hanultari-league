import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TrendingUp, Calendar, Info, RefreshCw, Share2 } from 'lucide-react';

interface StockData {
  ticker: string;
  name: string;
  close: number;
  per: number;
  pbr: number;
  div: number;
  roe?: number;
  eps?: number;
  fwd_per?: number;
  fwd_eps?: number;
  eps_growth?: number;
  peg?: number;
  bps?: number;
  z_per?: number;
  z_pbr?: number;
  debt_ratio?: number;
  target_price?: number;
  upside?: number;
  score?: number;
  sector?: string;
  bond_yield?: number;
}

interface RecommendationDoc {
  id: string;
  date: string;
  stocks: StockData[];
  created_at: any;
}

export default function StockRecommendations() {
  const [latestRec, setLatestRec] = useState<RecommendationDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'stock_recommendations'),
        orderBy('date', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        setLatestRec({
          id: docSnap.id,
          ...docSnap.data()
        } as RecommendationDoc);
      } else {
        setLatestRec(null);
      }
    } catch (error) {
      console.error("Error fetching stock recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    <div className="content-card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E5E7EB', paddingBottom: '10px', marginBottom: '20px' }}>
        <h2 style={{ color: '#1E3A8A', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <TrendingUp size={24} color="#3B82F6" /> 
          AI 가치성장주 픽 (GARP)
        </h2>
        <button 
          onClick={fetchRecommendations}
          disabled={loading}
          style={{ 
            background: 'white', color: '#4B5563', border: '1px solid #D1D5DB', padding: '6px 12px', 
            borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
            fontSize: '0.85rem'
          }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> 새로고침
        </button>
      </div>

      <div style={{ background: '#EFF6FF', borderRadius: '8px', padding: '15px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <Info size={20} color="#3B82F6" style={{ marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontSize: '0.9rem', color: '#1E3A8A', lineHeight: '1.5' }}>
          <strong>피터 린치의 GARP (Growth At a Reasonable Price) 퀀트 전략 탑재</strong><br/>
          단순 저평가(Value Trap)나 고평가 거품주를 피하고, <strong>'가치와 성장의 완벽한 교집합'</strong>을 찾습니다. <br/>
          <strong>1) 섹터 중립화(Z-Score)</strong>로 업종 내 압도적 저평가주 발굴 
          <strong>2) 사경인 S-RIM</strong>으로 깐깐한 목표가 산출 <br/>
          <strong>3) 3년 연평균 복합성장률(CAGR) 대비 저평가 비율(PEG)</strong>과 부채비율, 배당률을 
          모두 가중합산(Multi-Factor)하여 매일 최고의 코스피 우량주 20선을 추천합니다.
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>
          <RefreshCw size={32} className="spin" style={{ margin: '0 auto 10px', display: 'block', color: '#3B82F6' }} />
          최신 AI 분석 데이터를 불러오는 중입니다...
        </div>
      ) : latestRec ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4B5563', fontWeight: 'bold' }}>
              <Calendar size={16} /> 
              기준일: {latestRec.date.substring(0,4)}년 {latestRec.date.substring(4,6)}월 {latestRec.date.substring(6,8)}일 장 마감 기준
            </div>
            <button 
              onClick={async () => {
                try {
                  if (navigator.share) {
                    await navigator.share({
                      title: 'AI 가치성장주 픽 (GARP)',
                      text: '한울타리 주식 스크리너 추천 종목을 확인해보세요!',
                      url: window.location.href,
                    });
                  } else {
                    await navigator.clipboard.writeText(window.location.href);
                    alert('페이지 링크가 복사되었습니다.');
                  }
                } catch (error) {
                  console.log('Error sharing:', error);
                }
              }}
              style={{
                background: 'white', color: '#4B5563', border: '1px solid #D1D5DB', padding: '6px 12px',
                borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              <Share2 size={14} /> 공유하기
            </button>
          </div>
          
          <div style={{ overflowX: 'auto', background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>순위</th>
                  <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>종목 (섹터)</th>
                  <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>총점</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>종가</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>목표가(상승여력)</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>예상 EPS</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>예상 PER</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Z-PER</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>3Y CAGR</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>PEG</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>PBR</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Z-PBR</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>BPS</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>ROE(%)</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>부채비율(%)</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>배당률(%)</th>
                </tr>
              </thead>
              <tbody>
                {latestRec.stocks.map((stock, index) => (
                  <tr key={stock.ticker} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 'bold', color: index < 3 ? '#EF4444' : '#6B7280' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '12px 15px', fontWeight: 'bold', color: '#111827' }}>
                      <a 
                        href={`https://finance.naver.com/item/main.naver?code=${stock.ticker}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#111827', textDecoration: 'none', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {stock.name} <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginLeft: '4px', fontWeight: 'normal' }}>{stock.ticker}</span>
                      </a>
                      {stock.sector && (
                        <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '2px', fontWeight: 'normal' }}>
                          {stock.sector}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                      <span style={{ 
                        backgroundColor: '#FEF3C7', 
                        color: '#D97706', 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold'
                      }}>
                        {stock.score !== undefined ? stock.score.toFixed(1) : '-'}점
                      </span>
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#4B5563' }}>
                      {stock.close.toLocaleString()}원
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                      <span style={{ color: '#E11D48', fontWeight: 'bold' }}>
                        {stock.target_price !== undefined ? stock.target_price.toLocaleString() : '-'}원
                      </span>
                      <br />
                      <span style={{ fontSize: '0.8rem', color: stock.upside && stock.upside > 0 ? '#10B981' : '#9CA3AF' }}>
                        (↑ {stock.upside !== undefined ? stock.upside.toFixed(1) : '-'}%)
                      </span>
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#4B5563' }}>
                      {stock.fwd_eps !== undefined ? stock.fwd_eps.toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#2563EB', fontWeight: '500' }}>
                      {stock.fwd_per !== undefined && stock.fwd_per > 0 ? stock.fwd_per.toFixed(2) : stock.per.toFixed(2)}배
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: stock.z_per !== undefined && stock.z_per < 0 ? '#10B981' : '#EF4444', fontWeight: 'bold' }}>
                      {stock.z_per !== undefined ? stock.z_per.toFixed(2) : '-'}
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#10B981', fontWeight: 'bold' }}>
                      {stock.eps_growth !== undefined ? `+${stock.eps_growth.toFixed(1)}` : '-'}%
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#4B5563' }}>
                      {stock.peg !== undefined ? stock.peg.toFixed(2) : '-'}
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#059669', fontWeight: '500' }}>
                      {stock.pbr.toFixed(2)}배
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: stock.z_pbr !== undefined && stock.z_pbr < 0 ? '#10B981' : '#EF4444', fontWeight: 'bold' }}>
                      {stock.z_pbr !== undefined ? stock.z_pbr.toFixed(2) : '-'}
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#4B5563' }}>
                      {stock.bps !== undefined ? stock.bps.toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#7C3AED', fontWeight: 'bold' }}>
                      {stock.roe !== undefined ? stock.roe.toFixed(2) : '-'}%
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: stock.debt_ratio !== undefined && stock.debt_ratio > 150 ? '#EF4444' : '#4B5563' }}>
                      {stock.debt_ratio !== undefined ? stock.debt_ratio.toFixed(1) : '-'}%
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#D97706', fontWeight: 'bold' }}>
                      {stock.div.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280', background: '#F9FAFB', borderRadius: '8px', border: '1px dashed #D1D5DB' }}>
          <Info size={32} style={{ margin: '0 auto 10px', display: 'block', color: '#9CA3AF' }} />
          아직 AI가 추출한 주식 추천 데이터가 없습니다.<br/>
          (매일 오후 4시 30분에 첫 데이터가 업데이트될 예정입니다.)
        </div>
      )}
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
