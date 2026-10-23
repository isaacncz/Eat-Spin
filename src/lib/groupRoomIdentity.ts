export const GROUP_ROOM_NAME_MAX_LENGTH = 24;

/** The same identity normalization is used before joining and when renaming in a room. */
export const normalizeGroupDisplayName = (value: string) =>
  value.trim().replace(/\s+/g, ' ').slice(0, GROUP_ROOM_NAME_MAX_LENGTH);
