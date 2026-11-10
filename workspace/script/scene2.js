/**
 * Scene 2: Rahasia Alam — Belut Listrik & Batu Ambar Thales (600 SM)
 * Registered via AM.registerScene("scene2_rahasia_alam", ...)
 */
(function () {
  "use strict";
  const AM = window.AetheriaMotion || window.AM;
  if (!AM) return;

  AM.registerScene("scene2_rahasia_alam", function (ctx, localTime, dur, scene) {
    AM.drawGridBackdrop(ctx, localTime, scene.accent, "#131836", "#0A0D1E");

    ctx.save();
    AM.roundRect(ctx, 64, 180, 952, 950, 32);
    ctx.fillStyle = "#10172A";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = scene.accent;
    ctx.stroke();
    ctx.clip();

    if (localTime < 8.2) {
      // Beat 1: Bioluminescent River & Electric Eel
      for (let w = 0; w < 4; w++) {
        ctx.beginPath();
        const baseWaveY = 420 + w * 180;
        ctx.moveTo(64, baseWaveY);
        for (let x = 64; x <= 1016; x += 40) {
          const wy = baseWaveY + Math.sin(x * 0.015 + localTime * 3 + w) * 22;
          ctx.lineTo(x, wy);
        }
        ctx.lineTo(1016, 1130);
        ctx.lineTo(64, 1130);
        ctx.closePath();
        ctx.fillStyle = `rgba(14, 116, 144, ${0.18 + w * 0.08})`;
        ctx.fill();
      }

      ctx.save();
      ctx.beginPath();
      const eelPoints = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        const ex = 210 + u * 660;
        const ey = 620 + Math.sin(u * Math.PI * 2.5 - localTime * 6) * 68;
        eelPoints.push({ x: ex, y: ey });
      }
      ctx.moveTo(eelPoints[0].x, eelPoints[0].y);
      for (let i = 1; i < eelPoints.length; i++) {
        ctx.lineTo(eelPoints[i].x, eelPoints[i].y);
      }
      ctx.strokeStyle = "#2EE6A8";
      ctx.lineWidth = 54;
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.strokeStyle = "#151433";
      ctx.lineWidth = 36;
      ctx.stroke();

      eelPoints.forEach((pt, idx) => {
        if (idx % 2 === 0 && idx > 1 && idx < 22) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 8, 0, AM.TAU);
          ctx.fillStyle = "#FFC62B";
          ctx.fill();
        }
      });

      for (let b = 0; b < 3; b++) {
        const src = eelPoints[4 + b * 7];
        const rad = 110 + ((localTime * 120 + b * 50) % 160);
        ctx.strokeStyle = `rgba(56, 189, 248, ${1 - rad / 270})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(src.x, src.y, rad, 0, AM.TAU);
        ctx.stroke();
      }
      ctx.restore();

      AM.roundRect(ctx, 250, 250, 580, 68, 20);
      ctx.fillStyle = "rgba(21, 20, 51, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "#2EE6A8";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = "800 28px 'Inter', sans-serif";
      ctx.fillStyle = "#2EE6A8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BELUT LISTRIK · SENGATAN BIO-ELEKTRIK 600V", 540, 284);
    } else {
      // Beat 2 & 3: Thales of Miletus & Glowing Amber Stone (Elektron)
      const tAmber = localTime - 8.2;
      const enter = AM.spring(tAmber + 0.15, { stiffness: 200, damping: 16 });

      for (let r = 1; r <= 4; r++) {
        const radius = 110 * r + ((tAmber * 45) % 90);
        ctx.strokeStyle = `rgba(245, 158, 11, ${Math.max(0, 0.45 - r * 0.09)})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 12]);
        ctx.beginPath();
        ctx.arc(540, 560, radius, 0, AM.TAU);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const rubFactor = AM.clamp(1 - Math.max(0, tAmber - 5.5) / 1.5, 0, 1);
      if (rubFactor > 0.02) {
        const rubX = 540 + Math.sin(tAmber * 9) * 120;
        const rubY = 540 + Math.cos(tAmber * 9) * 35;
        ctx.save();
        ctx.globalAlpha = rubFactor;
        AM.roundRect(ctx, rubX - 110, rubY - 70, 220, 140, 32);
        ctx.fillStyle = "#FFF6E9";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#151433";
        ctx.stroke();
        ctx.font = "800 22px 'Inter', sans-serif";
        ctx.fillStyle = "#151433";
        ctx.textAlign = "center";
        ctx.fillText("KAIN BULU DOMBA", rubX, rubY);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(540, 560);
      ctx.scale(enter, enter);
      ctx.rotate(Math.sin(tAmber * 2.2) * 0.06);

      ctx.beginPath();
      ctx.moveTo(0, -155);
      ctx.lineTo(145, -55);
      ctx.lineTo(115, 125);
      ctx.lineTo(-95, 145);
      ctx.lineTo(-150, -35);
      ctx.closePath();
      const ambGrad = ctx.createLinearGradient(-120, -150, 120, 150);
      ambGrad.addColorStop(0, "#FDE047");
      ambGrad.addColorStop(0.5, "#F59E0B");
      ambGrad.addColorStop(1, "#B45309");
      ctx.fillStyle = ambGrad;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#FFF6E9";
      ctx.stroke();

      ctx.font = "900 32px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#151433";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ELEKTRON", 0, -8);
      ctx.font = "700 20px 'Inter', sans-serif";
      ctx.fillText("BATU AMBAR", 0, 28);
      ctx.restore();

      const attractProgress = AM.smoothstep(2.0, 6.5, tAmber);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI + 0.15;
        const startX = 160 + i * 108;
        const startY = 1020;
        const targetX = 540 + Math.cos(angle + tAmber * 0.8) * 175;
        const targetY = 560 + Math.sin(angle + tAmber * 0.8) * 175;
        const curX = AM.lerp(startX, targetX, attractProgress);
        const curY = AM.lerp(startY, targetY, attractProgress);

        if (attractProgress > 0.15) {
          AM.drawElectricBolt(ctx, 540, 560, curX, curY, 5, 12, i + Math.floor(tAmber * 15), "#FFC62B", 2.5);
        }

        ctx.save();
        ctx.translate(curX, curY);
        ctx.rotate(tAmber * 2 + i);
        AM.roundRect(ctx, -26, -14, 52, 28, 8);
        ctx.fillStyle = i % 2 === 0 ? "#FFF6E9" : "#2EE6A8";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#151433";
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  });
})();

