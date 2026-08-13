import sharp from 'sharp';
import fs from 'fs';

async function generateIcons() {
  const input = 'public/hanul_logo.jpg';
  
  if (!fs.existsSync(input)) {
    console.error('File not found:', input);
    return;
  }

  try {
    // 192x192
    await sharp(input)
      .resize(192, 192, { fit: 'cover' })
      .toFile('public/pwa-192x192.png');
    console.log('Created pwa-192x192.png');

    // 512x512
    await sharp(input)
      .resize(512, 512, { fit: 'cover' })
      .toFile('public/pwa-512x512.png');
    console.log('Created pwa-512x512.png');

    // apple-touch-icon (180x180)
    await sharp(input)
      .resize(180, 180, { fit: 'cover' })
      .toFile('public/apple-touch-icon.png');
    console.log('Created apple-touch-icon.png');

    // favicon.png (using 32x32 for simplicity, modern browsers support it)
    await sharp(input)
      .resize(32, 32, { fit: 'cover' })
      .toFile('public/favicon.png');
    console.log('Created favicon.png');

  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

generateIcons();
