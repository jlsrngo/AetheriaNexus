(function () {
  var AM = window.AM;

  function drawKawaiiSpeechBubble(ctx, x, y, text) {
    if (!text) return;
    ctx.save();
    ctx.font = "600 28px Inter, sans-serif";
    var paddingX = 28;
    var boxW = Math.min(620, Math.max(240, ctx.measureText(text).width + paddingX * 2));
    var boxH = 74;
    var bx = AM.clamp(x - boxW / 2, 64, 1016 - boxW);
    var by = AM.clamp(y - boxH, 240, 880);

    ctx.fillStyle = "#594637";
    AM.roundRect(ctx, bx, by + 8, boxW, boxH, 28);
    ctx.fill();

    ctx.fillStyle = "#FFFDF9";
    ctx.strokeStyle = "#594637";
    ctx.lineWidth = 4;
    AM.roundRect(ctx, bx, by, boxW, boxH, 28);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#594637";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, bx + boxW / 2, by + boxH / 2);
    ctx.restore();
  }

  AM.registerScene("scene1_town_walk", function (hudCtx, localTime, dur, scene, am, world, globalTime) {
    // Beat 1 & 2: Deterministic patrol & waddle driven strictly by localTime (zero Math.random / dt)
    var t = Math.max(0, Number(localTime) || 0);
    var walkPhase = t * 9.5;
    var popVec = am.pop(t + 0.35, 0.0, 2.4, 0.42, 0.16, 1.5);
    var entryS = Math.max(0, popVec[0]);
    var entryK = popVec[1];

    if (world && world.hero) {
      var hero = world.hero;
      var patrolX = Math.sin(t * 0.85) * 2.2;
      var moveDir = Math.cos(t * 0.85);
      hero.root.position.set(patrolX, 0, 1.8);
      hero.root.rotation.y = moveDir * 0.28;

      var bob = Math.abs(Math.sin(walkPhase)) * 0.11;
      hero.bodyBounce.position.y = bob;
      hero.bodyBounce.rotation.z = Math.cos(walkPhase) * 0.055;

      var sx = entryS / (1 + entryK);
      var sy = entryS * (1 + entryK);
      var sq = Math.sin(walkPhase * 2.0) * 0.028;
      hero.headGroup.scale.set(sx * (1 + sq), sy * (1 - sq * 0.85), sx);

      // Periodic deterministic eye blink every 3.4s
      var blinkCycle = t % 3.4;
      var blinkY = blinkCycle < 0.14 ? 0.14 + Math.abs(blinkCycle - 0.07) * 10.0 : 1.0;
      hero.leftEye.scale.y = Math.min(1.0, blinkY);
      hero.rightEye.scale.y = Math.min(1.0, blinkY);

      var legSwing = Math.sin(walkPhase);
      hero.leftLeg.rotation.x = legSwing * 0.55;
      hero.rightLeg.rotation.x = -legSwing * 0.55;
      hero.leftArm.rotation.x = -legSwing * 0.42;
      hero.rightArm.rotation.x = legSwing * 0.42;

      var isSpeaking = t > 0.4 && t < dur - 0.8;
      var mouthOpen = isSpeaking ? Math.abs(Math.sin(t * 20.0)) : 0;
      hero.smileGroup.visible = mouthOpen <= 0.25;
      hero.talkMouth.visible = mouthOpen > 0.25;
      hero.talkMouth.scale.set(0.92 + (1 - mouthOpen) * 0.2, 0.55 + mouthOpen * 0.75, 1.0);

      world.clouds.forEach(function (cl) {
        var span = 18;
        cl.group.position.x = ((cl.x0 + cl.speed * t + span) % (span * 2)) - span;
      });
      world.cars.forEach(function (car) {
        var span = 18;
        var pos = (car.x0 + car.speed * t + span) % (span * 2);
        if (pos < 0) pos += span * 2;
        car.group.position.x = pos - span;
        car.group.position.y = Math.abs(Math.sin(t * 12)) * 0.025;
      });

      world.camera.position.x = Math.sin(t * 0.4) * 0.65;
      world.camera.position.y = 2.2 + Math.cos(t * 0.35) * 0.15;
      world.camera.position.z = 13.5 - Math.min(1.2, t * 0.2);
      world.camera.lookAt(patrolX * 0.35, 1.35, 0);

      world.renderer.render(world.scene, world.camera);

      if (isSpeaking) {
        var bubblePt = world.projectHead();
        drawKawaiiSpeechBubble(hudCtx, bubblePt.x, bubblePt.y, "Selamat datang di Kota Pastel!");
      }
      return;
    }

    // Crisp fallback if Three.js CDN is unavailable offline
    var grad = hudCtx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, "#93C5FD");
    grad.addColorStop(1, "#E0F2FE");
    hudCtx.fillStyle = grad;
    hudCtx.fillRect(0, 0, 1080, 1920);
    hudCtx.fillStyle = "#F1F5F9";
    hudCtx.fillRect(0, 920, 1080, 1000);
    hudCtx.save();
    hudCtx.translate(540 + Math.sin(t * 0.85) * 120, 680 - Math.abs(Math.sin(walkPhase)) * 18);
    hudCtx.scale(entryS / (1 + entryK), entryS * (1 + entryK));
    hudCtx.fillStyle = "#FEF08A";
    hudCtx.strokeStyle = "#594637";
    hudCtx.lineWidth = 10;
    am.roundRect(hudCtx, -140, -140, 280, 240, 64);
    hudCtx.fill();
    hudCtx.stroke();
    hudCtx.restore();
    drawKawaiiSpeechBubble(hudCtx, 540, 480, "Selamat datang di Kota Pastel!");
  });
})();

