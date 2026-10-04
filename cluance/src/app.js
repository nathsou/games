import {friendSession, togetherURL, registerFriendGame, redirectTogetherInvitation} from '../../shared/friend-context.js';
import { loadTheme, THEME_KEY } from "../../shared/theme.js";
import { loadAI, saveAI, CONFIG_KEY } from "../../shared/ai/config.js";
import { DECKS, CARDS } from "./decks.js";
import {
  createGame,
  playClue,
  eliminate,
  remaining,
  viewFor,
  validatePublicView,
  REMOVALS,
  PROTOCOL,
} from "./game.js";
import { loadArt, cardElement, observationImage } from "./art.js";
import {
  PeerLink,
  decodePairing,
  makeLink,
  iceConfig,
  invitationDetails,
  validateInvitationDetails,
  makeInvitationLink,
} from "./peer.js";
import {
  pairingBody,
  connectionSettings,
  copyPairing,
  sharePairing,
  capturePairingUI,
  restorePairingUI,
} from "../../shared/pairing.js";
import {signalingService,hostedInvitation,hostedLink,createHostedRoom,roomDetails,roomConfig} from '../../shared/signaling.js';
import { drawQR } from "../../shared/qr.js";
import { PROVIDERS, chooseMove, listModels } from "./ai.js";
import { loadSettings, read, write, erase } from "./storage.js";
import { chime, setMusic, unlockAudio } from "./sound.js";
import { THEME_MUSIC } from "./music.js";
import { animateOutcome } from "./outcome.js";
import {
  trackGame,
  markUsage,
  usageSnapshot,
  gameUsage,
  usageSummary,
  formatSpend,
  formatUSD,
  modelPrice,
  priceKey,
} from "./usage.js";

const app = document.getElementById("app");
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modal-content");
let settings = loadSettings();
let setup = {
  ...{
    theme: "french",
    clueTheme: "same",
    variant: "classic",
    mode: "ai-giver",
  },
  ...read("setup", {}),
};
if (!DECKS[setup.theme]) setup.theme = "french";
if (setup.clueTheme !== "same" && !DECKS[setup.clueTheme])
  setup.clueTheme = "same";
let game = null,
  mode = null,
  localRole = "giver",
  screen = "home",
  selected = new Set(),
  clueCard = null,
  relation = "similar",
  draftNote = "";
let peer = null,
  peerStatus = "",
  pendingGuess = false,
  pairingKind = null,
  pairingCode = "",
  pairingError = "",
  pairingBusy = false,
  pairingOffer = "",
  pairingInput = "",
  pairingConfig = null,
  pairingGameOptions = null,
  roleSwap = null;
let roleSwapTimer,
  cancelledRoleSwap = null;
let pairingHosted=false,pairingAttempt=0,pairingStun;
let relay = { url: "", username: "", credential: "" };
const pairingBus =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("cluance-pairing")
    : null;
let aiBusy = false,
  aiError = "",
  aiController = null,
  aiGeneration = 0,
  replayRound = 0,
  toastTimer,
  lastOutcome;
let homeRole =
    setup.mode === "ai-guesser" || setup.mode === "peer-host"
      ? "giver"
      : "guesser",
  homePartner =
    setup.mode === "local"
      ? "local"
      : setup.mode?.startsWith("peer-")
        ? "friend"
        : "ai";
let openToken = null,
  drawerCardId = null,
  drawerReturnId = null,
  drawerCards = [],
  comparePins = [],
  collectionTheme = setup.theme,
  collectionSearch = "",
  collectionSort = "order",
  replayPlaying = false,
  replayTimer = null,
  renderedGameId = null,
  renderedRevision = null,
  noteOpen = false,
  settingsTab = "game",
  dragCleanup = null;
const colorPreference = matchMedia("(prefers-color-scheme: dark)");
const CARD_SIZES = [
  ["compact", "Compact"],
  ["comfortable", "Comfortable"],
  ["large", "Large"],
];
const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const options = (items, current) =>
  items
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}"${value === current ? " selected" : ""}>${esc(label)}</option>`,
    )
    .join("");
function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.hidden = true), 5500);
}
function sound(kind) {
  chime(kind, settings.sound && !settings.muted);
}
function updateMusic() {
  setMusic({
    theme: screen === "home" ? setup.theme : game?.theme || setup.theme,
    enabled: settings.music,
    volume: settings.musicVolume / 100,
    muted: settings.muted,
  });
}
function mountCard(parent, id, opts = {}) {
  const element = cardElement(id, opts);
  parent.append(element);
  return element;
}
function humanRole() {
  return mode === "ai-giver" || mode === "peer-guest"
    ? "guesser"
    : mode === "local"
      ? localRole
      : "giver";
}
function currentView() {
  return mode === "peer-guest" ? game : viewFor(game, humanRole());
}
function isHumanTurn() {
  return (
    game &&
    game.phase !== "over" &&
    !roleSwap &&
    (game.phase === "clue") === (humanRole() === "giver")
  );
}
function isPeer() {
  return mode === "peer-host" || mode === "peer-guest";
}
function saveSession() {
  if (game && ["ai-giver", "ai-guesser", "local", "peer-host"].includes(mode)) {
    trackGame(game, mode);
    write("session", { game, mode, localRole });
  }
}
function resetTurn() {
  selected.clear();
  clueCard = null;
  relation = "similar";
  draftNote = "";
  noteOpen = false;
  comparePins = [];
  aiError = "";
  pendingGuess = false;
}
function cancelAI() {
  aiGeneration++;
  aiController?.abort();
  aiController = null;
  aiBusy = false;
}
function showModal(title, eyebrow, body) {
  modal.className = "";
  closeDrawer();
  modalContent.innerHTML = `<div class="modal-header"><div><p class="eyebrow">${esc(eyebrow)}</p><h2 id="modal-title">${esc(title)}</h2></div><button class="modal-close" id="modal-close" aria-label="Close dialog">×</button></div>${body}`;
  $("modal-close").onclick = () => modal.close();
  if (!modal.open) modal.showModal();
}
modal.addEventListener("click", (event) => {
  if (event.target === modal && !$("modal-close")?.hidden) {
    const rect = modal.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      modal.close();
  }
});
modal.addEventListener("close", () => {
  // A queued close event can arrive after another dialog has already opened.
  if (modal.open) return;
  if (roleSwap && !roleSwap.accepted) cancelRoleSwap();
  if (pairingKind && !peer?.connected) {
    peer?.close();
    peer = null;
    pairingKind = null;
    pairingAttempt++;
    pairingBusy = false;
    updateConnection();
  }
});
modal.addEventListener("cancel", (event) => {
  if (roleSwap?.accepted) event.preventDefault();
});
function closeDrawer() {
  const wasOpen = drawerCardId !== null;
  drawerCardId = null;
  $("card-drawer").hidden = true;
  $("card-drawer").replaceChildren();
  $("drawer-scrim").hidden = true;
  if (wasOpen && drawerReturnId)
    app
      .querySelector(`[data-card="${drawerReturnId}"]`)
      ?.focus({ preventScroll: true });
}
function inspectCard(id, ids = null) {
  if (!CARDS[id]) return;
  if (!drawerCardId)
    drawerReturnId =
      document.activeElement?.closest(".card")?.dataset.card || id;
  drawerCardId = id;
  drawerCards =
    ids ||
    (screen === "collection"
      ? collectionCards().map((c) => c.id)
      : game?.board.includes(id)
        ? game.board
        : game?.history.some((r) => r.card === id)
          ? game.history.map((r) => r.card)
          : game?.hand?.includes(id) && humanRole() === "giver"
            ? game.hand
            : [id]);
  renderDrawer();
}
function toggleMark(id) {
  if (
    screen !== "game" ||
    !isHumanTurn() ||
    humanRole() !== "guesser" ||
    game.eliminated.includes(id) ||
    pendingGuess
  )
    return;
  if (selected.has(id)) selected.delete(id);
  else if (selected.size < REMOVALS[game.round]) selected.add(id);
  else {
    toast(`Unmark a card first. Choose ${REMOVALS[game.round]} cards.`);
    return;
  }
  sound("select");
  renderGame();
  if (drawerCardId) renderDrawer();
}
function renderDrawer(compare = false) {
  const id = drawerCardId,
    card = CARDS[id];
  if (!card) return;
  const index = drawerCards.indexOf(id),
    latest = game?.history.at(-1),
    canMark =
      screen === "game" &&
      isHumanTurn() &&
      humanRole() === "guesser" &&
      game.board.includes(id) &&
      !game.eliminated.includes(id);
  const drawer = $("card-drawer");
  drawer.hidden = false;
  $("drawer-scrim").hidden = false;
  drawer.innerHTML = `<div class="drawer-nav"><button id="drawer-prev" class="icon-button" aria-label="Previous card" ${index <= 0 ? "disabled" : ""}>←</button><span>${String(index + 1).padStart(2, "0")} / ${drawerCards.length}</span><button id="drawer-next" class="icon-button" aria-label="Next card" ${index === drawerCards.length - 1 ? "disabled" : ""}>→</button><button id="drawer-close" class="icon-button" aria-label="Close card details">✕</button></div>${compare ? '<h2>Compare the connection.</h2><div id="compare-cards" class="compare-cards"></div>' : '<div id="drawer-art"></div>'}<p class="eyebrow">${esc(DECKS[card.deck].name)} · NO. ${String(card.index + 1).padStart(2, "0")}</p><h2>${esc(card.name)}</h2><p>${esc(card.subtitle)} · ${esc(card.dates)}</p><p class="card-description">${esc(card.description)}</p><div class="drawer-actions">${canMark ? `<button class="button secondary danger" id="drawer-mark">${selected.has(id) ? "Unmark" : "Mark for removal"}</button>` : ""}${latest && id !== latest.card ? `<button class="button secondary" id="drawer-compare">${compare ? "Back to details" : "Compare with " + esc(CARDS[latest.card].name)}</button>` : ""}</div><p class="drawer-hint">← → browse · M mark · Esc close</p>`;
  if (compare) {
    for (const cid of [latest.card, ...comparePins])
      mountCard($("compare-cards"), cid, {
        caption: "s",
        className:
          cid === latest.card && latest.relation === "different"
            ? "sideways"
            : "",
      });
  } else mountCard($("drawer-art"), id, { caption: "none" });
  $("drawer-prev").onclick = () =>
    inspectCard(drawerCards[index - 1], drawerCards);
  $("drawer-next").onclick = () =>
    inspectCard(drawerCards[index + 1], drawerCards);
  $("drawer-close").onclick = closeDrawer;
  if ($("drawer-mark")) $("drawer-mark").onclick = () => toggleMark(id);
  if ($("drawer-compare"))
    $("drawer-compare").onclick = () => {
      comparePins = [...new Set([...comparePins, id])].slice(-2);
      renderDrawer(!compare);
    };
  if (!drawer.contains(document.activeElement))
    $("drawer-close").focus({ preventScroll: true });
}
function attachInspect(element, id) {
  const info = document.createElement("span");
  info.className = "card-info";
  info.textContent = "ⓘ";
  info.setAttribute("aria-hidden", "true");
  element.append(info);
  element.setAttribute("aria-keyshortcuts", "I");
  info.addEventListener("click", (event) => {
    event.stopPropagation();
    element.dataset.detailsFocus = "true";
    inspectCard(id);
  });
  element.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    inspectCard(id);
  });
  element.addEventListener("dblclick", (event) => {
    event.preventDefault();
    inspectCard(id);
  });
  element.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "i") {
      event.preventDefault();
      inspectCard(id);
    }
  });
  let longPress;
  const peek = () => {
    if (settings.detailsMode !== "peek" || drawerCardId) return;
    const card = CARDS[id],
      rect = element.getBoundingClientRect(),
      node = $("card-peek");
    node.innerHTML = `<strong>${esc(card.name)}</strong><p class="gold">${esc(card.dates)}</p><p>${esc(card.description.split(/(?<=[.!?])\s/)[0])}</p>`;
    node.hidden = false;
    node.style.left =
      Math.max(12, Math.min(innerWidth - 292, rect.left)) + "px";
    node.style.top =
      Math.max(12, Math.min(innerHeight - 180, rect.bottom + 8)) + "px";
  };
  element.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch") peek();
  });
  element.addEventListener("pointerleave", () => {
    $("card-peek").hidden = true;
    clearTimeout(longPress);
  });
  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" && settings.detailsMode === "peek")
      longPress = setTimeout(peek, 500);
  });
  element.addEventListener("pointerup", () => clearTimeout(longPress));
}
function setScreen(next) {
  screen = next;
  document.body.dataset.screen = next;
  $("home-link").setAttribute(
    "aria-label",
    next === "game" ? "Leave table" : "Cluance home",
  );
  $("menu-popover")?.remove();
  $("table-menu").setAttribute("aria-expanded", "false");
  closeDrawer();
  $("card-peek").hidden = true;
  $("card-peek").replaceChildren();
  $("table-context").textContent =
    next === "game" || next === "reveal"
      ? "/ " + DECKS[game.theme].name + (next === "reveal" ? " · reveal" : "")
      : "";
  $("resume-slot").innerHTML = "";
  updatePartner();
  updateMusic();
}
function modelName() {
  return settings.models[settings.provider].split("/").at(-1);
}
function updatePartner() {
  const chip = $("partner-chip");
  chip.hidden =
    !game ||
    !["game", "reveal"].includes(screen) ||
    mode === "local" ||
    mode === "replay";
  if (chip.hidden) return;
  if (isPeer()) {
    chip.innerHTML = `<span class="connection-dot ${peer?.connected ? "connected" : ""}"></span> ${peer?.connected ? "Friend connected" : "Reconnect"}`;
    chip.onclick = () => {
      if (!peer?.connected)
        openPairing(mode === "peer-host" ? "host" : "guest", true);
    };
  } else {
    const u = gameUsage(game.id);
    chip.textContent =
      screen === "reveal"
        ? `Total ${formatSpend(u)} · ${u.requests} requests`
        : `✦ ${modelName()} ${humanRole() === "giver" ? "guesses" : "gives clues"} · ${formatSpend(u)}`;
    chip.onclick = () => openSettings("spending");
  }
}
function progress(round, giver = false) {
  return `<div class="round-progress ${giver ? "giver" : ""}" role="img" aria-label="Round ${round + 1} of 5">${REMOVALS.map((n, i) => `<span style="flex:${n}" class="${i < round ? "done" : i === round ? "current" : ""}" title="Round ${i + 1}: remove ${n}"></span>`).join("")}</div>`;
}

function renderHome() {
  stopReplay();
  setScreen("home");
  app.hidden = false;
  const saved = read("session", null);
  if (saved?.game && saved.game.phase !== "over") {
    $("resume-slot").innerHTML =
      `<button id="resume" class="resume-pill"><b>${saved.game.round + 1}</b>Resume · Round ${saved.game.round + 1}${saved.mode.startsWith("ai-") ? " with " + esc(modelName()) : ""} →</button>`;
    $("resume").onclick = resumeGame;
  }
  const token = (id, label) =>
    `<button class="sentence-token ${openToken === id ? "open" : ""}" data-token="${id}" aria-expanded="${openToken === id}" ${id === "deck" ? `style="--deck-color:${DECKS[setup.theme].color}"` : ""}>${esc(label)}<span>▾</span></button>`;
  const partner =
    homePartner === "ai"
      ? "an AI"
      : homePartner === "local"
        ? "a friend on this screen"
        : "a friend";
  app.innerHTML = `<section class="home-hero"><div class="home-copy"><p class="eyebrow">SAME CARDS. DIFFERENT MINDS.</p><h1 class="setup-sentence">I’ll ${token("role", homeRole === "guesser" ? "guess" : "give the clues")} while ${token("partner", partner)} ${homeRole === "guesser" ? "gives the clues" : "guesses"}, with ${token("deck", DECKS[setup.theme].name)} cards.</h1><p class="secondary-clause">Clues come from <button data-token="clues">${setup.clueTheme === "same" ? "the same deck" : esc(DECKS[setup.clueTheme].name)}</button>. The clue giver <button data-token="variant">${setup.variant === "fixed" ? "keeps the same five cards" : "draws a new card after each clue"}</button>.</p><div class="home-cta"><button class="button deal-button" id="start-game">${homePartner === "friend" ? "Invite a friend →" : "Deal the cards →"}</button><div class="home-friend-actions">${homePartner === "friend" ? "" : '<button class="text-button" id="invite-friend">Invite a friend →</button>'}<button class="text-button" id="join-friend">Have an invite? Join a friend</button></div></div><div id="token-picker" class="token-picker" ${openToken ? "" : "hidden"}></div></div><div class="hero-art" id="hero-art"></div></section><div class="home-footer"><span>One secret card. Five rounds. Win or lose together.</span><button class="text-button" id="open-replay">Open a replay ↓</button><a href="https://www.gigamic.com/blog/post/tout-sur-la-gamme-similo" target="_blank" rel="noopener noreferrer">Inspired by Similo ↗</a><input id="replay-file" type="file" accept="application/json,.json" hidden></div>`;
  const deck = DECKS[setup.theme],
    preferred =
      setup.theme === "french"
        ? [17, 21, 5]
        : [0, Math.min(15, deck.cards.length - 1), deck.preview ?? 5],
    hero = [],
    used = new Set();
  // Keep the foreground preview, replacing repeated cards in the back of the fan.
  for (let slot = preferred.length - 1; slot >= 0; slot--) {
    const preferredCard = deck.cards[preferred[slot]],
      card = used.has(preferredCard.id)
        ? deck.cards.find((candidate) => !used.has(candidate.id))
        : preferredCard;
    used.add(card.id);
    hero[slot] = card;
  }
  hero.forEach((card) =>
    mountCard($("hero-art"), card.id, { caption: "none" }),
  );
  app.querySelectorAll("[data-token]").forEach(
    (button) =>
      (button.onclick = () => {
        openToken =
          openToken === button.dataset.token ? null : button.dataset.token;
        renderHome();
      }),
  );
  if (openToken) renderTokenPicker();
  $("start-game").onclick = () => {
    if (homePartner === "friend") inviteFriend();
    else start(setup.mode);
  };
  if ($("invite-friend")) $("invite-friend").onclick = inviteFriend;
  if ($("join-friend")) $("join-friend").onclick = () => openPairing("guest");
  $("open-replay").onclick = () => $("replay-file").click();
  $("replay-file").onchange = (event) => importReplay(event.target.files[0]);
}
function inviteFriend() {
  if (friendSession()?.connected) {
    friendSession().requestGame('cluance');
    return;
  }
  homePartner = "friend";
  setup.mode = homeRole === "giver" ? "peer-host" : "peer-guest";
  openToken = null;
  saveSetup();
  renderHome();
  if (!friendSession()) {
    location.href = togetherURL('cluance', 'invite');
    return;
  }
  start(setup.mode);
}
function renderTokenPicker() {
  const picker = $("token-picker");
  if (innerWidth > 760) {
    const anchor = app.querySelector(`[data-token="${openToken}"]`),
      bounds = anchor.getBoundingClientRect(),
      parent = picker.parentElement.getBoundingClientRect();
    picker.style.top = bounds.bottom - parent.top + 12 + "px";
    picker.style.marginTop = "0";
    picker.style.maxHeight =
      Math.max(180, innerHeight - bounds.bottom - 30) + "px";
  }
  picker.innerHTML = `<div class="picker-heading"><strong>${{ role: "Your role", partner: "Play with", deck: "Cards from", clues: "Clues from", variant: "The clue giver’s hand" }[openToken]}</strong><button class="icon-button" id="picker-close" aria-label="Close picker">✕</button></div>`;
  $("picker-close").onclick = () => {
    openToken = null;
    renderHome();
  };
  if (openToken === "deck" || openToken === "clues") {
    const grid = document.createElement("div");
    grid.className = "picker-decks";
    picker.append(grid);
    if (openToken === "clues") {
      const same = document.createElement("button");
      same.className = "button secondary";
      same.textContent = "The same deck";
      same.onclick = () => chooseToken("same");
      picker.append(same);
    }
    for (const deck of Object.values(DECKS)) {
      const btn = document.createElement("button");
      btn.className = "deck-choice";
      btn.setAttribute(
        "aria-pressed",
        String(
          (openToken === "deck" ? setup.theme : setup.clueTheme) === deck.id,
        ),
      );
      mountCard(btn, deck.cards[deck.preview ?? 5].id, { caption: "none" });
      const name = document.createElement("span");
      name.textContent = deck.name;
      btn.append(name);
      btn.onclick = () => chooseToken(deck.id);
      grid.append(btn);
    }
  } else {
    const choices =
      openToken === "role"
        ? [
            ["guesser", "guess"],
            ["giver", "give the clues"],
          ]
        : openToken === "partner"
          ? [
              ["ai", "an AI"],
              ["friend", "a friend"],
              ["local", "a friend on this screen"],
            ]
          : [
              ["classic", "draws a new card after each clue"],
              ["fixed", "keeps the same five cards"],
            ];
    for (const [value, label] of choices) {
      const btn = document.createElement("button");
      btn.className = "picker-option";
      btn.textContent = label;
      btn.onclick = () => chooseToken(value);
      picker.append(btn);
    }
  }
}
function chooseToken(value) {
  if (openToken === "role") homeRole = value;
  else if (openToken === "partner") homePartner = value;
  else if (openToken === "deck") setup.theme = value;
  else if (openToken === "clues") setup.clueTheme = value;
  else setup.variant = value;
  setup.mode =
    homePartner === "local"
      ? "local"
      : homePartner === "friend"
        ? homeRole === "giver"
          ? "peer-host"
          : "peer-guest"
        : homeRole === "giver"
          ? "ai-guesser"
          : "ai-giver";
  openToken = null;
  saveSetup();
  renderHome();
}

function saveSetup() {
  write("setup", setup);
}
function gameOptions() {
  return {
    theme: setup.theme,
    clueTheme: setup.clueTheme === "same" ? setup.theme : setup.clueTheme,
    variant: setup.variant,
  };
}
function start(nextMode) {
  if (nextMode.startsWith("ai-") && !settings.keys[settings.provider]) {
    toast("Add a provider key, then deal the cards.");
    openSettings("ai");
    return;
  }
  cancelAI();
  peer?.close();
  peer = null;
  updateConnection();
  if (nextMode.startsWith("peer-")) {
    openPairing("host");
    return;
  }
  mode = nextMode;
  game = createGame(gameOptions());
  localRole = "giver";
  resetTurn();
  screen = "game";
  saveSession();
  if (mode === "local") showPassScreen();
  else {
    renderGame();
    runAI();
  }
}
function resumeGame() {
  const saved = read("session", null);
  if (
    !saved?.game ||
    !["ai-giver", "ai-guesser", "local", "peer-host"].includes(saved.mode)
  ) {
    erase("session");
    toast("No saved game is available.");
    renderHome();
    return;
  }
  try {
    validatePublicView(viewFor(saved.game, "guesser"));
    if (
      !saved.game.board.includes(saved.game.secret) ||
      !Array.isArray(saved.game.hand) ||
      saved.game.hand.some((id) => !CARDS[id]) ||
      !Array.isArray(saved.game.draw) ||
      saved.game.draw.some((id) => !CARDS[id])
    )
      throw new Error();
    cancelAI();
    game = saved.game;
    mode = saved.mode;
    localRole = saved.localRole === "guesser" ? "guesser" : "giver";
    resetTurn();
    screen = game.phase === "over" ? "reveal" : "game";
    trackGame(game, mode);
    if (mode === "peer-host" && game.phase !== "over") {
      renderGame();
      openPairing("host", true);
    } else if (game.phase === "over") renderReveal();
    else if (mode === "local") showPassScreen();
    else {
      renderGame();
      runAI();
    }
  } catch {
    erase("session");
    toast("The saved game could not be restored. Start a new one.");
    renderHome();
  }
}
function showPassScreen() {
  closeDrawer();
  if (modal.open) modal.close();
  setScreen("curtain");
  app.innerHTML = `<section class="pass-curtain"><p class="eyebrow">ROUND ${game.round + 1} · ONE SCREEN</p><h1>Pass to the ${localRole === "giver" ? "clue giver" : "guesser"}.</h1><p>${localRole === "giver" ? "Guesser, look away. The secret and the hand appear after you hold." : "The secret and hand are hidden. Hold when you’re ready to read the clues."}</p><button id="pass-ready" class="hold-ring" aria-label="Hold for 800 milliseconds to reveal your turn"><span><strong>Hold</strong><small>to reveal</small></span></button><button id="accessible-reveal" class="text-button">Reveal with confirmation</button><button id="swap-seats" class="text-button curtain-footer">Wrong person? Swap seats</button></section>`;
  let frame,
    startTime = 0,
    holding = false;
  const release = () => {
    holding = false;
    cancelAnimationFrame(frame);
    $("pass-ready")?.classList.add("resetting");
    $("pass-ready")?.style.setProperty("--hold", "0%");
  };
  const ready = () => {
    release();
    renderGame();
  };
  const hold = () => {
    if (holding) return;
    holding = true;
    $("pass-ready").classList.remove("resetting");
    startTime = performance.now();
    const tick = (now) => {
      if (!holding) return;
      const percent = Math.min(100, (now - startTime) / 8);
      $("pass-ready")?.style.setProperty("--hold", percent + "%");
      if (percent === 100) ready();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  const ring = $("pass-ready");
  ring.onpointerdown = (event) => {
    event.preventDefault();
    ring.setPointerCapture(event.pointerId);
    hold();
  };
  ring.onpointerup = release;
  ring.onpointercancel = release;
  ring.onlostpointercapture = release;
  ring.onkeydown = (event) => {
    if ([" ", "Enter"].includes(event.key)) {
      event.preventDefault();
      hold();
    }
  };
  ring.onkeyup = (event) => {
    if ([" ", "Enter"].includes(event.key)) release();
  };
  ring.onblur = release;
  $("accessible-reveal").onclick = () => {
    showModal(
      "Ready for your turn?",
      "One screen",
      `<p>Only the ${localRole === "giver" ? "clue giver" : "guesser"} should be looking at the screen.</p><button id="confirm-reveal" class="button">I’m ready →</button>`,
    );
    $("confirm-reveal").onclick = () => {
      modal.close();
      ready();
    };
  };
  $("swap-seats").onclick = () => {
    localRole = localRole === "giver" ? "guesser" : "giver";
    saveSession();
    release();
    showPassScreen();
  };
}

function renderGame() {
  if (!game) return;
  if (game.phase === "over") {
    renderReveal();
    return;
  }
  dragCleanup?.();
  dragCleanup = null;
  const focusedCard = document.activeElement?.closest(".card")?.dataset.card,
    focusZone = document.activeElement?.closest("#board,#hand")?.id;
  const keepDrawer = drawerCardId,
    newDeal = renderedGameId !== game.id,
    newMove = renderedRevision !== game.revision;
  setScreen("game");
  drawerCardId = keepDrawer;
  renderedGameId = game.id;
  renderedRevision = game.revision;
  const view = currentView(),
    role = humanRole(),
    myTurn = isHumanTurn(),
    giver = role === "giver",
    n = REMOVALS[view.round],
    latest = view.history.at(-1);
  app.classList.toggle("partner-turn", !myTurn);
  const title = myTurn
    ? giver
      ? `Point them to <span class="gold">${esc(CARDS[view.secret].name)}</span>.`
      : `Remove ${n} ${n === 1 ? "card" : "cards"}.`
    : giver
      ? "Your partner is guessing."
      : "A clue is on its way.";
  app.innerHTML = `<section class="table-header ${giver ? "giver-header" : ""}">${giver ? '<div id="secret-preview"></div>' : ""}<div class="turn-heading"><div class="round-line"><p class="eyebrow">ROUND ${view.round + 1} OF 5${giver ? " · YOUR CLUE" : ""}</p>${progress(view.round, giver)}</div><h1>${title}</h1><p>${giver ? `Your partner removes ${n} ${n === 1 ? "card" : "cards"} after your clue.` : "Keep the secret on the table. Every clue still counts."}</p></div><div id="clue-history" class="clue-rail"></div></section><section class="board-section ${giver ? "giver-board" : ""}"><div class="board" id="board"></div></section>${giver ? `<section class="giver-zone"><div class="drop-zone similar ${clueCard && relation === "similar" ? "filled" : ""}" id="similar" role="button" tabindex="0" aria-label="Choose Similar" aria-pressed="${relation === "similar"}"></div><div class="hand-section"><p class="eyebrow">YOUR HAND · ${view.variant === "fixed" ? view.hand.length + " LEFT · NO REFILLS" : myTurn ? "DRAG UP" : view.hand.length + " CARDS"}</p><div class="hand" id="hand"></div><small>${myTurn ? "Drag a card up. Tap a card, then choose a direction." : "Inspect your hand while your partner guesses."}</small></div><div class="drop-zone different ${clueCard && relation === "different" ? "filled" : ""}" id="different" role="button" tabindex="0" aria-label="Choose Different" aria-pressed="${relation === "different"}"></div></section>` : ""}<div class="action-bar ${giver ? "giver-actions" : ""}">${myTurn ? `<form id="turn-form"><div class="note-control"><button type="button" id="note-toggle" class="text-button" aria-expanded="${noteOpen}">✎ <span>${giver ? "Why?" : "Why these cards?"} Your note stays sealed until the reveal.</span></button><textarea id="turn-note" maxlength="1200" placeholder="Why? Sealed until the reveal" ${noteOpen ? "" : "hidden"}>${esc(draftNote)}</textarea></div><span id="selection-count" class="selection-count"></span>${giver ? "" : '<button type="button" class="text-button" id="clear-selection">Clear</button>'}<button class="button ${giver ? "" : "danger"}" id="confirm-move" type="submit"></button>${!giver && view.round === 4 ? '<button type="button" class="text-button" id="compare-final">Compare</button>' : ""}</form>` : ""}${aiBusy ? `<div class="thinking" role="status"><i></i><i></i><i></i>${esc(modelName())} is reading the table… <button id="cancel-ai" class="text-button">Cancel</button></div>` : ""}${aiError ? `<div class="inline-error" role="alert">${esc(aiError)} <button id="retry-ai" class="button small">Retry turn</button><button id="fix-ai" class="text-button">Settings</button></div>` : ""}${pendingGuess ? '<p role="status">Waiting for your friend to confirm…</p>' : ""}${isPeer() && !peer?.connected ? '<button id="reconnect" class="button secondary">Reconnect →</button>' : ""}${!myTurn && !aiBusy && !aiError && !pendingGuess ? '<p class="help-text">Your partner’s interpretation stays sealed until the reveal.</p>' : ""}</div>`;
  for (let i = 0; i < view.board.length; i++) {
    const id = view.board[i],
      removed = view.eliminated.includes(id);
    const el = mountCard($("board"), id, {
      interactive: true,
      label: String(i + 1).padStart(2, "0"),
      selected: selected.has(id),
      eliminated: removed,
      secret: giver && id === view.secret,
      onClick: () => {
        if (myTurn && !giver && !removed) toggleMark(id);
        else inspectCard(id);
      },
    });
    attachInspect(el, id);
    if (newDeal) {
      el.classList.add("dealt");
      el.style.animationDelay = i * 30 + "ms";
    } else if (newMove && removed && view.history.at(-1)?.removed.includes(id))
      el.classList.add("just-removed");
  }
  if (newDeal) {
    const board = $("board");
    for (const el of board.querySelectorAll(".dealt")) {
      el.style.setProperty(
        "--deal-x",
        board.clientWidth / 2 - el.offsetLeft - el.offsetWidth / 2 + "px",
      );
      el.style.setProperty(
        "--deal-y",
        board.clientHeight / 2 - el.offsetTop - el.offsetHeight / 2 + "px",
      );
    }
  }
  renderClues($("clue-history"), view.history);
  if (newMove && view.phase === "guess")
    $("clue-history").querySelector(".latest")?.classList.add("new-clue");
  if (giver) {
    mountCard($("secret-preview"), view.secret, {
      caption: "none",
      secret: true,
    });
    for (const id of view.hand) {
      const el = mountCard($("hand"), id, {
        interactive: true,
        caption: "none",
        className: clueCard === id ? "chosen" : "",
        onClick: () => {
          if (myTurn) {
            clueCard = id;
            sound("select");
            renderGame();
          } else inspectCard(id);
        },
      });
      attachInspect(el, id);
      el.setAttribute("aria-pressed", String(clueCard === id));
      if (myTurn) attachDrag(el, id);
    }
    for (const dir of ["similar", "different"]) {
      const zone = $(dir);
      if (clueCard && relation === dir) {
        const art = document.createElement("div");
        art.className = "zone-art";
        mountCard(art, clueCard, {
          caption: "none",
          className: dir === "different" ? "sideways" : "",
        });
        zone.append(art);
        zone.insertAdjacentHTML(
          "beforeend",
          `<div><span class="relation ${dir}">${dir === "similar" ? "↑ Similar" : "→ Different"}</span><h3>${esc(CARDS[clueCard].name)}</h3><small>Ready to play. Your note stays sealed.</small></div>`,
        );
      } else
        zone.innerHTML = `<span class="zone-ghost ${dir}"></span><div><strong class="relation ${dir}">${dir === "similar" ? "↑ Similar" : "→ Different"}</strong><p>${dir === "similar" ? "Drop a card here to point toward the secret." : "Drop a card here sideways to point away from it."}</p></div>`;
      const choose = () => {
        if (!myTurn) return;
        relation = dir;
        renderGame();
      };
      zone.onclick = (event) => {
        if (!event.target.closest("form")) choose();
      };
      zone.onkeydown = (event) => {
        if (
          !event.target.closest("form") &&
          [" ", "Enter"].includes(event.key)
        ) {
          event.preventDefault();
          choose();
        }
      };
    }
  }
  if (myTurn) {
    $("turn-note").oninput = (event) => (draftNote = event.target.value);
    $("turn-form").onsubmit = (event) => {
      event.preventDefault();
      submitMove();
    };
    $("note-toggle").onclick = () => {
      noteOpen = !noteOpen;
      renderGame();
      if (noteOpen) $("turn-note").focus();
    };
    if ($("clear-selection"))
      $("clear-selection").onclick = () => {
        selected.clear();
        renderGame();
      };
    updateConfirm();
    if (giver && clueCard && innerWidth > 760) {
      const form = $("turn-form");
      $(relation).lastElementChild.append(form);
      $("turn-note").hidden = false;
    }
  }
  if ($("retry-ai"))
    $("retry-ai").onclick = () => {
      aiError = "";
      runAI();
    };
  if ($("fix-ai")) $("fix-ai").onclick = () => openSettings("ai");
  if ($("cancel-ai"))
    $("cancel-ai").onclick = () => {
      cancelAI();
      aiError = "Request cancelled. Retry when you’re ready.";
      renderGame();
    };
  if ($("reconnect"))
    $("reconnect").onclick = () =>
      openPairing(mode === "peer-host" ? "host" : "guest", true);
  if ($("compare-final")) $("compare-final").onclick = () => compareFinal(view);
  // Keep long secret names on one line on the desktop table.
  if (giver && innerWidth >= 1000) {
    const heading = app.querySelector(".turn-heading h1");
    let size = parseFloat(getComputedStyle(heading).fontSize);
    while (heading.getBoundingClientRect().height > size * 1.3 && size > 24) {
      size -= 2;
      heading.style.fontSize = size + "px";
    }
  }
  if (focusZone && focusedCard)
    $(focusZone)
      ?.querySelector(`[data-card="${focusedCard}"]`)
      ?.focus({ preventScroll: true });
  if (drawerCardId) renderDrawer();
}
function attachDrag(element, id) {
  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest(".card-info")) return;
    const x = event.clientX,
      y = event.clientY;
    let floating = null,
      zone = null,
      moved = false;
    const move = (e) => {
      if (!moved && Math.hypot(e.clientX - x, e.clientY - y) < 8) return;
      moved = true;
      e.preventDefault();
      if (!floating) {
        floating = cardElement(id, { caption: "none" });
        floating.classList.add("drag-card");
        document.body.append(floating);
        element.classList.add("drag-source");
      }
      floating.style.left = e.clientX + "px";
      floating.style.top = e.clientY + "px";
      zone = ["similar", "different"].find((dir) => {
        const r = $(dir).getBoundingClientRect();
        return (
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom
        );
      });
      for (const dir of ["similar", "different"])
        $(dir).classList.toggle("drag-over", zone === dir);
      floating.style.rotate = zone === "different" ? "90deg" : "-4deg";
    };
    const cleanup = () => {
      floating?.remove();
      element.classList.remove("drag-source");
      for (const dir of ["similar", "different"])
        $(dir)?.classList.remove("drag-over");
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      dragCleanup = null;
    };
    const up = () => {
      if (moved) {
        element.addEventListener(
          "click",
          (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
          },
          { once: true, capture: true },
        );
        if (zone) {
          clueCard = id;
          relation = zone;
        }
        cleanup();
        renderGame();
      } else cleanup();
    };
    const cancel = () => cleanup();
    dragCleanup = cleanup;
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
  });
}
function compareFinal(view) {
  comparePins = remaining(view).slice(0, 2);
  inspectCard(comparePins[0], comparePins);
  renderDrawer(true);
}
function renderClues(parent, history) {
  const latest = history.at(-1);
  if (latest) {
    const toggle = document.createElement("button");
    toggle.className = "trail-toggle text-button";
    toggle.textContent = `${history.length} ${history.length === 1 ? "clue" : "clues"} ⌃`;
    toggle.onclick = () => parent.classList.toggle("expanded");
    parent.append(toggle);
  }
  for (const [i, round] of history.entries()) {
    const token = document.createElement("div");
    token.className = `clue-token ${round.relation} ${round === latest ? "latest" : ""}`;
    const art = mountCard(token, round.card, {
      interactive: true,
      caption: "none",
      className: round.relation === "different" ? "sideways" : "",
      onClick: () => inspectCard(round.card),
    });
    attachInspect(art, round.card);
    const copy = document.createElement("div");
    copy.innerHTML = `<small>${String(i + 1).padStart(2, "0")}${round === latest ? " · LATEST" : ""}</small><span class="clue-name">${esc(CARDS[round.card].name)}</span><strong class="relation ${round.relation}">${round.relation === "similar" ? "↑ Similar" : "→ Different"}</strong>`;
    token.append(copy);
    parent.append(token);
  }
  for (let i = history.length; i < 5; i++) {
    const slot = document.createElement("span");
    slot.className = "clue-slot";
    slot.textContent = String(i + 1).padStart(2, "0");
    parent.append(slot);
  }
}
function updateConfirm() {
  const giver = humanRole() === "giver",
    n = REMOVALS[game.round],
    button = $("confirm-move");
  button.disabled =
    (isPeer() && !peer?.connected) ||
    pendingGuess ||
    (giver ? !clueCard : selected.size !== n);
  $("selection-count").textContent = giver
    ? clueCard
      ? CARDS[clueCard].name
      : "Choose a hand card."
    : `${"●".repeat(selected.size)}${"○".repeat(n - selected.size)} ${selected.size} of ${n} marked`;
  const names = [...selected].map((id) => CARDS[id].name);
  button.innerHTML = giver
    ? `Play clue ${relation === "similar" ? "↑" : "→"}`
    : `<span class="desktop-removal">${selected.size === n && n <= 2 ? "Remove " + esc(names.join(" & ")) : `Remove ${n} ${n === 1 ? "card" : "cards"}`}</span><span class="phone-removal">Remove ${n} ${n === 1 ? "card" : "cards"} ${selected.size}/${n}</span>`;
}

function submitMove() {
  try {
    if (!isHumanTurn() || pendingGuess) return;
    const role = humanRole();
    const action =
      role === "giver"
        ? { card: clueCard, relation, rationale: draftNote, source: "Human" }
        : { cards: [...selected], rationale: draftNote, source: "Human" };
    if (mode === "peer-guest") {
      peer.send({
        type: "guess",
        gameId: game.id,
        revision: game.revision,
        action,
      });
      pendingGuess = true;
      renderGame();
      return;
    }
    if (isPeer() && !peer?.connected)
      throw new Error("Reconnect your partner before continuing.");
    commitGame(
      role === "giver" ? playClue(game, action) : eliminate(game, action),
    );
    if (mode === "local" && game.phase !== "over") {
      localRole = role === "giver" ? "guesser" : "giver";
      saveSession();
      showPassScreen();
    } else runAI();
  } catch (error) {
    toast(error.message);
  }
}
function commitGame(next) {
  const oldPhase = game.phase;
  game = next;
  resetTurn();
  saveSession();
  if (mode === "peer-host" && peer?.connected) sendState();
  if (game.phase === "over") {
    replayRound = Math.max(0, game.history.length - 1);
    renderReveal();
  } else {
    sound(oldPhase === "clue" ? "clue" : "select");
    if (mode !== "local") renderGame();
  }
}
async function runAI() {
  if (
    !game ||
    screen !== "game" ||
    !mode?.startsWith("ai-") ||
    isHumanTurn() ||
    game.phase === "over" ||
    aiBusy
  )
    return;
  const generation = ++aiGeneration,
    id = game.id,
    revision = game.revision;
  const role = humanRole() === "giver" ? "guesser" : "giver";
  aiBusy = true;
  aiError = "";
  const controller = new AbortController();
  aiController = controller;
  renderGame();
  const timeout = setTimeout(() => controller.abort(), 180000);
  try {
    const image = observationImage(game, role);
    let next;
    let correction = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      let move;
      try {
        move = await chooseMove(
          settings,
          game,
          role,
          image,
          controller.signal,
          correction,
        );
      } catch (error) {
        if (error.code !== "INVALID_MOVE" || attempt === 1) throw error;
        correction = `Your previous output was invalid: ${error.message} Return ONLY the JSON move with the required fields.`;
        continue;
      }
      if (
        generation !== aiGeneration ||
        game.id !== id ||
        game.revision !== revision
      ) {
        markUsage(move.usageId, "discarded");
        return;
      }
      try {
        next = role === "giver" ? playClue(game, move) : eliminate(game, move);
        break;
      } catch (error) {
        markUsage(move.usageId, "invalid");
        if (attempt === 1) throw error;
        correction = `Your previous move was invalid: ${error.message} Return a corrected legal move.`;
      }
    }
    aiBusy = false;
    commitGame(next);
  } catch (error) {
    if (generation !== aiGeneration) return;
    aiBusy = false;
    aiError =
      error.name === "AbortError"
        ? "The request timed out. Retry this turn or choose a faster model."
        : error.message;
    renderGame();
  } finally {
    clearTimeout(timeout);
    if (generation === aiGeneration) aiController = null;
  }
}
function confirmLeave() {
  showModal(
    "Leave this table?",
    "Game in progress",
    `<p class="pair-copy">${isPeer() ? friendSession()?.connected ? "This table will pause. Your friend stays connected; choose Next game to start another table together." : "Your friend will be disconnected. The clue giver can resume this game and create a fresh invitation." : "Your game is saved on this browser. You can resume it from the opening screen."}</p><div class="pair-actions"><button class="button secondary" id="stay">Keep playing</button><button class="button danger" id="leave-confirm">Leave table</button></div>`,
  );
  $("stay").onclick = () => modal.close();
  $("leave-confirm").onclick = () => {
    saveSession();
    cancelAI();
    const old = peer;
    peer = null;
    old?.close();
    mode = null;
    game = null;
    pairingKind = null;
    modal.close();
    app.hidden = false;
    updateConnection();
    renderHome();
  };
}
function stopReplay() {
  clearTimeout(replayTimer);
  replayPlaying = false;
}
function stepReplay(delta) {
  if (screen !== "reveal") return;
  replayRound = Math.max(
    0,
    Math.min(game.history.length - 1, replayRound + delta),
  );
  renderReveal();
}
function renderReveal() {
  if (!game || game.phase !== "over") return;
  setScreen("reveal");
  app.hidden = false;
  const view = currentView();
  replayRound = Math.max(0, Math.min(replayRound, view.history.length - 1));
  const round = view.history[replayRound],
    win = view.result === "win",
    ai = mode?.startsWith("ai-"),
    canSwap = ai || isPeer();
  const matched = round.expectedRemovals?.filter((id) =>
    round.removed.includes(id),
  ).length;
  const dimensions = {
    role: "Role",
    dates: "Dates / era",
    geography: "Geography",
    stories: "Stories",
    traits: "Traits",
    appearance: "Appearance",
  };
  const notes = (role) => {
    const giver = role === "giver",
      note = giver ? round.giverNote : round.guesserNote,
      source = giver ? round.giverSource : round.guesserSource;
    const label =
      source === "Human"
        ? humanRole() === role
          ? "YOU"
          : giver
            ? "CLUE GIVER"
            : "GUESSER"
        : source || (giver ? "CLUE GIVER" : "GUESSER");
    const dims = giver ? round.giverDimensions : round.guesserDimensions,
      reasons = giver
        ? round.expectedRemovalReasons
        : round.guesserRemovalReasons;
    return `<section class="rationale"><p class="eyebrow">${esc(label)} ${giver ? "MEANT" : "SAW"}</p><blockquote>${esc(note || "No interpretation was recorded.")}</blockquote>${giver && round.expectedRemovals ? `<div class="expected-chips">${round.expectedRemovals.map((id) => `<span class="${round.removed.includes(id) ? "match" : "mismatch"}">${round.removed.includes(id) ? "✓" : "×"} ${esc(CARDS[id].name)}</span>`).join("")}</div>` : ""}${dims?.length ? `<p class="decision-basis">Connections: ${esc(dims.map((d) => dimensions[d] || d).join(" · "))}</p>` : ""}${reasons?.length ? `<details class="decision-reasons"><summary>Card-by-card connections</summary>${reasons.map((r) => `<p><strong>${esc(CARDS[r.card].name)}</strong> ${esc(r.rationale)}</p>`).join("")}</details>` : ""}${!giver && round.keptCards ? `<p class="help-text">Kept: ${esc(round.keptCards.map((id) => CARDS[id].name).join(", "))}</p>` : ""}</section>`;
  };
  app.innerHTML = `<section class="reveal-header"><div id="reveal-secret"></div><div><p class="eyebrow ${win ? "similar" : "different"}">${win ? "WON · ALL FIVE ROUNDS" : "LOST IN ROUND " + view.history.length}</p><h1>${esc(CARDS[view.secret].name)} ${win ? "stayed on" : "left"} the table.</h1><p>${mode === "replay" ? "A saved game." : mode === "local" ? "Two minds, one screen." : isPeer() ? "You played with a friend." : humanRole() === "giver" ? `You gave the clues. ${esc(modelName())} guessed.` : `${esc(modelName())} gave the clues. You guessed.`} Step through to compare what you each meant.</p></div><div class="reveal-controls">${canSwap ? '<button class="button small" id="swap-deal">Swap roles & deal</button>' : ""}<button class="button small ${canSwap ? "secondary" : ""}" id="rematch">Deal again</button><button class="text-button" id="export-replay">Save replay ↓</button><button class="icon-button" id="reveal-home" aria-label="Back to start">✕</button></div></section><div class="replay-layout"><section class="replay-table"><div class="board replay-board" id="replay-board"></div><nav class="replay-scrubber" aria-label="Replay rounds"><button class="replay-play icon-button" id="replay-play" aria-label="${replayPlaying ? "Pause" : "Play"} replay">${replayPlaying ? "Ⅱ" : "▶"}</button><div class="scrubber-track">${view.history.map((r, i) => `<button class="replay-tab ${i === replayRound ? "current" : i < replayRound ? "done" : ""}" data-round="${i}" aria-label="Round ${i + 1}: ${esc(CARDS[r.card].name)}, ${r.relation}" aria-pressed="${i === replayRound}"><span id="scrub-art-${i}" class="scrub-art"></span><i></i><small>${esc(CARDS[r.card].name)} ${r.relation === "similar" ? "↑" : "→"}</small></button>`).join("")}</div><span class="scrubber-label">Round ${replayRound + 1} of ${view.history.length} · ← →</span></nav></section><aside class="interpretation-panel"><div class="replay-clue"><div id="replay-clue"></div><div><p class="eyebrow">ROUND ${round.round} · REMOVE ${REMOVALS[round.round - 1]}</p><h3>${esc(CARDS[round.card].name)}</h3><strong class="relation ${round.relation}">${round.relation === "similar" ? "↑ Similar" : "→ Different"}</strong></div></div>${notes("giver")}${notes("guesser")}${round.expectedRemovals ? `<p class="match-stat"><strong>${matched}/${round.removed.length}</strong> removals matched what you expected</p>` : `<p class="removed-list">Removed: ${esc(round.removed.map((id) => CARDS[id].name).join(", "))}</p>`}</aside></div>`;
  mountCard($("reveal-secret"), view.secret, { caption: "none", secret: true });
  for (let i = 0; i < view.board.length; i++) {
    const id = view.board[i],
      el = mountCard($("replay-board"), id, {
        interactive: true,
        label: String(i + 1).padStart(2, "0"),
        secret: id === view.secret,
        eliminated: !round.active.includes(id),
        selected: round.removed.includes(id),
        roundTag: round.removed.includes(id) ? "R" + round.round : "",
        onClick: () => inspectCard(id),
      });
    attachInspect(el, id);
  }
  mountCard($("replay-clue"), round.card, {
    caption: "none",
    className: round.relation === "different" ? "sideways" : "",
  });
  view.history.forEach((r, i) =>
    mountCard($("scrub-art-" + i), r.card, {
      caption: "none",
      className: r.relation === "different" ? "sideways" : "",
    }),
  );
  app.querySelectorAll("[data-round]").forEach(
    (button) =>
      (button.onclick = () => {
        stopReplay();
        replayRound = Number(button.dataset.round);
        renderReveal();
      }),
  );
  $("replay-play").onclick = () => {
    replayPlaying = !replayPlaying;
    if (replayPlaying && replayRound === view.history.length - 1)
      replayRound = 0;
    renderReveal();
  };
  clearTimeout(replayTimer);
  if (replayPlaying)
    replayTimer = setTimeout(() => {
      if (replayRound < view.history.length - 1) {
        replayRound++;
        renderReveal();
      } else {
        stopReplay();
        renderReveal();
      }
    }, 1600);
  $("rematch").onclick = () => {
    stopReplay();
    if (ai) start(mode);
    else rematch();
  };
  if ($("swap-deal"))
    $("swap-deal").onclick = () => {
      stopReplay();
      if (isPeer()) requestRoleSwap();
      else start(mode === "ai-giver" ? "ai-guesser" : "ai-giver");
    };
  $("export-replay").onclick = exportReplay;
  $("reveal-home").onclick = () => {
    stopReplay();
    cancelAI();
    const old = peer;
    peer = null;
    old?.close();
    mode = null;
    game = null;
    pairingKind = null;
    erase("session");
    updateConnection();
    renderHome();
  };
  if (mode === "peer-guest") {
    $("rematch").textContent = "Ask to deal again";
    $("rematch").disabled = !peer?.connected;
  }
  if (mode === "replay") $("rematch").textContent = "Play this setup →";
  if (mode !== "replay" && lastOutcome !== view.id) {
    lastOutcome = view.id;
    window.scrollTo({ top: 0, behavior: "instant" });
    sound(view.result);
    showOutcome(view);
  }
}

function showOutcome(view) {
  const win = view.result === "win";
  showModal(
    win ? "You both won." : "You both lost.",
    win ? "One shared victory" : "The secret was removed",
    `<canvas class="outcome-canvas" id="outcome-canvas" aria-hidden="true"></canvas><div class="outcome-content"><div class="outcome-emblem" aria-hidden="true">${win ? "✦" : "×"}</div><p class="outcome-summary">${win ? "Five rounds. One card left. You did it together." : "The secret left the table in round " + view.history.length + "."}</p><div id="outcome-secret"></div><p class="outcome-secret-name">${esc(CARDS[view.secret].name)}</p><p class="outcome-caption">${win ? "The secret stayed safe." : "This was the card to protect."}</p><button class="button wide ${win ? "" : "danger"}" id="outcome-continue">See how you each read it →</button></div>`,
  );
  modal.classList.add("outcome-dialog", view.result);
  mountCard($("outcome-secret"), view.secret);
  $("outcome-continue").onclick = () => modal.close();
  $("outcome-continue").focus();
  animateOutcome(
    $("outcome-canvas"),
    view.result,
    settings.effects && !settings.reduceMotion,
  );
  toast(
    win
      ? "You both win! The secret survived all five rounds."
      : "You both lose. The secret was removed in round " +
          view.history.length +
          ".",
  );
}
function rematch() {
  if (mode === "replay") {
    setup.theme = game.theme;
    setup.clueTheme = game.clueTheme === game.theme ? "same" : game.clueTheme;
    setup.variant = game.variant;
    game = null;
    mode = null;
    renderHome();
    return;
  }
  if (mode === "peer-guest") {
    try {
      peer.send({ type: "rematch-request", gameId: game.id });
      toast("Your partner has been asked to deal again.");
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (mode === "peer-host") {
    if (!peer?.connected) {
      toast("Reconnect your friend to deal again.");
      openPairing("host", true);
      return;
    }
    game = createGame({
      theme: game.theme,
      clueTheme: game.clueTheme,
      variant: game.variant,
    });
    resetTurn();
    saveSession();
    sendState();
    renderGame();
    return;
  }
  const oldMode = mode;
  setup.theme = game.theme;
  setup.clueTheme = game.clueTheme === game.theme ? "same" : game.clueTheme;
  setup.variant = game.variant;
  if (oldMode.startsWith("ai-")) {
    showModal(
      "Play another round?",
      "Swap perspectives",
      `<p class="pair-copy">Try the other role and discover how your partner reads your clues.</p><div class="pair-actions"><button class="button" id="swap-roles">Swap roles ↗</button><button class="button secondary" id="same-role">Keep my role</button></div>`,
    );
    $("swap-roles").onclick = () => {
      modal.close();
      start(oldMode === "ai-giver" ? "ai-guesser" : "ai-giver");
    };
    $("same-role").onclick = () => {
      modal.close();
      start(oldMode);
    };
  } else start(oldMode);
}
function exportReplay() {
  const view = viewFor(game, "guesser");
  const blob = new Blob(
    [
      JSON.stringify(
        { format: "cluance-replay", version: PROTOCOL, game: view },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `cluance-${game.theme}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast(
    "Replay saved. It contains the board and revealed notes, with no provider keys.",
  );
}
async function importReplay(file) {
  if (!file) return;
  try {
    if (file.size > 131072) throw new Error("This replay is too large.");
    const replay = JSON.parse(await file.text());
    if (
      !["cluance-replay", "similo-arcade-replay"].includes(replay.format) ||
      replay.version !== PROTOCOL ||
      replay.game?.phase !== "over" ||
      !replay.game.history?.length
    )
      throw new Error("Choose a completed Cluance replay.");
    const imported = validatePublicView(replay.game);
    if (
      imported.history.some(
        (r) =>
          !Number.isInteger(r.round) ||
          r.round < 1 ||
          r.round > 5 ||
          ["giverNote", "guesserNote", "giverSource", "guesserSource"].some(
            (k) => typeof r[k] !== "string" || r[k].length > 1200,
          ),
      )
    )
      throw new Error("This replay contains invalid round notes.");
    cancelAI();
    peer?.close();
    peer = null;
    mode = "replay";
    game = imported;
    replayRound = 0;
    resetTurn();
    updateConnection();
    renderReveal();
  } catch (error) {
    toast(
      error instanceof SyntaxError
        ? "This file is not a valid replay."
        : error.message,
    );
  }
}
function updateConnection() {
  const badge = $("connection-badge");
  badge.hidden = !peer;
  badge.textContent = peer?.connected
    ? "● FRIEND CONNECTED"
    : peerStatus === "connecting"
      ? "◌ CONNECTING"
      : "○ DISCONNECTED";
  badge.classList.toggle("offline", !peer?.connected);
  updatePartner();
}
function sendState() {
  peer.send({ type: "state", game: viewFor(game, "guesser") });
}
function syncOnlineSetup() {
  homeRole = humanRole();
  homePartner = "friend";
  setup.mode = mode;
  if (game) {
    setup.theme = game.theme;
    setup.clueTheme = game.clueTheme === game.theme ? "same" : game.clueTheme;
    setup.variant = game.variant;
  }
  saveSetup();
}
function swapMessage(type, swap, extra = {}) {
  return {
    type,
    requestId: swap.requestId,
    gameId: swap.gameId,
    revision: swap.revision,
    ...extra,
  };
}
function clearRoleSwap() {
  clearTimeout(roleSwapTimer);
  roleSwap = null;
  if (modal.open) modal.close();
}
function cancelRoleSwap() {
  const swap = roleSwap;
  if (!swap || swap.committed) return;
  if (swap.direction === "outgoing" && swap.nextRole === "giver")
    cancelledRoleSwap = swap;
  clearRoleSwap();
  if (peer?.connected) peer.send(swapMessage("role-swap-cancel", swap));
}
function swapRecord(requestId, direction) {
  return {
    requestId,
    direction,
    gameId: game.id,
    revision: game.revision,
    nextRole: humanRole() === "giver" ? "guesser" : "giver",
    options: {
      theme: game.theme,
      clueTheme: game.clueTheme,
      variant: game.variant,
    },
  };
}
function showSwapWaiting() {
  showModal(
    roleSwap.accepted ? "Swapping roles…" : "Waiting for your friend.",
    "Same table, fresh deal",
    `<p>Your next role: <strong>${roleSwap.nextRole === "giver" ? "clue giver" : "guesser"}</strong>.</p><p>${roleSwap.accepted ? "Preparing a fresh secret and hand." : "Your current game stays in place until your friend agrees."}</p>${roleSwap.accepted ? "" : '<button id="cancel-role-swap" class="button secondary">Cancel request</button>'}`,
  );
  modal.className = "role-swap-dialog";
  $("modal-close").hidden = !!roleSwap.accepted;
  if ($("cancel-role-swap")) $("cancel-role-swap").onclick = cancelRoleSwap;
}
function requestRoleSwap() {
  if (!peer?.connected)
    return toast("Reconnect your friend before swapping roles.");
  if (!game || roleSwap || pendingGuess)
    return toast("Wait for the current action to finish.");
  showModal(
    "Swap roles and deal again?",
    "Stay at this table",
    `<p>You’ll ${humanRole() === "giver" ? "guess" : "give the clues"} in a fresh game with the same decks and hand variant. ${game.phase === "over" ? "The connection stays open." : "This ends the current game once your friend agrees."}</p><div class="pair-actions"><button id="ask-role-swap" class="button">Ask to swap roles</button><button id="keep-roles" class="button secondary">Keep playing</button></div>`,
  );
  modal.className = "role-swap-dialog";
  $("keep-roles").onclick = () => modal.close();
  $("ask-role-swap").onclick = () => {
    if (!peer?.connected || !game || roleSwap || pendingGuess)
      return toast("The table has changed. Try again.");
    roleSwap = swapRecord(crypto.randomUUID(), "outgoing");
    peer.send(swapMessage("role-swap-request", roleSwap));
    roleSwapTimer = setTimeout(() => {
      cancelRoleSwap();
      toast("The swap request expired. You can ask again.");
    }, 120000);
    showSwapWaiting();
  };
}
function retireClueGiver(swap) {
  // The previous giver must not keep authority or a resumable private session.
  if (read("session", null)?.game?.id === swap.gameId) erase("session");
  mode = "peer-guest";
  game = null;
  resetTurn();
  syncOnlineSetup();
  app.innerHTML =
    '<p class="help-text">Waiting for your friend’s fresh deal…</p>';
}
function commitRoleSwap() {
  const swap = roleSwap;
  if (!swap?.accepted || mode !== "peer-host") return;
  swap.committed = true;
  clearTimeout(roleSwapTimer);
  peer.send(swapMessage("role-swap-commit", swap));
  retireClueGiver(swap);
  showSwapWaiting();
}
function finishRoleSwap(next, nextMode) {
  clearRoleSwap();
  cancelledRoleSwap = null;
  game = next;
  mode = nextMode;
  resetTurn();
  syncOnlineSetup();
  saveSession();
  trackGame(game, mode);
  updateConnection();
  renderGame();
  toast("Roles swapped. A fresh game is ready.");
}
function handleRoleSwapMessage(message) {
  if (!message.type?.startsWith("role-swap-")) return false;
  const matches = (swap) =>
    swap &&
    message.requestId === swap.requestId &&
    message.gameId === swap.gameId &&
    message.revision === swap.revision;
  if (message.type === "role-swap-request") {
    if (
      typeof message.requestId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(message.requestId) ||
      !game ||
      message.gameId !== game.id ||
      message.revision !== game.revision ||
      roleSwap ||
      pendingGuess
    ) {
      peer.send({
        type: "role-swap-response",
        requestId: message.requestId,
        gameId: message.gameId,
        revision: message.revision,
        accepted: false,
      });
      return true;
    }
    roleSwap = swapRecord(message.requestId, "incoming");
    roleSwapTimer = setTimeout(() => {
      cancelRoleSwap();
      toast("The swap request expired.");
    }, 120000);
    showModal(
      "Your friend wants to swap roles.",
      "Same table, fresh deal",
      `<p>You’ll ${roleSwap.nextRole === "giver" ? "give the clues" : "guess"} in a fresh game with the same decks and hand variant. ${game.phase === "over" ? "You stay connected." : "Accepting ends the current game."}</p><div class="pair-actions"><button id="accept-role-swap" class="button">Swap roles & deal</button><button id="decline-role-swap" class="button secondary">Keep current roles</button></div>`,
    );
    modal.className = "role-swap-dialog";
    $("decline-role-swap").onclick = cancelRoleSwap;
    $("accept-role-swap").onclick = () => {
      roleSwap.accepted = true;
      clearTimeout(roleSwapTimer);
      peer.send(
        swapMessage("role-swap-response", roleSwap, { accepted: true }),
      );
      if (mode === "peer-host") commitRoleSwap();
      else showSwapWaiting();
    };
    return true;
  }
  if (message.type === "role-swap-commit") {
    const swap = matches(roleSwap)
      ? roleSwap
      : matches(cancelledRoleSwap)
        ? cancelledRoleSwap
        : null;
    if (
      !swap ||
      (swap.direction === "incoming" && !swap.accepted) ||
      mode !== "peer-guest" ||
      swap.nextRole !== "giver" ||
      !game ||
      game.id !== swap.gameId ||
      game.revision !== swap.revision
    )
      return true;
    // A committed swap wins a cancellation that crossed it in flight.
    const next = createGame(swap.options);
    peer.send(
      swapMessage("role-swap-start", swap, { game: viewFor(next, "guesser") }),
    );
    finishRoleSwap(next, "peer-host");
    return true;
  }
  if (!matches(roleSwap)) return true;
  if (
    message.type === "role-swap-response" &&
    roleSwap.direction === "outgoing"
  ) {
    if (message.accepted !== true) {
      clearRoleSwap();
      toast("Your roles are unchanged.");
      return true;
    }
    roleSwap.accepted = true;
    clearTimeout(roleSwapTimer);
    if (mode === "peer-host") commitRoleSwap();
    else showSwapWaiting();
  } else if (message.type === "role-swap-cancel") {
    if (roleSwap.committed)
      peer.send(swapMessage("role-swap-commit", roleSwap));
    else {
      clearRoleSwap();
      toast("Your roles are unchanged.");
    }
  } else if (
    message.type === "role-swap-start" &&
    roleSwap.committed &&
    mode === "peer-guest"
  ) {
    const next = validatePublicView(message.game),
      options = roleSwap.options;
    if (
      next.role !== "guesser" ||
      next.id === roleSwap.gameId ||
      next.phase !== "clue" ||
      next.round !== 0 ||
      next.revision !== 0 ||
      next.history.length ||
      next.eliminated.length ||
      next.result !== null ||
      next.theme !== options.theme ||
      next.clueTheme !== options.clueTheme ||
      next.variant !== options.variant
    )
      throw new Error("Your friend sent an incompatible fresh deal.");
    finishRoleSwap(next, "peer-guest");
  }
  return true;
}
function newPeer() {
  const old = peer;
  peer = null;
  old?.close();
  const link = new PeerLink({
    config: pairingConfig || iceConfig(settings.stun),
    onStatus: (status) => {
      if (peer !== link) return;
      peerStatus = status;
      updateConnection();
      if (
        (status === "open" || status === "connected") &&
        link.connected &&
        !link.started
      ) {
        link.started = true;
        pairingKind = null;
        pairingBusy = false;
        pairingError = "";
        if (mode === "peer-host") {
          if (!game) game = createGame(pairingGameOptions || gameOptions());
          syncOnlineSetup();
          saveSession();
          sendState();
          renderGame();
        } else {
          link.send({ type: "hello" });
        }
        modal.close();
        toast("Connected. Your shared table is ready.");
      } else if(status==='signaling-error'){
        pairingBusy=false;pairingError=link.signalingError;if(pairingKind)renderPairing();else toast(pairingError);
      } else if (["closed", "failed", "disconnected"].includes(status)) {
        if (roleSwap) clearRoleSwap();
        cancelledRoleSwap = null;
        pendingGuess = false;
        if (!game && isPeer() && !pairingKind) {
          showModal(
            "Connection lost during the swap.",
            "Reconnect to the table",
            '<p>Ask the new clue giver for a fresh invitation.</p><button id="swap-reconnect" class="button">Join your friend</button>',
          );
          $("swap-reconnect").onclick = () => openPairing("guest", true);
        }
        if (screen === "game") renderGame();
        if (status === "failed") {
          pairingBusy = false;
          pairingError =
            "The browsers could not connect. Try a different network, or change the STUN server in Settings. Open Connection settings to use a TURN relay on restricted networks.";
          if (pairingKind) renderPairing();
          else
            toast("Connection lost. Create a fresh invitation to reconnect.");
        }
      }
    },
    onMessage: (message) => handlePeerMessage(message),
  });
  link.isInviter = pairingKind === "host";
  peer = link;
  updateConnection();
  return link;
}
function handlePeerMessage(message) {
  try {
    if (isPeer() && handleRoleSwapMessage(message)) return;
    if (mode === "peer-host") {
      if (message.type === "hello") {
        sendState();
        return;
      }
      if (message.type === "guess") {
        if (roleSwap)
          throw new Error(
            "Wait for the role-swap request to finish, then choose again.",
          );
        if (
          !game ||
          message.gameId !== game.id ||
          message.revision !== game.revision
        )
          throw new Error(
            "The table has changed. Your move was not applied; choose again.",
          );
        commitGame(eliminate(game, { ...message.action, source: "Human" }));
        return;
      }
      if (
        message.type === "rematch-request" &&
        message.gameId === game?.id &&
        game.phase === "over"
      ) {
        toast(
          "Your friend would like another game. Choose “Deal again” to begin.",
        );
        return;
      }
      throw new Error("Unknown message from your partner.");
    }
    if (mode === "peer-guest") {
      if (message.type === "state") {
        const next = validatePublicView(message.game);
        if (game?.id === next.id && next.revision <= game.revision) return;
        if (game && game.id !== next.id && game.phase !== "over")
          throw new Error("Unexpected new game. Pair again to resynchronize.");
        if (game && next.id === game.id && next.revision > game.revision + 1)
          toast("The table has been resynchronized.");
        const oldPhase = game?.phase;
        if (roleSwap) cancelRoleSwap();
        game = next;
        resetTurn();
        syncOnlineSetup();
        trackGame(game, mode);
        if (next.phase === "over") {
          replayRound = next.history.length - 1;
          renderReveal();
        } else {
          if (oldPhase === "clue" && next.phase === "guess") sound("clue");
          renderGame();
        }
        return;
      }
      if (message.type === "error") {
        if (roleSwap) clearRoleSwap();
        pendingGuess = false;
        toast(String(message.message).slice(0, 500));
        renderGame();
        return;
      }
    }
  } catch (error) {
    if (mode === "peer-host" && peer?.connected)
      peer.send({ type: "error", message: error.message });
    else toast(error.message);
  }
}
function readPairConfig() {
  const stun = $("stun")?.value ?? pairingStun ?? settings.stun;
  relay = {
    url: $("turn")?.value ?? relay.url,
    username: $("turn-name")?.value ?? relay.username,
    credential: $("turn-password")?.value ?? relay.credential,
  };
  const config = iceConfig(stun, relay.url, relay.username, relay.credential);
  settings.stun = stun;
  persistPreferences();
  return config;
}
function openPairing(kind, reconnect = false, initial = "") {
  cancelAI();
  pairingAttempt++;pairingHosted=false;
  const old=peer;peer=null;old?.close();updateConnection();
  pairingKind = kind;
  pairingCode = "";
  pairingError = "";
  pairingBusy = false;
  pairingInput = initial;
  if (!reconnect) {
    game = null;
    resetTurn();
  }
  pairingGameOptions = null;
  if (kind === "host") {
    if (!reconnect) mode = homeRole === "giver" ? "peer-host" : "peer-guest";
    pairingGameOptions = game
      ? { theme: game.theme, clueTheme: game.clueTheme, variant: game.variant }
      : gameOptions();
  } else mode = "peer-guest";
  if (kind === "guest" && reconnect) game = null;
  renderPairing();
  if (kind === "guest" && initial) preparePair("answer", initial);
}
async function preparePair(type,input='',manual=false) {
  if (type === 'answer' && redirectTogetherInvitation('cluance', input)) return;
  const attempt=++pairingAttempt;
  let link;
  pairingBusy=true;pairingError='';pairingInput=input;pairingCode='';renderPairing();
  try {
    let config=readPairConfig(),room;
    if(type==='answer'){
      room=hostedInvitation(input,'cluance');
      let details;
      if(room){room=await roomDetails(room,PROTOCOL);details=validateInvitationDetails(room.metadata);}
      else{await decodePairing(input,'offer');details=invitationDetails(input);}
      if(attempt!==pairingAttempt||!pairingKind)return;
      pairingOffer=input;mode=details.role==='giver'?'peer-guest':'peer-host';pairingGameOptions=details.options||null;
    }else if(!manual&&await signalingService()){
      room=await createHostedRoom('cluance',PROTOCOL,{role:humanRole(),options:pairingGameOptions||gameOptions()});
    }
    if(room)config=await roomConfig(room,config);
    if(attempt!==pairingAttempt||!pairingKind)return;
    pairingHosted=Boolean(room);pairingConfig=config;link=newPeer();renderPairing();
    if(room){
      await link.connectRoom(room,type==='offer'?'host':'guest');
      if(peer!==link||attempt!==pairingAttempt||!pairingKind)return;
      pairingCode=type==='offer'?hostedLink({game:'cluance',room:room.room,key:room.guestKey}):'';
    }else{
      const code=type==='offer'?await link.invite():await link.join(input);
      if(peer!==link||attempt!==pairingAttempt||!pairingKind)return;
      pairingCode=type==='offer'?makeInvitationLink(code,humanRole(),pairingGameOptions):makeLink(code,type);
    }
    pairingBusy=false;pairingInput='';renderPairing();
  }catch(error){
    if(attempt!==pairingAttempt||link&&(peer!==link||!pairingKind))return;
    pairingBusy=false;pairingError=error.message;renderPairing();
  }
}
async function acceptPair(input) {
  if (!peer?.isInviter) {
    toast("Paste the reply in the tab that created the invitation.");
    return;
  }
  const link = peer;
  pairingBusy = true;
  pairingError = "";
  pairingInput = input;
  renderPairing();
  try {
    await link.accept(input);
    if (peer !== link) return;
    pairingBusy = false;
    renderPairing();
  } catch (error) {
    if (peer !== link) return;
    pairingBusy = false;
    pairingError = error.message;
    renderPairing();
  }
}
function renderPairing() {
  if (!pairingKind) return;
  const host = pairingKind === "host";
  const ui=capturePairingUI(modalContent);
  showModal(
    host
      ? pairingCode
        ? "Invitation ready."
        : pairingBusy
          ? "Creating invitation…"
          : "Create an invitation."
      : pairingHosted ? "Connecting to your friend…" : "Join your friend.",
    humanRole() === "giver"
      ? "You give the clues · Your friend guesses"
      : "You guess · Your friend gives the clues",
    pairingBody({
      host,
      output: pairingCode,
      busy: pairingBusy,
      error: pairingError,
      initial: pairingInput,
      stun: pairingStun ?? settings.stun,
      hosted:pairingHosted,
      compact:true,
    }) +
      (host&&pairingHosted?'<button type="button" class="button secondary" data-action="manual-pair">Use manual pairing</button>':'')+
      `<p class="help-text"><button type="button" class="text-button" data-action="${host ? "join-instead" : "invite-instead"}">${host ? "Have an invite? Join instead" : "No invitation yet? Create an invitation instead"}</button></p>`,
  );
  for (const [id, value] of [
    ["turn", relay.url],
    ["turn-name", relay.username],
    ["turn-password", relay.credential],
  ])
    if ($(id)) $(id).value = value;
  enhancePairing(host);
  restorePairingUI(modalContent,ui);
  modalContent.querySelectorAll("[data-action]").forEach(
    (button) =>
      (button.onclick = async () => {
        const action = button.dataset.action;
        try {
          if(action==='paste-pair'){
            const attempt=pairingAttempt,kind=pairingKind;
            let input;
            try{input=await navigator.clipboard.readText();}catch{
              const details=modalContent.querySelector('.manual-reply');if(details)details.open=true;
              $('pair-input')?.focus();toast('Paste the invitation or reply into the field.');return;
            }
            if(attempt!==pairingAttempt||kind!==pairingKind||pairingBusy||peer?.connected)return;
            pairingInput=input;if($('pair-input'))$('pair-input').value=input;
            if(host)await acceptPair(input);else await preparePair('answer',input);
          }
          else if(action==='manual-pair')await preparePair('offer','',true);
          else if (action === "invite-instead") inviteFriend();
          else if (action === "join-instead") {
            const old = peer;
            peer = null;
            old?.close();
            updateConnection();
            openPairing("guest");
          } else if (action === "create-invite") await preparePair("offer");
          else if (action === "join-invite")
            await preparePair("answer", $("pair-input").value);
          else if (action === "remake-reply")
            await preparePair("answer", pairingOffer);
          else if (action === "accept-reply")
            await acceptPair($("pair-input").value);
          else if (action === "copy") {
            await copyPairing($("pair-output"));
            toast(
              host
                ? "Invitation copied. Send it to your friend."
                : "Reply copied. Send it to the host.",
            );
          } else if (action === "share")
            await sharePairing($("pair-output"), "Cluance");
        } catch (error) {
          pairingError=error.message;pairingBusy=false;renderPairing();
        }
      }),
  );
  if ($("pair-input")) {
    $("pair-input").oninput = (event) => {
      pairingInput = event.target.value;
    };
    $("pair-input").onpaste = (event) => {
      const input = event.clipboardData?.getData("text");
      if (!input || pairingBusy) return;
      const task=host?decodePairing(input,"answer").then(()=>acceptPair(input)):preparePair("answer",input);
      task
        .catch((error) => {
          pairingError = error.message;
          renderPairing();
        });
    };
  }
  if ($("pair-qr"))
    try {
      drawQR($("pair-qr"), pairingCode);
    } catch (error) {
      $("pair-qr").parentElement.remove();
      toast(error.message);
    }
}
function enhancePairing(host) {
  modal.classList.add("pairing-dialog");
  for (const b of modalContent.querySelectorAll("[data-action]"))
    b.textContent = b.textContent
      .toLocaleLowerCase()
      .replace(/^./, (c) => c.toUpperCase());
  if (host && pairingCode && !pairingHosted) {
    const input = $("pair-input"),
      button = modalContent.querySelector('[data-action="accept-reply"]'),
      details = document.createElement("details");
    details.className = "manual-reply";
    details.open = !!pairingInput;
    details.innerHTML = "<summary>Paste a reply manually</summary>";
    input.previousElementSibling.before(details);
    details.append(input.previousElementSibling, input, button);
    const paste=modalContent.querySelector('[data-action="paste-pair"]');if(paste)details.before(paste);
  }
}
// Read the clipboard only after an explicit Paste action.
modalContent.addEventListener('input',event=>{
  if(!pairingKind||!modal.classList.contains('pairing-dialog'))return;
  if(event.target.id==='stun')pairingStun=event.target.value;
  const field={'turn':'url','turn-name':'username','turn-password':'credential'}[event.target.id];
  if(field)relay[field]=event.target.value;
});
pairingBus?.addEventListener("message", (event) => {
  if (event.data?.type !== "reply" || !peer?.isInviter || peer.connected)
    return;
  decodePairing(event.data.link, "answer")
    .then((reply) => {
      if (reply.room !== peer.room) return;
      pairingKind = "host";
      renderPairing();
      acceptPair(event.data.link);
    })
    .catch(() => {});
});
async function openPairHash() {
  const params = new URLSearchParams(location.hash.slice(1)),
    invite = params.has("room")?location.href:params.get("invite") || params.get("pair"),
    reply = params.get("reply");
  if (!invite && !reply) return;
  if (redirectTogetherInvitation('cluance', location.href)) return;
  const invitation = params.has("invite")||params.has("room") ? location.href : invite;
  history.replaceState(null, "", location.pathname + location.search);
  if (invite) {
    openPairing("guest", false, invitation);
    return;
  }
  try {
    const decoded = await decodePairing(reply, "answer");
    if (peer?.isInviter && peer.room === decoded.room) {
      pairingKind = "host";
      renderPairing();
      await acceptPair(reply);
    } else {
      const link = makeLink(reply, "answer");
      pairingBus?.postMessage({ type: "reply", link });
      showModal(
        "Back to your table.",
        "Reply ready",
        '<p class="pair-copy">Return to your original hosting tab. The reply was sent there. If it is on another browser, paste this link in that tab.</p><textarea id="return-reply" class="code-box" readonly>' +
          esc(link) +
          "</textarea>",
      );
    }
  } catch (error) {
    toast(error.message);
  }
}
window.addEventListener("hashchange", openPairHash);
function showRules() {
  showModal(
    "A little trust goes a long way.",
    "How to play",
    `<p class="pair-copy">You’re a team. Keep one secret card on the table through five rounds.</p><ol class="rules-list"><li><strong>The clue giver sees the secret.</strong> There are 12 cards on the board and five private cards in the giver’s hand.</li><li><strong>Play one illustrated clue.</strong> Choose Similar ↑ for a shared trait, or Different → for a contrast. It can be a job, an era, a date, geography, a story, a trait, or a visual detail. Inspect cards for their dates and biographies. Only the card and its direction are shared.</li><li><strong>The guesser removes cards.</strong> Remove 1, then 2, then 3, then 4, then 1. All previous clues remain relevant.</li><li><strong>Leave the secret standing.</strong> Removing it ends the game immediately. If it’s the last card left, you both win.</li><li><strong>Open your sealed interpretations.</strong> Optional human notes and AI explanations are recorded with each move, then revealed together at the end.</li></ol><div class="rules-rounds"><span>1</span><span>2</span><span>3</span><span>4</span><span>1</span></div><p class="help-text"><strong>Classic:</strong> draw a new card after each clue.<br><strong>Fixed five:</strong> start with five cards and never draw replacements. Choose the order carefully.<br><strong>Mixed decks:</strong> use one theme for cards and another for clues.</p><p class="help-text">This is an independent game inspired by Similo, designed by Hjalmar Hach, Pierluca Zizzi and Martino Chiacchiera. The illustrations here are original generated artwork; they are not the commercial card art.</p>`,
  );
}
function collectionCards() {
  const query = collectionSearch.toLocaleLowerCase().trim();
  const cards = query
    ? Object.values(DECKS)
        .flatMap((d) => d.cards)
        .filter((c) =>
          [c.name, c.subtitle, c.dates, c.description].some((v) =>
            v.toLocaleLowerCase().includes(query),
          ),
        )
    : [...DECKS[collectionTheme].cards];
  if (collectionSort === "date")
    cards.sort((a, b) => {
      const date = (c) => {
        const m = c.dates.match(/(\d[\d,]*)/);
        return m
          ? Number(m[1].replaceAll(",", "")) *
              (/BCE|BC\b/.test(c.dates) ? -1 : 1)
          : Infinity;
      };
      return date(a) - date(b) || a.name.localeCompare(b.name);
    });
  return cards;
}
function showCollection(theme = collectionTheme) {
  collectionTheme = theme;
  if (modal.open) modal.close();
  setScreen("collection");
  app.innerHTML = `<section class="collection-header"><div><h1>Collection</h1><p>${Object.values(DECKS).reduce((n, d) => n + d.cards.length, 0)} illustrated cards in ${Object.keys(DECKS).length} decks.</p></div><label class="collection-search"><span>⌕</span><input id="collection-search" type="search" placeholder="Search cards, dates, stories…" value="${esc(collectionSearch)}" aria-label="Search across all decks"></label></section><nav class="deck-chips" aria-label="Collection decks">${Object.values(
    DECKS,
  )
    .map(
      (d) =>
        `<button data-deck="${d.id}" class="deck-chip ${d.id === theme ? "selected" : ""}" aria-pressed="${d.id === theme}"><i style="background:${d.color}"></i>${esc(d.name)}</button>`,
    )
    .join(
      "",
    )}</nav><div class="collection-deck-header"><div><h2>${esc(DECKS[theme].name)}</h2><p>${DECKS[theme].cards.length} cards · ${esc(DECKS[theme].subtitle)}</p></div><label>Sort: <select id="collection-sort">${options(
    [
      ["order", "Deck order"],
      ["date", "Date"],
    ],
    collectionSort,
  )}</select></label><button class="button secondary" id="play-deck">Play this deck →</button></div><p id="search-count" class="help-text"></p><div class="collection-grid" id="collection-grid"></div>`;
  const fill = () => {
    const cards = collectionCards();
    $("collection-grid").replaceChildren();
    $("search-count").textContent = collectionSearch
      ? `${cards.length} matching cards across all decks`
      : DECKS[theme].description || "";
    for (const card of cards)
      mountCard($("collection-grid"), card.id, {
        interactive: true,
        onClick: () => inspectCard(card.id),
      });
  };
  fill();
  $("collection-search").oninput = (e) => {
    collectionSearch = e.target.value;
    fill();
  };
  $("collection-sort").onchange = (e) => {
    collectionSort = e.target.value;
    fill();
  };
  app.querySelectorAll("[data-deck]").forEach(
    (btn) =>
      (btn.onclick = () => {
        collectionSearch = "";
        showCollection(btn.dataset.deck);
      }),
  );
  $("play-deck").onclick = () => {
    setup.theme = theme;
    saveSetup();
    renderHome();
  };
}

function gameUsageHTML() {
  const u = gameUsage(game.id),
    guide =
      u.completedTurns && !u.unknown && game.phase !== "over"
        ? `<small>Rough five-round guide: ${formatUSD((u.costUSD / u.completedTurns) * 5)}.<br>Based on this game’s responses; later rounds may differ.</small>`
        : "";
  return `<span>Estimated API cost · this game</span><strong>${esc(formatSpend(u))}</strong><small>${u.requests} ${u.requests === 1 ? "request" : "requests"}${u.unknown ? ` · ${u.unknown} awaiting usage or pricing` : ""}</small>${guide}`;
}
function usagePanelHTML() {
  const data = usageSnapshot(),
    u = data.total,
    count = (n) => n.toLocaleString();
  const modes = {
    "ai-giver": "AI gives clues",
    "ai-guesser": "AI guesses",
    local: "One screen",
    "peer-host": "With a friend",
    "peer-guest": "With a friend",
  };
  const models = [
    ...new Set(data.requests.map((r) => priceKey(r.provider, r.model))),
  ]
    .map((key) => {
      const requests = data.requests.filter(
          (r) => priceKey(r.provider, r.model) === key,
        ),
        summary = usageSummary(requests);
      return `<li><span>${esc(PROVIDERS[requests[0].provider]?.name || requests[0].provider)} · ${esc(requests[0].model)}</span><strong>${esc(formatSpend(summary))}</strong></li>`;
    })
    .join("");
  const rows = [...data.games]
    .sort((a, b) => b.started - a.started)
    .map(
      (g) =>
        `<tr><td><strong>${esc(DECKS[g.theme]?.name || { "flip-it": "Flip it", "midnight-backhand": "Backhand", "midnight-closing": "Closing Time", "midnight-heist": "Pocket Heist" }[g.theme] || g.theme)}</strong><small>${esc(new Date(g.started).toLocaleString())}<br>${esc(modes[g.mode] || g.mode)} · ${g.result === "win" ? "Won" : g.result === "loss" ? "Lost" : g.result === "draw" ? "Draw" : "Unfinished"}<span class="usage-mobile-stats">${g.usage.requests} requests · ${count(g.usage.inputTokens + g.usage.outputTokens)} tokens</span></small></td><td>${g.usage.requests}</td><td>${esc(formatSpend(g.usage))}${g.usage.unknown ? `<small>${g.usage.unknown} unconfirmed / unpriced</small>` : ""}</td><td>${count(g.usage.inputTokens + g.usage.outputTokens)}</td></tr>`,
    )
    .join("");
  return `<p class="help-text">This browser’s recorded games since ${esc(new Date(data.since).toLocaleDateString())}. Costs are in USD; estimates may differ from your provider’s bill. Earlier games cannot be backfilled.</p>
    <div class="usage-metrics"><div><span>Estimated total</span><strong>${esc(formatSpend(u))}</strong></div><div><span>Games recorded</span><strong>${data.games.length}</strong></div><div><span>AI requests</span><strong>${u.requests}</strong></div></div>
    <p class="help-text">${count(u.inputTokens)} input · ${count(u.outputTokens)} output tokens<br>${count(u.cachedTokens)} cached input · ${count(u.cacheWriteTokens)} cache-write tokens<br>${count(u.reasoningTokens)} reasoning tokens reported. Reasoning is already included in output.</p>
    ${u.unknown ? `<p class="help-text usage-warning">Usage or pricing is missing for ${u.unknown} request${u.unknown === 1 ? "" : "s"} or earlier move${u.unknown === 1 ? "" : "s"}. Totals cover known costs only; ≥ means at least. Cancelled or interrupted requests may still be billed.</p>` : ""}
    ${!data.persistent ? '<p class="inline-error">Browser storage is unavailable. These totals are kept only for this visit.</p>' : ""}
    ${models ? `<ul class="usage-models">${models}</ul>` : ""}
    ${rows ? `<div class="usage-table-wrap" tabindex="0" aria-label="All recorded games"><table class="usage-table"><caption>All recorded games</caption><thead><tr><th scope="col">Game</th><th scope="col">Requests</th><th scope="col">Est. USD</th><th scope="col">Tokens</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="help-text">Play a game to start your usage history. Games with human players use no AI requests.</p>'}
    <p class="help-text">Includes correction attempts and responses whose moves were rejected. OpenRouter’s reported cost takes priority; other providers use returned token counts and saved rates. Taxes, special pricing and account-wide activity are outside this estimate. No keys, pictures or sealed notes are saved in the usage history.</p>`;
}
function refreshUsageViews() {
  updatePartner();
  if ($("game-usage") && game) $("game-usage").innerHTML = gameUsageHTML();
  if ($("usage-panel")) $("usage-panel").innerHTML = usagePanelHTML();
  if ($("usage-summary"))
    $("usage-summary").textContent =
      `API usage · ${formatSpend(usageSnapshot().total)} recorded`;
}
window.addEventListener("games-usage-change", refreshUsageViews);
window.addEventListener("storage", (event) => {
  if (
    [
      "games-arcade:usage",
      "cluance-v1:usage",
      "similo-arcade-v1:usage",
    ].includes(event.key)
  )
    refreshUsageViews();
});
let settingsDraft,
  availableModels = [],
  settingsRemember = true,
  pricingError = "";
function renderPriceFields() {
  const provider = settingsDraft.provider,
    model = settingsDraft.models[provider],
    rate = modelPrice(settingsDraft, provider, model);
  const fields = [
    ["input", "Input"],
    ["cachedInput", "Cached input"],
    ["cacheWrite", "Cache writes"],
    ["output", "Output, including reasoning"],
  ];
  $("pricing-fields").dataset.model = model;
  $("pricing-fields").innerHTML =
    `<p class="help-text">USD per million tokens · ${esc(model)}.<br>${rate ? esc(rate.source || "Saved rates") + (rate.verified ? " · checked " + esc(rate.verified) : "") : "No saved rates. OpenRouter can report costs directly; enter rates here to estimate other models."}</p><div class="modal-grid">${fields.map(([key, label]) => `<div class="form-field"><label class="field-label" for="rate-${key}">${label}</label><input type="number" id="rate-${key}" min="0" step="any" placeholder="Unknown" value="${rate?.[key] ?? ""}"></div>`).join("")}</div><p class="help-text">Rates apply to future requests. Leave cache rates blank to estimate those tokens at the input rate. Load OpenRouter models to fetch catalog prices. Provider-reported costs always take priority.</p><p id="pricing-error" class="inline-error" role="alert" hidden></p>`;
}
function capturePricing() {
  pricingError = "";
  if (!$("pricing-fields")) return;
  const provider = settingsDraft.provider,
    model = $("pricing-fields").dataset.model,
    key = priceKey(provider, model);
  const values = Object.fromEntries(
    ["input", "cachedInput", "cacheWrite", "output"].map((k) => [
      k,
      $("rate-" + k).value === "" ? null : Number($("rate-" + k).value),
    ]),
  );
  if (Object.values(values).every((v) => v === null)) {
    delete settingsDraft.prices[key];
    return;
  }
  if (
    values.input === null ||
    values.output === null ||
    Object.values(values).some(
      (v) => v !== null && (!Number.isFinite(v) || v < 0),
    )
  ) {
    pricingError =
      "Enter both input and output rates, or leave all rates blank.";
    return;
  }
  const previous = modelPrice(settingsDraft, provider, model);
  if (previous && Object.keys(values).every((k) => values[k] === previous[k]))
    return;
  settingsDraft.prices[key] = {
    ...values,
    source: "Your custom rates",
    verified: new Date().toISOString().slice(0, 10),
  };
}
function captureSettings() {
  if (!$("provider")) return;
  const provider = settingsDraft.provider;
  capturePricing();
  settingsDraft.keys[provider] = $("api-key").value.trim();
  settingsDraft.models[provider] = $("model").value.trim();
  settingsDraft.efforts[provider] = $("effort").value;
  settingsDraft.tokenBudget = Number($("token-budget").value);
  settingsDraft.stun = $("stun").value.trim();
  settingsDraft.effects = $("effects").checked;
  settingsDraft.sound = $("sound").checked;
  settingsDraft.music = $("music").checked;
  settingsDraft.musicVolume = Number($("music-volume").value);
  settingsDraft.appearance = $("appearance").value;
  settingsDraft.tableCardSize = $("preference-card-size").value;
  settingsDraft.detailsMode = $("details-mode").value;
  settingsDraft.reduceMotion = $("reduce-motion").checked;
  settingsRemember = $("remember-key").checked;
  relay = {
    url: $("turn").value,
    username: $("turn-name").value,
    credential: $("turn-password").value,
  };
}
function openSettings(tab = "game") {
  settingsTab = typeof tab === "string" ? tab : "game";
  settingsDraft = structuredClone(settings);
  availableModels = [];
  settingsRemember = settings.rememberKeys !== false;
  renderSettings();
}
function renderSettings() {
  const provider = settingsDraft.provider,
    info = PROVIDERS[provider];
  showModal(
    "Make yourself at home.",
    "Settings",
    `<details class="usage-panel"><summary id="usage-summary">API usage · ${esc(formatSpend(usageSnapshot().total))} recorded</summary><div id="usage-panel">${usagePanelHTML()}</div></details><form id="settings-form"><div class="modal-grid"><div class="form-field"><label class="field-label" for="appearance">Appearance</label><select id="appearance">${options(
      [
        ["light", "Light"],
        ["dark", "Dark"],
        ["system", "System"],
      ],
      settingsDraft.appearance,
    )}</select></div><div class="form-field"><label class="field-label" for="preference-card-size">Table card size</label><select id="preference-card-size">${options(CARD_SIZES, settingsDraft.tableCardSize)}</select></div></div><div class="form-field"><label class="field-label" for="provider">Provider</label><select id="provider">${options(
      Object.entries(PROVIDERS).map(([id, p]) => [id, p.name]),
      provider,
    )}</select></div>
  <div class="form-field"><label class="field-label" for="api-key">${esc(info.name)} API key</label><div class="form-row"><input id="api-key" type="password" autocomplete="off" spellcheck="false" placeholder="Your personal provider key" value="${esc(settingsDraft.keys[provider] || "")}"><button type="button" class="button small secondary" id="show-key">Show</button></div><label class="check-row"><input type="checkbox" id="remember-key" ${settingsRemember ? "checked" : ""}>Remember keys on this browser</label><p class="help-text">${settingsRemember ? "Saved in this browser’s local storage." : "Kept in memory for this visit."} Keys go directly to your selected provider with AI requests. Browser storage is readable by scripts on this origin; use a personal key with a spending limit. <a href="${info.keyUrl}" target="_blank" rel="noopener noreferrer">Get a key ↗</a></p><button type="button" class="text-button" id="forget-keys">Forget all saved keys</button></div>
  <div class="form-field"><label class="field-label" for="model">Vision model</label><div class="form-row"><input id="model" list="model-list" autocomplete="off" spellcheck="false" value="${esc(settingsDraft.models[provider])}" required><button type="button" class="button small secondary" id="load-models">Load models</button></div><datalist id="model-list">${availableModels.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("")}</datalist><p class="help-text" id="model-status">${availableModels.length ? `${availableModels.length} models available. Select one or enter an exact model ID.` : "Enter an exact model ID, or load the provider’s list. Choose a model that accepts images."}</p></div>
  <div class="modal-grid"><div class="form-field"><label class="field-label" for="effort">Reasoning effort</label><select id="effort">${options(
    info.efforts.map((e) => [
      e,
      e === "default" ? "Provider default" : e[0].toUpperCase() + e.slice(1),
    ]),
    settingsDraft.efforts[provider],
  )}</select></div><div class="form-field"><label class="field-label" for="token-budget">Response token budget</label><select id="token-budget">${options(
    [2048, 4096, 8192, 16384, 32768].map((n) => [
      String(n),
      n.toLocaleString(),
    ]),
    String(settingsDraft.tokenBudget),
  )}</select></div></div><p class="help-text">Effort support depends on the model. “Provider default” leaves it unset. Higher effort may take longer and needs more response tokens. Unsupported choices are reported; they are never silently changed.</p>
  <details class="usage-panel"><summary>Model pricing for estimates</summary><div id="pricing-fields"></div></details>
  <details style="margin-top:20px"><summary class="field-label">Music, effects & connection</summary><label class="check-row"><input id="sound" type="checkbox" ${settingsDraft.sound ? "checked" : ""}>Arcade sounds & outcome fanfares</label><label class="check-row"><input id="music" type="checkbox" ${settingsDraft.music ? "checked" : ""}>Theme background music</label><label class="field-label" for="music-volume">Music volume · <span id="music-volume-value">${settingsDraft.musicVolume}%</span></label><input id="music-volume" type="range" min="0" max="70" step="1" value="${settingsDraft.musicVolume}"><p class="help-text">Original composition: ${esc(THEME_MUSIC[screen === "home" ? setup.theme : game?.theme || setup.theme].title)}.<br>Music follows the board theme, fades between tracks and pauses when this tab is hidden. The top music button pauses music while keeping sound effects unchanged.</p><label class="check-row"><input id="effects" type="checkbox" ${settingsDraft.effects ? "checked" : ""}>Table animations & result effects</label><label class="field-label" for="stun">STUN server for direct pairing</label><input id="stun" value="${esc(settingsDraft.stun)}" spellcheck="false" placeholder="stun:stun.l.google.com:19302"><p class="help-text">Comma-separated STUN URLs. Leave blank to try local-network connections only. Optional TURN relay settings are available in the invitation dialog.</p></details>
  <div class="modal-footer"><span class="help-text">No account with this game.<br>No keys in invitations or replays.</span><button class="button" type="submit">Save settings ✓</button></div></form>`,
  );
  arrangeSettings();
  renderPriceFields();
  $("model").onchange = () => {
    capturePricing();
    settingsDraft.models[settingsDraft.provider] = $("model").value.trim();
    renderPriceFields();
  };
  $("music-volume").oninput = () => {
    $("music-volume-value").textContent = $("music-volume").value + "%";
    $("music").checked = Number($("music-volume").value) > 0;
  };
  $("provider").onchange = (event) => {
    const next = event.target.value;
    captureSettings();
    settingsDraft.provider = next;
    availableModels = [];
    renderSettings();
  };
  $("show-key").onclick = () => {
    const field = $("api-key");
    field.type = field.type === "password" ? "text" : "password";
    $("show-key").textContent = field.type === "password" ? "Show" : "Hide";
  };
  $("forget-keys").onclick = () => {
    settings.keys = {};
    settingsDraft.keys = {};
    write("settings", { ...settings, keys: {} });
    $("api-key").value = "";
    toast("All saved provider keys were removed.");
  };
  $("load-models").onclick = async () => {
    captureSettings();
    const currentProvider = settingsDraft.provider;
    const button = $("load-models"),
      status = $("model-status");
    button.disabled = true;
    status.textContent = "Loading the provider’s model list…";
    try {
      const models = await listModels(
        currentProvider,
        settingsDraft.keys[currentProvider] || "",
        AbortSignal.timeout(20000),
      );
      if (!$("provider") || settingsDraft.provider !== currentProvider) return;
      availableModels = models;
      for (const m of models) {
        if (
          m.pricing &&
          !settingsDraft.prices[
            priceKey(currentProvider, m.id)
          ]?.source?.startsWith("Your custom")
        ) {
          const n = (v) =>
            v === undefined || v === null || v === ""
              ? null
              : Number((Number(v) * 1e6).toPrecision(12));
          const input = n(m.pricing.prompt),
            output = n(m.pricing.completion);
          if (
            Number.isFinite(input) &&
            input >= 0 &&
            Number.isFinite(output) &&
            output >= 0
          )
            settingsDraft.prices[priceKey(currentProvider, m.id)] = {
              input,
              output,
              cachedInput: n(m.pricing.input_cache_read),
              cacheWrite: n(m.pricing.input_cache_write),
              source: "OpenRouter model catalog",
              verified: new Date().toISOString().slice(0, 10),
            };
        }
      }
      renderPriceFields();
      $("model-list").innerHTML = models
        .map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`)
        .join("");
      status.textContent = `${models.length} ${currentProvider === "openrouter" ? "image-capable " : ""}models loaded. You can also enter an exact ID.`;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  $("settings-form").onsubmit = (event) => {
    event.preventDefault();
    captureSettings();
    if (!settingsDraft.models[settingsDraft.provider]) return;
    if (pricingError) {
      modalContent.querySelector("[data-settings-tab=ai]").click();
      $("pricing-fields").closest("details").open = true;
      $("pricing-error").hidden = false;
      $("pricing-error").textContent = pricingError;
      $("pricing-error").scrollIntoView({ block: "nearest" });
      return;
    }
    if (
      settingsDraft.stun &&
      settingsDraft.stun
        .split(",")
        .some((url) => !/^stuns?:[^\s]+$/.test(url.trim()))
    ) {
      toast("Use STUN URLs such as stun:stun.l.google.com:19302.");
      return;
    }
    try {
      relay = {
        url: $("turn")?.value || "",
        username: $("turn-name")?.value || "",
        credential: $("turn-password")?.value || "",
      };
      pairingConfig = iceConfig(
        settingsDraft.stun,
        relay.url,
        relay.username,
        relay.credential,
      );
    } catch (error) {
      toast(error.message);
      return;
    }
    settings = { ...settingsDraft, rememberKeys: settingsRemember };
    const persisted = {
      ...settings,
      keys: settingsRemember ? settings.keys : {},
    };
    const saved = write("settings", persisted);
    saveAI(settings);
    applyPreferences();
    modal.close();
    toast(
      saved
        ? "Settings saved."
        : "Settings kept for this visit; browser storage is unavailable.",
    );
    if (screen === "home") renderHome();
    else if (screen === "game") renderGame();
  };
}
function arrangeSettings() {
  modal.classList.add("settings-dialog");
  const form = $("settings-form"),
    header = modalContent.querySelector(".modal-header");
  header.querySelector("h2").textContent = "Settings";
  header.querySelector(".eyebrow").remove();
  const nav = document.createElement("nav");
  nav.className = "settings-nav";
  nav.setAttribute("aria-label", "Settings categories");
  nav.innerHTML = ["game", "ai", "spending", "network"]
    .map(
      (tab, i) =>
        `<button type="button" data-settings-tab="${tab}">${["Game", "AI partner", "Spending", "Network"][i]}${tab === "spending" ? "<small>" + esc(formatSpend(usageSnapshot().total)) + "</small>" : ""}</button>`,
    )
    .join("");
  modalContent.prepend(nav);
  const content = document.createElement("div");
  content.className = "settings-content";
  form.before(content);
  content.append(form);
  const panels = {};
  for (const tab of ["game", "ai", "spending", "network"]) {
    const panel = document.createElement("section");
    panel.dataset.settingsPanel = tab;
    panels[tab] = panel;
    form.append(panel);
  }
  const appearance = $("appearance").closest(".modal-grid"),
    cardSize = $("preference-card-size").parentElement;
  panels.game.append(appearance);
  const preview = document.createElement("div");
  preview.className = "form-field details-preferences";
  preview.innerHTML = `<p class="field-label">Card details <small>How dates and bios open on the table</small></p><div class="details-choices">${["drawer", "peek"].map((v) => `<button type="button" data-details-mode="${v}" aria-pressed="${settingsDraft.detailsMode === v}"><span class="mini-preview ${v}"><i></i><i></i><i></i><i></i><b></b></span><strong>${v === "drawer" ? "Drawer" : "Peek"}</strong><small>${v === "drawer" ? "Click ⓘ on a card, then ← → to browse." : "Hover, or long-press on touch."}</small></button>`).join("")}</div><input id="details-mode" type="hidden" value="${settingsDraft.detailsMode || "drawer"}">`;
  panels.game.append(preview, cardSize);
  cardSize.classList.add("size-preference");
  const audio = $("sound").closest("details");
  const musicLabel = $("music-volume").previousElementSibling;
  for (const id of ["music", "sound", "effects"]) {
    const label = $(id).closest("label");
    panels.game.append(label);
    const input = $(id);
    label.append(input);
    if (id === "music" || id === "effects") label.hidden = true;
    else label.firstChild.textContent = "Sound effects";
  }
  const volume = document.createElement("div");
  volume.className = "volume-preference";
  volume.append(musicLabel, $("music-volume"));
  panels.game.insertBefore(volume, $("sound").closest("label"));
  musicLabel.firstChild.textContent = "Music · ";
  const reduce = document.createElement("label");
  reduce.className = "check-row";
  reduce.innerHTML = `<span>Reduce motion</span><input id="reduce-motion" type="checkbox" ${settingsDraft.reduceMotion ? "checked" : ""}>`;
  panels.game.append(reduce);
  panels.network.innerHTML =
    '<h3>Connection settings</h3><p class="help-text">Pairing can also use an optional TURN relay. Relay credentials stay in the current session.</p>';
  panels.network.append($("stun").previousElementSibling, $("stun"));
  $("stun").hidden = true;
  $("stun").previousElementSibling.hidden = true;
  panels.network.insertAdjacentHTML(
    "beforeend",
    connectionSettings(settingsDraft.stun)
      .replace(/id="stun"/g, 'id="network-stun"')
      .replace(/for="stun"/g, 'for="network-stun"'),
  );
  panels.network.querySelector(".connection-settings").open = true;
  const existingUsage = $("usage-panel").closest("details");
  panels.spending.append($("usage-panel"));
  existingUsage.remove();
  const pricing = $("pricing-fields").closest("details");
  for (const child of [...form.children])
    if (
      !Object.values(panels).includes(child) &&
      !child.classList.contains("modal-footer") &&
      child !== audio
    )
      panels.ai.append(child);
  panels.ai.append(pricing);
  audio.remove();
  const footer = form.querySelector(".modal-footer");
  form.append(footer);
  const showTab = (tab) => {
    settingsTab = tab;
    for (const [id, panel] of Object.entries(panels)) panel.hidden = id !== tab;
    nav.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("selected", b.dataset.settingsTab === tab);
      b.setAttribute("aria-pressed", String(b.dataset.settingsTab === tab));
    });
  };
  nav
    .querySelectorAll("button")
    .forEach((b) => (b.onclick = () => showTab(b.dataset.settingsTab)));
  showTab(settingsTab);
  preview.querySelectorAll("[data-details-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        $("details-mode").value = b.dataset.detailsMode;
        preview
          .querySelectorAll("button")
          .forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      }),
  );
  for (const [id, value] of [
    ["turn", relay.url],
    ["turn-name", relay.username],
    ["turn-password", relay.credential],
  ])
    $(id).value = value;
  $("network-stun").oninput = (e) => {
    $("stun").value = e.target.value;
  };
  for (const id of ["appearance", "preference-card-size"]) {
    const select = $(id),
      segment = document.createElement("div");
    segment.className = "segmented";
    for (const opt of select.options) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = opt.text;
      b.classList.toggle("selected", opt.value === select.value);
      b.setAttribute("aria-pressed", String(opt.value === select.value));
      b.onclick = () => {
        select.value = opt.value;
        segment.querySelectorAll("button").forEach((c) => {
          c.classList.toggle("selected", c === b);
          c.setAttribute("aria-pressed", String(c === b));
        });
      };
      segment.append(b);
    }
    select.hidden = true;
    select.after(segment);
  }
}
function persistPreferences() {
  write("settings", {
    ...settings,
    keys: settings.rememberKeys === false ? {} : settings.keys,
  });
  saveAI(settings);
}
function applyAppearance() {
  const theme =
    settings.appearance === "system"
      ? colorPreference.matches
        ? "dark"
        : "light"
      : settings.appearance;
  document.documentElement.dataset.colorTheme = theme;
  document.querySelector('meta[name="theme-color"]').content =
    theme === "light" ? "#f5f1e8" : "#14120f";
}
colorPreference.addEventListener("change", () => {
  if (settings.appearance === "system") applyAppearance();
});
function applyPreferences() {
  document.body.classList.toggle(
    "no-effects",
    !settings.effects || settings.reduceMotion,
  );
  applyAppearance();
  document.documentElement.style.setProperty(
    "--table-card-width",
    ({ compact: 136, comfortable: 168, large: 208 }[settings.tableCardSize] ||
      168) + "px",
  );
  const audible = !settings.muted && settings.music,
    button = $("sound-toggle");
  button.textContent = audible ? "♪" : "♩";
  button.setAttribute("aria-pressed", String(audible));
  button.setAttribute(
    "aria-label",
    audible ? "Mute background music" : "Play background music",
  );
  button.title = audible
    ? "Mute music · keep sound effects"
    : "Play background music";
  updateMusic();
}
$("settings-button").onclick = () => openSettings();
$("collection-button").onclick = () => showCollection(setup.theme);
$("rules-button").onclick = showRules;
$("sound-toggle").onclick = () => {
  settings.music = !settings.music;
  persistPreferences();
  applyPreferences();
};
for (const event of ["pointerdown", "keydown"])
  document.addEventListener(
    event,
    (e) => {
      if (e.isTrusted) unlockAudio();
    },
    { passive: true },
  );
$("home-link").onclick = (event) => {
  event.preventDefault();
  if (game && game.phase !== "over") confirmLeave();
  else {
    if (screen === "reveal") $("reveal-home").click();
    else renderHome();
  }
};
window.addEventListener("beforeunload", () => saveSession());
window.addEventListener("pagehide", () => {
  cancelAI();
  peer?.close();
  pairingBus?.close();
});
applyPreferences();
app.innerHTML = `<section class="hero"><div><p class="eyebrow">Setting the table</p><h1>${Object.keys(DECKS).length} worlds.<br>One <em>connection.</em></h1><p>Shuffling the illustrated decks…</p></div></section>`;
try {
  await Promise.all([loadArt(), document.fonts.ready]);
  renderHome();
  await openPairHash();
} catch (error) {
  app.innerHTML = `<p class="inline-error">${esc(error.message)}</p><button class="button" id="reload">Reload artwork</button>`;
  $("reload").onclick = () => location.reload();
}

window.addEventListener("storage", (event) => {
  if (event.key === CONFIG_KEY) {
    Object.assign(settings, loadAI());
    if (!aiBusy && screen === "home") renderHome();
  }
  if (event.key === THEME_KEY) {
    settings.appearance = loadTheme();
    applyPreferences();
  }
});

// Redacted, read-only diagnostics for browser verification.
Object.defineProperty(window, "__cluance", {
  value: {
    get state() {
      return game ? structuredClone(currentView()) : null;
    },
    get connected() {
      return Boolean(peer?.connected);
    },
    get mode() {
      return mode;
    },
  },
});

$("drawer-scrim").onclick = closeDrawer;
$("table-menu").onclick = () => {
  const existing = $("menu-popover");
  if (existing) {
    existing.remove();
    $("table-menu").setAttribute("aria-expanded", "false");
    return;
  }
  const menu = document.createElement("div");
  menu.id = "menu-popover";
  menu.className = "menu-popover";
  menu.innerHTML = `<button id="menu-collection">Collection</button><button id="menu-rules">How to play</button><button id="menu-settings">Settings</button>${isPeer() && game ? '<button id="menu-swap-roles">Swap roles & deal</button>' : ""}${screen === "game" ? '<button id="leave-table">Leave table</button>' : ""}`;
  document.querySelector(".top-actions").append(menu);
  $("table-menu").setAttribute("aria-expanded", "true");
  const close = () => {
    menu.remove();
    $("table-menu").setAttribute("aria-expanded", "false");
  };
  $("menu-rules").onclick = () => {
    close();
    showRules();
  };
  $("menu-settings").onclick = () => {
    close();
    openSettings();
  };
  $("menu-collection").onclick = () => {
    close();
    if (game && game.phase !== "over")
      toast("Leave the table first to browse the collection.");
    else showCollection(setup.theme);
  };
  if ($("menu-swap-roles"))
    $("menu-swap-roles").onclick = () => {
      close();
      requestRoleSwap();
    };
  if ($("leave-table"))
    $("leave-table").onclick = () => {
      close();
      confirmLeave();
    };
};
document.addEventListener("keydown", (event) => {
  if (
    event.target.matches("input,textarea,select") ||
    modal.open ||
    screen === "curtain"
  )
    return;
  if (drawerCardId) {
    if (event.key === "Escape") {
      closeDrawer();
      event.preventDefault();
    } else if (event.key === "ArrowLeft") {
      $("drawer-prev").click();
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      $("drawer-next").click();
      event.preventDefault();
    } else if (event.key.toLowerCase() === "m") {
      $("drawer-mark")?.click();
      event.preventDefault();
    }
    return;
  }
  if (event.key === "Escape") {
    openToken = null;
    $("menu-popover")?.remove();
    $("card-peek").hidden = true;
    if (screen === "home") renderHome();
    return;
  }
  if (screen === "reveal" && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
    stopReplay();
    stepReplay(event.key === "ArrowLeft" ? -1 : 1);
    event.preventDefault();
  }
  if (screen === "game" && humanRole() === "giver" && isHumanTurn()) {
    const key = event.key.toLowerCase();
    if (key === "s" || key === "d") {
      relation = key === "s" ? "similar" : "different";
      renderGame();
      event.preventDefault();
    } else if (
      ["ArrowLeft", "ArrowRight"].includes(event.key) &&
      event.target.closest("#hand")
    ) {
      const i = game.hand.indexOf(event.target.closest(".card").dataset.card),
        next =
          (i + (event.key === "ArrowLeft" ? -1 : 1) + game.hand.length) %
          game.hand.length;
      clueCard = game.hand[next];
      renderGame();
      $("hand").querySelector(`[data-card="${clueCard}"]`).focus();
      event.preventDefault();
    } else if (
      event.key === "Enter" &&
      clueCard &&
      (event.target.closest("#hand") ||
        !event.target.closest('button,[role="button"]'))
    ) {
      submitMove();
      event.preventDefault();
    }
  }
});

matchMedia("(max-width:760px)").addEventListener("change", () => {
  if (screen === "game") renderGame();
});

registerFriendGame('cluance', {
  setup: () => ({role: homeRole, options: gameOptions()}),
  async invite() {
    openPairing('host', Boolean(game));
    await preparePair('offer');
  },
  start({host, metadata}) {
    const details = validateInvitationDetails(metadata);
    cancelAI(); resetTurn();
    game = null;
    mode = (host ? details.role === 'giver' : details.role !== 'giver')
      ? 'peer-host' : 'peer-guest';
    pairingGameOptions = details.options;
    pairingKind = null; pairingBusy = false; pairingCode = ''; pairingInput = '';
    modal.close();
    const link = newPeer();
    link.isInviter = host;
  },
});
