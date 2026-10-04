import './styles.css';
import {isSharedFollower} from '../../shared/game-view.js';
import {installFollower} from './friend-view.ts';

if (isSharedFollower()) await installFollower();
else await import('./start.ts');
