/**
 * Scene 4: Baterai Alessandro Volta (1800)
 * Registered via AM.registerScene("scene4_volta_baterai", ...)
 */
(function () {
  "use strict";
  const AM = window.AetheriaMotion || window.AM;
  if (!AM) return;

  AM.registerScene("scene4_volta_baterai", function (ctx, localTime, dur, scene) {
    AM.drawGridBackdrop(ctx, localTime, scene.accent, "#102428", "#091118");

    ctx.save();
    AM.roundRect(ctx, 64, 180, 952, 950, 32);
    ctx.fillStyle = "#0D1B22";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = scene.accent;
    ctx.stroke();
    ctx.clip();

    const layers = [
      { label: "TEMBAGA (Cu)", color: "#D97706", text: "#FFF6E9" },
      { label: "KAIN AIR GARAM (NaCl)", color: "#2EE6A8", text: "#0F172A" },
      { label: "SENG (Zn)", color: "#CBD5E1", text: "#0F172A" },
      { label: "TEMBAGA (Cu)", color: "#D97706", text: "#FFF6E9" },
      { label: "KAIN AIR GARAM (NaCl)", color: "#2EE6A8", text: "#0F172A" },
      { label: "SENG (Zn)", color: "#CBD5E1", text: "#0F172A" },
      { label: "TEMBAGA (Cu)", color: "#D97706", text: "#FFF6E9" },
      { label: "KAIN AIR GARAM (NaCl)", color: "#2EE6A8", text: "#0F172A" },
      { label: "SENG (Zn)", color: "#CBD5E1", text: "#0F172A" },
    ];

    const stackBaseY = 935;
    const discH = 58;
    const discW = 460;

    ctx.fillStyle = "#475569";
    AM.roundRect(ctx, 540 - discW / 2 - 36, 360, 18, 610, 9);
    ctx.fill();
    AM.roundRect(ctx, 540 + discW / 2 + 18, 360, 18, 610, 9);
    ctx.fill();

    layers.forEach((layer, idx) => {
      const drop = AM.stagger(localTime + 0.35, idx, 0.1, 0.25, 0.65, AM.ease.outBack);
      if (drop <= 0.01) return;
      const targetY = stackBaseY - idx * (discH + 6);
      const curY = AM.lerp(220, targetY, drop);

      ctx.save();
      AM.roundRect(ctx, 540 - discW / 2, curY, discW, discH, 16);
      ctx.fillStyle = layer.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#0F172A";
      ctx.stroke();

      ctx.font = "800 22px 'JetBrains Mono', monospace";
      ctx.fillStyle = layer.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(layer.label, 540, curY + discH / 2);
      ctx.restore();
    });

    if (localTime > 2.6) {
      const loopAlpha = AM.clamp((localTime - 2.6) / 1.0, 0, 1);
      ctx.save();
      ctx.globalAlpha = loopAlpha;

      ctx.strokeStyle = "#FFC62B";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(540, 410);
      ctx.bezierCurveTo(540, 230, 910, 230, 910, 660);
      ctx.bezierCurveTo(910, 1060, 540, 1060, 540, 965);
      ctx.stroke();

      for (let e = 0; e < 10; e++) {
        const u = (localTime * 0.45 + e / 10) % 1;
        const angle = u * Math.PI - Math.PI / 2;
        const ex = 540 + Math.cos(angle) * 350;
        const ey = 685 + Math.sin(angle) * 320;

        ctx.beginPath();
        ctx.arc(ex, ey, 14, 0, AM.TAU);
        ctx.fillStyle = "#FFC62B";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#151433";
        ctx.stroke();

        ctx.font = "800 14px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#151433";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("e⁻", ex, ey);
      }

      const glow = 0.7 + 0.3 * Math.sin(localTime * 8);
      ctx.beginPath();
      ctx.arc(540, 280, 46 * glow, 0, AM.TAU);
      ctx.fillStyle = "rgba(255, 198, 43, 0.32)";
      ctx.fill();

      AM.roundRect(ctx, 130, 240, 280, 74, 18);
      ctx.fillStyle = "#151433";
      ctx.fill();
      ctx.strokeStyle = "#2EE6A8";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = "800 22px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#2EE6A8";
      ctx.textAlign = "center";
      ctx.fillText("ARUS DC STABIL", 270, 277);

      ctx.restore();
    }

    ctx.restore();
  });
})();

