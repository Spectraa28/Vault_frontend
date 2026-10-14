/**
 * State the 3D scene shares with the page around it. Kept free of any three.js import, so the
 * page can read it without pulling the whole 3D engine into the first download.
 */
export const playerPosition = { x: 1.2, y: 1, z: 6.3 };
/** Lets the recorded tour place the visitor. The Player sets it while mounted. */
export const playerControl: { teleport?: (x: number, y: number, z: number) => void } = {};
export const playerMotion = { speed: 0 };
