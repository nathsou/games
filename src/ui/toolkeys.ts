/**
 * Tracks tools activated by *holding* a key (Picross 3D style). The most recently pressed
 * held key wins; releasing it falls back to any other key still held.
 */
export class ToolKeys<T extends string> {
  private held: { key: string; tool: T }[] = [];
  private map: Record<string, T>;
  private onChange: () => void;

  constructor(map: Record<string, T>, onChange: () => void) {
    this.map = map;
    this.onChange = onChange;
  }

  /** Returns true if the event was a tool key. */
  down(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const key = e.key.toLowerCase();
    const tool = this.map[key];
    if (!tool) return false;
    e.preventDefault();
    if (!this.held.some((h) => h.key === key)) {
      this.held.push({ key, tool });
      this.onChange();
    }
    return true;
  }

  up(e: KeyboardEvent): boolean {
    const key = e.key.toLowerCase();
    const n = this.held.length;
    this.held = this.held.filter((h) => h.key !== key);
    if (this.held.length !== n) {
      this.onChange();
      return true;
    }
    return false;
  }

  clear(): void {
    if (!this.held.length) return;
    this.held = [];
    this.onChange();
  }

  get current(): T | null {
    return this.held.length ? this.held[this.held.length - 1].tool : null;
  }

  /** Key bound to a tool (for hints). */
  keyFor(tool: T): string {
    return (Object.keys(this.map).find((k) => this.map[k] === tool) ?? '').toUpperCase();
  }
}

export const FINE_POINTER = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
