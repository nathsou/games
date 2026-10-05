import {SharedPlay} from './shared-play.js';
import {FRIEND_PAGES} from './friend-pages.js';

export function installSharedPlay(session, render) {
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
    const rect = screen.sharer ? frame.getBoundingClientRect() : surface.getBoundingClientRect();
    const base = stage.getBoundingClientRect();
    cursor.style.left = rect.left - base.left + x * rect.width + 'px';
    cursor.style.top = rect.top - base.top + y * rect.height + 'px';
    cursor.querySelector('small').textContent = session.friend.name || 'Friend';
    cursor.hidden = false;
    cursorTimer = setTimeout(() => { cursor.hidden = true; }, 2000);
  }
  const screen = session.screen = new SharedPlay(session, {
    frame, onChange: render, onGeometry: layout, onCursor: showCursor,
  });
  function sendInput(input) {
    if (!screen.active || screen.sharer || !screen.remoteEpoch || !screen.remoteReady) return;
    try { screen.send('input', {input, epoch: screen.remoteEpoch}); } catch { /* Drop input while the channel is congested. */ }
  }
  function pointer(event) {
    if (!screen.active || screen.sharer) return;
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
      if (!event.isTrusted || !screen.active || !screen.sharer || performance.now() - last < 33) return;
      last = performance.now();
      try { screen.send('cursor', {x: event.clientX / frame.contentWindow.innerWidth, y: event.clientY / frame.contentWindow.innerHeight, epoch: screen.pageEpoch}); } catch { /* Drop stale moves. */ }
    });
    screen.loaded();
  });
  new ResizeObserver(() => {
    layout();
    if (screen.active && screen.sharer) screen.geometry();
  }).observe(stage);
  $('screen-toggle').onclick = () => session.stopCursors();
  return function renderScreen() {
    const viewing = screen.active && !screen.sharer;
    frame.hidden = false;
    if (!viewing) frame.removeAttribute('style');
    $('shared-view').hidden = !viewing;
    $('screen-wait').hidden = !viewing || screen.remoteReady;
    const name = session.friend.name || 'your friend', title = FRIEND_PAGES[session.game] || 'this game';
    $('cursors-bar').hidden = !screen.active;
    $('cursors-text').textContent = screen.phase === 'connecting' ? 'Connecting to ' + name + '…' : screen.sharer ? 'Sharing ' + title + ' with ' + name : 'Playing ' + name + '’s ' + title;
    $('screen-toggle').textContent = screen.sharer ? 'Stop sharing' : 'Leave';
    layout();
  };
}
