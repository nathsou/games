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

export function iconButton(svg: string, label: string, onClick: (e: MouseEvent) => void, cls = ''): HTMLButtonElement {
  return h('button', { class: `icon-btn ${cls}`, 'aria-label': label, title: label, onclick: onClick }, icon(svg));
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
    const close = (v: T | null) => {
      back.classList.remove('in');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => back.remove(), 220);
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && opts.dismissable !== false) close(null);
    };
    const card = h(
      'div',
      { class: `modal ${opts.cls ?? ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title },
      h('h2', null, opts.title),
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
    (card.querySelector('.modal-actions .btn:last-child') as HTMLElement | null)?.focus();
  });
}
