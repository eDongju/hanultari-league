const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config(); // 로컬 테스트 시 .env 파일 사용

const PROMPT_FILE = path.join(__dirname, 'magazine_prompt.md');

async function generateDailyPost() {
  console.log("🚀 AI 테니스 매거진 포스트 생성 시작...");
  
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY 환경 변수가 없습니다. GitHub Secrets 설정을 확인해주세요.");
    }

    // 1. 프롬프트 템플릿 읽기
    const promptTemplate = fs.readFileSync(PROMPT_FILE, 'utf-8');
    
    // 2. 오늘의 요일 확인 (0: 일요일, 1: 월요일, ...)
    const dayOfWeek = new Date().getDay();
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const todayStr = days[dayOfWeek];
    
    console.log(`오늘의 요일: ${todayStr}`);
    
    // 3. AI 호출 로직
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // 2026년 기준 최신 모델 명칭으로 재시도 (혹은 사용 가능한 모델 자동 감지)
    // 에러 원인 파악을 위해 먼저 사용 가능한 모델 리스트를 출력합니다.
    console.log("🔍 사용 가능한 AI 모델 목록을 조회 중입니다...");
    const modelRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const modelData = await modelRes.json();
    if (modelData.models) {
      const availableModels = modelData.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent"))
        .map(m => m.name.replace("models/", ""));
      console.log("✅ 현재 API 키로 사용 가능한 모델 목록:", availableModels);
      
      // 사용 가능한 모델들을 순회하며 성공할 때까지 시도합니다.
      let postData = null;
      let selectedModelName = "";

      for (const m of availableModels) {
        try {
          console.log(`🤖 모델 시도 중: ${m}...`);
          const model = genAI.getGenerativeModel({ 
            model: m,
            tools: [{ googleSearch: {} }]
          });
          const finalPrompt = promptTemplate + `\n\n오늘의 요일은 ${todayStr}입니다. 이 요일에 맞는 주제로 글을 작성해 주세요.`;
          
          const result = await model.generateContent(finalPrompt);
          const response = await result.response;
          let text = response.text();
          
          // JSON 파싱 시도 (마크다운 백틱 및 불필요한 텍스트 제거)
          const firstBrace = text.indexOf('{');
          const lastBrace = text.lastIndexOf('}');
          
          if (firstBrace === -1 || lastBrace === -1) {
            throw new Error("JSON 형식을 찾을 수 없습니다.");
          }
          
          const jsonStr = text.substring(firstBrace, lastBrace + 1);
          postData = JSON.parse(jsonStr);
          selectedModelName = m;
          
          // 필수 필드 검증
          if (!postData.title || !postData.content) {
            throw new Error("필수 JSON 필드(title, content)가 누락되었습니다.");
          }
          
          console.log(`✅ 모델 ${m} (으)로 생성 및 JSON 파싱 완벽 성공!`);
          break; // 완벽하게 성공하면 루프 종료
        } catch (err) {
          console.warn(`⚠️ 모델 ${m} 실패 (원인: ${err.message}) - 다음 모델로 넘어갑니다.`);
        }
      }

      if (!postData) {
        throw new Error("사용 가능한 모든 모델에서 유효한 JSON 생성을 실패했습니다.");
      }
  
      console.log("✅ 최종 생성된 데이터:", postData);
  
      // 4. Firebase Firestore 업로드 로직
    // GitHub Actions에서는 환경 변수 JSON 문자열로 파싱, 로컬에서는 키 파일 사용 가능
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT 환경 변수가 없습니다. Firestore 업로드를 건너뜁니다.");
      return;
    }
    
    // 이미 초기화된 앱이 없을 때만 초기화
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    const db = getFirestore();
    
    // 'hanullog' 컬렉션에 새 문서 추가
    await db.collection('hanullog').add({
      ...postData,
      date: new Date().toISOString(),
      createdAt: new Date(),
    });
    
    console.log("✅ Firebase 업로드 완료!");    } else {
      throw new Error("모델 목록을 불러오지 못했습니다. API 키가 유효한지 확인해주세요.");
    }

  } catch (error) {
    console.error("❌ 포스트 생성 실패:", error);
  }
}

generateDailyPost();
