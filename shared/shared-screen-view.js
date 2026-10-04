import {SharedScreen} from './shared-screen.js';

export function installSharedScreen(session, render) {
  const $ = id => document.getElementById(id);
  const frame = $('game-frame'), stage = $('game-stage'), surface = $('screen-surface'), cursor = $('friend-cursor');
  let cursorTimer, moveAt = 0;
  function layout() {
    const g = screen.remoteGeometry;
    if (!g) return;
    const scale = Math.min(stage.clientWidth / g.width, stage.clientHeight / g.height);
    surface.style.width = g.width * scale + 'px';
    surface.style.height = g.height * scale + 'px';
    Object.assign(frame.style, {position: 'absolute', left: '50%', top: '50%', width: g.width + 'px', height: g.height + 'px',
      transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center'});
  }
  function showCursor(x, y) {
    clearTimeout(cursorTimer);
    if (x === null || !screen.active) { cursor.hidden = true; return; }
    const rect = session.isHost ? frame.getBoundingClientRect() : surface.getBoundingClientRect();
    const base = stage.getBoundingClientRect();
    cursor.style.left = rect.left - base.left + x * rect.width + 'px';
    cursor.style.top = rect.top - base.top + y * rect.height + 'px';
    cursor.querySelector('small').textContent = session.isHost ? 'Friend' : 'Host';
    cursor.hidden = false;
    cursorTimer = setTimeout(() => { cursor.hidden = true; }, 2000);
  }
  const screen = session.screen = new SharedScreen(session, {
    frame, onChange: render, onGeometry: layout, onCursor: showCursor,
  });
  function sendInput(input) {
    if (!screen.active || session.isHost || !screen.remoteEpoch || !screen.remoteReady) return;
    try { screen.send('input', {input, epoch: screen.remoteEpoch}); } catch { /* Drop input while the channel is congested. */ }
  }
  function pointer(event) {
    if (!screen.active || session.isHost) return;
    const rect = surface.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      if (event.type === 'pointerup' || event.type === 'pointercancel') sendInput({kind: 'pointercancel', x: 0, y: 0});
      return;
    }
    if (event.type === 'pointermove' && performance.now() - moveAt < 33) return;
    moveAt = performance.now();
    if (event.type === 'pointerdown') { surface.focus(); surface.setPointerCapture(event.pointerId); }
    if (event.type !== 'click') event.preventDefault();
    sendInput({kind: event.type, x, y, button: event.button, buttons: event.buttons,
      shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey});
    try { screen.send('cursor', {x, y, epoch: screen.remoteEpoch}); } catch { /* Drop cursor updates while busy. */ }
  }
  for (const type of ['pointermove', 'pointerdown', 'pointerup', 'pointercancel', 'click']) surface.addEventListener(type, pointer);
  surface.addEventListener('contextmenu', event => event.preventDefault());
  surface.addEventListener('wheel', event => {
    if (!screen.active) return;
    event.preventDefault();
    const rect = surface.getBoundingClientRect();
    sendInput({kind: 'wheel', x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height,
      dx: Math.max(-2000, Math.min(2000, event.deltaX)), dy: Math.max(-2000, Math.min(2000, event.deltaY))});
  }, {passive: false});
  for (const kind of ['keydown', 'keyup']) surface.addEventListener(kind, event => {
    if (!screen.active) return;
    if (event.key === 'Tab' || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    sendInput({kind, key: event.key, code: event.code, shift: event.shiftKey});
  });
  const typing = $('screen-typing');
  function insertText() {
    if (typing.value) sendInput({kind: 'text', value: typing.value});
    typing.value = '';
  }
  typing.addEventListener('input', event => { if (!event.isComposing) insertText(); });
  typing.addEventListener('compositionend', insertText);
  typing.addEventListener('beforeinput', event => {
    if (event.inputType === 'deleteContentBackward') {
      event.preventDefault();
      for (const kind of ['keydown', 'keyup']) sendInput({kind, key: 'Backspace', code: 'Backspace'});
    }
  });
  typing.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    for (const kind of ['keydown', 'keyup']) sendInput({kind, key: 'Enter', code: 'Enter'});
  });
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    let last = 0;
    doc?.addEventListener('pointermove', event => {
      if (!event.isTrusted || !screen.active || !session.isHost || performance.now() - last < 33) return;
      last = performance.now();
      try { screen.send('cursor', {x: event.clientX / frame.contentWindow.innerWidth, y: event.clientY / frame.contentWindow.innerHeight, epoch: screen.pageEpoch}); } catch { /* Drop stale moves. */ }
    });
    screen.loaded();
  });
  new ResizeObserver(() => {
    layout();
    if (screen.active && session.isHost) screen.geometry();
  }).observe(stage);
  $('screen-toggle').onclick = () => {
    if (screen.busy) screen.stop();
    else screen.request().catch(error => session.onError(error.message));
  };
  $('screen-accept').onclick = () => screen.accept().catch(error => session.onError(error.message));
  $('screen-decline').onclick = () => screen.stop();
  $('screen-dialog').addEventListener('cancel', event => { event.preventDefault(); screen.stop(); });
  return function renderScreen() {
    $('screen-toggle').hidden = !session.connected;
    $('screen-toggle').disabled = Boolean(session.proposal || session.loading);
    $('screen-toggle').textContent = screen.active ? 'Stop' : screen.busy ? 'Cancel' : 'Cursors';
    $('screen-toggle').setAttribute('aria-label', screen.busy ? 'Stop virtual cursors' : 'Virtual cursors');
    const viewing = screen.active && !session.isHost;
    frame.hidden = false;
    if (!viewing) frame.removeAttribute('style');
    $('shared-view').hidden = !viewing;
    $('screen-wait').hidden = !viewing || screen.remoteReady;
    const dialog = $('screen-dialog');
    const show = ['confirm', 'asked', 'requested', 'offering', 'waiting'].includes(screen.phase);
    if (show) {
      const incoming = screen.phase === 'requested', host = session.isHost;
      $('screen-title').textContent = incoming ? 'Play together with cursors?' : host && screen.phase !== 'offering' ? 'Share this game state?' : 'Waiting for your friend';
      $('screen-copy').textContent = incoming
        ? 'Both of you can control the shared game with virtual cursors. You see the same screen, including visible cards and notes. This ends the current multiplayer table. Chat stays open.'
        : host && screen.phase !== 'offering'
          ? 'Both of you will control the game in this tab and see its full state, including visible cards and notes. This ends the current multiplayer table. Each browser renders the game locally. No screen recording or permission is needed. Stop cursors at any time to return to your room.'
          : 'Your friend can accept or decline. Your friend room stays connected.';
      $('screen-accept').hidden = !['confirm', 'asked', 'requested'].includes(screen.phase);
      $('screen-accept').textContent = host ? 'Share game state' : 'Play together';
      $('screen-decline').textContent = incoming || screen.phase === 'asked' ? 'Keep playing' : 'Cancel';
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) dialog.close();
    layout();
  };
}
