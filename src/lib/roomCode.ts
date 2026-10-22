/** Room code rule used by the Group screen's join field. Pure helper, no DOM. */

export const ROOM_CODE_LENGTH = 6;

/** Upper-case letters and digits only, cut to the room code length. */
export const normalizeRoomCode = (value: string): string => (
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH)
);
