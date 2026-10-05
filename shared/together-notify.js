// Attention, from loudest to quietest: request cards stay until answered; toasts
// fade; a hidden tab flashes its title and icon and, if allowed, shows a system
// notification. Preferences stay in this browser.
const KEY = 'games.together-notify.v1';
const TONES = {request: [[523.25, 0], [659.25, .13], [783.99, .26]], turn: [[587.33, 0], [880, .12]], message: [[880, 0]], join: [[659.25, 0], [987.77, .14]]};

export function installNotifier({alerts, toasts, onOpen = () => {}}) {
  let prefs = {sound: true, system: false};
  try { prefs = {...prefs, ...JSON.parse(localStorage.getItem(KEY))}; } catch { /* Optional storage. */ }
  let baseTitle = document.title, flash, flashText = '', audio, icon, iconHref, pending = 0;
  const cards = new Map(), live = document.createElement('p');
  live.className = 'visually-hidden'; live.setAttribute('aria-live', 'assertive'); document.body.append(live);

  function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* Optional storage. */ } }
  function chime(kind) {
    if (!prefs.sound || !TONES[kind]) return;
    try {
      audio ||= new AudioContext();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const start = audio.currentTime + .02;
      for (const [frequency, offset] of TONES[kind]) {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start + offset);
        gain.gain.linearRampToValueAtTime(kind === 'request' ? .16 : .1, start + offset + .02);
        gain.gain.exponentialRampToValueAtTime(.0001, start + offset + .38);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(start + offset); oscillator.stop(start + offset + .4);
      }
    } catch { /* Audio is optional. */ }
  }
  // Browsers only allow sound after a gesture; unlock it on the first one.
  const unlock = () => { try { audio ||= new AudioContext(); audio.resume?.(); } catch { /* Optional. */ } };
  addEventListener('pointerdown', unlock, {once: true, capture: true});
  addEventListener('keydown', unlock, {once: true, capture: true});

  function favicon(dot) {
    icon ||= document.querySelector('link[rel~=icon]');
    if (!icon) return;
    iconHref ||= icon.href;
    if (!dot) { icon.href = iconHref; return; }
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, 64, 64);
        context.beginPath(); context.arc(48, 16, 15, 0, Math.PI * 2);
        context.fillStyle = '#e5484d'; context.fill();
        context.lineWidth = 4; context.strokeStyle = '#fff'; context.stroke();
        if (pending) icon.href = canvas.toDataURL('image/png');
      } catch { /* Cross-origin icons cannot be redrawn. */ }
    };
    image.src = iconHref;
  }
  function attention(text, {title, body, tag, run} = {}) {
    if (!document.hidden) return;
    pending++;
    flashText = text;
    if (!flash) {
      let on = false;
      flash = setInterval(() => { on = !on; document.title = on ? '● ' + flashText : baseTitle; }, 1200);
      document.title = '● ' + flashText;
    }
    favicon(true);
    if (prefs.system && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title || text, {body: body || '', tag: tag || 'together', icon: iconHref || undefined, renotify: Boolean(tag)});
        notification.onclick = () => { window.focus(); notification.close(); run?.(); };
      } catch { /* Some browsers only allow notifications from a service worker. */ }
    }
  }
  function calm() {
    if (document.hidden) return;
    clearInterval(flash); flash = null; pending = 0;
    document.title = baseTitle; favicon(false);
  }
  document.addEventListener('visibilitychange', calm);
  addEventListener('focus', calm);

  function button(label, primary, run) {
    const element = document.createElement('button');
    element.type = 'button'; element.textContent = label;
    if (primary) element.className = 'primary-action';
    element.onclick = run;
    return element;
  }
  function avatar(name) {
    const element = document.createElement('span');
    element.className = 'avatar'; element.setAttribute('aria-hidden', 'true');
    element.textContent = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return element;
  }

  // A request stays until someone answers or withdraws it.
  function request({key, name, eyebrow, title, body, actions, sound = 'request'}) {
    dismiss(key, false);
    const card = document.createElement('section');
    card.className = 'request-card'; card.setAttribute('role', 'group'); card.setAttribute('aria-label', title);
    const text = document.createElement('div'); text.className = 'request-text';
    const label = document.createElement('p'); label.className = 'request-eyebrow'; label.textContent = eyebrow;
    const heading = document.createElement('h2'); heading.textContent = title;
    text.append(label, heading);
    if (body) { const copy = document.createElement('p'); copy.textContent = body; text.append(copy); }
    const row = document.createElement('div'); row.className = 'request-actions';
    for (const action of actions) row.append(button(action.label, action.primary, () => { dismiss(key); action.run?.(); }));
    card.append(avatar(name), text, row);
    alerts.prepend(card); cards.set(key, card);
    requestAnimationFrame(() => card.classList.add('shown'));
    live.textContent = title + (body ? '. ' + body : '');
    chime(sound);
    attention(title, {title, body, tag: key, run: () => actions.find(action => action.primary)?.run?.()});
    return () => dismiss(key);
  }
  function dismiss(key, animate = true) {
    const card = cards.get(key);
    if (!card) return;
    cards.delete(key);
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { card.remove(); return; }
    card.classList.remove('shown'); card.classList.add('leaving');
    setTimeout(() => card.remove(), 220);
  }

  const shownAt = new Map();
  function toast({key, name, title, body, action, sound, timeout = 6500, notify = true}) {
    if (key) shownAt.set(key, Date.now());
    if (key) toasts.querySelector(`[data-key="${CSS.escape(key)}"]`)?.remove();
    const item = document.createElement('div');
    item.className = 'toast'; item.setAttribute('role', 'status');
    if (key) item.dataset.key = key;
    const text = document.createElement('div'); text.className = 'toast-text';
    const heading = document.createElement('strong'); heading.textContent = title; text.append(heading);
    if (body) { const copy = document.createElement('span'); copy.textContent = body; text.append(copy); }
    item.append(...(name ? [avatar(name)] : []), text);
    if (action) item.append(button(action.label, false, () => { item.remove(); action.run(); }));
    const close = button('×', false, () => item.remove()); close.className = 'toast-close'; close.setAttribute('aria-label', 'Dismiss'); item.append(close);
    toasts.append(item);
    while (toasts.children.length > 3) toasts.firstElementChild.remove();
    requestAnimationFrame(() => item.classList.add('shown'));
    let timer = setTimeout(() => item.remove(), timeout);
    item.addEventListener('pointerenter', () => clearTimeout(timer));
    item.addEventListener('pointerleave', () => { timer = setTimeout(() => item.remove(), 2500); });
    chime(sound);
    if (notify) attention(title, {title, body, tag: key, run: action?.run || onOpen});
  }

  return {
    request, dismiss, toast, chime,
    has: key => cards.has(key),
    recent: (key, within = 8000) => Date.now() - (shownAt.get(key) || 0) < within,
    setTitle(title) { baseTitle = title; if (!flash) document.title = title; },
    get prefs() { return {...prefs}; },
    async setPref(name, value) {
      if (name === 'system' && value) {
        if (!('Notification' in window)) throw Error('This browser does not support notifications.');
        const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
        if (permission !== 'granted') throw Error('Notifications are blocked for this site. Allow them in your browser settings.');
      }
      prefs[name] = Boolean(value); save();
    },
    get systemAvailable() { return 'Notification' in window; },
  };
}
