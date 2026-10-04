type Child = Node | string | null | undefined | false;
type Attrs = Record<string, unknown> & { class?: string; style?: string };

/** Hyperscript-style element builder. `on*` attributes become event listeners. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs)
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k in el && k !== 'style' && k !== 'class' && !k.includes('-')) (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k === 'class' ? 'class' : k, v === true ? '' : String(v));
    }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function icon(svg: string, cls = ''): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = `ico ${cls}`;
  s.innerHTML = svg;
  s.setAttribute('aria-hidden', 'true');
  return s;
}

/** Round icon button with a tooltip (`key` adds a shortcut badge, space-separated). */
export function iconButton(svg: string, label: string, onClick: (e: MouseEvent) => void, cls = '', key?: string): HTMLButtonElement {
  return h('button', { class: `icon-btn ${cls}`, 'aria-label': label, 'data-tip': label, 'data-key': key, onclick: onClick }, icon(svg));
}

export function button(label: string, onClick: (e: MouseEvent) => void, cls = '', svg?: string): HTMLButtonElement {
  return h('button', { class: `btn ${cls}`, onclick: onClick }, svg ? icon(svg) : null, h('span', null, label));
}

export function formatTime(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const hh = Math.floor(m / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh ? `${hh}:${pad(m % 60)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

let toastRoot: HTMLElement | null = null;
export function toast(msg: string, kind: 'info' | 'good' | 'bad' = 'info', ms = 2200): void {
  if (!toastRoot) {
    toastRoot = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.append(toastRoot);
  }
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastRoot.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => {
    t.classList.remove('in');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

/** Modal dialog. Resolves with the value of the pressed action (or null when dismissed). */
export function modal<T extends string>(opts: {
  title: string;
  body?: Node | string;
  actions: { label: string; value: T; cls?: string }[];
  dismissable?: boolean;
  cls?: string;
}): Promise<T | null> {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement as HTMLElement | null;
    let closed = false;
    const close = (v: T | null) => {
      if (closed) return;
      closed = true;
      back.classList.remove('in');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => back.remove(), 220);
      previousFocus?.focus({ preventScroll: true });
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && opts.dismissable !== false) close(null);
      if (e.key === 'Tab') {
        const focusable = [...card.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, summary, [tabindex="0"]')].filter((el) => el.offsetParent !== null);
        const first = focusable[0], last = focusable.at(-1);
        if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    const card = h(
      'div',
      { class: `modal ${opts.cls ?? ''}`, role: 'dialog', tabindex: -1, 'aria-modal': 'true', 'aria-label': opts.title },
      h('h2', null, opts.title),
      opts.dismissable !== false ? h('button', { class: 'icon-btn modal-close', 'aria-label': 'Close dialog', onclick: () => close(null) }, '×') : null,
      typeof opts.body === 'string' ? h('p', null, opts.body) : (opts.body ?? null),
      h('div', { class: 'modal-actions' }, ...opts.actions.map((a) => button(a.label, () => close(a.value), a.cls ?? ''))),
    );
    const back = h('div', { class: 'modal-back' }, card);
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back && opts.dismissable !== false) close(null);
    });
    document.addEventListener('keydown', onKey);
    document.body.append(back);
    requestAnimationFrame(() => back.classList.add('in'));
    card.focus({ preventScroll: true });
  });
}
