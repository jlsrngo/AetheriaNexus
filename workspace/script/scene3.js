/**
 * Scene 3: Dari Langit ke Laboratorium — Badai Petir & Eksperimen Layang-Layang Benjamin Franklin (1752)
 * Style: /mg-flat-vector (01-flat-vector Popwise Palette, Camera Zoom, Character Rig & Shape Wipe)
 * Audio Sync: workspace/audio/scene3_langit_laboratorium.words.json (26.77s)
 */
(function () {
  "use strict";
  const AM = window.AetheriaMotion || window.AM;
  if (!AM) return;

  const C = {
    U: "#2B2BFF",
    UD: "#1F1FCC",
    UL: "#4D4DFF",
    CO: "#FF5A4E",
    COD: "#E0433A",
    SU: "#FFC62B",
    SUD: "#F0A91A",
    MI: "#2EE6A8",
    MID: "#1FC28C",
    CR: "#FFF6E9",
    CRD: "#F1E3CC",
    INK: "#151433",
    INKW: "#2A2962",
  };

  const RAIN = Array.from({ length: 36 }, (_, i) => ({
    x: (i * 137) % 1260 - 90,
    y: (i * 179) % 1920,
    len: 42 + (i % 4) * 16,
    spd: 980 + (i % 5) * 150,
  }));

  function drawRainAndStormClouds(ctx, t) {
    ctx.save();
    ctx.strokeStyle = "rgba(163, 163, 255, 0.34)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    RAIN.forEach((r) => {
      const ry = ((r.y + t * r.spd) % 2080) - 120;
      const rx = r.x - (ry + 120) * 0.16;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - r.len * 0.16, ry + r.len);
      ctx.stroke();
    });
    ctx.restore();

    const clouds = [
      { x: 220, y: 310, w: 380, h: 96, c: C.UD },
      { x: 540, y: 295, w: 460, h: 112, c: C.INK },
      { x: 860, y: 315, w: 390, h: 98, c: C.UD },
    ];
    clouds.forEach((cl, idx) => {
      const dx = Math.sin(t * 1.5 + idx) * 16;
      ctx.save();
      ctx.translate(cl.x + dx, cl.y);
      ctx.fillStyle = cl.c;
      AM.roundRect(ctx, -cl.w / 2, -cl.h / 2, cl.w, cl.h, cl.h / 2);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = C.INK;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-cl.w * 0.18, -cl.h * 0.45, cl.h * 0.56, 0, AM.TAU);
      ctx.arc(cl.w * 0.16, -cl.h * 0.52, cl.h * 0.64, 0, AM.TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  AM.registerScene("scene3_langit_laboratorium", function (ctx, t, dur) {
    // Word cues from workspace/audio/scene3_langit_laboratorium.words.json:
    // 0.78s: "berdiri di tengah badai."
    // 3.26s: "Langit tiba-tiba terbelah oleh cahaya."
    // 4.46s: "Petir menyambar begitu dekat"
    // 6.34s: "hingga seluruh tubuhmu bergetar."
    // 8.44s: "Selama berabad-abad, manusia hanya bisa takut melihatnya."
    // 12.80s: "1752, Benjamin Franklin" | 16.26s: "menggunakan layang-layang"
    // 17.88s: "menyelidiki hubungan petir dengan listrik."
    // 20.30s: "kekuatan di langit dan percikan kecil... ternyata berhubungan."

    const tSkySplit = 3.26;
    const tStrikeClose = 4.46;
    const tTremble = 6.34;
    const tFearCenturies = 8.44;
    const tFranklinCut = 12.15;
    const tKiteCue = 16.26;
    const tKeySpark = 17.88;
    const tBridgeCut = 20.30;

    // Camera zoom onto Franklin's Brass Key spark at 17.5s - 20.1s
    const zoomKey = AM.E.ioC(AM.inv(17.30, 18.10, t)) * (1 - AM.E.ioC(AM.inv(19.70, 20.30, t)));
    const shakeAmp = AM.kick(t, tStrikeClose, 4.5, 0.25) * 24 + AM.kick(t, tTremble, 4.0, 0.22) * 18;
    const shakeX = Math.sin(t * 58) * shakeAmp;
    const shakeY = Math.cos(t * 64) * shakeAmp * 0.65;

    ctx.save();
    AM.applyCamera(ctx, {
      s: 1.0 + zoomKey * 0.32,
      cx: AM.lerp(540, 480, zoomKey) + shakeX,
      cy: AM.lerp(960, 990, zoomKey) + shakeY,
    });

    if (t < tFranklinCut) {
      // =======================================================================
      // ACT I (0.00s - 12.15s): Standing in the Storm & Trembling before Lightning
      // =======================================================================
      const flash = AM.hump(AM.inv(3.22, 3.72, t)) + AM.hump(AM.inv(4.44, 5.02, t));
      ctx.fillStyle = flash > 0.35 ? AM.mixHex(C.INK, C.SU, flash * 0.55) : C.INK;
      ctx.fillRect(-600, -600, 2280, 3120);

      // Storm horizon hills & ground
      ctx.fillStyle = C.UD;
      ctx.beginPath();
      ctx.arc(280, 1340, 460, Math.PI, AM.TAU);
      ctx.arc(820, 1360, 520, Math.PI, AM.TAU);
      ctx.fill();

      ctx.fillStyle = "#0B0A20";
      ctx.fillRect(-400, 1230, 1880, 900);
      ctx.strokeStyle = C.U;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-400, 1230);
      ctx.lineTo(1480, 1230);
      ctx.stroke();

      drawRainAndStormClouds(ctx, t);

      // 3.26s ("Langit tiba-tiba terbelah oleh cahaya"): Sky-splitting bolt
      if (t >= tSkySplit && t < 4.40) {
        AM.drawElectricBolt(ctx, 540, 310, 760, 980, 12, 62, Math.floor(t * 22), C.CR, 11);
      }

      // 4.46s ("Petir menyambar begitu dekat"): Close ground strike beside protagonist
      const strikeX = 250;
      const strikeY = 1225;
      if (t >= tStrikeClose && t < 6.25) {
        AM.drawElectricBolt(ctx, 310, 295, strikeX, strikeY, 14, 68, Math.floor(t * 25), C.SU, 15);
      }
      AM.drawShockRing(ctx, strikeX, strikeY, t, tStrikeClose, 30, 290, 16, 0.75, C.SU);
      AM.drawBurstLines(ctx, strikeX, strikeY - 20, 12, 40, 210, t, tStrikeClose, 0.65, C.CO, 8);

      // Protagonist vibration during "hingga seluruh tubuhmu bergetar" (6.34s - 7.80s)
      const isTrembling = t >= tStrikeClose && t < 8.20;
      const vibAmp = t >= 6.15 && t < 7.85 ? 14 : isTrembling ? 5 : 0;
      const vx = Math.sin(t * 62) * vibAmp;
      const vy = Math.cos(t * 68) * vibAmp * 0.45;
      const crouch = AM.E.ioC(AM.inv(8.20, 9.20, t)) * 28;

      const charX = 635 + vx;
      const charY = 1140 + crouch + vy;
      const handsUp = AM.E.ioC(AM.inv(tStrikeClose, tStrikeClose + 0.38, t));

      // Vibration shock arcs around character body
      if (vibAmp > 4) {
        ctx.save();
        ctx.strokeStyle = C.SU;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        [-1, 1].forEach((side) => {
          ctx.beginPath();
          ctx.arc(charX + side * 145, charY - 140, 52, side > 0 ? -0.6 : 2.5, side > 0 ? 0.6 : 3.7);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(charX + side * 175, charY - 140, 74, side > 0 ? -0.5 : 2.6, side > 0 ? 0.5 : 3.6);
          ctx.stroke();
        });
        ctx.restore();
      }

      AM.drawCharacterRig(ctx, t, {
        x: charX,
        y: charY,
        scale: 1.08,
        coatColor: C.CO,
        coatShade: C.COD,
        hairStyle: "short",
        glasses: true,
        expression: t >= tSkySplit ? "shocked" : "surprised",
        headTilt: t >= tStrikeClose ? -12 : 4,
        leftSh: AM.lerp(18, -128 + Math.sin(t * 32) * 10, handsUp),
        leftFo: AM.lerp(-78, -48, handsUp),
        rightSh: AM.lerp(-18, 128 - Math.sin(t * 32) * 10, handsUp),
        rightFo: AM.lerp(78, 48, handsUp),
      });

      // Callout Badge at 8.44s ("Selama berabad-abad, manusia hanya bisa takut melihatnya")
      if (t >= tFearCenturies) {
        const [fS, fK] = AM.pop(t, tFearCenturies, 2.6, 0.38, 0.15);
        ctx.save();
        ctx.translate(540, 510);
        ctx.scale(fS / (1 + fK), fS * (1 + fK));
        ctx.fillStyle = C.CO;
        AM.roundRect(ctx, -430, -64, 860, 128, 32);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 33px 'Inter', sans-serif";
        ctx.fillStyle = C.CR;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("BERABAD-ABAD: MANUSIA HANYA TAKUT", 0, -16);
        ctx.font = "700 22px 'Inter', sans-serif";
        ctx.fillStyle = C.SU;
        ctx.fillText("Petir dianggap kemarahan langit yang misterius", 0, 28);
        ctx.restore();
      }
    } else if (t < tBridgeCut) {
      // =======================================================================
      // ACT II (12.15s - 20.30s): 1752 Benjamin Franklin's Kite & Brass Key
      // =======================================================================
      ctx.fillStyle = C.U;
      ctx.fillRect(-600, -600, 2280, 3120);

      ctx.fillStyle = C.UD;
      ctx.beginPath();
      ctx.arc(310, 1340, 480, Math.PI, AM.TAU);
      ctx.arc(820, 1360, 540, Math.PI, AM.TAU);
      ctx.fill();

      ctx.fillStyle = C.INK;
      ctx.fillRect(-400, 1230, 1880, 900);

      drawRainAndStormClouds(ctx, t);

      // Kite flying in upper-right sky (highlighted at 16.26s "menggunakan layang-layang")
      const [kiteIn] = AM.pop(t, tFranklinCut + 0.25, 2.3, 0.4, 0.14);
      const kiteBoost = 1 + AM.kick(t, tKiteCue, 3.0, 0.35) * 0.22;
      const kiteX = 810 + Math.sin(t * 2.8) * 28;
      const kiteY = 510 + Math.cos(t * 3.4) * 20;

      const franklinX = 290;
      const franklinY = 1140;
      const keyX = 485;
      const keyY = 935;

      // Hemp Kite String from Franklin's Brass Key to the Kite
      ctx.save();
      ctx.strokeStyle = C.CR;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(keyX, keyY);
      ctx.quadraticCurveTo(640, 760 + Math.sin(t * 4) * 14, kiteX, kiteY);
      ctx.stroke();
      ctx.restore();

      // Diamond Kite
      ctx.save();
      ctx.translate(kiteX, kiteY);
      ctx.rotate(Math.sin(t * 3.0) * 0.12 - 0.16);
      ctx.scale(kiteIn * kiteBoost, kiteIn * kiteBoost);

      // Kite tail
      ctx.strokeStyle = C.CR;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 95);
      for (let i = 1; i <= 4; i++) {
        ctx.lineTo(Math.sin(t * 6 + i) * 24, 95 + i * 32);
      }
      ctx.stroke();

      ctx.fillStyle = C.CO;
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -95);
      ctx.lineTo(78, 0);
      ctx.lineTo(0, 95);
      ctx.lineTo(-78, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = C.SU;
      ctx.beginPath();
      ctx.moveTo(0, -95);
      ctx.lineTo(78, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 95);
      ctx.lineTo(-78, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      // Metal collector wire at top of kite
      ctx.strokeStyle = C.SU;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, -95);
      ctx.lineTo(0, -138);
      ctx.stroke();
      ctx.restore();

      // Leyden Jar next to Franklin
      ctx.fillStyle = C.MI;
      AM.roundRect(ctx, 455, 1085, 96, 145, 22);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = C.INK;
      ctx.stroke();
      ctx.fillStyle = C.CR;
      AM.roundRect(ctx, 477, 1055, 52, 34, 10);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = C.SU;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(503, 1055);
      ctx.lineTo(503, 1005);
      ctx.stroke();

      // Articulated Benjamin Franklin Rig (13.22s "Benjamin Franklin")
      AM.drawCharacterRig(ctx, t - tFranklinCut, {
        x: franklinX,
        y: franklinY,
        scale: 1.08,
        coatColor: C.CO,
        coatShade: C.COD,
        hairStyle: "colonial",
        glasses: true,
        expression: t >= tKeySpark - 0.3 ? "surprised" : "smile",
        headTilt: -8,
        leftSh: 20,
        leftFo: -75,
        rightSh: -68 + Math.sin(t * 4) * 4,
        rightFo: -22 + Math.cos(t * 4) * 4,
        onRightHand: function (rCtx) {
          // Brass Key suspended from Franklin's right hand
          rCtx.save();
          rCtx.translate(32, -16);
          rCtx.fillStyle = C.SU;
          rCtx.strokeStyle = C.INK;
          rCtx.lineWidth = 5;
          rCtx.beginPath();
          rCtx.arc(0, 0, 22, 0, AM.TAU);
          rCtx.fill();
          rCtx.stroke();
          AM.roundRect(rCtx, -7, 20, 14, 54, 6);
          rCtx.fill();
          rCtx.stroke();
          AM.roundRect(rCtx, 5, 44, 18, 10, 3);
          rCtx.fill();
          rCtx.stroke();
          rCtx.restore();
        },
      });

      // At 17.40s ("menyelidiki hubungan petir dengan listrik"):
      // Lightning hits kite -> charge races down string -> sparks at Brass Key!
      if (t >= 17.35) {
        AM.drawElectricBolt(ctx, 780, 295, kiteX, kiteY - 120, 9, 36, Math.floor(t * 24), C.SU, 10);

        const travelU = AM.clamp((t - 17.40) / 0.52, 0, 1);
        const pulsePos = AM.arcP({ x: kiteX, y: kiteY }, { x: keyX, y: keyY }, -30, travelU);
        ctx.fillStyle = C.SU;
        ctx.beginPath();
        ctx.arc(pulsePos.x, pulsePos.y, 24, 0, AM.TAU);
        ctx.fill();

        if (t >= tKeySpark) {
          AM.drawElectricBolt(ctx, keyX, keyY + 35, 503, 1005, 6, 18, Math.floor(t * 30), C.MI, 8);
          AM.drawShockRing(ctx, keyX, keyY + 25, t, tKeySpark, 20, 175, 14, 0.75, C.SU);
          AM.drawBurstLines(ctx, keyX, keyY + 25, 10, 28, 135, t, tKeySpark, 0.65, C.MI, 6);
        }
      }

      // Callout on Brass Key at 17.88s ("hubungan petir dengan listrik")
      if (t >= tKeySpark) {
        const [kS, kK] = AM.pop(t, tKeySpark, 2.7, 0.38, 0.15);
        ctx.save();
        ctx.translate(540, 1355);
        ctx.scale(kS / (1 + kK), kS * (1 + kK));
        ctx.fillStyle = C.MI;
        AM.roundRect(ctx, -430, -56, 860, 112, 30);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 32px 'Inter', sans-serif";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("KUNCI KUNINGAN MEMANTIK PERCIKAN!", 0, -12);
        ctx.font = "700 22px 'Inter', sans-serif";
        ctx.fillText("Bukti ilmiah: Petir di langit = Listrik di bumi", 0, 24);
        ctx.restore();
      }
    } else {
      // =======================================================================
      // ACT III (20.30s - 26.77s): Visual Match-Cut Bridge (LANGIT === LABORATORIUM)
      // =======================================================================
      ctx.fillStyle = C.INK;
      ctx.fillRect(-400, -400, 1880, 1360);
      ctx.fillStyle = C.U;
      ctx.fillRect(-400, 960, 1880, 1360);

      // Top Card: "KEKUATAN DI LANGIT (PETIR)"
      const [topS] = AM.pop(t, tBridgeCut + 0.15, 2.4, 0.4, 0.14);
      ctx.save();
      ctx.translate(540, 590);
      ctx.scale(topS, topS);
      ctx.fillStyle = "#1F1E48";
      AM.roundRect(ctx, -410, -210, 820, 420, 34);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.SU;
      ctx.stroke();
      AM.drawElectricBolt(ctx, -60, -90, 50, 110, 9, 42, Math.floor(t * 18), C.SU, 12);
      ctx.font = "900 36px 'Inter', sans-serif";
      ctx.fillStyle = C.SU;
      ctx.textAlign = "center";
      ctx.fillText("KEKUATAN DI LANGIT (PETIR)", 0, -145);
      ctx.restore();

      // Bottom Card: "PERCIKAN DI LABORATORIUM"
      const [botS] = AM.pop(t, tBridgeCut + 0.55, 2.4, 0.4, 0.14);
      ctx.save();
      ctx.translate(540, 1260);
      ctx.scale(botS, botS);
      ctx.fillStyle = C.UD;
      AM.roundRect(ctx, -410, -180, 820, 360, 34);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.MI;
      ctx.stroke();
      ctx.fillStyle = C.SU;
      ctx.beginPath();
      ctx.arc(0, 15, 52, 0, AM.TAU);
      ctx.fill();
      ctx.stroke();
      ctx.font = "900 34px 'Inter', sans-serif";
      ctx.fillStyle = C.MI;
      ctx.textAlign = "center";
      ctx.fillText("PERCIKAN KECIL DI BUMI", 0, -115);
      ctx.restore();

      // Center Equality Badge at 24.5s ("ternyata berhubungan")
      if (t >= 23.80) {
        const [eqS, eqK] = AM.pop(t, 23.80, 2.8, 0.36, 0.16);
        ctx.save();
        ctx.translate(540, 945);
        ctx.scale(eqS / (1 + eqK), eqS * (1 + eqK));
        ctx.fillStyle = C.SU;
        AM.roundRect(ctx, -350, -68, 700, 136, 68);
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 38px 'Inter', sans-serif";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("TERNYATA BERHUBUNGAN!", 0, -14);
        ctx.font = "900 25px 'JetBrains Mono', monospace";
        ctx.fillStyle = C.U;
        ctx.fillText("PETIR LANGIT === LISTRIK BUMI", 0, 28);
        ctx.restore();
      }
    }

    ctx.restore();

    // Shape wipes between Acts and at end of Scene 3
    AM.drawShapeWipe(ctx, t, tFranklinCut - 0.35, 0.65, [C.SU, C.CO, C.U], 540, 960);
    AM.drawShapeWipe(ctx, t, dur - 0.68, 0.68, [C.MI, C.SU, C.INK], 540, 960);
  });
})();
