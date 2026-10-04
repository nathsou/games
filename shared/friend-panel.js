// Shared by the collection lobby and the persistent game page.
export const friendPanel = `
  <button id="show-friend-panel" type="button" aria-label="Show friend panel" aria-controls="friend-header" hidden>Friends</button>
  <header class="friend-bar" id="friend-header">
    <a href="/" id="collection-link">Games</a>
    <span id="friend-status" role="status" aria-live="polite">Loading game…</span>
    <label for="next-game">Next game</label>
    <select id="next-game" aria-label="Next game"><option value="">Next game</option></select>
    <div class="friend-actions">
      <button id="invite-friend" type="button">Invite a friend</button>
      <button id="chat-toggle" type="button" aria-expanded="false" aria-controls="friend-chat" hidden>Chat</button>
      <button id="screen-toggle" type="button" aria-label="Virtual cursors" hidden>Cursors</button>
      <button id="disconnect" type="button" hidden>Disconnect</button>
      <details id="friend-settings"><summary aria-label="Friend panel settings">⚙</summary><label><input id="header-auto-hide" type="checkbox"> Auto-hide friend header</label></details>
    </div>
  </header>
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
  <dialog id="friend-dialog" aria-labelledby="dialog-title">
    <h2 id="dialog-title"></h2><p id="dialog-copy"></p>
    <div class="dialog-actions"><button id="accept-switch" type="button">Play together</button><button id="decline-switch" type="button">Keep playing</button></div>
  </dialog>
  <dialog id="room-dialog" aria-labelledby="room-title">
    <h2 id="room-title">Invite a friend to your room</h2>
    <p id="room-status" role="status">Creating an invitation…</p>
    <label for="room-link">Invitation link</label>
    <input id="room-link" type="text" readonly>
    <div class="dialog-actions"><button id="room-copy" type="button" disabled>Copy link</button><button id="room-close" type="button">Close</button></div>
  </dialog>
  <dialog id="screen-dialog" aria-labelledby="screen-title">
    <h2 id="screen-title"></h2><p id="screen-copy"></p>
    <div class="dialog-actions"><button id="screen-accept" type="button">Share game state</button><button id="screen-decline" type="button">Cancel</button></div>
  </dialog>
  <p id="friend-error" role="alert" hidden></p>`;
