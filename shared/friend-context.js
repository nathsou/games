// The outer page owns WebRTC; game documents may come and go beneath it.
export function friendSession() {
  try {
    const session = window.parent !== window ? window.parent.__friendSession : null;
    return session?.screen?.active ? null : session || null;
  } catch {
    return null;
  }
}

export function sharedPlayActive() {
  try { return window.parent !== window && Boolean(window.parent.__friendSession?.screen?.active); }
  catch { return false; }
}

export function togetherURL(game, action = '') {
  const url = new URL('../together/', location.href);
  url.searchParams.set('game', game);
  if (action) url.searchParams.set('action', action);
  url.hash = location.hash;
  return url.href;
}

export function registerFriendGame(game, adapter) {
  const session = friendSession();
  if (!session) return;
  session.registerGame(game, adapter);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin === location.origin && url.pathname === '/') {
      event.preventDefault();
      session.openPicker();
    }
  });
}

export function redirectTogetherInvitation(game, input) {
  if (friendSession()) return false;
  let invitation;
  try { invitation = new URL(input, location.href); } catch { return false; }
  if (new URLSearchParams(invitation.hash.slice(1)).get('together') !== '1') return false;
  if (invitation.origin !== location.origin || invitation.pathname !== new URL('./', location.href).pathname) {
    throw new Error('Open this invitation link on its original game page.');
  }
  const url = new URL(togetherURL(game));
  url.hash = invitation.hash;
  location.replace(url);
  return true;
}
