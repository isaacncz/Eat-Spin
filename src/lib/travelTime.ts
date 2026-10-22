/** Straight-line distance to roads: real routes are about 40% longer than the crow flies. */
const ROAD_DETOUR_FACTOR = 1.4;
/** Up to this many road km the label says "walk", beyond it "drive". */
const MAX_WALKING_ROAD_KM = 1.2;
const WALKING_KM_PER_HOUR = 5;
/** Urban average. */
const DRIVING_KM_PER_HOUR = 30;

/** Rough travel time label from a straight-line distance in km, such as "~8 min drive". */
export const estimateTravelTime = (straightLineKm: number): string => {
  const roadKm = straightLineKm * ROAD_DETOUR_FACTOR;
  if (roadKm <= MAX_WALKING_ROAD_KM) {
    const minutes = Math.round((roadKm / WALKING_KM_PER_HOUR) * 60);
    return `~${Math.max(1, minutes)} min walk`;
  }
  const minutes = Math.round((roadKm / DRIVING_KM_PER_HOUR) * 60);
  return `~${Math.max(1, minutes)} min drive`;
};
