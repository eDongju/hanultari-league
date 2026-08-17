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

        # 투자정보 테이블
        per, pbr, dividend, eps, bps = 0.0, 0.0, 0.0, 0, 0
        
        info_table = soup.select('.aside_invest_info em')
        for em in info_table:
            th = em.parent.parent.select_one('th')
            if not th:
                continue
            th_text = th.text.strip()
            val_text = em.text.strip().replace(',', '')
            
            if val_text and val_text != 'N/A' and val_text != '-':
                try:
                    if 'PER' in th_text and 'EPS' not in th_text:
                        per = float(val_text)
                    elif 'EPS' in th_text:
                        eps = int(val_text)
                    elif 'PBR' in th_text and 'BPS' not in th_text:
                        pbr = float(val_text)
                    elif 'BPS' in th_text:
                        bps = int(val_text)
                    elif '배당수익률' in th_text:
                        dividend = float(val_text.replace('%', ''))
                except ValueError:
                    pass
        
        # ROE 계산 (Naver 기업실적분석 표에서 가져오거나 수동 계산)
        roe = 0.0
        if bps > 0 and eps > 0:
            roe = (eps / bps) * 100
            
        return {
            'close': close_price,
            'per': per,
            'pbr': pbr,
            'div': dividend,
            'eps': eps,
            'bps': bps,
            'roe': roe
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
    
    # GARP Screening
    cond_value = (df['per'] <= 15) & (df['pbr'] <= 1.5)
    cond_dividend = (df['div'] >= 1.5)
    
    df_screened = df[cond_value & cond_dividend].copy()
    df_screened.sort_values(by=['per', 'div'], ascending=[True, False], inplace=True)
    
    top_stocks = df_screened.head(20)
    
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
            "eps": int(row['eps']),
            "bps": int(row['bps'])
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
