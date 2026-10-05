// Shared by the collection lobby and the persistent game page.
const people = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/></svg>';
export const friendPanel = `
  <p id="window-help" class="visually-hidden">Drag to move. When focused, use arrow keys to move, Shift and arrow keys to resize a title bar, Home to reset, and Escape to close a window.</p>
  <button class="social-launcher" id="show-friend-panel" type="button" aria-label="Toggle Play together" aria-describedby="window-help" aria-controls="friend-header" aria-expanded="false" title="Play together · drag to move">
    <span class="launcher-icon">${people}<span class="avatar" hidden></span><span class="presence-dot" hidden></span></span><span class="launcher-label">Friends</span><span class="launcher-badge" hidden></span>
  </button>
  <aside class="social-window friend-panel" id="friend-header" role="dialog" aria-modal="false" aria-labelledby="friends-title" hidden>
    <header class="window-titlebar" id="friends-titlebar" tabindex="0" aria-label="Move Play together window" aria-describedby="window-help">
      <h1 id="friends-title"><span class="window-grip" aria-hidden="true">⠿</span>Play together</h1>
      <div class="window-controls"><button id="open-settings" type="button" aria-label="Room settings" title="Settings" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg></button><button type="button" data-window-reset aria-label="Reset window placement" title="Reset placement">↺</button><button id="hide-friend-panel" type="button" aria-label="Close Play together" title="Close">×</button></div>
    </header>
    <div class="window-content friends-content">
      <section id="view-start" class="panel-view" hidden>
        <h2>Play with a friend</h2>
        <p class="setup-note">Invite one friend to your room. Play at the same time or take turns whenever you like; games are saved for both of you.</p>
        <label class="setup-field" for="my-name">Your name<input id="my-name" type="text" maxlength="24" autocomplete="nickname" placeholder="How your friend sees you"></label>
        <button id="invite-friend" type="button" class="primary-action wide">Invite a friend</button>
        <p class="divider"><span>or join a friend</span></p>
        <form id="join-form"><label class="visually-hidden" for="join-input">Room code or invitation link</label><input id="join-input" type="text" placeholder="Room code, e.g. K7QM-4XPN" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="2048" required><button id="join-friend" type="submit">Join</button></form>
        <p id="start-status" class="form-status" role="status"></p>
      </section>
      <section id="view-invite" class="panel-view" hidden>
        <h2>Invite your friend</h2>
        <p class="setup-note">Share the code or the link. It admits one friend and expires in 24 hours.</p>
        <div class="code-card"><span id="room-code" class="room-code" aria-describedby="room-code-status">····-····</span><button id="room-code-copy" type="button" disabled>Copy code</button></div>
        <div class="invite-actions"><button id="invite-share" type="button" class="primary-action">Share link</button><button id="room-copy" type="button">Copy link</button></div>
        <p id="room-code-status" class="form-status" role="status"></p>
        <details id="invite-qr-details"><summary>Show QR code</summary><canvas id="invite-qr" width="192" height="192" aria-label="Invitation QR code"></canvas></details>
        <p class="waiting-note"><span class="pulse" aria-hidden="true"></span>Waiting for your friend to join. Keep playing; we’ll let you know.</p>
        <button id="room-code-refresh" type="button" class="link-button" hidden>Get a new code</button>
        <button id="cancel-room" type="button" class="link-button">Cancel invitation</button>
      </section>
      <section id="view-room" class="panel-view" hidden>
        <div class="friend-card"><span class="avatar" id="friend-avatar" aria-hidden="true">?</span><div><strong id="friend-name">Friend</strong><span id="friend-status" role="status" aria-live="polite"></span></div></div>
        <div class="tabs" role="tablist" aria-label="Play together">
          <button type="button" role="tab" id="tab-play" aria-controls="panel-play" aria-selected="true">Play</button>
          <button type="button" role="tab" id="tab-games" aria-controls="panel-games" aria-selected="false" tabindex="-1">Games<span class="tab-badge" hidden></span></button>
          <button type="button" role="tab" id="tab-chat" aria-controls="friend-chat" aria-selected="false" tabindex="-1">Chat<span class="tab-badge" hidden></span></button>
        </div>
        <div id="panel-play" class="tab-panel" role="tabpanel" aria-labelledby="tab-play">
          <div id="play-list" class="play-list"></div>
          <h3>Share any game</h3>
          <p class="setup-note" id="share-note">Play a solo game on one screen. You both control it with your own cursor.</p>
          <div id="share-list" class="share-list"></div>
          <a href="/" id="collection-link" class="link-button">Browse all games</a>
        </div>
        <div id="panel-games" class="tab-panel" role="tabpanel" aria-labelledby="tab-games" hidden>
          <div id="turn-games-list"></div>
          <details id="saved-games"><summary>On this device</summary><p class="setup-note">Solo progress saved in this browser.</p><div id="saved-games-list"></div></details>
        </div>
        <div id="friend-chat" class="tab-panel chat-content" role="tabpanel" aria-labelledby="tab-chat" hidden>
          <p id="chat-status" class="visually-hidden">Messages stay with your room.</p>
          <p id="chat-empty">Say hello! Your conversation stays with you in every game.</p>
          <ol id="chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages"></ol>
          <div class="chat-composer">
            <div id="chat-reactions" aria-label="Reactions"></div>
            <form id="chat-form"><label class="visually-hidden" for="chat-input">Message your friend</label><input id="chat-input" type="text" maxlength="280" placeholder="Message your friend…" autocomplete="off"><button id="chat-send" type="submit" class="primary-action">Send</button></form>
            <p id="chat-error" role="status" hidden></p>
          </div>
        </div>
      </section>
    </div>
  </aside>
  <div id="together-alerts" aria-label="Requests"></div>
  <div id="together-toasts" aria-label="Notifications"></div>
  <main id="game-stage">
    <iframe id="game-frame" title="Current game" allow="clipboard-read; clipboard-write; camera; autoplay"></iframe>
    <div id="shared-view" hidden>
      <div id="screen-surface" tabindex="0" aria-label="Shared game. Click, drag or use the keyboard to play."></div>
      <label class="visually-hidden" for="screen-typing">Type in the selected game field</label>
      <input id="screen-typing" type="text" maxlength="280" placeholder="Type in the selected game field…" autocomplete="off" autocapitalize="off">
    </div>
    <span id="friend-cursor" aria-hidden="true" hidden>➤ <small>Friend</small></span>
    <span id="screen-wait" role="status" hidden>Connecting to your friend’s game…</span>
  </main>
  <div id="cursors-bar" role="status" hidden><span id="cursors-text"></span><button id="screen-toggle" type="button">Stop sharing</button></div>
  <dialog id="game-setup-dialog" aria-labelledby="game-setup-title">
    <h2 id="game-setup-title">Play together</h2><p id="game-setup-copy" class="setup-note">Your friend gets a request to join. The game is saved, so either of you can play later.</p>
    <div id="game-setup-fields"></div><p id="game-setup-error" role="alert" hidden></p>
    <div class="dialog-actions"><button id="game-setup-start" type="button" class="primary-action">Start game</button><button id="game-setup-cancel" type="button">Cancel</button></div>
  </dialog>
  <dialog id="settings-dialog" aria-labelledby="settings-title">
    <h2 id="settings-title">Settings</h2>
    <form id="name-form"><label class="setup-field" for="settings-name">Your name<span class="input-row"><input id="settings-name" type="text" maxlength="24" autocomplete="nickname" required><button id="settings-name-save" type="submit">Save</button></span></label></form>
    <fieldset class="settings-group"><legend>Notifications</legend>
      <label class="setup-check"><input id="setting-sound" type="checkbox"> Play a sound for requests, turns and messages</label>
      <label class="setup-check"><input id="setting-system" type="checkbox"> Notify me when this tab is in the background</label>
    </fieldset>
    <p id="settings-status" class="form-status" role="status"></p>
    <div class="settings-room"><button id="show-invitation" type="button" hidden>Show invitation</button><button id="leave-room" type="button" class="danger">Leave room</button></div>
    <div class="dialog-actions"><button id="settings-close" type="button">Done</button></div>
  </dialog>
  <dialog id="confirm-dialog" aria-labelledby="confirm-title">
    <h2 id="confirm-title"></h2><p id="confirm-copy"></p>
    <div class="dialog-actions"><button id="confirm-accept" type="button" class="danger">Confirm</button><button id="confirm-cancel" type="button">Cancel</button></div>
  </dialog>
  <p id="friend-error" role="alert" hidden></p>`;
