const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 700 });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body {
      margin: 0;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 650px;
      height: 650px;
    }
  </style>
</head>
<body>
  <div id="lensContainer" style="position: relative; width: 560px; height: 560px;">
    <!-- Circular Brass Lens Ring -->
    <div style="
      position: absolute;
      top: 30px;
      left: 30px;
      width: 320px;
      height: 320px;
      border-radius: 50%;
      border: 20px solid #c89338;
      box-shadow: 0 30px 70px rgba(0,0,0,0.85), inset 0 5px 12px rgba(255,255,255,0.7), inset 0 -10px 20px rgba(70,40,10,0.9), 0 0 0 5px #5c3e10;
      background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.38) 0%, rgba(255,245,210,0.18) 35%, rgba(210,180,120,0.08) 65%, rgba(45,35,20,0.4) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    ">
      <!-- Lens Glare Highlight -->
      <div style="
        position: absolute;
        top: 20px;
        left: 32px;
        width: 150px;
        height: 75px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(255,255,255,0.7) 0%, transparent 75%);
        transform: rotate(-32deg);
      "></div>
      
      <!-- Inner Thin Gold Bezel Ring -->
      <div style="
        width: 270px;
        height: 270px;
        border-radius: 50%;
        border: 2.5px solid rgba(255, 230, 160, 0.45);
      "></div>
    </div>

    <!-- Brass Collar Mount -->
    <div style="
      position: absolute;
      top: 300px;
      left: 300px;
      width: 36px;
      height: 48px;
      background: linear-gradient(90deg, #4a2f0a 0%, #e8b958 45%, #fff1b0 60%, #754810 100%);
      border-radius: 6px;
      transform: rotate(-45deg);
      box-shadow: 0 8px 18px rgba(0,0,0,0.7);
      z-index: 12;
    "></div>

    <!-- Dark Antique Wood Handle with Elegant Lathed Grip -->
    <div style="
      position: absolute;
      top: 325px;
      left: 325px;
      width: 28px;
      height: 220px;
      background: linear-gradient(90deg, #1f1008 0%, #3d2012 25%, #5a301c 50%, #3d2012 75%, #150a04 100%);
      border-radius: 14px 14px 20px 20px;
      transform: rotate(-45deg);
      transform-origin: top left;
      box-shadow: 0 20px 45px rgba(0,0,0,0.9), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -6px 12px rgba(0,0,0,0.95);
      z-index: 5;
    ">
      <!-- Antique Turned Rings on Handle -->
      <div style="position: absolute; top: 40px; left: -2px; right: -2px; height: 8px; background: linear-gradient(90deg, #5c3e10, #e8b958, #5c3e10); border-radius: 4px;"></div>
      <div style="position: absolute; top: 90px; left: -2px; right: -2px; height: 8px; background: linear-gradient(90deg, #5c3e10, #e8b958, #5c3e10); border-radius: 4px;"></div>
      <!-- Brass End Cap on Handle Tip -->
      <div style="
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 32px;
        background: linear-gradient(90deg, #6b4310 0%, #f7cf74 45%, #fff1b0 60%, #875514 100%);
        border-radius: 0 0 16px 16px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.6);
      "></div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(html);
  const el = await page.$('#lensContainer');
  const buf = await el.screenshot({ omitBackground: true });
  fs.writeFileSync('workspace/src/conspiracy-crime-board/assets/vintage_magnifying_glass.png', buf);
  console.log('SUCCESS: Generated vintage magnifying glass transparent PNG! Size:', buf.length);
  await browser.close();
})();

