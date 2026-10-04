import {isSharedFollower, installFollower} from './game-view.js';
import {friendSession, togetherURL} from './friend-context.js';

const game = document.documentElement.dataset.game;
const params = new URLSearchParams(location.hash.slice(1));
if (!friendSession() && window === window.top && (params.get('together') === '1' || !location.hash)) {
  location.replace(togetherURL(game));
} else if (isSharedFollower()) {
  await installFollower(game);
} else {
  await import(new URL('../' + game + '/src/app.js', import.meta.url));
}
