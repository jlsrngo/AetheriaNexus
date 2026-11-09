const fs = require('fs');

const bgPath = 'C:/Users/AMD/.gemini/antigravity/brain/2d956349-a99c-4663-aede-6aa32c2fdf19/background_torn_paper.jpg';
const base64Data = 'data:image/jpeg;base64,' + fs.readFileSync(bgPath).toString('base64');
console.log('Base64 length:', base64Data.length);

const html = `<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Conspiracy Crime Board — Template (YOUR TEXT)</title>
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
      <div class="w-10 h-10 rounded-lg bg-red-600 flex flex-col items-center justify-center font-mono font-bold text-white shadow-lg text-[10px] leading-tight">
        <span>BOARD</span>
        <span class="text-[8px] opacity-80">PRO</span>
      </div>
      <div>
        <h1 class="text-sm sm:text-base font-bold tracking-wide flex items-center gap-2">
          Conspiracy Board Template — Red Strings & Pushpins Active
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
            Red Thread Web (Z-60) • 3D Pushpins (Z-70) • Hero On Top
          </span>
        </h1>
        <p class="text-xs text-stone-400 font-mono">
          Benang Merah & Pushpin 3D Terhubung Jelas di Lapisan Teratas
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button id="btnAudioToggle" class="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 flex items-center gap-1.5 transition">
        <span id="audioIcon">🔊</span>
        <span id="audioLabel">SFX: ON</span>
      </button>
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
             LAYER 1: PERMANENT BACKGROUND EMBEDDED DIRECTLY (NEVER FAILS!)
             =================================================================== -->
        <div class="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#181410]">
          <img
            src="__BG_IMAGE__"
            class="w-full h-full object-cover"
            style="filter: blur(2px) brightness(0.82) contrast(1.06); transform: scale(1.02);"
            alt="Permanent Archival Background"
          />

          <!-- Soft Warm Lighting Accent from Top-Left -->
          <div class="absolute -top-16 -left-16 w-[420px] h-[420px] pointer-events-none" style="
            background: radial-gradient(circle at 35% 35%, rgba(255, 230, 160, 0.28) 0%, rgba(212, 175, 55, 0.12) 42%, transparent 72%);
            mix-blend-mode: screen;
            z-index: 1;
          "></div>

          <!-- Soft Vignette Framing -->
          <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(10, 8, 7, 0.52) 100%); z-index: 2;"></div>
        </div>

        <!-- ===================================================================
             LAYER 2: 7 POLAROID TEMPLATE SLOTS (CENTERED & HERO ON TOP!)
             =================================================================== -->
        <!-- Card 1: Top-Left (Slot 01) -->
        <div id="card1" class="absolute pointer-events-none p-1.5 shadow-xl" style="
          top: 45px;
          left: 20px;
          width: 120px;
          background-color: #f5f0e4;
          border: 1px solid #d4cbb3;
          box-shadow: 0 16px 35px rgba(0,0,0,0.85);
          z-index: 20;
        ">
          <div class="font-caveat text-[10px] font-bold text-stone-900 leading-none mb-1 rotate-[-2deg]">
            Tersangka 01 // Bukti A
          </div>
          <div class="w-full h-24 bg-[#1e1a17] border-2 border-dashed border-white/20 flex flex-col items-center justify-center p-1.5 relative">
            <svg class="w-5 h-5 text-white/50 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span class="font-mono text-[7.5px] font-black text-amber-200 uppercase">[ FOTO 01 ]</span>
            <span class="font-caveat text-[7.5px] text-white/50">Tempel Foto</span>
          </div>
          <div class="mt-1 font-mono text-[6px] font-bold text-[#1c1814] uppercase flex justify-between">
            <span>BUKTI #01</span>
            <span class="text-stone-500">BERKAS</span>
          </div>
        </div>

        <!-- Card 2: Top-Right (Slot 02) -->
        <div id="card2" class="absolute pointer-events-none p-1.5 shadow-xl" style="
          top: 40px;
          left: 250px;
          width: 120px;
          background-color: #f5f0e4;
          border: 1px solid #d4cbb3;
          box-shadow: 0 16px 35px rgba(0,0,0,0.85);
          z-index: 22;
        ">
          <div class="font-caveat text-[10px] font-bold text-stone-900 leading-none mb-1 rotate-[2deg]">
            Saksi Kunci // Arsip B
          </div>
          <div class="w-full h-24 bg-[#1e1a17] border-2 border-dashed border-white/20 flex flex-col items-center justify-center p-1.5 relative">
            <svg class="w-5 h-5 text-white/50 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span class="font-mono text-[7.5px] font-black text-amber-200 uppercase">[ FOTO 02 ]</span>
            <span class="font-caveat text-[7.5px] text-white/50">Tempel Foto</span>
          </div>
          <div class="mt-1 font-mono text-[6px] font-bold text-[#1c1814] uppercase flex justify-between">
            <span>SAKSI #02</span>
            <span class="text-stone-500">KODE</span>
          </div>
        </div>

        <!-- Card 3: Mid-Left (Slot 03) -->
        <div id="card3" class="absolute pointer-events-none p-1.5 shadow-xl" style="
          top: 185px;
          left: 14px;
          width: 120px;
          background-color: #f5f0e4;
          border: 1px solid #d4cbb3;
          box-shadow: 0 18px 40px rgba(0,0,0,0.85);
          z-index: 24;
        ">
          <div class="font-caveat text-[10px] font-bold text-stone-900 leading-none mb-1 rotate-[3deg]">
            Petunjuk 03 // Motif ?
          </div>
          <div class="w-full h-24 bg-[#1e1a17] border-2 border-dashed border-white/20 flex flex-col items-center justify-center p-1.5 relative">
            <svg class="w-5 h-5 text-white/50 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span class="font-mono text-[7.5px] font-black text-amber-200 uppercase">[ FOTO 03 ]</span>
            <span class="font-caveat text-[7.5px] text-white/50">Tempel Foto</span>
          </div>
          <div class="mt-1 font-mono text-[6px] font-bold text-[#1c1814] uppercase flex justify-between">
            <span>MOTIF #03</span>
            <span class="text-stone-500">CIPHER</span>
          </div>
        </div>

        <!-- Card 4: Mid-Right (Slot 04) -->
        <div id="card4" class="absolute pointer-events-none p-1.5 shadow-xl" style="
          top: 180px;
          left: 256px;
          width: 120px;
          background-color: #f5f0e4;
          border: 1px solid #d4cbb3;
          box-shadow: 0 18px 40px rgba(0,0,0,0.85);
          z-index: 23;
        ">
          <div class="font-caveat text-[10px] font-bold text-stone-900 leading-none mb-1 rotate-[-3deg]">
            Koneksi Luar // Telegram
          </div>
          <div class="w-full h-24 bg-[#1e1a17] border-2 border-dashed border-white/20 flex flex-col items-center justify-center p-1.5 relative">
            <svg class="w-5 h-5 text-white/50 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span class="font-mono text-[7.5px] font-black text-amber-200 uppercase">[ FOTO 04 ]</span>
            <span class="font-caveat text-[7.5px] text-white/50">Tempel Foto</span>
          </div>
          <div class="mt-1 font-mono text-[6px] font-bold text-[#1c1814] uppercase flex justify-between">
            <span>KONTAK #04</span>
            <span class="text-stone-500">ULTRA</span>
          </div>
        </div>

        <!-- Card 5: Lower-Left / Bottom (Slot 05) -->
        <div id="card5" class="absolute pointer-events-none p-1.5 shadow-xl" style="
          top: 325px;
          left: 30px;
          width: 120px;
          background-color: #f5f0e4;
          border: 1px solid #d4cbb3;
          box-shadow: 0 20px 45px rgba(0,0,0,0.85);
          z-index: 26;
        ">
          <div class="font-caveat text-[10px] font-bold text-stone-900 leading-none mb-1 rotate-[2deg]">
            Barang Bukti #05
          </div>
          <div class="w-full h-24 bg-[#1e1a17] border-2 border-dashed border-white/20 flex flex-col items-center justify-center p-1.5 relative">
            <svg class="w-5 h-5 text-white/50 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span class="font-mono text-[7.5px] font-black text-amber-200 uppercase">[ FOTO 05 ]</span>
            <span class="font-caveat text-[7.5px] text-white/50">Tempel Foto</span>
          </div>
          <div class="mt-1 font-mono text-[6px] font-bold text-[#1c1814] uppercase flex justify-between">
            <span>BARANG BUKTI</span>
            <span class="text-stone-500">ROTOR</span>
          </div>
        </div>

        <!-- Card 6: Lower-Right / Bottom (Slot 06) -->
        <div id="card6" class="absolute pointer-events-none p-1.5 shadow-xl" style="
          top: 320px;
          left: 240px;
          width: 120px;
          background-color: #f5f0e4;
          border: 1px solid #d4cbb3;
          box-shadow: 0 20px 45px rgba(0,0,0,0.85);
          z-index: 25;
        ">
          <div class="font-caveat text-[10px] font-bold text-stone-900 leading-none mb-1 rotate-[-2deg]">
            Laporan Akhir // Dokumen
          </div>
          <div class="w-full h-24 bg-[#1e1a17] border-2 border-dashed border-white/20 flex flex-col items-center justify-center p-1.5 relative">
            <svg class="w-5 h-5 text-white/50 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span class="font-mono text-[7.5px] font-black text-amber-200 uppercase">[ FOTO 06 ]</span>
            <span class="font-caveat text-[7.5px] text-white/50">Tempel Foto</span>
          </div>
          <div class="mt-1 font-mono text-[6px] font-bold text-[#1c1814] uppercase flex justify-between">
            <span>DOSSIER #06</span>
            <span class="text-stone-500">ARSIP</span>
          </div>
        </div>

        <!-- Card 7: CENTER HERO (EXACT CENTER & SITS PROUDLY ON TOP OF ALL CARDS!) -->
        <div id="cardHero" class="absolute pointer-events-none p-2 shadow-2xl" style="
          top: 175px;
          left: 115px;
          width: 160px;
          background-color: #f5f0e4;
          border: 1px solid #d4cbb3;
          box-shadow: 0 35px 80px rgba(0,0,0,0.95), 0 10px 25px rgba(0,0,0,0.7);
          z-index: 45;
        ">
          <div class="font-caveat text-xs font-bold text-stone-900 leading-none mb-1 rotate-[-2deg]">
            TARGET UTAMA // CONFIDENTIAL
          </div>
          <div class="w-full h-32 bg-[#181412] border-2 border-dashed border-amber-400/50 flex flex-col items-center justify-center p-2 relative">
            <svg class="w-8 h-8 text-amber-400/80 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span class="font-mono text-[9px] font-black text-amber-300 uppercase tracking-wider">★ FOTO UTAMA ★</span>
            <span class="font-caveat text-[9px] text-amber-200/70 mt-0.5">Tempel Foto Hero di Sini</span>
          </div>
          <div class="mt-1.5 font-mono text-[7px] font-black text-[#1c1814] uppercase flex justify-between">
            <span>TARGET INVESTIGASI</span>
            <span class="text-amber-700">HERO</span>
          </div>
        </div>

        <!-- ===================================================================
             LAYER 3: RED CONSPIRACY STRINGS (SVG Dynamic Canvas - Z-INDEX 60!)
             Must be above all cards (z-60 > z-45) so the web is 100% VISIBLE!
             =================================================================== -->
        <svg id="svgThreads" class="absolute inset-0 w-full h-full overflow-visible pointer-events-none" style="z-index: 60;">
          <line id="th1" stroke="#e53935" stroke-width="3.2" stroke-linecap="round" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))" />
          <line id="th2" stroke="#e53935" stroke-width="3.2" stroke-linecap="round" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))" />
          <line id="th3" stroke="#e53935" stroke-width="3.2" stroke-linecap="round" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))" />
          <line id="th4" stroke="#e53935" stroke-width="3.2" stroke-linecap="round" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))" />
          <line id="th5" stroke="#e53935" stroke-width="3.2" stroke-linecap="round" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))" />
          <line id="th6" stroke="#e53935" stroke-width="3.2" stroke-linecap="round" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))" />
          <line id="th7" stroke="#e53935" stroke-width="3.2" stroke-linecap="round" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))" />
          <line id="th8" stroke="#e53935" stroke-width="3.2" stroke-linecap="round" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))" />
          <line id="th9" stroke="#e53935" stroke-width="3.2" stroke-linecap="round" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))" />
          <line id="th10" stroke="#e53935" stroke-width="3.2" stroke-linecap="round" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))" />
          <line id="th11" stroke="#e53935" stroke-width="3.2" stroke-linecap="round" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))" />

          <!-- Hand-drawn Pencil Loop around Pin 2 -->
          <ellipse id="pencilLoop" cx="335" cy="75" rx="16" ry="12" fill="none" stroke="#1c1814" stroke-width="1.8" stroke-dasharray="3 2" transform="rotate(-15 335 75)" style="opacity: 0;" />

          <!-- Big Handwritten "?" next to Pin 3 -->
          <text id="pencilQuestion" x="65" y="225" font-family="'Caveat', cursive, sans-serif" font-size="28" font-weight="bold" fill="#181410" style="opacity: 0;">?</text>
        </svg>

        <!-- ===================================================================
             LAYER 4: 3D RED PUSHPINS (Z-INDEX 70 — SITS FIRMLY ON TOP OF EVERYTHING!)
             =================================================================== -->
        <div id="pin1" class="absolute w-5 h-5 rounded-full pointer-events-none" style="z-index: 70; background: radial-gradient(circle at 35% 35%, #ff5252 0%, #b71c1c 70%, #5f0909 100%); box-shadow: 0 4px 10px rgba(0,0,0,0.95), inset 0 1px 3px rgba(255,255,255,0.7);"></div>
        <div id="pin2" class="absolute w-5 h-5 rounded-full pointer-events-none" style="z-index: 70; background: radial-gradient(circle at 35% 35%, #ff5252 0%, #b71c1c 70%, #5f0909 100%); box-shadow: 0 4px 10px rgba(0,0,0,0.95), inset 0 1px 3px rgba(255,255,255,0.7);"></div>
        <div id="pin3" class="absolute w-5 h-5 rounded-full pointer-events-none" style="z-index: 70; background: radial-gradient(circle at 35% 35%, #ff5252 0%, #b71c1c 70%, #5f0909 100%); box-shadow: 0 4px 10px rgba(0,0,0,0.95), inset 0 1px 3px rgba(255,255,255,0.7);"></div>
        <div id="pin4" class="absolute w-5 h-5 rounded-full pointer-events-none" style="z-index: 70; background: radial-gradient(circle at 35% 35%, #ff5252 0%, #b71c1c 70%, #5f0909 100%); box-shadow: 0 4px 10px rgba(0,0,0,0.95), inset 0 1px 3px rgba(255,255,255,0.7);"></div>
        <div id="pin5" class="absolute w-5 h-5 rounded-full pointer-events-none" style="z-index: 70; background: radial-gradient(circle at 35% 35%, #ff5252 0%, #b71c1c 70%, #5f0909 100%); box-shadow: 0 4px 10px rgba(0,0,0,0.95), inset 0 1px 3px rgba(255,255,255,0.7);"></div>
        <div id="pin6" class="absolute w-5 h-5 rounded-full pointer-events-none" style="z-index: 70; background: radial-gradient(circle at 35% 35%, #ff5252 0%, #b71c1c 70%, #5f0909 100%); box-shadow: 0 4px 10px rgba(0,0,0,0.95), inset 0 1px 3px rgba(255,255,255,0.7);"></div>
        <div id="pinHero" class="absolute w-5 h-5 rounded-full pointer-events-none" style="z-index: 70; background: radial-gradient(circle at 35% 35%, #ff5252 0%, #b71c1c 70%, #5f0909 100%); box-shadow: 0 4px 10px rgba(0,0,0,0.95), inset 0 1px 3px rgba(255,255,255,0.7);"></div>

        <!-- ===================================================================
             LAYER 5: BOTTOM STENCIL TITLE ("YOUR TEXT")
             =================================================================== -->
        <div id="elBottomSection" class="absolute bottom-4 inset-x-4 pointer-events-none p-3.5 rounded-md rotate-[-0.8deg]" style="
          z-index: 46;
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

          <!-- Heavy Spray-Stenciled Headline: "YOUR TEXT" -->
          <div class="font-anton text-5xl text-[#14110e] uppercase tracking-wider leading-none mt-1" style="
            text-shadow: 0 0 2px #000, 0 0 10px rgba(0,0,0,0.65), 1px 1px 0 rgba(255,255,255,0.25);
            filter: contrast(1.4) drop-shadow(0 4px 10px rgba(0,0,0,0.85));
          ">
            YOUR TEXT
          </div>

          <!-- Red Cursive Note underneath -->
          <div class="font-caveat text-base text-red-800 font-bold ml-8 -mt-0.5 tracking-wider">
            Subtitle Catatan Penyelidikan // Case File #01
          </div>
        </div>

        <!-- Timecode HUD (Top-Right) -->
        <div class="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/75 border border-white/10 text-[9px] font-mono text-amber-300 z-50 pointer-events-none">
          <span id="hudTimecode">TC 00:00:00</span>
        </div>
      </div>

      <!-- Playback Controls -->
      <div class="w-[390px] mt-3 flex items-center justify-between gap-2">
        <button id="btnPlayPause" class="flex-1 py-2 px-4 rounded-lg bg-red-600 hover:bg-red-500 font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition shadow-lg">
          <span id="playIcon">▶</span>
          <span id="playLabel">PUTAR ANIMASI JATUH SMOOTH</span>
        </button>
        <button id="btnReset" class="py-2 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-xs transition">
          ↺ Reset
        </button>
      </div>
    </div>

    <!-- RIGHT: COMPARISON & CUE SHEET -->
    <div class="flex-1 flex flex-col gap-3 max-w-lg w-full bg-stone-900/90 border border-stone-800 rounded-xl p-4 shadow-2xl text-xs">
      
      <!-- Frame Slider -->
      <div>
        <div class="flex justify-between items-center mb-1 font-mono text-xs">
          <span class="text-stone-400">FRAME SCRUBBER:</span>
          <span class="text-amber-300 font-bold">
            <span id="displayFrame">0</span> / 450 frames (<span id="displayTime">00:00</span>)
          </span>
        </div>
        <input id="sliderFrame" type="range" min="0" max="450" value="0" class="w-full accent-red-500 cursor-pointer h-2 bg-stone-800 rounded-lg" />
      </div>

      <!-- Reference Parity Checklist -->
      <div class="border-t border-stone-800 pt-2.5">
        <div class="font-bold text-stone-200 mb-2 font-mono flex items-center justify-between">
          <span>STATUS BENANG & PIN:</span>
          <span class="text-emerald-400 font-bold text-[10px]">VERIFIED VISIBLE</span>
        </div>

        <div class="space-y-2 font-mono text-[11px]">
          <div class="p-2 rounded bg-stone-950 border border-stone-800 flex items-start gap-2">
            <span class="text-red-400 font-bold">📍</span>
            <div>
              <strong class="text-white">Pushpin Merah 3D di Atas Kartu (Z-70):</strong>
              <div class="text-stone-400 text-[10px]">7 pin merah menancap langsung di atas foto dengan bayangan dan highlight, berada di lapisan teratas sehingga tidak tertutup.</div>
            </div>
          </div>

          <div class="p-2 rounded bg-stone-950 border border-stone-800 flex items-start gap-2">
            <span class="text-red-400 font-bold">🕸️</span>
            <div>
              <strong class="text-white">Jaring Benang Merah Terhubung Penuh (Z-60):</strong>
              <div class="text-stone-400 text-[10px]">11 tali merah menghubungkan seluruh pin luar membentuk segilima konspirasi dan terhubung menyilang ke pin FOTO UTAMA di tengah.</div>
            </div>
          </div>

          <div class="p-2 rounded bg-stone-950 border border-stone-800 flex items-start gap-2">
            <span class="text-emerald-400 font-bold">★</span>
            <div>
              <strong class="text-white">FOTO UTAMA Jatuh Terakhir:</strong>
              <div class="text-stone-400 text-[10px]">Kartu Hero di tengah jatuh paling terakhir (frame 60) dan berada di atas kartu-kartu lainnya (Z-45).</div>
            </div>
          </div>
        </div>
      </div>

      <!-- File Source -->
      <div class="border-t border-stone-800 pt-2 text-[10px] text-stone-400">
        File Source: <code class="text-emerald-400">workspace/src/archival-doc/components/ConspiracyPinboard.tsx</code>
      </div>
    </div>
  </main>

  <script>
    // =========================================================================
    // SPRING PHYSICS SIMULATOR (SMOOTH INWARD DROP)
    // =========================================================================
    function springSmooth(frame, at) {
      if (frame < at) return 0;
      const t = (frame - at) / 30;
      const damping = 15;
      const stiffness = 80;
      const mass = 0.95;
      const omega0 = Math.sqrt(stiffness / mass);
      const zeta = damping / (2 * Math.sqrt(stiffness * mass));
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const decay = Math.exp(-zeta * omega0 * t);
      const res = 1 - decay * (Math.cos(omegaD * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(omegaD * t));
      return Math.max(0, Math.min(1.15, res));
    }

    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }

    // Coordinates of pins in 390x690 viewport (Exact Pin Placement on Each Card!)
    const PINS = [
      { id: 'pin1', x: 55,  y: 80,  frame: 18 }, // Card 1 (Slot 01, Top-Left)
      { id: 'pin2', x: 335, y: 75,  frame: 26 }, // Card 2 (Slot 02, Top-Right)
      { id: 'pin3', x: 45,  y: 225, frame: 34 }, // Card 3 (Slot 03, Mid-Left)
      { id: 'pin4', x: 345, y: 220, frame: 42 }, // Card 4 (Slot 04, Mid-Right)
      { id: 'pin5', x: 65,  y: 365, frame: 50 }, // Card 5 (Slot 05, Bottom-Left)
      { id: 'pin6', x: 325, y: 360, frame: 58 }, // Card 6 (Slot 06, Bottom-Right)
      { id: 'pinHero', x: 235, y: 315, frame: 68 }, // Card Hero (Center Hero)
    ];

    // =========================================================================
    // PROCEDURAL AUDIO SYNTHESIZER
    // =========================================================================
    let audioCtx = null;
    let sfxEnabled = true;
    const playedCues = new Set();

    function initAudio() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function playSfx(type) {
      if (!sfxEnabled || !audioCtx) return;
      const now = audioCtx.currentTime;

      if (type === 'whoosh') {
        const bufferSize = audioCtx.sampleRate * 0.2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.2;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(220, now);
        filter.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.08);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start(now);
      } else if (type === 'pop') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.07);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'impact') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    }

    // =========================================================================
    // RENDER AT FRAME
    // =========================================================================
    const viewport = document.getElementById('viewport');
    const card1 = document.getElementById('card1');
    const card2 = document.getElementById('card2');
    const card3 = document.getElementById('card3');
    const card4 = document.getElementById('card4');
    const card5 = document.getElementById('card5');
    const card6 = document.getElementById('card6');
    const cardHero = document.getElementById('cardHero');
    const elBottomSection = document.getElementById('elBottomSection');
    const hudTimecode = document.getElementById('hudTimecode');
    const sliderFrame = document.getElementById('sliderFrame');
    const displayFrame = document.getElementById('displayFrame');
    const displayTime = document.getElementById('displayTime');

    // Thread elements
    const th1 = document.getElementById('th1');
    const th2 = document.getElementById('th2');
    const th3 = document.getElementById('th3');
    const th4 = document.getElementById('th4');
    const th5 = document.getElementById('th5');
    const th6 = document.getElementById('th6');
    const th7 = document.getElementById('th7');
    const th8 = document.getElementById('th8');
    const th9 = document.getElementById('th9');
    const th10 = document.getElementById('th10');
    const th11 = document.getElementById('th11');
    const pencilLoop = document.getElementById('pencilLoop');
    const pencilQuestion = document.getElementById('pencilQuestion');

    function updateThread(line, pA, pB, startFrame, f) {
      if (f < startFrame) {
        line.style.display = 'none';
        return;
      }
      line.style.display = 'block';
      const prog = Math.min(1, (f - startFrame) / 8);
      line.setAttribute('x1', pA.x);
      line.setAttribute('y1', pA.y);
      line.setAttribute('x2', pA.x + (pB.x - pA.x) * prog);
      line.setAttribute('y2', pA.y + (pB.y - pA.y) * prog);
    }

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

      // 1. Card 1 (Frame 10-26, Top-Left)
      const p1 = springSmooth(f, 10);
      card1.style.opacity = f < 10 ? '0' : Math.min(1, (f - 10) / 4);
      card1.style.transform = 'translateY(' + lerp(-70, 0, p1) + 'px) rotate(' + lerp(-16, -6, p1) + 'deg) scale(' + lerp(1.28, 1.0, p1) + ')';

      // 2. Card 2 (Frame 18-34, Top-Right)
      const p2 = springSmooth(f, 18);
      card2.style.opacity = f < 18 ? '0' : Math.min(1, (f - 18) / 4);
      card2.style.transform = 'translateY(' + lerp(-70, 0, p2) + 'px) rotate(' + lerp(16, 6, p2) + 'deg) scale(' + lerp(1.28, 1.0, p2) + ')';

      // 3. Card 3 (Frame 26-42, Mid-Left)
      const p3 = springSmooth(f, 26);
      card3.style.opacity = f < 26 ? '0' : Math.min(1, (f - 26) / 4);
      card3.style.transform = 'translateY(' + lerp(-70, 0, p3) + 'px) rotate(' + lerp(-18, -8, p3) + 'deg) scale(' + lerp(1.28, 1.0, p3) + ')';

      // 4. Card 4 (Frame 34-50, Mid-Right)
      const p4 = springSmooth(f, 34);
      card4.style.opacity = f < 34 ? '0' : Math.min(1, (f - 34) / 4);
      card4.style.transform = 'translateY(' + lerp(-70, 0, p4) + 'px) rotate(' + lerp(18, 8, p4) + 'deg) scale(' + lerp(1.28, 1.0, p4) + ')';

      // 5. Card 5 (Frame 42-58, Lower-Left)
      const p5 = springSmooth(f, 42);
      card5.style.opacity = f < 42 ? '0' : Math.min(1, (f - 42) / 4);
      card5.style.transform = 'translateY(' + lerp(-70, 0, p5) + 'px) rotate(' + lerp(12, 4, p5) + 'deg) scale(' + lerp(1.28, 1.0, p5) + ')';

      // 6. Card 6 (Frame 50-66, Lower-Right)
      const p6 = springSmooth(f, 50);
      card6.style.opacity = f < 50 ? '0' : Math.min(1, (f - 50) / 4);
      card6.style.transform = 'translateY(' + lerp(-70, 0, p6) + 'px) rotate(' + lerp(-14, -4, p6) + 'deg) scale(' + lerp(1.28, 1.0, p6) + ')';

      // 7. CENTER HERO CARD (Frame 60-76, DROPS LAST & SITS ON TOP!)
      const pHero = springSmooth(f, 60);
      cardHero.style.opacity = f < 60 ? '0' : Math.min(1, (f - 60) / 4);
      cardHero.style.transform = 'translateY(' + lerp(-80, 0, pHero) + 'px) rotate(' + lerp(-12, -2, pHero) + 'deg) scale(' + lerp(1.32, 1.0, pHero) + ')';

      // Pins positioning & animation (Z-INDEX 70 — CLEARLY VISIBLE ON TOP!)
      PINS.forEach(p => {
        const el = document.getElementById(p.id);
        el.style.left = (p.x - 10) + 'px';
        el.style.top = (p.y - 10) + 'px';
        if (f < p.frame) {
          el.style.display = 'none';
        } else {
          el.style.display = 'block';
          const spr = springSmooth(f, p.frame);
          el.style.transform = 'scale(' + lerp(2.2, 1.0, spr) + ')';
          if (f === p.frame && !playedCues.has('pop_' + p.id)) {
            playedCues.add('pop_' + p.id);
            playSfx('pop');
          }
        }
      });

      // Connecting Red Threads (Z-INDEX 60 — CLEARLY VISIBLE ACROSS ALL CARDS!)
      updateThread(th1, PINS[0], PINS[1], 26, f); // Slot 1 -> Slot 2
      updateThread(th2, PINS[1], PINS[3], 42, f); // Slot 2 -> Slot 4
      updateThread(th3, PINS[3], PINS[5], 58, f); // Slot 4 -> Slot 6
      updateThread(th4, PINS[5], PINS[4], 60, f); // Slot 6 -> Slot 5
      updateThread(th5, PINS[4], PINS[2], 52, f); // Slot 5 -> Slot 3
      updateThread(th6, PINS[2], PINS[0], 34, f); // Slot 3 -> Slot 1
      // Hero connections to all outer pins
      updateThread(th7, PINS[0], PINS[6], 68, f); // Slot 1 -> Hero
      updateThread(th8, PINS[1], PINS[6], 69, f); // Slot 2 -> Hero
      updateThread(th9, PINS[2], PINS[6], 70, f); // Slot 3 -> Hero
      updateThread(th10, PINS[3], PINS[6], 71, f); // Slot 4 -> Hero
      updateThread(th11, PINS[4], PINS[6], 72, f); // Slot 5 -> Hero

      // Pencil Scribbles
      pencilLoop.style.opacity = f >= 28 ? '0.75' : '0';
      pencilQuestion.style.opacity = f >= 36 ? '0.85' : '0';

      // Bottom Stencil Spray Section
      if (f < 72) {
        elBottomSection.style.opacity = '0';
      } else {
        const pBot = springSmooth(f, 72);
        elBottomSection.style.opacity = '1';
        elBottomSection.style.transform = 'translateY(' + lerp(40, 0, pBot) + 'px)';
        if (f === 78 && !playedCues.has('impact_bot')) {
          playedCues.add('impact_bot');
          playSfx('impact');
        }
      }

      // Micro tremor on hero card & stencil land
      if ((f >= 68 && f <= 76) || (f >= 78 && f <= 86)) {
        const shake = Math.sin((f - 68) * 1.6) * 3;
        viewport.style.transform = 'translateY(' + shake + 'px)';
      } else {
        viewport.style.transform = 'translateY(0px)';
      }
    }

    // =========================================================================
    // PLAYBACK ANIMATION LOOP
    // =========================================================================
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
        if (currentFrame > 450) {
          currentFrame = 0;
          playedCues.clear();
        }
      }

      renderAtFrame(currentFrame);
      requestAnimationFrame(tick);
    }

    const btnPlayPause = document.getElementById('btnPlayPause');
    const playIcon = document.getElementById('playIcon');
    const playLabel = document.getElementById('playLabel');

    btnPlayPause.addEventListener('click', () => {
      initAudio();
      isPlaying = !isPlaying;
      if (isPlaying) {
        playIcon.textContent = '⏸';
        playLabel.textContent = 'JEDA ANIMASI';
        btnPlayPause.classList.replace('bg-red-600', 'bg-amber-600');
        lastTimestamp = 0;
        requestAnimationFrame(tick);
      } else {
        playIcon.textContent = '▶';
        playLabel.textContent = 'PUTAR ANIMASI JATUH SMOOTH';
        btnPlayPause.classList.replace('bg-amber-600', 'bg-red-600');
      }
    });

    document.getElementById('btnReset').addEventListener('click', () => {
      isPlaying = false;
      playIcon.textContent = '▶';
      playLabel.textContent = 'PUTAR ANIMASI JATUH SMOOTH';
      btnPlayPause.classList.replace('bg-amber-600', 'bg-red-600');
      currentFrame = 0;
      playedCues.clear();
      renderAtFrame(0);
    });

    sliderFrame.addEventListener('input', (e) => {
      isPlaying = false;
      playIcon.textContent = '▶';
      playLabel.textContent = 'PUTAR ANIMASI JATUH SMOOTH';
      btnPlayPause.classList.replace('bg-amber-600', 'bg-red-600');
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

    // Audio toggle
    document.getElementById('btnAudioToggle').addEventListener('click', () => {
      sfxEnabled = !sfxEnabled;
      document.getElementById('audioLabel').textContent = sfxEnabled ? 'SFX: ON' : 'SFX: OFF';
      document.getElementById('audioIcon').textContent = sfxEnabled ? '🔊' : '🔇';
    });

    // Initial render
    window.renderAtFrame = renderAtFrame;
    renderAtFrame(0);
  </script>
</body>
</html>`;

const finalHtml = html.replace('__BG_IMAGE__', base64Data);

fs.writeFileSync('C:/Users/AMD/.gemini/antigravity/brain/2d956349-a99c-4663-aede-6aa32c2fdf19/archival_doc_scene1_preview.html', finalHtml, 'utf8');
fs.writeFileSync('E:/JS/ArunakiNexus/apps/public/conspiracy_preview.html', finalHtml, 'utf8');
console.log('BUILD SUCCESS: HTML files written with Z-60 Threads and Z-70 Pins!');
