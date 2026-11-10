/**
 * Scene 1: Hook — Pulang ke Rumah Tanpa Lampu, TV, Ponsel & Menyalakan Api
 * Style: /mg-flat-vector (01-flat-vector Popwise Palette, Camera Zoom, Character Rig & Shape Wipe)
 * Audio Sync: workspace/audio/scene1_hook.words.json (14.233s)
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

  AM.registerScene("scene1_hook", function (ctx, t, dur, scene) {
    // Word-exact cue timestamps from scene1_hook.words.json:
    // 0.00: "Bayangkan," | 1.38: "pulang" | 1.80: "rumah..."
    // 3.06: "lampu."     | 4.10: "televisi." | 5.18: "ponsel."
    // 6.96: "wajahmu"    | 8.34: "menyalakan" | 8.78: "api."
    // 10.14: "mengerikan..." | 13.04: "ribuan tahun."

    const tPulang = 1.35;
    const tArriveRoom = 2.35;
    const tNoLamp = 3.06;
    const tNoTv = 4.10;
    const tNoPhone = 5.18;
    const tFaceZoom = 6.64;
    const tFireIgnite = 8.34;
    const tAncient = 10.14;

    // -------------------------------------------------------------------------
    // BEAT 1 (0.00s - 2.35s): Full-bleed 01-flat-vector City & Exponential Zoom into Window
    // -------------------------------------------------------------------------
    if (t < tArriveRoom) {
      const zoomP = AM.E.ioC(AM.inv(tPulang, tArriveRoom, t));
      const camS = Math.exp(AM.lerp(Math.log(1.0), Math.log(11.5), zoomP));
      const winX = 540;
      const winY = 630;
      const camCx = AM.lerp(540, winX, zoomP);
      const camCy = AM.lerp(960, winY, zoomP);

      ctx.save();
      AM.applyCamera(ctx, { s: camS, cx: camCx, cy: camCy });

      // Full-bleed Ultramarine Sky
      ctx.fillStyle = C.U;
      ctx.fillRect(-1000, -1000, 3080, 4000);

      // Coral Sun/Moon setting & stars
      const [sunS, sunK] = AM.pop(t + 0.35, 0, 2.2, 0.42, 0.16);
      ctx.save();
      ctx.translate(820, 340);
      ctx.scale(sunS / (1 + sunK), sunS * (1 + sunK));
      ctx.fillStyle = C.CO;
      ctx.beginPath();
      ctx.arc(0, 0, 92, 0, AM.TAU);
      ctx.fill();
      ctx.restore();

      // Cream Clouds
      [
        { x: 240 + t * 22, y: 330, s: 1.0 },
        { x: 860 - t * 18, y: 460, s: 0.8 },
      ].forEach((cl) => {
        ctx.save();
        ctx.translate(cl.x, cl.y);
        ctx.scale(cl.s, cl.s);
        ctx.fillStyle = C.CR;
        AM.roundRect(ctx, -90, -24, 180, 48, 24);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-24, -26, 38, 0, AM.TAU);
        ctx.arc(36, -18, 28, 0, AM.TAU);
        ctx.fill();
        ctx.restore();
      });

      // Flat-Vector Buildings popping with velocity squash & stretch
      const blds = [
        { cx: 150, w: 160, h: 420, c: C.MI, sh: C.MID },
        { cx: 335, w: 185, h: 560, c: C.CR, sh: C.CRD },
        { cx: 540, w: 220, h: 680, c: C.INK, sh: "#0B0A22", hero: true },
        { cx: 755, w: 180, h: 510, c: C.SU, sh: C.SUD },
        { cx: 935, w: 165, h: 390, c: C.CO, sh: C.COD },
      ];
      const groundY = 1080;

      blds.forEach((b, i) => {
        const [bs, bk] = AM.pop(t + 0.4, i * 0.06, 2.3, 0.4, 0.22);
        ctx.save();
        ctx.translate(b.cx, groundY);
        ctx.scale(1 / (1 + bk), Math.max(0.01, bs) * (1 + bk));

        ctx.fillStyle = b.c;
        AM.roundRect(ctx, -b.w / 2, -b.h, b.w, b.h + 10, 12);
        ctx.fill();
        ctx.fillStyle = b.sh;
        ctx.fillRect(b.w / 2 - 26, -b.h, 26, b.h + 10);

        // Windows
        for (let r = 0; r < 6; r++) {
          for (let col = -1; col <= 1; col++) {
            const wx = col * 52;
            const wy = -b.h + 65 + r * 86;
            if (b.hero && r === 2 && col === 0) {
              // Hero Window that we zoom into!
              ctx.fillStyle = C.SU;
              AM.roundRect(ctx, -46, wy - 26, 92, 56, 8);
              ctx.fill();
            } else {
              ctx.fillStyle = b.hero ? C.INKW : C.UL;
              ctx.beginPath();
              ctx.arc(wx, wy, 15, 0, AM.TAU);
              ctx.fill();
            }
          }
        }
        ctx.restore();
      });

      // Cream Ground & Road + Coral Bus
      ctx.fillStyle = C.CR;
      ctx.fillRect(-1000, groundY, 3080, 1200);
      ctx.fillStyle = C.CRD;
      ctx.fillRect(-1000, groundY + 46, 3080, 54);

      const busX = AM.lerp(180, 880, AM.clamp(t / 2.2, 0, 1));
      ctx.save();
      ctx.translate(busX, groundY + 52);
      ctx.fillStyle = C.CO;
      AM.roundRect(ctx, -95, -68, 190, 56, 20);
      ctx.fill();
      ctx.fillStyle = C.CR;
      [-68, -22, 24].forEach((wx) => {
        AM.roundRect(ctx, wx, -54, 34, 22, 6);
        ctx.fill();
      });
      ctx.fillStyle = C.INK;
      [-52, 52].forEach((wx) => {
        ctx.beginPath();
        ctx.arc(wx, -10, 15, 0, AM.TAU);
        ctx.fill();
      });
      ctx.restore();

      ctx.restore();
      return;
    }

    // -------------------------------------------------------------------------
    // BEAT 2 & 3 (2.35s - 10.14s): Inside the Room — Lamp OFF, TV OFF, Phone OFF -> Fire Torch!
    // -------------------------------------------------------------------------
    const isLampOff = t >= tNoLamp;
    const isTvOff = t >= tNoTv;
    const isPhoneOff = t >= tNoPhone;
    const isFireLit = t >= tFireIgnite;

    // Camera impact shakes on each blackout hit + push in on face ("wajahmu sendiri")
    const kickArrive = AM.kick(t, tArriveRoom, 3.2, 0.38);
    const kickLamp = AM.kick(t, tNoLamp, 4.0, 0.35);
    const kickTv = AM.kick(t, tNoTv, 4.0, 0.35);
    const kickPhone = AM.kick(t, tNoPhone, 4.0, 0.35);
    const kickFire = AM.kick(t, tFireIgnite, 3.5, 0.35);

    const faceZoomP =
      AM.E.ioC(AM.inv(tFaceZoom, tFaceZoom + 0.6, t)) -
      AM.E.ioC(AM.inv(tAncient - 0.3, tAncient + 0.4, t));
    const camScale =
      (1.0 + 0.22 * faceZoomP) *
      (1 + 0.035 * (kickArrive + kickLamp + kickTv + kickPhone + kickFire));
    const camCenterY = AM.lerp(960, 740, faceZoomP);

    ctx.save();
    AM.applyCamera(ctx, { s: camScale, cx: 540, cy: camCenterY });

    // Room Wall Color (Warm Sunflower before Lamp snaps off -> Dark Ink Navy in blackout)
    ctx.fillStyle = isLampOff ? "#111026" : C.SU;
    ctx.fillRect(-400, -400, 1880, 2720);

    // Back Window showing night sky outside
    ctx.save();
    ctx.translate(210, 410);
    ctx.fillStyle = isLampOff ? "#26254D" : C.CR;
    AM.roundRect(ctx, -130, -150, 260, 300, 18);
    ctx.fill();
    ctx.fillStyle = isLampOff ? "#090818" : C.U;
    AM.roundRect(ctx, -114, -134, 228, 268, 10);
    ctx.fill();
    // Window crossbars
    ctx.fillStyle = isLampOff ? "#26254D" : C.CR;
    ctx.fillRect(-6, -134, 12, 268);
    ctx.fillRect(-114, -6, 228, 12);
    ctx.restore();

    // Warm Torch Fire Light Halo when "menyalakan api" (8.34s+) is active
    if (isFireLit) {
      const [fireS] = AM.pop(t, tFireIgnite, 2.6, 0.4, 0.2);
      const flicker = 1 + 0.06 * Math.sin(t * 24) + 0.04 * Math.cos(t * 37);
      const radius = 560 * Math.max(0.1, fireS) * flicker;
      const fireGrad = ctx.createRadialGradient(710, 620, 30, 710, 620, radius);
      fireGrad.addColorStop(0, "rgba(255, 198, 43, 0.58)");
      fireGrad.addColorStop(0.45, "rgba(255, 90, 78, 0.26)");
      fireGrad.addColorStop(1, "rgba(17, 16, 38, 0)");
      ctx.fillStyle = fireGrad;
      ctx.fillRect(-200, 0, 1500, 1400);
    }

    // 1. HANGING CEILING LAMP (Snaps OFF at 3.06s "tidak ada lampu")
    ctx.save();
    const lampSway = 3.5 * Math.sin(t * 3.8) + 14 * kickLamp;
    ctx.translate(540, 170);
    ctx.rotate((lampSway * Math.PI) / 180);
    ctx.strokeStyle = isLampOff ? "#475569" : C.INK;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 150);
    ctx.stroke();

    // Bulb glow before 3.06s
    if (!isLampOff) {
      ctx.fillStyle = "rgba(255, 246, 233, 0.45)";
      ctx.beginPath();
      ctx.arc(0, 195, 110, 0, AM.TAU);
      ctx.fill();
    }
    ctx.fillStyle = isLampOff ? "#334155" : C.CR;
    ctx.beginPath();
    ctx.arc(0, 190, 26, 0, AM.TAU);
    ctx.fill();

    // Lamp shade
    ctx.fillStyle = isLampOff ? "#1E293B" : C.INK;
    ctx.beginPath();
    ctx.moveTo(-86, 190);
    ctx.lineTo(-46, 134);
    ctx.lineTo(46, 134);
    ctx.lineTo(86, 190);
    ctx.closePath();
    ctx.fill();

    // Red X Badge when Lamp turns off at 3.06s
    if (isLampOff && t < tAncient) {
      const [xs, xk] = AM.pop(t, tNoLamp, 3.2, 0.4, 0.25);
      ctx.save();
      ctx.translate(95, 160);
      ctx.scale(Math.max(0, xs) / (1 + xk), Math.max(0, xs) * (1 + xk));
      ctx.fillStyle = C.CO;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, AM.TAU);
      ctx.fill();
      ctx.strokeStyle = C.CR;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-14, -14);
      ctx.lineTo(14, 14);
      ctx.moveTo(14, -14);
      ctx.lineTo(-14, 14);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    AM.drawShockRing(ctx, 540, 360, t, tNoLamp, 40, 260, 18, 0.42, C.CO);
    AM.drawBurstLines(ctx, 540, 360, 10, 50, 190, t, tNoLamp, 0.36, C.SU, 7);

    // 2. CHARACTER RIG IN CENTER OF ROOM
    const reachFireP = AM.E.outB(AM.inv(tFireIgnite - 0.15, tFireIgnite + 0.3, t), 1.6);
    const charExpr =
      t >= tFireIgnite
        ? "smile"
        : t >= tNoPhone
        ? "shocked"
        : t >= tNoLamp
        ? "surprised"
        : "smile";
    const lookTargetX =
      t >= tFireIgnite
        ? 10
        : t >= tNoPhone
        ? 14
        : t >= tNoTv
        ? -14
        : 0;

    AM.drawCharacterRig(ctx, t, {
      x: 540,
      y: 940,
      scale: 1.08,
      coatColor: isLampOff && !isFireLit ? "#1F7A63" : C.MI,
      coatShade: isLampOff && !isFireLit ? "#135242" : C.MID,
      skinColor: isLampOff && !isFireLit ? "#C98A6B" : "#FFB48C",
      hairStyle: "bun",
      glasses: true,
      expression: charExpr,
      lookX: lookTargetX,
      reactTime: tNoLamp,
      rightSh: AM.lerp(-18, -112, reachFireP),
      rightFo: AM.lerp(86, -24, reachFireP),
      onRightHand: function (hCtx) {
        if (t >= tFireIgnite - 0.1) {
          const [fs, fk] = AM.pop(t, tFireIgnite, 2.8, 0.38, 0.25);
          hCtx.save();
          hCtx.rotate((32 * Math.PI) / 180);
          hCtx.scale(Math.max(0.01, fs) / (1 + fk), Math.max(0.01, fs) * (1 + fk));
          // Wooden Torch Handle
          hCtx.fillStyle = "#78350F";
          AM.roundRect(hCtx, -14, -95, 28, 120, 10);
          hCtx.fill();
          hCtx.fillStyle = C.SUD;
          AM.roundRect(hCtx, -18, -95, 36, 18, 6);
          hCtx.fill();

          // Layered Flat-Vector Flame (Coral -> Sunflower -> Cream)
          const flk = 1 + 0.12 * Math.sin(t * 28);
          hCtx.save();
          hCtx.translate(0, -100);
          hCtx.scale(1 / flk, flk);
          hCtx.fillStyle = C.CO;
          hCtx.beginPath();
          hCtx.moveTo(0, -135);
          hCtx.quadraticCurveTo(68, -50, 42, 10);
          hCtx.arc(0, 10, 42, 0, Math.PI, false);
          hCtx.quadraticCurveTo(-68, -50, 0, -135);
          hCtx.fill();

          hCtx.fillStyle = C.SU;
          hCtx.beginPath();
          hCtx.moveTo(0, -95);
          hCtx.quadraticCurveTo(44, -35, 26, 8);
          hCtx.arc(0, 8, 26, 0, Math.PI, false);
          hCtx.quadraticCurveTo(-44, -35, 0, -95);
          hCtx.fill();

          hCtx.fillStyle = C.CR;
          hCtx.beginPath();
          hCtx.arc(0, -12, 14, 0, AM.TAU);
          hCtx.fill();
          hCtx.restore();

          hCtx.restore();
        }
      },
    });

    AM.drawShockRing(ctx, 720, 620, t, tFireIgnite, 30, 260, 18, 0.45, C.SU);
    AM.drawBurstLines(ctx, 720, 620, 12, 40, 210, t, tFireIgnite, 0.4, C.CO, 7);

    // Mirror frame popping at 6.64s ("melihat wajahmu sendiri")
    if (t >= tFaceZoom && t < tAncient) {
      const [ms, mk] = AM.pop(t, tFaceZoom, 2.6, 0.42, 0.2);
      ctx.save();
      ctx.translate(250, 650);
      ctx.scale(Math.max(0, ms) / (1 + mk), Math.max(0, ms) * (1 + mk));
      ctx.fillStyle = C.SU;
      AM.roundRect(ctx, -78, -110, 156, 220, 78);
      ctx.fill();
      ctx.fillStyle = isFireLit ? "#3B2F4A" : "#0B0A1F";
      AM.roundRect(ctx, -64, -96, 128, 192, 64);
      ctx.fill();
      // Silhouette question mark before fire is lit
      ctx.font = "900 72px 'Inter', sans-serif";
      ctx.fillStyle = isFireLit ? C.SU : "#475569";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isFireLit ? "!" : "?", 0, 0);
      ctx.restore();
    }

    // Desk Foreground
    ctx.fillStyle = isLampOff ? "#1D1C42" : C.UL;
    ctx.fillRect(-300, 940, 1680, 36);
    ctx.fillStyle = isLampOff ? "#141330" : C.U;
    ctx.fillRect(-300, 976, 1680, 420);

    // 3. TELEVISION ON LEFT DESK (Snaps OFF at 4.10s "Tidak ada televisi")
    ctx.save();
    const [tvS, tvK] = AM.pop(t + 0.2, tArriveRoom, 2.5, 0.42, 0.18);
    ctx.translate(220, 940);
    ctx.scale(
      (Math.max(0, tvS) / (1 + tvK)) * (1 + 0.12 * kickTv),
      Math.max(0, tvS) * (1 + tvK) * (1 - 0.12 * kickTv)
    );
    // TV Stand & Cabinet
    ctx.fillStyle = C.INK;
    AM.roundRect(ctx, -135, -210, 270, 185, 22);
    ctx.fill();
    ctx.fillRect(-40, -25, 80, 25);
    // Screen
    ctx.fillStyle = isTvOff ? "#090916" : "#38BDF8";
    AM.roundRect(ctx, -118, -194, 236, 152, 14);
    ctx.fill();
    if (!isTvOff) {
      // Live flat-vector bars on TV before 4.10s
      ctx.fillStyle = C.SU;
      ctx.beginPath();
      ctx.arc(-30, -118, 34, 0, AM.TAU);
      ctx.fill();
      ctx.fillStyle = C.CO;
      AM.roundRect(ctx, 20, -142, 68, 20, 10);
      ctx.fill();
      ctx.fillStyle = C.CR;
      AM.roundRect(ctx, 20, -112, 48, 20, 10);
      ctx.fill();
    } else {
      // Red X on TV
      const [txS] = AM.pop(t, tNoTv, 3.2, 0.4, 0.2);
      ctx.save();
      ctx.translate(0, -118);
      ctx.scale(Math.max(0, txS), Math.max(0, txS));
      ctx.strokeStyle = C.CO;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-36, -36);
      ctx.lineTo(36, 36);
      ctx.moveTo(36, -36);
      ctx.lineTo(-36, 36);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    AM.drawShockRing(ctx, 220, 830, t, tNoTv, 35, 220, 16, 0.4, C.CO);
    AM.drawBurstLines(ctx, 220, 830, 8, 45, 175, t, tNoTv, 0.35, C.CR, 6);

    // 4. SMARTPHONE ON RIGHT DESK (Snaps OFF at 5.18s "Tidak ada ponsel")
    ctx.save();
    const [phS, phK] = AM.pop(t + 0.1, tArriveRoom + 0.1, 2.5, 0.42, 0.18);
    const buzzX = t >= tNoPhone - 0.25 && t < tNoPhone + 0.2 ? 6 * Math.sin(t * 75) : 0;
    ctx.translate(855 + buzzX, 940);
    ctx.scale(
      (Math.max(0, phS) / (1 + phK)) * (1 + 0.14 * kickPhone),
      Math.max(0, phS) * (1 + phK) * (1 - 0.14 * kickPhone)
    );
    ctx.fillStyle = C.INK;
    AM.roundRect(ctx, -64, -225, 128, 225, 24);
    ctx.fill();
    ctx.fillStyle = isPhoneOff ? "#090916" : C.CR;
    AM.roundRect(ctx, -52, -210, 104, 195, 14);
    ctx.fill();
    if (!isPhoneOff) {
      ctx.fillStyle = C.CO;
      ctx.beginPath();
      ctx.arc(24, -180, 13, 0, AM.TAU);
      ctx.fill();
      ctx.fillStyle = C.INK;
      AM.roundRect(ctx, -34, -145, 68, 12, 6);
      ctx.fill();
      AM.roundRect(ctx, -34, -122, 48, 12, 6);
      ctx.fill();
    } else {
      // Dead battery red icon
      const [bxS] = AM.pop(t, tNoPhone, 3.2, 0.4, 0.2);
      ctx.save();
      ctx.translate(0, -112);
      ctx.scale(Math.max(0, bxS), Math.max(0, bxS));
      ctx.strokeStyle = C.CO;
      ctx.lineWidth = 6;
      AM.roundRect(ctx, -32, -18, 60, 36, 6);
      ctx.stroke();
      ctx.fillStyle = C.CO;
      ctx.fillRect(28, -8, 6, 16);
      ctx.fillRect(-24, -10, 12, 20);
      ctx.restore();
    }
    ctx.restore();

    AM.drawShockRing(ctx, 855, 830, t, tNoPhone, 30, 210, 16, 0.4, C.CO);
    AM.drawBurstLines(ctx, 855, 830, 8, 40, 165, t, tNoPhone, 0.35, C.CO, 6);

    // -------------------------------------------------------------------------
    // BEAT 4 (10.14s - 14.23s): "manusia pernah hidup seperti ini selama ribuan tahun"
    // -------------------------------------------------------------------------
    if (t >= tAncient) {
      const [anS, anK] = AM.pop(t, tAncient, 2.4, 0.42, 0.18);
      ctx.save();
      ctx.translate(540, 330);
      ctx.scale(Math.max(0, anS) / (1 + anK), Math.max(0, anS) * (1 + anK));

      ctx.fillStyle = C.CO;
      AM.roundRect(ctx, -390, -68, 780, 136, 32);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = C.CR;
      ctx.stroke();

      const yearCount = Math.round(AM.lerp(2026, 3000, AM.clamp((t - tAncient) / 2.6, 0, 1)));
      const suffix = t - tAncient < 1.1 ? "M" : "SM — RIBUAN TAHUN GELAP";
      ctx.font = "900 40px 'JetBrains Mono', monospace";
      ctx.fillStyle = C.CR;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`ERA: ${yearCount} ${suffix}`, 0, -12);

      ctx.font = "700 24px 'Inter', sans-serif";
      ctx.fillStyle = C.SU;
      ctx.fillText("HANYA API UNGGUN & LILIN DI TENGAH MALAM", 0, 34);
      ctx.restore();
    }

    ctx.restore();

    // 3-Stage Flat-Vector Shape Wipe Transition into Scene 2
    AM.drawShapeWipe(ctx, t, dur - 0.68, 0.68, [C.CO, C.SU, C.CR], 710, 620);
  });
})();
