const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto('http://127.0.0.1:5173/conspiracy_preview.html', { waitUntil: 'networkidle0' });

  // Move slider to frame 120 (everything is fully dropped, threads drawn, pins visible)
  await page.evaluate(() => {
    window.renderAtFrame(120);
  });

  const vp = await page.$('#viewport');
  const buffer = await vp.screenshot({ type: 'jpeg', quality: 95 });
  const outPath = 'C:/Users/AMD/.gemini/antigravity/brain/2d956349-a99c-4663-aede-6aa32c2fdf19/conspiracy_preview_rendered.jpg';
  fs.writeFileSync(outPath, buffer);
  console.log('Saved rendered preview screenshot to:', outPath);
  await browser.close();
})();

