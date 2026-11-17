// Nusa Raya — design data: every number, name and rule the game runs on.
// The campaign is a turn-per-season map game; battles are real-time top-down.
// Nothing here is read from the network; the seeded RNG in random.js makes a
// given seed play the same campaign every time, so screenshots are repeatable.

const GAME = {
  W: 1280,
  H: 720,
  MAX_SEASONS: 16,
  ARMY_CAP: 30,
  START_GOLD: 60,
  START_UNITS: 8,
  SEASON_NAMES: ['Semi', 'Panas', 'Hujan', 'Panen'],
  HERO: { hp: 220, dmg: 12, speed: 115, swingRange: 52, swingArc: 1.9, hornCooldown: 8 },
};

const PALETTE = {
  seaDeep: '#0b5563',
  sea: '#0e7490',
  seaLight: '#22a5b8',
  sand: '#e7c87a',
  sandDark: '#d4af5f',
  grass: '#5da24a',
  jungle: '#2f7a3d',
  rock: '#8a7a63',
  rockDark: '#6b5d4b',
  gold: '#fbbf24',
  goldDark: '#d97706',
  ink: '#1e293b',
  inkSoft: '#334155',
  paper: '#fdf6e3',
  paperDark: '#f3e6c8',
  red: '#ef4444',
  redDark: '#b91c1c',
  teal: '#2dd4bf',
  tealDark: '#0f766e',
  blue: '#38bdf8',
  green: '#4ade80',
  white: '#ffffff',
};

// Five rulers of the archipelago. The player is Wira Nusa of Arun; the other
// four are AI factions with a personality that steers what they do each season.
const FACTIONS = [
  { id: 'arun', name: 'Kadipaten Arun', ruler: 'Wira Nusa', title: 'Komandan', color: '#2dd4bf', dark: '#0f766e', light: '#99f6e4', personality: 'player', blurb: 'Komandan tanpa tanah. Delapan pengikut, satu pedang.' },
  { id: 'samudra', name: 'Kesultanan Samudra Biru', ruler: 'Sultan Bahari', title: 'Sultan', color: '#38bdf8', dark: '#0369a1', light: '#bae6fd', personality: 'merchant', blurb: 'Pedagang kaya. Lebih suka emas daripada perang.' },
  { id: 'gading', name: 'Kerajaan Gading', ruler: 'Raja Gading', title: 'Raja', color: '#fbbf24', dark: '#b45309', light: '#fde68a', personality: 'proud', blurb: 'Bangga dan mudah tersinggung. Hormat dibalas hormat.' },
  { id: 'rimba', name: 'Kadipaten Rimba', ruler: 'Ratu Rimba', title: 'Ratu', color: '#4ade80', dark: '#15803d', light: '#bbf7d0', personality: 'defensive', blurb: 'Penjaga hutan. Jarang menyerang, sulit ditaklukkan.' },
  { id: 'karang', name: 'Kekaisaran Batu Karang', ruler: 'Kaisar Karang', title: 'Kaisar', color: '#f87171', dark: '#991b1b', light: '#fecaca', personality: 'warlike', blurb: 'Panglima perang. Mengincar pulau yang paling lemah.' },
];

function factionById(id) {
  for (const f of FACTIONS) if (f.id === id) return f;
  return null;
}

// Thirteen territories on five islands. x/y are canvas pixels on the 1280x720
// map; neighbours form the movement graph (one move per season).
const TERRITORIES = [
  { id: 'arun-kota', name: 'Kota Arun', x: 300, y: 330, kind: 'capital', owner: 'arun', garrison: 8, neighbours: ['padi', 'garam', 'nelayan', 'rimba-kota'] },
  { id: 'padi', name: 'Desa Padi', x: 205, y: 245, kind: 'village', owner: 'arun', garrison: 4, neighbours: ['arun-kota', 'nelayan'] },
  { id: 'garam', name: 'Desa Garam', x: 365, y: 440, kind: 'village', owner: 'arun', garrison: 4, neighbours: ['arun-kota', 'rimba-kota', 'bara'] },
  { id: 'biru', name: 'Pelabuhan Biru', x: 640, y: 150, kind: 'capital', owner: 'samudra', garrison: 20, neighbours: ['nelayan', 'karang-kecil', 'gajah'] },
  { id: 'nelayan', name: 'Desa Nelayan', x: 520, y: 215, kind: 'village', owner: 'samudra', garrison: 8, neighbours: ['biru', 'arun-kota', 'padi', 'karang-kecil'] },
  { id: 'karang-kecil', name: 'Pulau Karang', x: 795, y: 185, kind: 'village', owner: 'samudra', garrison: 8, neighbours: ['biru', 'nelayan', 'gajah'] },
  { id: 'gading', name: 'Istana Gading', x: 1025, y: 300, kind: 'capital', owner: 'gading', garrison: 20, neighbours: ['gajah', 'karang-kecil', 'bara'] },
  { id: 'gajah', name: 'Desa Gajah', x: 935, y: 405, kind: 'village', owner: 'gading', garrison: 8, neighbours: ['gading', 'karang-kecil', 'bara'] },
  { id: 'rimba-kota', name: 'Kota Rimba', x: 430, y: 545, kind: 'capital', owner: 'rimba', garrison: 20, neighbours: ['garam', 'arun-kota', 'rotan', 'bara'] },
  { id: 'rotan', name: 'Desa Rotan', x: 565, y: 560, kind: 'village', owner: 'rimba', garrison: 8, neighbours: ['rimba-kota', 'bara', 'tambang'] },
  { id: 'karang', name: 'Benteng Karang', x: 950, y: 545, kind: 'capital', owner: 'karang', garrison: 22, neighbours: ['bara', 'tambang', 'gajah'] },
  { id: 'bara', name: 'Desa Bara', x: 845, y: 470, kind: 'village', owner: 'karang', garrison: 8, neighbours: ['karang', 'gajah', 'rimba-kota', 'rotan', 'garam'] },
  { id: 'tambang', name: 'Tambang Batu', x: 1045, y: 590, kind: 'village', owner: 'karang', garrison: 8, neighbours: ['karang', 'rotan'] },
];

function territoryById(id) {
  for (const t of TERRITORIES) if (t.id === id) return t;
  return null;
}

// Three troop types in a counter triangle: swordsmen beat cavalry (spears),
// archers beat swordsmen (range), cavalry beat archers (charge). The bonus is
// a x1.5 damage multiplier against the countered type, shown on the recruit panel.
const UNITS = {
  pendekar: { name: 'Pendekar', plural: 'Pendekar', hp: 38, dmg: 9, speed: 52, range: 16, attackEvery: 0.9, cost: 15, counter: 'penunggang', color: '#fbbf24', dark: '#92400e' },
  pemanah: { name: 'Pemanah', plural: 'Pemanah', hp: 24, dmg: 7, speed: 48, range: 130, attackEvery: 1.2, cost: 20, counter: 'pendekar', color: '#4ade80', dark: '#14532d' },
  penunggang: { name: 'Penunggang', plural: 'Penunggang', hp: 46, dmg: 11, speed: 96, range: 18, attackEvery: 1.0, cost: 30, counter: 'pemanah', color: '#f87171', dark: '#7f1d1d' },
};
const UNIT_ORDER = ['pendekar', 'pemanah', 'penunggang'];

// Hero traits: on every level-up the player picks 1 of 3. fx keys are read by
// campaign.js (economy/diplomacy) and battle.js (combat).
const TRAITS = [
  { id: 'pusaka', name: 'Pedang Pusaka', desc: 'Hero +30% damage', fx: { heroDmg: 0.30 } },
  { id: 'panglima', name: 'Panglima Perang', desc: 'Morale pasukan +20 di awal tempur', fx: { morale: 20 } },
  { id: 'diplomat', name: 'Diplomat Ulung', desc: 'Diplomasi +20', fx: { diplomacy: 20 } },
  { id: 'bayangan', name: 'Bayangan', desc: 'Infiltrasi +25', fx: { intrigue: 25 } },
  { id: 'tabib', name: 'Tabib Perang', desc: 'Hero pulih 40 HP usai tiap tempur', fx: { healAfter: 40 } },
  { id: 'kuda', name: 'Penunggang Ulung', desc: 'Kavaleri +25% damage', fx: { cavDmg: 0.25 } },
  { id: 'panah', name: 'Pemanah Jitu', desc: 'Pemanah +25% jangkauan, +15% damage', fx: { archRange: 0.25, archDmg: 0.15 } },
  { id: 'tembok', name: 'Tembok Hidup', desc: 'Pendekar +30% HP', fx: { swordHp: 0.30 } },
  { id: 'kharisma', name: 'Kharisma', desc: 'Biaya rekrut -25%', fx: { recruitCost: 0.25 } },
  { id: 'taktisi', name: 'Taktisi', desc: 'Morale musuh -10 di awal tempur', fx: { enemyMorale: -10 } },
  { id: 'harta', name: 'Pemburu Harta', desc: 'Upeti +30%', fx: { tribute: 0.30 } },
  { id: 'berani', name: 'Pemberani', desc: 'Hero +50 max HP', fx: { heroHp: 50 } },
];

function traitById(id) {
  for (const t of TRAITS) if (t.id === id) return t;
  return null;
}

// Diplomacy and infiltration: costs in gold, and what each action does.
// Success chances are computed in campaign.js from the hero's stats and the
// current relation (-100..100).
const DIPLOMACY = {
  giftCost: 40, giftRel: 15,
  marriageCost: 80, marriageRelReq: 40,
  tributeBase: 50,
  peaceRelReq: -20,
  spyCost: 20, spyChance: 70,
  sabotageCost: 30, sabotageChance: 45, sabotageCut: 0.30,
  discordCost: 50, discordChance: 50, discordCut: 30,
};

// One event fires each season (seeded deck, no repeats until the deck runs out).
// effect keys: gold, rel {fid,d}, relAll, addUnits, war fid, ally fid, trait
// (random unowned), garrison {fid,d}, xp. Choices with a `gamble` flag resolve
// 50/50 on the seeded RNG.
const EVENTS = [
  { id: 'lamaran', title: 'Lamaran dari Samudra', text: 'Sultan Bahari menawarkan putrinya untuk dinikahkan denganmu. Pernikahan ini akan mengikat dua pulau dalam satu darah.',
    choices: [
      { label: 'Terima lamaran', sub: 'Aliansi dengan Samudra Biru', effect: { ally: 'samudra', rel: { fid: 'samudra', d: 20 } } },
      { label: 'Tolak dengan halus', sub: 'Hubungan -10', effect: { rel: { fid: 'samudra', d: -10 } } },
      { label: 'Minta mas kawin', sub: '+40 emas, hubungan -5', effect: { gold: 40, rel: { fid: 'samudra', d: -5 } } },
    ] },
  { id: 'bajak', title: 'Bajak Laut di Desa Garam', text: 'Perahu-perahu hitam merapat ke Desa Garam. Mereka menuntut upeti — atau darah.',
    choices: [
      { label: 'Bayar 30 emas', sub: 'Mereka pergi dengan tenang', effect: { gold: -30 } },
      { label: 'Usir dengan pedang', sub: 'Tempur kecil di pantai', effect: { battle: 'pirates' } },
      { label: 'Abaikan', sub: '-20 emas, desa ketakutan', effect: { gold: -20 } },
    ] },
  { id: 'panen', title: 'Panen Raya', text: 'Padi menguning di semua desa. Lumbung penuh, rakyat bersorak, dan upeti mengalir deras.',
    choices: [
      { label: 'Syukuri panen', sub: '+40 emas', effect: { gold: 40 } },
      { label: 'Bagikan ke rakyat', sub: '+15 hubungan semua faksi', effect: { relAll: 15, gold: 10 } },
    ] },
  { id: 'khianat', title: 'Pengkhianatan di Balik Layar', text: 'Seorang utusan membisikkan kabar busuk: ada yang menghasut sekutumu — atau merencanakan pengkhianatan.',
    choices: [
      { label: 'Selidiki', sub: '+15 XP, kebenaran terungkap', effect: { xp: 15 } },
      { label: 'Abaikan bisikan', sub: 'Hubungan dengan Karang -15', effect: { rel: { fid: 'karang', d: -15 } } },
    ] },
  { id: 'pedagang', title: 'Pedagang Keliling', text: 'Seorang pedagang tua membuka dagangannya di pasar: keris berukir, perisai, dan tawaran pasukan bayaran.',
    choices: [
      { label: 'Beli keris pusaka (50 emas)', sub: 'Dapat 1 trait acak', effect: { gold: -50, trait: true } },
      { label: 'Sewa 3 pasukan (40 emas)', sub: '+3 pendekar', effect: { gold: -40, addUnits: 3 } },
      { label: 'Usir pedagang', sub: 'Tidak terjadi apa-apa', effect: {} },
    ] },
  { id: 'wabah', title: 'Wabah di Desa', text: 'Demam melanda Desa Padi. Tabib meminta emas untuk ramuan — atau desa akan kehilangan orang.',
    choices: [
      { label: 'Bayar tabib (25 emas)', sub: 'Wabah reda', effect: { gold: -25 } },
      { label: 'Abaikan', sub: '-2 pasukan', effect: { addUnits: -2 } },
    ] },
  { id: 'utusan', title: 'Utusan Gading', text: 'Raja Gading mengirim utusan dengan proposal dagang: rempah ditukar gading, untung untuk kedua belah pihak.',
    choices: [
      { label: 'Terima dagang', sub: '+30 emas, hubungan +10', effect: { gold: 30, rel: { fid: 'gading', d: 10 } } },
      { label: 'Tolak', sub: 'Hubungan -10', effect: { rel: { fid: 'gading', d: -10 } } },
    ] },
  { id: 'pusaka', title: 'Keris Pusaka Ditemukan', text: 'Di reruntuhan candi tua, penggalimu menemukan keris berukir naga. Bilahnya masih dingin seperti baru ditempa.',
    choices: [
      { label: 'Ambil kerisnya', sub: 'Dapat trait Pedang Pusaka', effect: { traitId: 'pusaka' } },
      { label: 'Jual ke kolektor', sub: '+50 emas', effect: { gold: 50 } },
    ] },
  { id: 'badai', title: 'Badai Besar', text: 'Langit menghitam di atas selat. Nakhoda menanti perintahmu: berlindung, atau berlayar menembus badai.',
    choices: [
      { label: 'Berlindung di teluk', sub: '-10 emas', effect: { gold: -10 } },
      { label: 'Berlayar nekat', sub: 'Untung-untungan: +30 emas atau -2 pasukan', effect: { gamble: { win: { gold: 30 }, lose: { addUnits: -2 } } } },
    ] },
  { id: 'pemberontak', title: 'Pemberontak Rimba', text: 'Sekelompok pemberontak mengacau di hutan Rimba. Ratu Rimba meminta bantuanmu — atau setidaknya, sikapmu.',
    choices: [
      { label: 'Bantu Ratu Rimba', sub: 'Hubungan +20, +15 XP', effect: { rel: { fid: 'rimba', d: 20 }, xp: 15 } },
      { label: 'Biarkan saja', sub: 'Hubungan -10', effect: { rel: { fid: 'rimba', d: -10 } } },
    ] },
  { id: 'festival', title: 'Festival Panen', text: 'Gamelan berbunyi di alun-alun. Rakyat meminta pesta — dan para utusan asing ikut menonton.',
    choices: [
      { label: 'Adakan pesta (20 emas)', sub: '+10 hubungan semua faksi', effect: { gold: -20, relAll: 10 } },
      { label: 'Lewati festival', sub: 'Tidak terjadi apa-apa', effect: {} },
    ] },
  { id: 'mata-mata', title: 'Mata-mata Tertangkap', text: 'Prajuritmu menangkap mata-mata Karang di perkemahan. Ia membawa peta pertahananmu — dan tawaran damai dari Kaisar.',
    choices: [
      { label: 'Ampuni dan bebaskan', sub: '+10 hubungan, +20 emas', effect: { rel: { fid: 'karang', d: 10 }, gold: 20 } },
      { label: 'Hukum di alun-alun', sub: 'Hubungan -20, garnisun Karang -3', effect: { rel: { fid: 'karang', d: -20 }, garrison: { fid: 'karang', d: -3 } } },
    ] },
];

// Level thresholds: XP needed to reach each level (level 1 is the start).
const LEVEL_XP = [0, 100, 250, 450, 700, 1000];
