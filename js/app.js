/* Undercover – interface (un seul téléphone qu'on se passe). */
(function () {
  "use strict";

  const STORAGE_KEY = "undercover.v1";
  const COLORS = ["#6fdc8c", "#5ee0e0", "#f7b84b", "#f26d85", "#8f7bff", "#ff8a5c", "#4dc3ff", "#d7ff5c", "#ff5ca8", "#c9a7ff"];
  const RECENT_PAIRS_MAX = 100;

  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const initial = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";
  const vibrate = (p) => {
    if (state.settings.vibrate && navigator.vibrate) {
      try { navigator.vibrate(p); } catch (e) { /* ignore */ }
    }
  };

  // ------------------------------------------------------------------ état
  function defaultState() {
    return {
      screen: "home",
      roster: [
        { id: uid(), name: "Joueur 1", color: 0 },
        { id: uid(), name: "Joueur 2", color: 1 },
        { id: uid(), name: "Joueur 3", color: 2 },
      ],
      roles: Object.assign({}, Game.defaultRoles(3)),
      settings: { mrWhiteGuess: true, vibrate: true },
      game: null,
      scores: {},
      recentPairs: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.roster)) return null;
      const d = defaultState();
      s.settings = Object.assign(d.settings, s.settings || {});
      s.scores = s.scores || {};
      s.recentPairs = s.recentPairs || [];
      if (!s.roles) s.roles = Game.defaultRoles(s.roster.length);
      if (s.game && !["reveal", "describe", "vote", "eliminated", "end"].includes(s.game.phase)) s.game = null;
      if (s.game) s.screen = s.game.phase;
      else if (!["home", "setup", "scores"].includes(s.screen)) s.screen = "home";
      return s;
    } catch (e) {
      return null;
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* stockage indisponible */ }
  }

  let state = load() || defaultState();

  // ------------------------------------------------------------------ rendu
  function render() {
    const screens = { home, setup, reveal, describe, vote, eliminated, end, scores };
    const fn = screens[state.screen] || home;
    app.innerHTML = fn();
    window.scrollTo(0, 0);
    save();
  }

  function spy(kind, cls) {
    return `<svg class="spy ${kind} ${cls || ""}"><use href="#i-spy"/></svg>`;
  }
  function icon(name, cls) {
    return `<svg class="${cls || ""}"><use href="#i-${name}"/></svg>`;
  }
  function avatar(p, extra, size) {
    return `<div class="avatar ${size || ""}" style="background:${COLORS[p.color % COLORS.length]}">${esc(initial(p.name))}${extra || ""}</div>`;
  }
  function hero(title, text, opts) {
    opts = opts || {};
    return `
      <header class="hero ${opts.compact ? "compact" : ""}">
        <div class="top-row">
          ${opts.back ? `<button class="icon-btn" data-action="${opts.back}" aria-label="Retour">${icon("exit")}</button>` : "<span></span>"}
          <span></span>
        </div>
        <h1>${title}</h1>
        ${text ? `<p>${text}</p>` : ""}
        ${opts.help !== false ? `<button class="icon-btn help help-float" data-action="rules" aria-label="Règles">?</button>` : ""}
      </header>`;
  }

  // ---- Accueil
  function home() {
    const inProgress = !!state.game && state.game.phase !== "end";
    return `
      <section class="screen">
        <div class="content center">
          <div class="home-logo">
            <div class="mark">${spy("white")}${spy("black")}</div>
            <h1>UNDERCOVER</h1>
            <p>Trouve l'infiltré… ou fais semblant.</p>
          </div>
          <div class="stack" style="max-width:340px">
            ${inProgress ? `<button class="btn block green" data-action="resume">Reprendre la partie</button>` : ""}
            <button class="btn block" data-action="goSetup">${inProgress ? "Nouvelle partie" : "Jouer"}</button>
            <button class="btn block secondary" data-action="goScores">Scores</button>
            <button class="btn block secondary" data-action="rules">Règles du jeu</button>
          </div>
          <p class="footnote">${WORD_PAIRS.length} paires de mots · ${WORD_PAIRS.length * 2} mots · 3 à 10 joueurs · hors ligne</p>
        </div>
      </section>`;
  }

  // ---- Configuration des joueurs et des rôles
  function setup() {
    const n = state.roster.length;
    const r = state.roles;
    const errors = Game.validateRoles(n, r.undercover, r.mrWhite);
    const max = Game.maxInfiltrators(n);
    return `
      <section class="screen">
        ${hero("Joueurs", `${n} joueur${n > 1 ? "s" : ""} · choisis les rôles`, { back: "goHome", compact: true })}
        <div class="content">
          <div class="card">
            <h3>Joueurs (3 à 10)</h3>
            <div class="plist">
              ${state.roster
                .map(
                  (p) => `
                <div class="prow">
                  <button class="avatar sm" style="background:${COLORS[p.color % COLORS.length]}" data-action="cycleColor" data-id="${p.id}" title="Changer la couleur">${esc(initial(p.name))}</button>
                  <input type="text" maxlength="14" value="${esc(p.name)}" data-name="${p.id}" placeholder="Prénom" autocomplete="off">
                  <button class="del" data-action="removePlayer" data-id="${p.id}" ${n <= Game.MIN_PLAYERS ? "disabled" : ""} aria-label="Retirer">${icon("x")}</button>
                </div>`
                )
                .join("")}
              ${n < Game.MAX_PLAYERS ? `<button class="add-row" data-action="addPlayer">${icon("plus")} Ajouter un joueur</button>` : ""}
            </div>
          </div>
          <div class="card">
            <h3>Infiltrés</h3>
            <div class="roles">
              <div class="role-row">
                <div class="rlabel">${spy("black")} Undercover</div>
                <div class="stepper">
                  <button data-action="roleDec" data-role="undercover" ${r.undercover <= 0 ? "disabled" : ""}>${icon("minus")}</button>
                  <span class="n">${r.undercover}</span>
                  <button data-action="roleInc" data-role="undercover" ${r.undercover + r.mrWhite >= max ? "disabled" : ""}>${icon("plus")}</button>
                </div>
              </div>
              <div class="role-row">
                <div class="rlabel">${spy("white")} Mr White</div>
                <div class="stepper">
                  <button data-action="roleDec" data-role="mrWhite" ${r.mrWhite <= 0 ? "disabled" : ""}>${icon("minus")}</button>
                  <span class="n">${r.mrWhite}</span>
                  <button data-action="roleInc" data-role="mrWhite" ${r.undercover + r.mrWhite >= max ? "disabled" : ""}>${icon("plus")}</button>
                </div>
              </div>
              <p class="hint">${n - r.undercover - r.mrWhite} civils · ${r.undercover} undercover · ${r.mrWhite} Mr White. Maximum ${max} infiltré${max > 1 ? "s" : ""} pour ${n} joueurs.</p>
              ${errors.length ? `<p class="hint err">${esc(errors.join(" "))}</p>` : ""}
              <button class="btn ghost" data-action="rolesAuto">Répartition automatique</button>
            </div>
          </div>
          <div class="bottom-bar">
            <button class="btn" data-action="startGame" ${errors.length ? "disabled" : ""}>Commencer</button>
          </div>
        </div>
      </section>`;
  }

  // ---- Distribution des mots
  function reveal() {
    const g = state.game;
    const p = g.players[g.revealIndex];
    const total = g.players.length;
    const dots = g.players.map((_, i) => `<i class="${i < g.revealIndex ? "done" : i === g.revealIndex ? "cur" : ""}"></i>`).join("");
    let card;
    if (!g.revealShown) {
      card = `
        <div class="reveal-card" data-action="revealShow">
          ${avatar(p, "", "lg")}
          <div class="who">Passe le téléphone à ${esc(p.name)}</div>
          <div class="tap">${esc(p.name)}, appuie ici pour voir ton mot secret</div>
        </div>`;
    } else if (p.role === Game.ROLES.MRWHITE) {
      card = `
        <div class="reveal-card">
          ${spy("white", "big-spy")}
          <div class="word white">Tu es Mr White</div>
          <div class="sub">Tu n'as pas de mot. Écoute bien les autres, fais semblant d'en avoir un… et si tu es éliminé, tu pourras deviner le mot des civils.</div>
        </div>`;
    } else {
      card = `
        <div class="reveal-card">
          <div class="tap">Ton mot secret</div>
          <div class="word">${esc(p.word)}</div>
          <div class="sub">Ne le montre à personne. Tu es peut-être civil… ou undercover.</div>
        </div>`;
    }
    return `
      <section class="screen">
        ${hero("Distribution des mots", "Chaque joueur regarde son mot à tour de rôle, en cachette.", { back: "confirmExit", compact: true })}
        <div class="content center">
          <div class="progress">${dots}</div>
          ${card}
          <div class="bottom-bar" style="width:100%">
            ${g.revealShown ? `<button class="btn" data-action="revealNext">${g.revealIndex + 1 < total ? "J'ai mémorisé" : "Commencer la partie"}</button>` : ""}
          </div>
        </div>
      </section>`;
  }

  // ---- Phase de description
  function playerGrid(players, opts) {
    opts = opts || {};
    const order = (state.game && state.game.order) || [];
    return `<div class="grid ${players.length <= 4 ? "two" : ""}">${players
      .map((p) => {
        const idx = order.indexOf(p.id);
        let badge = "";
        if (!p.alive) badge = `<span class="badge out">${icon("x")}</span>`;
        else if (opts.numbers && idx >= 0) badge = `<span class="badge ${idx === 0 ? "first" : ""}">${idx + 1}</span>`;
        return `
          <button class="pcard ${p.alive ? "" : "out"}" data-action="${opts.action || ""}" data-id="${p.id}" ${opts.action && p.alive ? "" : "disabled"}>
            ${avatar(p, badge)}
            <div class="name">${esc(p.name)}</div>
            ${!p.alive ? `<div class="role-tag ${p.role}">${Game.roleLabel(p.role)}</div>` : ""}
          </button>`;
      })
      .join("")}</div>`;
  }

  function infoPills() {
    const g = state.game;
    const c = Game.counts(g.players);
    return `
      <div class="pills">
        <div class="pill-card">
          <div class="label">Infiltrés<br>restants</div>
          <div class="value">${spy("white")} ${c.mrwhite} &nbsp; ${spy("black")} ${c.undercover}</div>
        </div>
        <div class="pill-card dim">
          <div class="label">Manche</div>
          <div class="value"><span class="chip">${g.round}</span></div>
        </div>
      </div>`;
  }

  function describe() {
    const g = state.game;
    const ordered = g.order.map((id) => g.players.find((p) => p.id === id)).concat(g.players.filter((p) => !p.alive));
    return `
      <section class="screen">
        ${hero("C'est l'heure des descriptions", "Décrivez votre mot secret dans l'ordre indiqué, avec un seul mot ou une courte phrase.", { back: "confirmExit" })}
        <div class="content">
          ${infoPills()}
          ${playerGrid(ordered, { numbers: true })}
          <div class="bottom-bar">
            <button class="btn" data-action="goVote">Passer au vote</button>
            <button class="round-btn" data-action="menu" aria-label="Menu">${icon("menu")}</button>
          </div>
        </div>
      </section>`;
  }

  // ---- Vote
  function vote() {
    const g = state.game;
    const alive = g.players.filter((p) => p.alive);
    return `
      <section class="screen">
        ${hero("Vote", "Discutez, puis touchez le joueur que la majorité veut éliminer.", { back: "backToDescribe", compact: true })}
        <div class="content">
          ${infoPills()}
          ${playerGrid(alive, { action: "askEliminate" })}
          <div class="bottom-bar" style="flex-direction:column;gap:8px">
            <button class="btn ghost" data-action="noElimination">Égalité : personne n'est éliminé</button>
          </div>
        </div>
      </section>`;
  }

  // ---- Joueur éliminé
  function eliminated() {
    const g = state.game;
    const p = g.players.find((x) => x.id === g.lastEliminated);
    const role = p.role;
    let body = "";
    if (role === Game.ROLES.MRWHITE && g.guess && g.guess.pending) {
      body = `
        <div class="eliminated-role mrwhite">C'était Mr White !</div>
        <p class="hint" style="text-align:center">${esc(p.name)} a une dernière chance : s'il devine le mot des civils, il gagne la partie.</p>
        <div class="guess-box">
          <input type="text" id="guess-input" placeholder="Le mot des civils ?" autocomplete="off" autocapitalize="off" maxlength="40">
          <button class="btn block" data-action="submitGuess">Valider</button>
          <button class="btn ghost" data-action="skipGuess">Il ne sait pas</button>
        </div>`;
    } else {
      const msgs = {
        civil: "C'était un civil… Les infiltrés sont toujours parmi vous.",
        undercover: "C'était un Undercover ! Bien joué.",
        mrwhite: g.guess && g.guess.result === "wrong" ? `Mr White a proposé « ${esc(g.guess.text)} »… raté !` : "C'était Mr White !",
      };
      body = `
        <div class="eliminated-role ${role}">${Game.roleLabel(role)}</div>
        <p class="hint" style="text-align:center;font-size:16px">${msgs[role]}</p>
        <div class="bottom-bar" style="width:100%">
          <button class="btn" data-action="afterElimination">Continuer</button>
        </div>`;
    }
    return `
      <section class="screen">
        ${hero(`${esc(p.name)} est éliminé`, "", { compact: true, help: false })}
        <div class="content center">
          ${role === Game.ROLES.MRWHITE ? spy("white", "big-spy") : role === Game.ROLES.UNDERCOVER ? spy("black", "big-spy") : avatar(p, "", "lg")}
          ${body}
        </div>
      </section>`;
  }

  // ---- Fin de partie
  function end() {
    const g = state.game;
    const titles = { civils: "Victoire des civils !", infiltrators: "Victoire des infiltrés !", mrwhite: "Mr White a deviné !" };
    return `
      <section class="screen">
        ${hero("Fin de la partie", esc(g.reason || ""), { compact: true, help: false })}
        <div class="content center">
          <div class="winner ${g.winner}">${titles[g.winner]}</div>
          <div class="words-box">
            <div class="w"><small>Mot des civils</small><b>${esc(g.civilWord)}</b></div>
            <div class="w"><small>Mot des undercover</small><b>${esc(g.underWord)}</b></div>
          </div>
          <div class="result-list">
            ${g.players
              .map(
                (p) => `
              <div class="result-row ${p.alive ? "" : "dead"}">
                ${avatar(p, "", "sm")}
                <div class="rname">${esc(p.name)}<small class="role-tag ${p.role}">${Game.roleLabel(p.role)}</small></div>
                <div class="pts">${g.points[p.id] ? "+" + g.points[p.id] : ""}</div>
              </div>`
              )
              .join("")}
          </div>
          <div class="stack" style="margin-top:6px">
            <button class="btn block" data-action="replay">Rejouer avec les mêmes joueurs</button>
            <button class="btn block secondary" data-action="goSetup">Modifier les joueurs</button>
            <button class="btn block secondary" data-action="goScores">Classement général</button>
          </div>
        </div>
      </section>`;
  }

  // ---- Scores cumulés
  function scores() {
    const rows = Object.values(state.scores).sort((a, b) => b.points - a.points || b.wins - a.wins);
    return `
      <section class="screen">
        ${hero("Classement", "Civils +2 · Undercover +10 · Mr White +6 par victoire", { back: "goBackFromScores", compact: true, help: false })}
        <div class="content">
          ${
            rows.length
              ? `<div class="list">${rows
                  .map(
                    (s, i) => `
                <div class="score-row">
                  <div class="rank">${i + 1}</div>
                  <div class="sname">${esc(s.name)}<small>${s.games} partie${s.games > 1 ? "s" : ""} · ${s.wins} victoire${s.wins > 1 ? "s" : ""}</small></div>
                  <div class="spts">${s.points}</div>
                </div>`
                  )
                  .join("")}</div>`
              : `<p class="hint" style="text-align:center">Aucune partie terminée pour le moment.</p>`
          }
          ${rows.length ? `<button class="btn ghost" data-action="confirmResetScores">Réinitialiser le classement</button>` : ""}
        </div>
      </section>`;
  }

  // ------------------------------------------------------------------ modales
  function openModal(html, opts) {
    opts = opts || {};
    modalRoot.innerHTML = `<div class="backdrop ${opts.sheet ? "sheet" : ""}" data-action="closeModal"><div class="modal" data-stop>${html}</div></div>`;
  }
  function closeModal() {
    modalRoot.innerHTML = "";
  }
  function confirm(title, text, okLabel, okAction, danger) {
    openModal(`
      <h2>${title}</h2>
      <p>${text}</p>
      <div class="actions">
        <button class="btn secondary" data-action="closeModal">Annuler</button>
        <button class="btn ${danger ? "danger" : ""}" data-action="${okAction}">${okLabel}</button>
      </div>`);
  }

  function menuSheet() {
    openModal(
      `
      <div class="menu">
        <button class="menu-item" data-action="openAmnesic"><span class="menu-icon b">${icon("eye")}</span>Mode amnésique</button>
        <button class="menu-item" data-action="openEditPlayers"><span class="menu-icon y">${icon("user")}</span>Modifier les joueurs</button>
        <button class="menu-item" data-action="openSettings"><span class="menu-icon p">${icon("gear")}</span>Réglages</button>
        <button class="menu-item" data-action="confirmRepick"><span class="menu-icon v">${icon("refresh")}</span>Changer les mots</button>
      </div>`,
      { sheet: true }
    );
  }

  function rulesModal() {
    openModal(`
      <h2>Règles du jeu</h2>
      <div class="rules">
        <h3>Les rôles</h3>
        <ul>
          <li><b>Civils</b> : ils reçoivent tous le même mot secret.</li>
          <li><b>Undercover</b> : il reçoit un mot différent mais proche. Il ne sait pas qu'il est undercover !</li>
          <li><b>Mr White</b> : il ne reçoit aucun mot. Il doit bluffer en écoutant les autres.</li>
        </ul>
        <h3>Déroulement</h3>
        <ul>
          <li>Chacun regarde son mot en cachette sur le téléphone.</li>
          <li>Dans l'ordre affiché, chaque joueur décrit son mot avec un mot ou une courte phrase. Pas trop précis (les infiltrés devineraient), pas trop vague (on vous soupçonnerait).</li>
          <li>Après le tour, tout le monde débat puis vote. Le joueur désigné est éliminé et son rôle révélé.</li>
          <li>Si <b>Mr White</b> est éliminé, il peut proposer le mot des civils : s'il trouve, il gagne seul la partie.</li>
        </ul>
        <h3>Fin de partie</h3>
        <ul>
          <li><b>Les civils gagnent</b> quand tous les undercover et Mr White sont éliminés.</li>
          <li><b>Les infiltrés gagnent</b> quand ils deviennent aussi nombreux que les civils restants.</li>
        </ul>
        <h3>Points</h3>
        <p>Civils : <b>+2</b> · Undercover : <b>+10</b> · Mr White : <b>+6</b>, attribués aux gagnants.</p>
      </div>
      <div class="actions"><button class="btn block" data-action="closeModal">Compris</button></div>`);
  }

  function amnesicModal(playerId) {
    const g = state.game;
    if (!playerId) {
      openModal(`
        <h2>Mode amnésique</h2>
        <p>Un joueur a oublié son mot ? Choisis-le, passe-lui le téléphone, et il maintient le bouton appuyé pour revoir son mot.</p>
        <div class="list">
          ${g.players
            .filter((p) => p.alive)
            .map((p) => `<button class="list-btn" data-action="amnesicPick" data-id="${p.id}">${avatar(p, "", "sm")} ${esc(p.name)}</button>`)
            .join("")}
        </div>
        <div class="actions"><button class="btn ghost block" data-action="closeModal">Fermer</button></div>`);
      return;
    }
    const p = g.players.find((x) => x.id === playerId);
    openModal(`
      <h2>${esc(p.name)}</h2>
      <p>Passe le téléphone à ${esc(p.name)} uniquement. Maintiens le bouton appuyé pour afficher le mot.</p>
      <button class="hold-btn" data-hold="${p.id}">
        <span class="hidden-label">Maintenir pour voir</span>
        <span class="word-label" style="display:none">${p.role === Game.ROLES.MRWHITE ? `<span class="word white">Mr White</span><small>Tu n'as pas de mot</small>` : `<span class="word">${esc(p.word)}</span>`}</span>
      </button>
      <div class="actions"><button class="btn block" data-action="closeModal">Terminé</button></div>`);
  }

  function editPlayersModal() {
    const g = state.game;
    openModal(`
      <h2>Modifier les joueurs</h2>
      <p>Renomme les joueurs de la partie en cours.</p>
      <div class="plist">
        ${g.players
          .map(
            (p) => `
          <div class="prow">
            <button class="avatar sm" style="background:${COLORS[p.color % COLORS.length]}" data-action="cycleColorGame" data-id="${p.id}">${esc(initial(p.name))}</button>
            <input type="text" maxlength="14" value="${esc(p.name)}" data-gname="${p.id}" autocomplete="off">
          </div>`
          )
          .join("")}
      </div>
      <div class="actions"><button class="btn block" data-action="closeModal">Terminé</button></div>`);
  }

  function settingsModal() {
    const s = state.settings;
    openModal(`
      <h2>Réglages</h2>
      <div class="toggle-row">
        <div class="tl">Mr White peut deviner<small>Quand il est éliminé, il tente de trouver le mot des civils.</small></div>
        <button class="switch ${s.mrWhiteGuess ? "on" : ""}" data-action="toggleSetting" data-key="mrWhiteGuess" aria-label="Mr White peut deviner"></button>
      </div>
      <div class="toggle-row">
        <div class="tl">Vibrations<small>Petit retour haptique lors des révélations.</small></div>
        <button class="switch ${s.vibrate ? "on" : ""}" data-action="toggleSetting" data-key="vibrate" aria-label="Vibrations"></button>
      </div>
      <div class="actions" style="flex-direction:column">
        <button class="btn secondary block" data-action="rules">Voir les règles</button>
        <button class="btn ghost block" data-action="confirmResetScores">Réinitialiser le classement</button>
        <button class="btn block" data-action="closeModal">Fermer</button>
      </div>`);
  }

  // ------------------------------------------------------------------ logique de partie
  function newDeal() {
    const pair = Game.pickPair(WORD_PAIRS, state.recentPairs);
    state.recentPairs.push(pair.id);
    if (state.recentPairs.length > RECENT_PAIRS_MAX) state.recentPairs.shift();
    const dealt = Game.deal(state.roster, state.roles, pair);
    state.game = {
      players: dealt.players,
      civilWord: dealt.civilWord,
      underWord: dealt.underWord,
      pairId: dealt.pairId,
      phase: "reveal",
      revealIndex: 0,
      revealShown: false,
      order: [],
      round: 1,
      lastEliminated: null,
      guess: null,
      winner: null,
      reason: "",
      points: {},
    };
    state.screen = "reveal";
  }

  function startDescribe() {
    const g = state.game;
    g.order = Game.speakingOrder(g.players);
    g.phase = "describe";
    g.lastEliminated = null;
    g.guess = null;
    state.screen = "describe";
  }

  function finish(winner, reason) {
    const g = state.game;
    g.phase = "end";
    g.winner = winner;
    g.reason = reason || "";
    g.points = Game.scoreGame(g.players, winner);
    for (const p of g.players) {
      const key = p.name.trim().toLowerCase() || p.id;
      const s = state.scores[key] || { name: p.name.trim(), points: 0, games: 0, wins: 0 };
      s.name = p.name.trim();
      s.games += 1;
      s.points += g.points[p.id] || 0;
      if (g.points[p.id] > 0) s.wins += 1;
      state.scores[key] = s;
    }
    state.screen = "end";
    vibrate([80, 60, 80]);
  }

  function afterElimination() {
    const g = state.game;
    const win = Game.checkWin(g.players);
    if (win) return finish(win.winner, win.reason);
    g.round += 1;
    startDescribe();
  }

  // ------------------------------------------------------------------ actions
  const actions = {
    goHome() { state.screen = "home"; },
    goSetup() {
      if (state.game && state.game.phase === "end") state.game = null;
      state.screen = "setup";
    },
    resume() { state.screen = state.game.phase; },
    goScores() { state._before = state.screen; state.screen = "scores"; },
    goBackFromScores() { state.screen = state._before && state._before !== "scores" ? state._before : "home"; delete state._before; },
    rules() { rulesModal(); return false; },
    closeModal() { closeModal(); return false; },

    // configuration
    addPlayer() {
      if (state.roster.length >= Game.MAX_PLAYERS) return;
      const used = state.roster.map((p) => p.color);
      let color = 0;
      while (used.includes(color) && color < COLORS.length - 1) color++;
      state.roster.push({ id: uid(), name: `Joueur ${state.roster.length + 1}`, color });
      state.roles = Game.defaultRoles(state.roster.length);
    },
    removePlayer(el) {
      if (state.roster.length <= Game.MIN_PLAYERS) return;
      state.roster = state.roster.filter((p) => p.id !== el.dataset.id);
      state.roles = Game.defaultRoles(state.roster.length);
    },
    cycleColor(el) {
      const p = state.roster.find((x) => x.id === el.dataset.id);
      if (p) p.color = (p.color + 1) % COLORS.length;
    },
    roleInc(el) { state.roles[el.dataset.role] += 1; },
    roleDec(el) { state.roles[el.dataset.role] = Math.max(0, state.roles[el.dataset.role] - 1); },
    rolesAuto() { state.roles = Game.defaultRoles(state.roster.length); },
    startGame() {
      state.roster.forEach((p, i) => { if (!p.name.trim()) p.name = `Joueur ${i + 1}`; });
      const errs = Game.validateRoles(state.roster.length, state.roles.undercover, state.roles.mrWhite);
      if (errs.length) return;
      newDeal();
    },

    // révélation
    revealShow() { state.game.revealShown = true; vibrate(30); },
    revealNext() {
      const g = state.game;
      g.revealShown = false;
      g.revealIndex += 1;
      if (g.revealIndex >= g.players.length) {
        g.revealIndex = 0;
        startDescribe();
      }
    },

    // description / vote
    goVote() { state.game.phase = "vote"; state.screen = "vote"; },
    backToDescribe() { state.game.phase = "describe"; state.screen = "describe"; },
    menu() { menuSheet(); return false; },
    askEliminate(el) {
      const p = state.game.players.find((x) => x.id === el.dataset.id);
      state._pending = p.id;
      confirm(`Éliminer ${esc(p.name)} ?`, "Son rôle sera révélé à tout le monde.", "Éliminer", "doEliminate", true);
      return false;
    },
    doEliminate() {
      closeModal();
      const g = state.game;
      const id = state._pending;
      delete state._pending;
      g.players = Game.eliminate(g.players, id);
      g.lastEliminated = id;
      const p = g.players.find((x) => x.id === id);
      g.guess = p.role === Game.ROLES.MRWHITE && state.settings.mrWhiteGuess ? { pending: true, text: "", result: null } : null;
      g.phase = "eliminated";
      state.screen = "eliminated";
      vibrate(60);
    },
    noElimination() {
      state.game.round += 1;
      startDescribe();
    },
    submitGuess() {
      const input = document.getElementById("guess-input");
      const text = input ? input.value.trim() : "";
      if (!text) { if (input) input.focus(); return false; }
      const g = state.game;
      g.guess.text = text;
      g.guess.pending = false;
      if (Game.mrWhiteGuessCorrect(text, g.civilWord)) {
        g.guess.result = "right";
        finish("mrwhite", `Mr White a trouvé le mot « ${g.civilWord} ».`);
      } else {
        g.guess.result = "wrong";
      }
    },
    skipGuess() {
      const g = state.game;
      g.guess.pending = false;
      g.guess.result = "skipped";
    },
    afterElimination() { afterElimination(); },

    // fin
    replay() {
      // Reprend la liste et les couleurs de la partie (noms éventuellement modifiés).
      state.roster = state.game.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
      newDeal();
    },
    confirmResetScores() {
      confirm("Réinitialiser le classement ?", "Tous les points cumulés seront effacés.", "Réinitialiser", "resetScores", true);
      return false;
    },
    resetScores() { state.scores = {}; closeModal(); },

    // menu en partie
    confirmExit() {
      confirm("Quitter la partie ?", "La partie en cours sera abandonnée.", "Quitter", "exitGame", true);
      return false;
    },
    exitGame() { closeModal(); state.game = null; state.screen = "home"; },
    openAmnesic() { amnesicModal(); return false; },
    amnesicPick(el) { amnesicModal(el.dataset.id); return false; },
    openEditPlayers() { editPlayersModal(); return false; },
    cycleColorGame(el) {
      const p = state.game.players.find((x) => x.id === el.dataset.id);
      if (p) p.color = (p.color + 1) % COLORS.length;
      const r = state.roster.find((x) => x.id === el.dataset.id);
      if (r) r.color = p.color;
      editPlayersModal();
    },
    openSettings() { settingsModal(); return false; },
    toggleSetting(el) {
      state.settings[el.dataset.key] = !state.settings[el.dataset.key];
      settingsModal();
      return false;
    },
    confirmRepick() {
      confirm("Changer les mots ?", "De nouveaux mots et de nouveaux rôles seront distribués aux mêmes joueurs. La manche repart de zéro.", "Changer", "repick");
      return false;
    },
    repick() {
      closeModal();
      state.roster = state.game.players.map((p) => ({ id: p.id, name: p.name, color: p.color }));
      newDeal();
    },
  };

  // ------------------------------------------------------------------ événements
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    // Clic sur le fond de la modale uniquement (pas dans la boîte)
    if (el.classList.contains("backdrop") && e.target !== el) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    const r = fn(el, e);
    if (r !== false) render();
    else save();
  });

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.name) {
      const p = state.roster.find((x) => x.id === t.dataset.name);
      if (p) {
        p.name = t.value;
        const av = t.parentElement.querySelector(".avatar");
        if (av) av.textContent = initial(p.name);
        save();
      }
    } else if (t.dataset.gname) {
      const p = state.game && state.game.players.find((x) => x.id === t.dataset.gname);
      if (p) {
        p.name = t.value;
        const r = state.roster.find((x) => x.id === p.id);
        if (r) r.name = t.value;
        const av = t.parentElement.querySelector(".avatar");
        if (av) av.textContent = initial(p.name);
        save();
      }
    }
  });
  // Quand on quitte la modale "modifier les joueurs", on redessine l'écran.
  const mo = new MutationObserver(() => {
    if (!modalRoot.firstChild && state.game) render();
  });
  mo.observe(modalRoot, { childList: true });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "guess-input") {
      if (actions.submitGuess() !== false) render();
    } else if (e.key === "Escape" && modalRoot.firstChild) {
      closeModal();
    }
  });

  // Maintenir appuyé pour voir son mot (mode amnésique)
  function holdStart(e) {
    const b = e.target.closest("[data-hold]");
    if (!b) return;
    e.preventDefault();
    b.querySelector(".hidden-label").style.display = "none";
    b.querySelector(".word-label").style.display = "";
  }
  function holdEnd(e) {
    // pointerleave ne remonte pas : on ne réagit qu'au départ du bouton lui-même, pas de ses enfants.
    if (e.type === "pointerleave" && !(e.target.hasAttribute && e.target.hasAttribute("data-hold"))) return;
    const all = Array.from(document.querySelectorAll("[data-hold]"));
    all.forEach((x) => {
      x.querySelector(".hidden-label").style.display = "";
      x.querySelector(".word-label").style.display = "none";
    });
  }
  document.addEventListener("pointerdown", holdStart);
  document.addEventListener("pointerup", holdEnd);
  document.addEventListener("pointercancel", holdEnd);
  document.addEventListener("pointerleave", holdEnd, true);
  document.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-hold]")) e.preventDefault(); });

  // Service worker (PWA) uniquement en http(s)
  if ("serviceWorker" in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  render();
})();
