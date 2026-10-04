const credentials = field => field.type === 'password' || field.type === 'file' || /password|secret|token|api.?key|invite|join|pair|credential/i.test(field.id + ' ' + field.name);
function privateControl(node) {
  const field = node?.closest('input,textarea');
  if (field && credentials(field)) return true;
  const panel = node?.closest('dialog,[role=dialog],.modal,.modal-back');
  if (panel && [...panel.querySelectorAll('input,textarea')].some(credentials)) return true;
  const button = node?.closest('button,a');
  if (!button) return false;
  const action = button.dataset.action || button.id || button.getAttribute('aria-label') || button.textContent.trim();
  return /^(?:\W*)(?:copy|clipboard|paste|scan|import|export|download|upload|share|open-replay|load-replay)(?:\b|[-_])/i.test(action);
}
const point = value => Number.isFinite(value) && value >= 0 && value <= 1;
const pointerTypes = ['pointermove', 'pointerdown', 'pointerup', 'pointercancel'];

// Remote input is confined to the shared game document. It cannot operate the
// friend panel, browser chrome, permissions, clipboard or file picker.
export class ScreenInput {
  constructor(frame) { this.frame = frame; this.reset(); }
  edit(target, insert, from = target.selectionStart, to = target.selectionEnd) {
    if (!target.matches('input:not([type=file]):not([type=password]), textarea') || from === null || to === null || target.disabled || target.readOnly || privateControl(target)) return;
    const win = target.ownerDocument.defaultView;
    const value = target.value.slice(0, from) + insert + target.value.slice(to);
    if (target.maxLength >= 0 && value.length > target.maxLength) return;
    const prototype = target.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(target, value);
    target.setSelectionRange(from + insert.length, from + insert.length);
    target.dispatchEvent(new win.InputEvent('input', {bubbles: true, data: insert, inputType: insert ? 'insertText' : 'deleteContentBackward'}));
    target.dispatchEvent(new win.Event('change', {bubbles: true}));
  }
  reset() {
    if (this.drag?.isConnected) this.drag.dispatchEvent(new PointerEvent('pointercancel', {bubbles: true, pointerId: 9001, pointerType: 'mouse'}));
    this.drag = this.clickTarget = null;
    this.windowStarted = Date.now();
    this.count = 0;
  }
  receive(input) {
    if (!input || typeof input !== 'object') return;
    if (Date.now() - this.windowStarted > 1000) { this.windowStarted = Date.now(); this.count = 0; }
    if (++this.count > 120) return;
    const doc = this.frame.contentDocument, win = this.frame.contentWindow;
    if (!doc || !win) return;
    if (pointerTypes.includes(input.kind) || input.kind === 'click' || input.kind === 'wheel') {
      if (!point(input.x) || !point(input.y)) return;
      const clientX = input.x * win.innerWidth, clientY = input.y * win.innerHeight;
      const hit = doc.elementFromPoint(clientX, clientY);
      if (!hit || privateControl(hit)) return;
      const init = {bubbles: true, cancelable: true, clientX, clientY,
        button: [0, 1, 2].includes(input.button) ? input.button : 0,
        buttons: Number.isInteger(input.buttons) && input.buttons >= 0 && input.buttons <= 7 ? input.buttons : 0,
        shiftKey: input.shift === true, altKey: input.alt === true, ctrlKey: input.ctrl === true};
      if (input.kind === 'click') {
        const target = this.clickTarget;
        this.clickTarget = null;
        if (target !== hit || !target?.isConnected) return;
        const anchor = target.closest('a[href]');
        if (anchor && (anchor.origin !== location.origin || anchor.hasAttribute('download') || anchor.target === '_blank')) return;
        // HTMLElement.click supplies default button, checkbox and form actions.
        if (init.button === 0) {
          if (typeof target.click === 'function') target.click();
          else target.dispatchEvent(new win.MouseEvent('click', init));
        }
        else target.dispatchEvent(new win.MouseEvent('contextmenu', init));
      } else if (input.kind === 'wheel') {
        if (![input.dx, input.dy].every(n => Number.isFinite(n) && Math.abs(n) <= 2000)) return;
        const event = new win.WheelEvent('wheel', {...init, deltaX: input.dx, deltaY: input.dy});
        if (!hit.dispatchEvent(event)) return;
        let scroll = hit;
        while (scroll && !(scroll.scrollHeight > scroll.clientHeight && /auto|scroll/.test(win.getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement;
        (scroll || win).scrollBy(input.dx, input.dy);
      } else {
        if (input.kind === 'pointerdown') { this.drag = hit; hit.focus?.({preventScroll: true}); }
        const target = this.drag?.isConnected ? this.drag : hit;
        target.dispatchEvent(new win.PointerEvent(input.kind, {...init, pointerId: 9001, pointerType: 'mouse', isPrimary: true}));
        if (input.kind !== 'pointercancel') target.dispatchEvent(new win.MouseEvent(input.kind.replace('pointer', 'mouse'), init));
        if (target.matches('input[type=range]') && init.buttons === 1 && !target.disabled) {
          const rect = target.getBoundingClientRect(), min = Number(target.min || 0), max = Number(target.max || 100), step = Number(target.step) || 1;
          const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
          target.value = String(Math.min(max, min + Math.round(ratio * (max - min) / step) * step));
          target.dispatchEvent(new win.Event('input', {bubbles: true}));
        }
        if (input.kind === 'pointerup' || input.kind === 'pointercancel') {
          this.clickTarget = input.kind === 'pointerup' && target === hit ? hit : null;
          this.drag = null;
        }
      }
    } else if (input.kind === 'text') {
      if (typeof input.value === 'string' && input.value.length <= 280 && doc.activeElement) this.edit(doc.activeElement, input.value);
    } else if (input.kind === 'keydown' || input.kind === 'keyup') {
      if (typeof input.key !== 'string' || input.key.length > 40 || typeof input.code !== 'string' || input.code.length > 40) return;
      if (input.ctrl || input.alt || input.meta) return;
      const target = doc.activeElement || doc.body;
      if (privateControl(target)) return;
      const event = new win.KeyboardEvent(input.kind, {key: input.key, code: input.code, shiftKey: input.shift === true, bubbles: true, cancelable: true});
      if (!target.dispatchEvent(event) || input.kind !== 'keydown') return;
      if (target.matches('input:not([type=file]):not([type=password]), textarea') && target.selectionStart !== null) {
        const {selectionStart: start, selectionEnd: end, value} = target;
        let from = start, to = end, insert;
        if ([...input.key].length === 1) insert = input.key;
        else if (input.key === 'Backspace') { from = start === end ? Math.max(0, start - 1) : start; insert = ''; }
        else if (input.key === 'Delete') { to = start === end ? end + 1 : end; insert = ''; }
        else if (input.key === 'ArrowLeft' || input.key === 'ArrowRight') {
          const caret = Math.max(0, Math.min(value.length, start + (input.key === 'ArrowLeft' ? -1 : 1)));
          target.setSelectionRange(caret, caret); return;
        } else if (input.key === 'Enter') {
          if (target.tagName === 'TEXTAREA') insert = '\n';
          else { target.form?.requestSubmit(); return; }
        }
        if (insert !== undefined) {
          this.edit(target, insert, from, to);
        }
      } else if (target.matches('select') && ['ArrowDown', 'ArrowUp'].includes(input.key)) {
        target.selectedIndex = Math.max(0, Math.min(target.options.length - 1, target.selectedIndex + (input.key === 'ArrowDown' ? 1 : -1)));
        target.dispatchEvent(new win.Event('change', {bubbles: true}));
      } else if (['Enter', ' '].includes(input.key) && target.matches('button, input[type=checkbox], input[type=radio]')) target.click();
    }
  }
}
