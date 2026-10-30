// Each part owns a hue along the route, beginner (teal) to job-ready (orange). Design-system §5.1.
const HUES = [168, 175, 190, 205, 218, 230, 245, 258, 272, 288, 305, 322, 338, 352, 12, 28];

export function partHue(partNumber: number): number {
  return HUES[Math.max(0, Math.min(HUES.length - 1, partNumber))]!;
}
