const fs = require('fs');
const path = require('path');
// const { GoogleGenerativeAI } = require("@google/generative-ai");
// TODO: dotenv 설치 및 세팅 필요 (npm install dotenv @google/generative-ai)
// require('dotenv').config();

const PROMPT_FILE = path.join(__dirname, 'magazine_prompt.md');

async function generateDailyPost() {
  console.log("🚀 AI 테니스 매거진 포스트 생성 시작...");
  
  try {
    // 1. 프롬프트 템플릿 읽기
    const promptTemplate = fs.readFileSync(PROMPT_FILE, 'utf-8');
    
    // 2. 오늘의 요일 확인 (0: 일요일, 1: 월요일, ...)
    const dayOfWeek = new Date().getDay();
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const todayStr = days[dayOfWeek];
    
    console.log(`오늘의 요일: ${todayStr}`);
    
    // 3. AI 호출 로직 (현재는 프론트엔드 작업 전이므로 주석 처리 상태)
    /*
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // 혹은 gemini-1.5-flash
    
    const finalPrompt = promptTemplate + `\n\n오늘의 요일은 ${todayStr}입니다. 이 요일에 맞는 주제로 글을 작성해 주세요.`;
    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    let text = response.text();
    
    // JSON 파싱 (마크다운 백틱 등 제거 처리 필요)
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const postData = JSON.parse(text);
    */

    // [임시] 생성 결과 모의 객체
    const mockPostData = {
      title: `[테스트] ${todayStr} 테니스 꿀팁 🎾`,
      tags: ["#테스트", "#AI코치", "#매거진"],
      content: `이것은 스크립트에서 자동 생성된 테스트 글입니다. (${todayStr} 주제)\n\n**1. 테스트 항목 1**\n내용입니다.\n\n**2. 테스트 항목 2**\n내용입니다.\n\n💡 **AI 코치의 한줄 요약:** 시스템 연동 준비 완료!`
    };

    console.log("✅ 생성된 데이터:", mockPostData);

    // 4. Firebase Firestore 업로드 로직 (주석 처리)
    /*
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');
    // var serviceAccount = require("./firebase-admin-key.json"); // 어드민 키 필요
    
    // initializeApp({ credential: cert(serviceAccount) });
    // const db = getFirestore();
    
    // await db.collection('tennis_magazine').add({
    //   ...postData,
    //   createdAt: new Date(),
    // });
    // console.log("✅ Firebase 업로드 완료!");
    */

    console.log("✅ (진행 예정) Firebase 업로드 로직 대기 중...");

  } catch (error) {
    console.error("❌ 포스트 생성 실패:", error);
  }
}

generateDailyPost();
