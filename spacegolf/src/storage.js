// Progress and settings in localStorage (always wrapped: it can be unavailable).

const KEY = 'spacegolf.v1';

const DEFAULTS = () => ({
  settings: { sound: true, assist: 1, field: 0, bloom: true },
  campaign: {},
  custom: [],
  endless: { holes: 0, aces: 0, bestRun: null, difficulty: 2, ramp: true },
});

export class Store {
  constructor() {
    this.data = DEFAULTS();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const d = DEFAULTS();
        this.data = {
          settings: { ...d.settings, ...(parsed.settings || {}) },
          campaign: parsed.campaign || {},
          custom: Array.isArray(parsed.custom) ? parsed.custom : [],
          endless: { ...d.endless, ...(parsed.endless || {}) },
        };
      }
    } catch (e) {
      this.data = DEFAULTS();
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      /* storage full or blocked: progress just won't persist */
    }
  }

  get settings() {
    return this.data.settings;
  }

  levelRecord(id) {
    return this.data.campaign[id] || null;
  }

  // returns { newBest, record }
  recordCampaign(id, strokes, stars) {
    const rec = this.data.campaign[id];
    let newBest = false;
    if (!rec) {
      this.data.campaign[id] = { best: strokes, stars };
      newBest = true;
    } else {
      if (strokes < rec.best) {
        rec.best = strokes;
        newBest = true;
      }
      if (stars > rec.stars) rec.stars = stars;
    }
    this.save();
    return { newBest, record: this.data.campaign[id] };
  }

  totalStars() {
    let n = 0;
    for (const k in this.data.campaign) n += this.data.campaign[k].stars || 0;
    return n;
  }

  reset() {
    this.data = DEFAULTS();
    this.save();
  }
}
