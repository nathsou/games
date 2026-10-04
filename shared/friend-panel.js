// Shared by the collection lobby and the persistent game page.
export const friendPanel = `
  <p id="window-help" class="visually-hidden">Drag to move. When focused, use arrow keys to move, Shift and arrow keys to resize a title bar, Home to reset, and Escape to close a window.</p>
  <button class="social-launcher" id="show-friend-panel" type="button" aria-label="Toggle Friends" aria-describedby="window-help" aria-controls="friend-header" aria-expanded="false" title="Friends · drag to move">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/></svg><span>Friends</span><span class="launcher-badge" hidden></span>
  </button>
  <button class="social-launcher" id="chat-toggle" type="button" aria-label="Toggle Chat" aria-describedby="window-help" aria-expanded="false" aria-controls="friend-chat" title="Chat · drag to move">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z"/></svg><span>Chat</span><span class="launcher-badge" hidden></span>
  </button>
  <aside class="social-window friend-panel" id="friend-header" role="dialog" aria-modal="false" aria-labelledby="friends-title" hidden>
    <header class="window-titlebar" id="friends-titlebar" tabindex="0" aria-label="Move Friends window" aria-describedby="window-help">
      <h1 id="friends-title"><span class="window-grip" aria-hidden="true">⠿</span>Friends</h1>
      <div class="window-controls"><button type="button" data-window-reset aria-label="Reset Friends window placement" title="Reset placement">↺</button><button id="hide-friend-panel" type="button" aria-label="Close Friends" title="Close">×</button></div>
    </header>
    <div class="window-content friends-content">
      <div class="friend-overview"><a href="/" id="collection-link">Game collection</a><span id="friend-status" role="status" aria-live="polite">Loading game…</span></div>
      <div class="friend-actions">
        <button id="invite-friend" type="button" class="primary-action">Invite a friend</button>
        <button id="join-friend" type="button">Join a friend</button>
        <button id="open-friend-chat" type="button">Chat</button>
        <button id="screen-toggle" type="button" aria-label="Virtual cursors" hidden>Cursors</button>
        <button id="reconnect-friend" type="button" hidden>Reconnect</button>
        <button id="disconnect" type="button" hidden>Go offline</button>
      </div>
      <label class="game-picker" for="next-game">Play a game<select id="next-game" aria-label="Next game"><option value="">Choose a game…</option></select></label>
      <section id="turn-inbox" aria-label="Take turns"><h2>Take turns</h2><p class="setup-note">Play when you can. Your friend can be offline.</p><button id="new-turn-game" type="button">Start a turn game</button><div id="turn-games-list"></div><p id="turn-status" role="status"></p></section>
      <details id="saved-games"><summary>Saved games</summary><div id="saved-games-list"></div></details>
      <details class="window-options"><summary>Window options</summary><label class="setup-check"><input id="show-chat-icon" type="checkbox" checked> Show floating chat icon</label><p class="setup-note">Chat is always available from this window.</p></details>
    </div>
  </aside>
  <section class="social-window" id="friend-chat" role="dialog" aria-modal="false" aria-labelledby="chat-title" hidden>
    <header class="window-titlebar" id="chat-titlebar" tabindex="0" aria-label="Move Chat window" aria-describedby="window-help">
      <h2 id="chat-title"><span class="window-grip" aria-hidden="true">⠿</span>Chat</h2>
      <div class="window-controls"><button type="button" data-window-reset aria-label="Reset Chat window placement" title="Reset placement">↺</button><button id="chat-close" type="button" aria-label="Close chat" title="Close">×</button></div>
    </header>
    <div class="window-content chat-content">
      <p id="chat-status">Messages stay with your room.</p>
      <p id="chat-empty">Your conversation lives here, across every game.</p>
      <ol id="chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages"></ol>
      <div class="chat-composer">
        <div id="chat-reactions" aria-label="Reactions"></div>
        <form id="chat-form"><label class="visually-hidden" for="chat-input">Message your friend</label><input id="chat-input" type="text" maxlength="280" placeholder="Message your friend…" autocomplete="off"><button id="chat-send" type="submit" class="primary-action">Send</button></form>
        <p id="chat-error" role="status" hidden></p>
      </div>
    </div>
  </section>
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
    <p id="room-status" role="status">Choose a game, then share a room code or invitation link.</p>
    <fieldset id="room-settings"><label class="setup-field" for="room-game">Play together<select id="room-game"></select></label><label class="setup-field" for="room-play-mode">Play mode<select id="room-play-mode"><option value="live">Live · play at the same time</option><option value="async">Take turns · play whenever</option></select></label><label class="setup-check" id="room-resume-row" hidden><input id="room-resume" type="checkbox"> Resume your saved table</label><div id="room-setup"></div></fieldset>
    <button id="room-create" type="button">Create invitation</button>
    <div id="room-output" hidden>
    <label for="room-code">Room code</label>
    <div class="room-code-row"><input id="room-code" type="text" readonly placeholder="Generating…" aria-describedby="room-code-status"><button id="room-code-copy" type="button" disabled>Copy code</button></div>
    <p id="room-code-status" class="setup-note" role="status"></p>
    <button id="room-code-refresh" type="button" hidden>Get room code</button>
    <p class="setup-note">Your friend can open Friends → Join and enter this code.</p>
    <details id="room-link-details"><summary>Or send an invitation link</summary><label class="visually-hidden" for="room-link">Invitation link</label><input id="room-link" type="text" readonly></details>
    </div>
    <form id="room-join-form" hidden><label class="setup-field" for="room-input">Room code or invitation link<input id="room-input" type="text" placeholder="ABCD-EFGH or invitation link" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="2048" aria-describedby="room-join-help" required></label><p id="room-join-help" class="setup-note">Codes have eight letters and numbers. Spaces, dashes and lowercase letters are fine.</p><button id="room-join" type="submit">Join room</button></form>
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
