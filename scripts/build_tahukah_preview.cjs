const fs = require('fs');

const bgPath = 'C:/Users/AMD/.gemini/antigravity/brain/2d956349-a99c-4663-aede-6aa32c2fdf19/background_torn_paper.jpg';
const bgBase64 = 'data:image/jpeg;base64,' + fs.readFileSync(bgPath).toString('base64');

const personPath = 'workspace/src/conspiracy-crime-board/assets/person_photo.jpg';
const personBase64 = 'data:image/jpeg;base64,' + fs.readFileSync(personPath).toString('base64');

const glassPath = 'workspace/src/conspiracy-crime-board/assets/vintage_magnifying_glass.png';
const glassBase64 = 'data:image/png;base64,' + fs.readFileSync(glassPath).toString('base64');

const html = `<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Scene 1: Tahukah Kamu? — Wajah Muka Blur & Kaca Pembesar Vintage PNG</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Caveat:wght@600;700&family=Courier+Prime:wght@400;700;900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet" />

  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #070709;
      color: #F4F1EA;
      user-select: none;
    }
    .font-anton { font-family: 'Anton', sans-serif; }
    .font-caveat { font-family: 'Caveat', cursive; }
    .font-mono { font-family: 'Courier Prime', monospace; }

    /* 9:16 Vertical Viewport Container */
    .viewport-box {
      width: 390px;
      height: 690px;
      position: relative;
      overflow: hidden;
      border-radius: 20px;
      box-shadow: 0 35px 90px -15px rgba(0,0,0,0.98), 0 0 0 1px rgba(244,241,234,0.18);
      background-color: #1a1612;
    }
  </style>
</head>
<body class="bg-[#070709] text-[#F4F1EA] min-h-screen p-4 flex flex-col items-center justify-center">

  <!-- Top Header Bar -->
  <header class="w-full max-w-5xl flex flex-wrap items-center justify-between mb-4 pb-3 border-b border-stone-800 gap-3">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-amber-600 flex flex-col items-center justify-center font-mono font-bold text-white shadow-lg text-[10px] leading-tight">
        <span>SCENE</span>
        <span class="text-[8px] opacity-80">01</span>
      </div>
      <div>
        <h1 class="text-sm sm:text-base font-bold tracking-wide flex items-center gap-2">
          Scene 1: Hook "Tahukah Kamu?" (Tanpa Tangan + Foto Orang Asli)
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
            Foto Orang (Muka Blur ?) • Kaca Pembesar Vintage PNG
          </span>
        </h1>
        <p class="text-xs text-stone-400 font-mono">
          Kaca pembesar vintage kuningan & kayu bergerak dinamis memindai wajah foto orang
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button id="btnSpeedToggle" class="px-3 py-1.5 rounded-lg text-xs font-mono bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 transition">
        Speed: <span id="speedLabel">1.0x</span>
      </button>
    </div>
  </header>

  <!-- Main Simulator Layout: Left Viewport (9:16) + Right Controls -->
  <main class="w-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-8">

    <!-- LEFT: 9:16 VERTICAL STAGE -->
    <div class="relative flex flex-col items-center">
      <div id="viewport" class="viewport-box">
        
        <!-- ===================================================================
             LAYER 1: PERMANENT BACKGROUND EMBEDDED DIRECTLY
             =================================================================== -->
        <div class="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#181410]">
          <img
            src="__BG_IMAGE__"
            class="w-full h-full object-cover"
            style="filter: blur(2px) brightness(0.82) contrast(1.06); transform: scale(1.02);"
            alt="Permanent Archival Background"
          />

          <!-- Warm Lighting Accent -->
          <div class="absolute -top-16 -left-16 w-[420px] h-[420px] pointer-events-none" style="
            background: radial-gradient(circle at 35% 35%, rgba(255, 230, 160, 0.28) 0%, rgba(212, 175, 55, 0.12) 42%, transparent 72%);
            mix-blend-mode: screen;
            z-index: 1;
          "></div>

          <!-- Vignette Framing -->
          <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(10, 8, 7, 0.52) 100%); z-index: 2;"></div>
        </div>

        <!-- ===================================================================
             LAYER 2: HEADER "TAHUKAH KAMU?" + TANDA TANYA
             =================================================================== -->
        <div id="headerSection" class="absolute top-5 inset-x-4 flex flex-col items-center pointer-events-none" style="z-index: 30;">
          <div class="px-3 py-0.5 rounded border border-[#1c1815] shadow-lg rotate-[-1.5deg]" style="
            background: repeating-linear-gradient(45deg, #f59e0b, #f59e0b 8px, #d97706 8px, #d97706 16px);
          ">
            <span class="font-mono font-black text-[9px] text-[#181410] tracking-widest uppercase">★ INVESTIGATION DOSSIER ★</span>
          </div>

          <h1 class="font-anton text-4xl text-[#faf8f5] uppercase tracking-wider leading-none mt-1.5 rotate-[-0.8deg] text-center" style="
            text-shadow: 0 0 16px rgba(0,0,0,0.9), 0 3px 6px rgba(0,0,0,0.85), 2px 2px 0 #b91c1c;
          ">
            TAHUKAH KAMU?
          </h1>

          <div class="font-caveat text-sm text-red-500 font-bold -mt-0.5 tracking-wider rotate-[1deg]" style="text-shadow: 0 0 8px rgba(239,68,68,0.4);">
            Kasus Misterius // Siapa Sosok Ini?
          </div>
        </div>

        <!-- ===================================================================
             LAYER 3: POLAROID CARD DENGAN FOTO ORANG ASLI (MUKA BLUR)
             =================================================================== -->
        <div id="cardMystery" class="absolute pointer-events-none p-2 shadow-2xl rounded-md" style="
          top: 135px;
          left: 55px;
          width: 280px;
          background-color: #f5f0e4;
          border: 1px solid #d4cbb3;
          box-shadow: 0 30px 70px rgba(0,0,0,0.95), 0 10px 25px rgba(0,0,0,0.7);
          z-index: 20;
        ">
          <!-- TOP SECRET Red Stamp -->
          <div class="absolute top-3 right-3 border-2 border-red-700 bg-amber-100/90 rounded px-1.5 py-0.5 text-red-700 font-mono font-black text-[9px] tracking-wider uppercase rotate-[14deg] shadow-sm z-20">
            TOP SECRET
          </div>

          <!-- Hand-written Note -->
          <div class="font-caveat text-[11px] font-bold text-stone-900 leading-none mb-1.5 rotate-[-1.5deg]">
            Subjek Investigasi #01 // Identitas Dirahasiakan
          </div>

          <!-- Blurred Face Photo Box with Real Person Photo -->
          <div class="relative w-full h-64 bg-[#161311] rounded overflow-hidden flex items-center justify-center shadow-inner">
            <!-- REAL PERSON PHOTO -->
            <img
              src="__PERSON_IMAGE__"
              class="w-full h-full object-cover"
              style="filter: grayscale(85%) contrast(1.25) brightness(0.9);"
              alt="Person Photo"
            />

            <!-- HEAVY CIRCULAR FACIAL BLUR SENSOR ON THE FACE -->
            <div class="absolute rounded-full pointer-events-none" style="
              top: 16%; left: 26%; width: 135px; height: 135px;
              backdrop-filter: blur(16px) brightness(0.75);
              -webkit-backdrop-filter: blur(16px) brightness(0.75);
              background: radial-gradient(circle at center, rgba(140, 110, 80, 0.65) 0%, rgba(30, 25, 20, 0.85) 75%, transparent 100%);
              box-shadow: 0 0 25px rgba(0,0,0,0.85);
              z-index: 5;
            "></div>

            <!-- Big Glowing "?" on the Face -->
            <div id="questionMark" class="absolute font-caveat text-7xl font-black text-amber-400 rotate-[-4deg] pointer-events-none" style="
              top: 20%;
              text-shadow: 0 0 20px rgba(251, 191, 36, 0.85), 0 4px 12px rgba(0,0,0,0.95);
              z-index: 10;
            ">
              ?
            </div>

            <!-- Vignette Overlay -->
            <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(circle, transparent 40%, rgba(10,8,7,0.8) 100%); z-index: 6;"></div>

            <!-- HUD Sensor Coordinates -->
            <div class="absolute top-1.5 left-2 font-mono text-[7px] text-amber-400/90 leading-tight z-10">
              <div>[ TARGET: UNKNOWN PERSON ]</div>
              <div class="text-[6px] text-white/50">FACIAL BLUR MASK: ACTIVE (100%)</div>
            </div>
          </div>

          <!-- Bottom Dossier Caption -->
          <div class="mt-1.5 font-mono text-[7px] font-bold text-[#1c1814] uppercase flex justify-between">
            <span>KASUS #01 // MISTERI TAK TERPECAHKAN</span>
            <span class="text-stone-600">DOSSIER X</span>
          </div>
        </div>

        <!-- ===================================================================
             LAYER 4: KACA PEMBESAR VINTAGE PNG (TANPA TANGAN, MEMINDAI WAJAH!)
             =================================================================== -->
        <div id="magnifierWrapper" class="absolute pointer-events-none" style="
          top: 195px;
          left: 145px;
          width: 220px;
          height: 220px;
          z-index: 60;
          filter: drop-shadow(0 25px 35px rgba(0,0,0,0.95));
        ">
          <!-- Real Vintage Magnifying Glass Transparent PNG -->
          <img
            src="__GLASS_IMAGE__"
            class="w-full h-full object-contain"
            alt="Vintage Magnifying Glass"
          />

          <!-- Central Scanning Reticle Inside Glass -->
          <div class="absolute rounded-full border border-dashed border-amber-400/50 flex items-center justify-center bg-amber-300/10 pointer-events-none" style="
            top: 22%; left: 22%; width: 68px; height: 68px;
          ">
            <span id="lensQuestion" class="font-caveat text-3xl font-black text-amber-400 drop-shadow">?</span>
          </div>
        </div>

        <!-- ===================================================================
             LAYER 5: BOTTOM STENCIL TITLE ("TARGET MISTERIUS")
             =================================================================== -->
        <div id="elBottomSection" class="absolute bottom-4 inset-x-4 pointer-events-none p-3.5 rounded-md rotate-[-0.8deg]" style="
          z-index: 45;
          background-color: rgba(238, 230, 214, 0.94);
          border: 1px solid rgba(168, 152, 128, 0.9);
          box-shadow: 0 12px 30px rgba(0,0,0,0.85), inset 0 0 15px rgba(120,90,50,0.18);
        ">
          <!-- Metal Paper Clip at Left Corner -->
          <div class="absolute -top-3 left-3 w-3 h-8 border-2 border-[#8c7b64] rounded-full rotate-[-18deg] shadow-lg"></div>

          <!-- Red Handwritten Marker Date: "2024 // 00:00" -->
          <div class="font-caveat text-xl text-red-600 font-bold ml-6 -mb-1 rotate-[-3deg]" style="text-shadow: 0 0 8px rgba(220,20,20,0.35);">
            <span class="border-2 border-red-600 rounded-full px-2 py-0.5">2024</span>
            <span class="ml-2 text-lg">00:00</span>
          </div>

          <!-- Heavy Spray-Stenciled Headline: "TARGET MISTERIUS" -->
          <div class="font-anton text-4xl text-[#14110e] uppercase tracking-wider leading-none mt-1" style="
            text-shadow: 0 0 2px #000, 0 0 10px rgba(0,0,0,0.65), 1px 1px 0 rgba(255,255,255,0.25);
            filter: contrast(1.4) drop-shadow(0 4px 10px rgba(0,0,0,0.85));
          ">
            TARGET MISTERIUS
          </div>

          <!-- Red Cursive Note underneath -->
          <div class="font-caveat text-base text-red-800 font-bold ml-8 -mt-0.5 tracking-wider">
            Catatan Investigasi // Berkas Rahasia #01
          </div>
        </div>

        <!-- Timecode HUD (Top-Right) -->
        <div class="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/75 border border-white/10 text-[9px] font-mono text-amber-300 z-50 pointer-events-none">
          <span id="hudTimecode">TC 00:00:00</span>
        </div>
      </div>

      <!-- Playback Controls -->
      <div class="w-[390px] mt-3 flex items-center justify-between gap-2">
        <button id="btnPlayPause" class="flex-1 py-2 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition shadow-lg text-white">
          <span id="playIcon">▶</span>
          <span id="playLabel">PUTAR ANIMASI KACA PEMBESAR</span>
        </button>
        <button id="btnReset" class="py-2 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-xs transition">
          ↺ Reset
        </button>
      </div>
    </div>

    <!-- RIGHT: DESCRIPTION & CONTROLS -->
    <div class="flex-1 flex flex-col gap-3 max-w-lg w-full bg-stone-900/90 border border-stone-800 rounded-xl p-4 shadow-2xl text-xs">
      
      <!-- Frame Slider -->
      <div>
        <div class="flex justify-between items-center mb-1 font-mono text-xs">
          <span class="text-stone-400">FRAME SCRUBBER:</span>
          <span class="text-amber-300 font-bold">
            <span id="displayFrame">0</span> / 180 frames (<span id="displayTime">00:00</span>)
          </span>
        </div>
        <input id="sliderFrame" type="range" min="0" max="180" value="0" class="w-full accent-amber-500 cursor-pointer h-2 bg-stone-800 rounded-lg" />
      </div>

      <!-- Parity Checklist -->
      <div class="border-t border-stone-800 pt-2.5">
        <div class="font-bold text-stone-200 mb-2 font-mono flex items-center justify-between">
          <span>PEMBARUAN PERMINTAAN USER:</span>
          <span class="text-emerald-400 font-bold text-[10px]">VERIFIED</span>
        </div>

        <div class="space-y-2 font-mono text-[11px]">
          <div class="p-2 rounded bg-stone-950 border border-stone-800 flex items-start gap-2">
            <span class="text-emerald-400 font-bold">✓</span>
            <div>
              <strong class="text-white">Tangan Dihilangkan:</strong>
              <div class="text-stone-400 text-[10px]">Hanya kaca pembesar vintage murni yang melayang dan memindai wajah.</div>
            </div>
          </div>

          <div class="p-2 rounded bg-stone-950 border border-stone-800 flex items-start gap-2">
            <span class="text-emerald-400 font-bold">✓</span>
            <div>
              <strong class="text-white">Foto Orang Asli (Wajah Blur):</strong>
              <div class="text-stone-400 text-[10px]">Menampilkan foto orang nyata di polaroid dengan sensor blur tebal dan tanda tanya '?' berdenyut.</div>
            </div>
          </div>

          <div class="p-2 rounded bg-stone-950 border border-stone-800 flex items-start gap-2">
            <span class="text-emerald-400 font-bold">✓</span>
            <div>
              <strong class="text-white">Kaca Pembesar Vintage PNG:</strong>
              <div class="text-stone-400 text-[10px]">Model kuningan antik dengan gagang kayu gelap (*dark walnut & turned rings*) berlatar transparan.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- File Source -->
      <div class="border-t border-stone-800 pt-2 text-[10px] text-stone-400">
        File Source: <code class="text-emerald-400">workspace/src/conspiracy-crime-board/scenes/Scene1TahukahKamu.tsx</code>
      </div>
    </div>
  </main>

  <script>
    function springSmooth(frame, at, damp = 14, stiff = 85, m = 0.9) {
      if (frame < at) return 0;
      const t = (frame - at) / 30;
      const omega0 = Math.sqrt(stiff / m);
      const zeta = damp / (2 * Math.sqrt(stiff * m));
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const decay = Math.exp(-zeta * omega0 * t);
      const res = 1 - decay * (Math.cos(omegaD * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(omegaD * t));
      return Math.max(0, Math.min(1.15, res));
    }

    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }

    const headerSection = document.getElementById('headerSection');
    const cardMystery = document.getElementById('cardMystery');
    const questionMark = document.getElementById('questionMark');
    const lensQuestion = document.getElementById('lensQuestion');
    const magnifierWrapper = document.getElementById('magnifierWrapper');
    const elBottomSection = document.getElementById('elBottomSection');
    const hudTimecode = document.getElementById('hudTimecode');
    const sliderFrame = document.getElementById('sliderFrame');
    const displayFrame = document.getElementById('displayFrame');
    const displayTime = document.getElementById('displayTime');

    function renderAtFrame(f) {
      displayFrame.textContent = f;
      sliderFrame.value = f;

      const totalSec = f / 30;
      const m = Math.floor(totalSec / 60);
      const s = Math.floor(totalSec % 60);
      const frames = f % 30;
      const mStr = m < 10 ? '0' + m : m;
      const sStr = s < 10 ? '0' + s : s;
      const fStr = frames < 10 ? '0' + frames : frames;
      const timeStr = mStr + ':' + sStr;
      displayTime.textContent = timeStr;
      hudTimecode.textContent = 'TC ' + timeStr + ':' + fStr;

      // 1. Header Entry
      const pHeader = springSmooth(f, 4, 14, 100, 0.8);
      headerSection.style.transform = 'translateY(' + lerp(-50, 0, pHeader) + 'px)';
      headerSection.style.opacity = f < 4 ? '0' : Math.min(1, (f - 4) / 4);

      // 2. Card Mystery Entry
      const pCard = springSmooth(f, 6, 14, 85, 0.9);
      cardMystery.style.opacity = f < 6 ? '0' : Math.min(1, (f - 6) / 4);
      cardMystery.style.transform = 'translateY(' + lerp(-90, 0, pCard) + 'px) scale(' + lerp(1.2, 1.0, pCard) + ') rotate(-2deg)';

      // Pulse question mark
      const qPulse = 1 + Math.sin(f * 0.12) * 0.08;
      questionMark.style.transform = 'scale(' + qPulse + ') rotate(-4deg)';
      lensQuestion.style.transform = 'rotate(' + (Math.sin(f * 0.1) * 6) + 'deg)';

      // 3. Vintage Magnifying Glass Scanning Animation (NO HAND)
      const pGlass = springSmooth(f, 16, 15, 60, 1.0);
      const baseGlassX = lerp(140, 0, pGlass);
      const baseGlassY = lerp(160, 0, pGlass);
      magnifierWrapper.style.opacity = f < 16 ? '0' : Math.min(1, (f - 16) / 5);

      // Smooth investigation scan around the face:
      const t = Math.max(0, (f - 24) / 30);
      const scanX = Math.sin(t * 1.7) * 38 + Math.sin(t * 3.2) * 12;
      const scanY = Math.cos(t * 1.3) * 30 + Math.sin(t * 2.6) * 10;
      const tilt = Math.sin(t * 1.7) * 8;

      magnifierWrapper.style.transform = 'translate(' + (baseGlassX + scanX) + 'px, ' + (baseGlassY + scanY) + 'px) rotate(' + tilt + 'deg)';

      // 4. Bottom Stencil Title
      if (f < 32) {
        elBottomSection.style.opacity = '0';
      } else {
        const pBot = springSmooth(f, 32, 14, 110, 0.8);
        elBottomSection.style.opacity = '1';
        elBottomSection.style.transform = 'translateY(' + lerp(40, 0, pBot) + 'px)';
      }
    }

    let currentFrame = 0;
    let isPlaying = false;
    let playbackSpeed = 1.0;
    let lastTimestamp = 0;
    let accumulatedTime = 0;

    function tick(timestamp) {
      if (!isPlaying) return;
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = (timestamp - lastTimestamp) * playbackSpeed;
      lastTimestamp = timestamp;

      accumulatedTime += delta;
      const frameDuration = 1000 / 30;

      while (accumulatedTime >= frameDuration) {
        currentFrame++;
        accumulatedTime -= frameDuration;
        if (currentFrame > 180) {
          currentFrame = 0;
        }
      }

      renderAtFrame(currentFrame);
      requestAnimationFrame(tick);
    }

    const btnPlayPause = document.getElementById('btnPlayPause');
    const playIcon = document.getElementById('playIcon');
    const playLabel = document.getElementById('playLabel');

    btnPlayPause.addEventListener('click', () => {
      isPlaying = !isPlaying;
      if (isPlaying) {
        playIcon.textContent = '⏸';
        playLabel.textContent = 'JEDA ANIMASI';
        btnPlayPause.classList.replace('bg-amber-600', 'bg-red-600');
        lastTimestamp = 0;
        requestAnimationFrame(tick);
      } else {
        playIcon.textContent = '▶';
        playLabel.textContent = 'PUTAR ANIMASI KACA PEMBESAR';
        btnPlayPause.classList.replace('bg-red-600', 'bg-amber-600');
      }
    });

    document.getElementById('btnReset').addEventListener('click', () => {
      isPlaying = false;
      playIcon.textContent = '▶';
      playLabel.textContent = 'PUTAR ANIMASI KACA PEMBESAR';
      btnPlayPause.classList.replace('bg-red-600', 'bg-amber-600');
      currentFrame = 0;
      renderAtFrame(0);
    });

    sliderFrame.addEventListener('input', (e) => {
      isPlaying = false;
      playIcon.textContent = '▶';
      playLabel.textContent = 'PUTAR ANIMASI KACA PEMBESAR';
      btnPlayPause.classList.replace('bg-red-600', 'bg-amber-600');
      currentFrame = parseInt(e.target.value, 10);
      renderAtFrame(currentFrame);
    });

    // Speed toggle
    const speeds = [1.0, 0.5, 1.5, 2.0];
    let speedIdx = 0;
    document.getElementById('btnSpeedToggle').addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      playbackSpeed = speeds[speedIdx];
      document.getElementById('speedLabel').textContent = playbackSpeed.toFixed(1) + 'x';
    });

    // Initial render
    window.renderAtFrame = renderAtFrame;
    renderAtFrame(0);
  </script>
</body>
</html>`;

const finalHtml = html
  .replace('__BG_IMAGE__', bgBase64)
  .replace('__PERSON_IMAGE__', personBase64)
  .replace('__GLASS_IMAGE__', glassBase64);

fs.writeFileSync('C:/Users/AMD/.gemini/antigravity/brain/2d956349-a99c-4663-aede-6aa32c2fdf19/tahukah_kamu_preview.html', finalHtml, 'utf8');
fs.writeFileSync('E:/JS/ArunakiNexus/apps/public/tahukah_kamu_preview.html', finalHtml, 'utf8');
console.log('BUILD SUCCESS: tahukah_kamu_preview.html updated with person photo & vintage glass png!');
