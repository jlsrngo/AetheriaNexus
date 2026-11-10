/**
 * Scene 4: Menjinakkan Listrik — Alessandro Volta & Baterai Pertama (1800)
 * Style: /mg-flat-vector (01-flat-vector Popwise Palette, Camera Zoom, Character Rig & Shape Wipe)
 * Audio Sync: workspace/audio/scene4_volta_baterai.words.json (18.47s)
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

  // Voltaic Pile alternating discs: Copper (Cu), Electrolyte Brine Felt, Zinc (Zn)
  const VOLTA_LAYERS = [
    { label: "Cu · TEMBAGA (+)", col: C.CO, t0: 6.45 },
    { label: "ELEKTROLIT GARAM", col: C.MI, t0: 6.68 },
    { label: "Zn · SENG (-)", col: C.SU, t0: 6.90 },
    { label: "Cu · TEMBAGA (+)", col: C.CO, t0: 7.12 },
    { label: "ELEKTROLIT GARAM", col: C.MI, t0: 7.34 },
    { label: "Zn · SENG (-)", col: C.SU, t0: 7.56 },
    { label: "Cu · TEMBAGA (+)", col: C.CO, t0: 7.78 },
    { label: "ELEKTROLIT GARAM", col: C.MI, t0: 8.00 },
    { label: "Zn · SENG (-)", col: C.SU, t0: 8.22 },
  ];

  AM.registerScene("scene4_volta_baterai", function (ctx, t, dur) {
    // Word cues from workspace/audio/scene4_volta_baterai.words.json:
    // 0.00 - 1.98s: "Tapi memahami listrik saja tidak cukup."
    // 1.96 - 5.18s: "Kamu tidak bisa menunggu petir setiap kali membutuhkan energi."
    // 5.84s: "1800", 6.26s: "Alessandro Volta"
    // 7.58s: "baterai listrik pertama"
    // 9.32s: "menghasilkan arus listrik secara terus-menerus."
    // 15.10s: "menghasilkan listrik tanpa harus menunggu langit mengamuk."

    const tWaitBolt = 2.62;
    const tVoltaCut = 5.20;
    const tContinuousFlow = 8.75;
    const tNoStormNeeded = 14.50;

    // Camera zoom onto the Voltaic Pile as discs stack between 6.3s and 9.3s
    const zoomPile = AM.E.ioC(AM.inv(6.25, 7.05, t)) * (1 - AM.E.ioC(AM.inv(8.65, 9.45, t)));

    ctx.save();
    AM.applyCamera(ctx, {
      s: 1.0 + zoomPile * 0.24,
      cx: AM.lerp(540, 620, zoomPile),
      cy: AM.lerp(960, 880, zoomPile),
    });

    if (t < tVoltaCut) {
      // =======================================================================
      // ACT I (0.00s - 5.20s): Waiting for Lightning is Impossible!
      // =======================================================================
      ctx.fillStyle = C.INK;
      ctx.fillRect(-600, -600, 2280, 3120);

      ctx.fillStyle = "#1E1D46";
      ctx.beginPath();
      ctx.arc(740, 680, 290, 0, AM.TAU);
      ctx.fill();

      ctx.fillStyle = C.UD;
      ctx.fillRect(-400, 1230, 1880, 900);

      // Protagonist on left holding an unlit power plug, shrugging at the sky
      const shrug = AM.E.ioC(AM.inv(1.90, 2.70, t));
      AM.drawCharacterRig(ctx, t, {
        x: 310,
        y: 1140,
        scale: 1.08,
        coatColor: C.CO,
        coatShade: C.COD,
        hairStyle: "short",
        glasses: true,
        expression: t >= tWaitBolt ? "surprised" : "smile",
        headTilt: -10 * shrug,
        leftSh: AM.lerp(18, -55, shrug),
        leftFo: AM.lerp(-78, -35, shrug),
        rightSh: AM.lerp(-18, -68, shrug),
        rightFo: AM.lerp(78, -20, shrug),
        onRightHand: function (rCtx) {
          // Two-prong electric plug held in right hand
          rCtx.save();
          rCtx.rotate(-0.3);
          rCtx.fillStyle = C.CR;
          AM.roundRect(rCtx, -10, -24, 68, 48, 12);
          rCtx.fill();
          rCtx.lineWidth = 5;
          rCtx.strokeStyle = C.INK;
          rCtx.stroke();
          rCtx.fillStyle = C.SU;
          AM.roundRect(rCtx, 58, -15, 26, 9, 4);
          rCtx.fill();
          rCtx.stroke();
          AM.roundRect(rCtx, 58, 6, 26, 9, 4);
          rCtx.fill();
          rCtx.stroke();
          rCtx.restore();
        },
      });

      // Right side: Giant Flat-Vector Stopwatch + Sleeping Cloud ("menunggu petir" 2.62s)
      const [clkS, clkK] = AM.pop(t, 0.40, 2.4, 0.4, 0.14);
      ctx.save();
      ctx.translate(750, 760);
      ctx.scale(clkS / (1 + clkK), clkS * (1 + clkK));

      ctx.fillStyle = C.U;
      AM.roundRect(ctx, -200, -250, 400, 96, 48);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.INK;
      ctx.stroke();
      ctx.font = "900 26px 'Inter', sans-serif";
      ctx.fillStyle = C.CR;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PETIR = ACAK & SESAAT", 0, -202);

      // Stopwatch face
      ctx.fillStyle = C.CR;
      ctx.beginPath();
      ctx.arc(0, 20, 145, 0, AM.TAU);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = C.INK;
      ctx.stroke();

      const handAng = t * 6.5 - Math.PI / 2;
      ctx.strokeStyle = C.CO;
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.lineTo(Math.cos(handAng) * 105, 20 + Math.sin(handAng) * 105);
      ctx.stroke();

      // Red Cross-Out Stamp at 2.62s ("tidak bisa menunggu petir")
      if (t >= tWaitBolt) {
        const [xS] = AM.pop(t, tWaitBolt, 3.0, 0.35, 0.18);
        ctx.save();
        ctx.translate(0, 20);
        ctx.scale(xS, xS);
        ctx.strokeStyle = C.CO;
        ctx.lineWidth = 22;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-110, -110);
        ctx.lineTo(110, 110);
        ctx.moveTo(110, -110);
        ctx.lineTo(-110, 110);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Bottom Callout Banner
      if (t >= 1.38) {
        const [bS, bK] = AM.pop(t, 1.38, 2.6, 0.38, 0.14);
        ctx.save();
        ctx.translate(540, 1345);
        ctx.scale(bS / (1 + bK), bS * (1 + bK));
        ctx.fillStyle = C.CO;
        AM.roundRect(ctx, -440, -54, 880, 108, 30);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 30px 'Inter', sans-serif";
        ctx.fillStyle = C.CR;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("TIDAK MUNGKIN MENUNGGU PETIR", 0, -12);
        ctx.font = "700 22px 'Inter', sans-serif";
        ctx.fillStyle = C.SU;
        ctx.fillText("Manusia butuh sumber arus listrik yang stabil!", 0, 24);
        ctx.restore();
      }
    } else {
      // =======================================================================
      // ACT II (5.20s - 18.47s): 1800 Alessandro Volta & The Voltaic Pile
      // =======================================================================
      ctx.fillStyle = C.U;
      ctx.fillRect(-600, -600, 2280, 3120);

      // Cream Arch Backdrop behind Voltaic Pile
      ctx.fillStyle = C.CR;
      AM.roundRect(ctx, 455, 510, 530, 680, 44);
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = C.INK;
      ctx.stroke();

      // Floor & Lab Pedestal
      ctx.fillStyle = C.UD;
      ctx.fillRect(-400, 1230, 1880, 900);
      ctx.fillStyle = C.SU;
      AM.roundRect(ctx, 430, 1175, 580, 55, 22);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.INK;
      ctx.stroke();

      // Articulated Alessandro Volta Character Rig on Left (6.26s "Alessandro Volta")
      const gesture = Math.sin(t * 4.5) * 10;
      AM.drawCharacterRig(ctx, t - tVoltaCut, {
        x: 245,
        y: 1145,
        scale: 1.04,
        coatColor: C.MI,
        coatShade: C.MID,
        hairStyle: "curly",
        glasses: false,
        expression: t >= tContinuousFlow ? "surprised" : "smile",
        headTilt: 8,
        leftSh: 18,
        leftFo: -70,
        rightSh: -65 + gesture,
        rightFo: -25 + gesture,
        onRightHand: function (rCtx) {
          // Volta holds a Copper (Cu) disc in his right hand
          rCtx.fillStyle = C.CO;
          rCtx.strokeStyle = C.INK;
          rCtx.lineWidth = 5;
          rCtx.beginPath();
          rCtx.ellipse(24, -6, 34, 14, -0.2, 0, AM.TAU);
          rCtx.fill();
          rCtx.stroke();
        },
      });

      // Voltaic Pile Support Rods & Stacking Discs (x = 720, baseY = 1135)
      const pileX = 720;
      const baseY = 1135;
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(pileX - 150, baseY + 20);
      ctx.lineTo(pileX - 150, 690);
      ctx.moveTo(pileX + 150, baseY + 20);
      ctx.lineTo(pileX + 150, 690);
      ctx.stroke();

      ctx.fillStyle = C.INK;
      AM.roundRect(ctx, pileX - 180, baseY, 360, 40, 14);
      ctx.fill();

      const discH = 42;
      VOLTA_LAYERS.forEach((layer, idx) => {
        if (t < layer.t0) return;
        const [s, k] = AM.pop(t, layer.t0, 2.9, 0.36, 0.16);
        const dropY = (1 - AM.E.outC(AM.inv(layer.t0, layer.t0 + 0.25, t))) * -130;
        const y = baseY - (idx + 1) * discH + dropY;

        ctx.save();
        ctx.translate(pileX, y + discH / 2);
        ctx.scale(s / (1 + k * 0.8), s * (1 + k * 0.8));
        ctx.fillStyle = layer.col;
        AM.roundRect(ctx, -132, -discH / 2 + 2, 264, discH - 4, 14);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = C.INK;
        ctx.stroke();

        ctx.font = "900 17px 'JetBrains Mono', monospace";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(layer.label, 0, 1);
        ctx.restore();
      });

      // At 8.75s ("menghasilkan arus listrik secara terus-menerus"):
      // Continuous DC Circuit & Glowing Lamp above the Voltaic Pile!
      if (t >= tContinuousFlow) {
        const [lampS] = AM.pop(t, tContinuousFlow, 2.5, 0.4, 0.14);
        const lampX = 720;
        const lampY = 415;

        // Copper wires from top (-) and bottom (+) of pile to overhead lamp
        ctx.save();
        ctx.strokeStyle = C.SU;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(pileX, 755);
        ctx.lineTo(pileX - 210, 755);
        ctx.lineTo(pileX - 210, lampY);
        ctx.lineTo(lampX - 55, lampY);
        ctx.moveTo(pileX + 135, baseY - 20);
        ctx.lineTo(pileX + 210, baseY - 20);
        ctx.lineTo(pileX + 210, lampY);
        ctx.lineTo(lampX + 55, lampY);
        ctx.stroke();

        // Flowing electron dots along wire loop
        for (let i = 0; i < 6; i++) {
          const u = (t * 0.8 + i / 6) % 1;
          const ey = AM.lerp(755, lampY, u);
          ctx.fillStyle = C.MI;
          ctx.strokeStyle = C.INK;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(pileX - 210, ey, 13, 0, AM.TAU);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(pileX + 210, AM.lerp(lampY, baseY - 20, u), 13, 0, AM.TAU);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();

        // Glowing Lamp
        ctx.save();
        ctx.translate(lampX, lampY);
        ctx.scale(lampS, lampS);
        ctx.fillStyle = "rgba(255, 198, 43, 0.34)";
        ctx.beginPath();
        ctx.arc(0, 0, 110 * (1 + 0.08 * Math.sin(t * 14)), 0, AM.TAU);
        ctx.fill();
        AM.drawBurstLines(ctx, 0, 0, 12, 62, 135, t, tContinuousFlow, 0.8, C.SU, 6);
        ctx.fillStyle = C.SU;
        ctx.strokeStyle = C.INK;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 52, 0, AM.TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Bottom Punchline Banner at 14.50s ("tanpa harus menunggu langit mengamuk")
      if (t >= tNoStormNeeded) {
        const [fS, fK] = AM.pop(t, tNoStormNeeded, 2.7, 0.38, 0.15);
        ctx.save();
        ctx.translate(540, 1355);
        ctx.scale(fS / (1 + fK), fS * (1 + fK));
        ctx.fillStyle = C.MI;
        AM.roundRect(ctx, -450, -56, 900, 112, 32);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 31px 'Inter', sans-serif";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("ARUS LISTRIK STABIL PERTAMA DI DUNIA!", 0, -14);
        ctx.font = "700 22px 'Inter', sans-serif";
        ctx.fillText("Tanpa harus menunggu badai & langit mengamuk", 0, 24);
        ctx.restore();
      }
    }

    ctx.restore();

    // Shape wipes between Acts and at end of Scene 4
    AM.drawShapeWipe(ctx, t, tVoltaCut - 0.35, 0.65, [C.CO, C.SU, C.U], 540, 960);
    AM.drawShapeWipe(ctx, t, dur - 0.68, 0.68, [C.SU, C.MI, C.INK], 540, 960);
  });
})();
