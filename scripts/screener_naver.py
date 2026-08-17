import os
import json
import time
import datetime
import requests
import pandas as pd
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore

def get_kospi_top_200():
    # 시가총액 상위 200개 종목을 네이버 금융에서 가져오기 (1~4페이지)
    tickers = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    for page in range(1, 5):
        url = f'https://finance.naver.com/sise/sise_market_sum.naver?sosok=0&page={page}'
        res = requests.get(url, headers=headers)
        soup = BeautifulSoup(res.text, 'lxml')
        
        # 종목 링크에서 ticker 추출
        links = soup.select('table.type_2 tbody tr td a.tltle')
        for link in links:
            href = link.get('href', '')
            if 'code=' in href:
                ticker = href.split('code=')[-1]
                name = link.text.strip()
                tickers.append({'ticker': ticker, 'name': name})
                
    return tickers

def scrape_fundamentals(ticker):
    url = f'https://finance.naver.com/item/main.naver?code={ticker}'
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        res = requests.get(url, headers=headers)
        soup = BeautifulSoup(res.text, 'lxml')
        
        # 현재가
        close_tag = soup.select_one('dl.blind dd')
        close_price = 0
        if close_tag:
            text = close_tag.text
            if '현재가' in text:
                close_price = int(text.split('현재가')[1].split('전일대비')[0].replace(',', '').strip())
        
        if close_price == 0:
            # 대체 방식
            close_tag2 = soup.select_one('.no_today .blind')
            if close_tag2:
                close_price = int(close_tag2.text.replace(',', '').strip())

        per = soup.select_one('#_per')
        eps = soup.select_one('#_eps')
        pbr = soup.select_one('#_pbr')
        div = soup.select_one('#_dvr')
        if not div: div = soup.select_one('#_dvrv')
        
        cns_per = soup.select_one('#_cns_per')
        cns_eps = soup.select_one('#_cns_eps')
        
        per_val = float(per.text.replace(',', '')) if per and per.text.strip() not in ['N/A', '-'] else 0.0
        eps_val = int(eps.text.replace(',', '')) if eps and eps.text.strip() not in ['N/A', '-'] else 0
        pbr_val = float(pbr.text.replace(',', '')) if pbr and pbr.text.strip() not in ['N/A', '-'] else 0.0
        div_val = float(div.text.replace(',', '')) if div and div.text.strip() not in ['N/A', '-'] else 0.0
        
        fwd_per = float(cns_per.text.replace(',', '')) if cns_per and cns_per.text.strip() not in ['N/A', '-'] else per_val
        fwd_eps = int(cns_eps.text.replace(',', '')) if cns_eps and cns_eps.text.strip() not in ['N/A', '-'] else eps_val
        
        # BPS 추출
        bps_val = 0
        if pbr:
            try:
                tr = pbr.parent.parent
                ems = tr.select('em')
                if len(ems) > 1:
                    bps_text = ems[1].text.replace(',', '').strip()
                    if bps_text not in ['N/A', '-']:
                        bps_val = int(bps_text)
            except Exception:
                pass
        
        # ROE 및 성장성 계산
        roe_val = 0.0
        if bps_val > 0 and eps_val > 0:
            roe_val = (eps_val / bps_val) * 100
            
        eps_growth = 0.0
        if eps_val > 0 and fwd_eps > 0:
            eps_growth = ((fwd_eps - eps_val) / eps_val) * 100
            
        # 적정 주가 계산 (그레이엄 공식 간소화 모델: V = EPS * (8.5 + 2*g))
        # 보수적 측정을 위해 g(성장률)는 최대 15%로 제한, 최소 0%로 제한
        g_conservative = max(0, min(15, eps_growth))
        target_price = int(fwd_eps * (8.5 + 1.5 * g_conservative)) if fwd_eps > 0 else 0
            
        return {
            'close': close_price,
            'per': per_val,
            'pbr': pbr_val,
            'div': div_val,
            'eps': eps_val,
            'bps': bps_val,
            'roe': roe_val,
            'fwd_per': fwd_per,
            'fwd_eps': fwd_eps,
            'eps_growth': eps_growth,
            'target_price': target_price
        }
    except Exception as e:
        print(f"Error scraping {ticker}: {e}")
        return None

def fetch_and_screen():
    print("네이버 금융 KOSPI 상위 200종목 가져오는 중...")
    stocks = get_kospi_top_200()
    
    data_list = []
    print(f"총 {len(stocks)}개 종목 펀더멘털 스크래핑 시작...")
    
    for i, stock in enumerate(stocks):
        if i % 20 == 0 and i > 0:
            print(f"{i}개 완료...")
            
        fundamentals = scrape_fundamentals(stock['ticker'])
        if fundamentals and fundamentals['close'] > 0 and fundamentals['per'] > 0 and fundamentals['pbr'] > 0:
            data = {**stock, **fundamentals}
            data_list.append(data)
            
    df = pd.DataFrame(data_list)
    print(f"데이터 수집 완료: {len(df)}개 유효 종목")
    
    # 🌟 애널리스트 고도화 스크리닝 (GARP + Forward Growth)
    # 1. 미래 예상 PER 15 이하 (저평가)
    # 2. 미래 예상 EPS 성장률이 5% 이상 (이익 성장)
    # 3. PBR 1.5 이하 (자산 가치 대비 안전마진)
    # 4. 배당률 1.0% 이상 (최소한의 주주환원)
    
    cond_fwd_per = (df['fwd_per'] > 0) & (df['fwd_per'] <= 15)
    cond_growth = (df['eps_growth'] >= 5.0)
    cond_pbr = (df['pbr'] <= 1.5)
    cond_div = (df['div'] >= 1.0)
    
    df_screened = df[cond_fwd_per & cond_growth & cond_pbr & cond_div].copy()
    
    # 우선순위: 1순위 예상PER 오름차순, 2순위 EPS성장률 내림차순
    df_screened.sort_values(by=['fwd_per', 'eps_growth'], ascending=[True, False], inplace=True)
    
    top_stocks = df_screened.head(20)
    
    results = []
    for _, row in top_stocks.iterrows():
        # 상승여력(Upside) 계산
        upside = ((row['target_price'] - row['close']) / row['close'] * 100) if row['close'] > 0 else 0
        
        results.append({
            "ticker": row['ticker'],
            "name": row['name'],
            "close": int(row['close']),
            "per": float(row['per']),
            "pbr": float(row['pbr']),
            "div": float(row['div']),
            "roe": round(float(row['roe']), 2),
            "eps": int(row['eps']),
            "bps": int(row['bps']),
            "fwd_per": round(float(row['fwd_per']), 2),
            "eps_growth": round(float(row['eps_growth']), 2),
            "target_price": int(row['target_price']),
            "upside": round(float(upside), 2)
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
        'created_at': firestore.SERVER_TIMESTAMP
    })
    print(f"[{target_date}] 추천 종목 {len(results)}개 Firebase 업로드 완료!")

if __name__ == "__main__":
    t_date, screened_data = fetch_and_screen()
    if screened_data:
        upload_to_firebase(t_date, screened_data)
    else:
        print("조건에 맞는 종목이 없습니다.")
