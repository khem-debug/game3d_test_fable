import * as THREE from 'three';
import { COLORS } from './config.js';

// ---------- canvas texture helpers ----------
function makeGroundTexture() {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2025';
  g.fillRect(0, 0, s, s);
  // subtle tile grid
  g.strokeStyle = '#262a30';
  g.lineWidth = 2;
  const step = s / 8;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, s); g.stroke();
    g.beginPath(); g.moveTo(0, i * step); g.lineTo(s, i * step); g.stroke();
  }
  // faint circuit traces in orange
  g.strokeStyle = 'rgba(249,115,22,0.10)';
  g.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    let x = Math.random() * s, y = Math.random() * s;
    g.beginPath(); g.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      if (Math.random() < 0.5) x = Math.min(s, Math.max(0, x + (Math.random() - 0.5) * 220));
      else y = Math.min(s, Math.max(0, y + (Math.random() - 0.5) * 220));
      g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = 'rgba(249,115,22,0.15)';
    g.fillRect(x - 4, y - 4, 8, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCodeScreenTexture(broken = false) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#101215';
  g.fillRect(0, 0, 128, 96);
  g.font = '9px monospace';
  const lines = broken
    ? ['FATAL ERROR', 'AI_OVERRIDE', 'ACCESS DENIED', 'kill -9 human', 'SEGFAULT', '########']
    : ['const hope=1;', 'while(alive){', '  code();', '  coffee++;', '}', '// TODO: live'];
  lines.forEach((t, i) => {
    g.fillStyle = broken ? (i % 2 ? '#f97316' : '#fb923c') : (i % 3 === 0 ? '#fb923c' : '#b9bfc7');
    g.fillText(t, 6, 14 + i * 13);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlyphTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.font = 'bold 40px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(249,115,22,0.9)';
  g.fillText(Math.random() < 0.5 ? '0' : '1', 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- enemy spawn layout ----------
export const SPAWNS = [
  { type: 'bug',   x: -6,  z: 30 },
  { type: 'bug',   x: 7,   z: 26 },
  { type: 'bug',   x: 0,   z: 18 },
  { type: 'drone', x: -12, z: 14 },
  { type: 'bug',   x: 14,  z: 8 },
  { type: 'bug',   x: -16, z: 4 },
  { type: 'drone', x: 10,  z: 0 },
  { type: 'bug',   x: -8,  z: -16 },
  { type: 'bug',   x: 9,   z: -18 },
  { type: 'drone', x: 0,   z: -22 },
  { type: 'bug',   x: -14, z: -24 },
  { type: 'drone', x: 15,  z: -26 },
];
export const BOSS_SPAWN = { x: 0, z: -44 };
export const PLAYER_SPAWN = { x: 0, z: 46 };

// ---------- world building ----------
export function buildWorld(scene) {
  const colliders = [];   // { x, z, r }
  const bounds = { minX: -58, maxX: 58, minZ: -58, maxZ: 58 };

  scene.background = new THREE.Color(COLORS.gray900);
  scene.fog = new THREE.FogExp2(COLORS.fog, 0.022);

  // --- lights ---
  scene.add(new THREE.HemisphereLight(0x9aa1ab, 0x1c1f24, 1.25));
  scene.add(new THREE.AmbientLight(0x3a4048, 0.6));
  const dir = new THREE.DirectionalLight(0xd8dce2, 1.1);
  dir.position.set(18, 30, 12);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.left = -70; dir.shadow.camera.right = 70;
  dir.shadow.camera.top = 70; dir.shadow.camera.bottom = -70;
  dir.shadow.camera.far = 120;
  scene.add(dir);

  // --- ground ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.95, metalness: 0.1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- outer walls ---
  const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.gray700, roughness: 0.9 });
  const wallGeo = new THREE.BoxGeometry(124, 10, 2);
  const walls = [
    [0, 5, -61, 0], [0, 5, 61, 0], [-61, 5, 0, Math.PI / 2], [61, 5, 0, Math.PI / 2],
  ];
  for (const [x, y, z, ry] of walls) {
    const w = new THREE.Mesh(wallGeo, wallMat);
    w.position.set(x, y, z); w.rotation.y = ry;
    scene.add(w);
  }

  const screenOK = makeCodeScreenTexture(false);
  const screenBad = makeCodeScreenTexture(true);

  // --- ruined cubicle (desk + monitor) ---
  const deskMat = new THREE.MeshStandardMaterial({ color: COLORS.gray600, roughness: 0.85 });
  const monMat = new THREE.MeshStandardMaterial({ color: COLORS.gray800, roughness: 0.6 });
  function addDesk(x, z, ry, broken) {
    const grp = new THREE.Group();
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 1.0), deskMat);
    desk.position.y = 0.78;
    desk.castShadow = true;
    grp.add(desk);
    for (const [lx, lz] of [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), deskMat);
      leg.position.set(lx, 0.39, lz);
      grp.add(leg);
    }
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.06), monMat);
    mon.position.set(0, 1.2, -0.25);
    mon.castShadow = true;
    grp.add(mon);
    const scr = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.47),
      new THREE.MeshBasicMaterial({ map: broken ? screenBad : screenOK })
    );
    scr.position.set(0, 1.2, -0.215);
    grp.add(scr);
    if (broken) grp.rotation.z = (Math.random() - 0.5) * 0.12;
    grp.position.set(x, 0, z);
    grp.rotation.y = ry;
    scene.add(grp);
    colliders.push({ x, z, r: 1.15 });
  }

  // --- server rack pillar (orange glow strips) ---
  const rackMat = new THREE.MeshStandardMaterial({ color: COLORS.gray700, roughness: 0.7, metalness: 0.4 });
  const stripMat = new THREE.MeshStandardMaterial({
    color: COLORS.gray900, emissive: COLORS.orange, emissiveIntensity: 1.4,
  });
  const pulsingStrips = [];
  function addRack(x, z, h = 3.2) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.1), rackMat);
    body.position.y = h / 2;
    body.castShadow = true;
    grp.add(body);
    for (let i = 0; i < Math.floor(h / 0.8); i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.02), stripMat.clone());
      strip.position.set(0, 0.5 + i * 0.8, 0.56);
      strip.material.emissiveIntensity = 0.8 + Math.random() * 1.2;
      grp.add(strip);
      pulsingStrips.push(strip);
    }
    grp.position.set(x, 0, z);
    grp.rotation.y = Math.random() * Math.PI;
    scene.add(grp);
    colliders.push({ x, z, r: 0.95 });
  }

  // --- broken concrete pillar ---
  const pillarMat = new THREE.MeshStandardMaterial({ color: COLORS.gray600, roughness: 1 });
  function addPillar(x, z) {
    const h = 2.5 + Math.random() * 3.5;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, h, 8), pillarMat);
    p.position.set(x, h / 2, z);
    p.castShadow = true;
    p.rotation.y = Math.random();
    scene.add(p);
    colliders.push({ x, z, r: 1.1 });
  }

  // layout — a ruined office corridor from south (spawn) to north (boss)
  addDesk(-5, 38, 0.4, true);   addDesk(6, 36, -0.7, false);
  addDesk(-10, 28, 1.2, true);  addDesk(12, 24, 0.2, true);
  addDesk(-4, 20, -0.4, false); addDesk(5, 12, 2.6, true);
  addDesk(-14, 10, 0.9, true);  addDesk(16, 2, -1.2, true);
  addDesk(-7, -4, 0.1, false);  addDesk(8, -10, 1.8, true);
  addDesk(-16, -18, -0.6, true); addDesk(13, -20, 0.5, true);

  addRack(-20, 34); addRack(20, 30); addRack(-24, 16); addRack(24, 12);
  addRack(-22, -6); addRack(22, -8); addRack(-18, -30, 4.2); addRack(18, -30, 4.2);
  addRack(-10, -36, 5); addRack(10, -36, 5);

  addPillar(-30, 24); addPillar(30, 20); addPillar(-32, -2); addPillar(32, -6);
  addPillar(-28, -26); addPillar(28, -24); addPillar(-36, 40); addPillar(36, 38);

  // --- boss arena ring of tall racks ---
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const bx = BOSS_SPAWN.x + Math.cos(a) * 17;
    const bz = BOSS_SPAWN.z + Math.sin(a) * 17;
    if (bz > -30) continue; // leave entrance open on the south side
    addRack(bx, bz, 5.5);
  }
  const bossZone = { x: BOSS_SPAWN.x, z: BOSS_SPAWN.z + 2, r: 15 };

  // --- checkpoints: "Deploy Server" bonfires ---
  const checkpoints = [];
  function addCheckpoint(x, z, name) {
    const grp = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.5, 0.25, 16),
      new THREE.MeshStandardMaterial({ color: COLORS.gray600, roughness: 0.8 })
    );
    base.position.y = 0.12;
    grp.add(base);
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.8, 0.8),
      new THREE.MeshStandardMaterial({ color: COLORS.gray800, roughness: 0.5, metalness: 0.6 })
    );
    tower.position.y = 1.15;
    tower.castShadow = true;
    grp.add(tower);
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34),
      new THREE.MeshStandardMaterial({ color: COLORS.orange, emissive: COLORS.orange, emissiveIntensity: 2.2 })
    );
    core.position.y = 2.5;
    grp.add(core);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 8, 32),
      new THREE.MeshStandardMaterial({ color: COLORS.white, emissive: COLORS.orangeBright, emissiveIntensity: 1.2 })
    );
    ring.position.y = 2.5;
    grp.add(ring);
    const light = new THREE.PointLight(COLORS.orange, 14, 16, 1.8);
    light.position.y = 2.6;
    grp.add(light);
    grp.position.set(x, 0, z);
    scene.add(grp);
    colliders.push({ x, z, r: 1.2 });
    checkpoints.push({ pos: new THREE.Vector3(x, 0, z), name, core, ring, light });
  }
  addCheckpoint(3.5, 47, 'DEPLOY SERVER α');
  addCheckpoint(3.5, -12, 'DEPLOY SERVER β');

  // --- boss arena mood light ---
  const bossLight = new THREE.PointLight(COLORS.orangeDark, 30, 40, 1.6);
  bossLight.position.set(BOSS_SPAWN.x, 8, BOSS_SPAWN.z);
  scene.add(bossLight);

  // --- floating binary glyphs ---
  const glyphs = [];
  for (let i = 0; i < 48; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlyphTexture(), transparent: true, opacity: 0.35, depthWrite: false,
    }));
    const scale = 0.25 + Math.random() * 0.5;
    sp.scale.set(scale, scale, scale);
    sp.position.set(
      (Math.random() - 0.5) * 110,
      Math.random() * 8,
      (Math.random() - 0.5) * 110
    );
    sp.userData.speed = 0.3 + Math.random() * 0.7;
    scene.add(sp);
    glyphs.push(sp);
  }

  function update(dt, t) {
    for (const s of pulsingStrips) {
      s.material.emissiveIntensity = 1.0 + Math.sin(t * 3 + s.position.y * 7) * 0.6;
    }
    for (const cp of checkpoints) {
      cp.core.rotation.y += dt * 1.5;
      cp.ring.rotation.x += dt * 0.9;
      cp.ring.rotation.y += dt * 0.6;
      cp.light.intensity = 12 + Math.sin(t * 4) * 3;
    }
    for (const g of glyphs) {
      g.position.y += g.userData.speed * dt;
      g.material.opacity = 0.18 + 0.2 * Math.abs(Math.sin(t + g.position.x));
      if (g.position.y > 9) g.position.y = 0;
    }
  }

  return { colliders, bounds, checkpoints, bossZone, update };
}
