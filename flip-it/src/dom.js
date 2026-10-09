// Update trusted, locally generated markup without replacing unchanged cards or controls.
// Event handlers are delegated by app.js, so retained nodes never carry stale closures.
function key(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const d = node.dataset;
  if (d.renderKey) return 'key:' + d.renderKey;
  if (node.id) return 'id:' + node.id;
  if (d.visualCard) return 'card:' + d.visualCard;
  if (d.scoreSeat !== undefined) return 'score:' + d.scoreSeat;
  if (d.handSeat !== undefined) return 'hand:' + d.handSeat;
  if (d.spaceSeat !== undefined) return 'space:' + d.spaceSeat + ':' + d.spaceLane;
  if (d.action) return 'action:' + [d.action, d.owner, d.target, d.lane, d.key, d.value].join(':');
  return node.getAttribute('class')?.split(' ')[0] || '';
}
function compatible(a, b) {
  return a.nodeType === b.nodeType && a.nodeName === b.nodeName && key(a) === key(b);
}
function patch(node, next) {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    if (node.nodeValue !== next.nodeValue) node.nodeValue = next.nodeValue;
    return;
  }
  // Native subtree comparison skips unchanged scoreboards, rivals and card faces.
  // Form controls still synchronize their live properties below.
  if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName) && node.isEqualNode(next)) return;
  const valueChanged = node.getAttribute('value') !== next.getAttribute('value');
  for (const attr of [...node.attributes]) if (!next.hasAttribute(attr.name)) node.removeAttribute(attr.name);
  for (const attr of next.attributes) if (node.getAttribute(attr.name) !== attr.value) node.setAttribute(attr.name, attr.value);
  children(node, next);
  if (node instanceof HTMLInputElement) {
    if (valueChanged) node.value = next.value;
    if (node.type === 'checkbox' || node.type === 'radio') node.checked = next.checked;
  } else if (node instanceof HTMLSelectElement) node.value = next.value;
}
function children(parent, next) {
  const old = [...parent.childNodes];
  const available = new Set(old);
  const keyed = new Map();
  for (const node of old) {
    const k = key(node);
    if (k) { const matches = keyed.get(k) || []; matches.push(node); keyed.set(k, matches); }
  }
  let cursor = parent.firstChild;
  for (const desired of [...next.childNodes]) {
    const k = key(desired);
    const candidates = k ? keyed.get(k) || [] : old;
    const node = candidates.find(n => available.has(n) && compatible(n, desired));
    if (node) {
      available.delete(node);
      if (node !== cursor) parent.insertBefore(node, cursor);
      patch(node, desired);
      cursor = node.nextSibling;
    } else {
      parent.insertBefore(desired, cursor);
    }
  }
  for (const node of available) node.remove();
}
export function updateHTML(root, html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  children(root, template.content);
}
