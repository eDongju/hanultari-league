import os
import json
import time
import datetime
import requests
import pandas as pd
import numpy as np
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore
import FinanceDataReader as fdr

def get_bond_yield():
    try:
        url = 'https://finance.naver.com/marketindex/'
        res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        soup = BeautifulSoup(res.text, 'lxml')
        # 국고채 3년물 금리 스크래핑 시도
        # "국고채 3년" 텍스트를 가진 요소의 형제 노드 등에서 값을 찾을 수 있으나, 구조 변동 대비 기본값 설정
        # 보통 .value 안에 여러 금리가 있지만, 안전하게 3.5%를 기본값으로 사용
        for a in soup.select('a'):
            if '국고채' in a.text and '3년' in a.text:
                val = a.parent.parent.select_one('.value').text
                return float(val.replace(',', ''))
        return 3.5  # 스크래핑 실패 시 디폴트 3.5%
    except Exception as e:
        print(f"채권 금리 수집 오류: {e}")
        return 3.5

def get_kospi_top_200():
    df_kospi = fdr.StockListing('KOSPI')
    df_kospi = df_kospi.head(200)
    
    df_desc = fdr.StockListing('KRX-DESC')
    df_merged = pd.merge(df_kospi, df_desc[['Code', 'Sector']], on='Code', how='left')
    
    tickers = []
    for _, row in df_merged.iterrows():
        tickers.append({
            'ticker': str(row['Code']),
            'name': row['Name'],
            'sector': row['Sector'] if pd.notna(row['Sector']) else '기타'
        })
    return tickers

def parse_num(text):
    if not text or text.strip() in ['N/A', '-', '']: return 0.0
    try:
        return float(text.replace(',', '').strip())
    except:
        return 0.0

def scrape_fundamentals(ticker):
    url = f'https://finance.naver.com/item/main.naver?code={ticker}'
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        res = requests.get(url, headers=headers)
        soup = BeautifulSoup(res.text, 'lxml')
        
        # 현재가
        close_price = 0
        close_tag = soup.select_one('dl.blind dd')
        if close_tag and '현재가' in close_tag.text:
            close_price = int(close_tag.text.split('현재가')[1].split('전일대비')[0].replace(',', '').strip())
        if close_price == 0:
            close_tag2 = soup.select_one('.no_today .blind')
            if close_tag2: close_price = int(close_tag2.text.replace(',', '').strip())

        # 기본 지표
        per = parse_num(soup.select_one('#_per').text if soup.select_one('#_per') else '')
        pbr = parse_num(soup.select_one('#_pbr').text if soup.select_one('#_pbr') else '')
        div_tag = soup.select_one('#_dvr') or soup.select_one('#_dvrv')
        div = parse_num(div_tag.text if div_tag else '')
        
        cns_per = parse_num(soup.select_one('#_cns_per').text if soup.select_one('#_cns_per') else '')
        cns_eps = parse_num(soup.select_one('#_cns_eps').text if soup.select_one('#_cns_eps') else '')
        
        fwd_per = cns_per if cns_per > 0 else per
        fwd_eps = cns_eps if cns_eps > 0 else 0
        
        # 기업실적분석 표 파싱
        table = soup.select_one('table.tb_type1_ifrs')
        eps_list = []
        debt_ratio = 0.0
        op_profit_list = []
        roe_val = 0.0
        
        if table:
            for tr in table.select('tbody tr'):
                th = tr.select_one('th')
                if not th: continue
                th_text = th.text.strip()
                
                tds = [td.text.strip().replace(',', '') for td in tr.select('td')]
                if len(tds) >= 4:
                    if 'EPS' in th_text:
                        eps_list = [parse_num(v) for v in tds[:4]]
                    elif '부채비율' in th_text:
                        debt_ratio = parse_num(tds[2]) if parse_num(tds[2]) > 0 else parse_num(tds[3])
                    elif '영업이익' in th_text and '율' not in th_text:
                        op_profit_list = [parse_num(v) for v in tds[:4]]
                    elif 'ROE' in th_text:
                        roe_val = parse_num(tds[3]) if parse_num(tds[3]) > 0 else parse_num(tds[2])
        
        # 3-Year CAGR 계산 (EPS_Y-3 -> EPS_Y(E))
        cagr_3y = 0.0
        if len(eps_list) >= 4 and eps_list[0] > 0 and eps_list[3] > 0:
            cagr_3y = ((eps_list[3] / eps_list[0]) ** (1/3) - 1) * 100
        elif fwd_eps > 0 and len(eps_list) >= 3 and eps_list[2] > 0:
            cagr_3y = ((fwd_eps - eps_list[2]) / eps_list[2]) * 100  # 1-year growth fallback
            
        # PEG 계산 (Forward PER / 3Y CAGR)
        peg = 0.0
        if cagr_3y > 0 and fwd_per > 0:
            peg = fwd_per / cagr_3y
        elif cagr_3y <= 0 and fwd_per > 0:
            peg = 999.0 # 성장 역성장 시 페널티
            
        return {
            'close': close_price,
            'per': per,
            'pbr': pbr,
            'div': div,
            'fwd_per': fwd_per,
            'fwd_eps': fwd_eps,
            'cagr_3y': cagr_3y,
            'peg': peg,
            'debt_ratio': debt_ratio,
            'roe': roe_val,
            'op_profit_positive': all(op > 0 for op in op_profit_list) if len(op_profit_list) >= 4 else False
        }
    except Exception as e:
        print(f"Error scraping {ticker}: {e}")
        return None

def fetch_and_screen():
    print("네이버 금융 KOSPI 상위 200종목 가져오는 중...")
    stocks = get_kospi_top_200()
    bond_yield = get_bond_yield()
    print(f"현재 무위험 채권 금리(Y): {bond_yield}% 적용")
    
    data_list = []
    print(f"총 {len(stocks)}개 종목 펀더멘털 스크래핑 시작...")
    
    for i, stock in enumerate(stocks):
        if i % 20 == 0 and i > 0:
            print(f"{i}개 완료...")
            
        fundamentals = scrape_fundamentals(stock['ticker'])
        if fundamentals and fundamentals['close'] > 0 and fundamentals['fwd_per'] > 0:
            data = {**stock, **fundamentals}
            data_list.append(data)
            
    df = pd.DataFrame(data_list)
    print(f"데이터 수집 완료: {len(df)}개 유효 종목")
    
    # 1. Sector Neutral Valuation (섹터 내 Z-Score 계산)
    # Z-Score는 낮을수록 저평가이므로 (X - Mean) / Std 
    # 단, 표준편차가 0이거나 데이터가 1개뿐인 섹터는 0으로 처리
    df['sector_per_mean'] = df.groupby('sector')['fwd_per'].transform('mean')
    df['sector_per_std'] = df.groupby('sector')['fwd_per'].transform('std')
    df['z_per'] = np.where(df['sector_per_std'] > 0, (df['fwd_per'] - df['sector_per_mean']) / df['sector_per_std'], 0)
    
    df['sector_pbr_mean'] = df.groupby('sector')['pbr'].transform('mean')
    df['sector_pbr_std'] = df.groupby('sector')['pbr'].transform('std')
    df['z_pbr'] = np.where(df['sector_pbr_std'] > 0, (df['pbr'] - df['sector_pbr_mean']) / df['sector_pbr_std'], 0)
    
    # 2. 사경인 S-RIM 목표가 (S-RIM Valuation)
    # V = BPS + [BPS * (ROE - COE) / COE]
    # COE(기대수익률)는 보통 BBB- 5년물 회사채 금리를 쓰지만, 여기서는 국고채 금리 + 4.5% (대략 8.0%) 적용
    coe = (bond_yield + 4.5) / 100.0
    
    # BPS 산출 (현재가 / PBR)
    df['bps'] = np.where(df['pbr'] > 0, df['close'] / df['pbr'], 0)
    
    # S-RIM 목표가
    df['target_price'] = (df['bps'] + df['bps'] * ((df['roe'] / 100.0) - coe) / coe).fillna(0).astype(int)
    df['target_price'] = np.where(df['target_price'] < 0, 0, df['target_price']) # 음수 방지
    
    df['upside'] = np.where(df['close'] > 0, (df['target_price'] - df['close']) / df['close'] * 100, 0)
    
    # 3. Quality 필터링 (금융업 제외 부채비율 150% 이하)
    # 금융업 섹터명에 '금융', '보험', '은행', '증권' 등이 포함된 경우 부채비율 컷오프 면제
    is_finance = df['sector'].str.contains('금융|보험|은행|증권|지주', na=False)
    cond_quality = (df['debt_ratio'] <= 150) | is_finance
    
    df_filtered = df[cond_quality].copy()
    
    # 4. Multi-Factor 스코어링 (Percentile Rank)
    # pct_rank는 0~1 사이 값, 1이 가장 좋은 점수
    # Value (35%): Z-Score가 낮을수록 좋음 (ascending=False 적용 시 가장 낮은 값이 rank 1)
    df_filtered['rank_value'] = (df_filtered['z_per'].rank(ascending=False, pct=True) + df_filtered['z_pbr'].rank(ascending=False, pct=True)) / 2
    
    # Growth (35%): CAGR은 높을수록(ascending=True), PEG는 낮을수록 좋음(ascending=False)
    df_filtered['rank_growth'] = (df_filtered['cagr_3y'].rank(ascending=True, pct=True) + df_filtered['peg'].rank(ascending=False, pct=True)) / 2
    
    # Quality (15%): ROE 높을수록(True), 부채비율 낮을수록(False)
    df_filtered['rank_quality'] = (df_filtered['roe'].rank(ascending=True, pct=True) + df_filtered['debt_ratio'].rank(ascending=False, pct=True)) / 2
    
    # Dividend (15%): 배당률 높을수록(True)
    df_filtered['rank_dividend'] = df_filtered['div'].rank(ascending=True, pct=True)
    
    df_filtered['total_score'] = (
        0.35 * df_filtered['rank_value'] + 
        0.35 * df_filtered['rank_growth'] + 
        0.15 * df_filtered['rank_quality'] + 
        0.15 * df_filtered['rank_dividend']
    )
    
    # 1순위: Total Score 내림차순, 2순위: Upside 내림차순
    df_filtered.sort_values(by=['total_score', 'upside'], ascending=[False, False], inplace=True)
    
    top_stocks = df_filtered.head(20)
    
    results = []
    for _, row in top_stocks.iterrows():
        results.append({
            "ticker": row['ticker'],
            "name": row['name'],
            "close": int(row['close']),
            "per": float(row['per']),
            "pbr": float(row['pbr']),
            "div": float(row['div']),
            "roe": round(float(row['roe']), 2),
            "eps": 0, # Unused
            "bps": 0, # Unused
            "fwd_per": round(float(row['fwd_per']), 2),
            "eps_growth": round(float(row['cagr_3y']), 2), # Frontend uses eps_growth mapping
            "target_price": int(row['target_price']),
            "upside": round(float(row['upside']), 2),
            "score": round(float(row['total_score']) * 100, 1),
            "sector": row['sector']
        })
        
    target_date = datetime.datetime.today().strftime("%Y%m%d")
    return target_date, results

def upload_to_firebase(target_date, results):
    cred_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    
    if cred_json:
        cred_dict = json.loads(cred_json)
        cred = credentials.Certificate(cred_dict)
    else:
        key_path = r"D:\00_AI_Agent\config\firebase_key.json"
        if not os.path.exists(key_path):
            print(f"오류: 환경 변수도 없고 {key_path} 파일도 찾을 수 없습니다.")
            return
        cred = credentials.Certificate(key_path)
    
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
        
    db = firestore.client()
    
    doc_ref = db.collection('stock_recommendations').document(target_date)
    doc_ref.set({
        'date': target_date,
        'stocks': results,
        'created_at': firestore.SERVER_TIMESTAMP,
        'model_version': 'v3.0_institutional'
    })
    print(f"[{target_date}] 기관급 멀티팩터 추천 종목 {len(results)}개 Firebase 업로드 완료!")

if __name__ == "__main__":
    t_date, screened_data = fetch_and_screen()
    if screened_data:
        upload_to_firebase(t_date, screened_data)
    else:
        print("조건에 맞는 종목이 없습니다.")
