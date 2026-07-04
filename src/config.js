// Palette: orange / gray / white — inspired by anyimedia.com branding
export const COLORS = {
  orange:       0xf97316,
  orangeBright: 0xfb923c,
  orangeDark:   0xc2410c,
  gray900:      0x17191d,
  gray800:      0x1f2329,
  gray700:      0x2b3038,
  gray600:      0x3a4048,
  gray500:      0x6b7280,
  gray300:      0xb9bfc7,
  white:        0xf5f6f7,
  fog:          0x1a1c21,
};

export const PLAYER = {
  radius: 0.45,
  walkSpeed: 4.2,
  sprintSpeed: 7.0,
  rollSpeed: 9.5,
  rollTime: 0.45,
  rollIFrames: [0.05, 0.32],   // window (seconds into roll) with invulnerability
  maxHP: 100,
  maxStamina: 100,
  staminaRegen: 26,
  costs: { roll: 25, light: 16, heavy: 34, sprint: 12 },  // sprint = per second
  light: { damage: 22, range: 2.6, arc: Math.PI * 0.6, windup: 0.14, active: 0.16, recover: 0.24 },
  heavy: { damage: 48, range: 3.0, arc: Math.PI * 0.75, windup: 0.42, active: 0.20, recover: 0.42 },
  coffeeHeal: 55,
  coffeeMax: 3,
  coffeeTime: 1.0,
};

export const ENEMY_TYPES = {
  bug: {   // "Spam Bug" — melee crawler
    name: 'SPAM BUG',
    hp: 46, speed: 3.4, damage: 14, code: 35,
    attackRange: 1.9, aggroRange: 14, windup: 0.55, active: 0.18, recover: 0.9,
    radius: 0.55,
  },
  drone: { // "Autocomplete Wraith" — floating ranged AI
    name: 'AUTOCOMPLETE WRAITH',
    hp: 34, speed: 2.6, damage: 12, code: 55,
    attackRange: 13, keepDistance: 8, aggroRange: 18, windup: 0.8, recover: 1.6,
    projectileSpeed: 11, radius: 0.6,
  },
};

export const BOSS = {
  name: 'NEXUS-9 — DEVOURER OF CAREERS',
  hp: 620, speed: 3.0, code: 5000,
  radius: 1.6,
  slam:  { range: 4.6, damage: 34, windup: 0.9, recover: 1.1 },
  burst: { count: 8, damage: 12, speed: 9, windup: 1.0, recover: 1.4 },
  charge:{ speed: 13, damage: 26, windup: 0.7, duration: 0.9, recover: 1.2 },
  phase2At: 0.5,        // fraction of HP
  phase2SpeedMult: 1.35,
};
