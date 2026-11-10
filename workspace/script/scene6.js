/**
 * Scene 6: Twist & Kota Modern Bercahaya (Finale)
 * Registered via AM.registerScene("scene6_twist_penutup", ...)
 */
(function () {
  "use strict";
  const AM = window.AetheriaMotion || window.AM;
  if (!AM) return;

  AM.registerScene("scene6_twist_penutup", function (ctx, localTime, dur, scene) {
    AM.drawGridBackdrop(ctx, localTime, scene.accent, "#172554", "#090D1A");

    ctx.save();
    AM.roundRect(ctx, 64, 180, 952, 950, 32);
    ctx.fillStyle = "#0F172A";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = scene.accent;
    ctx.stroke();
    ctx.clip();

    const milestones = [
      { year: "600 SM", name: "AMBAR", color: "#F59E0B" },
      { year: "1752", name: "PETIR", color: "#38BDF8" },
      { year: "1800", name: "VOLTA", color: "#2EE6A8" },
      { year: "1831", name: "FARADAY", color: "#FF5A4E" },
      { year: "KINI", name: "MODERN", color: "#FFC62B" },
    ];

    ctx.strokeStyle = "rgba(255, 198, 43, 0.5)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(150, 305);
    ctx.lineTo(930, 305);
    ctx.stroke();

    milestones.forEach((m, idx) => {
      const mx = 150 + idx * 195;
      const my = 305;
      const pop = AM.stagger(localTime + 0.3, idx, 0.1, 0.18, 0.5, AM.ease.outBack);
      ctx.save();
      ctx.translate(mx, my);
      ctx.scale(pop, pop);

      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, AM.TAU);
      ctx.fillStyle = m.color;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#151433";
      ctx.stroke();

      ctx.font = "800 18px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#FFF6E9";
      ctx.textAlign = "center";
      ctx.fillText(m.year, 0, -45);
      ctx.font = "800 19px 'Inter', sans-serif";
      ctx.fillStyle = m.color;
      ctx.fillText(m.name, 0, 52);
      ctx.restore();
    });

    const lightWaveX = AM.remap(localTime, 0.4, 5.0, 60, 1100, AM.ease.outCubic);
    const towers = [
      { x: 95, w: 120, h: 410 },
      { x: 230, w: 145, h: 520 },
      { x: 390, w: 165, h: 610 },
      { x: 570, w: 140, h: 490 },
      { x: 725, w: 150, h: 560 },
      { x: 890, w: 105, h: 430 },
    ];

    const groundY = 1100;
    towers.forEach((t, idx) => {
      const ty = groundY - t.h;
      const isPowered = t.x + t.w / 2 <= lightWaveX;

      ctx.fillStyle = isPowered ? "#1E293B" : "#0F172A";
      AM.roundRect(ctx, t.x, ty, t.w, t.h, 12);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = isPowered ? "#38BDF8" : "#1E293B";
      ctx.stroke();

      const cols = 3;
      const rows = Math.floor(t.h / 46);
      const cw = (t.w - 24) / cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (AM.rand(idx * 70 + r * 9 + c) < 0.18) continue;
          const wx = t.x + 12 + c * cw + 4;
          const wy = ty + 20 + r * 42;
          ctx.fillStyle = isPowered
            ? (r + c + idx) % 3 === 0
              ? "#38BDF8"
              : "#FFC62B"
            : "#1E293B";
          AM.roundRect(ctx, wx, wy, cw - 8, 24, 4);
          ctx.fill();
        }
      }
    });

    const bulbScale = AM.spring(Math.max(0.05, localTime - 0.8), { stiffness: 190, damping: 15 });
    if (bulbScale > 0.01) {
      ctx.save();
      ctx.translate(540, 565 + Math.sin(localTime * 3) * 10);
      ctx.scale(bulbScale, bulbScale);

      const halo = ctx.createRadialGradient(0, 0, 20, 0, 0, 220);
      halo.addColorStop(0, "rgba(255, 198, 43, 0.55)");
      halo.addColorStop(0.6, "rgba(46, 230, 168, 0.18)");
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 220, 0, AM.TAU);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, -20, 88, 0, AM.TAU);
      ctx.fillStyle = "#FFC62B";
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#FFF6E9";
      ctx.stroke();

      AM.roundRect(ctx, -42, 55, 84, 52, 12);
      ctx.fillStyle = "#94A3B8";
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "#151433";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-24, 45);
      ctx.lineTo(-24, -15);
      ctx.arc(0, -15, 24, Math.PI, 0);
      ctx.lineTo(24, 45);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  });
})();

