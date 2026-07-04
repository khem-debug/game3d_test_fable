import * as THREE from 'three';
import { COLORS, PLAYER as PCFG, ENEMY_TYPES, BOSS as BOSSCFG } from './config.js';
import { buildWorld, SPAWNS, BOSS_SPAWN, PLAYER_SPAWN } from './world.js';
import { Player } from './player.js';
import { Enemy, Boss } from './enemies.js';
import { UI } from './ui.js';
import { SFX } from './audio.js';

// ---------- renderer / scene ----------
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 300);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const ui = new UI();
const sfx = new SFX();
const world = buildWorld(scene);
const player = new Player(scene);
player.pos.set(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z);

// ---------- game state ----------
let gameState = 'title';   // title | play | dead | win
let enemies = [];
let boss = null;
let bossTriggered = false;
let respawnPoint = new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z);
let codeDrop = null;       // { mesh, amount }
let deathTimer = 0;
let winTimer = 0;

function spawnEnemies() {
  for (const e of enemies) scene.remove(e.group);
  enemies = SPAWNS.map(s => new Enemy(scene, s.type, s.x, s.z));
}

function spawnBoss() {
  if (boss) scene.remove(boss.group);
  boss = new Boss(scene, BOSS_SPAWN.x, BOSS_SPAWN.z);
  bossTriggered = false;
  ui.hideBoss();
}

spawnEnemies();
spawnBoss();

// ---------- input ----------
const keys = {};
let mouseDX = 0, mouseDY = 0;
let camYaw = 0, camPitch = 0.32;
let lockTarget = null;

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (gameState !== 'play') return;
  if (e.code === 'Space') { e.preventDefault(); queuedRoll = true; }
  if (e.code === 'KeyF') queuedDrink = true;
  if (e.code === 'KeyE') queuedInteract = true;
  if (e.code === 'KeyQ') toggleLockOn();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

let queuedRoll = false, queuedDrink = false, queuedInteract = false;
let queuedLight = false, queuedHeavy = false;

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    mouseDX += e.movementX;
    mouseDY += e.movementY;
  }
});
canvas.addEventListener('mousedown', (e) => {
  if (gameState !== 'play') return;
  if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  if (e.button === 0) queuedLight = true;
  if (e.button === 2) queuedHeavy = true;
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

function toggleLockOn() {
  if (lockTarget && !lockTarget.dead) { lockTarget = null; return; }
  let best = null, bestD = 26;
  const candidates = [...enemies, ...(boss && bossTriggered && !boss.dead ? [boss] : [])];
  for (const e of candidates) {
    if (e.dead) continue;
    const d = e.pos.distanceTo(player.pos);
    if (d < bestD) { bestD = d; best = e; }
  }
  lockTarget = best;
}

// ---------- projectiles ----------
const projectiles = [];
const projGeo = new THREE.SphereGeometry(0.14, 8, 6);
const projMat = new THREE.MeshStandardMaterial({ color: COLORS.orangeBright, emissive: COLORS.orange, emissiveIntensity: 3 });
function spawnProjectile(pos, dir, speed, damage) {
  const mesh = new THREE.Mesh(projGeo, projMat);
  mesh.position.copy(pos);
  scene.add(mesh);
  projectiles.push({ mesh, vel: dir.clone().multiplyScalar(speed), damage, life: 4 });
  sfx.play('shoot');
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    let kill = p.life <= 0;
    // hit static geometry
    if (!kill) {
      for (const c of world.colliders) {
        const dx = p.mesh.position.x - c.x, dz = p.mesh.position.z - c.z;
        if (dx * dx + dz * dz < c.r * c.r * 0.7) { kill = true; break; }
      }
    }
    // hit player
    if (!kill && player.alive && !player.isInvulnerable()) {
      const d = p.mesh.position.clone().setY(0).distanceTo(player.pos);
      if (d < PCFG.radius + 0.25) {
        damagePlayer(p.damage, p.mesh.position);
        kill = true;
      }
    }
    if (kill) {
      burst(p.mesh.position, COLORS.orange, 6, 2);
      scene.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
}

// ---------- particles ----------
const bursts = [];
function burst(pos, color, count = 12, speed = 4) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const vels = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
    vels.push(new THREE.Vector3(
      (Math.random() - 0.5) * speed,
      Math.random() * speed * 0.8,
      (Math.random() - 0.5) * speed
    ));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.12, transparent: true, opacity: 1 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  bursts.push({ pts, vels, life: 0.6, maxLife: 0.6 });
}

function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.life -= dt;
    const pos = b.pts.geometry.attributes.position;
    for (let j = 0; j < b.vels.length; j++) {
      b.vels[j].y -= 9 * dt;
      pos.array[j * 3] += b.vels[j].x * dt;
      pos.array[j * 3 + 1] += b.vels[j].y * dt;
      pos.array[j * 3 + 2] += b.vels[j].z * dt;
    }
    pos.needsUpdate = true;
    b.pts.material.opacity = Math.max(0, b.life / b.maxLife);
    if (b.life <= 0) { scene.remove(b.pts); bursts.splice(i, 1); }
  }
}

// ---------- shockwaves (boss slam) ----------
const shockwaves = [];
function slamShockwave(pos, range) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.12, 8, 40),
    new THREE.MeshBasicMaterial({ color: COLORS.orange, transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.1, pos.z);
  scene.add(ring);
  shockwaves.push({ ring, life: 0.5, maxLife: 0.5, range });
  burst(new THREE.Vector3(pos.x, 0.5, pos.z), COLORS.orangeBright, 24, 7);
  sfx.play('explode');
  addShake(0.45);
}

function updateShockwaves(dt) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.life -= dt;
    const k = 1 - s.life / s.maxLife;
    s.ring.scale.setScalar(1 + k * s.range);
    s.ring.material.opacity = 0.9 * (1 - k);
    if (s.life <= 0) { scene.remove(s.ring); shockwaves.splice(i, 1); }
  }
}

// ---------- damage / death ----------
let shake = 0;
function addShake(v) { shake = Math.min(0.7, shake + v); }

function damagePlayer(dmg, fromPos) {
  if (!player.alive) return;
  const applied = player.takeDamage(dmg, fromPos);
  if (!applied) return;
  ui.damageFlash();
  addShake(0.3);
  if (player.hp <= 0) {
    sfx.play('die');
    onPlayerDeath();
  } else {
    sfx.play('hurt');
  }
}

function onPlayerDeath() {
  // drop your Lines of Code where you died (Dark Souls rule: old drop is gone)
  if (codeDrop) scene.remove(codeDrop.mesh);
  codeDrop = null;
  if (player.code > 0) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3),
      new THREE.MeshStandardMaterial({ color: COLORS.orange, emissive: COLORS.orangeBright, emissiveIntensity: 2.5 })
    );
    mesh.position.set(player.pos.x, 0.8, player.pos.z);
    scene.add(mesh);
    codeDrop = { mesh, amount: player.code };
    player.code = 0;
  }
  lockTarget = null;
  deathTimer = 1.4;
  gameState = 'dead';
}

function respawn() {
  player.respawn(respawnPoint);
  spawnEnemies();
  if (boss && !boss.dead) spawnBoss();  // boss resets to full HP like a proper souls boss
  for (const p of projectiles) scene.remove(p.mesh);
  projectiles.length = 0;
  lockTarget = null;
  camYaw = 0; camPitch = 0.32;
  gameState = 'play';
  ui.hideScreens();
  ui.showHUD(true);
  canvas.requestPointerLock();
}

// ---------- checkpoint / interact ----------
function nearestCheckpoint() {
  for (const cp of world.checkpoints) {
    if (cp.pos.distanceTo(player.pos) < 3.2) return cp;
  }
  return null;
}

function restAt(cp) {
  respawnPoint.copy(cp.pos).add(new THREE.Vector3(-1.5, 0, 0));
  player.hp = PCFG.maxHP;
  player.stamina = PCFG.maxStamina;
  player.coffee = PCFG.coffeeMax;
  spawnEnemies();
  if (boss && !boss.dead && boss.state !== 'dormant') spawnBoss();
  for (const p of projectiles) scene.remove(p.mesh);
  projectiles.length = 0;
  lockTarget = null;
  sfx.play('checkpoint');
  ui.toast(`☕ ${cp.name} — SAVED`, 2600);
  burst(cp.pos.clone().setY(2.5), COLORS.orangeBright, 20, 3);
}

// ---------- combat resolution ----------
function resolvePlayerAttack() {
  const hit = player.getActiveHit();
  if (!hit) return;
  const fwd = player.forward();
  const targets = [...enemies, ...(boss && !boss.dead && boss.state !== 'dormant' ? [boss] : [])];
  for (const e of targets) {
    if (e.dead || hit.hitSet.has(e.id)) continue;
    const to = e.pos.clone().sub(player.pos).setY(0);
    const dist = to.length() - (e.cfg.radius ?? 0.5);
    if (dist > hit.range) continue;
    const angle = fwd.angleTo(to.normalize());
    if (angle > hit.arc / 2) continue;
    hit.hitSet.add(e.id);
    e.takeDamage(hit.damage, player.pos);
    burst(e.lockPoint, e.isBoss ? COLORS.white : COLORS.orangeBright, 10, 4);
    sfx.play('hit');
    addShake(0.12);
    if (e.dead) {
      player.code += e.isBoss ? BOSSCFG.code : ENEMY_TYPES[e.type].code;
      sfx.play('explode');
      burst(e.lockPoint, COLORS.orange, 22, 6);
      if (lockTarget === e) lockTarget = null;
      if (e.isBoss) onBossKilled();
    }
  }
}

function onBossKilled() {
  ui.hideBoss();
  ui.toast('NEXUS-9 DEPRECATED', 4000);
  sfx.play('win');
  winTimer = 3.2;
}

// ---------- enemy api ----------
const enemyApi = { spawnProjectile, damagePlayer, slamShockwave };

// ---------- camera ----------
const CAM_DIST = 5.6, CAM_HEIGHT = 1.7;
function updateCamera(dt) {
  const sens = 0.0026;
  camYaw -= mouseDX * sens;
  camPitch = Math.min(1.1, Math.max(-0.35, camPitch + mouseDY * sens));
  mouseDX = 0; mouseDY = 0;

  if (lockTarget && !lockTarget.dead) {
    // bias camera toward keeping the target framed
    const to = lockTarget.pos.clone().sub(player.pos);
    const targetYaw = Math.atan2(to.x, to.z) + Math.PI; // camera sits behind player
    let d = targetYaw - camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    camYaw += d * Math.min(1, dt * 4);
  }

  const pivot = player.pos.clone().add(new THREE.Vector3(0, CAM_HEIGHT, 0));
  const off = new THREE.Vector3(
    Math.sin(camYaw) * Math.cos(camPitch),
    Math.sin(camPitch),
    Math.cos(camYaw) * Math.cos(camPitch)
  ).multiplyScalar(CAM_DIST);
  const desired = pivot.clone().add(off);

  // keep camera inside the arena and above the floor
  desired.y = Math.max(0.4, desired.y);
  camera.position.lerp(desired, Math.min(1, dt * 10));
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 1.8);
    camera.position.x += (Math.random() - 0.5) * shake * 0.25;
    camera.position.y += (Math.random() - 0.5) * shake * 0.25;
  }
  const lookAt = lockTarget && !lockTarget.dead
    ? pivot.clone().lerp(lockTarget.lockPoint, 0.35)
    : pivot;
  camera.lookAt(lookAt);
}

// ---------- HUD ----------
function updateHUD() {
  ui.setHP(player.hp / PCFG.maxHP);
  ui.setStamina(player.stamina / PCFG.maxStamina);
  ui.setCoffee(player.coffee, PCFG.coffeeMax);
  ui.setCode(player.code);

  if (boss && bossTriggered && !boss.dead) ui.setBoss(boss.hp / boss.maxHP);

  // interact prompt
  const cp = nearestCheckpoint();
  if (gameState === 'play') {
    if (cp) ui.setPrompt(`<b>E</b> — พักที่ ${cp.name} (ฟื้นพลัง / เซฟเกม)`);
    else if (codeDrop && codeDrop.mesh.position.clone().setY(0).distanceTo(player.pos) < 2.2)
      ui.setPrompt(`<b>E</b> — เก็บ ${codeDrop.amount.toLocaleString()} LINES OF CODE คืน`);
    else if (document.pointerLockElement !== canvas)
      ui.setPrompt('คลิกที่หน้าจอเพื่อควบคุมตัวละคร');
    else ui.setPrompt('');
  } else ui.setPrompt('');

  // lock-on marker
  if (lockTarget && !lockTarget.dead) {
    const p = lockTarget.lockPoint.project(camera);
    if (p.z < 1) {
      ui.setLockMarker(
        (p.x * 0.5 + 0.5) * window.innerWidth,
        (-p.y * 0.5 + 0.5) * window.innerHeight,
        true
      );
    } else ui.setLockMarker(0, 0, false);
  } else {
    ui.setLockMarker(0, 0, false);
    if (lockTarget?.dead) lockTarget = null;
  }
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  world.update(dt, elapsed);

  if (gameState === 'title') {
    // slow orbit around the spawn area
    const a = elapsed * 0.12;
    camera.position.set(PLAYER_SPAWN.x + Math.sin(a) * 12, 5, PLAYER_SPAWN.z + Math.cos(a) * 12);
    camera.lookAt(PLAYER_SPAWN.x, 1.5, PLAYER_SPAWN.z - 6);
    renderer.render(scene, camera);
    return;
  }

  if (gameState === 'play' || gameState === 'dead' || gameState === 'win') {
    // --- player input ---
    if (gameState === 'play' && player.alive) {
      const ix = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
      const iz = (keys['KeyS'] ? 1 : 0) - (keys['KeyW'] ? 1 : 0);
      const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const moveDir = new THREE.Vector3()
        .addScaledVector(fwd, -iz)
        .addScaledVector(right, ix);
      if (moveDir.lengthSq() > 1) moveDir.normalize();

      let lockDir = null;
      if (lockTarget && !lockTarget.dead) {
        lockDir = lockTarget.pos.clone().sub(player.pos).setY(0).normalize();
      }

      if (queuedRoll) { if (player.tryRoll(moveDir)) sfx.play('roll'); }
      if (queuedLight) { if (player.tryAttack('light')) sfx.play('swing'); }
      if (queuedHeavy) { if (player.tryAttack('heavy')) sfx.play('heavy'); }
      if (queuedDrink) { if (player.tryDrink()) sfx.play('sip'); }
      if (queuedInteract) {
        const cp = nearestCheckpoint();
        if (cp) restAt(cp);
        else if (codeDrop && codeDrop.mesh.position.clone().setY(0).distanceTo(player.pos) < 2.2) {
          player.code += codeDrop.amount;
          sfx.play('pickup');
          ui.toast(`+${codeDrop.amount.toLocaleString()} LINES OF CODE RECOVERED`);
          scene.remove(codeDrop.mesh);
          codeDrop = null;
        }
      }
      player.update(dt, { moveDir, sprint: keys['ShiftLeft'] || keys['ShiftRight'], lockDir }, world);
      resolvePlayerAttack();
    } else {
      player.update(dt, { moveDir: new THREE.Vector3(), sprint: false, lockDir: null }, world);
    }
    queuedRoll = queuedDrink = queuedInteract = queuedLight = queuedHeavy = false;

    // --- enemies ---
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.update(dt, player, world, enemyApi, elapsed);
      if (e.dead && e.deathT > 0.5) enemies.splice(i, 1);
    }

    // --- boss trigger + update ---
    if (boss && !boss.dead) {
      if (!bossTriggered && gameState === 'play') {
        const dz = player.pos.x - world.bossZone.x, dx = player.pos.z - world.bossZone.z;
        if (dz * dz + dx * dx < world.bossZone.r * world.bossZone.r) {
          bossTriggered = true;
          boss.awaken();
          ui.showBoss(BOSSCFG.name);
          ui.toast('⚠ BOSS — NEXUS-9 ตื่นแล้ว', 3000);
          sfx.play('bossroar');
          addShake(0.5);
        }
      }
      if (boss.phaseJustChanged) {
        boss.phaseJustChanged = false;
        ui.toast('NEXUS-9 OVERCLOCKED — PHASE 2', 2600);
        sfx.play('bossroar');
        addShake(0.6);
      }
    }
    if (boss) boss.update(dt, player, world, enemyApi, elapsed);

    updateProjectiles(dt);
    updateBursts(dt);
    updateShockwaves(dt);

    // dropped code shimmer
    if (codeDrop) {
      codeDrop.mesh.rotation.y += dt * 2.5;
      codeDrop.mesh.position.y = 0.8 + Math.sin(elapsed * 3) * 0.15;
    }

    // --- state transitions ---
    if (gameState === 'dead') {
      deathTimer -= dt;
      if (deathTimer <= 0) {
        ui.showScreen('death');
        document.exitPointerLock?.();
      }
    }
    if (winTimer > 0) {
      winTimer -= dt;
      if (winTimer <= 0 && gameState === 'play') {
        gameState = 'win';
        ui.showScreen('win');
        document.exitPointerLock?.();
      }
    }

    updateCamera(dt);
    updateHUD();
    renderer.render(scene, camera);
  }
}

// ---------- screen buttons ----------
document.getElementById('btn-start').addEventListener('click', () => {
  sfx.ensure();
  gameState = 'play';
  ui.hideScreens();
  ui.showHUD(true);
  camYaw = 0; camPitch = 0.32;
  canvas.requestPointerLock();
  ui.toast('หนีให้พ้นเดดไลน์… และอย่าโดนไล่ออก', 3200);
});
document.getElementById('btn-respawn').addEventListener('click', respawn);
document.getElementById('btn-again').addEventListener('click', () => location.reload());

// debug handle for automated tests / tuning
window.__game = {
  player,
  get enemies() { return enemies; },
  get boss() { return boss; },
  get state() { return gameState; },
};

document.getElementById('loading').remove();
tick();
