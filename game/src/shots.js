// Nusa Raya — screenshot staging: deterministic scenes for ?shot=title|map|
// battle|win&seed=N. Each scene is built from the real game state (a real
// campaign, a real battle simulated by an autopilot), never drawn by hand, so
// the screenshots are honest renders of the game's own code. When the scene
// is staged, main.js raises window.__shotReady after the first frame.

function stageCampaign(seed, season, setup) {
  const c = newCampaign(seed);
  c.season = season;
  if (setup) setup(c);
  return c;
}

function applyShot(G, shot, seed) {
  G.shot = { name: shot, seed };
  if (shot === 'title') {
    G.mode = 'title';
    G.time = 2.5;
    return;
  }

  if (shot === 'map') {
    const c = stageCampaign(seed, 4, (cc) => {
      cc.gold = 120;
      cc.army = { pendekar: 10, pemanah: 5, penunggang: 3 };
      cc.armyAt = 'nelayan';
      cc.heroHp = heroStats(cc).hp;
      cc.territories.nelayan.owner = 'arun';
      cc.territories.nelayan.garrison = 4;
      cc.territories.garam.owner = 'arun';
      cc.territories.garam.garrison = 4;
      cc.relations = { samudra: 55, gading: -20, rimba: 15, karang: -60 };
      cc.atWar = { karang: true };
      cc.known = { samudra: { army: 22, power: 40 } };
      cc.stats = { battlesWon: 3, battlesLost: 1, goldEarned: 410, kills: 34, diplo: 4 };
      addLog(cc, 'Istana Gading direbut! Rampasan +50 emas.', 'good');
      addLog(cc, 'Kekaisaran Batu Karang menyatakan perang!', 'bad');
      addLog(cc, 'Upeti musim ini: +65 emas.', 'good');
    });
    G.campaign = c;
    G.mode = 'campaign';
    G.overlay = 'diplomacy';
    G.ui.diploFid = null;
    G.time = 6;
    return;
  }

  if (shot === 'battle') {
    const c = stageCampaign(seed, 3, (cc) => {
      cc.gold = 90;
      cc.army = { pendekar: 8, pemanah: 4, penunggang: 3 };
      cc.armyAt = 'gading';
      cc.heroHp = heroStats(cc).hp;
      cc.stats = { battlesWon: 2, battlesLost: 0, goldEarned: 260, kills: 21, diplo: 2 };
    });
    G.campaign = c;
    const opts = battleOptsForTerritory(c, 'gading');
    const b = startBattle(c, opts);
    G.battle = b;
    G.mode = 'battle';
    // Autopilot the hero for 8 seconds (shared heroPilot: stay with the
    // army, slash in range, fall back when wounded, horn once). The frame
    // caught is a mid-battle crush.
    let hornDone = false;
    for (let step = 0; step < 8 * 60; step++) {
      const dt = 1 / 60;
      const pilot = heroPilot(b);
      let horn = false;
      if (!hornDone && b.t > 6) { horn = true; hornDone = true; }
      const res = updateBattle(b, dt, { mx: pilot.mx, my: pilot.my, aimX: pilot.aimX, aimY: pilot.aimY, swing: pilot.swing, horn }, c);
      if (res) break;
    }
    G.time = 8;
    return;
  }

  if (shot === 'win') {
    const c = stageCampaign(seed, 9, (cc) => {
      cc.gold = 210;
      cc.army = { pendekar: 12, pemanah: 8, penunggang: 6 };
      cc.heroHp = heroStats(cc).hp;
      cc.traits = ['pusaka', 'panglima', 'diplomat'];
      cc.level = 4;
      cc.xp = 520;
      // Three capitals conquered, two allied: the archipelago is united.
      for (const tid of ['gading', 'gajah', 'karang', 'bara', 'tambang']) {
        cc.territories[tid].owner = 'arun';
        cc.territories[tid].garrison = 4;
      }
      cc.allies = { samudra: true, rimba: true };
      cc.relations = { samudra: 80, rimba: 70 };
      cc.stats = { battlesWon: 7, battlesLost: 1, goldEarned: 1240, kills: 86, diplo: 9 };
    });
    G.campaign = c;
    G.mode = 'win';
    G.best = score(c);
    G.time = 2;
    return;
  }

  // Unknown shot: fall back to the title screen.
  G.mode = 'title';
}
