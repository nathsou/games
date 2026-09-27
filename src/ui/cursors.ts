/** Custom canvas cursors built from the icon paths (white halo for contrast on any background). */
function svgCursor(paths: string, hotX: number, hotY: number, fallback: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="-2 -2 28 28"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-width="5">${paths}</g><g stroke="#262a3b" stroke-width="2">${paths}</g></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`;
}

const HAMMER = '<path d="M14.6 9.4L4.2 19.8"/><path d="M9.6 6.4l3.2-3.2 8 8-3.2 3.2z"/>';
const BRUSH = '<path d="M19.5 3.5c-3 1.5-7.5 6-9.5 9l2 2c3-2 7.5-6.5 9-9.5z"/><path d="M9 13.5c-2 0-3.5 1.5-3.5 3.5 0 1.5-1 2.5-2.5 2.5 1.5 1.5 3.5 1.5 5 1.5 2.5 0 4-1.5 4-4z"/>';
const PLUS = '<path d="M12 5v14M5 12h14"/>';
const ERASE = '<path d="M16 4l5 5-10 10H6l-3-3z"/><path d="M11 9l5 5"/>';

export const CURSORS = {
  hammer: svgCursor(HAMMER, 22, 16, 'pointer'),
  brush: svgCursor(BRUSH, 5, 29, 'crosshair'),
  add: svgCursor(PLUS, 16, 16, 'copy'),
  erase: svgCursor(ERASE, 6, 24, 'pointer'),
};
