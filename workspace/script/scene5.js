/**
 * Scene 5: Induksi Elektromagnetik Michael Faraday (1831)
 * Registered via AM.registerScene("scene5_faraday_generator", ...)
 */
(function () {
  "use strict";
  const AM = window.AetheriaMotion || window.AM;
  if (!AM) return;

  AM.registerScene("scene5_faraday_generator", function (ctx, localTime, dur, scene) {
    AM.drawGridBackdrop(ctx, localTime, scene.accent, "#24142C", "#0D0B18");

    ctx.save();
    AM.roundRect(ctx, 64, 180, 952, 950, 32);
    ctx.fillStyle = "#140F23";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = scene.accent;
    ctx.stroke();
    ctx.clip();

    const freq = 3.2;
    const magOffset = Math.sin(localTime * freq) * 170;
    const magVelocity = Math.cos(localTime * freq);
    const coilCenterY = 660;
    const magCenterY = 470 + magOffset;

    const fluxIntensity = Math.abs(magVelocity);
    for (let f = 1; f <= 3; f++) {
      ctx.save();
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.2 + fluxIntensity * 0.35})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.ellipse(390, magCenterY, 110 + f * 55, 160 + f * 45, 0, 0, AM.TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(690, magCenterY, 110 + f * 55, 160 + f * 45, 0, 0, AM.TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Bar Magnet (North Red / South Blue)
    ctx.save();
    ctx.translate(540, magCenterY);
    AM.roundRect(ctx, -70, 0, 140, 145, 14);
    ctx.fillStyle = "#FF5A4E";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#FFF6E9";
    ctx.stroke();

    AM.roundRect(ctx, -70, -145, 140, 145, 14);
    ctx.fillStyle = "#38BDF8";
    ctx.fill();
    ctx.stroke();

    ctx.font = "900 44px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#FFF6E9";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", 0, -72);
    ctx.fillText("N", 0, 72);
    ctx.restore();

    // Copper Solenoid Coil Windings
    for (let w = 0; w < 7; w++) {
      const wy = coilCenterY - 120 + w * 42;
      ctx.save();
      AM.roundRect(ctx, 350, wy, 380, 28, 14);
      const coilGrad = ctx.createLinearGradient(350, wy, 730, wy);
      coilGrad.addColorStop(0, "#B45309");
      coilGrad.addColorStop(0.5, "#FFC62B");
      coilGrad.addColorStop(1, "#B45309");
      ctx.fillStyle = coilGrad;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#151433";
      ctx.stroke();

      if (fluxIntensity > 0.25) {
        ctx.strokeStyle = `rgba(255, 222, 89, ${fluxIntensity * 0.8})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Galvanometer Gauge
    const gaugeX = 540;
    const gaugeY = 975;
    ctx.save();
    AM.roundRect(ctx, gaugeX - 210, gaugeY - 115, 420, 195, 28);
    ctx.fillStyle = "#1E293B";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#FFC62B";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY + 25, 110, Math.PI * 1.15, Math.PI * 1.85);
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 6;
    ctx.stroke();

    const needleAngle = -Math.PI / 2 + magVelocity * 0.85;
    ctx.beginPath();
    ctx.moveTo(gaugeX, gaugeY + 25);
    ctx.lineTo(
      gaugeX + Math.cos(needleAngle) * 102,
      gaugeY + 25 + Math.sin(needleAngle) * 102
    );
    ctx.strokeStyle = "#FF5A4E";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY + 25, 12, 0, AM.TAU);
    ctx.fillStyle = "#FFC62B";
    ctx.fill();

    ctx.font = "800 22px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#FFF6E9";
    ctx.textAlign = "center";
    ctx.fillText("GALVANOMETER · ARUS INDUKSI", gaugeX, gaugeY + 62);
    ctx.restore();

    ctx.restore();
  });
})();

