const KEY = 'games.friend-panel-auto-hide';

export function installPanelVisibility(session) {
  const header = document.getElementById('friend-header'), reveal = document.getElementById('show-friend-panel');
  const checkbox = document.getElementById('header-auto-hide');
  let enabled = true, timer, dragging = false;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* In-memory preference still works. */ }
  checkbox.checked = enabled;
  function show() {
    header.hidden = false;
    reveal.hidden = true;
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (!enabled || session.game === 'collection' && !session.connected) return;
    timer = setTimeout(() => {
      if (dragging || header.contains(document.activeElement) || document.querySelector('dialog[open]') || document.getElementById('friend-settings').open) {
        schedule(); return;
      }
      header.hidden = true;
      reveal.hidden = false;
    }, 3000);
  }
  function attach(doc) {
    doc.addEventListener('pointermove', event => {
      if (!event.isTrusted) return;
      if (event.clientY <= 12 && !dragging) show();
      else schedule();
    });
    doc.addEventListener('pointerdown', () => { dragging = true; clearTimeout(timer); });
    doc.addEventListener('pointerup', () => { dragging = false; schedule(); });
    doc.addEventListener('pointercancel', () => { dragging = false; schedule(); });
    doc.addEventListener('keydown', schedule);
  }
  attach(document);
  document.getElementById('game-frame').addEventListener('load', () => {
    const doc = document.getElementById('game-frame').contentDocument;
    if (doc) attach(doc);
    dragging = false;
    schedule();
  });
  header.addEventListener('focusin', show);
  reveal.onclick = () => { show(); header.querySelector('a').focus(); };
  checkbox.onchange = () => {
    enabled = checkbox.checked;
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* No storage requirement. */ }
    show();
  };
  return () => {
    reveal.textContent = document.getElementById('chat-toggle').textContent.replace('Chat', 'Friends');
    if (!enabled || session.game === 'collection' && !session.connected || document.querySelector('dialog[open]')) show();
    else schedule();
  };
}
