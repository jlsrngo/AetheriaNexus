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
      var outGeo = createSmoothOutlineGeometry(geo, thickness);
      group.add(new THREE.Mesh(outGeo, outlineMat));
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

  function buildChibiHero(mats, outlineMat) {
    var root = new THREE.Group();
    var bodyBounce = new THREE.Group();
    root.add(bodyBounce);

    var headGroup = new THREE.Group();
    headGroup.position.set(0, 1.92, 0);
    bodyBounce.add(headGroup);
    headGroup.add(new THREE.Mesh(createWavySpongeHeadGeometry(false), mats.spongeClay));
    headGroup.add(new THREE.Mesh(createWavySpongeHeadGeometry(true, 0.072), outlineMat));

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
      var cheek = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 14), mats.blush);
      cheek.scale.set(1.08, 0.92, 0.15);
      cheek.position.set(cx, -0.14, -0.01);
      face.add(cheek);
    });

    var talkMouth = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), mats.darkInk);
    talkMouth.scale.set(1.0, 0.65, 0.25);
    talkMouth.position.set(0, -0.08, 0.025);
    face.add(talkMouth);

    [
      [-0.98, 0.64, 0.115],
      [0.64, 0.32, 0.105],
      [-1.02, -0.54, 0.088],
      [0.86, -0.52, 0.105]
    ].forEach(function (pr) {
      var pore = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mats.pore);
      pore.scale.set(pr[2], pr[2], 0.03);
      pore.position.set(pr[0], pr[1], 0.61);
      headGroup.add(pore);
    });

    var torso = new THREE.Group();
    torso.position.set(0, 0.72, 0);
    bodyBounce.add(torso);
    var shirt = addOutlinedMesh(createSmoothTorsoPartGeometry(1.04, 1.12, 0.54, 0.65), mats.shirt, outlineMat, 0.058);
    shirt.group.position.set(0, 0.19, 0);
    torso.add(shirt.group);
    var pants = addOutlinedMesh(createSmoothTorsoPartGeometry(1.12, 0.98, 0.46, 0.65), mats.pants, outlineMat, 0.058);
    pants.group.position.set(0, -0.2, 0);
    torso.add(pants.group);

    // Coral diamond tie sculpted smoothly without spiky extrusions
    var tieGroup = new THREE.Group();
    tieGroup.position.set(0, 0.2, 0.72);
    var tieKnot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 14), mats.coralTie);
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

    function makeLimb(x, y, geo, mat) {
      var g = new THREE.Group();
      g.position.set(x, y, 0);
      g.add(addOutlinedMesh(geo, mat, outlineMat, 0.045).group);
      return g;
    }
    var leftArm = makeLimb(-1.12, 0.88, new THREE.SphereGeometry(0.22, 20, 20), mats.sponge);
    var rightArm = makeLimb(1.12, 0.88, new THREE.SphereGeometry(0.22, 20, 20), mats.sponge);
    var leftLeg = makeLimb(-0.44, 0.24, new THREE.SphereGeometry(0.24, 20, 20), mats.sponge);
    var rightLeg = makeLimb(0.44, 0.24, new THREE.SphereGeometry(0.24, 20, 20), mats.sponge);
    bodyBounce.add(leftArm, rightArm, leftLeg, rightLeg);

    return {
      root: root,
      bodyBounce: bodyBounce,
      headGroup: headGroup,
      leftEye: leftEye,
      rightEye: rightEye,
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

    // Narrower portrait FOV frames vertical town + character cleanly on 1080x1920
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
    var sun = new THREE.DirectionalLight(0xfffbeb, 0.48);
    sun.position.set(10, 20, 15);
    sun.castShadow = true;
    scene.add(sun);

    var outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
    var mats = {
      sponge: new THREE.MeshLambertMaterial({ color: 0xfef08a }),
      spongeClay: createSoftClayMaterial(0xfef08a, 0xfde047, 0xfffbeb),
      pore: new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
      shirt: new THREE.MeshLambertMaterial({ color: 0xffffff }),
      coralTie: new THREE.MeshLambertMaterial({ color: 0xfb7185 }),
      pants: new THREE.MeshLambertMaterial({ color: 0xc6a992 }),
      blush: new THREE.MeshBasicMaterial({ color: 0xfda4af }),
      darkInk: new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR }),
      foliage: new THREE.MeshLambertMaterial({ color: 0x4ade80 }),
      trunk: new THREE.MeshLambertMaterial({ color: 0x9a5b32 })
    };

    var sidewalk = addOutlinedMesh(
      new THREE.BoxGeometry(50, 0.24, 6.2),
      new THREE.MeshLambertMaterial({ color: 0xf1f5f9 }),
      outlineMat,
      0.04,
      false,
      true
    );
    sidewalk.group.position.set(0, -0.09, 2.0);
    scene.add(sidewalk.group);

    var road = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 5.2),
      new THREE.MeshLambertMaterial({ color: 0x64748b })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, -3.7);
    scene.add(road);

    var buildings = [
      [-6.8, -9.6, 4.2, 5.2, 3.4, 0x93c5fd, 0x0284c7],
      [-1.8, -10.0, 4.4, 4.5, 3.4, 0xd8b4fe, 0x7c3aed],
      [3.6, -9.6, 4.2, 4.9, 3.4, 0xfdba74, 0xea580c]
    ];
    buildings.forEach(function (b) {
      var bg = new THREE.Group();
      bg.position.set(b[0], 0, b[1]);
      var body = addOutlinedMesh(
        new THREE.BoxGeometry(b[2], b[3], b[4]),
        new THREE.MeshLambertMaterial({ color: b[5] }),
        outlineMat,
        0.055
      );
      body.group.position.set(0, b[3] / 2, 0);
      var roof = addOutlinedMesh(
        new THREE.BoxGeometry(b[2] + 0.35, 0.38, b[4] + 0.35),
        new THREE.MeshLambertMaterial({ color: b[6] }),
        outlineMat,
        0.05
      );
      roof.group.position.set(0, b[3] + 0.19, 0);
      bg.add(body.group, roof.group);
      scene.add(bg);
    });

    [-4.8, 4.8].forEach(function (tx) {
      var tree = new THREE.Group();
      tree.position.set(tx, 0, -0.2);
      var trunk = addOutlinedMesh(new THREE.CylinderGeometry(0.18, 0.25, 1.1, 16), mats.trunk, outlineMat, 0.04);
      trunk.group.position.set(0, 0.55, 0);
      var crown = addOutlinedMesh(new THREE.SphereGeometry(0.85, 20, 20), mats.foliage, outlineMat, 0.045);
      crown.group.position.set(0, 1.55, 0);
      tree.add(trunk.group, crown.group);
      scene.add(tree);
    });

    var clouds = [
      { x0: -5.5, y: 7.4, z: -13.5, speed: 0.35, group: new THREE.Group() },
      { x0: 4.5, y: 8.1, z: -14.5, speed: 0.25, group: new THREE.Group() }
    ];
    clouds.forEach(function (cl) {
      [[0, 0, 1.0], [-0.8, -0.1, 0.72], [0.8, -0.1, 0.75]].forEach(function (p) {
        var puff = addOutlinedMesh(new THREE.SphereGeometry(p[2], 20, 20), mats.shirt, outlineMat, 0.05, false, false);
        puff.group.position.set(p[0], p[1], 0);
        cl.group.add(puff.group);
      });
      cl.group.position.set(cl.x0, cl.y, cl.z);
      scene.add(cl.group);
    });

    var carGroup = new THREE.Group();
    carGroup.add(
      addOutlinedMesh(
        new THREE.SphereGeometry(0.65, 24, 18),
        new THREE.MeshLambertMaterial({ color: 0xff8fab }),
        outlineMat,
        0.045
      ).group
    );
    carGroup.scale.set(1.55, 0.75, 0.85);
    carGroup.position.set(-8, 0.45, -2.9);
    scene.add(carGroup);

    var hero = buildChibiHero(mats, outlineMat);
    hero.root.position.set(0, 0, 1.8);
    scene.add(hero.root);

    return {
      scene: scene,
      camera: camera,
      renderer: renderer,
      hero: hero,
      clouds: clouds,
      carGroup: carGroup,
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
    initStage: initStage
  };
})();
