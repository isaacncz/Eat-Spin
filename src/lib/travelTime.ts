/**
 * Estimate travel time from a straight-line distance using a road detour factor.
 *
 * Shared by the wheel, the result card, and the auto-mode list so every surface
 * shows the same "~N min walk/drive" copy from one implementation.
 */
export const estimateTravelTime = (straightLineKm: number): string => {
  const roadKm = straightLineKm * 1.4; // detour factor
  if (roadKm <= 1.2) {
    // Walking range — ~5 km/h walk speed
    const minutes = Math.round((roadKm / 5) * 60);
    return `~${Math.max(1, minutes)} min walk`;
  }
  // Driving range — urban avg ~30 km/h
  const minutes = Math.round((roadKm / 30) * 60);
  return `~${Math.max(1, minutes)} min drive`;
};
