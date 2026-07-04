import * as THREE from 'three';
import { COLORS, ENEMY_TYPES, BOSS } from './config.js';
import { resolveCollisions, lerpAngle } from './player.js';

let nextId = 1;

// ---------- models ----------
function buildBugModel() {
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.gray800, roughness: 0.6, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), bodyMat);
  body.scale.set(1.2, 0.7, 1.5);
  body.position.y = 0.45;
  body.castShadow = true;
  grp.add(body);
  const eyeMat = new THREE.MeshStandardMaterial({ color: COLORS.orange, emissive: COLORS.orange, emissiveIntensity: 2.5 });
  for (const sx of [-0.16, 0.16]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
    eye.position.set(sx, 0.55, 0.6);
    grp.add(eye);
  }
  const legMat = new THREE.MeshStandardMaterial({ color: COLORS.gray700, roughness: 0.8 });
  const legs = [];
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), legMat);
      leg.position.set(side * 0.5, 0.3, -0.35 + i * 0.35);
      leg.rotation.z = side * 0.7;
      grp.add(leg);
      legs.push(leg);
    }
  }
  // little glitch antenna
  const ant = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), eyeMat);
  ant.position.set(0, 0.9, 0.2);
  grp.add(ant);
  return { grp, legs, body };
}

function buildDroneModel() {
  const grp = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42),
    new THREE.MeshStandardMaterial({ color: COLORS.orange, emissive: COLORS.orange, emissiveIntensity: 1.8, roughness: 0.3 })
  );
  core.castShadow = true;
  grp.add(core);
  const ringMat = new THREE.MeshStandardMaterial({ color: COLORS.gray500, roughness: 0.4, metalness: 0.8 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 24), ringMat);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.04, 8, 24), ringMat);
  ring2.rotation.x = Math.PI / 2;
  grp.add(ring1, ring2);
  return { grp, core, ring1, ring2 };
}

function buildBossModel() {
  const grp = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshStandardMaterial({
      color: COLORS.gray900, emissive: COLORS.orange, emissiveIntensity: 0.9,
      roughness: 0.3, metalness: 0.7, flatShading: true,
    })
  );
  core.castShadow = true;
  grp.add(core);
  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.62, 1),
    new THREE.MeshBasicMaterial({ color: COLORS.orangeBright, wireframe: true, transparent: true, opacity: 0.4 })
  );
  grp.add(wire);
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 12),
    new THREE.MeshStandardMaterial({ color: COLORS.white, emissive: COLORS.white, emissiveIntensity: 1.2 })
  );
  eye.position.set(0, 0.2, 1.35);
  grp.add(eye);
  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8),
    new THREE.MeshStandardMaterial({ color: COLORS.orangeDark, emissive: COLORS.orange, emissiveIntensity: 3 })
  );
  pupil.position.set(0, 0.2, 1.75);
  grp.add(pupil);

  const ringMat = new THREE.MeshStandardMaterial({ color: COLORS.gray600, roughness: 0.35, metalness: 0.85 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.1, 8, 40), ringMat);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.07, 8, 40), ringMat);
  grp.add(ring1, ring2);

  const shards = new THREE.Group();
  const shardMat = new THREE.MeshStandardMaterial({ color: COLORS.gray700, emissive: COLORS.orange, emissiveIntensity: 0.7, flatShading: true });
  for (let i = 0; i < 8; i++) {
    const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.32), shardMat);
    const a = (i / 8) * Math.PI * 2;
    sh.position.set(Math.cos(a) * 2.2, Math.sin(a * 2) * 0.5, Math.sin(a) * 2.2);
    shards.add(sh);
  }
  grp.add(shards);

  const light = new THREE.PointLight(COLORS.orange, 25, 26, 1.7);
  grp.add(light);

  return { grp, core, wire, eye, pupil, ring1, ring2, shards, light };
}

// ---------- enemy ----------
export class Enemy {
  constructor(scene, type, x, z) {
    this.id = nextId++;
    this.type = type;
    this.cfg = ENEMY_TYPES[type];
    this.hp = this.cfg.hp;
    this.maxHP = this.cfg.hp;
    this.isBoss = false;

    this.model = type === 'bug' ? buildBugModel() : buildDroneModel();
    this.group = this.model.grp;
    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.scene = scene;

    this.home = new THREE.Vector3(x, 0, z);
    this.pos = this.group.position;
    this.yaw = Math.random() * Math.PI * 2;
    this.state = 'idle';   // idle | chase | windup | recover | dead
    this.stateT = 0;
    this.dead = false;
    this.deathT = 0;
    this.hitFlash = 0;
    this.bobPhase = Math.random() * 10;
  }

  get height() { return this.type === 'drone' ? 1.9 : 0.5; }
  get lockPoint() { return this.pos.clone().setY(this.height); }

  takeDamage(dmg, fromPos) {
    if (this.dead) return;
    this.hp -= dmg;
    this.hitFlash = 0.18;
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dead';
      this.deathT = 0;
      return;
    }
    // stagger out of attacks
    if (this.state === 'windup') { this.state = 'recover'; this.stateT = -0.2; }
    if (fromPos && this.type === 'bug') {
      const kb = this.pos.clone().sub(fromPos).setY(0).normalize().multiplyScalar(0.6);
      this.pos.add(kb);
    }
  }

  update(dt, player, world, api, t) {
    this.stateT += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    if (this.dead) {
      this.deathT += dt;
      this.group.scale.setScalar(Math.max(0.001, 1 - this.deathT * 2));
      this.group.rotation.y += dt * 10;
      if (this.deathT > 0.5) { this.scene.remove(this.group); }
      return;
    }

    const toPlayer = player.pos.clone().sub(this.pos).setY(0);
    const dist = toPlayer.length();
    const dir = dist > 1e-4 ? toPlayer.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const canSee = dist < this.cfg.aggroRange && player.alive;

    switch (this.state) {
      case 'idle':
        if (canSee) this.state = 'chase';
        break;

      case 'chase': {
        if (!player.alive) { this.state = 'idle'; break; }
        this.yaw = lerpAngle(this.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * 6));
        if (this.type === 'bug') {
          if (dist <= this.cfg.attackRange) { this.state = 'windup'; this.stateT = 0; }
          else {
            this.pos.x += dir.x * this.cfg.speed * dt;
            this.pos.z += dir.z * this.cfg.speed * dt;
          }
        } else { // drone: keep mid distance, strafe, then fire
          let mv = 0;
          if (dist > this.cfg.keepDistance + 1.5) mv = 1;
          else if (dist < this.cfg.keepDistance - 1.5) mv = -1;
          const strafe = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.sin(t * 0.7 + this.bobPhase));
          this.pos.x += (dir.x * mv + strafe.x * 0.5) * this.cfg.speed * dt;
          this.pos.z += (dir.z * mv + strafe.z * 0.5) * this.cfg.speed * dt;
          if (dist <= this.cfg.attackRange && this.stateT > 1.2) { this.state = 'windup'; this.stateT = 0; }
        }
        break;
      }

      case 'windup': {
        this.yaw = lerpAngle(this.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * 3));
        if (this.stateT >= this.cfg.windup) {
          if (this.type === 'bug') {
            // lunge bite: hit if player still in range in front
            if (dist <= this.cfg.attackRange + 0.6) {
              api.damagePlayer(this.cfg.damage, this.pos);
            }
            const lunge = dir.clone().multiplyScalar(1.2);
            this.pos.add(lunge);
          } else {
            api.spawnProjectile(this.lockPoint, player.pos.clone().setY(1.1).sub(this.lockPoint).normalize(), this.cfg.projectileSpeed, this.cfg.damage);
          }
          this.state = 'recover'; this.stateT = 0;
        }
        break;
      }

      case 'recover':
        if (this.stateT >= this.cfg.recover) { this.state = canSee ? 'chase' : 'idle'; this.stateT = 0; }
        break;
    }

    resolveCollisions(this.pos, this.cfg.radius, world);
    this._animate(dt, t);
  }

  _animate(dt, t) {
    this.group.rotation.y = this.yaw;
    const flash = this.hitFlash > 0;
    if (this.type === 'bug') {
      const { legs, body } = this.model;
      const moving = this.state === 'chase';
      legs.forEach((leg, i) => {
        leg.rotation.x = moving ? Math.sin(t * 14 + i * 1.3) * 0.5 : 0;
      });
      body.material.emissive = new THREE.Color(flash ? COLORS.white : (this.state === 'windup' ? COLORS.orangeDark : 0x000000));
      body.material.emissiveIntensity = flash ? 1.5 : 0.8;
      // glitch jitter when winding up
      this.model.grp.position.y = this.state === 'windup' ? (Math.random() - 0.5) * 0.06 : 0;
    } else {
      const { core, ring1, ring2 } = this.model;
      this.group.position.y = 0; // pos is ground-level; visual parts float
      core.position.y = 1.9 + Math.sin(t * 2 + this.bobPhase) * 0.15;
      ring1.position.copy(core.position);
      ring2.position.copy(core.position);
      ring1.rotation.y += dt * 2; ring1.rotation.x += dt * 0.7;
      ring2.rotation.z += dt * 1.4;
      core.rotation.y += dt * 3;
      core.material.emissiveIntensity = flash ? 4 : (this.state === 'windup' ? 3.2 : 1.8);
      core.material.color.set(flash ? COLORS.white : COLORS.orange);
    }
  }
}

// ---------- boss ----------
export class Boss {
  constructor(scene, x, z) {
    this.id = nextId++;
    this.cfg = BOSS;
    this.hp = BOSS.hp;
    this.maxHP = BOSS.hp;
    this.isBoss = true;
    this.type = 'boss';

    this.model = buildBossModel();
    this.group = this.model.grp;
    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.scene = scene;

    this.pos = this.group.position;
    this.home = new THREE.Vector3(x, 0, z);
    this.yaw = 0;
    this.state = 'dormant'; // dormant | chase | slamWindup | burstWindup | chargeWindup | charging | recover | dead
    this.stateT = 0;
    this.dead = false;
    this.deathT = 0;
    this.hitFlash = 0;
    this.phase = 1;
    this.chargeDir = new THREE.Vector3();
    this.attackCooldown = 0;
  }

  get height() { return 2.6; }
  get lockPoint() { return this.pos.clone().setY(this.height); }
  get speedMult() { return this.phase === 2 ? this.cfg.phase2SpeedMult : 1; }

  awaken() {
    if (this.state === 'dormant') { this.state = 'chase'; this.stateT = 0; }
  }

  takeDamage(dmg) {
    if (this.dead || this.state === 'dormant') return;
    this.hp -= dmg;
    this.hitFlash = 0.15;
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.state = 'dead'; this.deathT = 0;
      return;
    }
    if (this.phase === 1 && this.hp / this.maxHP <= this.cfg.phase2At) {
      this.phase = 2;
      this.phaseJustChanged = true;
    }
  }

  _pickAttack(dist) {
    if (dist <= this.cfg.slam.range * 0.9) return 'slamWindup';
    if (dist > 11 || Math.random() < 0.35) return Math.random() < 0.5 ? 'burstWindup' : 'chargeWindup';
    return 'chargeWindup';
  }

  update(dt, player, world, api, t) {
    this.stateT += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown -= dt;

    if (this.dead) {
      this.deathT += dt;
      const k = this.deathT / 2.5;
      this.group.rotation.y += dt * (2 + k * 14);
      this.group.scale.setScalar(Math.max(0.001, 1 - k));
      this.model.light.intensity = 25 * (1 - k) + Math.random() * 20 * (1 - k);
      if (k >= 1) this.scene.remove(this.group);
      return;
    }

    const toPlayer = player.pos.clone().sub(this.pos).setY(0);
    const dist = toPlayer.length();
    const dir = dist > 1e-4 ? toPlayer.clone().normalize() : new THREE.Vector3(0, 0, 1);

    switch (this.state) {
      case 'dormant':
        break;

      case 'chase': {
        if (!player.alive) break;
        this.yaw = lerpAngle(this.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * 4));
        const spd = this.cfg.speed * this.speedMult;
        if (dist > this.cfg.slam.range * 0.7) {
          this.pos.x += dir.x * spd * dt;
          this.pos.z += dir.z * spd * dt;
        }
        if (this.attackCooldown <= 0 && player.alive) {
          this.state = this._pickAttack(dist);
          this.stateT = 0;
        }
        break;
      }

      case 'slamWindup': {
        this.yaw = lerpAngle(this.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * 2.5));
        if (this.stateT >= this.cfg.slam.windup / this.speedMult) {
          api.slamShockwave(this.pos.clone(), this.cfg.slam.range);
          if (dist <= this.cfg.slam.range) api.damagePlayer(this.cfg.slam.damage, this.pos);
          this.state = 'recover'; this.stateT = 0;
          this.attackCooldown = this.cfg.slam.recover / this.speedMult;
        }
        break;
      }

      case 'burstWindup': {
        this.yaw = lerpAngle(this.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * 2));
        if (this.stateT >= this.cfg.burst.windup / this.speedMult) {
          const n = this.cfg.burst.count + (this.phase === 2 ? 6 : 0);
          const baseAngle = Math.atan2(dir.x, dir.z);
          const spread = this.phase === 2 ? Math.PI * 2 : Math.PI * 0.9;
          for (let i = 0; i < n; i++) {
            const a = baseAngle + (i / (n - 1) - 0.5) * spread;
            const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
            api.spawnProjectile(this.lockPoint.setY(1.6), d, this.cfg.burst.speed, this.cfg.burst.damage);
          }
          this.state = 'recover'; this.stateT = 0;
          this.attackCooldown = this.cfg.burst.recover / this.speedMult;
        }
        break;
      }

      case 'chargeWindup': {
        this.yaw = lerpAngle(this.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * 5));
        if (this.stateT >= this.cfg.charge.windup / this.speedMult) {
          this.chargeDir.copy(dir);
          this.chargeHit = false;
          this.state = 'charging'; this.stateT = 0;
        }
        break;
      }

      case 'charging': {
        const spd = this.cfg.charge.speed * this.speedMult;
        this.pos.x += this.chargeDir.x * spd * dt;
        this.pos.z += this.chargeDir.z * spd * dt;
        if (!this.chargeHit && dist < this.cfg.radius + 0.9) {
          api.damagePlayer(this.cfg.charge.damage, this.pos);
          this.chargeHit = true;
        }
        if (this.stateT >= this.cfg.charge.duration) {
          this.state = 'recover'; this.stateT = 0;
          this.attackCooldown = this.cfg.charge.recover / this.speedMult;
        }
        break;
      }

      case 'recover':
        if (this.stateT >= 0.6 / this.speedMult) { this.state = 'chase'; this.stateT = 0; }
        break;
    }

    resolveCollisions(this.pos, this.cfg.radius, world);
    this._animate(dt, t);
  }

  _animate(dt, t) {
    const { core, wire, eye, pupil, ring1, ring2, shards, light } = this.model;
    this.group.rotation.y = this.yaw;

    const hover = 2.4 + Math.sin(t * 1.4) * 0.25;
    core.position.y = hover;
    wire.position.y = hover;
    eye.position.y = hover + 0.2;
    pupil.position.y = hover + 0.2;
    ring1.position.y = hover; ring2.position.y = hover;
    shards.position.y = hover;
    light.position.y = hover;

    const agitated = this.state.includes('Windup') || this.state === 'charging';
    const spin = agitated ? 4 : 1.2;
    ring1.rotation.x += dt * spin * 0.7; ring1.rotation.y += dt * spin;
    ring2.rotation.z += dt * spin * 1.3; ring2.rotation.x += dt * spin * 0.4;
    shards.rotation.y += dt * (this.phase === 2 ? 3 : 1.2);
    core.rotation.y += dt * 0.8; core.rotation.x += dt * 0.3;

    const flash = this.hitFlash > 0;
    core.material.emissiveIntensity = flash ? 3.5 : (agitated ? 2.2 : 0.9) * (this.phase === 2 ? 1.5 : 1);
    wire.material.opacity = 0.25 + (agitated ? 0.45 : 0.15) + (this.phase === 2 ? 0.15 : 0);
    pupil.material.emissiveIntensity = agitated ? 6 : 3;
    light.intensity = (this.phase === 2 ? 34 : 25) + (flash ? 20 : 0);

    if (this.state === 'slamWindup') {
      const k = this.stateT / (this.cfg.slam.windup / this.speedMult);
      this.group.position.y = k * 1.6;
    } else {
      this.group.position.y = Math.max(0, this.group.position.y - dt * 6);
    }
  }
}
