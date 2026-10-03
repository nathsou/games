import type { Collection } from '../core/types.ts';
import { architecture } from './architecture.ts';
import { chess } from './chess.ts';
import { critters } from './critters.ts';
import { firstSteps } from './firstSteps.ts';
import { garden } from './garden.ts';
import { kitchen } from './kitchen.ts';
import { space } from './space.ts';
import { toybox } from './toybox.ts';

export const allCollections: Collection[] = [firstSteps, kitchen, garden, critters, toybox, space, chess, architecture];
