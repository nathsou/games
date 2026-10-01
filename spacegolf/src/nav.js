// Navigation: wires scenes together (kept out of app.js to avoid circular imports).

import { TitleScene } from './scenes/title.js';
import { GameScene } from './scenes/game.js';
import { WORLDS } from './campaign.js';

export function installNavigation(app) {
  app.openTitle = () => app.go(new TitleScene(app));
  app.openCampaign = () => import('./scenes/campaign.js').then((m) => app.go(new m.CampaignScene(app)));
  app.openEndless = () => import('./scenes/endless.js').then((m) => app.go(new m.EndlessScene(app)));
  app.openSettings = () => import('./scenes/settings.js').then((m) => app.go(new m.SettingsScene(app)));
  app.openCreate = () => import('./scenes/create.js').then((m) => app.go(new m.CreateScene(app)));

  app.playCampaign = (wi, li) => {
    const world = WORLDS[wi];
    const level = world.levels[li];
    const cfg = {
      level,
      kind: 'campaign',
      title: `${wi + 1}-${li + 1}  ${level.name}`,
      subtitle: world.name,
      paletteSalt: wi,
      onWin: (res) => {
        const prev = app.store.levelRecord(level.id);
        const { newBest, record } = app.store.recordCampaign(level.id, res.strokes, res.stars);
        return { newBest: newBest && (!prev || res.strokes < prev.best), best: record.best };
      },
      onExit: () => import('./scenes/campaign.js').then((m) => app.go(new m.CampaignScene(app, { world: wi }))),
    };
    const nextWorld = li + 1 < world.levels.length ? [wi, li + 1] : wi + 1 < WORLDS.length ? [wi + 1, 0] : null;
    if (nextWorld) {
      cfg.onNext = () => app.playCampaign(nextWorld[0], nextWorld[1]);
      cfg.nextLabel = 'Next';
    }
    app.go(new GameScene(app, cfg));
  };

  app.routeFromHash = () => {
    const h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    const params = new URLSearchParams(h);
    if (params.has('seed')) {
      import('./scenes/endless.js').then((m) => m.playSeedFromLink(app, params.get('seed'), parseInt(params.get('d') || '2', 10)));
    } else if (params.has('level')) {
      import('./scenes/create.js').then((m) => m.playSharedLevel(app, params.get('level')));
    }
  };
}
