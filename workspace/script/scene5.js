/**
 * Scene 5: Michael Faraday — Induksi Elektromagnetik & Generator Modern (1831)
 * Style: /mg-flat-vector (01-flat-vector Popwise Palette, Camera Zoom, Character Rig & Shape Wipe)
 * Audio Sync: workspace/audio/scene5_faraday_generator.words.json (15.67s)
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

  AM.registerScene("scene5_faraday_generator", function (ctx, t, dur) {
    // Word cues from workspace/audio/scene5_faraday_generator.words.json:
    // 0.56s: "Michael Faraday"
    // 2.60s: "mengubah energi gerak menjadi listrik"
    // 4.26s: "melalui induksi elektromagnetik."
    // 8.24s: "generator listrik modern."
    // 10.30s: "Sedikit demi sedikit, sesuatu yang dahulu hanya terlihat dalam petir (12.90s) mulai bisa dikendalikan manusia (14.06s)."

    const tMotionToElec = 2.00;
    const tInduction = 4.26;
    const tGenerator = 7.40;
    const tTamedWave = 10.50;

    // Camera zoom onto the spinning Turbine Generator at 7.4s - 10.3s
    const zoomGen = AM.E.ioC(AM.inv(7.30, 8.10, t)) * (1 - AM.E.ioC(AM.inv(9.80, 10.50, t)));

    ctx.save();
    AM.applyCamera(ctx, {
      s: 1.0 + zoomGen * 0.26,
      cx: AM.lerp(540, 680, zoomGen),
      cy: AM.lerp(960, 660, zoomGen),
    });

    if (t < tTamedWave) {
      // =======================================================================
      // ACT I & II (0.00s - 10.50s): Faraday Thrusting N/S Magnet into Solenoid + Generator
      // =======================================================================
      ctx.fillStyle = C.INK;
      ctx.fillRect(-600, -600, 2280, 3120);

      // Royal Institution laboratory circle backdrop
      ctx.fillStyle = C.UD;
      ctx.beginPath();
      ctx.arc(620, 840, 360, 0, AM.TAU);
      ctx.fill();

      // Floor & Workbench
      ctx.fillStyle = "#0D0C24";
      ctx.fillRect(-400, 1230, 1880, 900);
      ctx.fillStyle = C.CR;
      AM.roundRect(ctx, 430, 1135, 580, 44, 20);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.INK;
      ctx.stroke();

      // Oscillating thrust motion of Faraday's arm pushing N/S Bar Magnet into Solenoid
      const thrustCycle = Math.sin(t * 6.8);
      const thrustVel = Math.cos(t * 6.8);

      // Articulated Michael Faraday Character Rig on Left (0.56s "Michael Faraday")
      AM.drawCharacterRig(ctx, t, {
        x: 240,
        y: 1140,
        scale: 1.04,
        coatColor: C.CO,
        coatShade: C.COD,
        hairStyle: "curly",
        glasses: false,
        expression: t >= tInduction ? "surprised" : "smile",
        headTilt: 8,
        leftSh: 18,
        leftFo: -70,
        rightSh: -65 + thrustCycle * 18,
        rightFo: -24 + thrustCycle * 18,
      });

      // N/S Bar Magnet sliding horizontally into & out of the Copper Solenoid Coil
      const coilX = 740;
      const coilY = 955;
      const magX = 535 + thrustCycle * 95;
      const magY = coilY;

      // Dashed Magnetic Flux Loops around Bar Magnet
      if (t >= tMotionToElec) {
        ctx.save();
        ctx.translate(magX + 30, magY);
        ctx.strokeStyle = t >= tInduction ? C.MI : "rgba(46, 230, 168, 0.45)";
        ctx.lineWidth = t >= tInduction ? 5 : 3;
        ctx.setLineDash([10, 8]);
        [1, 2].forEach((r) => {
          ctx.beginPath();
          ctx.ellipse(0, 0, 130 + r * 42, 58 + r * 34, 0, 0, AM.TAU);
          ctx.stroke();
        });
        ctx.restore();
      }

      // Bar Magnet (South = Ultramarine, North = Coral)
      ctx.save();
      ctx.translate(magX, magY);
      ctx.fillStyle = C.U;
      AM.roundRect(ctx, -115, -32, 115, 64, 12);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.INK;
      ctx.stroke();

      ctx.fillStyle = C.CO;
      AM.roundRect(ctx, 0, -32, 115, 64, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = "900 32px 'Inter', sans-serif";
      ctx.fillStyle = C.CR;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("S", -58, 2);
      ctx.fillText("N", 58, 2);

      if (t >= tMotionToElec) {
        ctx.fillStyle = C.MI;
        AM.roundRect(ctx, -88, -86, 176, 38, 19);
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 20px 'Inter', sans-serif";
        ctx.fillStyle = C.INK;
        ctx.fillText("GERAK ⇄", 0, -66);
      }
      ctx.restore();

      // Copper Solenoid Coil on workbench
      ctx.fillStyle = C.U;
      AM.roundRect(ctx, coilX - 105, coilY + 85, 210, 95, 16);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.INK;
      ctx.stroke();

      for (let i = 0; i < 6; i++) {
        const wx = coilX - 85 + i * 34;
        const glow = Math.abs(thrustVel) > 0.45;
        ctx.fillStyle = glow ? C.SU : C.SUD;
        AM.roundRect(ctx, wx - 13, coilY - 74, 26, 148, 13);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
      }

      // Induction Shockring & Bursts at 4.26s ("melalui induksi elektromagnetik")
      AM.drawShockRing(ctx, coilX, coilY, t, tInduction, 50, 210, 14, 0.85, C.MI);
      AM.drawBurstLines(ctx, coilX, coilY, 10, 70, 165, t, tInduction, 0.65, C.SU, 6);

      // Upper Display Unit (Galvanometer at 0..7.4s -> Modern Turbine Generator at 7.4..10.5s)
      const isGen = t >= tGenerator;
      const [unitS, unitK] = AM.pop(t, isGen ? tGenerator : 0.40, 2.6, 0.38, 0.15);
      const unitX = 690;
      const unitY = 530;

      // Connecting Copper Wires from Solenoid up to Galvanometer / Turbine
      ctx.strokeStyle = C.SU;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(coilX - 45, coilY - 74);
      ctx.lineTo(unitX - 75, unitY + 110);
      ctx.moveTo(coilX + 45, coilY - 74);
      ctx.lineTo(unitX + 75, unitY + 110);
      ctx.stroke();

      ctx.save();
      ctx.translate(unitX, unitY);
      ctx.scale(unitS / (1 + unitK), unitS * (1 + unitK));

      if (!isGen) {
        // Galvanometer Dial swinging with induced EMF (thrustVel)
        ctx.fillStyle = C.CR;
        AM.roundRect(ctx, -210, -145, 420, 270, 32);
        ctx.fill();
        ctx.lineWidth = 7;
        ctx.strokeStyle = C.INK;
        ctx.stroke();

        ctx.fillStyle = C.INK;
        ctx.beginPath();
        ctx.arc(0, 15, 110, Math.PI, AM.TAU);
        ctx.fill();

        const needleAng = -Math.PI / 2 + thrustVel * 0.95;
        ctx.strokeStyle = C.CO;
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(Math.cos(needleAng) * 92, 15 + Math.sin(needleAng) * 92);
        ctx.stroke();

        ctx.fillStyle = C.MI;
        AM.roundRect(ctx, -165, 42, 330, 56, 18);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 24px 'Inter', sans-serif";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("INDUKSI ARUS LISTRIK", 0, 70);
      } else {
        // Spinning Electromagnetic Turbine Rotor (8.24s "generator listrik modern")
        ctx.fillStyle = C.U;
        ctx.strokeStyle = C.INK;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, -10, 145, 0, AM.TAU);
        ctx.fill();
        ctx.stroke();

        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 4);
          ctx.fillStyle = C.SU;
          AM.roundRect(ctx, -20, -140, 40, 30, 8);
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = C.INK;
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(0, -10);
        ctx.rotate(t * 9.5);
        ctx.fillStyle = C.CO;
        AM.roundRect(ctx, -85, -24, 170, 48, 14);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.fillStyle = C.MI;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, AM.TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = C.SU;
        AM.roundRect(ctx, -220, 150, 440, 66, 24);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 25px 'Inter', sans-serif";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("GENERATOR LISTRIK MODERN", 0, 183);
      }
      ctx.restore();

      // Bottom Formula Banner at 4.26s ("induksi elektromagnetik")
      if (t >= tInduction) {
        const [fS, fK] = AM.pop(t, tInduction, 2.7, 0.38, 0.15);
        ctx.save();
        ctx.translate(540, 1355);
        ctx.scale(fS / (1 + fK), fS * (1 + fK));
        ctx.fillStyle = C.SU;
        AM.roundRect(ctx, -440, -54, 880, 108, 30);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 32px 'Inter', sans-serif";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("INDUKSI ELEKTROMAGNETIK FARADAY", 0, -12);
        ctx.font = "800 21px 'JetBrains Mono', monospace";
        ctx.fillText("ENERGI GERAK + MEDAN MAGNET = ARUS LISTRIK", 0, 24);
        ctx.restore();
      }
    } else {
      // =======================================================================
      // ACT III (10.50s - 15.67s): Wild Lightning Tamed into Controlled AC Sine Wave
      // =======================================================================
      ctx.fillStyle = C.U;
      ctx.fillRect(-600, -600, 2280, 3120);

      // Oscilloscope Frame in Center
      ctx.fillStyle = C.INK;
      AM.roundRect(ctx, 80, 420, 920, 820, 40);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = C.SU;
      ctx.stroke();

      // Top Half inside frame: Chaotic Wild Lightning ("dahulu hanya terlihat dalam petir" 12.90s)
      ctx.fillStyle = C.CO;
      AM.roundRect(ctx, 180, 470, 720, 62, 31);
      ctx.fill();
      ctx.font = "900 26px 'Inter', sans-serif";
      ctx.fillStyle = C.CR;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("DAHULU: PETIR LIAR DI LANGIT", 540, 501);

      AM.drawElectricBolt(ctx, 160, 650, 920, 650, 16, 95, Math.floor(t * 22), C.CO, 12);

      // Bottom Half inside frame: Smooth Controlled Sinusoidal AC Wave ("mulai bisa dikendalikan manusia" 14.06s)
      ctx.fillStyle = C.MI;
      AM.roundRect(ctx, 180, 830, 720, 62, 31);
      ctx.fill();
      ctx.font = "900 26px 'Inter', sans-serif";
      ctx.fillStyle = C.INK;
      ctx.fillText("KINI: GELOMBANG LISTRIK TERKENDALI!", 540, 861);

      const waveProg = AM.E.ioC(AM.inv(11.30, 13.60, t));
      ctx.save();
      ctx.strokeStyle = C.MI;
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.beginPath();
      const maxW = 760 * waveProg;
      for (let dx = 0; dx <= maxW; dx += 8) {
        const wx = 160 + dx;
        const wy = 1045 + Math.sin(dx * 0.032 - t * 9) * 105;
        if (dx === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Shape wipes between Acts and at end of Scene 5
    AM.drawShapeWipe(ctx, t, tTamedWave - 0.35, 0.65, [C.SU, C.MI, C.U], 540, 960);
    AM.drawShapeWipe(ctx, t, dur - 0.68, 0.68, [C.MI, C.SU, C.U], 540, 960);
  });
})();
