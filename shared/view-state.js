// Shared play sends a renderable view, never HTML strings, scripts or secrets.
// Stable node IDs preserve canvas contexts and local CSS/font assets on updates.
const tags = new Set(('body main header footer nav section article aside div span p small strong b i em h1 h2 h3 h4 h5 h6 kbd code pre mark s sub sup figure figcaption time output ol ul li dl dt dd button label input textarea select option optgroup form fieldset legend details summary dialog a img canvas br hr table tbody thead tr td th progress meter svg g path rect circle ellipse line polyline polygon text tspan defs symbol use linearGradient radialGradient stop clipPath mask filter feGaussianBlur feOffset feBlend feColorMatrix').split(' '));
const secrets = /password|secret|token|api.?key|invite|join|pair|credential/i;
const commonAttrs = new Set('id class title role dir lang hidden inert tabindex accesskey draggable spellcheck translate style'.split(' '));
const elementAttrs = {
  a: 'href', img: 'src alt width height loading decoding', canvas: 'width height',
  button: 'type disabled name', label: 'for', input: 'type name placeholder disabled readonly required checked min max step minlength maxlength pattern size multiple autocomplete inputmode',
  textarea: 'name placeholder disabled readonly required rows cols minlength maxlength autocomplete',
  select: 'name disabled required multiple size', option: 'disabled selected label', optgroup: 'disabled label',
  form: 'name', fieldset: 'disabled name', details: 'open', dialog: 'open',
  ol: 'start reversed type', li: 'value', time: 'datetime', output: 'for name',
  td: 'colspan rowspan headers', th: 'colspan rowspan headers scope abbr',
  progress: 'max', meter: 'min max low high optimum',
};
const svgAttrs = new Set(('viewbox preserveaspectratio width height x y x1 y1 x2 y2 cx cy r rx ry d points transform fill fill-rule fill-opacity stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset stroke-opacity opacity vector-effect clip-path clip-rule mask filter color font-size font-family font-weight text-anchor dominant-baseline dx dy offset stop-color stop-opacity gradientunits gradienttransform spreadmethod patternunits marker-start marker-mid marker-end stddeviation in in2 result mode type values').split(' '));
// The bundled Nonocube adapter and outer shell share IDs through the document.
const nodeKey = Symbol.for('games.friend-view-node'), counterKey = Symbol.for('games.friend-view-counter');
function nodeID(node) {
  if (!node[nodeKey]) node[nodeKey] = node.ownerDocument[counterKey] = (node.ownerDocument[counterKey] || 0) + 1;
  return node[nodeKey];
}
function asset(value, doc) {
  if (value.startsWith('#')) return value;
  // Puzzle thumbnails are existing local artwork, not live game/screen capture.
  if (/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= 300000) return value;
  try {
    const url = new URL(value, doc.baseURI);
    if (url.origin === location.origin && !url.hash && !url.search && /\.(png|jpe?g|webp|svg|gif|avif)$/.test(url.pathname)) return url.href;
  } catch { /* Ignore invalid asset URLs. */ }
  return null;
}
function attribute(name, value, doc, tag, svg = false) {
  // HTML folds attribute names to lowercase. Validate the same spelling the
  // browser sees, while retaining SVG's case-sensitive attribute names.
  name = name.toLowerCase();
  if (/^on|secret|api.?key|credential|(?:invite|room|auth|access)[-_]?token/i.test(name) || ['value', 'srcdoc', 'action', 'formaction', 'autofocus', 'srcset', 'target', 'download'].includes(name)) return null;
  const allowed = commonAttrs.has(name) || /^(aria|data)-[\w-]+$/.test(name)
    || (svg ? svgAttrs.has(name) || tag === 'use' && ['href', 'xlink:href'].includes(name) : (elementAttrs[tag] || '').split(' ').includes(name));
  if (!allowed) return null;
  if (name === 'src' || name === 'href' || name === 'xlink:href') return asset(value, doc);
  if (name === 'style' && /url\s*\(|@import|expression\s*\(/i.test(value)) return null;
  return value;
}
export function captureView(doc) {
  function visit(node) {
    if (node.nodeType === 3) return {id: nodeID(node), text: node.textContent};
    if (node.nodeType !== 1 || !tags.has(node.localName)) return null;
    const attrs = {};
    for (const {name, value} of node.attributes) {
      if (node.localName === 'canvas' && ['width', 'height'].includes(name)) continue;
      const safe = attribute(name, value, doc, node.localName, node.namespaceURI.includes('svg'));
      if (safe !== null) attrs[name] = safe;
    }
    const sensitive = node.matches('input,textarea') && (node.type === 'password' || node.type === 'file' || node.readOnly || secrets.test(node.id + ' ' + node.name));
    const children = sensitive ? [] : [...node.childNodes].map(visit).filter(Boolean);
    const view = {id: nodeID(node), tag: node.localName, svg: node.namespaceURI.includes('svg'), attrs, children};
    if (node.matches('input,textarea,select') && !sensitive) view.value = node.value;
    if (node.matches('input')) view.checked = node.checked;
    if (node.matches('dialog')) view.modal = node.matches(':modal');
    if (node.scrollTop || node.scrollLeft) view.scroll = [node.scrollLeft, node.scrollTop];
    return view;
  }
  return {tree: visit(doc.body), theme: doc.documentElement.dataset.theme || '', colorTheme: doc.documentElement.dataset.colorTheme || '', appearance: {style: doc.documentElement.getAttribute('style') || '', class: doc.documentElement.className}, scroll: [doc.defaultView.scrollX, doc.defaultView.scrollY]};
}
export function applyView(doc, view, cache) {
  let count = 0;
  const used = new Set();
  function visit(data) {
    if (++count > 12000 || !data || !Number.isInteger(data.id) || used.has(data.id)) throw new Error('Invalid shared view.');
    used.add(data.id);
    let node = cache.get(data.id);
    if (typeof data.text === 'string') {
      if (!node || node.nodeType !== 3) node = doc.createTextNode('');
      if (node.textContent !== data.text) node.textContent = data.text;
    } else {
      if (!tags.has(data.tag) || !Array.isArray(data.children) || !data.attrs || typeof data.attrs !== 'object') throw new Error('Invalid shared element.');
      if (!node || node.localName !== data.tag) node = data.tag === 'body' ? doc.body : data.svg
        ? doc.createElementNS('http://www.w3.org/2000/svg', data.tag) : doc.createElement(data.tag);
      const safeAttrs = new Map();
      for (const [name, value] of Object.entries(data.attrs)) {
        if (!/^[a-zA-Z][\w:.-]*$/.test(name) || typeof value !== 'string') continue;
        const safe = attribute(name, value, doc, data.tag, Boolean(data.svg));
        if (safe !== null) safeAttrs.set(data.svg ? name : name.toLowerCase(), safe);
      }
      for (const {name} of [...node.attributes]) {
        if (node.localName === 'canvas' && ['width', 'height'].includes(name)) continue;
        if (!safeAttrs.has(name)) node.removeAttribute(name);
      }
      for (const [name, value] of safeAttrs) {
        if (node.getAttribute(name) !== value) node.setAttribute(name, value);
      }
      const children = data.children.map(visit);
      // Move only changed nodes, retaining focus and WebGL/2D contexts.
      children.forEach((child, i) => { if (node.childNodes[i] !== child) node.insertBefore(child, node.childNodes[i] || null); });
      while (node.childNodes.length > children.length) node.lastChild.remove();
      if (typeof data.value === 'string' && node.matches('input,textarea,select') && node.type !== 'password' && node.type !== 'file' && !node.readOnly && !secrets.test(node.id + ' ' + node.name)) node.value = data.value;
      if (typeof data.checked === 'boolean' && node.matches('input')) node.checked = data.checked;
      if (node.matches('dialog')) {
        if (data.modal && !node.matches(':modal')) { node.removeAttribute('open'); node.showModal(); }
        else if (!data.modal && node.matches(':modal')) node.close();
      }
      const scroll = data.scroll || [0, 0];
      if (scroll.every(Number.isFinite)) { node.scrollLeft = scroll[0]; node.scrollTop = scroll[1]; }
    }
    cache.set(data.id, node);
    return node;
  }
  visit(view.tree);
  for (const id of cache.keys()) if (!used.has(id)) cache.delete(id);
  if (typeof view.theme === 'string' && /^[\w-]{0,40}$/.test(view.theme)) doc.documentElement.dataset.theme = view.theme;
  if (typeof view.colorTheme === 'string' && /^[\w-]{0,40}$/.test(view.colorTheme)) doc.documentElement.dataset.colorTheme = view.colorTheme;
  for (const name of ['style', 'class']) {
    const value = view.appearance?.[name];
    if (typeof value === 'string' && attribute(name, value, doc) !== null) doc.documentElement.setAttribute(name, value);
  }
  if (view.scroll?.every(Number.isFinite)) doc.defaultView.scrollTo(...view.scroll);
}
export function viewNodeID(node) { return nodeID(node); }

// Binary arrays describe cubes and camera matrices, not canvas pixels.
export function encodeState(value) {
  return JSON.stringify(value, (_key, item) => {
    if (!ArrayBuffer.isView(item)) return item;
    const bytes = new Uint8Array(item.buffer, item.byteOffset, item.byteLength);
    let raw = '';
    for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return {$array: item.constructor.name, data: btoa(raw)};
  });
}
export function decodeState(text) {
  const types = {Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array};
  return JSON.parse(text, (key, item) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid state key.');
    if (!item?.$array) return item;
    const Type = types[item.$array];
    if (!Type || typeof item.data !== 'string') throw new Error('Invalid state array.');
    const raw = atob(item.data), bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    return new Type(bytes.buffer);
  });
}

// Send changed fields instead of repeating a whole UI and voxel board for a
// camera move. Arrays of unchanged size retain their structure and node IDs.
export function stateUpdate(previous, current) {
  if (!previous) return {replace: current};
  const patch = [];
  function diff(before, after, path) {
    if (before === after) return;
    if (before && after && typeof before === 'object' && typeof after === 'object' && Array.isArray(before) === Array.isArray(after)
        && (!Array.isArray(after) || before.length === after.length)) {
      for (const key of Object.keys(before)) if (!Object.hasOwn(after, key)) patch.push({path: [...path, key], remove: true});
      for (const key of Object.keys(after)) diff(before[key], after[key], [...path, key]);
    } else patch.push({path, value: after});
  }
  diff(previous, current, []);
  return patch.length ? patch.length > 1000 ? {replace: current} : {patch} : null;
}
export function applyStateUpdate(previous, update) {
  if (Object.hasOwn(update, 'replace')) return update.replace;
  if (!previous || !Array.isArray(update.patch) || update.patch.length > 1000) throw new Error('Invalid shared state update.');
  for (const item of update.patch) {
    if (!Array.isArray(item.path) || item.path.length > 100 || item.path.some(key => typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key))) throw new Error('Invalid state path.');
    if (!item.path.length) { if (item.remove) throw new Error('Invalid state removal.'); previous = item.value; continue; }
    let target = previous;
    for (const key of item.path.slice(0, -1)) {
      if (!target || typeof target !== 'object' || !Object.hasOwn(target, key)) throw new Error('Missing state field.');
      target = target[key];
    }
    if (!target || typeof target !== 'object') throw new Error('Invalid state target.');
    const key = item.path.at(-1);
    if (Array.isArray(target) && (!/^\d+$/.test(key) || Number(key) >= target.length)) throw new Error('Invalid array index.');
    if (item.remove) delete target[key];
    else target[key] = item.value;
  }
  return previous;
}
