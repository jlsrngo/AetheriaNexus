/**
 * Scene 1: Hook — Kota Gelap, Sakelar Padam & Ponsel Berpijar
 * Registered via AM.registerScene("scene1_hook", ...)
 */
(function () {
  "use strict";
  const AM = window.AetheriaMotion || window.AM;
  if (!AM) return;

  AM.registerScene("scene1_hook", function (ctx, localTime, dur, scene) {
    const blackoutProgress = AM.smoothstep(2.1, 2.7, localTime);
    const bgTop = blackoutProgress < 0.5 ? "#1A1B4B" : "#070712";
    const bgBot = blackoutProgress < 0.5 ? "#2B2D6E" : "#0D0D1A";
    AM.drawGridBackdrop(ctx, localTime, scene.accent, bgTop, bgBot);

    ctx.save();
    AM.roundRect(ctx, 64, 180, 952, 950, 32);
    ctx.fillStyle = blackoutProgress > 0.5 ? "#0B0B18" : "#16183E";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = blackoutProgress > 0.5 ? "#334155" : "#FFC62B";
    ctx.stroke();
    ctx.clip();

    // Twinkling stars in night sky
    for (let i = 0; i < 36; i++) {
      const sx = 90 + AM.rand(i * 17 + 1) * 900;
      const sy = 210 + AM.rand(i * 31 + 2) * 420;
      const twinkle = 0.35 + 0.65 * Math.sin(localTime * 4 + i);
      ctx.fillStyle = `rgba(255, 246, 233, ${twinkle * (0.3 + 0.7 * blackoutProgress)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + (i % 3), 0, AM.TAU);
      ctx.fill();
    }

    // City Skyline Buildings with Staggered Pop
    const buildings = [
      { x: 95, w: 115, h: 420, cols: 3, rows: 7 },
      { x: 225, w: 135, h: 540, cols: 4, rows: 9 },
      { x: 375, w: 150, h: 630, cols: 4, rows: 11 },
      { x: 540, w: 140, h: 500, cols: 3, rows: 8 },
      { x: 695, w: 155, h: 590, cols: 4, rows: 10 },
      { x: 865, w: 120, h: 450, cols: 3, rows: 7 },
    ];

    const baseY = 1090;
    buildings.forEach((b, idx) => {
      const [s, k] = AM.pop(localTime + 0.45, idx * 0.06, 2.3, 0.4, 0.22);
      const sx = 1 / (1 + k);
      const sy = Math.max(0, s) * (1 + k);
      const bh = b.h * sy;
      const bw = b.w * sx;
      const bx = b.x + (b.w - bw) / 2;
      const by = baseY - bh;

      ctx.fillStyle = blackoutProgress > 0.5 ? "#121328" : "#1F2256";
      AM.roundRect(ctx, bx, by, bw, bh, 10);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#090914";
      ctx.stroke();

      const mythSurge = AM.smoothstep(8.2, 9.2, localTime);
      const padX = 16;
      const padY = 22;
      const cellW = (bw - padX * 2) / b.cols;
      const cellH = 38;
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.cols; c++) {
          const seed = idx * 100 + r * 10 + c;
          if (AM.rand(seed) < 0.22) continue;
          const wx = bx + padX + c * cellW + 4;
          const wy = by + padY + r * cellH;
          if (wy + 22 > baseY - 20) continue;

          const isLit =
            blackoutProgress < 0.5 ||
            (mythSurge > 0.3 && Math.sin(localTime * 8 + seed) > 0.2);
          ctx.fillStyle = isLit ? "#FFC62B" : "#1A1C36";
          AM.roundRect(ctx, wx, wy, Math.max(4, cellW - 8), 22, 4);
          ctx.fill();
        }
      }
    });

    // Beat 1: Giant Tactile Breaker Switch (0 - 4.2s) with velocity pop, kick & burst lines
    if (localTime < 4.5) {
      const [swS, swK] = AM.pop(localTime + 0.35, 0, 2.4, 0.42, 0.18);
      const snapKick = AM.kick(localTime, 2.2, 3.8, 0.35);
      ctx.save();
      ctx.translate(540, 510 + snapKick * 18);
      ctx.scale((swS / (1 + swK)) * (1 + snapKick * 0.08), swS * (1 + swK) * (1 - snapKick * 0.08));

      AM.roundRect(ctx, -170, -210, 340, 420, 36);
      ctx.fillStyle = "#1E293B";
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = blackoutProgress > 0.5 ? "#EF4444" : "#FFC62B";
      ctx.stroke();

      const leverY = AM.lerp(-75, 75, blackoutProgress);
      AM.roundRect(ctx, -85, leverY - 55, 170, 110, 22);
      ctx.fillStyle = blackoutProgress > 0.5 ? "#EF4444" : "#2EE6A8";
      ctx.fill();

      ctx.font = "900 34px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#0F172A";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(blackoutProgress > 0.5 ? "PADAM" : "NYALA", 0, leverY);
      ctx.restore();

      AM.drawShockRing(ctx, 540, 510, localTime, 2.2, 90, 340, 18, 0.45, "#EF4444");
      AM.drawBurstLines(ctx, 540, 510, 10, 140, 310, localTime, 2.2, 0.38, "#FFC62B", 8);
    }

    // Beat 2 & 3: Glowing Smartphone & Ancient Lightning Deity Emblem (3.8s - 14.23s)
    if (localTime >= 3.8) {
      const [phS, phK] = AM.pop(localTime, 3.8, 2.5, 0.4, 0.22);
      const floatY = Math.sin(localTime * 3.2) * 14;
      AM.drawShockRing(ctx, 540, 600, localTime, 3.85, 80, 380, 18, 0.45, "#38BDF8");
      AM.drawBurstLines(ctx, 540, 600, 12, 130, 330, localTime, 3.85, 0.4, "#FFC62B", 7);

      ctx.save();
      ctx.translate(540, 600 + floatY);
      ctx.scale(Math.max(0, phS) / (1 + phK), Math.max(0, phS) * (1 + phK));

      const aura = ctx.createRadialGradient(0, 0, 30, 0, 0, 310);
      aura.addColorStop(0, "rgba(56, 189, 248, 0.42)");
      aura.addColorStop(0.5, "rgba(255, 198, 43, 0.18)");
      aura.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 310, 0, AM.TAU);
      ctx.fill();

      AM.roundRect(ctx, -135, -250, 270, 500, 42);
      ctx.fillStyle = "#0F172A";
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#38BDF8";
      ctx.stroke();

      AM.roundRect(ctx, -115, -215, 230, 430, 28);
      const scrGrad = ctx.createLinearGradient(0, -215, 0, 215);
      scrGrad.addColorStop(0, "#1E3A8A");
      scrGrad.addColorStop(1, "#090D16");
      ctx.fillStyle = scrGrad;
      ctx.fill();

      ctx.fillStyle = "#FFC62B";
      ctx.beginPath();
      ctx.moveTo(15, -130);
      ctx.lineTo(-55, 10);
      ctx.lineTo(5, 10);
      ctx.lineTo(-25, 135);
      ctx.lineTo(65, -20);
      ctx.lineTo(5, -20);
      ctx.closePath();
      ctx.fill();

      if (localTime > 7.8) {
        const haloP = AM.clamp((localTime - 7.8) / 1.2, 0, 1);
        ctx.save();
        ctx.rotate(localTime * 0.6);
        ctx.strokeStyle = `rgba(255, 198, 43, ${0.75 * haloP})`;
        ctx.lineWidth = 4;
        ctx.setLineDash([18, 14]);
        ctx.beginPath();
        ctx.arc(0, 0, 220, 0, AM.TAU);
        ctx.stroke();
        ctx.restore();

        for (let k = 0; k < 4; k++) {
          const ang = (k / 4) * AM.TAU + localTime * 1.8;
          const tx = Math.cos(ang) * 290;
          const ty = Math.sin(ang) * 290;
          AM.drawElectricBolt(ctx, 0, 0, tx, ty, 7, 26, Math.floor(localTime * 24) + k, "#38BDF8", 4);
        }
      }

      ctx.restore();
    }

    ctx.restore();
  });
})();

