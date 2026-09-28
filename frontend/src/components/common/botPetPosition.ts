export type PetPosition = { x: number; y: number };

/** Keep a fixed companion below navigation, even after restoring an old spot. */
export function clampPetPosition(
  position: PetPosition,
  bounds: {
    viewportWidth: number;
    viewportHeight: number;
    petWidth: number;
    petHeight: number;
    navigationBottom: number;
    gap?: number;
  },
): PetPosition {
  const gap = bounds.gap ?? 8;
  const minY = Math.max(0, bounds.navigationBottom) + gap;
  // If the remaining viewport is very short, protecting navigation takes
  // priority over pulling the character back above the content boundary.
  const maxY = Math.max(minY, bounds.viewportHeight - bounds.petHeight - gap);
  return {
    x: Math.max(gap, Math.min(position.x, bounds.viewportWidth - bounds.petWidth - gap)),
    y: Math.max(minY, Math.min(position.y, maxY)),
  };
}
