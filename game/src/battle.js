// Nusa Raya — battle layer: real-time top-down combat, WorldBox style. The
// hero fights in the crush with WASD and mouse; the troops seek, strike and
// break on their own. Pure simulation data: render.js draws it, input.js and
// main.js feed it. Deterministic per seed: unit placement and behaviour draw
// from the campaign RNG.

function startBattle(c, opts) {
  const rng = c.rng;
  const fx = traitFx(c);
  const hs = heroStats(c);
  const b = {
    t: 0,
    rng,
    territoryId: opts.territoryId,
    enemyName: opts.enemyName,
    enemyFaction: opts.enemyFaction,
    attack: opts.attack !== false,
    isPirate: !!opts.isPirate,
    reservesP: { pendekar: 0, pemanah: 0, penunggang: 0 },
    reservesE: { pendekar: 0, pemanah: 0, penunggang: 0 },
    fled: { player: 0, enemy: 0 },
    reinforceT: 0,
    hero: {
      x: 280, y: 360, hp: c.heroHp != null ? c.heroHp : hs.hp, maxHp: hs.hp, angle: 0,
      speed: hs.speed, dmg: hs.dmg, swingCd: 0, swingT: 0, hornCd: 0, buffT: 0, hitT: 0,
    },
    playerUnits: [],
    enemyUnits: [],
    projectiles: [],
    particles: [],
    floats: [],
    moraleP: 100 + (fx.morale || 0),
    moraleE: 100 + (fx.enemyMorale || 0) + (opts.champion ? 20 : 0),
    trees: [],
    river: { x0: 700, x1: 760 },
    result: null,
    resultT: 0,
    kills: 0,
    shake: 0,
  };

  // Terrain: a river band and scattered trees, placed off the deployment zones.
  for (let i = 0; i < 7; i++) {
    b.trees.push({ x: rngInt(rng, 320, 960), y: rngInt(rng, 100, 620), r: rngInt(rng, 16, 26) });
  }

  // Only FIELD_CAP troops stand on the field at once; the rest arrive as
  // reinforcements while the battle runs, M&B style.
  const FIELD_CAP = 14;
  function deploy(counts, side) {
    const reserves = { pendekar: 0, pemanah: 0, penunggang: 0 };
    let row = 0;
    let deployed = 0;
    for (const type of UNIT_ORDER) {
      for (let i = 0; i < (counts[type] || 0); i++) {
        if (deployed >= FIELD_CAP) { reserves[type]++; continue; }
        const x = side === 'player' ? 240 + (row % 3) * 40 : 1040 - (row % 3) * 40;
        const y = 130 + Math.floor(row / 3) * 52 + rngInt(rng, -14, 14);
        (side === 'player' ? b.playerUnits : b.enemyUnits).push(makeUnit(rng, type, side, x, y, fx));
        row++;
        deployed++;
      }
    }
    return reserves;
  }
  b.reservesP = deploy(c.army, 'player');
  b.reservesE = deploy(opts.enemyUnits, 'enemy');
  if (opts.champion) {
    const champ = makeUnit(rng, 'pendekar', 'enemy', 1120, 360, fx);
    champ.hp = 120;
    champ.maxHp = 120;
    champ.dmg = 18;
    champ.champion = true;
    champ.name = opts.enemyName;
    b.enemyUnits.push(champ);
  }
  return b;
}

function makeUnit(rng, type, side, x, y, fx) {
  const base = UNITS[type];
  let hp = base.hp;
  let dmg = base.dmg;
  let range = base.range;
  if (side === 'player') {
    if (type === 'pendekar') hp *= 1 + (fx.swordHp || 0);
    if (type === 'pemanah') { range *= 1 + (fx.archRange || 0); dmg *= 1 + (fx.archDmg || 0); }
    if (type === 'penunggang') dmg *= 1 + (fx.cavDmg || 0);
  } else {
    // Defenders fight on home ground: +15% damage.
    dmg *= 1.15;
  }
  return {
    type, side, x, y,
    hp: Math.round(hp), maxHp: Math.round(hp),
    dmg: Math.round(dmg * 10) / 10, speed: base.speed, range,
    attackEvery: base.attackEvery, cd: rng() * 0.5,
    target: null, alive: true, hitT: 0, fleeing: false, champion: false,
  };
}

function unitCount(b, side) {
  const list = side === 'player' ? b.playerUnits : b.enemyUnits;
  let n = 0;
  for (const u of list) if (u.alive) n++;
  return n;
}

function nearestEnemy(b, u) {
  const list = u.side === 'player' ? b.enemyUnits : b.playerUnits;
  let best = null;
  let bestD = Infinity;
  for (const e of list) {
    if (!e.alive || e.fleeing) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  // Enemy troops can see the hero, but he counts as farther away than he
  // is: troops screen him unless he outruns them. Charging alone into the
  // crush is still dangerous, as it should be.
  if (u.side === 'enemy' && b.hero.hp > 0) {
    const hd = dist(u.x, u.y, b.hero.x, b.hero.y) * 1.6;
    if (hd < bestD) { best = b.hero; bestD = hd; }
  }
  return best ? { unit: best, d: bestD } : null;
}

// Shared hero autopilot (used by the screenshot staging and the headless
// sims): stay with the army, slash in range, fall back when badly wounded.
// The horn is the caller's job.
function heroPilot(b) {
  const h = b.hero;
  let target = null;
  let bestD = Infinity;
  for (const e of b.enemyUnits) {
    if (!e.alive || e.fleeing) continue;
    const d = dist(h.x, h.y, e.x, e.y);
    if (d < bestD) { bestD = d; target = e; }
  }
  let ally = null;
  let allyD = Infinity;
  for (const u of b.playerUnits) {
    if (!u.alive || u.fleeing) continue;
    const d = dist(h.x, h.y, u.x, u.y);
    if (d < allyD) { allyD = d; ally = u; }
  }
  let mx = 0;
  let my = 0;
  let aimX = h.x + 1;
  let aimY = h.y;
  let swing = false;
  if (h.hp < h.maxHp * 0.5 && target) {
    // Wounded: fall back away from the nearest enemy.
    const dx = h.x - target.x;
    const dy = h.y - target.y;
    const len = Math.hypot(dx, dy) || 1;
    mx = dx / len;
    my = dy / len;
    aimX = target.x;
    aimY = target.y;
  } else if (ally && allyD > 140) {
    const dx = ally.x - h.x;
    const dy = ally.y - h.y;
    const len = Math.hypot(dx, dy) || 1;
    mx = dx / len;
    my = dy / len;
    if (target) { aimX = target.x; aimY = target.y; }
  } else if (target) {
    const dx = target.x - h.x;
    const dy = target.y - h.y;
    const len = Math.hypot(dx, dy) || 1;
    aimX = target.x;
    aimY = target.y;
    if (bestD > 46) { mx = dx / len; my = dy / len; }
    else swing = true;
  }
  return { mx, my, aimX, aimY, swing };
}

function counterBonus(attackerType, defenderType) {
  return UNITS[attackerType].counter === defenderType ? 1.5 : 1;
}

function spawnParticles(b, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 90) * (0.4 + Math.random() * 0.8);
    b.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.45 + Math.random() * 0.3, maxLife: 0.75, color, size: 2 + Math.random() * 3 });
  }
}

function addFloat(b, x, y, text, color) {
  b.floats.push({ x, y, text, life: 0.9, color });
}

function damageUnit(b, target, dmg, attackerType) {
  if (!target.alive && target !== b.hero) return;
  const mult = target.type ? counterBonus(attackerType, target.type) : 1;
  const dealt = Math.max(1, Math.round(dmg * mult));
  target.hp -= dealt;
  target.hitT = 0.15;
  addFloat(b, target.x, target.y - 14, '-' + dealt, mult > 1 ? '#fbbf24' : '#ffffff');
  spawnParticles(b, target.x, target.y, '#f87171', 3, 70);
  if (target.hp <= 0) killUnit(b, target, attackerType);
}

function killUnit(b, target, attackerType) {
  void attackerType;
  if (target === b.hero) {
    b.hero.hp = 0;
    b.moraleP = Math.max(0, b.moraleP - 25);
    spawnParticles(b, b.hero.x, b.hero.y, '#fbbf24', 16, 130);
    AudioSys.defeat();
    return;
  }
  target.alive = false;
  target.hp = 0;
  spawnParticles(b, target.x, target.y, '#9ca3af', 8, 90);
  b.kills += target.side === 'enemy' ? 1 : 0;
  if (target.side === 'enemy') {
    b.moraleE = Math.max(0, b.moraleE - 3);
    b.moraleP = Math.min(100, b.moraleP + 1);
  } else {
    b.moraleP = Math.max(0, b.moraleP - 3);
    b.moraleE = Math.min(100, b.moraleE + 1);
  }
}

// input: {mx, my, aimX, aimY, swing, horn} — mx/my are -1..1 movement axes.
function updateBattle(b, dt, input, c) {
  if (b.result) {
    b.resultT += dt;
    updateFx(b, dt);
    return b.result;
  }
  b.t += dt;
  const fx = traitFx(c);

  // --- Hero ---
  const h = b.hero;
  if (h.hp > 0) {
    const len = Math.hypot(input.mx, input.my);
    if (len > 0.01) {
      const sp = h.speed * (inRiver(b, h.x, h.y) ? 0.55 : 1);
      h.x += (input.mx / Math.max(1, len)) * sp * dt;
      h.y += (input.my / Math.max(1, len)) * sp * dt;
      h.x = clamp(h.x, 24, 1256);
      h.y = clamp(h.y, 90, 696);
      pushOutOfTrees(b, h, 14);
    }
    h.angle = Math.atan2(input.aimY - h.y, input.aimX - h.x);
    h.swingCd -= dt;
    h.swingT -= dt;
    h.hornCd -= dt;
    h.buffT -= dt;
    h.hitT -= dt;
    if (input.swing && h.swingCd <= 0) {
      h.swingCd = 0.45;
      h.swingT = 0.18;
      AudioSys.sword();
      const dmg = h.dmg * (h.buffT > 0 ? 1.2 : 1);
      for (const e of b.enemyUnits) {
        if (!e.alive || e.fleeing) continue;
        const d = dist(h.x, h.y, e.x, e.y);
        if (d > GAME.HERO.swingRange + 8) continue;
        let da = Math.atan2(e.y - h.y, e.x - h.x) - h.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) < GAME.HERO.swingArc / 2 + 0.3) damageUnit(b, e, dmg, 'pendekar');
      }
      b.shake = Math.max(b.shake, 3);
    }
    if (input.horn && h.hornCd <= 0) {
      h.hornCd = GAME.HERO.hornCooldown;
      h.buffT = 4;
      b.moraleP = Math.min(100, b.moraleP + 12);
      AudioSys.horn();
      addFloat(b, h.x, h.y - 26, 'SERBU!', '#fbbf24');
      spawnParticles(b, h.x, h.y, '#fbbf24', 10, 110);
    }
  }

  // --- Troops ---
  for (const u of b.playerUnits.concat(b.enemyUnits)) {
    if (!u.alive) continue;
    u.cd -= dt;
    u.hitT -= dt;
    if (u.fleeing) {
      const dir = u.side === 'player' ? -1 : 1;
      u.x += dir * u.speed * 1.4 * dt;
      // A unit that runs off the field regroups after the battle: it counts
      // as fled, not dead, so a lost battle costs land, not the whole army.
      if (u.x < 10 || u.x > 1270) {
        u.alive = false;
        b.fled[u.side]++;
      }
      continue;
    }
    const found = nearestEnemy(b, u);
    if (!found) continue;
    const target = found.unit;
    const d = found.d;
    const inWater = inRiver(b, u.x, u.y);
    if (d > u.range) {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const len = Math.hypot(dx, dy) || 1;
      const sp = u.speed * (inWater ? 0.55 : 1);
      u.x += (dx / len) * sp * dt;
      u.y += (dy / len) * sp * dt;
      pushOutOfTrees(b, u, 10);
    } else if (u.cd <= 0) {
      u.cd = u.attackEvery;
      if (u.type === 'pemanah') {
        const dx = target.x - u.x;
        const dy = target.y - u.y;
        const len = Math.hypot(dx, dy) || 1;
        const spd = 420;
        b.projectiles.push({ x: u.x, y: u.y - 6, vx: (dx / len) * spd, vy: (dy / len) * spd, dmg: u.dmg, side: u.side, type: 'pemanah', life: 1.2 });
      } else {
        if (target === b.hero) {
          damageUnit(b, b.hero, u.dmg, u.type);
          AudioSys.hit();
        } else {
          damageUnit(b, target, u.dmg, u.type);
        }
      }
    }
  }

  // Gentle separation so troops do not stack on one pixel.
  const all = b.playerUnits.concat(b.enemyUnits).filter((u) => u.alive && !u.fleeing);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const c2 = all[j];
      const dx = c2.x - a.x;
      const dy = c2.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 144 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (12 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        c2.x += nx * push;
        c2.y += ny * push;
      }
    }
  }

  // --- Projectiles ---
  for (const p of b.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0 || p.x < 0 || p.x > 1280 || p.y < 80 || p.y > 720) { p.life = 0; continue; }
    const targets = p.side === 'player' ? b.enemyUnits : b.playerUnits.concat([b.hero]);
    for (const t of targets) {
      const alive = t === b.hero ? t.hp > 0 : t.alive;
      if (!alive || (t.fleeing && t !== b.hero)) continue;
      if (dist(p.x, p.y, t.x, t.y) < 12) {
        p.life = 0;
        if (t === b.hero) damageUnit(b, b.hero, p.dmg, 'pemanah');
        else damageUnit(b, t, p.dmg, 'pemanah');
        break;
      }
    }
  }
  b.projectiles = b.projectiles.filter((p) => p.life > 0);

  // Reinforcements trickle in while a side holds fewer than 14 on the field.
  b.reinforceT -= dt;
  if (b.reinforceT <= 0) {
    b.reinforceT = 1.5;
    if (unitCount(b, 'player') < 14) {
      for (const type of UNIT_ORDER) {
        if (b.reservesP[type] > 0) {
          b.reservesP[type]--;
          b.playerUnits.push(makeUnit(b.rng, type, 'player', rngInt(b.rng, 180, 240), rngInt(b.rng, 130, 600), fx));
          addFloat(b, 210, 120, 'Bantuan datang!', '#2dd4bf');
          break;
        }
      }
    }
    if (unitCount(b, 'enemy') < 14) {
      for (const type of UNIT_ORDER) {
        if (b.reservesE[type] > 0) {
          b.reservesE[type]--;
          b.enemyUnits.push(makeUnit(b.rng, type, 'enemy', rngInt(b.rng, 1040, 1100), rngInt(b.rng, 130, 600), fx));
          break;
        }
      }
    }
  }

  // --- Morale and rout ---
  if (b.moraleP <= 0 || b.moraleE <= 0) {
    const losing = b.moraleP <= 0 ? 'player' : 'enemy';
    for (const u of (losing === 'player' ? b.playerUnits : b.enemyUnits)) {
      if (u.alive) u.fleeing = true;
    }
    if (losing === 'player') b.result = 'lose';
    else b.result = 'win';
    b.resultT = 0;
    if (b.result === 'win') AudioSys.gong();
    return b.result;
  }

  // --- Victory / defeat by elimination ---
  const pAlive = unitCount(b, 'player') + (b.hero.hp > 0 ? 1 : 0);
  const eAlive = unitCount(b, 'enemy');
  if (eAlive === 0) {
    b.result = 'win';
    b.resultT = 0;
    AudioSys.gong();
  } else if (pAlive === 0) {
    b.result = 'lose';
    b.resultT = 0;
  }

  // Safety valve: a battle never runs past two minutes.
  if (!b.result && b.t > 120) {
    const pScore = unitCount(b, 'player') + b.moraleP / 10 + (b.hero.hp > 0 ? 3 : 0);
    const eScore = unitCount(b, 'enemy') + b.moraleE / 10;
    b.result = pScore >= eScore ? 'win' : 'lose';
    b.resultT = 0;
  }

  updateFx(b, dt);
  b.shake = Math.max(0, b.shake - dt * 12);
  return b.result;
}

function inRiver(b, x) {
  return x > b.river.x0 && x < b.river.x1;
}

function pushOutOfTrees(b, u, r) {
  for (const t of b.trees) {
    const d = dist(u.x, u.y, t.x, t.y);
    const min = t.r + r;
    if (d < min && d > 0.01) {
      const nx = (u.x - t.x) / d;
      const ny = (u.y - t.y) / d;
      u.x = t.x + nx * min;
      u.y = t.y + ny * min;
    }
  }
}

function updateFx(b, dt) {
  for (const p of b.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
    p.life -= dt;
  }
  b.particles = b.particles.filter((p) => p.life > 0);
  for (const f of b.floats) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  b.floats = b.floats.filter((f) => f.life > 0);
}

function battleSurvivors(b, side) {
  const out = { pendekar: 0, pemanah: 0, penunggang: 0 };
  const list = side === 'player' ? b.playerUnits : b.enemyUnits;
  for (const u of list) if (u.alive && !u.fleeing) out[u.type]++;
  return out;
}

// Everything the army still has after a battle: survivors on the field plus
// reserves that never deployed plus troops that fled and regrouped. A lost
// battle costs land, not the whole army.
function battleArmyRemaining(b, side) {
  const out = { pendekar: 0, pemanah: 0, penunggang: 0 };
  const list = side === 'player' ? b.playerUnits : b.enemyUnits;
  for (const u of list) if (u.alive) out[u.type]++;
  const reserves = side === 'player' ? b.reservesP : b.reservesE;
  for (const type of UNIT_ORDER) out[type] += reserves[type] || 0;
  const fled = b.fled[side] || 0;
  // Fled troops regroup as swordsmen: they dropped their bows and horses.
  out.pendekar += fled;
  return out;
}
