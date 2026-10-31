// Logique pure du jeu Undercover (aucune dépendance au DOM).
// Utilisée par app.js dans le navigateur et par test/game.test.js sous Node.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.Game = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ROLES = { CIVIL: "civil", UNDERCOVER: "undercover", MRWHITE: "mrwhite" };
  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 10;

  // Répartition par défaut [undercover, mrWhite] selon le nombre de joueurs.
  const DEFAULT_ROLES = {
    3: [1, 0],
    4: [1, 0],
    5: [1, 1],
    6: [1, 1],
    7: [2, 1],
    8: [2, 1],
    9: [2, 1],
    10: [3, 1],
  };

  // Points attribués à l'équipe gagnante (comme l'app originale).
  const POINTS = { civil: 2, undercover: 10, mrwhite: 6 };

  function defaultRoles(n) {
    const d = DEFAULT_ROLES[n] || DEFAULT_ROLES[MAX_PLAYERS];
    return { undercover: d[0], mrWhite: d[1] };
  }

  // Les civils doivent toujours être strictement majoritaires au départ.
  function maxInfiltrators(n) {
    return Math.max(1, Math.floor((n - 1) / 2));
  }

  function validateRoles(n, undercover, mrWhite) {
    const errors = [];
    if (n < MIN_PLAYERS) errors.push(`Il faut au moins ${MIN_PLAYERS} joueurs.`);
    if (n > MAX_PLAYERS) errors.push(`Maximum ${MAX_PLAYERS} joueurs.`);
    if (undercover < 0 || mrWhite < 0) errors.push("Nombre de rôles invalide.");
    if (undercover + mrWhite < 1) errors.push("Il faut au moins un infiltré (Undercover ou Mr White).");
    if (undercover + mrWhite > maxInfiltrators(n))
      errors.push(`Avec ${n} joueurs, maximum ${maxInfiltrators(n)} infiltré(s).`);
    return errors;
  }

  function shuffle(arr, rng) {
    rng = rng || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Tire une paire en évitant celles récemment jouées.
  function pickPair(pairs, recentIds, rng) {
    rng = rng || Math.random;
    recentIds = recentIds || [];
    const recent = new Set(recentIds);
    let candidates = [];
    for (let i = 0; i < pairs.length; i++) if (!recent.has(i)) candidates.push(i);
    if (candidates.length === 0) candidates = pairs.map((_, i) => i);
    const id = candidates[Math.floor(rng() * candidates.length)];
    return { id, words: pairs[id] };
  }

  function normalizeWord(w) {
    return String(w || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // Distribue rôles et mots. players: [{id, name, color}]
  function deal(players, roles, pair, rng) {
    rng = rng || Math.random;
    const errs = validateRoles(players.length, roles.undercover, roles.mrWhite);
    if (errs.length) throw new Error(errs.join(" "));
    const civilFirst = rng() < 0.5;
    const civilWord = civilFirst ? pair.words[0] : pair.words[1];
    const underWord = civilFirst ? pair.words[1] : pair.words[0];

    const roleList = [];
    for (let i = 0; i < roles.undercover; i++) roleList.push(ROLES.UNDERCOVER);
    for (let i = 0; i < roles.mrWhite; i++) roleList.push(ROLES.MRWHITE);
    while (roleList.length < players.length) roleList.push(ROLES.CIVIL);
    const shuffled = shuffle(roleList, rng);

    return {
      civilWord,
      underWord,
      pairId: pair.id,
      players: players.map((p, i) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        role: shuffled[i],
        word: shuffled[i] === ROLES.CIVIL ? civilWord : shuffled[i] === ROLES.UNDERCOVER ? underWord : null,
        alive: true,
      })),
    };
  }

  // Ordre de parole : aléatoire parmi les vivants, Mr White jamais en premier.
  function speakingOrder(players, rng) {
    rng = rng || Math.random;
    const alive = players.filter((p) => p.alive);
    let order = shuffle(alive, rng);
    const firstOk = (o) => o.length === 0 || o[0].role !== ROLES.MRWHITE;
    if (!firstOk(order)) {
      const idx = order.findIndex((p) => p.role !== ROLES.MRWHITE);
      if (idx > 0) [order[0], order[idx]] = [order[idx], order[0]];
    }
    return order.map((p) => p.id);
  }

  function counts(players) {
    const c = { civil: 0, undercover: 0, mrwhite: 0, alive: 0 };
    for (const p of players) {
      if (!p.alive) continue;
      c[p.role]++;
      c.alive++;
    }
    c.infiltrators = c.undercover + c.mrwhite;
    return c;
  }

  // Retourne null si la partie continue, sinon {winner, reason}.
  // winner ∈ 'civils' | 'infiltrators'
  function checkWin(players) {
    const c = counts(players);
    if (c.infiltrators === 0) return { winner: "civils", reason: "Tous les infiltrés ont été éliminés." };
    if (c.civil <= c.infiltrators)
      return { winner: "infiltrators", reason: "Les infiltrés sont aussi nombreux que les civils." };
    return null;
  }

  function eliminate(players, playerId) {
    return players.map((p) => (p.id === playerId ? Object.assign({}, p, { alive: false }) : p));
  }

  function mrWhiteGuessCorrect(guess, civilWord) {
    return normalizeWord(guess) === normalizeWord(civilWord);
  }

  // Calcule les points de fin de partie. winner: 'civils' | 'infiltrators' | 'mrwhite'
  function scoreGame(players, winner) {
    const result = {};
    for (const p of players) {
      let pts = 0;
      if (winner === "civils" && p.role === ROLES.CIVIL) pts = POINTS.civil;
      if (winner === "infiltrators" && p.role === ROLES.UNDERCOVER) pts = POINTS.undercover;
      if (winner === "infiltrators" && p.role === ROLES.MRWHITE) pts = POINTS.mrwhite;
      if (winner === "mrwhite" && p.role === ROLES.MRWHITE) pts = POINTS.mrwhite;
      result[p.id] = pts;
    }
    return result;
  }

  function roleLabel(role) {
    return role === ROLES.CIVIL ? "Civil" : role === ROLES.UNDERCOVER ? "Undercover" : "Mr White";
  }

  return {
    ROLES,
    MIN_PLAYERS,
    MAX_PLAYERS,
    POINTS,
    defaultRoles,
    maxInfiltrators,
    validateRoles,
    shuffle,
    pickPair,
    normalizeWord,
    deal,
    speakingOrder,
    counts,
    checkWin,
    eliminate,
    mrWhiteGuessCorrect,
    scoreGame,
    roleLabel,
  };
});
