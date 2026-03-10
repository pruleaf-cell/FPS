const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
  title: document.getElementById('titleScreen'),
  pause: document.getElementById('pauseOverlay'),
  death: document.getElementById('deathOverlay'),
  start: document.getElementById('startBtn'),
  resume: document.getElementById('resumeBtn'),
  restart: document.getElementById('restartBtn'),
  health: document.getElementById('healthHUD'),
  ammo: document.getElementById('ammoHUD'),
  weapon: document.getElementById('weaponHUD'),
  time: document.getElementById('timeHUD'),
  enemy: document.getElementById('enemyHUD'),
  best: document.getElementById('bestHUD'),
  bestStat: document.getElementById('bestStat'),
  deathStat: document.getElementById('deathStat'),
  hitFlash: document.getElementById('hitFlash'),
  muzzleFlash: document.getElementById('muzzleFlash'),
  radar: document.getElementById('radar'),
  sensitivity: document.getElementById('sensitivity'),
  sensValue: document.getElementById('sensValue'),
};

const MAP = [
  '####################',
  '#...........#......#',
  '#....#####..#..##..#',
  '#...........#......#',
  '#..##..###.....##..#',
  '#..##......##......#',
  '#......#...........#',
  '#..##..#..###......#',
  '#..##.....#........#',
  '#..............#...#',
  '#...##........##...#',
  '#.............##...#',
  '#....###...........#',
  '#........#.....##..#',
  '#....##..#.........#',
  '#...........###....#',
  '#..###.............#',
  '#..........##......#',
  '#......#...........#',
  '####################',
];

const WALL = '#';
const FOV = Math.PI / 3;
const RAY_COUNT = 360;
const MAX_DEPTH = 26;
const ENEMY_TYPES = {
  stalker: { hp: 45, speed: 1.55, damage: 10, attackRange: 0.9, cooldown: 1.1, color: '#ff5f7a', score: 15 },
  brute: { hp: 90, speed: 1.0, damage: 16, attackRange: 1.15, cooldown: 1.45, color: '#ffb347', score: 25 },
};

const weapons = [
  { name: 'Carbine', clipSize: 30, reserveMax: 180, damage: 20, fireRate: 0.12, reloadTime: 1.2, spread: 0.02, pellets: 1, color: '#9ff9ff' },
  { name: 'Scattergun', clipSize: 8, reserveMax: 48, damage: 13, fireRate: 0.6, reloadTime: 1.65, spread: 0.12, pellets: 6, color: '#ffd590' },
];

const state = {
  mode: 'title',
  keys: {},
  locked: false,
  player: null,
  enemies: [],
  pickups: [],
  projectiles: [],
  spawnClock: 0,
  timeAlive: 0,
  score: 0,
  bestTime: Number(localStorage.getItem('neon_breach_best_time') || 0),
  settings: {
    sensitivity: Number(localStorage.getItem('neon_breach_sens') || 0.0024),
  },
  hitFlash: 0,
  muzzleFlash: 0,
};

function isWall(x, y) {
  const mx = Math.floor(x);
  const my = Math.floor(y);
  if (mx < 0 || my < 0 || my >= MAP.length || mx >= MAP[0].length) return true;
  return MAP[my][mx] === WALL;
}

function resetRun() {
  state.player = {
    x: 2.5,
    y: 2.5,
    z: 0,
    angle: 0.3,
    health: 100,
    sprintStamina: 4,
    weaponIndex: 0,
    weaponState: weapons.map((w) => ({ clip: w.clipSize, reserve: Math.floor(w.reserveMax * 0.5), cooldown: 0, reload: 0 })),
  };
  state.enemies = [];
  state.pickups = [];
  state.projectiles = [];
  state.spawnClock = 1;
  state.timeAlive = 0;
  state.score = 0;
  for (let i = 0; i < 6; i += 1) spawnEnemy();
  for (let i = 0; i < 6; i += 1) spawnPickup();
}

function randomOpenPoint() {
  for (let i = 0; i < 300; i += 1) {
    const x = 1 + Math.random() * (MAP[0].length - 2);
    const y = 1 + Math.random() * (MAP.length - 2);
    if (!isWall(x, y) && Math.hypot(x - state.player.x, y - state.player.y) > 3) return { x, y };
  }
  return { x: 5, y: 5 };
}

function spawnEnemy() {
  const point = randomOpenPoint();
  const type = Math.random() < 0.68 ? 'stalker' : 'brute';
  const profile = ENEMY_TYPES[type];
  state.enemies.push({
    x: point.x,
    y: point.y,
    type,
    hp: profile.hp,
    attackTimer: Math.random() * profile.cooldown,
    hitGlow: 0,
  });
}

function spawnPickup(forceType) {
  const point = randomOpenPoint();
  const type = forceType || (Math.random() < 0.4 ? 'health' : 'ammo');
  state.pickups.push({ x: point.x, y: point.y, type, life: 22 + Math.random() * 18 });
}

function startGame() {
  resetRun();
  state.mode = 'playing';
  ui.title.classList.add('hidden');
  ui.death.classList.add('hidden');
  ui.pause.classList.add('hidden');
  canvas.requestPointerLock();
}

function setPause(flag) {
  if (state.mode !== 'playing' && !flag) return;
  if (flag) {
    state.mode = 'paused';
    ui.pause.classList.remove('hidden');
    document.exitPointerLock();
  } else {
    state.mode = 'playing';
    ui.pause.classList.add('hidden');
    canvas.requestPointerLock();
  }
}

function movePlayer(dt) {
  const p = state.player;
  let moveX = 0;
  let moveY = 0;
  const speedBase = 2.8;
  const sprinting = state.keys.Shift && p.sprintStamina > 0.2;
  const speed = speedBase * (sprinting ? 1.55 : 1);

  if (state.keys.w) { moveX += Math.cos(p.angle); moveY += Math.sin(p.angle); }
  if (state.keys.s) { moveX -= Math.cos(p.angle); moveY -= Math.sin(p.angle); }
  if (state.keys.a) { moveX += Math.cos(p.angle - Math.PI / 2); moveY += Math.sin(p.angle - Math.PI / 2); }
  if (state.keys.d) { moveX += Math.cos(p.angle + Math.PI / 2); moveY += Math.sin(p.angle + Math.PI / 2); }

  const mag = Math.hypot(moveX, moveY) || 1;
  moveX = (moveX / mag) * speed * dt;
  moveY = (moveY / mag) * speed * dt;

  const nx = p.x + moveX;
  const ny = p.y + moveY;
  if (!isWall(nx, p.y)) p.x = nx;
  if (!isWall(p.x, ny)) p.y = ny;

  if (sprinting && (state.keys.w || state.keys.a || state.keys.s || state.keys.d)) p.sprintStamina = Math.max(0, p.sprintStamina - dt);
  else p.sprintStamina = Math.min(4, p.sprintStamina + dt * 0.65);
}

function lineBlocked(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.ceil(Math.hypot(dx, dy) * 10);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isWall(x1 + dx * t, y1 + dy * t)) return true;
  }
  return false;
}

function shoot() {
  if (state.mode !== 'playing') return;
  const p = state.player;
  const idx = p.weaponIndex;
  const weapon = weapons[idx];
  const ws = p.weaponState[idx];
  if (ws.reload > 0 || ws.cooldown > 0) return;
  if (ws.clip <= 0) {
    startReload();
    return;
  }
  ws.clip -= 1;
  ws.cooldown = weapon.fireRate;
  state.muzzleFlash = 0.07;
  playSound(idx === 0 ? 510 : 160, idx === 0 ? 0.06 : 0.09, 'sawtooth');

  for (let shot = 0; shot < weapon.pellets; shot += 1) {
    const angle = p.angle + (Math.random() - 0.5) * weapon.spread;
    let best = null;
    for (const enemy of state.enemies) {
      const dx = enemy.x - p.x;
      const dy = enemy.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 14) continue;
      const dir = Math.atan2(dy, dx);
      const diff = Math.atan2(Math.sin(dir - angle), Math.cos(dir - angle));
      if (Math.abs(diff) < 0.09 && !lineBlocked(p.x, p.y, enemy.x, enemy.y)) {
        if (!best || dist < best.dist) best = { enemy, dist };
      }
    }
    if (best) {
      best.enemy.hp -= weapon.damage * (1 - best.dist / 20);
      best.enemy.hitGlow = 0.18;
    }
  }

  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.hp > 0) return true;
    state.score += ENEMY_TYPES[enemy.type].score;
    if (Math.random() < 0.42) spawnPickup('ammo');
    playSound(120, 0.11, 'triangle');
    return false;
  });
}

function startReload() {
  const p = state.player;
  const idx = p.weaponIndex;
  const ws = p.weaponState[idx];
  const weapon = weapons[idx];
  if (ws.reload > 0 || ws.clip === weapon.clipSize || ws.reserve <= 0) return;
  ws.reload = weapon.reloadTime;
  playSound(280, 0.06, 'square');
}

function updateCombat(dt) {
  const p = state.player;
  p.weaponState.forEach((ws, idx) => {
    ws.cooldown = Math.max(0, ws.cooldown - dt);
    if (ws.reload > 0) {
      ws.reload = Math.max(0, ws.reload - dt);
      if (ws.reload === 0) {
        const w = weapons[idx];
        const need = w.clipSize - ws.clip;
        const amount = Math.min(need, ws.reserve);
        ws.clip += amount;
        ws.reserve -= amount;
      }
    }
  });

  for (const enemy of state.enemies) {
    enemy.hitGlow = Math.max(0, enemy.hitGlow - dt);
    const profile = ENEMY_TYPES[enemy.type];
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    enemy.attackTimer -= dt;

    if (dist > profile.attackRange + 0.1) {
      const nx = enemy.x + (dx / dist) * profile.speed * dt;
      const ny = enemy.y + (dy / dist) * profile.speed * dt;
      if (!isWall(nx, enemy.y)) enemy.x = nx;
      if (!isWall(enemy.x, ny)) enemy.y = ny;
    } else if (enemy.attackTimer <= 0) {
      enemy.attackTimer = profile.cooldown;
      p.health -= profile.damage;
      state.hitFlash = 0.12;
      playSound(80, 0.08, 'sine');
      if (p.health <= 0) {
        p.health = 0;
        die();
      }
    }
  }
}

function updatePickups(dt) {
  const p = state.player;
  state.pickups = state.pickups.filter((pickup) => {
    pickup.life -= dt;
    if (pickup.life <= 0) return false;
    const dist = Math.hypot(pickup.x - p.x, pickup.y - p.y);
    if (dist < 0.7) {
      if (pickup.type === 'health') {
        p.health = Math.min(100, p.health + 30);
      } else {
        p.weaponState.forEach((ws, i) => {
          ws.reserve = Math.min(weapons[i].reserveMax, ws.reserve + (i === 0 ? 36 : 10));
        });
      }
      playSound(660, 0.07, 'triangle');
      return false;
    }
    return true;
  });

  state.spawnClock -= dt;
  if (state.spawnClock <= 0) {
    spawnEnemy();
    if (Math.random() < 0.6 && state.pickups.length < 10) spawnPickup();
    state.spawnClock = Math.max(1.15, 3.2 - state.timeAlive * 0.02);
  }
}

function castRays() {
  const p = state.player;
  const rays = [];
  for (let i = 0; i < RAY_COUNT; i += 1) {
    const rayAngle = p.angle - FOV / 2 + (i / RAY_COUNT) * FOV;
    const sin = Math.sin(rayAngle);
    const cos = Math.cos(rayAngle);
    let dist = 0;
    while (dist < MAX_DEPTH) {
      dist += 0.04;
      const rx = p.x + cos * dist;
      const ry = p.y + sin * dist;
      if (isWall(rx, ry)) break;
    }
    const corrected = dist * Math.cos(rayAngle - p.angle);
    rays.push({ dist: corrected, raw: dist, angle: rayAngle });
  }
  return rays;
}

function render() {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height / 2);
  sky.addColorStop(0, '#1a2f55');
  sky.addColorStop(1, '#0f1828');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height / 2);

  const floor = ctx.createLinearGradient(0, height / 2, 0, height);
  floor.addColorStop(0, '#111827');
  floor.addColorStop(1, '#05070c');
  ctx.fillStyle = floor;
  ctx.fillRect(0, height / 2, width, height / 2);

  if (!state.player) return;

  const rays = castRays();
  const sliceW = width / RAY_COUNT;

  rays.forEach((ray, i) => {
    const wallH = Math.min(height, (height / (ray.dist + 0.001)) * 0.9);
    const y = (height - wallH) / 2;
    const shade = Math.max(0.12, 1 - ray.raw / 14);
    ctx.fillStyle = `rgba(${Math.floor(50 * shade)}, ${Math.floor(220 * shade)}, ${Math.floor(255 * shade)}, 1)`;
    ctx.fillRect(i * sliceW, y, sliceW + 1, wallH);
  });

  const p = state.player;
  const sprites = [];

  for (const enemy of state.enemies) {
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) - p.angle;
    const norm = Math.atan2(Math.sin(angle), Math.cos(angle));
    if (Math.abs(norm) > FOV * 0.65) continue;
    const screenX = ((norm + FOV / 2) / FOV) * width;
    sprites.push({ type: 'enemy', enemy, dist, screenX });
  }

  for (const pickup of state.pickups) {
    const dx = pickup.x - p.x;
    const dy = pickup.y - p.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) - p.angle;
    const norm = Math.atan2(Math.sin(angle), Math.cos(angle));
    if (Math.abs(norm) > FOV * 0.65) continue;
    const screenX = ((norm + FOV / 2) / FOV) * width;
    sprites.push({ type: 'pickup', pickup, dist, screenX });
  }

  sprites.sort((a, b) => b.dist - a.dist);

  for (const spr of sprites) {
    const col = Math.floor((spr.screenX / width) * RAY_COUNT);
    if (col < 0 || col >= rays.length) continue;
    if (spr.dist > rays[col].dist + 0.2) continue;

    const size = Math.min(height * 0.8, (height / (spr.dist + 0.001)) * (spr.type === 'enemy' ? 0.72 : 0.4));
    const x = spr.screenX - size / 2;
    const y = height / 2 - size / (spr.type === 'enemy' ? 2 : 3);

    if (spr.type === 'enemy') {
      const profile = ENEMY_TYPES[spr.enemy.type];
      ctx.fillStyle = spr.enemy.hitGlow > 0 ? '#ffffff' : profile.color;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = '#00000090';
      ctx.fillRect(x, y - 8, size, 5);
      ctx.fillStyle = '#7bff95';
      ctx.fillRect(x, y - 8, size * Math.max(0, spr.enemy.hp / profile.hp), 5);
    } else {
      ctx.fillStyle = spr.pickup.type === 'health' ? '#59ff88' : '#7ed1ff';
      ctx.beginPath();
      ctx.arc(spr.screenX, y + size * 0.4, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawWeaponOverlay();
  drawRadar();
}

function drawWeaponOverlay() {
  const { width, height } = canvas;
  const weapon = weapons[state.player.weaponIndex];
  ctx.fillStyle = `${weapon.color}55`;
  ctx.beginPath();
  ctx.moveTo(width * 0.69, height);
  ctx.lineTo(width, height);
  ctx.lineTo(width, height * 0.62);
  ctx.closePath();
  ctx.fill();
}

function drawRadar() {
  const radar = ui.radar;
  const size = radar.clientWidth;
  const rctx = radar.getContext?.('2d');
  if (!rctx) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    radar.innerHTML = '';
    radar.append(c);
    radar.ctx2d = c.getContext('2d');
  }
  const draw = radar.ctx2d;
  if (!draw) return;

  draw.clearRect(0, 0, size, size);
  draw.strokeStyle = '#00e0ff66';
  draw.beginPath();
  draw.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  draw.stroke();

  draw.fillStyle = '#fff';
  draw.beginPath();
  draw.arc(size / 2, size / 2, 3, 0, Math.PI * 2);
  draw.fill();

  const scale = 10;
  for (const enemy of state.enemies) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    if (Math.hypot(dx, dy) > scale) continue;
    const rx = size / 2 + (dx / scale) * (size / 2 - 8);
    const ry = size / 2 + (dy / scale) * (size / 2 - 8);
    draw.fillStyle = ENEMY_TYPES[enemy.type].color;
    draw.fillRect(rx - 2, ry - 2, 4, 4);
  }
}

let audioCtx;
function playSound(freq, duration, type = 'square') {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.001;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function die() {
  state.mode = 'dead';
  document.exitPointerLock();
  if (state.timeAlive > state.bestTime) {
    state.bestTime = state.timeAlive;
    localStorage.setItem('neon_breach_best_time', String(state.bestTime));
  }
  ui.deathStat.textContent = `You survived ${state.timeAlive.toFixed(1)}s · Score ${state.score}`;
  ui.death.classList.remove('hidden');
}

function updateHUD() {
  if (!state.player) return;
  const p = state.player;
  const ws = p.weaponState[p.weaponIndex];
  ui.health.textContent = `HP: ${Math.ceil(p.health)}`;
  ui.ammo.textContent = ws.reload > 0
    ? `Ammo: RELOADING ${ws.reload.toFixed(1)}s`
    : `Ammo: ${ws.clip} / ${ws.reserve}`;
  ui.weapon.textContent = `Weapon: ${weapons[p.weaponIndex].name}`;
  ui.time.textContent = `Time: ${state.timeAlive.toFixed(1)}s`;
  ui.enemy.textContent = `Threats: ${state.enemies.length}  Score: ${state.score}`;
  ui.best.textContent = `Best: ${state.bestTime.toFixed(1)}s`;
  ui.bestStat.textContent = `Best survival: ${state.bestTime.toFixed(1)}s`;
  ui.hitFlash.classList.toggle('hidden', state.hitFlash <= 0);
  ui.muzzleFlash.classList.toggle('hidden', state.muzzleFlash <= 0);
}

function saveSettings() {
  localStorage.setItem('neon_breach_sens', String(state.settings.sensitivity));
}

function gameLoop(ts) {
  if (!gameLoop.last) gameLoop.last = ts;
  const dt = Math.min(0.05, (ts - gameLoop.last) / 1000);
  gameLoop.last = ts;

  if (state.mode === 'playing') {
    state.timeAlive += dt;
    movePlayer(dt);
    updateCombat(dt);
    updatePickups(dt);
    state.hitFlash = Math.max(0, state.hitFlash - dt);
    state.muzzleFlash = Math.max(0, state.muzzleFlash - dt);
  }
  render();
  updateHUD();
  requestAnimationFrame(gameLoop);
}

ui.start.addEventListener('click', startGame);
ui.resume.addEventListener('click', () => setPause(false));
ui.restart.addEventListener('click', startGame);

ui.sensitivity.value = state.settings.sensitivity;
ui.sensValue.textContent = Number(ui.sensitivity.value).toFixed(4);
ui.sensitivity.addEventListener('input', (e) => {
  state.settings.sensitivity = Number(e.target.value);
  ui.sensValue.textContent = state.settings.sensitivity.toFixed(4);
  saveSettings();
});

window.addEventListener('keydown', (e) => {
  if (['w', 'a', 's', 'd', 'Shift'].includes(e.key)) state.keys[e.key] = true;
  if (e.key === 'Escape') {
    if (state.mode === 'playing') setPause(true);
    else if (state.mode === 'paused') setPause(false);
  }
  if (e.key.toLowerCase() === 'r') startReload();
  if (e.key === '1') state.player && (state.player.weaponIndex = 0);
  if (e.key === '2') state.player && (state.player.weaponIndex = 1);
});

window.addEventListener('keyup', (e) => {
  if (['w', 'a', 's', 'd', 'Shift'].includes(e.key)) state.keys[e.key] = false;
});

canvas.addEventListener('click', () => {
  if (state.mode === 'playing' && !state.locked) canvas.requestPointerLock();
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) shoot();
});

document.addEventListener('pointerlockchange', () => {
  state.locked = document.pointerLockElement === canvas;
  if (!state.locked && state.mode === 'playing') setPause(true);
});

window.addEventListener('mousemove', (e) => {
  if (!state.locked || state.mode !== 'playing') return;
  state.player.angle += e.movementX * state.settings.sensitivity;
});

requestAnimationFrame(gameLoop);
