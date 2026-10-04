import {isSharedFollower, installFollower} from './game-view.js';
const entry = document.querySelector('script[data-game]');
if (isSharedFollower()) await installFollower(entry.dataset.game);
else await import(new URL(entry.dataset.entry, location.href));
