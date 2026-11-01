// Each part owns a hue along the route, beginner (peach) through pink to job-ready (lavender),
// matching the plum palette (design-system §6.5).
const HUES = [24, 16, 8, 0, 352, 344, 336, 328, 320, 312, 304, 296, 288, 280, 272, 264];

export function partHue(partNumber: number): number {
  return HUES[Math.max(0, Math.min(HUES.length - 1, partNumber))]!;
}
