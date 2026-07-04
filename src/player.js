import * as THREE from 'three';
import { COLORS, PLAYER } from './config.js';

function makeKeyboardTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = '#22262c';
  g.fillRect(0, 0, 128, 48);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 12; col++) {
      g.fillStyle = (row === 3 && col > 3 && col < 8) ? '#f97316'
        : (Math.random() < 0.12 ? '#fb923c' : '#3a4048');
      g.fillRect(4 + col * 10, 4 + row * 11, 8, 9);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildProgrammerModel() {
  const grp = new THREE.Group();
  const hoodieMat = new THREE.MeshStandardMaterial({ color: COLORS.gray600, roughness: 0.9 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: COLORS.white, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: COLORS.gray800, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8c39e, roughness: 0.7 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: COLORS.orange, emissive: COLORS.orange, emissiveIntensity: 0.35, roughness: 0.6 });

  // legs (pivot at hip so they can swing)
  const legL = new THREE.Group(); legL.position.set(-0.14, 0.72, 0);
  const legLm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.24), pantsMat);
  legLm.position.y = -0.36; legLm.castShadow = true;
  legL.add(legLm);
  const legR = legL.clone(); legR.position.x = 0.14;
  grp.add(legL, legR);

  // torso: gray hoodie with white shirt peeking + orange zipper stripe
  const torso = new THREE.Group(); torso.position.y = 0.72;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.34), hoodieMat);
  chest.position.y = 0.31; chest.castShadow = true;
  torso.add(chest);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.02), shirtMat);
  shirt.position.set(0, 0.5, 0.18);
  torso.add(shirt);
  const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.02), orangeMat);
  zipper.position.set(0, 0.3, 0.18);
  torso.add(zipper);
  // laptop backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.12), pantsMat);
  pack.position.set(0, 0.32, -0.24);
  torso.add(pack);
  const packLED = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), orangeMat);
  packLED.position.set(0.1, 0.45, -0.31);
  torso.add(packLED);
  grp.add(torso);

  // head with hood + glasses
  const head = new THREE.Group(); head.position.y = 1.4;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skinMat);
  face.position.y = 0.17; face.castShadow = true;
  head.add(face);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.38), hoodieMat);
  hood.position.set(0, 0.19, -0.05);
  head.add(hood);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.2, metalness: 0.5 });
  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.02), glassMat);
  glasses.position.set(0, 0.2, 0.17);
  head.add(glasses);
  grp.add(head);

  // arms (pivot at shoulder)
  const armL = new THREE.Group(); armL.position.set(-0.36, 1.28, 0);
  const armLm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), hoodieMat);
  armLm.position.y = -0.3; armLm.castShadow = true;
  armL.add(armLm);
  const armR = new THREE.Group(); armR.position.set(0.36, 1.28, 0);
  const armRm = armLm.clone();
  armR.add(armRm);
  grp.add(armL, armR);

  // weapon: legendary mechanical keyboard, gripped at one end
  const weapon = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.06, 0.95),
    new THREE.MeshStandardMaterial({ map: makeKeyboardTexture(), roughness: 0.5, metalness: 0.3 })
  );
  board.position.z = -0.45; // blade extends forward from grip
  board.castShadow = true;
  weapon.add(board);
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.02, 0.97),
    new THREE.MeshStandardMaterial({ color: COLORS.orange, emissive: COLORS.orange, emissiveIntensity: 1.6 })
  );
  edge.position.set(0, -0.035, -0.45);
  weapon.add(edge);
  weapon.position.set(0, -0.55, 0.05);
  armR.add(weapon);

  return { grp, legL, legR, armL, armR, torso, head, weapon };
}

export class Player {
  constructor(scene) {
    this.parts = buildProgrammerModel();
    this.group = new THREE.Group();
    this.group.add(this.parts.grp);
    scene.add(this.group);

    this.pos = this.group.position;
    this.yaw = Math.PI; // face -z (north, toward the boss)
    this.vel = new THREE.Vector3();

    this.hp = PLAYER.maxHP;
    this.stamina = PLAYER.maxStamina;
    this.coffee = PLAYER.coffeeMax;
    this.code = 0;

    this.state = 'idle';       // idle | roll | attack | drink | stagger | dead
    this.stateT = 0;
    this.attack = null;        // { kind, cfg, hitSet }
    this.rollDir = new THREE.Vector3();
    this.walkCycle = 0;
    this.staminaLock = 0;      // brief delay before regen after spending
    this.hurtFlash = 0;
  }

  get alive() { return this.state !== 'dead'; }

  forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  spendStamina(v) {
    this.stamina = Math.max(0, this.stamina - v);
    this.staminaLock = 0.7;
  }

  tryRoll(dir) {
    if (this.state !== 'idle' || this.stamina < PLAYER.costs.roll) return false;
    this.spendStamina(PLAYER.costs.roll);
    this.state = 'roll'; this.stateT = 0;
    this.rollDir.copy(dir.lengthSq() > 0.01 ? dir : this.forward()).normalize();
    this.yaw = Math.atan2(this.rollDir.x, this.rollDir.z);
    return true;
  }

  tryAttack(kind) {
    if (this.state !== 'idle') return false;
    const cost = kind === 'heavy' ? PLAYER.costs.heavy : PLAYER.costs.light;
    if (this.stamina < cost) return false;
    this.spendStamina(cost);
    this.state = 'attack'; this.stateT = 0;
    this.attack = { kind, cfg: PLAYER[kind], hitSet: new Set() };
    return true;
  }

  tryDrink() {
    if (this.state !== 'idle' || this.coffee <= 0 || this.hp >= PLAYER.maxHP) return false;
    this.coffee--;
    this.state = 'drink'; this.stateT = 0;
    return true;
  }

  // returns { range, arc, damage, hitSet } while the swing is in its active window
  getActiveHit() {
    if (this.state !== 'attack' || !this.attack) return null;
    const { cfg } = this.attack;
    if (this.stateT >= cfg.windup && this.stateT <= cfg.windup + cfg.active) {
      return { range: cfg.range, arc: cfg.arc, damage: cfg.damage, hitSet: this.attack.hitSet };
    }
    return null;
  }

  isInvulnerable() {
    if (this.state === 'roll') {
      const [a, b] = PLAYER.rollIFrames;
      return this.stateT >= a && this.stateT <= b;
    }
    return false;
  }

  takeDamage(amount, fromPos) {
    if (!this.alive || this.isInvulnerable()) return false;
    this.hp -= amount;
    this.hurtFlash = 0.25;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dead'; this.stateT = 0;
      return true;
    }
    // interrupt whatever we were doing
    this.state = 'stagger'; this.stateT = 0;
    this.attack = null;
    if (fromPos) {
      const kb = this.pos.clone().sub(fromPos).setY(0).normalize().multiplyScalar(2.2);
      this.vel.add(kb);
    }
    return true;
  }

  respawn(pos) {
    this.pos.set(pos.x, 0, pos.z);
    this.hp = PLAYER.maxHP;
    this.stamina = PLAYER.maxStamina;
    this.coffee = PLAYER.coffeeMax;
    this.state = 'idle'; this.stateT = 0;
    this.attack = null;
    this.vel.set(0, 0, 0);
  }

  update(dt, input, world) {
    this.stateT += dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    // stamina regen
    this.staminaLock -= dt;
    if (this.staminaLock <= 0 && this.state !== 'dead') {
      this.stamina = Math.min(PLAYER.maxStamina, this.stamina + PLAYER.staminaRegen * dt);
    }

    const move = input.moveDir; // world-space, normalized or zero
    let speed = 0;

    switch (this.state) {
      case 'idle': {
        const sprinting = input.sprint && move.lengthSq() > 0.01 && this.stamina > 1;
        speed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
        if (sprinting) this.spendStamina(PLAYER.costs.sprint * dt);
        if (move.lengthSq() > 0.01) {
          const targetYaw = input.lockDir
            ? Math.atan2(input.lockDir.x, input.lockDir.z)
            : Math.atan2(move.x, move.z);
          this.yaw = lerpAngle(this.yaw, targetYaw, Math.min(1, dt * 12));
          this.vel.x = move.x * speed;
          this.vel.z = move.z * speed;
        } else {
          if (input.lockDir) {
            this.yaw = lerpAngle(this.yaw, Math.atan2(input.lockDir.x, input.lockDir.z), Math.min(1, dt * 8));
          }
          this.vel.x *= Math.pow(0.0001, dt);
          this.vel.z *= Math.pow(0.0001, dt);
        }
        break;
      }
      case 'roll': {
        const k = Math.max(0, 1 - this.stateT / PLAYER.rollTime);
        this.vel.x = this.rollDir.x * PLAYER.rollSpeed * (0.4 + 0.6 * k);
        this.vel.z = this.rollDir.z * PLAYER.rollSpeed * (0.4 + 0.6 * k);
        if (this.stateT >= PLAYER.rollTime) { this.state = 'idle'; this.stateT = 0; }
        break;
      }
      case 'attack': {
        const { cfg } = this.attack;
        // small forward lunge during the active frames
        if (this.stateT >= cfg.windup && this.stateT <= cfg.windup + cfg.active) {
          const f = this.forward();
          this.vel.x = f.x * 2.4; this.vel.z = f.z * 2.4;
        } else {
          this.vel.x *= Math.pow(0.001, dt); this.vel.z *= Math.pow(0.001, dt);
        }
        if (input.lockDir && this.stateT < cfg.windup) {
          this.yaw = lerpAngle(this.yaw, Math.atan2(input.lockDir.x, input.lockDir.z), Math.min(1, dt * 10));
        }
        if (this.stateT >= cfg.windup + cfg.active + cfg.recover) {
          this.state = 'idle'; this.stateT = 0; this.attack = null;
        }
        break;
      }
      case 'drink': {
        this.vel.x *= Math.pow(0.001, dt); this.vel.z *= Math.pow(0.001, dt);
        if (this.stateT >= PLAYER.coffeeTime) {
          this.hp = Math.min(PLAYER.maxHP, this.hp + PLAYER.coffeeHeal);
          this.state = 'idle'; this.stateT = 0;
        }
        break;
      }
      case 'stagger': {
        this.vel.x *= Math.pow(0.01, dt); this.vel.z *= Math.pow(0.01, dt);
        if (this.stateT >= 0.38) { this.state = 'idle'; this.stateT = 0; }
        break;
      }
      case 'dead': {
        this.vel.set(0, 0, 0);
        break;
      }
    }

    // integrate + collide
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    resolveCollisions(this.pos, PLAYER.radius, world);

    this._animate(dt);
  }

  _animate(dt) {
    const { grp, legL, legR, armL, armR, torso } = this.parts;
    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.5;
    grp.rotation.y = this.yaw;

    if (this.state === 'roll') {
      const k = this.stateT / PLAYER.rollTime;
      grp.rotation.x = k * Math.PI * 2;
      grp.position.y = Math.sin(k * Math.PI) * 0.25;
    } else {
      grp.rotation.x = 0;
      grp.position.y = 0;
    }

    if (this.state === 'attack' && this.attack) {
      const { cfg, kind } = this.attack;
      const total = cfg.windup + cfg.active + cfg.recover;
      const k = Math.min(1, this.stateT / total);
      const windK = cfg.windup / total;
      let swing;
      if (k < windK) swing = -(k / windK) * 1.4;                        // raise back
      else swing = -1.4 + ((k - windK) / (1 - windK)) * 3.2;            // slash down/through
      armR.rotation.x = -Math.PI / 2 + swing * (kind === 'heavy' ? 1.25 : 1);
      armR.rotation.z = kind === 'heavy' ? -0.35 : -0.15;
      torso.rotation.y = -swing * 0.25;
      armL.rotation.x = swing * 0.3;
    } else if (this.state === 'drink') {
      armL.rotation.x = -2.4;   // mug to face
      armR.rotation.x = moving ? Math.sin(this.walkCycle) * 0.6 : 0;
      torso.rotation.y = 0;
    } else if (this.state === 'dead') {
      grp.rotation.x = -Math.PI / 2;
      grp.position.y = 0.3;
    } else {
      torso.rotation.y = 0;
      if (moving) {
        this.walkCycle += dt * (Math.hypot(this.vel.x, this.vel.z) > 5 ? 13 : 9);
        const s = Math.sin(this.walkCycle) * 0.65;
        legL.rotation.x = s; legR.rotation.x = -s;
        armL.rotation.x = -s * 0.7; armR.rotation.x = s * 0.7;
      } else {
        this.walkCycle = 0;
        const breathe = Math.sin(performance.now() * 0.002) * 0.04;
        legL.rotation.x = legR.rotation.x = 0;
        armL.rotation.x = breathe; armR.rotation.x = -breathe;
      }
    }
  }
}

export function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function resolveCollisions(pos, radius, world) {
  const { colliders, bounds } = world;
  for (const c of colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const min = radius + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x = c.x + (dx / d) * min;
      pos.z = c.z + (dz / d) * min;
    }
  }
  pos.x = Math.min(bounds.maxX, Math.max(bounds.minX, pos.x));
  pos.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, pos.z));
}
