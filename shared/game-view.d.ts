export function isSharedFollower(): boolean;
export function installGameView(renderer?: {apply(state: unknown, nodes: Map<number, Node>): void} | null): void;
export function installFollower(game: string): Promise<void>;
