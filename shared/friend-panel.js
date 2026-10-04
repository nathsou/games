// Shared by the collection lobby and the persistent game page.
export const friendPanel = `
  <header class="friend-bar">
    <a href="/" id="collection-link">Games</a>
    <span id="friend-status" role="status" aria-live="polite">Loading game…</span>
    <label for="next-game">Next game</label>
    <select id="next-game" aria-label="Next game"><option value="">Choose a game</option></select>
    <div class="friend-actions">
      <button id="invite-friend" type="button">Invite a friend</button>
      <button id="chat-toggle" type="button" aria-expanded="false" aria-controls="friend-chat" hidden>Chat</button>
      <button id="disconnect" type="button" hidden>Disconnect</button>
    </div>
  </header>
  <main id="game-stage"><iframe id="game-frame" title="Current game" allow="clipboard-read; clipboard-write; camera; autoplay"></iframe></main>
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
  <p id="friend-error" role="alert" hidden></p>`;
