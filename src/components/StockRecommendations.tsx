import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { TrendingUp, Calendar, Info, RefreshCw } from 'lucide-react';

interface StockData {
  ticker: string;
  name: string;
  close: number;
  per: number;
  pbr: number;
  div: number;
  roe?: number;
  eps?: number;
  bps?: number;
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
    <div className="content-card" style={{ maxWidth: '900px', margin: '0 auto' }}>
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
          <strong>GARP (Growth At a Reasonable Price) 퀀트 전략</strong><br/>
          PER 15배 이하, PBR 1.5배 이하의 <strong>저평가 가치주</strong>이면서 동시에 배당수익률 1.5% 이상으로 <strong>하방 방어력</strong>을 갖춘 코스피 우량주를 
          매일 오후 4시 30분에 AI 알고리즘이 자동으로 분석하여 추천합니다.
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280' }}>
          <RefreshCw size={32} className="spin" style={{ margin: '0 auto 10px', display: 'block', color: '#3B82F6' }} />
          최신 AI 분석 데이터를 불러오는 중입니다...
        </div>
      ) : latestRec ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px', color: '#4B5563', fontWeight: 'bold' }}>
            <Calendar size={16} /> 
            기준일: {latestRec.date.substring(0,4)}년 {latestRec.date.substring(4,6)}월 {latestRec.date.substring(6,8)}일 장 마감 기준
          </div>
          
          <div style={{ overflowX: 'auto', background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ padding: '12px 15px', textAlign: 'center', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>순위</th>
                  <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>종목명</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>종가</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>PER</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>PBR</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>ROE(%)</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>배당률</th>
                  <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #E5E7EB', color: '#4B5563', fontSize: '0.9rem' }}>EPS/BPS</th>
                </tr>
              </thead>
              <tbody>
                {latestRec.stocks.map((stock, index) => (
                  <tr key={stock.ticker} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 'bold', color: index < 3 ? '#EF4444' : '#6B7280' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '12px 15px', fontWeight: 'bold', color: '#111827' }}>
                      {stock.name} <span style={{ fontSize: '0.75rem', color: '#9CA3AF', marginLeft: '4px', fontWeight: 'normal' }}>{stock.ticker}</span>
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#374151' }}>
                      {stock.close.toLocaleString()}원
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#2563EB', fontWeight: '500' }}>
                      {stock.per.toFixed(2)}배
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#059669', fontWeight: '500' }}>
                      {stock.pbr.toFixed(2)}배
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#7C3AED', fontWeight: 'bold' }}>
                      {stock.roe !== undefined ? stock.roe.toFixed(2) : '-'}%
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#D97706', fontWeight: 'bold' }}>
                      {stock.div.toFixed(2)}%
                    </td>
                    <td style={{ padding: '12px 15px', textAlign: 'right', color: '#4B5563', fontSize: '0.85rem' }}>
                      {stock.eps !== undefined ? stock.eps.toLocaleString() : '-'}/{stock.bps !== undefined ? stock.bps.toLocaleString() : '-'}
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
