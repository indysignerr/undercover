const assert = require("assert");
const Game = require("../js/game.js");
const { WORD_PAIRS } = require("../js/words.js");

// Générateur pseudo-aléatoire déterministe pour des tests reproductibles.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: "p" + i, name: "J" + i, color: 0 }));

// --- Bibliothèque de mots ---
{
  const norm = Game.normalizeWord;
  const seen = new Set();
  for (const pair of WORD_PAIRS) {
    assert.strictEqual(pair.length, 2, "chaque entrée est une paire");
    for (const w of pair) {
      assert.ok(w && w.trim().length > 0, "mot vide");
      assert.ok(!seen.has(norm(w)), "mot en double : " + w);
      seen.add(norm(w));
    }
    assert.notStrictEqual(norm(pair[0]), norm(pair[1]), "paire identique : " + pair[0]);
  }
  assert.ok(WORD_PAIRS.length >= 500, "au moins 500 paires");
  assert.ok(seen.size >= 1000, "au moins 1000 mots distincts");
  console.log(`✓ bibliothèque : ${WORD_PAIRS.length} paires, ${seen.size} mots uniques`);
}

// --- Répartition par défaut 3..10 ---
for (let n = 3; n <= 10; n++) {
  const r = Game.defaultRoles(n);
  assert.deepStrictEqual(Game.validateRoles(n, r.undercover, r.mrWhite), [], "défaut invalide pour " + n);
  assert.ok(r.undercover + r.mrWhite < n - (r.undercover + r.mrWhite), "civils majoritaires pour " + n);
}
assert.deepStrictEqual(Game.defaultRoles(5), { undercover: 1, mrWhite: 1 });
assert.deepStrictEqual(Game.defaultRoles(10), { undercover: 3, mrWhite: 1 });
assert.ok(Game.validateRoles(2, 1, 0).length > 0, "2 joueurs refusé");
assert.ok(Game.validateRoles(11, 1, 0).length > 0, "11 joueurs refusé");
assert.ok(Game.validateRoles(4, 0, 0).length > 0, "aucun infiltré refusé");
assert.ok(Game.validateRoles(4, 2, 0).length > 0, "4 joueurs / 2 infiltrés refusé");
assert.strictEqual(Game.maxInfiltrators(10), 4);
assert.strictEqual(Game.maxInfiltrators(3), 1);
console.log("✓ répartition des rôles");

// --- Distribution ---
{
  const rng = lcg(42);
  const pair = Game.pickPair(WORD_PAIRS, [], rng);
  const d = Game.deal(mk(10), { undercover: 3, mrWhite: 1 }, pair, rng);
  const c = Game.counts(d.players);
  assert.deepStrictEqual([c.civil, c.undercover, c.mrwhite], [6, 3, 1]);
  for (const p of d.players) {
    if (p.role === "civil") assert.strictEqual(p.word, d.civilWord);
    if (p.role === "undercover") assert.strictEqual(p.word, d.underWord);
    if (p.role === "mrwhite") assert.strictEqual(p.word, null);
  }
  assert.ok(pair.words.includes(d.civilWord) && pair.words.includes(d.underWord));
  assert.notStrictEqual(d.civilWord, d.underWord);
  // pickPair évite les paires récentes
  const recent = WORD_PAIRS.map((_, i) => i).filter((i) => i !== 7);
  assert.strictEqual(Game.pickPair(WORD_PAIRS, recent, rng).id, 7);
  console.log("✓ distribution des mots");
}

// --- Ordre de parole : Mr White jamais premier ---
{
  for (let seed = 1; seed < 300; seed++) {
    const rng = lcg(seed);
    const d = Game.deal(mk(5), { undercover: 1, mrWhite: 1 }, { id: 0, words: ["a", "b"] }, rng);
    const order = Game.speakingOrder(d.players, rng);
    assert.strictEqual(order.length, 5);
    const first = d.players.find((p) => p.id === order[0]);
    assert.notStrictEqual(first.role, "mrwhite", "Mr White a parlé en premier");
  }
  console.log("✓ ordre de parole");
}

// --- Conditions de victoire ---
{
  const rng = lcg(7);
  let d = Game.deal(mk(5), { undercover: 1, mrWhite: 1 }, { id: 0, words: ["a", "b"] }, rng);
  let players = d.players;
  assert.strictEqual(Game.checkWin(players), null);
  const uc = players.find((p) => p.role === "undercover");
  const mw = players.find((p) => p.role === "mrwhite");
  const civils = players.filter((p) => p.role === "civil");
  players = Game.eliminate(players, uc.id);
  assert.strictEqual(Game.checkWin(players), null, "Mr White encore en vie");
  players = Game.eliminate(players, mw.id);
  assert.strictEqual(Game.checkWin(players).winner, "civils");

  players = Game.eliminate(d.players, civils[0].id);
  assert.strictEqual(Game.checkWin(players).winner, "infiltrators", "2 civils vs 2 infiltrés");
}
{
  // 3 civils, 1 UC, 1 MW : éliminer un civil => 2 civils vs 2 infiltrés => infiltrés gagnent
  const players = [
    { id: "a", role: "civil", alive: true },
    { id: "b", role: "civil", alive: true },
    { id: "c", role: "civil", alive: true },
    { id: "d", role: "undercover", alive: true },
    { id: "e", role: "mrwhite", alive: true },
  ];
  assert.strictEqual(Game.checkWin(players), null);
  assert.strictEqual(Game.checkWin(Game.eliminate(players, "a")).winner, "infiltrators");
  assert.strictEqual(Game.checkWin(Game.eliminate(Game.eliminate(players, "d"), "e")).winner, "civils");
  console.log("✓ conditions de victoire");
}

// --- Mr White devine ---
assert.ok(Game.mrWhiteGuessCorrect("  pain au CHOCOLAT ", "Pain au chocolat"));
assert.ok(Game.mrWhiteGuessCorrect("Eclair", "Éclair"));
assert.ok(!Game.mrWhiteGuessCorrect("Pizza", "Burger"));
console.log("✓ devinette de Mr White");

// --- Scores ---
{
  const players = [
    { id: "a", role: "civil" },
    { id: "b", role: "undercover" },
    { id: "c", role: "mrwhite" },
  ];
  assert.deepStrictEqual(Game.scoreGame(players, "civils"), { a: 2, b: 0, c: 0 });
  assert.deepStrictEqual(Game.scoreGame(players, "infiltrators"), { a: 0, b: 10, c: 6 });
  assert.deepStrictEqual(Game.scoreGame(players, "mrwhite"), { a: 0, b: 0, c: 6 });
  console.log("✓ scores");
}

console.log("\nTous les tests passent.");
