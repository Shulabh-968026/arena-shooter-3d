(() => {
  'use strict';

  // ------------------------------------------------------------------
  // Config
  // ------------------------------------------------------------------
  const ARENA = 30;             // half-size of the arena floor
  const PLAYER_R = 0.55;
  const ENEMY_R = 0.55;
  const EYE = 1.6;
  const PLAYER_SPEED = 6.5;
  const PLAYER_TURN = 2.6;
  const WIN_SCORE = 5;
  const MEDKIT_HEAL = 40;
  const PICKUP_RESPAWN = 15;
  const SWITCH_TIME = 0.35;

  const WEAPONS = [
    { name: 'Pistol', mag: 12, reserve: Infinity, maxReserve: Infinity, refill: 0,
      fire: 0.22, reload: 1.1, dmg: 25, pellets: 1, spread: 0.004, speed: 90, life: 2.5,
      recoil: 0.8, gap: 6, color: 0x9ff3ff, sound: 'pistol' },
    { name: 'Assault Rifle', mag: 30, reserve: 60, maxReserve: 180, refill: 30,
      fire: 0.09, reload: 1.6, dmg: 11, pellets: 1, spread: 0.025, speed: 110, life: 2.5,
      recoil: 0.45, gap: 9, color: 0xffd27a, sound: 'rifle' },
    { name: 'Shotgun', mag: 6, reserve: 12, maxReserve: 36, refill: 6,
      fire: 0.85, reload: 1.9, dmg: 10, pellets: 8, spread: 0.11, speed: 70, life: 0.38,
      recoil: 1.6, gap: 16, color: 0xff9ae8, sound: 'shotgun' },
    { name: 'Railgun', mag: 3, reserve: 6, maxReserve: 15, refill: 3,
      fire: 1.2, reload: 2.0, dmg: 75, pellets: 1, spread: 0, hitscan: true,
      recoil: 2, gap: 3, color: 0x4dff9a, sound: 'rail' },
  ];

  const ICONS = [
    '<svg viewBox="0 0 64 28"><path d="M10 6h34v4h4v4H26l-3 12h-9l3-12h-7z"/></svg>',
    '<svg viewBox="0 0 64 28"><path d="M2 9h8l2-3h30V4h8v5h12v4H46v3H34l-2 9h-6l1-9h-6l-4 7H6l4-7H2z"/></svg>',
    '<svg viewBox="0 0 64 28"><path d="M2 10h60v5H36v3H22l-6 7H6l6-10H2z"/></svg>',
    '<svg viewBox="0 0 64 28"><path d="M4 8h38l4-4h14v14H46l-4-4h-8l-3 10h-8l3-10H4z"/><path d="M48 6h2v10h-2zm5 0h2v10h-2z" opacity=".45"/></svg>',
  ];

  const DIFF = {
    easy:   { speed: 3.6, turn: 2.2, fire: 1.0,  spread: 0.09,  reaction: 0.9,  dmg: 8,  hp: 80 },
    normal: { speed: 4.6, turn: 3.0, fire: 0.7,  spread: 0.055, reaction: 0.55, dmg: 10, hp: 100 },
    hard:   { speed: 5.6, turn: 4.0, fire: 0.45, spread: 0.03,  reaction: 0.3,  dmg: 12, hp: 120 },
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const forward = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
  const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
  function angDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  // ------------------------------------------------------------------
  // Renderer / scene
  // ------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  $('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f1a);
  scene.fog = new THREE.Fog(0x0b0f1a, 28, 80);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 200);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x1a1020, 0.65));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(20, 40, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 100 });
  scene.add(sun);

  // Floor
  function gridTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#161d2e';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#2d3b5c';
    g.lineWidth = 4;
    g.strokeRect(0, 0, 256, 256);
    g.strokeStyle = '#1f2940';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(128, 0); g.lineTo(128, 256);
    g.moveTo(0, 128); g.lineTo(256, 128);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(ARENA / 2, ARENA / 2);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
    new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 0.85, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Obstacles (axis aligned boxes, used for collision + line of sight)
  const obstacles = [];
  function addBox(x, z, w, d, h, color, glow) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.25 })
    );
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    if (glow) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.04, 0.08, d + 0.04),
        new THREE.MeshBasicMaterial({ color: glow })
      );
      strip.position.set(x, h - 0.25, z);
      scene.add(strip);
    }
    obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  // Outer walls
  const WALL = 0x232b45, CYAN = 0x33e1ff, MAG = 0xff4fd8, ORANGE = 0xff9a3c;
  addBox(0, -ARENA - 0.5, ARENA * 2 + 2, 1, 4, WALL, CYAN);
  addBox(0, ARENA + 0.5, ARENA * 2 + 2, 1, 4, WALL, CYAN);
  addBox(-ARENA - 0.5, 0, 1, ARENA * 2, 4, WALL, CYAN);
  addBox(ARENA + 0.5, 0, 1, ARENA * 2, 4, WALL, CYAN);

  // Interior cover (symmetric so neither side is favoured)
  addBox(0, 0, 4, 4, 3.4, 0x343d5e, ORANGE);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    addBox(10 * sx, 10 * sz, 3, 3, 2.6, 0x3a4466, MAG);
    addBox(20 * sx, 20 * sz, 2.2, 2.2, 2.2, 0x2f3858, CYAN);
    addBox(7 * sx, 23 * sz, 2, 2, 2.2, 0x2f3858, CYAN);
    addBox(23 * sx, 8 * sz, 2, 2, 2.2, 0x2f3858, CYAN);
  }
  for (const s of [-1, 1]) {
    addBox(0, 16 * s, 8, 1.4, 2.2, 0x3a4466, CYAN);
    addBox(16 * s, 0, 1.4, 8, 2.2, 0x3a4466, CYAN);
  }

  // ------------------------------------------------------------------
  // Geometry helpers
  // ------------------------------------------------------------------
  function collide(p, r) {
    for (const b of obstacles) {
      const cx = clamp(p.x, b.minX, b.maxX);
      const cz = clamp(p.z, b.minZ, b.maxZ);
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      } else {
        const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z;
        const m = Math.min(l, rr, t, bt);
        if (m === l) p.x = b.minX - r;
        else if (m === rr) p.x = b.maxX + r;
        else if (m === t) p.z = b.minZ - r;
        else p.z = b.maxZ + r;
      }
    }
  }

  // Liang–Barsky segment vs. AABB in the XZ plane. Returns entry t in [0,1] or null.
  function segBox(ax, az, bx, bz, b) {
    const dx = bx - ax, dz = bz - az;
    const p = [-dx, dx, -dz, dz];
    const q = [ax - b.minX, b.maxX - ax, az - b.minZ, b.maxZ - az];
    let t0 = 0, t1 = 1;
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return null;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > t1) return null;
          if (t > t0) t0 = t;
        } else {
          if (t < t0) return null;
          if (t < t1) t1 = t;
        }
      }
    }
    return t0;
  }

  function rayObstacles(ax, az, bx, bz) {
    let best = null;
    for (const b of obstacles) {
      const t = segBox(ax, az, bx, bz, b);
      if (t !== null && (best === null || t < best)) best = t;
    }
    return best;
  }

  const hasLOS = (a, b) => rayObstacles(a.x, a.z, b.x, b.z) === null;

  function segCircleT(ax, az, bx, bz, cx, cz, r) {
    const dx = bx - ax, dz = bz - az;
    const fx = ax - cx, fz = az - cz;
    const a = dx * dx + dz * dz;
    const b = 2 * (fx * dx + fz * dz);
    const c = fx * fx + fz * fz - r * r;
    if (c <= 0) return 0;
    const disc = b * b - 4 * a * c;
    if (disc < 0 || a === 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
  }

  function randomOpenPoint() {
    for (let i = 0; i < 50; i++) {
      const p = { x: rand(-ARENA + 3, ARENA - 3), z: rand(-ARENA + 3, ARENA - 3) };
      const blocked = obstacles.some(
        (b) => p.x > b.minX - 1.5 && p.x < b.maxX + 1.5 && p.z > b.minZ - 1.5 && p.z < b.maxZ + 1.5
      );
      if (!blocked) return p;
    }
    return { x: 0, z: 20 };
  }

  // ------------------------------------------------------------------
  // Audio (synthesised – no asset files needed)
  // ------------------------------------------------------------------
  let actx = null, noise = null;
  function initAudio() {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      noise = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { actx = null; }
  }

  function tone(type, f0, f1, dur, vol, delay = 0) {
    const t = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  function burst(freq, dur, vol) {
    const t = actx.currentTime;
    const s = actx.createBufferSource();
    s.buffer = noise;
    const f = actx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(actx.destination);
    s.start(t);
    s.stop(t + dur);
  }

  function sfx(type, vol = 1) {
    if (!actx || vol <= 0.01) return;
    switch (type) {
      case 'pistol':  burst(3200, 0.18, 0.45 * vol); tone('square', 180, 50, 0.12, 0.25 * vol); break;
      case 'rifle':   burst(4200, 0.09, 0.32 * vol); tone('square', 220, 90, 0.07, 0.18 * vol); break;
      case 'shotgun': burst(1400, 0.4, 0.7 * vol); tone('sawtooth', 120, 35, 0.25, 0.35 * vol); break;
      case 'rail':    tone('sine', 2400, 180, 0.45, 0.3 * vol); tone('square', 90, 40, 0.3, 0.2 * vol); burst(5000, 0.12, 0.25 * vol); break;
      case 'eshoot':  burst(1600, 0.2, 0.35 * vol); tone('sawtooth', 260, 70, 0.14, 0.15 * vol); break;
      case 'hit':     tone('square', 1200, 900, 0.06, 0.15); tone('sine', 1800, 1500, 0.05, 0.1, 0.03); break;
      case 'hurt':    tone('sawtooth', 160, 60, 0.25, 0.3); burst(600, 0.15, 0.25); break;
      case 'impact':  burst(2500, 0.06, 0.12 * vol); break;
      case 'reload':  tone('square', 600, 500, 0.04, 0.12); tone('square', 900, 800, 0.05, 0.12, 0.35); break;
      case 'switch':  tone('square', 300, 250, 0.03, 0.1); tone('square', 520, 470, 0.04, 0.1, 0.12); break;
      case 'empty':   tone('square', 400, 380, 0.03, 0.1); break;
      case 'pickup':  tone('sine', 500, 1100, 0.25, 0.25); tone('sine', 750, 1500, 0.25, 0.15, 0.08); break;
      case 'ammo':    tone('square', 700, 900, 0.08, 0.15); tone('square', 900, 1200, 0.08, 0.15, 0.08); break;
      case 'kill':    tone('sawtooth', 400, 60, 0.6, 0.3); burst(800, 0.5, 0.35); break;
      case 'round':   tone('triangle', 440, 440, 0.15, 0.2); tone('triangle', 660, 660, 0.3, 0.2, 0.15); break;
    }
  }

  // ------------------------------------------------------------------
  // Weapon view-models (rendered in their own scene so they never clip walls)
  // ------------------------------------------------------------------
  const gunScene = new THREE.Scene();
  const gunCam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10);
  gunScene.add(new THREE.HemisphereLight(0x9fc2ff, 0x221830, 0.9));
  const gunSun = new THREE.DirectionalLight(0xffffff, 0.8);
  gunSun.position.set(1, 2, 1);
  gunScene.add(gunSun);

  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2f3d, metalness: 0.7, roughness: 0.35 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x15181f, metalness: 0.6, roughness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.8 });
  const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c });

  const gunRoot = new THREE.Group();
  const GUN_BASE = new THREE.Vector3(0.26, -0.26, -0.5);
  gunRoot.position.copy(GUN_BASE);
  gunScene.add(gunRoot);

  function makeGun(parts, muzzleZ) {
    const g = new THREE.Group();
    for (const [w, h, d, mat, x, y, z] of parts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      g.add(m);
    }
    g.userData.muzzleZ = muzzleZ;
    g.visible = false;
    gunRoot.add(g);
    return g;
  }

  const gunModels = [
    // Pistol
    makeGun([
      [0.1, 0.13, 0.36, metal, 0, 0, 0],
      [0.05, 0.05, 0.12, metal, 0, 0.02, -0.22],
      [0.08, 0.17, 0.09, metal, 0, -0.13, 0.1],
      [0.105, 0.02, 0.26, glowMat(CYAN), 0, 0.05, -0.02],
    ], -0.3),
    // Assault rifle
    makeGun([
      [0.1, 0.14, 0.6, metal, 0, 0, -0.05],
      [0.05, 0.05, 0.35, darkMetal, 0, 0.02, -0.5],
      [0.07, 0.22, 0.1, darkMetal, 0, -0.17, -0.12],
      [0.08, 0.12, 0.25, metal, 0, -0.02, 0.35],
      [0.07, 0.15, 0.08, metal, 0, -0.13, 0.12],
      [0.05, 0.06, 0.18, darkMetal, 0, 0.11, -0.05],
      [0.105, 0.02, 0.4, glowMat(0xffb84d), 0, 0.045, -0.1],
    ], -0.7),
    // Shotgun
    makeGun([
      [0.13, 0.15, 0.45, metal, 0, 0, 0],
      [0.06, 0.06, 0.5, darkMetal, -0.033, 0.03, -0.45],
      [0.06, 0.06, 0.5, darkMetal, 0.033, 0.03, -0.45],
      [0.12, 0.08, 0.22, wood, 0, -0.05, -0.36],
      [0.08, 0.16, 0.09, wood, 0, -0.14, 0.14],
      [0.135, 0.02, 0.3, glowMat(MAG), 0, 0.06, 0],
    ], -0.72),
    // Railgun
    makeGun([
      [0.12, 0.16, 0.6, metal, 0, 0, -0.05],
      [0.08, 0.08, 0.45, darkMetal, 0, 0.01, -0.52],
      [0.15, 0.15, 0.04, glowMat(0x4dff9a), 0, 0.01, -0.4],
      [0.15, 0.15, 0.04, glowMat(0x4dff9a), 0, 0.01, -0.52],
      [0.15, 0.15, 0.04, glowMat(0x4dff9a), 0, 0.01, -0.64],
      [0.08, 0.16, 0.09, metal, 0, -0.14, 0.12],
      [0.125, 0.025, 0.4, glowMat(0x4dff9a), 0, 0.08, -0.05],
    ], -0.78),
  ];

  const flashMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0 })
  );
  gunRoot.add(flashMesh);
  const gunFlashLight = new THREE.PointLight(0xffd27a, 0, 3);
  gunRoot.add(gunFlashLight);
  // world light so muzzle flashes light up the arena too
  const worldFlash = new THREE.PointLight(0xffd27a, 0, 10);
  worldFlash.position.set(0.3, -0.2, -1);
  camera.add(worldFlash);

  // ------------------------------------------------------------------
  // Enemy model
  // ------------------------------------------------------------------
  function buildBot() {
    const armor = new THREE.MeshStandardMaterial({ color: 0xc8333a, metalness: 0.4, roughness: 0.45, emissive: 0xffffff, emissiveIntensity: 0 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d212c, metalness: 0.6, roughness: 0.4 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xff6a3c });

    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const part = (w, h, d, mat, x, y, z, parent = body) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    const legPivot = (x) => {
      const p = new THREE.Group();
      p.position.set(x, 0.85, 0);
      body.add(p);
      part(0.22, 0.85, 0.26, dark, 0, -0.42, 0, p);
      return p;
    };
    const legL = legPivot(-0.17);
    const legR = legPivot(0.17);

    part(0.72, 0.78, 0.42, armor, 0, 1.25, 0);        // torso
    part(0.5, 0.12, 0.44, dark, 0, 0.9, 0);           // belt
    part(0.44, 0.06, 0.02, glow, 0, 1.38, -0.22);     // chest light
    part(0.42, 0.38, 0.4, armor, 0, 1.82, 0);         // head
    part(0.36, 0.1, 0.05, glow, 0, 1.85, -0.21);      // visor
    part(0.18, 0.6, 0.2, dark, -0.46, 1.25, -0.08);   // left arm
    part(0.18, 0.6, 0.2, dark, 0.46, 1.25, -0.12);    // right arm
    part(0.1, 0.14, 0.7, dark, 0.3, 1.2, -0.45);      // rifle
    part(0.11, 0.02, 0.4, glow, 0.3, 1.28, -0.45);    // rifle stripe

    const muzzle = new THREE.PointLight(0xff7a4d, 0, 8);
    muzzle.position.set(0.3, 1.2, -0.9);
    root.add(muzzle);

    scene.add(root);
    return { root, body, legL, legR, armor, muzzle };
  }
  const bot = buildBot();

  // ------------------------------------------------------------------
  // Pickups (medkits + ammo crates)
  // ------------------------------------------------------------------
  const pickups = [];
  function buildPickup(type, x, z) {
    const g = new THREE.Group();
    const padColor = type === 'health' ? 0x2bff88 : 0xffc23d;
    if (type === 'health') {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.4, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xf2f5ff, emissive: 0x335544, roughness: 0.4 })
      );
      box.castShadow = true;
      g.add(box);
      const crossMat = new THREE.MeshBasicMaterial({ color: 0x2bff88 });
      for (const [w, d] of [[0.42, 0.12], [0.12, 0.42]]) {
        g.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.42, d), crossMat));
      }
    } else {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.42, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x4a5530, roughness: 0.7, metalness: 0.2 })
      );
      box.castShadow = true;
      g.add(box);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.52), new THREE.MeshBasicMaterial({ color: 0xffc23d })));
      const shellMat = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.8, roughness: 0.3 });
      for (let i = -1; i <= 1; i++) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), shellMat);
        s.position.set(i * 0.14, 0.31, 0);
        g.add(s);
      }
    }
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 32),
      new THREE.MeshBasicMaterial({ color: padColor, transparent: true, opacity: 0.18 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(x, 0.02, z);
    scene.add(pad);
    g.position.set(x, 0.7, z);
    scene.add(g);
    pickups.push({ type, x, z, mesh: g, pad, active: true, timer: 0 });
  }
  buildPickup('health', -24, 0);
  buildPickup('health', 24, 0);
  buildPickup('ammo', -12, 0);
  buildPickup('ammo', 12, 0);

  function takePickup(p) {
    p.active = false;
    p.timer = PICKUP_RESPAWN;
    p.mesh.visible = false;
    p.pad.material.opacity = 0.05;
  }

  function restorePickup(p) {
    p.active = true;
    p.timer = 0;
    p.mesh.visible = true;
    p.pad.material.opacity = 0.18;
  }

  // ------------------------------------------------------------------
  // Bullets, beams + particles
  // ------------------------------------------------------------------
  const bullets = [];
  const bulletGeo = new THREE.BoxGeometry(0.05, 0.05, 0.9);
  const playerBulletMats = WEAPONS.map((w) => new THREE.MeshBasicMaterial({ color: w.color }));
  const enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xff6a4d });

  function spawnBullet(origin, dir, speed, owner, dmg, life, mat, src) {
    const mesh = new THREE.Mesh(bulletGeo, mat);
    mesh.position.copy(origin);
    mesh.lookAt(origin.x + dir.x, origin.y + dir.y, origin.z + dir.z);
    scene.add(mesh);
    bullets.push({ mesh, pos: origin.clone(), vel: dir.clone().multiplyScalar(speed), owner, dmg, life, src });
  }

  const beams = [];
  function beam(a, b, color) {
    const len = a.distanceTo(b);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, len),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.lookAt(b);
    scene.add(mesh);
    beams.push({ mesh, life: 0.45, max: 0.45 });
  }

  const particles = [];
  const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  function sparks(pos, color, n = 10, speed = 5) {
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      mesh.position.copy(pos);
      scene.add(mesh);
      particles.push({
        mesh,
        vel: new THREE.Vector3(rand(-1, 1), rand(0, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(speed * 0.4, speed)),
        life: rand(0.25, 0.55),
        max: 0.55,
      });
    }
  }

  function clearProjectiles() {
    for (const b of bullets) scene.remove(b.mesh);
    for (const p of particles) { scene.remove(p.mesh); p.mesh.material.dispose(); }
    for (const b of beams) { scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); }
    bullets.length = particles.length = beams.length = 0;
  }

  // ------------------------------------------------------------------
  // Game state
  // ------------------------------------------------------------------
  let state = 'menu';    // menu | playing | paused | roundOver | gameOver
  let difficulty = 'normal';
  let round = 1;
  let score = { player: 0, bot: 0 };
  let stats = { shots: 0, hits: 0, damageTaken: 0 };
  let roundTimer = 0;
  let msgTimer = 0;
  let toastTimer = 0;
  let shake = 0;
  let damageFlash = 0;
  let dmgDirT = 0;
  let hitMarker = 0;
  let elapsed = 0;
  let menuMode = 'bot';

  // online multiplayer
  let online = false, isHost = false, peer = null, conn = null, netSendT = 0;
  const oppName = () => (online ? rivalName || 'RIVAL' : 'BOT');
  const oppHtml = () => esc(oppName());

  // ------------------------------------------------------------------
  // Player name + match history (persisted in localStorage)
  // ------------------------------------------------------------------
  const NAME_KEY = 'arenaDuel.name';
  const HISTORY_KEY = 'arenaDuel.history';
  const HISTORY_MAX = 50;
  let playerName = '';
  let rivalName = '';
  let matchId = '';   // shared by both players of an online match

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);

  function storeGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function storeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  const loadHistory = () => {
    const h = storeGet(HISTORY_KEY, []);
    return Array.isArray(h) ? h : [];
  };

  // Validates the name field; returns false (and shows an error) if it's empty.
  function requireName() {
    const input = $('playerName');
    const name = cleanName(input.value);
    if (!name) {
      $('nameError').textContent = 'Please enter your name before playing.';
      input.classList.remove('invalid');
      void input.offsetWidth;          // restart the shake animation
      input.classList.add('invalid');
      input.focus();
      return false;
    }
    input.value = playerName = name;
    $('nameError').textContent = '';
    input.classList.remove('invalid');
    storeSet(NAME_KEY, name);
    renderHistory();
    return true;
  }

  function saveMatch(entry) {
    const h = loadHistory();
    h.unshift(entry);
    storeSet(HISTORY_KEY, h.slice(0, HISTORY_MAX));
    renderHistory();
  }

  function recordVs(opponent) {
    let w = 0, l = 0;
    for (const m of loadHistory()) {
      if (m.name === playerName && m.opponent === opponent) m.won ? w++ : l++;
    }
    return { w, l };
  }

  function renderHistory() {
    const all = loadHistory();
    const mine = all.filter((m) => m.name === (cleanName($('playerName').value) || playerName));
    const wins = mine.filter((m) => m.won).length;
    const rate = mine.length ? Math.round((wins / mine.length) * 100) : 0;
    const who = cleanName($('playerName').value);
    $('histSummary').innerHTML =
      '<div class="hist-for">' + (who ? 'Stats for <b>' + esc(who) + '</b>' : 'Enter your name to see your stats') + '</div>' +
      '<div><b>' + mine.length + '</b><span>Played</span></div>' +
      '<div><b>' + wins + '</b><span>Wins</span></div>' +
      '<div><b>' + (mine.length - wins) + '</b><span>Losses</span></div>' +
      '<div><b>' + rate + '%</b><span>Win rate</span></div>';

    $('histList').innerHTML = all.length
      ? all.map((m) => {
          const d = new Date(m.date);
          const when = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
            d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
          return '<li><span class="res ' + (m.won ? 'w' : 'l') + '">' + (m.won ? 'W' : 'L') + '</span>' +
            '<span class="who"><b>' + esc(m.name) + ' vs ' + esc(m.opponent) + '</b>' +
            '<small>' + (m.mode === 'online' ? 'Online' : 'Vs Bot') + ' · ' + esc(when) + ' · ' + (m.acc | 0) + '% acc</small></span>' +
            '<span class="sc">' + (m.you | 0) + ' – ' + (m.them | 0) + '</span></li>';
        }).join('')
      : '<li class="hist-empty">No matches yet. Finish a match and it will show up here.</li>';
    $('clearHist').classList.toggle('hidden', !all.length);
    renderLeaderboard();
  }

  // Aggregates match history into per-player records. Online matches count for
  // both players; a match saved by both sides on one device is counted once.
  function leaderboard(filter) {
    const players = new Map();
    const seen = new Set();
    const add = (name, won, rounds) => {
      const key = name.toLowerCase();
      const p = players.get(key) || { name, w: 0, l: 0, played: 0, rounds: 0 };
      p.played++;
      won ? p.w++ : p.l++;
      p.rounds += rounds;
      players.set(key, p);
    };
    for (const m of loadHistory()) {
      if (filter !== 'all' && m.mode !== filter) continue;
      if (m.matchId) {
        if (seen.has(m.matchId)) continue;
        seen.add(m.matchId);
      }
      add(m.name, m.won, m.you | 0);
      if (m.mode === 'online') add(m.opponent, !m.won, m.them | 0);
    }
    return [...players.values()]
      .map((p) => ({ ...p, rate: Math.round((p.w / p.played) * 100) }))
      .sort((a, b) => b.w - a.w || b.rate - a.rate || b.rounds - a.rounds || a.played - b.played);
  }

  let lbFilter = 'all';
  function renderLeaderboard() {
    const me = (cleanName($('playerName').value) || playerName).toLowerCase();
    const rows = leaderboard(lbFilter).slice(0, 10);
    $('lbList').innerHTML = rows.length
      ? rows.map((p, i) => {
          const isMe = p.name.toLowerCase() === me;
          return '<li' + (isMe ? ' class="me"' : '') + '>' +
            '<span class="rank' + (i < 3 ? ' r' + (i + 1) : '') + '">' + (i + 1) + '</span>' +
            '<span class="pname">' + esc(p.name) + (isMe ? '<small>you</small>' : '') + '</span>' +
            '<span>' + p.w + ' – ' + p.l + '</span>' +
            '<span class="rate">' + p.rate + '%</span>' +
            '<span>' + p.played + '</span></li>';
        }).join('')
      : '<li class="hist-empty">No ranked players yet. Win some matches to claim the top spot!</li>';
  }

  function rankOf(name) {
    const i = leaderboard('all').findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    return i < 0 ? null : i + 1;
  }

  const freshAmmo = () => WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve }));

  const player = {
    pos: new THREE.Vector3(), yaw: 0, hp: 100,
    weapon: 0, ammo: freshAmmo(), reload: 0, cool: 0, switchT: 0,
    bob: 0, recoil: 0, dead: false, deathT: 0,
  };
  const curWeapon = () => WEAPONS[player.weapon];
  const curAmmo = () => player.ammo[player.weapon];

  const enemy = {
    pos: new THREE.Vector3(), yaw: Math.PI, hp: 100, maxHp: 100,
    cool: 0, react: 0, seen: false, lastKnown: null, unseenT: 0,
    strafe: 1, strafeT: 0, wp: null, stuckT: 0, stuckRef: { x: 0, z: 0 },
    hitFlash: 0, dead: false, deathT: 0, walk: 0, cfg: DIFF.normal,
  };

  function enemyConfig() {
    const base = DIFF[difficulty];
    const k = round - 1;
    return {
      speed: base.speed * (1 + 0.04 * k),
      turn: base.turn * (1 + 0.05 * k),
      fire: base.fire * Math.pow(0.94, k),
      spread: base.spread * Math.pow(0.9, k),
      reaction: base.reaction * Math.pow(0.92, k),
      dmg: base.dmg,
      hp: base.hp,
    };
  }

  // ------------------------------------------------------------------
  // HUD
  // ------------------------------------------------------------------
  const hud = {
    root: $('hud'), damage: $('damage'), hit: $('hitmarker'), cross: $('crosshair'), dmgDir: $('dmgDir'),
    pHealth: $('playerHealth'), hpText: $('hpText'), eHealth: $('enemyHealth'),
    ammo: $('ammo'), reserve: $('reserve'), wname: $('weaponName'), warn: $('ammoWarn'),
    reloadWrap: $('reloadWrap'), reloadBar: $('reloadBar'),
    msg: $('message'), toast: $('toast'), feed: $('killfeed'),
    scoreP: $('scoreP'), scoreE: $('scoreE'), round: $('roundNum'),
  };
  const mini = $('minimap').getContext('2d');

  // weapon slots
  const slots = WEAPONS.map((w, i) => {
    const el = document.createElement('div');
    el.className = 'slot';
    el.innerHTML = '<span class="key">' + (i + 1) + '</span>' + ICONS[i] +
      '<span class="wname">' + w.name + '</span><span class="wammo"></span>';
    $('weaponBar').appendChild(el);
    return { el, ammo: el.querySelector('.wammo'), text: '' };
  });

  const fmtReserve = (r) => (r === Infinity ? '∞' : r);

  function showMessage(html, secs) {
    hud.msg.innerHTML = html;
    hud.msg.classList.add('show');
    msgTimer = secs;
  }

  function showToast(text) {
    hud.toast.textContent = text;
    hud.toast.classList.add('show');
    toastTimer = 1.2;
  }

  function killFeed(html) {
    const el = document.createElement('div');
    el.className = 'kf';
    el.innerHTML = html;
    hud.feed.prepend(el);
    while (hud.feed.children.length > 4) hud.feed.lastChild.remove();
    setTimeout(() => el.classList.add('out'), 4000);
    setTimeout(() => el.remove(), 4500);
  }

  function updateHUD() {
    hud.pHealth.style.width = Math.max(0, player.hp) + '%';
    hud.hpText.textContent = Math.max(0, Math.ceil(player.hp));
    hud.hpText.style.color = player.hp < 30 ? 'var(--red)' : '';
    hud.eHealth.style.width = Math.max(0, (enemy.hp / enemy.maxHp) * 100) + '%';
    hud.scoreP.textContent = score.player;
    hud.scoreE.textContent = score.bot;
    hud.round.textContent = round;
    hud.damage.style.opacity = damageFlash;
    hud.hit.style.opacity = hitMarker > 0 ? 1 : 0;

    // ammo panel
    const w = curWeapon(), a = curAmmo();
    hud.wname.textContent = w.name;
    hud.ammo.textContent = a.mag;
    hud.reserve.textContent = fmtReserve(a.reserve);
    const low = a.mag <= Math.ceil(w.mag * 0.25);
    hud.ammo.classList.toggle('low', low);
    hud.warn.textContent =
      player.reload > 0 ? 'RELOADING' :
      a.mag === 0 ? (a.reserve > 0 ? 'PRESS R' : 'NO AMMO') :
      low ? 'LOW AMMO' : '';
    hud.reloadWrap.classList.toggle('active', player.reload > 0);
    hud.reloadBar.style.width = player.reload > 0 ? (1 - player.reload / w.reload) * 100 + '%' : '0%';

    // weapon bar
    slots.forEach((s, i) => {
      const am = player.ammo[i];
      const text = am.mag + ' / ' + fmtReserve(am.reserve);
      if (text !== s.text) { s.ammo.textContent = text; s.text = text; }
      s.el.classList.toggle('active', i === player.weapon);
      s.el.classList.toggle('empty', am.mag === 0 && am.reserve === 0);
    });

    // dynamic crosshair
    hud.cross.style.setProperty('--gap', (w.gap + player.recoil * 6) + 'px');

    // damage direction indicator
    if (dmgDirT > 0) {
      const ang = angDiff(player.yaw, yawTo(enemy.pos.x - player.pos.x, enemy.pos.z - player.pos.z));
      hud.dmgDir.style.transform = 'translate(-50%, -50%) rotate(' + -ang + 'rad)';
    }
    hud.dmgDir.style.opacity = Math.min(1, dmgDirT);
  }

  function drawMinimap() {
    const c = mini.canvas, S = c.width;
    const sc = S / (ARENA * 2 + 2);
    const tx = (x) => (x + ARENA + 1) * sc;
    mini.clearRect(0, 0, S, S);
    mini.fillStyle = 'rgba(70, 90, 140, 0.55)';
    for (const b of obstacles) {
      mini.fillRect(tx(b.minX), tx(b.minZ), (b.maxX - b.minX) * sc, (b.maxZ - b.minZ) * sc);
    }
    for (const p of pickups) {
      if (!p.active) continue;
      if (p.type === 'health') {
        mini.fillStyle = '#2bff88';
        mini.fillRect(tx(p.x) - 3, tx(p.z) - 1, 6, 2);
        mini.fillRect(tx(p.x) - 1, tx(p.z) - 3, 2, 6);
      } else {
        mini.fillStyle = '#ffc23d';
        mini.fillRect(tx(p.x) - 3, tx(p.z) - 2, 6, 4);
      }
    }
    // enemy shown only when in line of sight
    if (!enemy.dead && hasLOS(player.pos, enemy.pos)) {
      mini.fillStyle = '#ff4d4d';
      mini.beginPath();
      mini.arc(tx(enemy.pos.x), tx(enemy.pos.z), 4, 0, Math.PI * 2);
      mini.fill();
    }
    // player arrow
    mini.save();
    mini.translate(tx(player.pos.x), tx(player.pos.z));
    mini.rotate(-player.yaw);
    mini.fillStyle = '#33e1ff';
    mini.beginPath();
    mini.moveTo(0, -7);
    mini.lineTo(5, 5);
    mini.lineTo(0, 2);
    mini.lineTo(-5, 5);
    mini.closePath();
    mini.fill();
    mini.restore();
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------
  const keys = {};
  const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  const inGame = () => state === 'playing' || state === 'roundOver';

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') {
      if (e.code === 'Enter') {
        if (e.target.id === 'joinCode') joinRoom();
        else if (menuMode === 'bot') startGame();
      }
      return;
    }
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'Enter' && state === 'menu' && menuMode === 'bot') startGame();
    if (!inGame()) return;
    if (e.code === 'KeyR') startReload();
    if (e.code === 'KeyQ') cycleWeapon(-1);
    if (e.code === 'KeyE') cycleWeapon(1);
    const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
    if (m) switchWeapon(+m[1] - 1);
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    if (state === 'playing' && !online) togglePause();
  });
  let lastWheel = 0;
  window.addEventListener('wheel', (e) => {
    if (!inGame() || performance.now() - lastWheel < 150) return;
    lastWheel = performance.now();
    cycleWeapon(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  // ------------------------------------------------------------------
  // Player weapons
  // ------------------------------------------------------------------
  function equip(i) {
    gunModels.forEach((g, j) => { g.visible = j === i; });
    const z = gunModels[i].userData.muzzleZ;
    flashMesh.position.set(0, 0.02, z);
    gunFlashLight.position.set(0, 0.02, z - 0.05);
    flashMesh.material.color.setHex(WEAPONS[i].color).lerp(new THREE.Color(0xffffff), 0.5);
    worldFlash.color.setHex(WEAPONS[i].color);
  }

  function switchWeapon(i) {
    if (i === player.weapon || i < 0 || i >= WEAPONS.length || player.dead) return;
    player.weapon = i;
    player.reload = 0;
    player.switchT = SWITCH_TIME;
    equip(i);
    sfx('switch');
    showToast(WEAPONS[i].name.toUpperCase());
  }

  const cycleWeapon = (dir) => switchWeapon((player.weapon + dir + WEAPONS.length) % WEAPONS.length);

  function startReload() {
    const w = curWeapon(), a = curAmmo();
    if (player.reload > 0 || player.switchT > 0 || player.dead || a.mag === w.mag || a.reserve <= 0) return;
    player.reload = w.reload;
    sfx('reload');
  }

  function finishReload() {
    const w = curWeapon(), a = curAmmo();
    const take = Math.min(w.mag - a.mag, a.reserve);
    a.mag += take;
    a.reserve -= take;
    player.reload = 0;
  }

  function playerShoot() {
    const w = curWeapon(), a = curAmmo();
    if (player.reload > 0 || player.cool > 0 || player.switchT > 0 || player.dead) return;
    if (a.mag <= 0) {
      player.cool = 0.3;
      sfx('empty');
      if (a.reserve > 0) startReload();
      else { showToast('OUT OF AMMO'); switchWeapon(0); }
      return;
    }
    a.mag--;
    player.cool = w.fire;
    player.recoil = Math.min(2, player.recoil + w.recoil);
    stats.shots += w.pellets;

    const f = forward(player.yaw);
    const origin = new THREE.Vector3(player.pos.x + f.x * 0.5, EYE - 0.12, player.pos.z + f.z * 0.5);
    if (w.hitscan) {
      fireRail(origin, w);
    } else {
      const dirs = [];
      for (let i = 0; i < w.pellets; i++) {
        const d = forward(player.yaw + rand(-1, 1) * w.spread);
        const dir = new THREE.Vector3(d.x, rand(-1, 1) * w.spread * 0.3, d.z).normalize();
        spawnBullet(origin, dir, w.speed, 'player', w.dmg, w.life, playerBulletMats[player.weapon], w.name);
        dirs.push(v3(dir, 3));
      }
      send({ t: 'shot', w: player.weapon, o: v3(origin, 2), d: dirs });
    }
    flashMesh.material.opacity = 1;
    gunFlashLight.intensity = 3;
    worldFlash.intensity = w.hitscan ? 5 : 3;
    sfx(w.sound);
    if (a.mag === 0 && a.reserve > 0) startReload();
  }

  function fireRail(origin, w) {
    const f = forward(player.yaw);
    const far = 120;
    const ex = origin.x + f.x * far, ez = origin.z + f.z * far;
    let t = rayObstacles(origin.x, origin.z, ex, ez);
    if (t === null) t = 1;
    let hitEnemy = false;
    if (!enemy.dead) {
      const te = segCircleT(origin.x, origin.z, ex, ez, enemy.pos.x, enemy.pos.z, ENEMY_R);
      if (te !== null && te < t) { t = te; hitEnemy = true; }
    }
    const end = new THREE.Vector3(origin.x + f.x * far * t, origin.y, origin.z + f.z * far * t);
    // start the beam near the weapon, slightly right and below eye level
    const start = new THREE.Vector3(origin.x - f.z * 0.25, origin.y - 0.15, origin.z + f.x * 0.25);
    beam(start, end, w.color);
    send({ t: 'rail', a: v3(start, 2), b: v3(end, 2) });
    if (hitEnemy) damageEnemy(w.dmg, end, w.name);
    else sparks(end, w.color, 14, 6);
  }

  // ------------------------------------------------------------------
  // Player update
  // ------------------------------------------------------------------
  function updatePlayer(dt) {
    if (player.dead) {
      player.deathT += dt;
      return;
    }
    player.cool -= dt;
    player.switchT = Math.max(0, player.switchT - dt);
    if (player.reload > 0) {
      player.reload -= dt;
      if (player.reload <= 0) finishReload();
    }

    const strafeMode = keys.ShiftLeft || keys.ShiftRight;
    let turn = 0, move = 0, strafe = 0;
    if (keys.ArrowUp) move += 1;
    if (keys.ArrowDown) move -= 1;
    if (strafeMode) {
      if (keys.ArrowLeft) strafe -= 1;
      if (keys.ArrowRight) strafe += 1;
    } else {
      if (keys.ArrowLeft) turn += 1;
      if (keys.ArrowRight) turn -= 1;
    }
    player.yaw += turn * PLAYER_TURN * dt;

    const f = forward(player.yaw);
    const r = { x: -f.z, z: f.x };            // right vector
    const mx = f.x * move + r.x * strafe;
    const mz = f.z * move + r.z * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      const sp = (move < 0 && !strafe ? PLAYER_SPEED * 0.7 : PLAYER_SPEED) / len;
      player.pos.x += mx * sp * dt;
      player.pos.z += mz * sp * dt;
      player.bob += dt * 11;
    }
    collide(player.pos, PLAYER_R);
    separate();

    if (keys.Space) playerShoot();

    pickups.forEach((p, i) => {
      if (!p.active || Math.hypot(player.pos.x - p.x, player.pos.z - p.z) >= 1.3) return;
      if (p.type === 'health' && player.hp < 100) {
        player.hp = Math.min(100, player.hp + MEDKIT_HEAL);
        takePickup(p);
        send({ t: 'pk', i });
        sfx('pickup');
        showToast('+' + MEDKIT_HEAL + ' HEALTH');
      } else if (p.type === 'ammo' && player.ammo.some((a, j) => a.reserve < WEAPONS[j].maxReserve)) {
        player.ammo.forEach((a, j) => {
          a.reserve = Math.min(WEAPONS[j].maxReserve, a.reserve + WEAPONS[j].refill);
        });
        takePickup(p);
        send({ t: 'pk', i });
        sfx('ammo');
        showToast('+ AMMO');
      }
    });
  }

  function separate() {
    if (enemy.dead) return;
    const dx = player.pos.x - enemy.pos.x, dz = player.pos.z - enemy.pos.z;
    const d = Math.hypot(dx, dz), min = PLAYER_R + ENEMY_R;
    if (d < min && d > 1e-4) {
      // online: the rival's position belongs to them, so only we get pushed
      const push = online ? min - d : (min - d) / 2;
      player.pos.x += (dx / d) * push; player.pos.z += (dz / d) * push;
      if (!online) { enemy.pos.x -= (dx / d) * push; enemy.pos.z -= (dz / d) * push; }
    }
  }

  // ------------------------------------------------------------------
  // Enemy AI
  // ------------------------------------------------------------------
  function enemyShoot() {
    const cfg = enemy.cfg;
    const f = forward(enemy.yaw);
    const origin = new THREE.Vector3(enemy.pos.x + f.x * 0.9 - f.z * 0.3, 1.25, enemy.pos.z + f.z * 0.9 + f.x * 0.3);
    const ang = yawTo(player.pos.x - origin.x, player.pos.z - origin.z) + rand(-1, 1) * cfg.spread;
    const fd = forward(ang);
    const dist = Math.hypot(player.pos.x - origin.x, player.pos.z - origin.z);
    const dir = new THREE.Vector3(fd.x, (EYE - 0.4 - origin.y) / Math.max(dist, 1), fd.z).normalize();
    spawnBullet(origin, dir, 42, 'enemy', cfg.dmg, 2.5, enemyBulletMat, 'Pulse Rifle');
    bot.muzzle.intensity = 3;
    sfx('eshoot', clamp(1.2 - dist / 50, 0.15, 1));
  }

  function updateEnemy(dt) {
    if (enemy.dead) {
      enemy.deathT += dt;
      bot.body.rotation.x = Math.min(enemy.deathT * 3, 1) * (Math.PI / 2);
      return;
    }
    const cfg = enemy.cfg;
    const dx = player.pos.x - enemy.pos.x, dz = player.pos.z - enemy.pos.z;
    const dist = Math.hypot(dx, dz);
    const sees = !player.dead && hasLOS(enemy.pos, player.pos);

    if (sees) {
      if (!enemy.seen) enemy.react = cfg.reaction;
      enemy.seen = true;
      enemy.unseenT = 0;
      enemy.lastKnown = { x: player.pos.x, z: player.pos.z };
    } else {
      enemy.seen = false;
      enemy.unseenT += dt;
      // After a while out of sight, the bot "hears" roughly where you are
      if (enemy.unseenT > 4 && !player.dead) {
        enemy.lastKnown = { x: player.pos.x + rand(-4, 4), z: player.pos.z + rand(-4, 4) };
        enemy.unseenT = 0;
      }
    }

    let desiredYaw = enemy.yaw;
    let mx = 0, mz = 0;
    let speedMul = 1;

    // Low health and no target in sight: go for a medkit
    let medTarget = null;
    if (!sees && enemy.hp < enemy.maxHp * 0.45) {
      let best = Infinity;
      for (const p of pickups) {
        if (!p.active || p.type !== 'health') continue;
        const d = Math.hypot(p.x - enemy.pos.x, p.z - enemy.pos.z);
        if (d < best) { best = d; medTarget = p; }
      }
    }

    if (sees) {
      desiredYaw = yawTo(dx, dz);
      const nx = dx / dist, nz = dz / dist;
      const approach = dist > 15 ? 1 : dist < 7 ? -0.8 : 0;
      enemy.strafeT -= dt;
      if (enemy.strafeT <= 0) {
        enemy.strafe = Math.random() < 0.5 ? -1 : 1;
        enemy.strafeT = rand(0.7, 2);
      }
      mx = nx * approach + -nz * enemy.strafe * 0.9;
      mz = nz * approach + nx * enemy.strafe * 0.9;
      speedMul = 0.85;

      enemy.react -= dt;
      enemy.cool -= dt;
      if (enemy.react <= 0 && enemy.cool <= 0 && Math.abs(angDiff(enemy.yaw, desiredYaw)) < 0.2) {
        enemyShoot();
        enemy.cool = cfg.fire * rand(0.8, 1.25);
      }
    } else {
      enemy.cool -= dt;
      let target = medTarget || enemy.lastKnown || enemy.wp;
      if (!target) target = enemy.wp = randomOpenPoint();
      const tx = target.x - enemy.pos.x, tz = target.z - enemy.pos.z;
      const td = Math.hypot(tx, tz);
      if (td < 1.2) {
        if (target === enemy.lastKnown) enemy.lastKnown = null;
        else if (target === enemy.wp) enemy.wp = null;
      } else {
        mx = tx / td;
        mz = tz / td;
        desiredYaw = yawTo(tx, tz);
      }

      // stuck detection – pick a fresh waypoint if we haven't moved
      enemy.stuckT += dt;
      if (enemy.stuckT > 0.7) {
        const moved = Math.hypot(enemy.pos.x - enemy.stuckRef.x, enemy.pos.z - enemy.stuckRef.z);
        if (moved < 0.5) {
          enemy.lastKnown = null;
          enemy.wp = randomOpenPoint();
        }
        enemy.stuckT = 0;
        enemy.stuckRef = { x: enemy.pos.x, z: enemy.pos.z };
      }
    }

    const d = angDiff(enemy.yaw, desiredYaw);
    enemy.yaw += clamp(d, -cfg.turn * dt, cfg.turn * dt);

    const ml = Math.hypot(mx, mz);
    if (ml > 0.01) {
      const s = (cfg.speed * speedMul * Math.min(ml, 1)) / ml;
      enemy.pos.x += mx * s * dt;
      enemy.pos.z += mz * s * dt;
      enemy.walk += dt * 9;
    }
    collide(enemy.pos, ENEMY_R);

    for (const p of pickups) {
      if (p.active && p.type === 'health' && enemy.hp < enemy.maxHp &&
          Math.hypot(enemy.pos.x - p.x, enemy.pos.z - p.z) < 1.3) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + MEDKIT_HEAL);
        takePickup(p);
        killFeed('<b class="r">BOT</b> grabbed a <b class="g">medkit</b>');
      }
    }
  }

  // Online: smoothly follow the rival's last reported position
  function updateRemote(dt) {
    if (enemy.dead) {
      enemy.deathT += dt;
      bot.body.rotation.x = Math.min(enemy.deathT * 3, 1) * (Math.PI / 2);
      return;
    }
    const t = enemy.target;
    if (!t) return;
    const ox = enemy.pos.x, oz = enemy.pos.z;
    if (Math.hypot(t.x - ox, t.z - oz) > 5) {
      enemy.pos.x = t.x;
      enemy.pos.z = t.z;
      enemy.yaw = t.y;
      return;
    }
    const k = 1 - Math.exp(-15 * dt);
    enemy.pos.x += (t.x - ox) * k;
    enemy.pos.z += (t.z - oz) * k;
    enemy.yaw += angDiff(enemy.yaw, t.y) * k;
    enemy.walk += Math.hypot(enemy.pos.x - ox, enemy.pos.z - oz) * 2;
  }

  function syncBot(dt) {
    bot.root.position.set(enemy.pos.x, 0, enemy.pos.z);
    bot.root.rotation.y = enemy.yaw;
    if (!enemy.dead) {
      const swing = Math.sin(enemy.walk) * 0.55;
      bot.legL.rotation.x = swing;
      bot.legR.rotation.x = -swing;
      bot.body.position.y = Math.abs(Math.sin(enemy.walk)) * 0.05;
    }
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 6);
    bot.armor.emissiveIntensity = enemy.hitFlash * 0.8;
    bot.muzzle.intensity = Math.max(0, bot.muzzle.intensity - dt * 30);
  }

  // ------------------------------------------------------------------
  // Bullets / particles update
  // ------------------------------------------------------------------
  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      const ax = b.pos.x, az = b.pos.z;
      const nx = ax + b.vel.x * dt, ny = b.pos.y + b.vel.y * dt, nz = az + b.vel.z * dt;

      let hitT = rayObstacles(ax, az, nx, nz);
      let hitWhat = hitT !== null ? 'wall' : null;

      if (b.owner === 'player' && !enemy.dead) {
        const t = segCircleT(ax, az, nx, nz, enemy.pos.x, enemy.pos.z, ENEMY_R);
        if (t !== null && (hitT === null || t < hitT)) { hitT = t; hitWhat = 'enemy'; }
      } else if (b.owner !== 'player' && !player.dead) {
        const t = segCircleT(ax, az, nx, nz, player.pos.x, player.pos.z, PLAYER_R);
        if (t !== null && (hitT === null || t < hitT)) { hitT = t; hitWhat = 'player'; }
      }

      if (hitWhat) {
        const hp = new THREE.Vector3(ax + (nx - ax) * hitT, b.pos.y + (ny - b.pos.y) * hitT, az + (nz - az) * hitT);
        if (hitWhat === 'wall') {
          sparks(hp, b.mesh.material.color.getHex(), 6, 4);
          sfx('impact', clamp(1 - hp.distanceTo(player.pos) / 30, 0, 1));
        } else if (hitWhat === 'enemy') {
          damageEnemy(b.dmg, hp, b.src);
        } else if (b.owner === 'enemy') {
          damagePlayer(b.dmg, b.src);
        }
        // 'remote' bullets are visual only: the shooter's machine reports hits
        scene.remove(b.mesh);
        bullets.splice(i, 1);
        continue;
      }

      b.pos.set(nx, ny, nz);
      b.mesh.position.copy(b.pos);
      if (b.life <= 0 || ny < 0 || ny > 6) {
        scene.remove(b.mesh);
        bullets.splice(i, 1);
      }
    }
  }

  function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.03) { p.mesh.position.y = 0.03; p.vel.y *= -0.3; p.vel.x *= 0.6; p.vel.z *= 0.6; }
      p.mesh.material.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.material.dispose();
        particles.splice(i, 1);
      }
    }
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.life -= dt;
      const k = Math.max(0, b.life / b.max);
      b.mesh.material.opacity = k * 0.95;
      b.mesh.scale.set(1 + (1 - k) * 3, 1 + (1 - k) * 3, 1);
      if (b.life <= 0) {
        scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        beams.splice(i, 1);
      }
    }
  }

  function damageEnemy(dmg, at, src) {
    if (state !== 'playing' || enemy.dead) return;
    enemy.hitFlash = 1;
    hitMarker = 0.15;
    stats.hits++;
    sparks(at, 0xff6a3c, 12, 6);
    sfx('hit');
    if (online) {
      // the rival's machine owns their health; it reports back if they die
      send({ t: 'hit', dmg, src });
      enemy.hp = Math.max(0, enemy.hp - dmg);
      return;
    }
    enemy.hp -= dmg;
    // getting shot reveals the shooter's position
    enemy.lastKnown = { x: player.pos.x, z: player.pos.z };
    if (enemy.hp <= 0) killEnemy(src);
  }

  function killEnemy(src) {
    enemy.hp = 0;
    enemy.dead = true;
    enemy.deathT = 0;
    sparks(new THREE.Vector3(enemy.pos.x, 1.2, enemy.pos.z), 0xffb04d, 30, 8);
    sfx('kill');
    killFeed('<b class="c">' + esc(playerName) + '</b> <span class="w">[' + esc(src) + ']</span> <b class="r">' + oppHtml() + '</b>');
    endRound('player');
  }

  function damagePlayer(dmg, src) {
    if (state !== 'playing') return;
    player.hp -= dmg;
    stats.damageTaken += dmg;
    damageFlash = 0.85;
    dmgDirT = 1.3;
    shake = 0.25;
    sfx('hurt');
    if (player.hp <= 0) {
      player.hp = 0;
      player.dead = true;
      player.deathT = 0;
      killFeed('<b class="r">' + oppHtml() + '</b> <span class="w">[' + esc(src) + ']</span> <b class="c">' + esc(playerName) + '</b>');
      send({ t: 'died', src });
      endRound('bot');
    }
  }

  // ------------------------------------------------------------------
  // Round / game flow
  // ------------------------------------------------------------------
  function resetRound() {
    clearProjectiles();
    const flip = round % 2 === 0 ? -1 : 1;   // swap sides every round
    const side = online && !isHost ? -flip : flip;
    player.pos.set(rand(-6, 6), 0, 26 * side);
    player.yaw = side === 1 ? 0 : Math.PI;
    Object.assign(player, {
      hp: 100, ammo: freshAmmo(), reload: 0, cool: 0.3, switchT: 0, recoil: 0, dead: false, deathT: 0,
    });
    equip(player.weapon);

    enemy.cfg = enemyConfig();
    enemy.pos.set(0, 0, -26 * side);
    enemy.yaw = side === 1 ? Math.PI : 0;
    const ehp = online ? 100 : enemy.cfg.hp;
    Object.assign(enemy, {
      hp: ehp, maxHp: ehp, target: null, cool: 1, react: enemy.cfg.reaction,
      seen: false, lastKnown: null, unseenT: 0, wp: null, stuckT: 0,
      stuckRef: { x: enemy.pos.x, z: enemy.pos.z }, dead: false, deathT: 0, hitFlash: 0,
    });
    bot.body.rotation.x = 0;

    pickups.forEach(restorePickup);
    damageFlash = dmgDirT = shake = 0;
  }

  function newMatch() {
    initAudio();
    if (actx && actx.state === 'suspended') actx.resume();
    stats = { shots: 0, hits: 0, damageTaken: 0 };
    player.weapon = 0;
    hud.feed.innerHTML = '';
    $('oppLabel').textContent = oppName();
    $('youLabel').textContent = playerName || 'YOU';
    $('againBtn').disabled = false;
    $('againBtn').textContent = 'Play Again';
    $('menu').classList.add('hidden');
    $('gameover').classList.add('hidden');
    $('pause').classList.add('hidden');
    hud.root.classList.remove('hidden');
  }

  function startGame() {
    if (!requireName()) return;
    leaveOnline();
    newMatch();
    round = 1;
    score = { player: 0, bot: 0 };
    startRound();
  }

  function startRound() {
    resetRound();
    state = 'playing';
    sfx('round');
    showMessage('ROUND ' + round + '<small>FIGHT!</small>', 1.6);
  }

  function endRound(winner) {
    state = 'roundOver';
    score[winner]++;
    roundTimer = 3;
    const over = score[winner] >= WIN_SCORE;
    if (winner === 'player') showMessage(oppHtml() + ' DOWN<small>' + (over ? 'MATCH POINT REACHED' : 'NEXT ROUND INCOMING') + '</small>', 2.8);
    else showMessage('<span style="color:#ff4d4d">ELIMINATED</span><small>' + (over ? oppHtml() + ' WINS THE MATCH' : 'GET READY') + '</small>', 2.8);
  }

  function finishRound() {
    if (score.player >= WIN_SCORE || score.bot >= WIN_SCORE) {
      state = 'gameOver';
      hud.root.classList.add('hidden');
      const won = score.player > score.bot;
      $('goTitle').textContent = won ? 'VICTORY' : 'DEFEAT';
      $('goScore').textContent = score.player + ' – ' + score.bot;
      const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
      const opponent = online ? oppName() : 'Bot (' + difficulty[0].toUpperCase() + difficulty.slice(1) + ')';
      saveMatch({
        date: Date.now(), name: playerName, opponent, mode: online ? 'online' : 'bot',
        you: score.player, them: score.bot, won, acc, matchId: online ? matchId : undefined,
      });
      const rec = recordVs(opponent);
      const rank = rankOf(playerName);
      $('goRecord').innerHTML = 'Your record vs ' + esc(opponent) + ': <b>' + rec.w + 'W – ' + rec.l + 'L</b>' +
        (rank ? ' · Leaderboard rank <b>#' + rank + '</b>' : '');
      $('goStats').innerHTML =
        '<div><b>' + acc + '%</b><span>Accuracy</span></div>' +
        '<div><b>' + stats.hits + '</b><span>Hits</span></div>' +
        '<div><b>' + stats.damageTaken + '</b><span>Dmg taken</span></div>';
      $('gameover').classList.remove('hidden');
    } else if (online && !isHost) {
      roundTimer = Infinity;   // the host decides when the next round starts
    } else {
      round++;
      send({ t: 'start', round, score });
      startRound();
    }
  }

  function togglePause() {
    if (online) {
      if (state === 'playing') showToast("CAN'T PAUSE ONLINE");
      return;
    }
    if (state === 'playing') {
      state = 'paused';
      $('pause').classList.remove('hidden');
    } else if (state === 'paused') {
      state = 'playing';
      $('pause').classList.add('hidden');
    }
  }

  function toMenu() {
    leaveOnline();
    state = 'menu';
    clearProjectiles();
    hud.root.classList.add('hidden');
    $('pause').classList.add('hidden');
    $('gameover').classList.add('hidden');
    $('menu').classList.remove('hidden');
  }

  // ------------------------------------------------------------------
  // Online multiplayer: peer-to-peer over WebRTC (PeerJS public broker).
  // Each player owns their own movement + health; the shooter's machine
  // decides hits and tells the victim; the host decides round starts.
  // ------------------------------------------------------------------
  const ROOM_PREFIX = 'arena-duel-room-';
  const round2 = (v, p) => Math.round(v * 10 ** p) / 10 ** p;
  const v3 = (v, p) => [round2(v.x, p), round2(v.y, p), round2(v.z, p)];
  const toV3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const send = (msg) => { if (online && conn && conn.open) conn.send(msg); };
  const remoteVol = () => clamp(1.2 - player.pos.distanceTo(enemy.pos) / 50, 0.15, 1);

  function netStatus(text, cls = '') {
    const el = $('netStatus');
    el.textContent = text;
    el.className = 'net-status ' + cls;
  }

  function makeCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }

  function peerAvailable() {
    if (typeof Peer !== 'undefined') return true;
    netStatus('Multiplayer library failed to load – check your internet connection.', 'err');
    return false;
  }

  function leaveOnline() {
    online = false;
    const c = conn, p = peer;
    conn = peer = null;
    if (c) c.close();
    if (p) p.destroy();
    $('roomCode').classList.add('hidden');
  }

  function hostRoom() {
    if (!requireName() || !peerAvailable()) return;
    leaveOnline();
    const code = makeCode();
    netStatus('Creating room…');
    const p = peer = new Peer(ROOM_PREFIX + code);
    p.on('open', () => {
      $('roomCode').textContent = code;
      $('roomCode').classList.remove('hidden');
      netStatus('Send this code to your friend. Waiting for them to join…');
    });
    p.on('connection', (c) => {
      if (conn) { c.close(); return; }   // room already has two players
      isHost = true;
      setupConn(c);
    });
    p.on('error', (e) => {
      if (peer !== p) return;
      if (e.type === 'unavailable-id') hostRoom();
      else netStatus('Network error: ' + e.type, 'err');
    });
  }

  function joinRoom() {
    if (!requireName() || !peerAvailable()) return;
    const code = $('joinCode').value.trim().toUpperCase();
    if (code.length !== 5) { netStatus('Enter the 5-character room code.', 'err'); return; }
    leaveOnline();
    netStatus('Connecting to room ' + code + '…');
    const p = peer = new Peer();
    p.on('open', () => {
      isHost = false;
      setupConn(p.connect(ROOM_PREFIX + code, { reliable: true }));
    });
    p.on('error', (e) => {
      if (peer !== p) return;
      netStatus(e.type === 'peer-unavailable' ? 'Room ' + code + ' not found.' : 'Network error: ' + e.type, 'err');
    });
  }

  function setupConn(c) {
    conn = c;
    c.on('open', () => {
      online = true;
      rivalName = '';
      send({ t: 'hello', name: playerName });   // sent before 'start' so the guest knows our name
      netStatus('Connected!', 'ok');
      if (isHost) hostStartMatch();
    });
    c.on('data', onNet);
    c.on('close', () => {
      if (conn !== c) return;   // we left on purpose
      toMenu();
      setMode('online');
      netStatus('Your rival disconnected.', 'err');
    });
    c.on('error', () => netStatus('Connection error.', 'err'));
  }

  function hostStartMatch() {
    const sc = { player: 0, bot: 0 };
    matchId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    send({ t: 'start', round: 1, fresh: true, score: sc, matchId });
    beginOnlineRound(1, true, sc);
  }

  function beginOnlineRound(r, fresh, sc) {
    if (fresh) newMatch();
    score = sc;
    round = r;
    startRound();
  }

  function onNet(m) {
    switch (m.t) {
      case 'hello':
        rivalName = cleanName(m.name) || 'RIVAL';
        $('oppLabel').textContent = rivalName;
        netStatus('Connected to ' + rivalName + '!', 'ok');
        break;
      case 's':
        enemy.target = m;
        enemy.hp = m.hp;
        break;
      case 'shot': {
        const w = WEAPONS[m.w];
        for (const d of m.d) {
          spawnBullet(toV3(m.o), toV3(d), w.speed, 'remote', 0, w.life, playerBulletMats[m.w], w.name);
        }
        bot.muzzle.intensity = 3;
        sfx(w.sound, remoteVol());
        break;
      }
      case 'rail':
        beam(toV3(m.a), toV3(m.b), WEAPONS[3].color);
        bot.muzzle.intensity = 3;
        sfx('rail', remoteVol());
        break;
      case 'hit':
        if (state === 'playing' && !player.dead) damagePlayer(clamp(+m.dmg || 0, 0, 100), m.src);
        break;
      case 'died':
        if (state === 'playing') killEnemy(m.src);
        break;
      case 'pk': {
        const p = pickups[m.i];
        if (p && p.active) {
          takePickup(p);
          killFeed('<b class="r">' + oppHtml() + '</b> grabbed ' + (p.type === 'health' ? 'a <b class="g">medkit</b>' : '<b>ammo</b>'));
        }
        break;
      }
      case 'start':
        if (m.fresh) matchId = String(m.matchId || '').slice(0, 32);
        // host's score is from their point of view, so swap it
        beginOnlineRound(m.round, m.fresh, { player: m.score.bot, bot: m.score.player });
        break;
      case 'rematch':
        if (isHost && state === 'gameOver') hostStartMatch();
        break;
    }
  }

  function setMode(mode) {
    menuMode = mode;
    document.querySelectorAll('#modeTabs button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    $('botPanel').classList.toggle('hidden', mode !== 'bot');
    $('onlinePanel').classList.toggle('hidden', mode !== 'online');
    if (mode === 'bot') { leaveOnline(); netStatus(''); }
  }

  // Menu wiring
  document.querySelectorAll('#sideTabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sideTabs button').forEach((b) => {
        b.classList.toggle('active', b === btn);
        $('tab-' + b.dataset.tab).classList.toggle('hidden', b !== btn);
      });
    });
  });
  document.querySelectorAll('#lbFilter button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#lbFilter button').forEach((b) => b.classList.toggle('active', b === btn));
      lbFilter = btn.dataset.f;
      renderLeaderboard();
    });
  });
  $('playerName').value = cleanName(storeGet(NAME_KEY, ''));
  $('playerName').addEventListener('input', () => {
    $('nameError').textContent = '';
    $('playerName').classList.remove('invalid');
    renderHistory();
  });
  $('clearHist').addEventListener('click', () => {
    if (!confirm('Clear all saved match history on this device?')) return;
    storeSet(HISTORY_KEY, []);
    renderHistory();
  });
  renderHistory();

  document.querySelectorAll('#modeTabs button').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });
  document.querySelectorAll('#diff button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#diff button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.dataset.diff;
    });
  });
  $('startBtn').addEventListener('click', startGame);
  $('hostBtn').addEventListener('click', () => { initAudio(); hostRoom(); });
  $('joinBtn').addEventListener('click', () => { initAudio(); joinRoom(); });
  $('roomCode').addEventListener('click', () => {
    if (navigator.clipboard) navigator.clipboard.writeText($('roomCode').textContent).then(() => netStatus('Code copied!', 'ok'), () => {});
  });
  $('againBtn').addEventListener('click', () => {
    if (!online) return startGame();
    if (isHost) return hostStartMatch();
    send({ t: 'rematch' });
    $('againBtn').disabled = true;
    $('againBtn').textContent = 'Waiting for host…';
  });
  $('resumeBtn').addEventListener('click', togglePause);
  $('quitBtn').addEventListener('click', toMenu);
  $('menuBtn').addEventListener('click', toMenu);

  // ------------------------------------------------------------------
  // Camera + weapon animation
  // ------------------------------------------------------------------
  function updateCamera(dt) {
    if (state === 'menu' || state === 'gameOver') {
      gunRoot.visible = false;
      const a = elapsed * 0.08;
      camera.position.set(Math.sin(a) * 34, 14, Math.cos(a) * 34);
      camera.lookAt(0, 0, 0);
      return;
    }
    gunRoot.visible = !player.dead;

    let y = EYE + Math.sin(player.bob) * 0.04;
    let roll = 0;
    if (player.dead) {
      const k = Math.min(player.deathT * 2, 1);
      y = EYE - (EYE - 0.35) * k;
      roll = k * 0.9;
    }
    const sx = shake > 0 ? rand(-1, 1) * shake * 0.15 : 0;
    const sy = shake > 0 ? rand(-1, 1) * shake * 0.15 : 0;
    camera.position.set(player.pos.x + sx, y + sy, player.pos.z);
    camera.rotation.set(-player.recoil * 0.02, player.yaw, roll, 'YXZ');

    // weapon sway / recoil / reload dip / switch raise
    player.recoil = Math.max(0, player.recoil - dt * 6);
    const w = curWeapon();
    const reloadDip = player.reload > 0 ? Math.sin((1 - player.reload / w.reload) * Math.PI) * 0.25 : 0;
    const switchDip = (player.switchT / SWITCH_TIME) * 0.45;
    gunRoot.position.set(
      GUN_BASE.x + Math.cos(player.bob * 0.5) * 0.012,
      GUN_BASE.y + Math.abs(Math.sin(player.bob * 0.5)) * 0.015 - reloadDip - switchDip,
      GUN_BASE.z + player.recoil * 0.06
    );
    gunRoot.rotation.x = player.recoil * 0.12 + reloadDip * 1.5 - switchDip;
    gunRoot.rotation.z = reloadDip * 0.6;

    flashMesh.material.opacity = Math.max(0, flashMesh.material.opacity - dt * 25);
    gunFlashLight.intensity = Math.max(0, gunFlashLight.intensity - dt * 40);
    worldFlash.intensity = Math.max(0, worldFlash.intensity - dt * 50);
  }

  // ------------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------------
  const clock = new THREE.Clock();

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    if (state === 'playing' || state === 'roundOver') {
      updatePlayer(dt);
      if (online) updateRemote(dt); else updateEnemy(dt);
      updateBullets(dt);
      if (online && (netSendT -= dt) <= 0) {
        netSendT = 0.05;   // 20 updates per second
        send({
          t: 's', x: round2(player.pos.x, 2), z: round2(player.pos.z, 2), y: round2(player.yaw, 3),
          hp: Math.max(0, Math.ceil(player.hp)), w: player.weapon,
        });
      }
    }
    if (state === 'playing') {
      for (const p of pickups) {
        if (!p.active && (p.timer -= dt) <= 0) restorePickup(p);
      }
    } else if (state === 'roundOver') {
      roundTimer -= dt;
      if (roundTimer <= 0) finishRound();
    }

    if (state !== 'paused') {
      updateFx(dt);
      syncBot(dt);
      for (const p of pickups) {
        p.mesh.rotation.y += dt * 1.5;
        p.mesh.position.y = 0.7 + Math.sin(elapsed * 2.5 + p.x) * 0.12;
      }
      shake = Math.max(0, shake - dt);
      damageFlash = Math.max(0, damageFlash - dt * 1.6);
      dmgDirT = Math.max(0, dmgDirT - dt);
      hitMarker -= dt;
      if (msgTimer > 0 && (msgTimer -= dt) <= 0) hud.msg.classList.remove('show');
      if (toastTimer > 0 && (toastTimer -= dt) <= 0) hud.toast.classList.remove('show');
    }

    updateCamera(dt);
    if (state === 'playing' || state === 'roundOver' || state === 'paused') {
      updateHUD();
      drawMinimap();
    }
    renderer.clear();
    renderer.render(scene, camera);
    if (gunRoot.visible) {
      renderer.clearDepth();
      renderer.render(gunScene, gunCam);
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => {
    for (const cam of [camera, gunCam]) {
      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Initial placement for the menu backdrop
  resetRound();
  tick();
})();
