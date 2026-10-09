// Pointer events cover mouse, pen and touch. Click/keyboard placement remains
// available; dragging never changes the game until a valid gap is released.
export function installCardDrag(root, {canDrag, select, drop}) {
  let drag = null, ghost = null, frame = null, suppressUntil = 0;
  const clearTarget = () => root.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  function cleanup() {
    const pointer = drag?.pointer; drag = null;
    if (pointer !== undefined && root.hasPointerCapture(pointer)) root.releasePointerCapture(pointer); ghost?.remove(); ghost = null; cancelAnimationFrame(frame); clearTarget();
    document.body.classList.remove('dragging-card');
  }
  function targetAt() {
    const target = document.elementFromPoint(drag.x, drag.y)?.closest('[data-slot]');
    return target && root.contains(target) && !target.disabled ? target : null;
  }
  function paint() {
    if (!drag?.active) return;
    if (!canDrag(drag.card)) { cleanup(); return; }
    ghost.style.left = drag.x + 'px'; ghost.style.top = drag.y + 'px';
    clearTarget(); targetAt()?.classList.add('drop-target');
    const rail = root.querySelector('.tl'), rect = rail?.getBoundingClientRect();
    if (rect && drag.y >= rect.top - 30 && drag.y <= rect.bottom + 30) {
      if (drag.x < rect.left + 48) rail.scrollLeft -= 9;
      else if (drag.x > rect.right - 48) rail.scrollLeft += 9;
    }
    if (drag.y < 72) window.scrollBy(0, -10);
    else if (drag.y > innerHeight - 72) window.scrollBy(0, 10);
    frame = requestAnimationFrame(paint);
  }
  root.addEventListener('pointerdown', event => {
    const card = event.target.closest('[data-action="pick"]');
    if (event.button !== 0 || !event.isPrimary || !card || !canDrag(card.dataset.card)) return;
    drag = {pointer:event.pointerId, card:card.dataset.card, startX:event.clientX, startY:event.clientY, x:event.clientX, y:event.clientY, active:false, source:card};
  });
  root.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    drag.x = event.clientX; drag.y = event.clientY;
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 8) {
      drag.active = true; root.setPointerCapture(event.pointerId);
      ghost = drag.source.cloneNode(true); ghost.removeAttribute('id'); ghost.removeAttribute('data-action'); ghost.classList.add('drag-ghost'); ghost.setAttribute('aria-hidden','true');
      document.body.append(ghost); document.body.classList.add('dragging-card'); select(drag.card); paint();
    }
    if (drag.active) event.preventDefault();
  });
  root.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const active = drag.active, target = active ? targetAt() : null, card = drag.card;
    cleanup();
    if (active) { suppressUntil = performance.now() + 400; event.preventDefault(); if (target && canDrag(card)) drop(Number(target.dataset.slot)); }
  });
  root.addEventListener('pointercancel', cleanup);
  root.addEventListener('lostpointercapture', () => { if (drag) cleanup(); });
  root.addEventListener('dragstart', event => { if (event.target.closest('[data-action="pick"]')) event.preventDefault(); });
  root.addEventListener('click', event => { if (performance.now() < suppressUntil) {event.preventDefault(); event.stopImmediatePropagation();} }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && drag) {suppressUntil = performance.now() + 400; cleanup();} });
  return cleanup;
}
