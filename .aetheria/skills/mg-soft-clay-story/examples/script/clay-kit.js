(function () {
  var OUTLINE_COLOR = 0x594637;

  function createSmoothOutlineGeometry(sourceGeo, thickness) {
    var outGeo = sourceGeo.clone();
    var pos = outGeo.attributes.position;
    outGeo.computeVertexNormals();
    var norm = outGeo.attributes.normal;
    var posMap = new Map();
    var v = new THREE.Vector3();
    var n = new THREE.Vector3();

    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(norm, i);
      var key = Math.round(v.x * 1000) + "," + Math.round(v.y * 1000) + "," + Math.round(v.z * 1000);
      if (!posMap.has(key)) posMap.set(key, new THREE.Vector3());
      posMap.get(key).add(n);
    }

    for (var j = 0; j < pos.count; j++) {
      v.fromBufferAttribute(pos, j);
      var key2 = Math.round(v.x * 1000) + "," + Math.round(v.y * 1000) + "," + Math.round(v.z * 1000);
      var smoothN = posMap.get(key2).clone().normalize();
      v.addScaledVector(smoothN, thickness);
      pos.setXYZ(j, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    return outGeo;
  }

  function addOutlinedMesh(geo, mat, outlineMat, thickness, castShadow, receiveShadow) {
    var group = new THREE.Group();
    var mainMesh = new THREE.Mesh(geo, mat);
    mainMesh.castShadow = castShadow !== false;
    mainMesh.receiveShadow = receiveShadow !== false;
    group.add(mainMesh);
    if (thickness > 0) {
      group.add(new THREE.Mesh(createSmoothOutlineGeometry(geo, thickness), outlineMat));
    }
    return { group: group, mainMesh: mainMesh };
  }

  function createWavySpongeHeadGeometry(isOutline, thickness) {
    var geo = new THREE.SphereGeometry(1.0, 64, 48);
    var pos = geo.attributes.position;
    var v = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      var dir = v.clone().normalize();
      var sx = Math.sign(dir.x) * Math.pow(Math.abs(dir.x), 0.58);
      var sy = Math.sign(dir.y) * Math.pow(Math.abs(dir.y), 0.58);
      var sz = Math.sign(dir.z) * Math.pow(Math.abs(dir.z), 0.68);
      var x = THREE.MathUtils.lerp(dir.x, sx, 0.78) * 1.35;
      var y = THREE.MathUtils.lerp(dir.y, sy, 0.78) * 1.04;
      var z = THREE.MathUtils.lerp(dir.z, sz, 0.72) * 0.64;
      var edgeProfile = Math.pow(Math.min(1.0, Math.hypot(dir.x, dir.y) * 1.15), 2.2);
      var topMask = Math.pow(Math.abs(dir.y), 1.6) * edgeProfile;
      var sideMask = Math.pow(Math.abs(dir.x), 1.6) * edgeProfile;
      x += Math.sign(dir.x) * Math.cos(dir.y * Math.PI * 2.5) * 0.065 * sideMask;
      y += Math.sign(dir.y) * Math.cos(dir.x * Math.PI * 3.5) * 0.065 * topMask;
      if (Math.abs(z) > 0.56) {
        z = Math.sign(z) * (0.56 + (Math.abs(z) - 0.56) * 0.35);
      }
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return isOutline ? createSmoothOutlineGeometry(geo, thickness || 0.072) : geo;
  }

  function createSmoothTorsoPartGeometry(topR, botR, height, depthScale) {
    var geo = new THREE.SphereGeometry(1.0, 48, 32);
    var pos = geo.attributes.position;
    var v = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      var ny = v.y;
      var k = (ny + 1) * 0.5;
      var rx = THREE.MathUtils.lerp(botR, topR, k);
      var profile = Math.pow(Math.max(0.001, 1.0 - Math.pow(ny, 4.0)), 0.22);
      pos.setXYZ(i, v.x * rx * profile, ny * height * 0.5, v.z * rx * depthScale * profile);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function createSoftClayMaterial(topHex, botHex, rimHex) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color(topHex) },
        uBotColor: { value: new THREE.Color(botHex) },
        uRimColor: { value: new THREE.Color(rimHex || 0xf5d0fe) }
      },
      vertexShader: [
        "varying vec3 vNormalW;",
        "varying vec3 vViewDir;",
        "varying float vHeight;",
        "void main() {",
        "  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);",
        "  vNormalW = normalize(normalMatrix * normal);",
        "  vViewDir = normalize(-mvPos.xyz);",
        "  vHeight = clamp(position.y * 0.5 + 0.5, 0.0, 1.0);",
        "  gl_Position = projectionMatrix * mvPos;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uTopColor;",
        "uniform vec3 uBotColor;",
        "uniform vec3 uRimColor;",
        "varying vec3 vNormalW;",
        "varying vec3 vViewDir;",
        "varying float vHeight;",
        "void main() {",
        "  vec3 baseCol = mix(uBotColor, uTopColor, vHeight);",
        "  vec3 lightDir = normalize(vec3(0.45, 0.78, 0.65));",
        "  float diff = clamp(dot(vNormalW, lightDir) * 0.5 + 0.5, 0.25, 1.0);",
        "  float fresnel = pow(1.0 - max(dot(vViewDir, vNormalW), 0.0), 2.3);",
        "  vec3 col = baseCol * (0.62 + 0.42 * diff) + uRimColor * fresnel * 0.42;",
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
      ].join("\n")
    });
  }

  function createKawaiiBuilding(mats, outlineMat, opts) {
    var g = new THREE.Group();
    g.position.set(opts.x, 0, opts.z);
    var body = addOutlinedMesh(
      new THREE.BoxGeometry(opts.w, opts.h, opts.d),
      new THREE.MeshLambertMaterial({ color: opts.bodyHex }),
      outlineMat,
      0.055
    );
    body.group.position.set(0, opts.h / 2, 0);
    var roofMat = new THREE.MeshLambertMaterial({ color: opts.roofHex });
    var roof = addOutlinedMesh(
      new THREE.BoxGeometry(opts.w + 0.36, 0.38, opts.d + 0.36),
      roofMat,
      outlineMat,
      0.05
    );
    roof.group.position.set(0, opts.h + 0.19, 0);
    g.add(body.group, roof.group);

    var cols = Math.max(2, Math.floor(opts.w / 1.35));
    var rows = Math.max(1, Math.floor((opts.h - 1.8) / 1.35));
    var startX = -((cols - 1) * 1.1) / 2;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var win = addOutlinedMesh(
          new THREE.BoxGeometry(0.66, 0.78, 0.08),
          (r + c) % 2 === 0 ? mats.winLit : mats.winGlass,
          outlineMat,
          0.032,
          false,
          false
        );
        win.group.position.set(startX + c * 1.1, 2.2 + r * 1.3, opts.d / 2 + 0.05);
        g.add(win.group);
      }
    }

    if (opts.hasAwning !== false) {
      var awnGeo = new THREE.CylinderGeometry(0.42, 0.42, opts.w * 0.76, 16, 1, false, 0, Math.PI * 0.5);
      awnGeo.rotateZ(Math.PI / 2);
      var awn = addOutlinedMesh(awnGeo, roofMat, outlineMat, 0.04, true, false);
      awn.group.position.set(0, 1.35, opts.d / 2 + 0.02);
      var door = addOutlinedMesh(new THREE.BoxGeometry(0.92, 1.28, 0.1), mats.winLit, outlineMat, 0.035, false, false);
      door.group.position.set(0, 0.64, opts.d / 2 + 0.04);
      g.add(awn.group, door.group);
    }
    return g;
  }

  function createKawaiiTree(mats, outlineMat, x, z, scale) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale || 1);
    var trunk = addOutlinedMesh(new THREE.CylinderGeometry(0.2, 0.28, 1.2, 16), mats.trunk, outlineMat, 0.042);
    trunk.group.position.set(0, 0.6, 0);
    g.add(trunk.group);
    [[0, 1.65, 0, 0.88, mats.foliage1], [0.42, 2.1, 0.15, 0.62, mats.foliage2], [-0.44, 1.98, -0.1, 0.58, mats.foliage2]].forEach(function (cr) {
      var puff = addOutlinedMesh(new THREE.SphereGeometry(cr[3], 20, 20), cr[4], outlineMat, 0.044);
      puff.group.position.set(cr[0], cr[1], cr[2]);
      g.add(puff.group);
    });
    return g;
  }

  function createCuteRoundedCar(mats, outlineMat, bodyHex, roofHex, x0, laneZ, dir, speed) {
    var g = new THREE.Group();
    g.position.set(x0, 0, laneZ);
    var chGeo = new THREE.SphereGeometry(0.65, 24, 18);
    chGeo.scale(1.58, 0.62, 0.88);
    var chassis = addOutlinedMesh(chGeo, new THREE.MeshLambertMaterial({ color: bodyHex }), outlineMat, 0.045);
    chassis.group.position.set(0, 0.46, 0);
    var cabGeo = new THREE.SphereGeometry(0.52, 24, 18);
    cabGeo.scale(1.22, 0.72, 0.78);
    var cabin = addOutlinedMesh(cabGeo, new THREE.MeshLambertMaterial({ color: roofHex }), outlineMat, 0.042);
    cabin.group.position.set(-0.08 * dir, 0.78, 0);
    var winGeo = new THREE.SphereGeometry(0.45, 20, 14);
    winGeo.scale(1.08, 0.52, 0.83);
    var winMesh = new THREE.Mesh(winGeo, mats.winGlass);
    winMesh.position.set(-0.06 * dir, 0.8, 0);
    g.add(chassis.group, cabin.group, winMesh);

    var tireGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 20);
    tireGeo.rotateX(Math.PI / 2);
    var hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.22, 16);
    hubGeo.rotateX(Math.PI / 2);
    [[-0.56, 0.5], [0.56, 0.5], [-0.56, -0.5], [0.56, -0.5]].forEach(function (w) {
      var tMesh = new THREE.Mesh(tireGeo, mats.darkInk);
      tMesh.position.set(w[0], 0.25, w[1]);
      var hMesh = new THREE.Mesh(hubGeo, mats.shirt);
      hMesh.position.set(w[0], 0.25, w[1]);
      g.add(tMesh, hMesh);
    });
    return { group: g, x0: x0, speed: speed * dir };
  }

  function buildChibiHero(mats, outlineMat) {
    var root = new THREE.Group();
    var bodyBounce = new THREE.Group();
    root.add(bodyBounce);

    var headGroup = new THREE.Group();
    headGroup.position.set(0, 1.92, 0);
    bodyBounce.add(headGroup);
    headGroup.add(new THREE.Mesh(createWavySpongeHeadGeometry(false), mats.sponge));
    headGroup.add(new THREE.Mesh(createWavySpongeHeadGeometry(true, 0.072), outlineMat));

    [
      [-0.98, 0.64, 0.115, 0.115, mats.pore, 0],
      [0.64, 0.32, 0.105, 0.105, mats.pore, 0],
      [-1.02, -0.54, 0.088, 0.088, mats.pore, 0],
      [0.86, -0.52, 0.105, 0.105, mats.pore, 0],
      [0.88, 0.74, 0.092, 0.082, mats.shirt, -0.3],
      [1.05, 0.58, 0.046, 0.082, mats.shirt, -0.2]
    ].forEach(function (pr) {
      var dot = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), pr[4]);
      dot.scale.set(pr[2], pr[3], 0.03);
      dot.position.set(pr[0], pr[1], 0.61);
      dot.rotation.z = pr[5];
      headGroup.add(dot);
    });

    var face = new THREE.Group();
    face.position.set(0, -0.1, 0.645);
    headGroup.add(face);

    function makeEye(x) {
      var g = new THREE.Group();
      var m = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 24), mats.darkInk);
      m.scale.set(0.86, 1.14, 0.32);
      g.add(m);
      g.position.set(x, 0.04, 0.01);
      return g;
    }
    var leftEye = makeEye(-0.35);
    var rightEye = makeEye(0.35);
    face.add(leftEye, rightEye);

    [-0.72, 0.72].forEach(function (cx) {
      var cheekGroup = new THREE.Group();
      var cheek = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 14), mats.blush);
      cheek.scale.set(1.08, 0.92, 0.15);
      cheekGroup.add(cheek);
      [-0.055, 0.055].forEach(function (tx) {
        var tick = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), mats.blushTick);
        tick.scale.set(0.75, 1.85, 0.5);
        tick.position.set(tx, -0.01, 0.035);
        tick.rotation.z = -0.15;
        cheekGroup.add(tick);
      });
      cheekGroup.position.set(cx, -0.14, -0.01);
      face.add(cheekGroup);
    });

    var smilePts = [];
    for (var si = 0; si <= 12; si++) {
      var st = (si / 12) * 2 - 1;
      smilePts.push(new THREE.Vector3(st * 0.092, (st * st - 1) * 0.065, 0));
    }
    var smileGroup = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePts), 16, 0.032, 10, false),
      mats.darkInk
    );
    smileGroup.position.set(0, -0.04, 0.025);
    var talkMouth = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), mats.darkInk);
    talkMouth.scale.set(1.0, 0.85, 0.25);
    talkMouth.position.set(0, -0.08, 0.025);
    face.add(smileGroup, talkMouth);

    var torso = new THREE.Group();
    torso.position.set(0, 0.72, 0);
    bodyBounce.add(torso);
    var shirt = addOutlinedMesh(createSmoothTorsoPartGeometry(1.04, 1.12, 0.54, 0.65), mats.shirt, outlineMat, 0.058);
    shirt.group.position.set(0, 0.19, 0);
    torso.add(shirt.group);
    var pants = addOutlinedMesh(createSmoothTorsoPartGeometry(1.12, 0.98, 0.46, 0.65), mats.pants, outlineMat, 0.058);
    pants.group.position.set(0, -0.2, 0);
    torso.add(pants.group);

    var waist = new THREE.TorusGeometry(1.0, 0.03, 12, 48);
    waist.rotateX(Math.PI / 2);
    waist.scale(1.11, 1.0, 0.655);
    var waistMesh = new THREE.Mesh(waist, mats.darkInk);
    waistMesh.position.set(0, -0.02, 0);
    torso.add(waistMesh);

    [-0.56, -0.19, 0.19, 0.56].forEach(function (ang) {
      var dPts = [];
      for (var k = -3; k <= 3; k++) {
        var a = ang + k * 0.025;
        dPts.push(new THREE.Vector3(Math.sin(a) * 1.11, -0.15, Math.cos(a) * 0.725));
      }
      torso.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(dPts), 10, 0.024, 8, false), mats.darkInk));
    });

    var tieGroup = new THREE.Group();
    tieGroup.position.set(0, 0.2, 0.72);
    var tieKnot = addOutlinedMesh(new THREE.SphereGeometry(0.1, 16, 14), mats.coralTie, outlineMat, 0.025, false, false).group;
    tieKnot.scale.set(1.15, 0.9, 0.4);
    var tieBladeGeo = new THREE.SphereGeometry(1, 20, 16);
    var tbPos = tieBladeGeo.attributes.position;
    for (var ti = 0; ti < tbPos.count; ti++) {
      var tx = tbPos.getX(ti);
      var ty = tbPos.getY(ti);
      var tz = tbPos.getZ(ti);
      var dw = (1.0 - Math.pow(Math.abs(ty), 0.85)) * 0.16;
      tbPos.setXYZ(ti, Math.sign(tx) * Math.pow(Math.abs(tx), 0.75) * dw, ty * 0.17, tz * 0.035);
    }
    tieBladeGeo.computeVertexNormals();
    var tieBlade = addOutlinedMesh(tieBladeGeo, mats.coralTie, outlineMat, 0.025, false, false).group;
    tieBlade.position.set(0, -0.19, 0.01);
    tieGroup.add(tieKnot, tieBlade);
    torso.add(tieGroup);

    function makeArm(side) {
      var g = new THREE.Group();
      g.position.set(side * 1.02, 0.9, 0);
      var sleeve = addOutlinedMesh(new THREE.SphereGeometry(0.19, 20, 18), mats.shirt, outlineMat, 0.045).group;
      sleeve.scale.set(1.3, 0.9, 0.86);
      sleeve.position.set(side * 0.15, -0.03, 0);
      var hand = addOutlinedMesh(new THREE.SphereGeometry(0.165, 20, 20), mats.sponge, outlineMat, 0.045).group;
      hand.position.set(side * 0.34, -0.08, 0);
      g.add(sleeve, hand);
      return g;
    }
    function makeLeg(side) {
      var g = new THREE.Group();
      g.position.set(side * 0.44, 0.34, 0);
      var pipe = addOutlinedMesh(createSmoothTorsoPartGeometry(0.33, 0.3, 0.22, 0.82), mats.pants, outlineMat, 0.045).group;
      var foot = addOutlinedMesh(new THREE.SphereGeometry(0.24, 20, 18), mats.sponge, outlineMat, 0.045).group;
      foot.scale.set(1.05, 0.8, 0.88);
      foot.position.set(0, -0.14, 0);
      g.add(pipe, foot);
      return g;
    }
    var leftArm = makeArm(-1);
    var rightArm = makeArm(1);
    var leftLeg = makeLeg(-1);
    var rightLeg = makeLeg(1);
    bodyBounce.add(leftArm, rightArm, leftLeg, rightLeg);

    return {
      root: root,
      bodyBounce: bodyBounce,
      headGroup: headGroup,
      leftEye: leftEye,
      rightEye: rightEye,
      smileGroup: smileGroup,
      talkMouth: talkMouth,
      leftArm: leftArm,
      rightArm: rightArm,
      leftLeg: leftLeg,
      rightLeg: rightLeg
    };
  }

  function initStage(canvas, width, height) {
    if (typeof THREE === "undefined" || !canvas) return null;

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xdbeafe, 0.008);

    var camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 160);
    camera.position.set(0, 2.2, 13.5);
    camera.lookAt(0, 1.35, 0);

    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    var sunLight = new THREE.DirectionalLight(0xfffbeb, 0.48);
    sunLight.position.set(10, 20, 15);
    sunLight.castShadow = true;
    scene.add(sunLight);

    var outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
    var mats = {
      sponge: new THREE.MeshLambertMaterial({ color: 0xfef08a }),
      pore: new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
      shirt: new THREE.MeshLambertMaterial({ color: 0xffffff }),
      coralTie: new THREE.MeshLambertMaterial({ color: 0xfb7185 }),
      pants: new THREE.MeshLambertMaterial({ color: 0xc6a992 }),
      blush: new THREE.MeshBasicMaterial({ color: 0xfda4af }),
      blushTick: new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
      darkInk: new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR }),
      foliage1: new THREE.MeshLambertMaterial({ color: 0x4ade80 }),
      foliage2: new THREE.MeshLambertMaterial({ color: 0x86efac }),
      trunk: new THREE.MeshLambertMaterial({ color: 0x9a5b32 }),
      winLit: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      winGlass: new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
    };

    var sidewalk = addOutlinedMesh(
      new THREE.BoxGeometry(60, 0.24, 6.2),
      new THREE.MeshLambertMaterial({ color: 0xf1f5f9 }),
      outlineMat,
      0.04,
      false,
      true
    );
    sidewalk.group.position.set(0, -0.09, 2.0);
    scene.add(sidewalk.group);

    var road = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 5.4),
      new THREE.MeshLambertMaterial({ color: 0x64748b })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, -3.8);
    scene.add(road);

    for (var zc = -2; zc <= 2; zc++) {
      var zebra = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.42), mats.shirt);
      zebra.rotation.x = -Math.PI / 2;
      zebra.position.set(-4.2, 0.025, -3.8 + zc * 0.65);
      scene.add(zebra);
    }

    [
      { x: -11.5, z: -9.8, w: 4.2, h: 4.6, d: 3.4, bodyHex: 0xfda4af, roofHex: 0xe11d48 },
      { x: -6.5, z: -9.8, w: 4.4, h: 5.2, d: 3.6, bodyHex: 0x93c5fd, roofHex: 0x0284c7 },
      { x: -1.3, z: -10.2, w: 4.6, h: 4.3, d: 3.6, bodyHex: 0xd8b4fe, roofHex: 0x7c3aed },
      { x: 4.0, z: -9.8, w: 4.4, h: 4.8, d: 3.6, bodyHex: 0xfdba74, roofHex: 0xea580c },
      { x: 9.2, z: -9.6, w: 4.2, h: 4.5, d: 3.4, bodyHex: 0x86efac, roofHex: 0x16a34a }
    ].forEach(function (cfg) {
      scene.add(createKawaiiBuilding(mats, outlineMat, cfg));
    });

    [-4.8, 4.8].forEach(function (tx) {
      scene.add(createKawaiiTree(mats, outlineMat, tx, 0.4, 0.92));
      var bench = addOutlinedMesh(
        new THREE.BoxGeometry(1.4, 0.14, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xe6b89c }),
        outlineMat,
        0.03
      );
      bench.group.position.set(tx * 1.25, 0.38, 0.9);
      scene.add(bench.group);
    });

    var sunMesh = addOutlinedMesh(new THREE.SphereGeometry(1.35, 24, 24), mats.winLit, outlineMat, 0.06, false, false).group;
    sunMesh.position.set(5.5, 9.5, -17.0);
    scene.add(sunMesh);

    var clouds = [
      { x0: -5.5, y: 7.4, z: -13.5, speed: 0.35, group: new THREE.Group() },
      { x0: 4.5, y: 8.2, z: -14.5, speed: 0.25, group: new THREE.Group() }
    ];
    clouds.forEach(function (cl) {
      [[0, 0, 1.0], [-0.82, -0.1, 0.72], [0.82, -0.1, 0.75]].forEach(function (p) {
        var puff = addOutlinedMesh(new THREE.SphereGeometry(p[2], 20, 20), mats.shirt, outlineMat, 0.05, false, false);
        puff.group.position.set(p[0], p[1], 0);
        cl.group.add(puff.group);
      });
      cl.group.position.set(cl.x0, cl.y, cl.z);
      scene.add(cl.group);
    });

    var cars = [
      createCuteRoundedCar(mats, outlineMat, 0xff8fab, 0xfff0f3, -9, -2.9, 1, 2.9),
      createCuteRoundedCar(mats, outlineMat, 0x7dd3fc, 0xf0f9ff, 7, -4.8, -1, 3.2),
      createCuteRoundedCar(mats, outlineMat, 0xfde047, 0xfefce8, 2, -2.9, 1, 2.5)
    ];
    cars.forEach(function (c) {
      scene.add(c.group);
    });

    var hero = buildChibiHero(mats, outlineMat);
    hero.root.position.set(0, 0, 1.8);
    scene.add(hero.root);

    return {
      scene: scene,
      camera: camera,
      renderer: renderer,
      hero: hero,
      clouds: clouds,
      cars: cars,
      projectHead: function () {
        var v = new THREE.Vector3();
        hero.headGroup.getWorldPosition(v);
        v.y += 1.45;
        v.project(camera);
        return {
          x: (v.x * 0.5 + 0.5) * width,
          y: (-v.y * 0.5 + 0.5) * height
        };
      }
    };
  }

  window.ClayKit = {
    createSmoothOutlineGeometry: createSmoothOutlineGeometry,
    addOutlinedMesh: addOutlinedMesh,
    createWavySpongeHeadGeometry: createWavySpongeHeadGeometry,
    createSmoothTorsoPartGeometry: createSmoothTorsoPartGeometry,
    createSoftClayMaterial: createSoftClayMaterial,
    createKawaiiBuilding: createKawaiiBuilding,
    createKawaiiTree: createKawaiiTree,
    createCuteRoundedCar: createCuteRoundedCar,
    initStage: initStage
  };
})();
