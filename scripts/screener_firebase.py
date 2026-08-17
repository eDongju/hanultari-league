import os
import json
import datetime
import pandas as pd
from pykrx import stock
import firebase_admin
from firebase_admin import credentials, firestore

def get_latest_business_day():
    today = datetime.datetime.today()
    # pandas bdate_range를 사용하여 오늘 기준 가장 최근 영업일 산출
    last_bday = pd.bdate_range(end=today, periods=1)[0]
    return last_bday.strftime("%Y%m%d")

def fetch_and_screen():
    # 환경 변수에서 TARGET_DATE를 확인, 없으면 가장 최근 영업일 자동 계산
    env_date = os.environ.get('TARGET_DATE', '').strip()
    target_date = env_date if env_date else get_latest_business_day()
    
    print(f"[{target_date}] 데이터 수집 시작...")
    
    df_price = stock.get_market_cap_by_ticker(target_date, market="KOSPI")
    df_price.reset_index(inplace=True)
    df_price.rename(columns={'티커': '종목코드'}, inplace=True)
    
    df_fundamental = stock.get_market_fundamental_by_ticker(target_date, market="KOSPI")
    df_fundamental.reset_index(inplace=True)
    df_fundamental.rename(columns={'티커': '종목코드'}, inplace=True)
    
    df_merged = pd.merge(df_price, df_fundamental, on='종목코드', how='inner')
    df_merged['종목명'] = df_merged['종목코드'].apply(lambda x: stock.get_market_ticker_name(x))
    
    print("스크리닝 조건 적용 중...")
    df = df_merged[(df_merged['PER'] > 0) & (df_merged['PBR'] > 0)].copy()
    
    # GARP + Quality Value Screening
    cond_value = (df['PER'] <= 15) & (df['PBR'] <= 1.5)
    cond_dividend = (df['DIV'] >= 1.5)
    
    df_screened = df[cond_value & cond_dividend].copy()
    df_screened.sort_values(by=['PER', 'DIV'], ascending=[True, False], inplace=True)
    
    # 상위 20개 추출
    top_stocks = df_screened.head(20)
    
    results = []
    for _, row in top_stocks.iterrows():
        results.append({
            "ticker": row['종목코드'],
            "name": row['종목명'],
            "close": int(row.get('종가', 0)),
            "per": float(row['PER']),
            "pbr": float(row['PBR']),
            "div": float(row['DIV'])
        })
        
    return target_date, results

def upload_to_firebase(target_date, results):
    # Firebase 인증 정보 로드 (GitHub Secrets에서 주입)
    cred_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
    if not cred_json:
        print("오류: FIREBASE_SERVICE_ACCOUNT 환경 변수가 없습니다.")
        return
        
    cred_dict = json.loads(cred_json)
    cred = credentials.Certificate(cred_dict)
    
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
        
    db = firestore.client()
    
    doc_ref = db.collection('stock_recommendations').document(target_date)
    doc_ref.set({
        "date": target_date,
        "created_at": firestore.SERVER_TIMESTAMP,
        "stocks": results
    })
    
    print(f"[{target_date}] 추천 종목 {len(results)}개 Firebase 업로드 완료!")

if __name__ == "__main__":
    try:
        date_str, stocks = fetch_and_screen()
        upload_to_firebase(date_str, stocks)
    except Exception as e:
        print(f"스크리닝 중 오류 발생: {e}")
