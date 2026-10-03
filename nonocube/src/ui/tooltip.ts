/**
 * Lightweight tooltips for any element with `data-tip` (and optional `data-key` for a
 * shortcut badge). Mouse: shown after a short delay, instantly while "warm" (moving between
 * controls). Keyboard focus: shown immediately. Touch: long-press shows the tip and swallows
 * the click, so controls stay discoverable on phones.
 */
const SHOW_DELAY = 280;
const WARM_MS = 700;

let tipEl: HTMLDivElement | null = null;
let current: HTMLElement | null = null;
let showTimer = 0;
let hideTimer = 0;
let lastHidden = 0;
let suppressClick = false;

function el(): HTMLDivElement {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tooltip';
    tipEl.setAttribute('role', 'tooltip');
    document.body.append(tipEl);
  }
  return tipEl;
}

function target(e: Event): HTMLElement | null {
  const t = e.target as HTMLElement | null;
  return t?.closest?.('[data-tip]') ?? null;
}

function show(anchor: HTMLElement): void {
  clearTimeout(hideTimer);
  const text = anchor.dataset.tip;
  if (!text || !anchor.isConnected) return;
  current = anchor;
  const t = el();
  t.replaceChildren(document.createTextNode(text));
  const keys = anchor.dataset.key;
  if (keys)
    for (const k of keys.split(' '))
      t.append(Object.assign(document.createElement('kbd'), { textContent: k }));
  t.classList.remove('below');
  t.style.left = '0px';
  t.style.top = '0px';
  t.classList.add('show');
  const r = anchor.getBoundingClientRect();
  const tr = t.getBoundingClientRect();
  const margin = 8;
  let top = r.top - tr.height - 10;
  if (top < margin || anchor.dataset.tipPos === 'below') {
    top = r.bottom + 10;
    t.classList.add('below');
  }
  let left = r.left + r.width / 2 - tr.width / 2;
  left = Math.max(margin, Math.min(window.innerWidth - tr.width - margin, left));
  t.style.left = `${Math.round(left)}px`;
  t.style.top = `${Math.round(top)}px`;
  t.style.setProperty('--arrow-x', `${Math.round(r.left + r.width / 2 - left)}px`);
}

export function hideTooltip(): void {
  clearTimeout(showTimer);
  if (current) lastHidden = performance.now();
  current = null;
  tipEl?.classList.remove('show');
}

export function installTooltips(): void {
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const t = target(e);
    if (!t || t === current) return;
    clearTimeout(showTimer);
    const warm = performance.now() - lastHidden < WARM_MS || !!current;
    if (warm) show(t);
    else showTimer = window.setTimeout(() => show(t), SHOW_DELAY);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const t = target(e);
    if (!t) return;
    const to = (e.relatedTarget as HTMLElement | null)?.closest?.('[data-tip]');
    if (to === t) return;
    hideTooltip();
  });
  document.addEventListener('focusin', (e) => {
    const t = target(e);
    if (t && (t as HTMLElement).matches(':focus-visible')) show(t);
  });
  document.addEventListener('focusout', () => hideTooltip());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTooltip();
  });
  window.addEventListener('blur', hideTooltip);
  document.addEventListener('wheel', hideTooltip, { passive: true });

  // Touch: long-press reveals the tip.
  let pressTimer = 0;
  document.addEventListener('pointerdown', (e) => {
    clearTimeout(pressTimer);
    if (e.pointerType !== 'touch') {
      hideTooltip();
      return;
    }
    const t = target(e);
    if (!t) return;
    pressTimer = window.setTimeout(() => {
      show(t);
      suppressClick = true;
      navigator.vibrate?.(8);
      hideTimer = window.setTimeout(hideTooltip, 1800);
    }, 450);
  });
  const cancel = () => clearTimeout(pressTimer);
  document.addEventListener('pointerup', cancel);
  document.addEventListener('pointercancel', cancel);
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && (Math.abs(e.movementX) > 4 || Math.abs(e.movementY) > 4)) cancel();
  });
  document.addEventListener(
    'click',
    (e) => {
      if (suppressClick) {
        suppressClick = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
  document.addEventListener('contextmenu', (e) => {
    if (target(e)) e.preventDefault();
  });
}

/** Attach tooltip data to an element. */
export function tip<T extends HTMLElement>(node: T, text: string, key?: string): T {
  node.dataset.tip = text;
  if (key) node.dataset.key = key;
  node.removeAttribute('title');
  return node;
}
