// HUD + full-screen overlays. Pure DOM, no three.js.
export class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.hpFill = document.getElementById('hp-fill');
    this.stFill = document.getElementById('st-fill');
    this.coffeeBox = document.getElementById('coffee');
    this.codeValue = document.getElementById('code-value');
    this.bossWrap = document.getElementById('boss-bar-wrap');
    this.bossName = document.getElementById('boss-name');
    this.bossFill = document.getElementById('boss-fill');
    this.prompt = document.getElementById('prompt');
    this.lockMarker = document.getElementById('lock-marker');
    this.toastEl = document.getElementById('toast');
    this.dmgFlash = document.getElementById('dmg-flash');
    this.screens = {
      title: document.getElementById('screen-title'),
      death: document.getElementById('screen-death'),
      win: document.getElementById('screen-win'),
    };
    this._toastTimer = null;
  }

  showHUD(v) { this.hud.classList.toggle('hidden', !v); }

  setHP(frac) { this.hpFill.style.transform = `scaleX(${Math.max(0, frac)})`; }
  setStamina(frac) { this.stFill.style.transform = `scaleX(${Math.max(0, frac)})`; }

  setCoffee(n, max) {
    if (this.coffeeBox.children.length !== max) {
      this.coffeeBox.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const d = document.createElement('div');
        d.className = 'mug';
        d.textContent = '☕';
        this.coffeeBox.appendChild(d);
      }
    }
    [...this.coffeeBox.children].forEach((el, i) => el.classList.toggle('full', i < n));
  }

  setCode(n) { this.codeValue.textContent = Math.floor(n).toLocaleString(); }

  showBoss(name) { this.bossName.textContent = name; this.bossWrap.classList.remove('hidden'); }
  setBoss(frac) { this.bossFill.style.transform = `scaleX(${Math.max(0, frac)})`; }
  hideBoss() { this.bossWrap.classList.add('hidden'); }

  setPrompt(html) {
    if (html) { this.prompt.innerHTML = html; this.prompt.classList.remove('hidden'); }
    else this.prompt.classList.add('hidden');
  }

  setLockMarker(x, y, visible) {
    this.lockMarker.classList.toggle('hidden', !visible);
    if (visible) { this.lockMarker.style.left = `${x}px`; this.lockMarker.style.top = `${y}px`; }
  }

  toast(text, ms = 2200) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  damageFlash() {
    this.dmgFlash.style.transition = 'none';
    this.dmgFlash.style.opacity = '1';
    requestAnimationFrame(() => {
      this.dmgFlash.style.transition = 'opacity .5s';
      this.dmgFlash.style.opacity = '0';
    });
  }

  showScreen(name) {
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('hidden', k !== name);
  }
  hideScreens() { for (const el of Object.values(this.screens)) el.classList.add('hidden'); }
}
