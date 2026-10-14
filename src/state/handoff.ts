// Positions handed from game logic to the scene. Plain objects (no three.js) so the
// UI bundle doesn't pull in the 3D engine before the first paint.
export type Vec3 = { x: number; y: number; z: number };

/** A creature with a hint here spawns at that spot (e.g. a befriended visitor). */
export const spawnHints = new Map<string, Vec3>();

/** Where the current visitor is right now; written by the scene every frame. */
export const visitorPos: Vec3 = { x: 0, y: 0, z: 0 };
