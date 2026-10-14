import type { Area } from './store';
/** Distances are positive here; Ecctrl's API uses negative camera offsets. */
export const CAMERA_LIMITS: Record<Area, number> = { gate: 6, lobby: 4.5, vault: 3.2 };
export const cameraDistance = (distance: number, area: Area) => Math.min(CAMERA_LIMITS[area], Math.max(1.4, distance));
/** Exponential damping has the same response at 60, 120 and 144 render updates per second. */
export const smoothCamera = (value: number, target: number, dt: number) => target + (value - target) * Math.exp(-10 * Math.min(dt, .1));
export const floorHeight = (z: number) => z >= -16 ? 0 : z <= -22 ? -3 : (z + 16) / 2;
