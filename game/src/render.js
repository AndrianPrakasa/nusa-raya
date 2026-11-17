// Nusa Raya — render layer: everything the player (and the judge) sees. All
// art is drawn in code on one canvas: pixel soldiers, islands, castles, faces.
// Clickable things register a "hot" rectangle while they are drawn; main.js
// matches clicks against the last frame's hot list (immediate-mode UI).

const ISLANDS = [
  { faction: 'arun', points: [[180, 300], [220, 230], [300, 210], [380, 250], [400, 330], [370, 430], [300, 470], [220, 450], [180, 380]] },
  { faction: 'samudra', points: [[490, 200], [540, 140], [650, 120], [760, 130], [820, 180], [780, 240], [650, 250], [540, 240]] },
  { faction: 'gading', points: [[900, 330], [930, 270], [1010, 260], [1070, 310], [1060, 400], [990, 440], [920, 410]] },
  { faction: 'rimba', points: [[390, 550], [430, 515], [520, 510], [600, 540], [580, 590], [480, 600], [410, 585]] },
  { faction: 'karang', points: [[820, 520], [870, 460], [960, 450], [1060, 470], [1100, 540], [1080, 630], [980, 650], [880, 620], [820, 570]] },
];

function islandTrees() {
  const rng = makeRng(99);
  const out = [];
  for (const isl of ISLANDS) {
    for (let i = 0; i < 5; i++) {
      const xs = isl.points.map((p) => p[0]);
      const ys = isl.points.map((p) => p[1]);
      out.push({ x: rngInt(rng, Math.min(...xs) + 14, Math.max(...xs) - 14), y: rngInt(rng, Math.min(...ys) + 14, Math.max(...ys) - 14), r: rngInt(rng, 9, 14) });
    }
  }
  return out;
}
const ISLAND_TREES = islandTrees();

// --- Text and shape helpers ------------------------------------------------

function text(ctx, s, x, y, size, color, align, weight) {
  ctx.font = (weight || 700) + ' ' + size + 'px system-ui, sans-serif';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color || PALETTE.ink;
  ctx.fillText(s, x, y);
}

function textOutline(ctx, s, x, y, size, color, align, weight) {
  ctx.font = (weight || 800) + ' ' + size + 'px system-ui, sans-serif';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(11,30,38,0.85)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color || '#ffffff';
  ctx.fillText(s, x, y);
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function panel(ctx, x, y, w, h, fill) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 4, y + 5, w, h);
  ctx.fillStyle = fill || PALETTE.paper;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg || 'rgba(11,30,38,0.35)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function hot(G, x, y, w, h, id) {
  G.ui.hot.push({ x, y, w, h, id });
}

function button(ctx, G, x, y, w, h, label, opts) {
  const o = opts || {};
  const disabled = !!o.disabled;
  const bg = o.gold ? PALETTE.gold : disabled ? '#94a3b8' : o.red ? PALETTE.red : o.teal ? PALETTE.teal : PALETTE.paperDark;
  const fg = o.gold || o.red || o.teal ? '#1e293b' : PALETTE.ink;
  if (o.gold || o.red || o.teal) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 2, y + 3, w, h);
  }
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  text(ctx, label, x + w / 2, y + h / 2 + 1, o.size || 15, disabled ? '#64748b' : fg, 'center', 800);
  if (!disabled) hot(G, x, y, w, h, o.id || 'noop');
  else hot(G, x, y, w, h, 'noop');
}

function findHot(G, x, y) {
  for (let i = G.ui.hot.length - 1; i >= 0; i--) {
    const r = G.ui.hot[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id;
  }
  return null;
}

// --- Pixel people ------------------------------------------------------------

function drawSoldier(ctx, x, y, type, color, dark, walkPhase, champion) {
  const s = champion ? 1.35 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  const step = Math.sin(walkPhase || 0) * 2;
  ctx.fillStyle = '#3f2d20';
  ctx.fillRect(-4, 3, 3, 5 + step * 0.4);
  ctx.fillRect(1, 3, 3, 5 - step * 0.4);
  if (type === 'penunggang') {
    ctx.fillStyle = '#7c4a21';
    ctx.fillRect(-8, 2, 16, 6);
    ctx.fillRect(6, -2, 5, 5);
  }
  ctx.fillStyle = color;
  ctx.fillRect(-5, -5, 10, 9);
  ctx.fillStyle = dark;
  ctx.fillRect(-5, 2, 10, 2);
  ctx.fillStyle = '#f2c89b';
  ctx.fillRect(-4, -11, 8, 7);
  ctx.fillStyle = dark;
  ctx.fillRect(-4, -11, 8, 3);
  if (type === 'pendekar') {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(11, -9);
    ctx.stroke();
  } else if (type === 'pemanah') {
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(7, -4, 5, -1.2, 1.2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, -4);
    ctx.lineTo(11, -12);
    ctx.stroke();
  }
  if (champion) {
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(-5, -16, 3, 4);
    ctx.fillRect(-1, -17, 3, 5);
    ctx.fillRect(3, -16, 3, 4);
  }
  ctx.restore();
}

function drawHero(ctx, x, y, angle, swingT, walkPhase) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const step = Math.sin(walkPhase || 0) * 2;
  ctx.fillStyle = '#3f2d20';
  ctx.fillRect(-5, 4, 4, 6 + step * 0.4);
  ctx.fillRect(1, 4, 4, 6 - step * 0.4);
  ctx.fillStyle = PALETTE.teal;
  ctx.fillRect(-7, -7, 14, 12);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(-7, 3, 14, 3);
  ctx.fillStyle = '#f2c89b';
  ctx.fillRect(-5, -15, 10, 9);
  ctx.fillStyle = PALETTE.tealDark;
  ctx.fillRect(-5, -15, 10, 3);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(-2, -17, 4, 3);
  // Sword: swings in an arc while swingT is hot.
  const swing = swingT > 0 ? (0.18 - swingT) / 0.18 : 0;
  const swordAngle = angle - 1.1 + swing * 2.2;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8 - 2);
  ctx.lineTo(Math.cos(swordAngle) * 26, Math.sin(swordAngle) * 26 - 2);
  ctx.stroke();
  if (swingT > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -2, 30, angle - 1.1, angle - 1.1 + swing * 2.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFace(ctx, x, y, size, fid) {
  const f = factionById(fid);
  const s = size / 48;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = f.color;
  ctx.fillRect(2, 2, 44, 44);
  ctx.fillStyle = '#f2c89b';
  ctx.fillRect(12, 14, 24, 26);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(17, 24, 4, 4);
  ctx.fillRect(27, 24, 4, 4);
  ctx.fillStyle = '#b45309';
  ctx.fillRect(21, 32, 6, 2);
  if (fid === 'samudra') {
    ctx.fillStyle = f.dark;
    ctx.fillRect(10, 8, 28, 10);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(22, 10, 5, 5);
  } else if (fid === 'gading') {
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(12, 4, 5, 9);
    ctx.fillRect(21, 2, 5, 11);
    ctx.fillRect(30, 4, 5, 9);
  } else if (fid === 'rimba') {
    ctx.fillStyle = f.dark;
    ctx.fillRect(12, 8, 24, 6);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(30, 4, 8, 8);
  } else if (fid === 'karang') {
    ctx.fillStyle = f.dark;
    ctx.fillRect(8, 6, 6, 14);
    ctx.fillRect(34, 6, 6, 14);
  } else {
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(10, 10, 28, 4);
  }
  ctx.restore();
}

function drawTree(ctx, x, y, r) {
  ctx.fillStyle = '#5d3a1a';
  ctx.fillRect(x - 2, y, 4, 7);
  ctx.fillStyle = PALETTE.jungle;
  ctx.beginPath();
  ctx.arc(x, y - 4, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f9e4d';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.4, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawHouse(ctx, x, y, color) {
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(x - 9, y - 4, 18, 12);
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(x - 11, y - 4);
  ctx.lineTo(x, y - 14);
  ctx.lineTo(x + 11, y - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3f2d20';
  ctx.fillRect(x - 2, y + 2, 5, 6);
  void color;
}

function drawCastle(ctx, x, y, color) {
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x - 16, y - 18, 32, 26);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(x - 16, y - 18, 32, 5);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x - 22, y - 26, 9, 34);
  ctx.fillRect(x + 13, y - 26, 9, 34);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(x - 22, y - 26, 9, 4);
  ctx.fillRect(x + 13, y - 26, 9, 4);
  ctx.fillStyle = '#3f2d20';
  ctx.fillRect(x - 3, y - 2, 7, 10);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 26);
  ctx.lineTo(x, y - 38);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 38);
  ctx.lineTo(x + 13, y - 34);
  ctx.lineTo(x, y - 30);
  ctx.closePath();
  ctx.fill();
}

function drawFlag(ctx, x, y, color, wave) {
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 22);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x + 14 + Math.sin(wave) * 2, y - 18);
  ctx.lineTo(x, y - 14);
  ctx.closePath();
  ctx.fill();
}

// --- Map -------------------------------------------------------------------

function polyPath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function centroid(points) {
  let x = 0;
  let y = 0;
  for (const p of points) { x += p[0]; y += p[1]; }
  return [x / points.length, y / points.length];
}

function drawMap(ctx, G) {
  const c = G.campaign;
  const t = G.time;
  ctx.fillStyle = PALETTE.seaDeep;
  ctx.fillRect(0, 64, 1280, 580);
  ctx.strokeStyle = 'rgba(34,165,184,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const y = 150 + i * 170;
    ctx.beginPath();
    for (let x = 0; x <= 1280; x += 16) {
      const yy = y + Math.sin(x * 0.012 + t * 1.3 + i * 2) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  for (const isl of ISLANDS) {
    polyPath(ctx, isl.points);
    ctx.fillStyle = PALETTE.sand;
    ctx.fill();
    const cen = centroid(isl.points);
    const inner = isl.points.map((p) => [cen[0] + (p[0] - cen[0]) * 0.82, cen[1] + (p[1] - cen[1]) * 0.82]);
    polyPath(ctx, inner);
    ctx.fillStyle = PALETTE.grass;
    ctx.fill();
    polyPath(ctx, isl.points);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (const tr of ISLAND_TREES) drawTree(ctx, tr.x, tr.y, tr.r);

  // Neighbour rings around the army, so movement reads at a glance.
  if (G.mode === 'campaign' && !G.overlay) {
    const from = territoryById(c.armyAt);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    for (const nid of from.neighbours) {
      const nt = territoryById(nid);
      ctx.beginPath();
      ctx.arc(nt.x, nt.y, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Territories: castle or houses, owner's flag, garrison badge, name.
  for (const terr of TERRITORIES) {
    const st = c.territories[terr.id];
    const f = factionById(st.owner);
    ctx.fillStyle = f.color;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(terr.x, terr.y + 4, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (terr.kind === 'capital') drawCastle(ctx, terr.x, terr.y, f.color);
    else {
      drawHouse(ctx, terr.x - 10, terr.y + 2, f.color);
      drawHouse(ctx, terr.x + 11, terr.y + 6, f.color);
      drawFlag(ctx, terr.x + 20, terr.y - 2, f.color, t * 2 + terr.x);
    }
    ctx.fillStyle = 'rgba(11,30,38,0.85)';
    ctx.beginPath();
    ctx.arc(terr.x + 24, terr.y - 26, 11, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, String(st.garrison), terr.x + 24, terr.y - 25, 13, '#ffffff', 'center', 800);
    textOutline(ctx, terr.name, terr.x, terr.y + 26, 13, '#ffffff', 'center', 700);
    if (G.ui.selected === terr.id) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(terr.x, terr.y, 38, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (G.mode === 'campaign' && !G.overlay) hot(G, terr.x - 34, terr.y - 44, 68, 88, 'territory:' + terr.id);
  }

  // The player's banner army, bobbing on its territory.
  const at = territoryById(c.armyAt);
  const bob = Math.sin(t * 3) * 2;
  drawFlag(ctx, at.x - 26, at.y - 30 + bob, PALETTE.teal, t * 3);
  drawHero(ctx, at.x - 26, at.y - 8 + bob, -Math.PI / 2, 0, t * 6);
  textOutline(ctx, 'WIRA NUSA', at.x - 26, at.y - 34 + bob, 11, PALETTE.teal, 'center', 800);

  // War banners over factions at war with the player.
  for (const fid of Object.keys(c.atWar)) {
    const caps = factionTerritories(c, fid).filter((id) => territoryById(id).kind === 'capital');
    if (!caps.length) continue;
    const cap = territoryById(caps[0]);
    textOutline(ctx, '⚔ PERANG', cap.x, cap.y - 52, 14, '#fca5a5', 'center', 800);
  }
}

// --- HUD ---------------------------------------------------------------------

function seasonLabel(c) {
  const year = Math.floor((c.season - 1) / 4) + 1;
  const name = GAME.SEASON_NAMES[(c.season - 1) % 4];
  return 'Musim ' + name + ' • Tahun ' + year + ' (' + Math.min(c.season, GAME.MAX_SEASONS) + '/' + GAME.MAX_SEASONS + ')';
}

function drawHud(ctx, G) {
  const c = G.campaign;
  ctx.fillStyle = 'rgba(11,30,38,0.94)';
  ctx.fillRect(0, 0, 1280, 64);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(28, 32, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#92400e';
  ctx.font = '800 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Au', 28, 33);
  text(ctx, String(c.gold), 46, 32, 20, '#ffffff', 'left', 800);
  text(ctx, seasonLabel(c), 150, 32, 16, '#e2e8f0', 'left', 700);
  const hs = heroStats(c);
  text(ctx, 'Lv ' + c.level + ' • ' + hs.martial + '⚔ ' + hs.diplomacy + '🕊 ' + hs.intrigue + '🗡', 420, 32, 15, '#e2e8f0', 'left', 700);
  const xpFrac = (c.xp - LEVEL_XP[c.level - 1]) / ((LEVEL_XP[c.level] || LEVEL_XP[c.level - 1] + 200) - LEVEL_XP[c.level - 1]);
  bar(ctx, 640, 24, 110, 12, clamp(xpFrac, 0, 1), PALETTE.teal, 'rgba(255,255,255,0.15)');
  text(ctx, 'XP ' + c.xp, 640, 50, 12, '#94a3b8', 'left', 700);
  text(ctx, '⚔ ' + armySize(c) + '/' + GAME.ARMY_CAP, 780, 32, 16, '#ffffff', 'left', 800);
  text(ctx, '⚑ ' + factionTerritories(c, 'arun').length + '/13  ★ ' + unitedCapitals(c) + '/5', 900, 32, 16, '#ffffff', 'left', 800);
  button(ctx, G, 1090, 14, 52, 36, AudioSys.muted ? '🔇' : '🔊', { id: 'mute', size: 16 });
  button(ctx, G, 1150, 14, 52, 36, '?', { id: 'help', size: 18 });
  button(ctx, G, 1210, 14, 52, 36, G.ui.paused ? '▶' : 'II', { id: 'pause', size: 16 });

  // Bottom action bar.
  ctx.fillStyle = 'rgba(11,30,38,0.94)';
  ctx.fillRect(0, 644, 1280, 76);
  text(ctx, 'Klik wilayah tetangga untuk bergerak • Upeti +' + incomePerSeason(c) + ' emas/musim', 20, 682, 14, '#94a3b8', 'left', 600);
  button(ctx, G, 560, 658, 130, 48, '⚔ Rekrut', { id: 'recruit-open', teal: true });
  button(ctx, G, 700, 658, 150, 48, '🕊 Diplomasi', { id: 'diplo-open' });
  button(ctx, G, 860, 658, 150, 48, '🗡 Infiltrasi', { id: 'infil-open' });
  button(ctx, G, 1020, 658, 220, 48, 'Akhiri Musim ➜', { id: 'end-season', gold: true });

  // Toast: the latest news, fading.
  if (G.ui.toast && G.ui.toastT > 0) {
    ctx.globalAlpha = Math.min(1, G.ui.toastT);
    const w = Math.min(900, 40 + G.ui.toast.length * 8);
    ctx.fillStyle = 'rgba(11,30,38,0.92)';
    ctx.fillRect(640 - w / 2, 74, w, 34);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(640 - w / 2, 74, w, 34);
    text(ctx, G.ui.toast, 640, 92, 15, '#ffffff', 'center', 700);
    ctx.globalAlpha = 1;
  }
  if (G.ui.paused) {
    ctx.fillStyle = 'rgba(11,30,38,0.6)';
    ctx.fillRect(0, 64, 1280, 580);
    textOutline(ctx, 'JEDA — tekan P untuk lanjut', 640, 360, 30, '#ffffff', 'center', 800);
  }
}

// --- Overlays ------------------------------------------------------------------

function drawTerritoryPanel(ctx, G) {
  const c = G.campaign;
  const tid = G.ui.selected;
  const t = territoryById(tid);
  const st = c.territories[tid];
  const f = factionById(st.owner);
  const x = 340;
  const y = 130;
  const w = 600;
  const h = 330;
  panel(ctx, x, y, w, h);
  text(ctx, t.name, x + 24, y + 34, 26, PALETTE.ink, 'left', 800);
  text(ctx, (t.kind === 'capital' ? 'Ibu kota' : 'Desa') + ' • ' + f.name, x + 24, y + 66, 16, PALETTE.inkSoft, 'left', 600);
  drawFace(ctx, x + w - 84, y + 16, 56, st.owner);
  text(ctx, 'Penguasa: ' + f.ruler + ' (' + f.title + ')', x + 24, y + 104, 15, PALETTE.ink, 'left', 600);
  text(ctx, 'Garnisun: ' + st.garrison + ' pasukan — ' + st.mix.pendekar + ' pendekar, ' + st.mix.pemanah + ' pemanah, ' + st.mix.penunggang + ' penunggang', x + 24, y + 132, 15, PALETTE.ink, 'left', 600);
  text(ctx, 'Upeti: +' + (t.kind === 'capital' ? 35 : 15) + ' emas/musim', x + 24, y + 158, 15, PALETTE.ink, 'left', 600);
  if (st.owner !== 'arun') {
    const rel = c.relations[st.owner];
    text(ctx, 'Hubungan: ' + (rel > 0 ? '+' : '') + rel + (c.atWar[st.owner] ? ' • SEDANG PERANG' : c.allies[st.owner] ? ' • SEKUTU' : ''), x + 24, y + 184, 15, rel >= 0 ? '#15803d' : '#b91c1c', 'left', 700);
    if (c.known[st.owner]) text(ctx, 'Mata-mata: ' + f.name + ' punya ' + c.known[st.owner].army + ' pasukan di semua wilayah.', x + 24, y + 210, 14, PALETTE.inkSoft, 'left', 600);
  } else {
    text(ctx, 'Wilayahmu. Pasukanmu bermarkas di sini bila bergerak ke sini.', x + 24, y + 184, 15, PALETTE.inkSoft, 'left', 600);
  }
  const adj = territoryById(c.armyAt).neighbours.includes(tid);
  const isHere = c.armyAt === tid;
  if (st.owner !== 'arun' && adj && !c.allies[st.owner]) button(ctx, G, x + 24, y + h - 74, 170, 48, '⚔ Serang!', { id: 'attack:' + tid, red: true });
  else if (st.owner === 'arun' && adj && !isHere) button(ctx, G, x + 24, y + h - 74, 200, 48, '➜ Pindah ke sini', { id: 'move:' + tid, teal: true });
  if (st.owner === 'arun') button(ctx, G, x + 214, y + h - 74, 170, 48, '⚔ Rekrut di sini', { id: 'recruit-here', teal: true });
  button(ctx, G, x + w - 124, y + h - 74, 100, 48, 'Tutup', { id: 'close' });
}

function relationBar(ctx, x, y, w, rel) {
  const frac = (rel + 100) / 200;
  ctx.fillStyle = '#fecaca';
  ctx.fillRect(x, y, w, 14);
  ctx.fillStyle = '#bbf7d0';
  ctx.fillRect(x, y, w * frac, 14);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(x + w / 2 - 1, y - 2, 2, 18);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, 12);
}

function drawDiplomacyPanel(ctx, G) {
  const c = G.campaign;
  const x = 240;
  const y = 70;
  const w = 800;
  const h = 560;
  panel(ctx, x, y, w, h);
  text(ctx, 'Diplomasi — Para Penguasa Kepulauan', x + 24, y + 34, 24, PALETTE.ink, 'left', 800);
  if (!G.ui.diploFid) {
    let yy = y + 70;
    for (const f of FACTIONS) {
      if (f.id === 'arun') continue;
      if (!factionTerritories(c, f.id).length) continue;
      const rel = c.relations[f.id];
      const status = c.allies[f.id] ? 'SEKUTU' : c.atWar[f.id] ? 'PERANG' : 'DAMAI';
      const statusColor = c.allies[f.id] ? '#15803d' : c.atWar[f.id] ? '#b91c1c' : PALETTE.inkSoft;
      ctx.fillStyle = f.id === G.ui.diploHover ? '#f3e6c8' : PALETTE.paper;
      ctx.fillRect(x + 16, yy, w - 32, 86);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 16, yy, w - 32, 86);
      drawFace(ctx, x + 30, yy + 15, 56, f.id);
      text(ctx, f.name, x + 104, yy + 24, 19, PALETTE.ink, 'left', 800);
      text(ctx, f.ruler + ' • ' + f.blurb, x + 104, yy + 50, 14, PALETTE.inkSoft, 'left', 600);
      relationBar(ctx, x + 104, yy + 66, 300, rel);
      text(ctx, (rel > 0 ? '+' : '') + rel, x + 414, yy + 73, 15, rel >= 0 ? '#15803d' : '#b91c1c', 'left', 800);
      text(ctx, status, x + w - 110, yy + 30, 16, statusColor, 'left', 800);
      if (c.known[f.id]) text(ctx, 'Diketahui: ' + c.known[f.id].army + ' pasukan', x + w - 190, yy + 56, 13, PALETTE.inkSoft, 'left', 600);
      hot(G, x + 16, yy, w - 32, 86, 'diplo-fid:' + f.id);
      yy += 98;
    }
    button(ctx, G, x + w - 124, y + h - 64, 100, 44, 'Tutup', { id: 'close' });
    return;
  }
  const fid = G.ui.diploFid;
  const f = factionById(fid);
  const rel = c.relations[fid];
  drawFace(ctx, x + 24, y + 60, 72, fid);
  text(ctx, f.name, x + 116, y + 84, 24, PALETTE.ink, 'left', 800);
  text(ctx, f.ruler + ' • ' + f.title + ' • ' + f.blurb, x + 116, y + 114, 15, PALETTE.inkSoft, 'left', 600);
  relationBar(ctx, x + 116, y + 132, 320, rel);
  text(ctx, 'Hubungan ' + (rel > 0 ? '+' : '') + rel, x + 446, y + 140, 16, rel >= 0 ? '#15803d' : '#b91c1c', 'left', 800);
  text(ctx, c.allies[fid] ? 'Status: SEKUTU — pulau mereka dihitung bersatu.' : c.atWar[fid] ? 'Status: PERANG — akhiri dengan damai atau pedang.' : 'Status: DAMAI — belum ada ikatan.', x + 24, y + 168, 15, PALETTE.ink, 'left', 600);
  const opts = diploOptions(c, fid);
  let yy = y + 196;
  for (const o of opts) {
    ctx.fillStyle = PALETTE.paperDark;
    ctx.fillRect(x + 24, yy, w - 48, 50);
    text(ctx, o.label, x + 40, yy + 17, 17, PALETTE.ink, 'left', 800);
    text(ctx, o.sub, x + 40, yy + 36, 13, PALETTE.inkSoft, 'left', 600);
    button(ctx, G, x + w - 150, yy + 5, 126, 40, o.disabled ? '—' : 'Pilih', { id: 'diplo-act:' + o.action, disabled: o.disabled, teal: !o.disabled, size: 14 });
    yy += 56;
  }
  button(ctx, G, x + 24, y + h - 64, 120, 44, '← Kembali', { id: 'back-diplo' });
  button(ctx, G, x + w - 124, y + h - 64, 100, 44, 'Tutup', { id: 'close' });
}

function drawInfiltratePanel(ctx, G) {
  const c = G.campaign;
  const x = 240;
  const y = 80;
  const w = 800;
  const h = 540;
  panel(ctx, x, y, w, h);
  text(ctx, 'Infiltrasi — Perang Bayangan', x + 24, y + 34, 24, PALETTE.ink, 'left', 800);
  text(ctx, 'Mata-mata, sabotase dan adu domba. Peluang sukses naik dengan stat Intrik.', x + 24, y + 62, 15, PALETTE.inkSoft, 'left', 600);
  if (!G.ui.diploFid) {
    let yy = y + 84;
    for (const f of FACTIONS) {
      if (f.id === 'arun') continue;
      if (!factionTerritories(c, f.id).length) continue;
      ctx.fillStyle = PALETTE.paper;
      ctx.fillRect(x + 16, yy, w - 32, 72);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 16, yy, w - 32, 72);
      drawFace(ctx, x + 30, yy + 8, 56, f.id);
      text(ctx, f.name + ' — ' + f.ruler, x + 104, yy + 26, 18, PALETTE.ink, 'left', 800);
      text(ctx, f.blurb, x + 104, yy + 50, 14, PALETTE.inkSoft, 'left', 600);
      hot(G, x + 16, yy, w - 32, 72, 'infil-fid:' + f.id);
      yy += 84;
    }
    button(ctx, G, x + w - 124, y + h - 64, 100, 44, 'Tutup', { id: 'close' });
    return;
  }
  const fid = G.ui.diploFid;
  const f = factionById(fid);
  drawFace(ctx, x + 24, y + 84, 64, fid);
  text(ctx, 'Target: ' + f.name, x + 104, y + 106, 22, PALETTE.ink, 'left', 800);
  text(ctx, 'Hubungan saat ini: ' + (c.relations[fid] > 0 ? '+' : '') + c.relations[fid], x + 104, y + 134, 15, PALETTE.inkSoft, 'left', 600);
  const opts = infilOptions(c, fid);
  let yy = y + 168;
  for (const o of opts) {
    ctx.fillStyle = PALETTE.paperDark;
    ctx.fillRect(x + 24, yy, w - 48, 52);
    text(ctx, o.label, x + 40, yy + 18, 17, PALETTE.ink, 'left', 800);
    text(ctx, o.sub, x + 40, yy + 38, 13, PALETTE.inkSoft, 'left', 600);
    button(ctx, G, x + w - 150, yy + 6, 126, 40, c.gold < o.cost ? '—' : 'Jalankan', { id: 'infil-act:' + o.action, disabled: c.gold < o.cost, teal: c.gold >= o.cost, size: 14 });
    yy += 60;
  }
  if (G.ui.discordTarget) {
    text(ctx, 'Adu domba dengan: ' + factionById(G.ui.discordTarget).name, x + 24, yy + 16, 15, PALETTE.ink, 'left', 700);
    yy += 30;
  }
  text(ctx, 'Adu domba — pilih faksi kedua:', x + 24, yy + 16, 15, PALETTE.ink, 'left', 700);
  let xx = x + 24;
  for (const o of FACTIONS) {
    if (o.id === 'arun' || o.id === fid) continue;
    if (!factionTerritories(c, o.id).length) continue;
    const sel = G.ui.discordTarget === o.id;
    button(ctx, G, xx, yy + 34, 170, 40, o.name, { id: 'discord-target:' + o.id, teal: sel, size: 13 });
    xx += 182;
  }
  button(ctx, G, x + 24, y + h - 64, 120, 44, '← Kembali', { id: 'back-diplo' });
  button(ctx, G, x + w - 124, y + h - 64, 100, 44, 'Tutup', { id: 'close' });
}

function drawRecruitPanel(ctx, G) {
  const c = G.campaign;
  const x = 190;
  const y = 120;
  const w = 900;
  const h = 420;
  panel(ctx, x, y, w, h);
  text(ctx, 'Rekrut Pasukan — ' + armySize(c) + '/' + GAME.ARMY_CAP + ' • Emas: ' + c.gold, x + 24, y + 34, 24, PALETTE.ink, 'left', 800);
  text(ctx, 'Pendekar > Penunggang > Pemanah > Pendekar — serang jenis yang dikalahkan counternya untuk damage 1.5x.', x + 24, y + 62, 14, PALETTE.inkSoft, 'left', 600);
  let xx = x + 24;
  for (const type of UNIT_ORDER) {
    const u = UNITS[type];
    const cost = recruitCost(c, type);
    ctx.fillStyle = PALETTE.paperDark;
    ctx.fillRect(xx, y + 84, 268, 220);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(xx, y + 84, 268, 220);
    drawSoldier(ctx, xx + 134, y + 150, type, u.color, u.dark, G.time * 4);
    text(ctx, u.name, xx + 134, y + 196, 22, PALETTE.ink, 'center', 800);
    text(ctx, 'HP ' + u.hp + ' • Dmg ' + u.dmg + ' • Jangkauan ' + u.range, xx + 134, y + 224, 14, PALETTE.inkSoft, 'center', 600);
    text(ctx, 'Kuat vs ' + UNITS[u.counter].name, xx + 134, y + 248, 14, '#15803d', 'center', 700);
    text(ctx, 'Dimiliki: ' + c.army[type], xx + 134, y + 272, 14, PALETTE.ink, 'center', 700);
    button(ctx, G, xx + 54, y + 84 + 220 - 52, 160, 42, 'Rekrut — ' + cost + ' emas', { id: 'recruit:' + type, disabled: c.gold < cost || armySize(c) >= GAME.ARMY_CAP, teal: true, size: 14 });
    xx += 284;
  }
  button(ctx, G, x + w - 124, y + h - 64, 100, 44, 'Tutup', { id: 'close' });
}

function drawEventPanel(ctx, G) {
  const ev = G.campaign.event;
  if (!ev) return;
  const x = 330;
  const y = 150;
  const w = 620;
  const h = 380;
  panel(ctx, x, y, w, h);
  text(ctx, 'PERISTIWA — ' + seasonLabel(G.campaign), x + 24, y + 30, 14, PALETTE.goldDark, 'left', 800);
  text(ctx, ev.title, x + 24, y + 62, 24, PALETTE.ink, 'left', 800);
  wrapText(ctx, ev.text, x + 24, y + 104, w - 48, 16, PALETTE.inkSoft, 22);
  let yy = y + 190;
  ev.choices.forEach((ch, i) => {
    ctx.fillStyle = PALETTE.paperDark;
    ctx.fillRect(x + 24, yy, w - 48, 54);
    text(ctx, (i + 1) + '. ' + ch.label, x + 40, yy + 18, 16, PALETTE.ink, 'left', 800);
    text(ctx, ch.sub, x + 40, yy + 38, 13, PALETTE.inkSoft, 'left', 600);
    hot(G, x + 24, yy, w - 48, 54, 'event-choice:' + i);
    yy += 64;
  });
}

function drawTraitPanel(ctx, G) {
  const c = G.campaign;
  if (!c.traitOffer) return;
  const x = 190;
  const y = 130;
  const w = 900;
  const h = 380;
  panel(ctx, x, y, w, h);
  text(ctx, 'NAIK LEVEL! — Level ' + c.level, x + 24, y + 34, 26, PALETTE.ink, 'left', 800);
  text(ctx, 'Wira Nusa tumbuh. Pilih 1 keahlian:', x + 24, y + 66, 16, PALETTE.inkSoft, 'left', 600);
  let xx = x + 24;
  c.traitOffer.forEach((tid, i) => {
    const t = traitById(tid);
    ctx.fillStyle = i === 1 ? '#fef3c7' : PALETTE.paperDark;
    ctx.fillRect(xx, y + 92, 268, 200);
    ctx.strokeStyle = PALETTE.goldDark;
    ctx.lineWidth = 3;
    ctx.strokeRect(xx, y + 92, 268, 200);
    text(ctx, '★', xx + 134, y + 140, 30, PALETTE.goldDark, 'center', 800);
    text(ctx, t.name, xx + 134, y + 184, 20, PALETTE.ink, 'center', 800);
    wrapText(ctx, t.desc, xx + 20, y + 214, 228, 15, PALETTE.inkSoft, 20, 'center');
    text(ctx, 'Tekan ' + (i + 1), xx + 134, y + 268, 13, PALETTE.inkSoft, 'center', 600);
    hot(G, xx, y + 92, 268, 200, 'trait-pick:' + tid);
    xx += 284;
  });
}

function drawHelpPanel(ctx, G) {
  const x = 300;
  const y = 90;
  const w = 680;
  const h = 520;
  panel(ctx, x, y, w, h);
  text(ctx, 'Nusa Raya — Panduan', x + 24, y + 34, 26, PALETTE.ink, 'left', 800);
  const lines = [
    ['TUJUAN', 'Satukan 5 pulau dalam 16 musim — lewat takluk atau aliansi. Ibu kota yang bersatu dihitung menang.'],
    ['PETA', 'Klik wilayah tetangga untuk bergerak (2 langkah/musim). Masuk wilayah musuh = bertempur. Kumpulkan upeti tiap musim. Pasukan yang tercerai-berai berkumpul kembali — minimal seperempat pasukanmu selamat dari tiap tempur.'],
    ['DIPLOMASI', 'Hadiah (+15 hubungan), Aliansi Pernikahan (butuh +40), Minta Upeti (kalau kamu lebih kuat), Damai, Perang.'],
    ['INFILTRASI', 'Mata-mata (ungkap pasukan), Sabotase (garnisun -30%), Adu Domba (dua faksi saling membenci).'],
    ['TEMPUR', 'WASD gerak, mouse arahkan, klik tebas, Spasi terompet perang (+morale). Moral 0 = pasukan kabur. Counter: Pendekar > Penunggang > Pemanah > Pendekar (damage 1.5x).'],
    ['HERO', 'XP dari tempur & diplomasi. Naik level = pilih 1 dari 3 keahlian. P jeda, M suara, Esc tutup panel.'],
  ];
  let yy = y + 72;
  for (const [head, body] of lines) {
    text(ctx, head, x + 24, yy, 15, PALETTE.goldDark, 'left', 800);
    wrapText(ctx, body, x + 24, yy + 20, w - 48, 14, PALETTE.ink, 19);
    yy += 62;
  }
  button(ctx, G, x + w - 124, y + h - 64, 100, 44, 'Tutup', { id: 'close' });
}

function wrapText(ctx, s, x, y, maxW, size, color, lineH, align) {
  ctx.font = '600 ' + size + 'px system-ui, sans-serif';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  const words = s.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

// --- Title / win / lose -------------------------------------------------------

function drawTitle(ctx, G) {
  const t = G.time;
  ctx.fillStyle = PALETTE.seaDeep;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.strokeStyle = 'rgba(34,165,184,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const y = 120 + i * 130;
    ctx.beginPath();
    for (let x = 0; x <= 1280; x += 16) {
      const yy = y + Math.sin(x * 0.012 + t * 1.3 + i * 2) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // A little marching vignette along the bottom.
  for (let i = 0; i < 8; i++) {
    const x = 180 + i * 130 + Math.sin(t * 1.5 + i) * 8;
    const type = UNIT_ORDER[i % 3];
    const u = UNITS[type];
    drawSoldier(ctx, x, 640, type, u.color, u.dark, t * 6 + i);
  }
  drawHero(ctx, 640, 620, -Math.PI / 2, Math.max(0, Math.sin(t * 2)) * 0.18, t * 6);
  ctx.fillStyle = 'rgba(11,30,38,0.35)';
  ctx.fillRect(0, 0, 1280, 720);
  textOutline(ctx, 'NUSA RAYA', 640, 150, 96, PALETTE.gold, 'center', 900);
  textOutline(ctx, 'Dari Nol Menjadi Pahlawan', 640, 222, 30, '#ffffff', 'center', 700);
  panel(ctx, 290, 260, 700, 150);
  text(ctx, 'TUJUAN — Satukan 5 pulau dalam 16 musim, lewat takluk atau aliansi.', 640, 292, 17, PALETTE.ink, 'center', 800);
  text(ctx, 'Peta: klik wilayah tetangga untuk bergerak • Rekrut • Kumpul upeti', 640, 322, 15, PALETTE.inkSoft, 'center', 600);
  text(ctx, 'Tempur: WASD gerak, klik tebas, Spasi terompet perang • Diplomasi: hadiah,', 640, 348, 15, PALETTE.inkSoft, 'center', 600);
  text(ctx, 'pernikahan, upeti, infiltrasi • Moral 0 = pasukan kabur', 640, 374, 15, PALETTE.inkSoft, 'center', 600);
  button(ctx, G, 490, 440, 300, 64, '▶  MULAI PETUALANGAN', { id: 'start', gold: true, size: 20 });
  text(ctx, 'Skor terbaik: ' + (G.best || 0) + '  •  Klik atau tekan Spasi untuk mulai', 640, 530, 15, '#e2e8f0', 'center', 600);
  text(ctx, 'Nusa Raya — dibuat untuk make.fun “Make the best game” • Semua gambar & suara dibuat dari kode', 640, 690, 13, '#94a3b8', 'center', 600);
}

function drawEndScreen(ctx, G, won) {
  const c = G.campaign;
  ctx.fillStyle = 'rgba(11,30,38,0.88)';
  ctx.fillRect(0, 0, 1280, 720);
  const title = won ? 'NUSA RAYA BERSATU' : 'KEPULAUAN JATUH';
  const sub = won
    ? 'Dari nol menjadi pahlawan — lima pulau bersatu di bawah panjimu.'
    : (G.loseReason || 'Enam belas musim berlalu tanpa penyatuan. Kepulauan tetap terpecah.');
  textOutline(ctx, title, 640, 150, 56, won ? PALETTE.gold : '#fca5a5', 'center', 900);
  text(ctx, sub, 640, 210, 18, '#e2e8f0', 'center', 600);
  panel(ctx, 390, 250, 500, 220);
  const rows = [
    ['Musim dimainkan', String(Math.min(c.season, GAME.MAX_SEASONS)) + ' / ' + GAME.MAX_SEASONS],
    ['Pertempuran dimenangkan', String(c.stats.battlesWon)],
    ['Musuh dikalahkan', String(c.stats.kills)],
    ['Emas dikumpulkan', String(c.stats.goldEarned)],
    ['Pulau bersatu', unitedCapitals(c) + ' / 5'],
  ];
  let yy = 282;
  for (const [k, v] of rows) {
    text(ctx, k, 420, yy, 16, PALETTE.inkSoft, 'left', 600);
    text(ctx, v, 860, yy, 16, PALETTE.ink, 'right', 800);
    yy += 32;
  }
  text(ctx, 'SKOR: ' + score(c) + (G.best ? '   •   Terbaik: ' + G.best : ''), 640, 440, 22, PALETTE.ink, 'center', 800);
  button(ctx, G, 440, 510, 180, 56, '↻  Main Lagi', { id: 'restart', gold: true, size: 18 });
  button(ctx, G, 660, 510, 180, 56, 'Judul', { id: 'to-title', size: 18 });
}

// --- Battle rendering ---------------------------------------------------------

function drawBattle(ctx, G) {
  const b = G.battle;
  const t = G.time;
  // Battle camera: 1.5x zoom following the hero (clamped to the field), so
  // the crush reads at a glance instead of as dots on an empty field.
  const S = 1.5;
  const vw = 1280 / S;
  const vh = 656 / S;
  const camX = Math.max(vw / 2, Math.min(1280 - vw / 2, b.hero.x));
  const camY = Math.max(64 + vh / 2, Math.min(720 - vh / 2, b.hero.y));
  G.battleCam = { x: camX, y: camY, s: S };
  ctx.save();
  if (b.shake > 0) ctx.translate((Math.random() - 0.5) * b.shake, (Math.random() - 0.5) * b.shake);
  ctx.translate(640, 392);
  ctx.scale(S, S);
  ctx.translate(-camX, -camY);
  ctx.fillStyle = '#6a9e4f';
  ctx.fillRect(0, 64, 1280, 656);
  ctx.fillStyle = '#5d8f45';
  for (let i = 0; i < 24; i++) {
    const px = (i * 173) % 1280;
    const py = 100 + ((i * 97) % 560);
    ctx.fillRect(px, py, 60 + (i % 3) * 30, 26);
  }
  // River band.
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(b.river.x0, 64, b.river.x1 - b.river.x0, 656);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = 120 + i * 120;
    ctx.beginPath();
    for (let x = b.river.x0; x <= b.river.x1; x += 8) {
      const yy = y + Math.sin(x * 0.2 + t * 2 + i) * 3;
      if (x === b.river.x0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  for (const tr of b.trees) drawTree(ctx, tr.x, tr.y, tr.r);
  // Deployment tint.
  ctx.fillStyle = 'rgba(45,212,191,0.07)';
  ctx.fillRect(180, 64, 200, 656);
  ctx.fillStyle = 'rgba(239,68,68,0.07)';
  ctx.fillRect(900, 64, 200, 656);

  for (const u of b.enemyUnits.concat(b.playerUnits)) {
    if (!u.alive) continue;
    const col = u.side === 'player' ? '#2dd4bf' : '#f87171';
    const udef = UNITS[u.type];
    drawSoldier(ctx, u.x, u.y, u.type, u.side === 'player' ? udef.color : '#b91c1c', udef.dark, t * 8 + u.x, u.champion);
    if (u.hitT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(u.x - 6, u.y - 12, 12, 14);
    }
    bar(ctx, u.x - 10, u.y - 20, 20, 4, u.hp / u.maxHp, u.side === 'player' ? PALETTE.teal : PALETTE.red, 'rgba(0,0,0,0.4)');
    if (u.champion) textOutline(ctx, u.name || 'JUARA', u.x, u.y + 30, 11, PALETTE.gold, 'center', 800);
  }
  const h = b.hero;
  if (h.hp > 0) {
    drawHero(ctx, h.x, h.y, h.angle, h.swingT, t * 8);
    bar(ctx, h.x - 16, h.y - 30, 32, 5, h.hp / h.maxHp, PALETTE.gold, 'rgba(0,0,0,0.4)');
    textOutline(ctx, 'WIRA NUSA', h.x, h.y - 40, 11, '#ffffff', 'center', 800);
  }
  for (const p of b.projectiles) {
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  for (const pt of b.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  for (const f of b.floats) {
    ctx.globalAlpha = Math.min(1, f.life / 0.9);
    textOutline(ctx, f.text, f.x, f.y, 14, f.color, 'center', 800);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Battle HUD.
  ctx.fillStyle = 'rgba(11,30,38,0.94)';
  ctx.fillRect(0, 0, 1280, 64);
  text(ctx, '⚔ ' + (b.attack ? 'Menyerang ' : 'Mempertahankan ') + territoryById(b.territoryId).name + ' — vs ' + b.enemyName, 20, 32, 17, '#ffffff', 'left', 800);
  text(ctx, 'Musuh: ' + unitCount(b, 'enemy') + '  •  Pasukanmu: ' + unitCount(b, 'player'), 640, 20, 14, '#e2e8f0', 'center', 600);
  text(ctx, 'Morale', 640, 46, 12, '#94a3b8', 'center', 700);
  bar(ctx, 480, 38, 140, 10, b.moraleP / 100, PALETTE.teal, 'rgba(255,255,255,0.15)');
  bar(ctx, 660, 38, 140, 10, b.moraleE / 100, PALETTE.red, 'rgba(255,255,255,0.15)');
  text(ctx, 'WASD gerak • Klik tebas • Spasi terompet', 1260, 32, 13, '#94a3b8', 'right', 600);
  // Hero status, bottom-left.
  panel(ctx, 16, 640, 300, 64, 'rgba(253,246,227,0.95)');
  text(ctx, 'WIRA NUSA  HP ' + Math.max(0, Math.ceil(h.hp)) + '/' + h.maxHp, 28, 662, 15, PALETTE.ink, 'left', 800);
  bar(ctx, 28, 674, 180, 10, Math.max(0, h.hp) / h.maxHp, PALETTE.gold, 'rgba(11,30,38,0.2)');
  text(ctx, h.hornCd > 0 ? 'Terompet: ' + h.hornCd.toFixed(1) + ' dtk' : 'Terompet SIAP [Spasi]', 220, 679, 13, h.hornCd > 0 ? '#94a3b8' : '#15803d', 'left', 700);

  if (b.result) {
    ctx.fillStyle = 'rgba(11,30,38,0.55)';
    ctx.fillRect(0, 64, 1280, 656);
    const won = b.result === 'win';
    textOutline(ctx, won ? 'MENANG!' : 'KALAH!', 640, 300, 64, won ? PALETTE.gold : '#fca5a5', 'center', 900);
    text(ctx, won ? 'Musuh kabur dari medan tempur. Wilayah ini milikmu.' : 'Pasukanmu tercerai-berai. Mundur dan kumpulkan kekuatan.', 640, 360, 18, '#ffffff', 'center', 600);
    if (b.resultT > 0.8) button(ctx, G, 550, 400, 180, 56, 'Lanjutkan ➜', { id: 'battle-continue', gold: true, size: 18 });
  }
  if (G.ui.paused) {
    ctx.fillStyle = 'rgba(11,30,38,0.6)';
    ctx.fillRect(0, 64, 1280, 656);
    textOutline(ctx, 'JEDA — tekan P untuk lanjut', 640, 360, 30, '#ffffff', 'center', 800);
  }
}

// --- Root dispatch --------------------------------------------------------------

function drawGame(ctx, G) {
  G.ui.hot = [];
  ctx.clearRect(0, 0, 1280, 720);
  if (G.mode === 'title') {
    drawTitle(ctx, G);
    return;
  }
  if (G.mode === 'win') {
    drawEndScreen(ctx, G, true);
    return;
  }
  if (G.mode === 'lose') {
    drawEndScreen(ctx, G, false);
    return;
  }
  if (G.mode === 'battle') {
    drawBattle(ctx, G);
    return;
  }
  // Campaign mode (overlays stack on top of the map).
  drawMap(ctx, G);
  drawHud(ctx, G);
  if (G.overlay === 'territory' && G.ui.selected) drawTerritoryPanel(ctx, G);
  else if (G.overlay === 'diplomacy') drawDiplomacyPanel(ctx, G);
  else if (G.overlay === 'infiltrate') drawInfiltratePanel(ctx, G);
  else if (G.overlay === 'recruit') drawRecruitPanel(ctx, G);
  else if (G.overlay === 'event') drawEventPanel(ctx, G);
  else if (G.overlay === 'trait') drawTraitPanel(ctx, G);
  else if (G.overlay === 'help') drawHelpPanel(ctx, G);
}
