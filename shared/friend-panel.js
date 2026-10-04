// Shared by the collection lobby and the persistent game page.
export const friendPanel = `
  <button id="show-friend-panel" type="button" aria-label="Show friend panel" aria-controls="friend-header" aria-expanded="true">Friends</button>
  <aside class="friend-panel" id="friend-header" aria-label="Friends"><div class="panel-heading"><h1>Friends</h1><button id="hide-friend-panel" type="button" aria-label="Hide friend panel">×</button></div>
    <a href="/" id="collection-link">Games</a>
    <span id="friend-status" role="status" aria-live="polite">Loading game…</span>
    <label for="next-game">Next game</label>
    <select id="next-game" aria-label="Next game"><option value="">Next game</option></select>
    <div class="friend-actions">
      <button id="invite-friend" type="button">Invite a friend</button>
      <button id="join-friend" type="button">Join a friend</button>
      <button id="chat-toggle" type="button" aria-expanded="false" aria-controls="friend-chat" hidden>Chat</button>
      <button id="screen-toggle" type="button" aria-label="Virtual cursors" hidden>Cursors</button>
      <button id="reconnect-friend" type="button" hidden>Reconnect</button>
      <button id="disconnect" type="button" hidden>Go offline</button>

    </div>
  <section id="turn-inbox" aria-label="Take turns"><h2>Take turns</h2><p class="setup-note">Play when you can. Your friend can be offline.</p><button id="new-turn-game" type="button">Start a turn game</button><div id="turn-games-list"></div><p id="turn-status" role="status"></p></section>
  <details id="saved-games"><summary>Saved games</summary><div id="saved-games-list"></div></details>
  <section id="friend-chat" aria-label="Friend chat" hidden>
    <div class="chat-heading"><h2>Friend chat</h2><button id="chat-close" type="button" aria-label="Close chat">×</button></div>
    <p id="chat-status">Messages stay in this room while you change games.</p>
    <ol id="chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages"></ol>
    <div id="chat-reactions" aria-label="Reactions"></div>
    <form id="chat-form">
      <label class="visually-hidden" for="chat-input">Message your friend</label>
      <input id="chat-input" type="text" maxlength="280" placeholder="Message your friend…" autocomplete="off">
      <button id="chat-send" type="submit">Send</button>
    </form>
    <p id="chat-error" role="status" hidden></p>
  </section>
  </aside>
  <main id="game-stage">
    <iframe id="game-frame" title="Current game" allow="clipboard-read; clipboard-write; camera; autoplay"></iframe>
    <div id="shared-view" hidden>
      <div id="screen-surface" tabindex="0" aria-label="Shared game. Click, drag or use the keyboard to play."></div>
      <label class="visually-hidden" for="screen-typing">Type in the selected game field</label>
      <input id="screen-typing" type="text" maxlength="280" placeholder="Type in the selected game field…" autocomplete="off" autocapitalize="off">
    </div>
    <span id="friend-cursor" aria-hidden="true" hidden>➤ <small>Friend</small></span>
    <span id="screen-wait" role="status" hidden>Synchronizing the game…</span>
  </main>
  <dialog id="friend-dialog" aria-labelledby="dialog-title">
    <h2 id="dialog-title"></h2><p id="dialog-copy"></p>
    <div class="dialog-actions"><button id="accept-switch" type="button">Play together</button><button id="decline-switch" type="button">Keep playing</button></div>
  </dialog>
  <dialog id="room-dialog" aria-labelledby="room-title">
    <h2 id="room-title">Invite a friend to your room</h2>
    <p id="room-status" role="status">Choose a game and send one link. Your friend connects directly.</p>
    <fieldset id="room-settings"><label class="setup-field" for="room-game">Play together<select id="room-game"></select></label><label class="setup-field" for="room-play-mode">Play mode<select id="room-play-mode"><option value="live">Live · play at the same time</option><option value="async">Take turns · play whenever</option></select></label><label class="setup-check" id="room-resume-row" hidden><input id="room-resume" type="checkbox"> Resume your saved table</label><div id="room-setup"></div></fieldset>
    <button id="room-create" type="button">Create invitation</button>
    <div id="room-output" hidden>
    <label for="room-link">Invitation link</label>
    <input id="room-link" type="text" readonly>
    </div>
    <form id="room-join-form" hidden><label class="setup-field" for="room-input">Invitation link<input id="room-input" type="url" placeholder="Paste your friend’s link" required></label><button id="room-join" type="submit">Connect to friend</button></form>
    <div class="dialog-actions"><button id="room-copy" type="button" disabled>Copy link</button><button id="room-close" type="button">Close</button></div>
  </dialog>
  <dialog id="game-setup-dialog" aria-labelledby="game-setup-title">
    <h2 id="game-setup-title">Play together</h2><p>Choose the settings for your next game. Your friend will see them before accepting.</p>
    <label class="setup-field" for="game-play-mode">Play mode<select id="game-play-mode"><option value="live">Live · play at the same time</option><option value="async">Take turns · play whenever</option></select></label><div id="game-setup-fields"></div><p id="game-setup-error" role="alert" hidden></p>
    <div class="dialog-actions"><button id="game-setup-start" type="button">Ask to play</button><button id="game-setup-cancel" type="button">Cancel</button></div>
  </dialog>
  <dialog id="screen-dialog" aria-labelledby="screen-title">
    <h2 id="screen-title"></h2><p id="screen-copy"></p>
    <div class="dialog-actions"><button id="screen-accept" type="button">Share game state</button><button id="screen-decline" type="button">Cancel</button></div>
  </dialog>
  <p id="friend-error" role="alert" hidden></p>`;
