/**
 * Scene 6: Twist & Penutup — Siapa Sebenarnya Penemu Listrik? (2x2 Quadrant Grid & Bookend City Finale)
 * Style: /mg-flat-vector (01-flat-vector Popwise Palette, 2x2 QD Grid, 3 Pillars & Lit Metropolis)
 * Audio Sync: workspace/audio/scene6_twist_penutup.words.json (23.60s)
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

  // 2x2 Quadrant Grid on 1080x1920 Vertical Stage (y = 320..1360 -> each quadrant 540x520)
  const QUADS = [
    {
      qx: 0, qy: 320, w: 540, h: 520, bg: C.U, fg: C.CR,
      era: "600 SM · YUNANI", name: "THALES", role: "BATU AMBAR STATIS",
      hair: "beard", coat: C.SU, shade: C.SUD, glasses: false, t0: 0.12,
    },
    {
      qx: 540, qy: 320, w: 540, h: 520, bg: C.CO, fg: C.CR,
      era: "1752 · AMERIKA", name: "FRANKLIN", role: "PETIR = LISTRIK",
      hair: "colonial", coat: C.U, shade: C.UD, glasses: true, t0: 0.28,
    },
    {
      qx: 0, qy: 840, w: 540, h: 520, bg: C.MI, fg: C.INK,
      era: "1800 · ITALIA", name: "VOLTA", role: "BATERAI PERTAMA",
      hair: "curly", coat: C.CO, shade: C.COD, glasses: false, t0: 0.44,
    },
    {
      qx: 540, qy: 840, w: 540, h: 520, bg: C.SU, fg: C.INK,
      era: "1831 · INGGRIS", name: "FARADAY", role: "INDUKSI & DINAMO",
      hair: "curly", coat: C.U, shade: C.UD, glasses: false, t0: 0.60,
    },
  ];

  // Bookend Metropolis Buildings (matching Scene 1 skyline, now 100% illuminated!)
  const FINALE_BLDS = [
    { cx: 150, w: 160, h: 420, c: C.MI, sh: C.MID },
    { cx: 335, w: 185, h: 560, c: C.CR, sh: C.CRD },
    { cx: 540, w: 220, h: 680, c: C.INK, sh: "#0B0A22", hero: true },
    { cx: 755, w: 180, h: 510, c: C.SU, sh: C.SUD },
    { cx: 935, w: 165, h: 390, c: C.CO, sh: C.COD },
  ];

  AM.registerScene("scene6_twist_penutup", function (ctx, t, dur) {
    // Word cues from workspace/audio/scene6_twist_penutup.words.json:
    // 0.00 - 2.86s: "Jadi, siapa sebenarnya penemu listrik?"
    // 2.84 - 4.80s: "Jawabannya mungkin mengejutkan:"
    // 4.78 - 8.38s: "tidak ada satu orang yang benar-benar menciptakan listrik."
    // 8.36 - 10.56s: "Listrik sudah ada jauh sebelum manusia lahir."
    // 11.80s: "menemukan rahasianya" | 12.98s: "memahaminya" | 14.22s: "belajar mengendalikannya."
    // 17.12s: "menyalakan lampu..." | 21.00s: "perjalanan penemuan manusia selama ribuan tahun."

    const tTwistAnswer = 4.78;
    const tPillarsCut = 8.38;
    const tSwitchCut = 15.48;
    const tSwitchOn = 17.12;
    const tCityZoomOut = 18.70;

    // Camera zoom onto the wall switch when flipped at 16.5s - 18.6s
    const zoomSw = AM.E.ioC(AM.inv(16.30, 17.10, t)) * (1 - AM.E.ioC(AM.inv(18.20, 18.90, t)));

    ctx.save();
    AM.applyCamera(ctx, {
      s: 1.0 + zoomSw * 0.28,
      cx: AM.lerp(540, 650, zoomSw),
      cy: AM.lerp(960, 810, zoomSw),
    });

    if (t < tPillarsCut) {
      // =======================================================================
      // ACT I (0.00s - 8.38s): Full-Bleed 2x2 Pioneer Quadrant Grid (01-flat-vector QD)
      // =======================================================================
      ctx.fillStyle = C.INK;
      ctx.fillRect(-600, -600, 2280, 3120);

      QUADS.forEach((q, idx) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(q.qx, q.qy, q.w, q.h);
        ctx.clip();

        ctx.fillStyle = q.bg;
        ctx.fillRect(q.qx, q.qy, q.w, q.h);

        const [qS, qK] = AM.pop(t, q.t0, 2.5, 0.4, 0.14);

        // Mini Articulated Scientist Rig inside each quadrant
        AM.drawCharacterRig(ctx, t, {
          x: q.qx + 270,
          y: q.qy + 345,
          scale: 0.62 * qS,
          coatColor: q.coat,
          coatShade: q.shade,
          hairStyle: q.hair,
          glasses: q.glasses,
          expression: t >= tTwistAnswer ? "surprised" : "smile",
          headTilt: Math.sin(t * 3 + idx) * 6,
          leftSh: 18,
          leftFo: -70,
          rightSh: -58 + Math.sin(t * 4 + idx) * 10,
          rightFo: -20,
        });

        // Era & Pioneer Label Pill
        ctx.save();
        ctx.translate(q.qx + 270, q.qy + 435);
        ctx.scale(qS / (1 + qK * 0.5), qS * (1 + qK * 0.5));
        ctx.fillStyle = C.INK;
        AM.roundRect(ctx, -225, -52, 450, 104, 24);
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = C.CR;
        ctx.stroke();

        ctx.font = "900 28px 'Inter', sans-serif";
        ctx.fillStyle = C.SU;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${q.name} (${q.era.split(" ")[0]})`, 0, -14);

        ctx.font = "700 20px 'JetBrains Mono', monospace";
        ctx.fillStyle = C.CR;
        ctx.fillText(q.role, 0, 22);
        ctx.restore();

        ctx.restore();
      });

      // Crisp Ink Grid Dividers
      ctx.strokeStyle = C.INK;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(540, 320);
      ctx.lineTo(540, 1360);
      ctx.moveTo(0, 840);
      ctx.lineTo(1080, 840);
      ctx.stroke();

      // Hopping Hero Energy Relay Dot connecting all 4 quadrants (3.60s - 5.80s)
      if (t >= 3.60) {
        const pts = [
          { x: 270, y: 580 },
          { x: 810, y: 580 },
          { x: 270, y: 1100 },
          { x: 810, y: 1100 },
          { x: 540, y: 840 },
        ];
        const hopU = AM.clamp((t - 3.60) / 2.10, 0, 1);
        const segF = hopU * (pts.length - 1);
        const segIdx = Math.min(pts.length - 2, Math.floor(segF));
        const dotPos = AM.arcP(pts[segIdx], pts[segIdx + 1], 95, AM.E.ioQ(segF - segIdx));

        ctx.fillStyle = C.SU;
        ctx.strokeStyle = C.INK;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(dotPos.x, dotPos.y, 34, 0, AM.TAU);
        ctx.fill();
        ctx.stroke();
      }

      // Center Hub Badge: Flips at 4.78s ("tidak ada satu orang yang benar-benar menciptakan listrik")
      const isTwist = t >= tTwistAnswer;
      const [hubS, hubK] = AM.pop(t, isTwist ? tTwistAnswer : 0.75, 2.8, 0.36, 0.16);
      ctx.save();
      ctx.translate(540, 840);
      ctx.scale(hubS / (1 + hubK), hubS * (1 + hubK));

      if (!isTwist) {
        ctx.fillStyle = C.INK;
        AM.roundRect(ctx, -370, -64, 740, 128, 64);
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = C.SU;
        ctx.stroke();
        ctx.font = "900 38px 'Inter', sans-serif";
        ctx.fillStyle = C.SU;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SIAPA PENEMU LISTRIK?", 0, 2);
      } else {
        AM.drawBurstLines(ctx, 0, 0, 14, 140, 390, t, tTwistAnswer, 0.7, C.CR, 8);
        ctx.fillStyle = C.INK;
        AM.roundRect(ctx, -450, -76, 900, 152, 42);
        ctx.fill();
        ctx.lineWidth = 9;
        ctx.strokeStyle = C.SU;
        ctx.stroke();
        ctx.font = "900 38px 'Inter', sans-serif";
        ctx.fillStyle = C.SU;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("BUKAN SATU ORANG PUN!", 0, -18);
        ctx.font = "700 24px 'Inter', sans-serif";
        ctx.fillStyle = C.CR;
        ctx.fillText('Tidak ada manusia yang "menciptakan" listrik', 0, 28);
      }
      ctx.restore();
    } else if (t < tSwitchCut) {
      // =======================================================================
      // ACT II (8.38s - 15.48s): 3 Kinetic Flat-Vector Pillars (MENEMUKAN · MEMAHAMI · MENGENDALIKAN)
      // =======================================================================
      ctx.fillStyle = C.INK;
      ctx.fillRect(-600, -600, 2280, 3120);

      // Cosmic Origin Banner ("Listrik sudah ada jauh sebelum manusia lahir" 8.76s)
      const [topS] = AM.pop(t, 8.55, 2.5, 0.4, 0.14);
      ctx.save();
      ctx.translate(540, 395);
      ctx.scale(topS, topS);
      ctx.fillStyle = C.U;
      AM.roundRect(ctx, -450, -56, 900, 112, 32);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = C.SU;
      ctx.stroke();
      ctx.font = "900 30px 'Inter', sans-serif";
      ctx.fillStyle = C.CR;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("LISTRIK SUDAH ADA SEBELUM MANUSIA LAHIR", 0, -12);
      ctx.font = "700 22px 'JetBrains Mono', monospace";
      ctx.fillStyle = C.SU;
      ctx.fillText("TUGAS MANUSIA ADALAH 3 TAHAP INI:", 0, 26);
      ctx.restore();

      const rows = [
        {
          y: 620, t0: 11.45, num: "01", title: "MENEMUKAN RAHASIANYA",
          sub: "600 SM · Batu Ambar & Listrik Statis", col: C.CO, fg: C.CR,
        },
        {
          y: 890, t0: 12.75, num: "02", title: "MEMAHAMI SIFATNYA",
          sub: "1752 · Petir di Langit = Arus Listrik", col: C.SU, fg: C.INK,
        },
        {
          y: 1160, t0: 13.95, num: "03", title: "MENGENDALIKAN ENERGINYA",
          sub: "1800–1831 · Baterai Volta & Generator Faraday", col: C.MI, fg: C.INK,
        },
      ];

      rows.forEach((r) => {
        if (t < r.t0) return;
        const [s, k] = AM.pop(t, r.t0, 2.7, 0.37, 0.16);
        ctx.save();
        ctx.translate(540, r.y);
        ctx.scale(s / (1 + k * 0.7), s * (1 + k * 0.7));

        AM.drawBurstLines(ctx, 0, 0, 10, 120, 320, t, r.t0, 0.55, r.col, 6);

        ctx.fillStyle = r.col;
        AM.roundRect(ctx, -440, -105, 880, 210, 36);
        ctx.fill();
        ctx.lineWidth = 7;
        ctx.strokeStyle = C.CR;
        ctx.stroke();

        ctx.fillStyle = C.INK;
        AM.roundRect(ctx, -400, -52, 110, 104, 24);
        ctx.fill();
        ctx.font = "900 40px 'JetBrains Mono', monospace";
        ctx.fillStyle = C.SU;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(r.num, -345, 2);

        ctx.textAlign = "left";
        ctx.font = "900 36px 'Inter', sans-serif";
        ctx.fillStyle = r.fg;
        ctx.fillText(r.title, -255, -22);

        ctx.font = "700 24px 'Inter', sans-serif";
        ctx.fillStyle = r.fg;
        ctx.fillText(r.sub, -255, 32);
        ctx.restore();
      });
    } else {
      // =======================================================================
      // ACT III (15.48s - 23.60s): Bookend Finale — Flipping the Switch & Lit Metropolis!
      // =======================================================================
      const switchOn = t >= tSwitchOn;
      const cityReveal = AM.E.ioQt(AM.inv(tCityZoomOut, tCityZoomOut + 1.80, t));

      if (cityReveal < 0.999) {
        ctx.save();
        ctx.globalAlpha = 1 - cityReveal;

        ctx.fillStyle = switchOn ? C.U : C.INK;
        ctx.fillRect(-600, -600, 2280, 3120);

        if (switchOn) {
          const glowR = AM.E.outC(AM.inv(tSwitchOn, tSwitchOn + 0.75, t)) * 1150;
          ctx.fillStyle = C.CR;
          ctx.beginPath();
          ctx.arc(540, 480, glowR, 0, AM.TAU);
          ctx.fill();
        }

        // Floor
        ctx.fillStyle = switchOn ? C.SU : "#0D0C24";
        ctx.fillRect(-400, 1220, 1880, 900);

        // Overhead Pendant Lamp (Ignites at 17.12s "menyalakan lampu"!)
        const lampX = 540;
        const lampY = 470;
        ctx.strokeStyle = C.INK;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(lampX, 240);
        ctx.lineTo(lampX, lampY - 50);
        ctx.stroke();

        AM.drawShockRing(ctx, lampX, lampY, t, tSwitchOn, 40, 390, 16, 0.85, C.SU);
        AM.drawBurstLines(ctx, lampX, lampY, 14, 70, 210, t, tSwitchOn, 0.75, C.CO, 7);

        ctx.fillStyle = switchOn ? C.SU : "#3A3968";
        ctx.strokeStyle = C.INK;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(lampX, lampY + 12, 48, 0, AM.TAU);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = C.CO;
        ctx.beginPath();
        ctx.arc(lampX, lampY, 76, Math.PI, AM.TAU);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Wall Switch Plate on Right Wall (x = 810, y = 860)
        const swX = 810;
        const swY = 860;
        ctx.fillStyle = C.U;
        AM.roundRect(ctx, swX - 54, swY - 82, 108, 164, 24);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = C.INK;
        ctx.stroke();

        ctx.fillStyle = switchOn ? C.MI : C.CO;
        AM.roundRect(ctx, swX - 26, switchOn ? swY - 48 : swY + 4, 52, 48, 12);
        ctx.fill();
        ctx.stroke();

        // Protagonist Rig reaching out and flipping the switch ON at 17.12s!
        const reachU = AM.E.ioC(AM.inv(16.10, tSwitchOn, t));
        const clickKick = AM.kick(t, tSwitchOn, 4.0, 0.32);

        AM.drawCharacterRig(ctx, t - tSwitchCut, {
          x: 450,
          y: 1140,
          scale: 1.08,
          coatColor: C.CO,
          coatShade: C.COD,
          hairStyle: "short",
          glasses: true,
          expression: switchOn ? "surprised" : "smile",
          headTilt: 8,
          leftSh: 18,
          leftFo: -70,
          rightSh: AM.lerp(-18, -78 - clickKick * 18, reachU),
          rightFo: AM.lerp(75, -18, reachU),
        });

        ctx.restore();
      }

      // Phase B (18.70s - 23.60s): Illuminated 01-flat-vector Metropolis Finale!
      if (cityReveal > 0.001) {
        ctx.save();
        ctx.globalAlpha = cityReveal;

        const groundY = 1220;
        ctx.fillStyle = C.U;
        ctx.fillRect(-600, -600, 2280, 3120);

        // Glowing Golden Energy Sun
        ctx.fillStyle = C.SU;
        ctx.strokeStyle = C.INK;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(820, 430, 105, 0, AM.TAU);
        ctx.fill();
        ctx.stroke();

        FINALE_BLDS.forEach((b, bi) => {
          const [bS] = AM.pop(t, tCityZoomOut + bi * 0.06, 2.4, 0.4, 0.12);
          ctx.save();
          ctx.translate(b.cx, groundY);
          ctx.scale(bS, bS);

          ctx.fillStyle = b.c;
          AM.roundRect(ctx, -b.w / 2, -b.h, b.w, b.h, 12);
          ctx.fill();
          ctx.lineWidth = 5;
          ctx.strokeStyle = C.INK;
          ctx.stroke();

          const cols = 3;
          const rows = Math.floor((b.h - 90) / 72);
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const wx = -b.w / 2 + 28 + c * ((b.w - 56) / 2);
              const wy = -b.h + 52 + r * 72;
              ctx.fillStyle = C.SU;
              AM.roundRect(ctx, wx - 14, wy - 18, 28, 36, 6);
              ctx.fill();
              ctx.lineWidth = 3;
              ctx.strokeStyle = C.INK;
              ctx.stroke();
            }
          }
          ctx.restore();
        });

        ctx.fillStyle = C.INK;
        ctx.fillRect(-400, groundY, 1880, 900);
        ctx.strokeStyle = C.CR;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(40, groundY);
        ctx.lineTo(1040, groundY);
        ctx.stroke();

        // Grand Finale Banner ("hasil perjalanan penemuan manusia selama ribuan tahun" 21.00s)
        const [finS, finK] = AM.pop(t, 19.30, 2.5, 0.38, 0.15);
        ctx.save();
        ctx.translate(540, 1360);
        ctx.scale(finS / (1 + finK), finS * (1 + finK));
        ctx.fillStyle = C.SU;
        AM.roundRect(ctx, -455, -66, 910, 132, 36);
        ctx.fill();
        ctx.lineWidth = 7;
        ctx.strokeStyle = C.INK;
        ctx.stroke();
        ctx.font = "900 33px 'Inter', sans-serif";
        ctx.fillStyle = C.INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("CAHAYA DARI PERJALANAN RIBUAN TAHUN", 0, -16);
        ctx.font = "800 21px 'JetBrains Mono', monospace";
        ctx.fillStyle = C.U;
        ctx.fillText("600 SM THALES · 1752 FRANKLIN · 1800 VOLTA · 1831 FARADAY", 0, 26);
        ctx.restore();

        ctx.restore();
      }
    }

    ctx.restore();

    // Shape wipes between Acts
    AM.drawShapeWipe(ctx, t, tPillarsCut - 0.35, 0.65, [C.SU, C.CO, C.INK], 540, 840);
    AM.drawShapeWipe(ctx, t, tSwitchCut - 0.35, 0.65, [C.MI, C.SU, C.U], 540, 960);
  });
})();
