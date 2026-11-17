// Nusa Raya — campaign layer: the season-by-season map game. Pure logic, no
// DOM and no drawing: render.js shows this state, input.js and main.js drive
// it. Every random draw comes from the campaign's seeded RNG, so a seed plays
// the same campaign every time.

function newCampaign(seed) {
  const rng = makeRng(seed);
  const territories = {};
  for (const t of TERRITORIES) {
    const mix = garrisonMix(rng, t.garrison);
    territories[t.id] = { owner: t.owner, garrison: t.garrison, mix };
  }
  return {
    seed,
    rng,
    season: 1,
    gold: GAME.START_GOLD,
    xp: 0,
    level: 1,
    traits: [],
    traitOffer: null,
    army: { pendekar: 5, pemanah: 2, penunggang: 1 },
    armyAt: 'arun-kota',
    movesLeft: 2,
    territories,
    relations: { samudra: 10, gading: -10, rimba: 0, karang: -30 },
    atWar: {},
    allies: {},
    known: {},
    factionGold: { samudra: 100, gading: 90, rimba: 80, karang: 140 },
    eventDeck: rngShuffle(rng, EVENTS.map((e) => e.id)),
    event: null,
    lastAttack: {},
    log: [],
    stats: { battlesWon: 0, battlesLost: 0, goldEarned: 0, kills: 0, diplo: 0 },
    pendingBattle: null,
    incomeLast: 0,
  };
}

// A garrison of n troops, split 50/30/20 across the three types.
function garrisonMix(rng, n) {
  const mix = { pendekar: 0, pemanah: 0, penunggang: 0 };
  for (let i = 0; i < n; i++) {
    const r = rng();
    if (r < 0.5) mix.pendekar++;
    else if (r < 0.8) mix.pemanah++;
    else mix.penunggang++;
  }
  return mix;
}

function armySize(c) {
  return c.army.pendekar + c.army.pemanah + c.army.penunggang;
}

function factionTerritories(c, fid) {
  const out = [];
  for (const t of TERRITORIES) if (c.territories[t.id].owner === fid) out.push(t.id);
  return out;
}

function factionGarrisonTotal(c, fid) {
  let n = 0;
  for (const id of factionTerritories(c, fid)) n += c.territories[id].garrison;
  return n;
}

function factionPower(c, fid) {
  if (fid === 'arun') return armySize(c) * 2 + Math.floor(c.gold / 10);
  return factionGarrisonTotal(c, fid) + Math.floor((c.factionGold[fid] || 0) / 15);
}

function traitFx(c) {
  const fx = {};
  for (const id of c.traits) {
    const t = traitById(id);
    if (!t) continue;
    for (const k of Object.keys(t.fx)) fx[k] = (fx[k] || 0) + t.fx[k];
  }
  return fx;
}

function heroStats(c) {
  const fx = traitFx(c);
  return {
    hp: GAME.HERO.hp + (fx.heroHp || 0),
    dmg: GAME.HERO.dmg * (1 + (fx.heroDmg || 0)),
    speed: GAME.HERO.speed,
    martial: 5 + (c.level - 1),
    diplomacy: 5 + Math.floor((c.level - 1) / 2) + (fx.diplomacy || 0),
    intrigue: 5 + (fx.intrigue || 0),
  };
}

function incomePerSeason(c) {
  let income = 0;
  for (const t of TERRITORIES) {
    if (c.territories[t.id].owner !== 'arun') continue;
    income += t.kind === 'capital' ? 35 : 15;
  }
  const fx = traitFx(c);
  income = Math.round(income * (1 + (fx.tribute || 0)));
  if (c.allies.samudra) income += 15;
  return income;
}

function levelForXp(xp) {
  let lvl = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lvl = i + 1;
  return lvl;
}

function addLog(c, text, kind) {
  c.log.unshift({ text, kind: kind || 'info' });
  if (c.log.length > 8) c.log.length = 8;
}

function grantXp(c, n) {
  c.xp += n;
  const lvl = levelForXp(c.xp);
  if (lvl > c.level) {
    c.level = lvl;
    offerTraits(c);
    return true;
  }
  return false;
}

function offerTraits(c) {
  const owned = new Set(c.traits);
  const pool = TRAITS.filter((t) => !owned.has(t.id));
  if (!pool.length) {
    c.traitOffer = null;
    return;
  }
  const picks = rngShuffle(c.rng, pool).slice(0, 3);
  c.traitOffer = picks.map((t) => t.id);
}

function pickTrait(c, id) {
  if (!c.traitOffer || !c.traitOffer.includes(id)) return false;
  if (c.traits.includes(id)) {
    // Gained from an event after the offer was drawn: re-roll a fresh offer.
    offerTraits(c);
    return false;
  }
  c.traits.push(id);
  c.traitOffer = null;
  addLog(c, 'Keahlian baru: ' + traitById(id).name, 'good');
  AudioSys.levelup();
  return true;
}

function recruitCost(c, type) {
  const fx = traitFx(c);
  return Math.max(5, Math.round(UNITS[type].cost * (1 - (fx.recruitCost || 0))));
}

function recruit(c, type) {
  const cost = recruitCost(c, type);
  if (c.gold < cost) return { ok: false, msg: 'Emas tidak cukup.' };
  if (armySize(c) >= GAME.ARMY_CAP) return { ok: false, msg: 'Pasukan sudah penuh (' + GAME.ARMY_CAP + ').' };
  c.gold -= cost;
  c.army[type]++;
  AudioSys.coin();
  return { ok: true, msg: '1 ' + UNITS[type].name + ' bergabung. (-' + cost + ' emas)' };
}

function canMoveTo(c, tid) {
  if (c.movesLeft <= 0) return { ok: false, msg: 'Langkah musim ini sudah habis (2 langkah/musim).' };
  const from = territoryById(c.armyAt);
  if (!from.neighbours.includes(tid)) return { ok: false, msg: 'Terlalu jauh — pilih wilayah tetangga.' };
  return { ok: true };
}

// Moving into an enemy territory starts a battle; moving elsewhere just moves.
function moveArmyTo(c, tid) {
  const check = canMoveTo(c, tid);
  if (!check.ok) return check;
  const target = c.territories[tid];
  c.movesLeft--;
  if (target.owner !== 'arun' && !c.allies[target.owner]) {
    return { ok: true, battle: battleOptsForTerritory(c, tid) };
  }
  c.armyAt = tid;
  AudioSys.click();
  return { ok: true, msg: 'Pasukan bergerak ke ' + territoryById(tid).name + '.' };
}

function battleOptsForTerritory(c, tid) {
  const t = territoryById(tid);
  const terr = c.territories[tid];
  return {
    territoryId: tid,
    enemyUnits: Object.assign({}, terr.mix),
    enemyName: factionById(terr.owner).ruler,
    enemyFaction: terr.owner,
    champion: t.kind === 'capital',
    attack: true,
  };
}

function battleOptsForDefense(c, attackerFid, tid) {
  const rng = c.rng;
  const size = Math.min(16, 6 + c.season);
  const mix = garrisonMix(rng, size);
  return {
    territoryId: tid,
    enemyUnits: mix,
    enemyName: factionById(attackerFid).ruler,
    enemyFaction: attackerFid,
    champion: false,
    attack: false,
  };
}

function captureTerritory(c, tid, survivors) {
  const t = territoryById(tid);
  const prevOwner = c.territories[tid].owner;
  c.territories[tid].owner = 'arun';
  c.territories[tid].garrison = 4;
  c.territories[tid].mix = { pendekar: 3, pemanah: 1, penunggang: 0 };
  c.army = survivors;
  c.armyAt = tid;
  const loot = t.kind === 'capital' ? 80 : 30;
  c.gold += loot;
  c.stats.goldEarned += loot;
  addLog(c, t.name + ' direbut! Rampasan +' + loot + ' emas.', 'good');
  if (factionTerritories(c, prevOwner).length === 0) {
    eliminateFaction(c, prevOwner);
  }
}

function eliminateFaction(c, fid) {
  const f = factionById(fid);
  delete c.relations[fid];
  delete c.atWar[fid];
  delete c.allies[fid];
  addLog(c, f.name + ' runtuh — tak ada lagi wilayahnya.', 'good');
}

function loseTerritoryTo(c, tid, fid, survivors) {
  const t = territoryById(tid);
  c.territories[tid].owner = fid;
  c.territories[tid].garrison = Math.max(2, survivors);
  c.territories[tid].mix = garrisonMix(c.rng, c.territories[tid].garrison);
  addLog(c, t.name + ' jatuh ke tangan ' + factionById(fid).name + '.', 'bad');
  if (c.armyAt === tid) {
    const owned = factionTerritories(c, 'arun');
    c.armyAt = owned.length ? owned[0] : 'arun-kota';
  }
}

function factionAlive(c, fid) {
  return factionTerritories(c, fid).length > 0;
}

// --- Diplomacy -------------------------------------------------------------

function diploOptions(c, fid) {
  const f = factionById(fid);
  const rel = c.relations[fid];
  const hs = heroStats(c);
  const opts = [];
  opts.push({ action: 'gift', label: 'Kirim Hadiah', sub: '-' + DIPLOMACY.giftCost + ' emas, hubungan +' + DIPLOMACY.giftRel, cost: DIPLOMACY.giftCost, disabled: c.gold < DIPLOMACY.giftCost });
  const canMarry = rel >= DIPLOMACY.marriageRelReq && !c.allies[fid] && !c.atWar[fid];
  opts.push({ action: 'marriage', label: 'Aliansi Pernikahan', sub: canMarry ? '-' + DIPLOMACY.marriageCost + ' emas — sekutu sehidup semati' : 'Butuh hubungan ' + DIPLOMACY.marriageRelReq + '+, sedang damai', cost: DIPLOMACY.marriageCost, disabled: !canMarry || c.gold < DIPLOMACY.marriageCost });
  const stronger = factionPower(c, 'arun') > factionPower(c, fid);
  opts.push({ action: 'tribute', label: 'Minta Upeti', sub: stronger ? 'Mereka takut padamu — bayar atau perang' : 'Kamu belum cukup kuat untuk menuntut', cost: 0, disabled: !stronger || c.atWar[fid] });
  opts.push({ action: 'peace', label: 'Tawar Damai', sub: c.atWar[fid] ? 'Akhiri perang ini' : 'Kalian sedang tidak berperang', cost: 0, disabled: !c.atWar[fid] });
  opts.push({ action: 'war', label: 'Nyatakan Perang', sub: c.atWar[fid] ? 'Kalian sudah berperang' : 'Hubungan jatuh ke -100', cost: 0, disabled: !!c.atWar[fid] });
  void f;
  void hs;
  return opts;
}

function doDiplo(c, fid, action) {
  const f = factionById(fid);
  if (!factionAlive(c, fid)) return { ok: false, msg: f.name + ' sudah runtuh — tak ada lagi yang diajak bicara.' };
  if (action === 'gift') {
    if (c.gold < DIPLOMACY.giftCost) return { ok: false, msg: 'Emas tidak cukup.' };
    c.gold -= DIPLOMACY.giftCost;
    c.relations[fid] = clamp((c.relations[fid] || 0) + DIPLOMACY.giftRel, -100, 100);
    c.stats.diplo++;
    grantXp(c, 15);
    AudioSys.coin();
    return { ok: true, msg: 'Hadiah diterima. ' + f.ruler + ' tersenyum. Hubungan +' + DIPLOMACY.giftRel + '.' };
  }
  if (action === 'marriage') {
    if (c.gold < DIPLOMACY.marriageCost) return { ok: false, msg: 'Emas tidak cukup.' };
    c.gold -= DIPLOMACY.marriageCost;
    c.allies[fid] = true;
    c.relations[fid] = clamp((c.relations[fid] || 0) + 25, -100, 100);
    c.stats.diplo++;
    grantXp(c, 40);
    AudioSys.gong();
    return { ok: true, msg: 'Pernikahan agung! ' + f.name + ' kini sekutumu. Pulau mereka dihitung bersatu.' };
  }
  if (action === 'tribute') {
    const chance = 50 + Math.min(40, (factionPower(c, 'arun') - factionPower(c, fid)) * 2);
    if (c.rng() * 100 < chance) {
      c.gold += DIPLOMACY.tributeBase;
      c.stats.goldEarned += DIPLOMACY.tributeBase;
      c.relations[fid] = clamp((c.relations[fid] || 0) - 10, -100, 100);
      grantXp(c, 15);
      AudioSys.coin();
      return { ok: true, msg: f.ruler + ' membayar upeti ' + DIPLOMACY.tributeBase + ' emas dengan gigi gemertak.' };
    }
    c.relations[fid] = -100;
    c.atWar[fid] = true;
    return { ok: true, msg: f.ruler + ' menolak dengan hinaan! Perang dinyatakan.' };
  }
  if (action === 'peace') {
    delete c.atWar[fid];
    c.relations[fid] = clamp((c.relations[fid] || 0) + 10, -100, 100);
    grantXp(c, 10);
    return { ok: true, msg: 'Damai disepakati. Pedang kembali ke sarungnya.' };
  }
  if (action === 'war') {
    c.atWar[fid] = true;
    c.relations[fid] = -100;
    delete c.allies[fid];
    AudioSys.drum();
    return { ok: true, msg: 'Perang melawan ' + f.name + '! Pasukan bersiap.' };
  }
  return { ok: false, msg: 'Aksi tidak dikenal.' };
}

// --- Infiltration ----------------------------------------------------------

function infilOptions(c, fid) {
  const hs = heroStats(c);
  const spyChance = Math.min(95, DIPLOMACY.spyChance + (hs.intrigue - 5) * 2);
  const sabChance = Math.min(95, DIPLOMACY.sabotageChance + (hs.intrigue - 5) * 3);
  const disChance = Math.min(90, DIPLOMACY.discordChance + (hs.intrigue - 5) * 2);
  return [
    { action: 'spy', label: 'Mata-mata', sub: '-' + DIPLOMACY.spyCost + ' emas, peluang ' + spyChance + '% — ungkap pasukan & rencana', cost: DIPLOMACY.spyCost, chance: spyChance },
    { action: 'sabotage', label: 'Sabotase', sub: '-' + DIPLOMACY.sabotageCost + ' emas, peluang ' + sabChance + '% — garnisun -30%', cost: DIPLOMACY.sabotageCost, chance: sabChance },
    { action: 'discord', label: 'Adu Domba', sub: '-' + DIPLOMACY.discordCost + ' emas, peluang ' + disChance + '% — hasut dua faksi saling membenci', cost: DIPLOMACY.discordCost, chance: disChance },
  ];
}

function doInfil(c, fid, action, targetFid) {
  const f = factionById(fid);
  if (!factionAlive(c, fid)) return { ok: false, msg: f.name + ' sudah runtuh — tak ada lagi yang bisa disusupi.' };
  const opts = infilOptions(c, fid);
  const opt = opts.find((o) => o.action === action);
  if (!opt) return { ok: false, msg: 'Aksi tidak dikenal.' };
  if (c.gold < opt.cost) return { ok: false, msg: 'Emas tidak cukup.' };
  c.gold -= opt.cost;
  const roll = c.rng() * 100;
  if (action === 'spy') {
    if (roll < opt.chance) {
      c.known[fid] = { army: factionGarrisonTotal(c, fid), power: factionPower(c, fid) };
      grantXp(c, 15);
      return { ok: true, msg: 'Mata-matamu kembali: ' + f.name + ' punya ' + c.known[fid].army + ' pasukan di semua wilayah.' };
    }
    c.relations[fid] = clamp((c.relations[fid] || 0) - 10, -100, 100);
    return { ok: true, msg: 'Mata-matamu tertangkap! ' + f.ruler + ' murka. Hubungan -10.' };
  }
  if (action === 'sabotage') {
    if (roll < opt.chance) {
      let cut = 0;
      for (const id of factionTerritories(c, fid)) {
        const terr = c.territories[id];
        const loss = Math.max(1, Math.floor(terr.garrison * DIPLOMACY.sabotageCut));
        terr.garrison = Math.max(2, terr.garrison - loss);
        terr.mix = garrisonMix(c.rng, terr.garrison);
        cut += loss;
      }
      grantXp(c, 20);
      return { ok: true, msg: 'Lumbung dibakar, sumur diracuni! Garnisun ' + f.name + ' berkurang ' + cut + ' pasukan.' };
    }
    c.relations[fid] = clamp((c.relations[fid] || 0) - 15, -100, 100);
    return { ok: true, msg: 'Sabotase gagal — penyusupmu digantung di alun-alun. Hubungan -15.' };
  }
  if (action === 'discord') {
    if (!targetFid || targetFid === fid || !factionById(targetFid)) return { ok: false, msg: 'Pilih faksi kedua untuk diadu.' };
    if (roll < opt.chance) {
      c.relations[fid] = clamp((c.relations[fid] || 0) - DIPLOMACY.discordCut, -100, 100);
      addLog(c, 'Hasutan berhasil: ' + f.name + ' kini membenci ' + factionById(targetFid).name + '.', 'info');
      grantXp(c, 20);
      return { ok: true, msg: 'Surat palsu terkirim. ' + f.ruler + ' percaya ' + factionById(targetFid).ruler + ' merencanakan pengkhianatan.' };
    }
    return { ok: true, msg: 'Adu domba gagal — suratmu disadap sebelum sampai.' };
  }
  return { ok: false, msg: 'Aksi tidak dikenal.' };
}

// --- Events ----------------------------------------------------------------

function applyEventChoice(c, choiceIdx) {
  const ev = c.event;
  if (!ev) return { ok: false };
  const choice = ev.choices[choiceIdx];
  if (!choice) return { ok: false };
  c.event = null;
  const fx = choice.effect || {};
  if (fx.battle === 'pirates') {
    return { ok: true, battle: 'pirates', msg: 'Bajak laut menyerbu pantai! Bertempurlah!' };
  }
  applyEffect(c, fx);
  return { ok: true, msg: choice.label + '.' };
}

function applyEffect(c, fx) {
  if (fx.gold) {
    c.gold = Math.max(0, c.gold + fx.gold);
    if (fx.gold > 0) c.stats.goldEarned += fx.gold;
  }
  if (fx.rel) c.relations[fx.rel.fid] = clamp((c.relations[fx.rel.fid] || 0) + fx.rel.d, -100, 100);
  if (fx.relAll) {
    for (const fid of Object.keys(c.relations)) c.relations[fid] = clamp(c.relations[fid] + fx.relAll, -100, 100);
  }
  if (fx.addUnits) {
    const n = fx.addUnits;
    if (n > 0) {
      for (let i = 0; i < n && armySize(c) < GAME.ARMY_CAP; i++) c.army.pendekar++;
    } else {
      let left = -n;
      for (const t of UNIT_ORDER) {
        while (left > 0 && c.army[t] > 0) { c.army[t]--; left--; }
      }
    }
  }
  if (fx.war) {
    c.atWar[fx.war] = true;
    c.relations[fx.war] = -100;
    delete c.allies[fx.war];
  }
  if (fx.ally) {
    c.allies[fx.ally] = true;
    c.relations[fx.ally] = clamp((c.relations[fx.ally] || 0) + 25, -100, 100);
  }
  if (fx.xp) grantXp(c, fx.xp);
  if (fx.trait) {
    const pool = TRAITS.filter((t) => !c.traits.includes(t.id));
    if (pool.length) c.traits.push(rngPick(c.rng, pool).id);
  }
  if (fx.traitId && !c.traits.includes(fx.traitId)) c.traits.push(fx.traitId);
  if (fx.garrison) {
    for (const id of factionTerritories(c, fx.garrison.fid)) {
      const terr = c.territories[id];
      terr.garrison = Math.max(2, terr.garrison + fx.garrison.d);
      terr.mix = garrisonMix(c.rng, terr.garrison);
    }
  }
  if (fx.gamble) {
    const win = c.rng() < 0.5;
    applyEffect(c, win ? fx.gamble.win : fx.gamble.lose);
  }
}

// --- Seasons and AI ----------------------------------------------------------

function endSeason(c) {
  // 1. Tribute flows in.
  const income = incomePerSeason(c);
  c.gold += income;
  c.stats.goldEarned += income;
  c.incomeLast = income;
  addLog(c, 'Upeti musim ini: +' + income + ' emas.', 'good');
  // Upkeep: every soldier expects pay, and unpaid soldiers desert.
  const upkeep = armySize(c) * 2;
  c.gold -= upkeep;
  addLog(c, 'Upah pasukan: -' + upkeep + ' emas.', 'info');
  if (c.gold < 0) {
    c.gold = 0;
    let left = 2;
    for (const t of UNIT_ORDER) {
      while (left > 0 && c.army[t] > 0) { c.army[t]--; left--; }
    }
    addLog(c, 'Pasukan membelot karena tak dibayar!', 'bad');
  }
  c.movesLeft = 2;

  // 2. Every rival faction takes its turn.
  let attack = null;
  for (const f of FACTIONS) {
    if (f.id === 'arun') continue;
    if (factionTerritories(c, f.id).length === 0) continue;
    const hit = aiTurn(c, f.id);
    if (hit && !attack) attack = hit;
  }

  // 3. The season turns.
  c.season++;
  if (c.season > GAME.MAX_SEASONS) return { battle: attack, gameOver: checkEnd(c) };

  // 4. One event opens the new season.
  if (c.eventDeck.length === 0) c.eventDeck = rngShuffle(c.rng, EVENTS.map((e) => e.id));
  const evId = c.eventDeck.pop();
  c.event = EVENTS.find((e) => e.id === evId) || null;

  return { battle: attack, event: c.event, gameOver: checkEnd(c) };
}

function aiTurn(c, fid) {
  const f = factionById(fid);
  const rng = c.rng;
  // Income and building.
  let income = 0;
  for (const id of factionTerritories(c, fid)) income += territoryById(id).kind === 'capital' ? 35 : 15;
  c.factionGold[fid] = (c.factionGold[fid] || 0) + income;
  while (c.factionGold[fid] >= 30 && rng() < 0.85) {
    c.factionGold[fid] -= 15;
    const ids = factionTerritories(c, fid);
    const tid = rngPick(rng, ids);
    const terr = c.territories[tid];
    // Garrisons grow, but villages stay stormable and capitals stay the
    // real fortresses: caps keep the map from turtling into 20-man villages.
    const cap = territoryById(tid).kind === 'capital' ? 24 : 10;
    if (terr.garrison >= cap) break;
    terr.garrison += 1;
    terr.mix = garrisonMix(rng, terr.garrison);
  }

  const myPower = factionPower(c, fid);
  const playerPower = factionPower(c, 'arun');

  // Merchant: buy the player's friendship when it is cheap.
  if (f.personality === 'merchant' && (c.relations[fid] || 0) < 30 && c.factionGold[fid] > 60 && rng() < 0.4) {
    c.factionGold[fid] -= 20;
    c.relations[fid] = clamp((c.relations[fid] || 0) + 10, -100, 100);
    addLog(c, f.ruler + ' mengirim hadiah dagang. Hubungan +10.', 'info');
    return null;
  }

  // Warlike and proud factions attack the player when they smell weakness —
  // but not every season: a raid needs a season to regroup.
  const hostile = c.atWar[fid] || f.personality === 'warlike' || (f.personality === 'proud' && (c.relations[fid] || 0) < -30);
  const rested = !c.lastAttack[fid] || c.season - c.lastAttack[fid] >= 2;
  if (hostile && rested && myPower > playerPower * 1.1 && rng() < 0.45) {
    const border = factionTerritories(c, 'arun').filter((tid) => {
      const from = territoryById(tid);
      return from.neighbours.some((n) => c.territories[n].owner === fid);
    });
    if (border.length) {
      const target = rngPick(rng, border);
      c.atWar[fid] = true;
      c.lastAttack[fid] = c.season;
      addLog(c, f.name + ' menyerang ' + territoryById(target).name + '!', 'bad');
      return { territoryId: target, attackerFid: fid };
    }
  }

  // Warlike factions also eat their weakest neighbour (abstract battle).
  if (f.personality === 'warlike' && rng() < 0.5) {
    const victims = FACTIONS.filter((o) => o.id !== fid && o.id !== 'arun' && factionTerritories(c, o.id).length > 1);
    for (const v of victims) {
      if (myPower > factionPower(c, v.id) * 1.2) {
        const villages = factionTerritories(c, v.id).filter((id) => territoryById(id).kind === 'village');
        if (villages.length) {
          const tid = rngPick(rng, villages);
          c.territories[tid].owner = fid;
          c.territories[tid].garrison = 4;
          c.territories[tid].mix = garrisonMix(rng, 4);
          addLog(c, f.name + ' merebut ' + territoryById(tid).name + ' dari ' + v.name + '.', 'info');
        }
        break;
      }
    }
  }
  return null;
}

// Victory: every capital is yours or your ally's. Defeat: no land left, or
// the 16 seasons run out without uniting the archipelago.
function checkEnd(c) {
  const playerLands = factionTerritories(c, 'arun');
  if (playerLands.length === 0 && armySize(c) === 0) return 'lose';
  let united = true;
  for (const t of TERRITORIES) {
    if (t.kind !== 'capital') continue;
    const owner = c.territories[t.id].owner;
    if (owner !== 'arun' && !c.allies[owner]) { united = false; break; }
  }
  if (united) return 'win';
  if (c.season > GAME.MAX_SEASONS) return 'lose';
  return null;
}

function unitedCapitals(c) {
  let n = 0;
  for (const t of TERRITORIES) {
    if (t.kind !== 'capital') continue;
    const owner = c.territories[t.id].owner;
    if (owner === 'arun' || c.allies[owner]) n++;
  }
  return n;
}

function score(c) {
  let s = factionTerritories(c, 'arun').length * 1000;
  s += c.stats.battlesWon * 500;
  s += Math.floor(c.stats.goldEarned / 2);
  s += c.stats.kills * 10;
  s += unitedCapitals(c) * 800;
  if (checkEnd(c) === 'win') s += Math.max(0, (GAME.MAX_SEASONS - c.season + 1)) * 300;
  return s;
}
