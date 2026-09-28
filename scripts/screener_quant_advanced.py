import os
import json
import time
import datetime
import re
import requests
import pandas as pd
import numpy as np
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
import firebase_admin
from firebase_admin import credentials, firestore
import FinanceDataReader as fdr

def get_bond_yield():
    try:
        url = 'https://finance.naver.com/marketindex/'
        res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
        soup = BeautifulSoup(res.text, 'lxml')
        for a in soup.select('a'):
            if '국고채' in a.text and '3년' in a.text:
                val = a.parent.parent.select_one('.value').text
                return float(val.replace(',', ''))
        return 3.5
    except Exception as e:
        print(f"채권 금리 수집 오류: {e}")
        return 3.5

def get_kospi_top_stocks(limit=200):
    print(f"FinanceDataReader를 통해 KOSPI 상위 {limit}개 종목 수집 중...")
    try:
        df_kospi = fdr.StockListing('KOSPI')
        # 보통주만 필터링 (티커 끝이 '0'으로 끝나는 종목)
        df_kospi = df_kospi[df_kospi['Code'].astype(str).str.endswith('0')].copy()
        # 시가총액 기준 내림차순 정렬
        df_kospi.sort_values(by='Marcap', ascending=False, inplace=True)
        top = df_kospi.head(limit)
        
        tickers = []
        for _, row in top.iterrows():
            tickers.append({
                'ticker': str(row['Code']),
                'name': str(row['Name'])
            })
        print(f"KOSPI 상위 {len(tickers)}개 보통주 종목 선정 완료.")
        return tickers
    except Exception as e:
        print(f"FDR 수집 오류: {e}")
        return []

def parse_num(val):
    if not val:
        return 0.0
    clean = re.sub(r'[^0-9.-]', '', str(val))
    if not clean or clean in ['-', '.', '-.']:
        return 0.0
    try:
        return float(clean)
    except:
        return 0.0

def fetch_single_stock(stock, headers):
    ticker = stock['ticker']
    name = stock['name']
    try:
        # 1. 네이버 모바일 통합 정보 API (현재가, PER, PBR, 배당률, EPS, BPS, 컨센서스)
        url_int = f'https://m.stock.naver.com/api/stock/{ticker}/integration'
        r_int = requests.get(url_int, headers=headers, timeout=6).json()
        info_map = {item['code']: item.get('value') for item in r_int.get('totalInfos', [])}

        close_price = int(parse_num(info_map.get('lastClosePrice', 0)))
        per = parse_num(info_map.get('per', 0))
        pbr = parse_num(info_map.get('pbr', 0))
        div = parse_num(info_map.get('dividendYieldRatio', 0))
        eps = int(parse_num(info_map.get('eps', 0)))
        bps = int(parse_num(info_map.get('bps', 0)))
        
        cns_per = parse_num(info_map.get('cnsPer', 0))
        cns_eps = int(parse_num(info_map.get('cnsEps', 0)))
        
        fwd_per = cns_per if cns_per > 0 else per
        fwd_eps = cns_eps if cns_eps > 0 else eps

        if close_price <= 0 or fwd_per <= 0 or pbr <= 0:
            return None

        # 2. 연간 재무제표 API (ROE, 부채비율, 3년 EPS 히스토리)
        url_fin = f'https://m.stock.naver.com/api/stock/{ticker}/finance/annual'
        debt_ratio = 0.0
        roe = 0.0
        cagr_3y = 0.0
        peg = 999.0
        
        try:
            r_fin = requests.get(url_fin, headers=headers, timeout=6).json()
            rows = {r['title']: r.get('columns', {}) for r in r_fin.get('financeInfo', {}).get('rowList', [])}
            
            debt_cols = rows.get('부채비율', {})
            for col in sorted(debt_cols.keys(), reverse=True):
                v = parse_num(debt_cols[col].get('value'))
                if v > 0:
                    debt_ratio = v
                    break
                    
            roe_cols = rows.get('ROE', {})
            for col in sorted(roe_cols.keys(), reverse=True):
                v = parse_num(roe_cols[col].get('value'))
                if v > 0:
                    roe = v
                    break
                    
            eps_cols = rows.get('EPS', {})
            eps_vals = [parse_num(eps_cols[c].get('value')) for c in sorted(eps_cols.keys())]
            if len(eps_vals) >= 4 and eps_vals[0] > 0 and eps_vals[3] > 0:
                cagr_3y = ((eps_vals[3] / eps_vals[0]) ** (1/3) - 1) * 100
            elif fwd_eps > 0 and len(eps_vals) >= 3 and eps_vals[2] > 0:
                cagr_3y = ((fwd_eps - eps_vals[2]) / eps_vals[2]) * 100
                
            if cagr_3y > 0 and fwd_per > 0:
                peg = fwd_per / cagr_3y
        except Exception:
            pass

        # 3. WICS 섹터 (WiseReport)
        sector_val = '제조업'
        try:
            w_url = f'https://navercomp.wisereport.co.kr/v2/company/c1010001.aspx?cmp_cd={ticker}'
            w_res = requests.get(w_url, headers=headers, timeout=5)
            for line in w_res.text.split('\n'):
                if 'WICS :' in line:
                    sector_val = line.split('WICS :')[1].split('<')[0].strip()
                    break
        except Exception:
            pass

        return {
            'ticker': ticker,
            'name': name,
            'close': close_price,
            'per': per,
            'pbr': pbr,
            'div': div,
            'fwd_per': fwd_per,
            'fwd_eps': fwd_eps,
            'cagr_3y': cagr_3y,
            'peg': peg,
            'debt_ratio': debt_ratio,
            'roe': roe,
            'sector': sector_val,
            'bps': bps if bps > 0 else (int(close_price / pbr) if pbr > 0 else 0)
        }
    except Exception:
        return None

def fetch_and_screen():
    stocks = get_kospi_top_stocks(200)
    if not stocks:
        print("종목 목록을 가져오지 못했습니다.")
        return None, []

    bond_yield = get_bond_yield()
    print(f"현재 무위험 채권 금리(Y): {bond_yield}% 적용")

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://m.stock.naver.com/'
    }

    print(f"총 {len(stocks)}개 종목 멀티스레드 펀더멘털 수집 시작...")
    data_list = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_single_stock, s, headers): s for s in stocks}
        for future in as_completed(futures):
            res = future.result()
            if res:
                data_list.append(res)

    print(f"데이터 수집 완료: {len(data_list)}개 유효 종목")
    if not data_list:
        print("유효한 종목 데이터가 없습니다.")
        return None, []

    df = pd.DataFrame(data_list)

    # 1. Sector Neutral Valuation (섹터 내 Z-Score 계산)
    df['sector_per_mean'] = df.groupby('sector')['fwd_per'].transform('mean')
    df['sector_per_std'] = df.groupby('sector')['fwd_per'].transform('std')
    df['z_per'] = np.where(df['sector_per_std'] > 0, (df['fwd_per'] - df['sector_per_mean']) / df['sector_per_std'], 0)

    df['sector_pbr_mean'] = df.groupby('sector')['pbr'].transform('mean')
    df['sector_pbr_std'] = df.groupby('sector')['pbr'].transform('std')
    df['z_pbr'] = np.where(df['sector_pbr_std'] > 0, (df['pbr'] - df['sector_pbr_mean']) / df['sector_pbr_std'], 0)

    # 2. 사경인 S-RIM 목표가 (S-RIM Valuation)
    coe = (bond_yield + 4.5) / 100.0
    df['bps'] = np.where(df['bps'] > 0, df['bps'], np.where(df['pbr'] > 0, df['close'] / df['pbr'], 0))
    df['target_price'] = (df['bps'] + df['bps'] * ((df['roe'] / 100.0) - coe) / coe).fillna(0).astype(int)
    df['target_price'] = np.where(df['target_price'] < 0, 0, df['target_price'])
    df['upside'] = np.where(df['close'] > 0, (df['target_price'] - df['close']) / df['close'] * 100, 0)

    # 3. Quality 필터링 (금융업 제외 부채비율 150% 이하) 및 상승여력 필터링 (Upside 10% 이상)
    is_finance = df['sector'].str.contains('금융|보험|은행|증권|지주', na=False)
    cond_quality = ((df['debt_ratio'] <= 150) | is_finance) & (df['upside'] >= 10)
    df_filtered = df[cond_quality].copy()

    # 필터링 결과가 20개 미만일 경우 상승여력 기준 완화
    if len(df_filtered) < 20:
        cond_relaxed = ((df['debt_ratio'] <= 200) | is_finance) & (df['upside'] >= 0)
        df_filtered = df[cond_relaxed].copy()
    if len(df_filtered) < 20:
        df_filtered = df.copy()

    # 4. Multi-Factor 스코어링 (Percentile Rank)
    df_filtered['rank_value'] = (df_filtered['z_per'].rank(ascending=False, pct=True) + df_filtered['z_pbr'].rank(ascending=False, pct=True)) / 2
    df_filtered['rank_growth'] = (df_filtered['cagr_3y'].rank(ascending=True, pct=True) + df_filtered['peg'].rank(ascending=False, pct=True)) / 2
    df_filtered['rank_quality'] = (df_filtered['roe'].rank(ascending=True, pct=True) + df_filtered['debt_ratio'].rank(ascending=False, pct=True)) / 2
    df_filtered['rank_dividend'] = df_filtered['div'].rank(ascending=True, pct=True)

    df_filtered['total_score'] = (
        0.35 * df_filtered['rank_value'] + 
        0.35 * df_filtered['rank_growth'] + 
        0.15 * df_filtered['rank_quality'] + 
        0.15 * df_filtered['rank_dividend']
    )

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
            "debt_ratio": round(float(row['debt_ratio']), 2),
            "fwd_per": round(float(row['fwd_per']), 2),
            "fwd_eps": int(row['fwd_eps']),
            "eps_growth": round(float(row['cagr_3y']), 2),
            "peg": round(float(row['peg']), 2),
            "bps": int(row['bps']),
            "z_per": round(float(row['z_per']), 2),
            "z_pbr": round(float(row['z_pbr']), 2),
            "target_price": int(row['target_price']),
            "upside": round(float(row['upside']), 2),
            "score": round(float(row['total_score']) * 100, 1),
            "sector": row['sector'],
            "bond_yield": float(bond_yield)
        })

    target_date = os.environ.get('TARGET_DATE')
    if not target_date or target_date.strip() == '':
        kst = datetime.timezone(datetime.timedelta(hours=9))
        target_date = datetime.datetime.now(kst).strftime("%Y%m%d")

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
