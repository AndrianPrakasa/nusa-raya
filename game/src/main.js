// Nusa Raya — main loop and orchestration: fixed-timestep updates, click
// dispatch against the hot rectangles render.js registers, and the glue
// between the campaign layer, the battle layer and the overlays.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '7', 10) || 7;

function loadBest() {
  try {
    return parseInt(window.localStorage.getItem('nusa-raya-best') || '0', 10) || 0;
  } catch (e) {
    return 0;
  }
}

const G = {
  seed,
  rng: makeRng(seed),
  mode: 'title',
  overlay: null,
  campaign: null,
  battle: null,
  battleReturn: null,
  loseReason: '',
  ui: {
    hot: [],
    selected: null,
    diploFid: null,
    discordTarget: null,
    toast: null,
    toastT: 0,
    paused: false,
    pendingEvent: null,
  },
  time: 0,
  best: loadBest(),
  shot: null,
  shotReady: false,
};

initInput(canvas, G);
if (params.get('shot')) applyShot(G, params.get('shot'), seed);

// Read-only debug hooks for automated tests (mode/overlay/battle state).
window.__nusaMode = () => G.mode;
window.__nusaOverlay = () => G.overlay;
window.__nusaBattle = () => (G.battle ? (G.battle.result || 'fighting') : 'none');

function toast(G, msg) {
  G.ui.toast = msg;
  G.ui.toastT = 5;
}

function closeOverlay(G) {
  G.overlay = null;
  G.ui.selected = null;
  G.ui.diploFid = null;
  G.ui.discordTarget = null;
}

function startGame() {
  const c = newCampaign(G.seed);
  c.heroHp = heroStats(c).hp;
  G.campaign = c;
  G.battle = null;
  G.battleReturn = null;
  G.mode = 'campaign';
  G.overlay = null;
  G.ui.selected = null;
  G.ui.paused = false;
  toast(G, 'Musim Semi, Tahun 1 — satukan kepulauan!');
  AudioSys.ensure();
  AudioSys.startMusic('campaign');
}

function startBattleMode(opts, returnTo) {
  const c = G.campaign;
  G.battlePreSize = armySize(c);
  G.battle = startBattle(c, opts);
  G.battleReturn = returnTo;
  G.mode = 'battle';
  G.overlay = null;
  AudioSys.startMusic('battle');
}

function pirateBattleOpts(c) {
  return {
    territoryId: c.armyAt,
    enemyUnits: { pendekar: 4, pemanah: 2, penunggang: 0 },
    enemyName: 'Kapten Bajak Laut',
    enemyFaction: null,
    champion: false,
    attack: true,
    isPirate: true,
  };
}

function resolveBattle() {
  const b = G.battle;
  const c = G.campaign;
  if (!b || !b.result) return;
  const fx = traitFx(c);
  const hs = heroStats(c);
  // The hero's wounds carry between battles; the Tabib trait heals after one.
  if (b.hero.hp > 0) c.heroHp = Math.min(hs.hp, Math.ceil(b.hero.hp) + (fx.healAfter || 0));
  else c.heroHp = Math.round(hs.hp * 0.5);
  // Stragglers regroup: at least a quarter of the army survives any battle.
  let kept = battleArmyRemaining(b, 'player');
  const keptTotal = kept.pendekar + kept.pemanah + kept.penunggang;
  const minKeep = Math.ceil((G.battlePreSize || 0) * 0.25);
  if (keptTotal < minKeep) kept.pendekar += minKeep - keptTotal;

  if (b.result === 'win') {
    c.stats.battlesWon++;
    c.stats.kills += b.kills;
    grantXp(c, 40 + b.kills * 2);
    if (b.isPirate) {
      c.gold += 30;
      c.stats.goldEarned += 30;
      c.army = kept;
      toast(G, 'Bajak laut diusir! +30 emas.');
    } else if (b.attack) {
      captureTerritory(c, b.territoryId, kept);
    } else {
      c.army = kept;
      toast(G, 'Serangan dipukul mundur! Wilayah aman.');
    }
  } else {
    c.stats.battlesLost++;
    grantXp(c, 10);
    if (b.isPirate) {
      c.gold = Math.max(0, c.gold - 20);
      c.army = kept;
      toast(G, 'Bajak laut menjarah 20 emas.');
    } else if (b.attack) {
      c.army = kept;
      toast(G, 'Pasukanmu mundur. Kumpulkan kekuatan dan coba lagi.');
    } else {
      const rem = battleArmyRemaining(b, 'enemy');
      const n = rem.pendekar + rem.pemanah + rem.penunggang;
      loseTerritoryTo(c, b.territoryId, b.enemyFaction, n);
      c.army = kept;
    }
  }

  G.battle = null;
  G.mode = 'campaign';
  AudioSys.startMusic('campaign');
  if (G.ui.pendingEvent) {
    c.event = G.ui.pendingEvent;
    G.ui.pendingEvent = null;
    G.overlay = 'event';
  } else if (c.traitOffer) {
    G.overlay = 'trait';
  }
  const end = checkEnd(c);
  if (end) endGame(end);
}

function endGame(result) {
  const c = G.campaign;
  G.mode = result;
  G.overlay = null;
  if (result === 'win') {
    const s = score(c);
    if (s > G.best) {
      G.best = s;
      try {
        window.localStorage.setItem('nusa-raya-best', String(s));
      } catch (e) {
        // Storage unavailable; the best score just lives for this session.
      }
    }
    AudioSys.gong();
  } else {
    G.loseReason = c.season > GAME.MAX_SEASONS
      ? 'Enam belas musim berlalu tanpa penyatuan. Kepulauan tetap terpecah.'
      : 'Wilayah terakhirmu jatuh. Panji Wira Nusa tak lagi berkibar.';
    AudioSys.defeat();
  }
}

function doEndSeason() {
  const c = G.campaign;
  const res = endSeason(c);
  c.heroHp = Math.min(heroStats(c).hp, (c.heroHp || heroStats(c).hp) + 20);
  toast(G, 'Upeti +' + c.incomeLast + ' emas. ' + seasonLabel(c) + '.');
  if (res.gameOver) {
    endGame(res.gameOver);
    return;
  }
  if (res.battle) {
    G.ui.pendingEvent = res.event || null;
    startBattleMode(battleOptsForDefense(c, res.battle.attackerFid, res.battle.territoryId), 'defense');
  } else if (res.event) {
    G.overlay = 'event';
  } else if (c.traitOffer) {
    G.overlay = 'trait';
  }
}

function handleClick(G, x, y) {
  const id = findHot(G, x, y);
  if (!id || id === 'noop') {
    if (G.mode === 'campaign' && !G.overlay) {
      G.ui.selected = null;
    }
    return;
  }
  const c = G.campaign;
  // Event and trait modals are blocking: nothing else answers while open.
  if (G.overlay === 'event' && !id.startsWith('event-choice:')) return;
  if (G.overlay === 'trait' && !id.startsWith('trait-pick:')) return;
  if (G.overlay && id.startsWith('territory:')) return;

  if (id === 'start' || id === 'restart') { startGame(); return; }
  if (id === 'to-title') {
    G.mode = 'title';
    G.campaign = null;
    G.battle = null;
    G.overlay = null;
    AudioSys.startMusic('campaign');
    return;
  }
  if (id === 'help') { G.overlay = 'help'; return; }
  if (id === 'close') { closeOverlay(G); return; }
  if (id === 'mute') { AudioSys.setMuted(!AudioSys.muted); return; }
  if (id === 'pause') { G.ui.paused = !G.ui.paused; return; }
  if (id === 'battle-continue') { resolveBattle(); return; }
  if (!c) return;

  if (id === 'recruit-open') { G.overlay = 'recruit'; return; }
  if (id === 'diplo-open') { G.overlay = 'diplomacy'; G.ui.diploFid = null; return; }
  if (id === 'infil-open') { G.overlay = 'infiltrate'; G.ui.diploFid = null; G.ui.discordTarget = null; return; }
  if (id === 'end-season') {
    if (G.overlay) return;
    doEndSeason();
    return;
  }
  if (id.startsWith('territory:')) {
    G.ui.selected = id.slice('territory:'.length);
    G.overlay = 'territory';
    AudioSys.click();
    return;
  }
  if (id.startsWith('move:') || id.startsWith('attack:')) {
    const tid = id.slice(id.indexOf(':') + 1);
    const res = moveArmyTo(c, tid);
    if (res.battle) startBattleMode(res.battle, 'campaign');
    else toast(G, res.msg);
    closeOverlay(G);
    return;
  }
  if (id === 'recruit-here') { G.overlay = 'recruit'; return; }
  if (id.startsWith('recruit:')) {
    const res = recruit(c, id.slice('recruit:'.length));
    toast(G, res.msg);
    return;
  }
  if (id.startsWith('diplo-fid:')) { G.ui.diploFid = id.slice('diplo-fid:'.length); AudioSys.click(); return; }
  if (id.startsWith('diplo-act:')) {
    const res = doDiplo(c, G.ui.diploFid, id.slice('diplo-act:'.length));
    toast(G, res.msg);
    return;
  }
  if (id.startsWith('infil-fid:')) {
    G.ui.diploFid = id.slice('infil-fid:'.length);
    G.ui.discordTarget = null;
    AudioSys.click();
    return;
  }
  if (id.startsWith('discord-target:')) {
    G.ui.discordTarget = id.slice('discord-target:'.length);
    AudioSys.click();
    return;
  }
  if (id.startsWith('infil-act:')) {
    const action = id.slice('infil-act:'.length);
    if (action === 'discord' && !G.ui.discordTarget) {
      toast(G, 'Pilih faksi kedua untuk diadu domba.');
      return;
    }
    const res = doInfil(c, G.ui.diploFid, action, G.ui.discordTarget);
    toast(G, res.msg);
    closeOverlay(G);
    return;
  }
  if (id === 'back-diplo') { G.ui.diploFid = null; return; }
  if (id.startsWith('event-choice:')) {
    const res = applyEventChoice(c, parseInt(id.slice('event-choice:'.length), 10));
    G.overlay = null;
    if (res.battle === 'pirates') {
      startBattleMode(pirateBattleOpts(c), 'pirates');
      toast(G, res.msg);
    } else if (res.msg) {
      toast(G, res.msg);
    }
    return;
  }
  if (id.startsWith('trait-pick:')) {
    if (pickTrait(c, id.slice('trait-pick:'.length))) G.overlay = null;
    return;
  }
}

function update(dt) {
  if (G.ui.paused) {
    if (consumePressed('KeyP')) G.ui.paused = false;
    clearPressed();
    return;
  }
  G.time += dt;
  if (G.ui.toastT > 0) G.ui.toastT -= dt;

  if (consumePressed('KeyM')) AudioSys.setMuted(!AudioSys.muted);

  if (G.mode === 'title') {
    if (consumePressed('Space') || consumePressed('Enter')) startGame();
    const click = consumeClick();
    if (click) handleClick(G, click.x, click.y);
    clearPressed();
    return;
  }

  if (G.mode === 'win' || G.mode === 'lose') {
    const click = consumeClick();
    if (click) handleClick(G, click.x, click.y);
    clearPressed();
    return;
  }

  if (G.mode === 'battle') {
    const b = G.battle;
    if (consumePressed('KeyP')) G.ui.paused = true;
    if (consumePressed('Escape')) G.ui.paused = true;
    const mx = (Input.keys.ArrowRight || Input.keys.KeyD ? 1 : 0) - (Input.keys.ArrowLeft || Input.keys.KeyA ? 1 : 0);
    const my = (Input.keys.ArrowDown || Input.keys.KeyS ? 1 : 0) - (Input.keys.ArrowUp || Input.keys.KeyW ? 1 : 0);
    // The mouse aims in screen space; the battle camera zooms the field, so
    // convert the aim point into world coordinates before swinging.
    const cam = G.battleCam;
    const aimX = cam ? cam.x + (Input.mouse.x - 640) / cam.s : Input.mouse.x;
    const aimY = cam ? cam.y + (Input.mouse.y - 392) / cam.s : Input.mouse.y;
    const res = updateBattle(b, dt, {
      mx, my,
      aimX, aimY,
      swing: Input.mouse.down,
      horn: consumePressed('Space'),
    }, G.campaign);
    void res;
    const click = consumeClick();
    if (click && b.result && b.resultT > 0.8) handleClick(G, click.x, click.y);
    clearPressed();
    return;
  }

  // Campaign mode.
  const c = G.campaign;
  if (consumePressed('KeyP')) G.ui.paused = true;
  if (consumePressed('Escape')) closeOverlay(G);
  if (consumePressed('Enter') && !G.overlay) doEndSeason();
  if (G.overlay === 'trait' && c.traitOffer && c.traitOffer.length) {
    if (consumePressed('Digit1')) { if (pickTrait(c, c.traitOffer[0])) G.overlay = null; }
    if (consumePressed('Digit2') && c.traitOffer[1]) { if (pickTrait(c, c.traitOffer[1])) G.overlay = null; }
    if (consumePressed('Digit3') && c.traitOffer[2]) { if (pickTrait(c, c.traitOffer[2])) G.overlay = null; }
  }
  if (G.overlay === 'event' && c.event) {
    for (let i = 0; i < c.event.choices.length; i++) {
      if (consumePressed('Digit' + (i + 1))) {
        const res = applyEventChoice(c, i);
        G.overlay = null;
        if (res.battle === 'pirates') {
          startBattleMode(pirateBattleOpts(c), 'pirates');
          toast(G, res.msg);
        } else if (res.msg) {
          toast(G, res.msg);
        }
        break;
      }
    }
  }
  if (c.traitOffer && c.traitOffer.length && !G.overlay) G.overlay = 'trait';
  const click = consumeClick();
  if (click) handleClick(G, click.x, click.y);
  clearPressed();
}

let last = performance.now();
let acc = 0;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let steps = 0;
  while (acc >= 1 / 60 && steps < 5) {
    update(1 / 60);
    acc -= 1 / 60;
    steps++;
  }
  if (steps === 5) acc = 0;
  drawGame(ctx, G);
  if (G.shot && !G.shotReady) {
    window.__shotReady = true;
    G.shotReady = true;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
