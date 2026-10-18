const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const logoPath = path.join(__dirname, '../public/hanul_logo.jpg');
let logoBase64 = '';
if (fs.existsSync(logoPath)) {
  logoBase64 = `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString('base64')}`;
}

const photoPath2 = path.join(__dirname, '../public/player/이동주.jpg');
let photo2Base64 = '';
if (fs.existsSync(photoPath2)) {
  photo2Base64 = `data:image/jpeg;base64,${fs.readFileSync(photoPath2).toString('base64')}`;
}

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#080e1e"/>
      <stop offset="45%" stop-color="#0f1f42"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>

    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFBEB"/>
      <stop offset="25%" stop-color="#FDE047"/>
      <stop offset="65%" stop-color="#EAB308"/>
      <stop offset="100%" stop-color="#CA8A04"/>
    </linearGradient>

    <linearGradient id="silverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="40%" stop-color="#E2E8F0"/>
      <stop offset="100%" stop-color="#94A3B8"/>
    </linearGradient>

    <linearGradient id="bronzeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF3C7"/>
      <stop offset="40%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>

    <filter id="glowGold" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <filter id="shadowCard" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)"/>

  <!-- Tennis Court Grid Lines -->
  <path d="M 0 115 L 1200 115" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <path d="M 600 115 L 600 550" stroke="rgba(255,255,255,0.05)" stroke-width="2"/>
  <circle cx="600" cy="335" r="280" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="2"/>

  <!-- Top Decorative Header with Hanul Logo -->
  <g transform="translate(60, 26)">
    ${logoBase64 ? `<clipPath id="logoClip"><rect width="66" height="66" rx="16"/></clipPath><image href="${logoBase64}" width="66" height="66" clip-path="url(#logoClip)"/>` : ''}
    <g transform="translate(82, 18)">
      <text font-family="'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif" font-size="18" font-weight="700" fill="#60A5FA" letter-spacing="3">HANULTARI TENNIS CLUB</text>
      <text y="34" font-family="'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif" font-size="36" font-weight="900" fill="#FFFFFF">한울타리 주말리그 랭킹</text>
    </g>
  </g>

  <!-- Top Right Live Pill -->
  <g transform="translate(1000, 40)">
    <rect width="140" height="40" rx="20" fill="rgba(37,99,235,0.25)" stroke="#3B82F6" stroke-width="1.5"/>
    <circle cx="24" cy="20" r="6" fill="#10B981"/>
    <text x="38" y="26" font-family="'Pretendard', 'Malgun Gothic', sans-serif" font-size="16" font-weight="800" fill="#FFFFFF">TOP 3 RANK</text>
  </g>

  <!-- ================= PODIUM CARDS (1~3위) ================= -->

  <!-- 2nd Place (Left) -->
  <g transform="translate(75, 150)" filter="url(#shadowCard)">
    <rect width="325" height="370" rx="22" fill="rgba(15, 23, 42, 0.85)" stroke="#94A3B8" stroke-width="2.5"/>
    <rect x="0" y="0" width="325" height="58" rx="22" fill="rgba(148, 163, 184, 0.12)"/>
    
    <!-- Player Photo / Badge -->
    <clipPath id="p2Clip"><circle cx="162" cy="115" r="48"/></clipPath>
    <circle cx="162" cy="115" r="50" fill="#1E293B" stroke="#CBD5E1" stroke-width="3"/>
    ${photo2Base64 ? `<image href="${photo2Base64}" x="114" y="67" width="96" height="96" clip-path="url(#p2Clip)" preserveAspectRatio="xMidYMid slice"/>` : `<text x="162" y="132" font-size="44" text-anchor="middle">🥈</text>`}

    <!-- Rank Badge -->
    <rect x="112" y="176" width="100" height="32" rx="16" fill="url(#silverGrad)"/>
    <text x="162" y="198" font-family="'Pretendard', sans-serif" font-size="18" font-weight="900" fill="#0F172A" text-anchor="middle">2위 🥈</text>

    <!-- Player Name & Score -->
    <text x="162" y="255" font-family="'Pretendard', 'Malgun Gothic', sans-serif" font-size="34" font-weight="900" fill="#F8FAFC" text-anchor="middle">이동주</text>
    <text x="162" y="295" font-family="'Pretendard', sans-serif" font-size="20" font-weight="800" fill="#93C5FD" text-anchor="middle">372 Point</text>
    <rect x="62" y="318" width="200" height="30" rx="15" fill="rgba(255,255,255,0.08)"/>
    <text x="162" y="338" font-family="'Pretendard', sans-serif" font-size="14" font-weight="700" fill="#CBD5E1" text-anchor="middle">L:332 · G:24 · R:16</text>
  </g>

  <!-- 1st Place (Center - Prominent) -->
  <g transform="translate(430, 125)" filter="url(#shadowCard)">
    <!-- Glow border -->
    <rect width="340" height="405" rx="24" fill="rgba(15, 23, 42, 0.95)" stroke="url(#goldGrad)" stroke-width="4"/>
    <rect x="0" y="0" width="340" height="66" rx="24" fill="rgba(245, 158, 11, 0.22)"/>
    
    <!-- Crown -->
    <text x="170" y="58" font-size="36" text-anchor="middle">👑</text>
    
    <!-- Player Avatar Badge -->
    <circle cx="170" cy="125" r="54" fill="#1E293B" stroke="#F59E0B" stroke-width="4" filter="url(#glowGold)"/>
    <text x="170" y="146" font-size="52" text-anchor="middle">🥇</text>

    <!-- Rank Badge -->
    <rect x="100" y="194" width="140" height="36" rx="18" fill="url(#goldGrad)" filter="url(#glowGold)"/>
    <text x="170" y="219" font-family="'Pretendard', sans-serif" font-size="21" font-weight="900" fill="#78350F" text-anchor="middle">1위 (CHAMPION)</text>

    <!-- Player Name & Score -->
    <text x="170" y="280" font-family="'Pretendard', 'Malgun Gothic', sans-serif" font-size="40" font-weight="900" fill="#FEF08A" text-anchor="middle">박성규</text>
    <text x="170" y="325" font-family="'Pretendard', sans-serif" font-size="24" font-weight="900" fill="#FDE047" text-anchor="middle">398 Point</text>
    <rect x="70" y="350" width="200" height="34" rx="17" fill="rgba(245, 158, 11, 0.15)" stroke="#F59E0B" stroke-width="1"/>
    <text x="170" y="373" font-family="'Pretendard', sans-serif" font-size="15" font-weight="800" fill="#FEF9C3" text-anchor="middle">L:370 · G:13 · R:15</text>
  </g>

  <!-- 3rd Place (Right) -->
  <g transform="translate(798, 150)" filter="url(#shadowCard)">
    <rect width="325" height="370" rx="22" fill="rgba(15, 23, 42, 0.85)" stroke="#D97706" stroke-width="2.5"/>
    <rect x="0" y="0" width="325" height="58" rx="22" fill="rgba(217, 119, 6, 0.12)"/>
    
    <!-- Medal Badge -->
    <circle cx="162" cy="115" r="48" fill="#1E293B" stroke="#D97706" stroke-width="3"/>
    <text x="162" y="132" font-size="44" text-anchor="middle">🥉</text>

    <!-- Rank Badge -->
    <rect x="112" y="176" width="100" height="32" rx="16" fill="url(#bronzeGrad)"/>
    <text x="162" y="198" font-family="'Pretendard', sans-serif" font-size="18" font-weight="900" fill="#FFFFFF" text-anchor="middle">3위 🥉</text>

    <!-- Player Name & Score -->
    <text x="162" y="255" font-family="'Pretendard', 'Malgun Gothic', sans-serif" font-size="34" font-weight="900" fill="#F8FAFC" text-anchor="middle">김종혁</text>
    <text x="162" y="295" font-family="'Pretendard', sans-serif" font-size="20" font-weight="800" fill="#FCD34D" text-anchor="middle">342 Point</text>
    <rect x="62" y="318" width="200" height="30" rx="15" fill="rgba(255,255,255,0.08)"/>
    <text x="162" y="338" font-family="'Pretendard', sans-serif" font-size="14" font-weight="700" fill="#CBD5E1" text-anchor="middle">L:318 · G:5 · R:19</text>
  </g>

  <!-- Bottom CTA Banner -->
  <g transform="translate(60, 555)">
    <rect width="1080" height="52" rx="26" fill="#1E3A8A" stroke="#3B82F6" stroke-width="2"/>
    <text x="540" y="33" font-family="'Pretendard', 'Malgun Gothic', sans-serif" font-size="20" font-weight="900" fill="#FFFFFF" text-anchor="middle">
      👉 여기 링크를 눌러 전체 랭킹을 확인하세요 (edongju.github.io)
    </text>
  </g>
</svg>
`;

async function run() {
  const outputPath = path.join(__dirname, '../public/ranking_top3_og.png');
  await sharp(Buffer.from(svg))
    .png({ quality: 95 })
    .toFile(outputPath);
  console.log('Successfully generated:', outputPath);
}

run().catch(console.error);

