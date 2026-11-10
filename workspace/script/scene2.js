/**
 * Scene 2: Rahasia Alam — Listrik Statis & Batu Ambar Yunani Kuno (Thales 600 SM)
 * Style: /mg-flat-vector (01-flat-vector Popwise Palette, Camera Zoom, Character Rig & Shape Wipe)
 * Audio Sync: workspace/audio/scene2_rahasia_alam.words.json (21.80s)
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

  // Paper bits for Act I (Modern static electricity experiment on desk)
  const PAPER_BITS = [
    { x0: 660, y0: 1120, dx: -42, dy: -165, rot: -25, col: C.CR, w: 38, h: 24, delay: 0.00 },
    { x0: 725, y0: 1132, dx: -12, dy: -182, rot: 18, col: C.MI, w: 34, h: 22, delay: 0.06 },
    { x0: 790, y0: 1124, dx: 20, dy: -174, rot: -36, col: C.SU, w: 40, h: 26, delay: 0.12 },
    { x0: 855, y0: 1135, dx: 48, dy: -158, rot: 28, col: C.CO, w: 36, h: 22, delay: 0.18 },
    { x0: 695, y0: 1144, dx: -24, dy: -145, rot: 42, col: C.CR, w: 32, h: 20, delay: 0.24 },
    { x0: 820, y0: 1146, dx: 34, dy: -142, rot: -18, col: C.MI, w: 32, h: 20, delay: 0.29 },
  ];

  // Feathers & dried leaves for Act II (600 BCE Thales Amber Stone experiment)
  const ANCIENT_BITS = [
    { x0: 650, y0: 1125, col: C.MI, w: 46, h: 22, delay: 0.00 },
    { x0: 720, y0: 1135, col: C.CR, w: 48, h: 20, delay: 0.08 },
    { x0: 790, y0: 1128, col: C.CO, w: 44, h: 22, delay: 0.15 },
    { x0: 855, y0: 1138, col: C.SU, w: 42, h: 18, delay: 0.22 },
    { x0: 755, y0: 1148, col: C.CR, w: 40, h: 20, delay: 0.28 },
  ];

  AM.registerScene("scene2_rahasia_alam", function (ctx, t, dur) {
    // Exact spoken word cues from workspace/audio/scene2_rahasia_alam.words.json:
    // 1.04s: "gosokkan" | 1.88s: "rambutmu..."
    // 3.02s: "dekatkan" | 4.66s: "kertas" | 5.74s: "Kertas itu bergerak"
    // 7.02s: "Ini bukan sihir."
    // 8.12s: "Ribuan tahun lalu..." | 10.94s: "Orang Yunani kuno" | 13.00s: "batu ambar yang digosok"
    // 14.44s: "menarik benda-benda ringan" | 17.20s: "melihat salah satu rahasia terbesar alam semesta"

    const tRubStart = 0.85;
    const tLowerRod = 2.95;
    const tPaperLeap = 5.74;
    const tNotMagic = 7.02;
    const tGreeceCut = 8.12;
    const tAmberRub = 12.90;
    const tAmberPull = 14.44;
    const tCosmicZoom = 17.20;

    // Camera choreography across the 3 acts
    const zoomPaper = AM.E.ioC(AM.inv(5.35, 6.15, t)) * (1 - AM.E.ioC(AM.inv(7.55, 8.12, t)));
    const zoomAmber = AM.E.ioC(AM.inv(16.30, 17.30, t)) * (1 - AM.E.ioC(AM.inv(17.30, 18.00, t)));
    const camS = 1.0 + zoomPaper * 0.28 + zoomAmber * 0.42;
    const camCx = AM.lerp(AM.lerp(540, 680, zoomPaper), 660, zoomAmber);
    const camCy = AM.lerp(AM.lerp(960, 980, zoomPaper), 890, zoomAmber);

    ctx.save();
    AM.applyCamera(ctx, { s: camS, cx: camCx, cy: camCy });

    if (t < tGreeceCut) {
      // =======================================================================
      // ACT I (0.00s - 8.12s): Modern Static Electricity Experiment
      // =======================================================================
      ctx.fillStyle = C.U;
      ctx.fillRect(-600, -600, 2280, 3120);

      // Tone-on-tone geometric studio circles
      ctx.fillStyle = C.UD;
      ctx.beginPath();
      ctx.arc(820, 560, 250, 0, AM.TAU);
      ctx.fill();
      ctx.strokeStyle = C.UL;
      ctx.lineWidth = 24;
      ctx.beginPath();
      ctx.arc(210, 520, 115, 0, AM.TAU);
      ctx.stroke();

      // Floor & Experiment Workbench
      ctx.fillStyle = C.UD;
      ctx.fillRect(-400, 1220, 1880, 900);
      ctx.fillStyle = C.CR;
      AM.roundRect(ctx, 480, 1145, 510, 42, 20);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.INK;
      ctx.stroke();
      ctx.fillStyle = C.CRD;
      AM.roundRect(ctx, 535, 1187, 44, 240, 12);
      ctx.fill();
      ctx.stroke();
      AM.roundRect(ctx, 895, 1187, 44, 240, 12);
      ctx.fill();
      ctx.stroke();

      // Character arm kinematics (in degrees):
      // Phase 1 (0.85..2.95s): Right arm lifted up to hair, rubbing vigorously back & forth
      // Phase 2 (2.95..8.12s): Right arm lowered toward paper bits on the workbench
      const isRubbing = t >= tRubStart && t < tLowerRod;
      const rubOsc = isRubbing ? Math.sin((t - tRubStart) * 24) : 0;
      const raiseIn = AM.E.ioC(AM.inv(0.35, 0.95, t));
      const lowerU = AM.E.ioC(AM.inv(tLowerRod, tLowerRod + 0.85, t));
      const isCharged = t >= 1.15;

      const rShRub = -138 + rubOsc * 16;
      const rFoRub = -58 + rubOsc * 22;
      const rShHold = -62 + Math.sin(t * 4) * 3;
      const rFoHold = -18 + Math.cos(t * 4) * 3;

      const rightSh = AM.lerp(-18, AM.lerp(rShRub, rShHold, lowerU), raiseIn);
      const rightFo = AM.lerp(75, AM.lerp(rFoRub, rFoHold, lowerU), raiseIn);

      const charX = 330;
      const charY = 1130;

      AM.drawCharacterRig(ctx, t, {
        x: charX,
        y: charY,
        scale: 1.08,
        coatColor: C.CO,
        coatShade: C.COD,
        hairStyle: "short",
        glasses: true,
        expression: t >= tPaperLeap ? "surprised" : isRubbing ? "shocked" : "smile",
        headTilt: isRubbing ? rubOsc * 6 : t >= tLowerRod ? 10 : 2,
        leftSh: 22,
        leftFo: -78,
        rightSh,
        rightFo,
        onRightHand: function (hCtx) {
          // Golden Static Wand held in protagonist's right hand
          hCtx.save();
          hCtx.rotate(-0.45);
          hCtx.fillStyle = C.SU;
          AM.roundRect(hCtx, -14, -16, 185, 32, 16);
          hCtx.fill();
          hCtx.lineWidth = 5;
          hCtx.strokeStyle = C.INK;
          hCtx.stroke();

          hCtx.fillStyle = C.CO;
          AM.roundRect(hCtx, -14, -16, 52, 32, 14);
          hCtx.fill();
          hCtx.stroke();

          if (isCharged) {
            const pulse = 1 + 0.16 * Math.sin(t * 18);
            hCtx.fillStyle = "rgba(255, 198, 43, 0.34)";
            hCtx.beginPath();
            hCtx.arc(155, 0, 42 * pulse, 0, AM.TAU);
            hCtx.fill();
          }
          hCtx.restore();
        },
      });

      // Sparks & standing hair during "gosokkan benda ini ke rambutmu" (1.04s - 2.95s)
      if (t >= 1.00 && t < 3.15) {
        AM.drawBurstLines(ctx, charX + 10, charY - 365, 10, 35, 130, t, 1.04, 0.55, C.SU, 6);
        AM.drawShockRing(ctx, charX + 10, charY - 365, t, 1.04, 24, 150, 12, 0.65, C.MI);
      }

      // World tip of the charged wand when lowered over the workbench
      const wandTipX = AM.lerp(charX + 85, 745, lowerU);
      const wandTipY = AM.lerp(charY - 340, 945, lowerU);

      // Paper bits on workbench leaping onto the wand at 5.74s ("Kertas itu bergerak")
      const [paperIn] = AM.pop(t, 2.75, 2.5, 0.4, 0.14);
      if (paperIn > 0.01) {
        PAPER_BITS.forEach((bit, idx) => {
          const liftU = AM.E.pop(AM.inv(tPaperLeap + bit.delay, tPaperLeap + 0.52 + bit.delay, t));
          const hoverY = t >= tPaperLeap + bit.delay ? Math.sin(t * 12 + idx * 1.7) * 8 : 0;
          const pos = AM.arcP(
            { x: bit.x0, y: bit.y0 },
            { x: wandTipX + bit.dx * 0.65, y: wandTipY + 28 + (idx % 3) * 16 + hoverY },
            65,
            AM.clamp(liftU, 0, 1.15)
          );

          if (t >= tPaperLeap - 0.05 + bit.delay) {
            ctx.save();
            ctx.strokeStyle = idx % 2 === 0 ? C.SU : C.MI;
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(wandTipX, wandTipY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            ctx.restore();
          }

          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.rotate(((bit.rot + liftU * 65) * Math.PI) / 180);
          ctx.scale(paperIn, paperIn);
          ctx.fillStyle = bit.col;
          AM.roundRect(ctx, -bit.w / 2, -bit.h / 2, bit.w, bit.h, 6);
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = C.INK;
          ctx.stroke();
          ctx.restore();
        });
      }

      // Shockring & electric arcs when paper leaps at 5.74s
      AM.drawShockRing(ctx, wandTipX, wandTipY + 25, t, tPaperLeap, 20, 180, 14, 0.65, C.MI);
      AM.drawBurstLines(ctx, wandTipX, wandTipY + 20, 10, 28, 135, t, tPaperLeap, 0.55, C.SU, 6);
      if (t >= tPaperLeap && t < tPaperLeap + 0.9) {
        AM.drawElectricBolt(ctx, wandTipX, wandTipY, 755, 1115, 7, 18, Math.floor(t * 24), C.SU, 5);
      }

      // Cue Callout 1: "1. GOSOKKAN KE RAMBUTMU" (1.04s)
      if (t >= 1.04) {
        const [c1S, c1K] = AM.pop(t, 1.04, 2.6, 0.4, 0.14);
        ctx.save();
        ctx.translate(540, 360);
        ctx.scale(c1S / (1 + c1K), c1S * (1 + c1K));
        ctx.fillStyle = C.SU;
        AM.roundRect(ctx, -380, -54, 760, 108, 28);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 34px 'Inter', sans-serif";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("1. GOSOKKAN KE RAMBUTMU", 0, -12);
        ctx.font = "700 22px 'JetBrains Mono', monospace";
        ctx.fillText("elektron berpindah → muatan statis (-)", 0, 26);
        ctx.restore();
      }

      // Cue Callout 2: "KERTAS ITU BERGERAK!" (5.74s)
      if (t >= tPaperLeap) {
        const [c2S, c2K] = AM.pop(t, tPaperLeap, 2.7, 0.38, 0.15);
        ctx.save();
        ctx.translate(540, 500);
        ctx.scale(c2S / (1 + c2K), c2S * (1 + c2K));
        ctx.fillStyle = C.CO;
        AM.roundRect(ctx, -380, -54, 760, 108, 28);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 34px 'Inter', sans-serif";
        ctx.fillStyle = C.CR;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("2. KERTAS MELOMPAT NAIK!", 0, -12);
        ctx.font = "700 21px 'JetBrains Mono', monospace";
        ctx.fillText("gaya tarik elektrostatik melawan gravitasi", 0, 26);
        ctx.restore();
      }

      // Cue Callout 3: "INI BUKAN SIHIR." (7.02s)
      if (t >= tNotMagic) {
        const [c3S, c3K] = AM.pop(t, tNotMagic, 2.8, 0.36, 0.16);
        ctx.save();
        ctx.translate(540, 1340);
        ctx.scale(c3S / (1 + c3K), c3S * (1 + c3K));
        ctx.fillStyle = C.MI;
        AM.roundRect(ctx, -410, -48, 820, 96, 48);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 34px 'Inter', sans-serif";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("INI BUKAN SIHIR — INI FISIKA ALAM!", 0, 2);
        ctx.restore();
      }
    } else if (t < tCosmicZoom) {
      // =======================================================================
      // ACT II (8.12s - 17.20s): 600 BCE Ancient Greece — Thales & Amber Stone
      // =======================================================================
      ctx.fillStyle = C.CR;
      ctx.fillRect(-600, -600, 2280, 3120);

      // Warm Mediterranean Sun
      ctx.fillStyle = C.SU;
      ctx.beginPath();
      ctx.arc(820, 540, 195, 0, AM.TAU);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.INK;
      ctx.stroke();

      // Classical Ionic Marble Columns on Left & Right edges
      [95, 985].forEach((colX) => {
        ctx.fillStyle = C.CRD;
        AM.roundRect(ctx, colX - 42, 310, 84, 910, 14);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.fillStyle = C.SU;
        AM.roundRect(ctx, colX - 58, 285, 116, 34, 10);
        ctx.fill();
        ctx.stroke();
      });

      // Floor & Pedestal
      ctx.fillStyle = C.INK;
      ctx.fillRect(-400, 1220, 1880, 900);
      ctx.fillStyle = C.U;
      AM.roundRect(ctx, 560, 1140, 390, 42, 16);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.INK;
      ctx.stroke();
      ctx.fillStyle = C.CRD;
      AM.roundRect(ctx, 610, 1182, 290, 90, 12);
      ctx.fill();
      ctx.stroke();

      // Articulated Thales of Miletus Character Rig (10.94s "Orang Yunani kuno", 13.00s "batu ambar yang digosok")
      const isRubbingAmber = t >= tAmberRub && t < tAmberPull;
      const rubOsc = isRubbingAmber ? Math.sin((t - tAmberRub) * 26) : 0;
      const thalesX = 335;
      const thalesY = 1135;

      AM.drawCharacterRig(ctx, t - tGreeceCut, {
        x: thalesX,
        y: thalesY,
        scale: 1.08,
        coatColor: C.U,
        coatShade: C.UD,
        hairStyle: "beard",
        glasses: false,
        expression: t >= tAmberPull ? "surprised" : isRubbingAmber ? "shocked" : "smile",
        headTilt: t >= 11.66 ? 10 : 3,
        leftSh: isRubbingAmber ? -45 - rubOsc * 14 : 20,
        leftFo: isRubbingAmber ? -65 - rubOsc * 18 : -75,
        rightSh: -68 + rubOsc * 16,
        rightFo: -24 + rubOsc * 22,
        onRightHand: function (rCtx) {
          // Glowing Golden Amber Stone (ELEKTRON / ἤλεκτρον) in Thales' right hand
          rCtx.save();
          const pulse = t >= tAmberRub ? 1 + 0.12 * Math.sin(t * 15) : 1;
          rCtx.scale(pulse, pulse);

          if (t >= tAmberRub) {
            rCtx.fillStyle = "rgba(255, 198, 43, 0.38)";
            rCtx.beginPath();
            rCtx.arc(28, 0, 62, 0, AM.TAU);
            rCtx.fill();
          }

          rCtx.fillStyle = C.SU;
          rCtx.strokeStyle = C.INK;
          rCtx.lineWidth = 5;
          rCtx.beginPath();
          rCtx.moveTo(-8, -28);
          rCtx.lineTo(42, -36);
          rCtx.lineTo(74, -8);
          rCtx.lineTo(60, 30);
          rCtx.lineTo(8, 34);
          rCtx.lineTo(-18, 6);
          rCtx.closePath();
          rCtx.fill();
          rCtx.stroke();

          rCtx.fillStyle = C.CO;
          rCtx.beginPath();
          rCtx.arc(28, 2, 15, 0, AM.TAU);
          rCtx.fill();
          rCtx.restore();
        },
      });

      const amberX = 640;
      const amberY = 935;

      // Electrostatic bursts when rubbing amber at 13.00s
      AM.drawShockRing(ctx, amberX, amberY, t, tAmberRub, 25, 195, 14, 0.75, C.SU);
      AM.drawBurstLines(ctx, amberX, amberY, 12, 38, 145, t, tAmberRub, 0.65, C.CO, 6);

      // Feathers & dried leaves leaping onto the Amber Stone at 14.44s ("menarik benda-benda ringan")
      ANCIENT_BITS.forEach((item, idx) => {
        const u = AM.E.pop(AM.inv(tAmberPull + item.delay, tAmberPull + 0.55 + item.delay, t));
        const floatY = t >= tAmberPull + item.delay ? Math.sin(t * 10 + idx) * 7 : 0;
        const pos = AM.arcP(
          { x: item.x0, y: item.y0 },
          { x: amberX + (idx - 2) * 28, y: amberY + 26 + (idx % 2) * 18 + floatY },
          80,
          AM.clamp(u, 0, 1.12)
        );

        if (t >= tAmberPull + item.delay) {
          ctx.save();
          ctx.strokeStyle = C.U;
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(amberX, amberY);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(((idx * 25 + u * 50) * Math.PI) / 180);
        ctx.fillStyle = item.col;
        AM.roundRect(ctx, -item.w / 2, -item.h / 2, item.w, item.h, 10);
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.restore();
      });

      // Etymology Card at 13.00s ("batu ambar yang digosok")
      if (t >= tAmberRub) {
        const [etS, etK] = AM.pop(t, tAmberRub, 2.6, 0.38, 0.14);
        ctx.save();
        ctx.translate(540, 410);
        ctx.scale(etS / (1 + etK), etS * (1 + etK));
        ctx.fillStyle = C.U;
        AM.roundRect(ctx, -410, -82, 820, 164, 30);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();

        ctx.font = "900 36px 'Inter', sans-serif";
        ctx.fillStyle = C.SU;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText('BATU AMBAR = "ELEKTRON"', 0, -34);

        ctx.font = "700 24px 'Inter', sans-serif";
        ctx.fillStyle = C.CR;
        ctx.fillText("Bahasa Yunani Kuno: ἤλεκτρον (ēlektron)", 0, 8);

        ctx.font = "800 22px 'JetBrains Mono', monospace";
        ctx.fillStyle = C.MI;
        ctx.fillText('Asal-usul kata "ELECTRICITY" & "ELEKTRON"', 0, 48);
        ctx.restore();
      }
    } else {
      // =======================================================================
      // ACT III (17.20s - 21.80s): Subatomic Secret of the Universe (Orbiting Electrons)
      // =======================================================================
      ctx.fillStyle = C.INK;
      ctx.fillRect(-600, -600, 2280, 3120);

      const cx = 540;
      const cy = 890;
      const [atomS] = AM.pop(t, tCosmicZoom, 2.3, 0.4, 0.12);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(atomS, atomS);

      AM.drawShockRing(ctx, 0, 0, t, tCosmicZoom + 0.1, 60, 420, 14, 1.2, C.U);

      // 3 Elliptical Electron Orbits
      [0, 60, 120].forEach((deg, idx) => {
        ctx.save();
        ctx.rotate((deg * Math.PI) / 180);
        ctx.strokeStyle = idx === 0 ? C.MI : idx === 1 ? C.SU : C.CO;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.ellipse(0, 0, 340, 125, 0, 0, AM.TAU);
        ctx.stroke();

        const ang = t * (3.8 + idx * 0.6) + idx * 2.1;
        const ex = Math.cos(ang) * 340;
        const ey = Math.sin(ang) * 125;

        ctx.fillStyle = idx === 0 ? C.MI : C.CO;
        ctx.strokeStyle = C.INK;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(ex, ey, 26, 0, AM.TAU);
        ctx.fill();
        ctx.stroke();

        ctx.font = "900 20px 'JetBrains Mono', monospace";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("e-", ex, ey);
        ctx.restore();
      });

      // Glowing Atomic Nucleus
      const nucPulse = 1 + 0.08 * Math.sin(t * 10);
      ctx.scale(nucPulse, nucPulse);
      ctx.fillStyle = C.SU;
      ctx.strokeStyle = C.CR;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 68, 0, AM.TAU);
      ctx.fill();
      ctx.stroke();
      ctx.font = "900 54px 'Inter', sans-serif";
      ctx.fillStyle = C.INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", 0, 2);
      ctx.restore();

      // Cosmic Banner at 18.56s ("rahasia terbesar alam semesta")
      if (t >= 18.30) {
        const [secS, secK] = AM.pop(t, 18.30, 2.6, 0.38, 0.14);
        ctx.save();
        ctx.translate(540, 400);
        ctx.scale(secS / (1 + secK), secS * (1 + secK));
        ctx.fillStyle = C.SU;
        AM.roundRect(ctx, -430, -56, 860, 112, 32);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 33px 'Inter', sans-serif";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("RAHASIA TERBESAR ALAM SEMESTA", 0, -12);
        ctx.font = "800 22px 'JetBrains Mono', monospace";
        ctx.fillText("PERGERAKAN ELEKTRON DI DALAM MATERI", 0, 26);
        ctx.restore();
      }
    }

    ctx.restore();

    // Shape wipe transitions between Acts and at end of Scene 2
    AM.drawShapeWipe(ctx, t, tGreeceCut - 0.35, 0.65, [C.SU, C.CO, C.CR], 540, 960);
    AM.drawShapeWipe(ctx, t, dur - 0.68, 0.68, [C.INK, C.U, C.SU], 540, 890);
  });
})();
