/**
 * Scene 3: Badai Petir Benjamin Franklin (1752)
 * Registered via AM.registerScene("scene3_langit_laboratorium", ...)
 */
(function () {
  "use strict";
  const AM = window.AetheriaMotion || window.AM;
  if (!AM) return;

  AM.registerScene("scene3_langit_laboratorium", function (ctx, localTime, dur, scene) {
    const strikeCycle = (localTime % 3.2) / 3.2;
    const isFlash = strikeCycle > 0.42 && strikeCycle < 0.52;
    AM.drawGridBackdrop(ctx, localTime, scene.accent, isFlash ? "#334155" : "#0F172A", "#090D1A");

    ctx.save();
    AM.roundRect(ctx, 64, 180, 952, 950, 32);
    ctx.fillStyle = isFlash ? "#1E293B" : "#0B1120";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = scene.accent;
    ctx.stroke();
    ctx.clip();

    // Storm Clouds
    const cloudCenters = [220, 420, 640, 840];
    cloudCenters.forEach((cx, idx) => {
      const drift = Math.sin(localTime * 1.2 + idx) * 24;
      ctx.fillStyle = idx % 2 === 0 ? "#1E293B" : "#334155";
      ctx.beginPath();
      ctx.arc(cx + drift, 265, 95, 0, AM.TAU);
      ctx.arc(cx + drift + 60, 280, 75, 0, AM.TAU);
      ctx.arc(cx + drift - 60, 285, 70, 0, AM.TAU);
      ctx.fill();
    });

    // Diagonal rain lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = 2;
    for (let r = 0; r < 42; r++) {
      const rx = (((AM.rand(r * 19) * 1100 - localTime * 180) % 1000) + 1000) % 1000 + 60;
      const ry = ((AM.rand(r * 37) * 900 + localTime * 680) % 900) + 200;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 14, ry + 42);
      ctx.stroke();
    }

    const kiteX = 680 + Math.sin(localTime * 2.7) * 48;
    const kiteY = 430 + Math.cos(localTime * 3.4) * 32;
    const keyX = 390;
    const keyY = 830;

    // Wet conductive hemp string
    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(kiteX, kiteY + 90);
    ctx.quadraticCurveTo(530, 660, keyX, keyY);
    ctx.stroke();

    // Diamond Kite
    ctx.save();
    ctx.translate(kiteX, kiteY);
    ctx.rotate(0.18 + Math.sin(localTime * 3) * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -95);
    ctx.lineTo(75, 0);
    ctx.lineTo(0, 95);
    ctx.lineTo(-75, 0);
    ctx.closePath();
    ctx.fillStyle = "#FF5A4E";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#FFC62B";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -95);
    ctx.lineTo(0, -145);
    ctx.strokeStyle = "#38BDF8";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();

    if (localTime > 1.2) {
      AM.drawElectricBolt(ctx, 640, 240, kiteX, kiteY - 120, 9, 38, Math.floor(localTime * 20), "#FFFFFF", 7);
      AM.drawElectricBolt(ctx, kiteX, kiteY + 80, keyX, keyY, 10, 22, Math.floor(localTime * 25) + 3, "#38BDF8", 5);
    }

    // Vintage Brass Key
    ctx.save();
    ctx.translate(keyX, keyY);
    ctx.rotate(-0.35 + Math.sin(localTime * 5) * 0.05);
    ctx.fillStyle = "#FFC62B";
    ctx.strokeStyle = "#151433";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-45, 0, 28, 0, AM.TAU);
    ctx.fill();
    ctx.stroke();
    AM.roundRect(ctx, -17, -10, 95, 20, 8);
    ctx.fill();
    ctx.stroke();
    AM.roundRect(ctx, 48, 10, 14, 24, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Leyden Jar storing charge
    const jarX = 260;
    const jarY = 930;
    const chargeLevel = AM.clamp((localTime - 2.0) / (dur * 0.75), 0, 1);
    AM.roundRect(ctx, jarX - 70, jarY - 110, 140, 180, 22);
    ctx.fillStyle = "rgba(56, 189, 248, 0.16)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#38BDF8";
    ctx.stroke();

    const fillH = 156 * chargeLevel;
    AM.roundRect(ctx, jarX - 58, jarY + 58 - fillH, 116, fillH, 14);
    ctx.fillStyle = "rgba(56, 189, 248, 0.65)";
    ctx.fill();

    AM.drawElectricBolt(ctx, keyX, keyY, jarX, jarY - 110, 6, 18, Math.floor(localTime * 30), "#FFC62B", 4);

    ctx.font = "800 24px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#FFF6E9";
    ctx.textAlign = "center";
    ctx.fillText(`LEYDEN JAR: ${Math.round(chargeLevel * 100)}%`, jarX, jarY + 105);

    ctx.restore();
  });
})();

