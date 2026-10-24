/**
 * Fits a restaurant name into a wheel segment. Prefers fewer lines at a readable size:
 * shrink the font a little before wrapping to a third line, and only cut a name with "…"
 * when it cannot fit three lines at the smallest size.
 */

/** Average bold glyph width as a share of the font size (Inter / rounded display faces). */
export const GLYPH_WIDTH_EM = 0.58;
export const MIN_LABEL_FONT_PX = 11.5;

export interface FittedLabel {
  lines: string[];
  fontSize: number;
}

/** Greedy word wrap. Returns null when a word is wider than a line or more lines are needed. */
export const wrapWords = (text: string, maxChars: number, maxLines: number): string[] | null => {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    if (word.length > maxChars) return null;
    const current = lines[lines.length - 1];
    if (current && `${current} ${word}`.length <= maxChars) {
      lines[lines.length - 1] = `${current} ${word}`;
    } else {
      if (lines.length === maxLines) return null;
      lines.push(word);
    }
  }
  return lines;
};

/**
 * Last resort: wraps by whole words (a word wider than a line keeps its own line rather than
 * being split mid-word), and cuts with "…" only when more than `maxLines` are needed.
 */
export const wrapWithEllipsis = (text: string, maxChars: number, maxLines: number): string[] => {
  const lines: string[] = [];
  for (const word of text.split(' ').filter(Boolean)) {
    const current = lines[lines.length - 1];
    if (current && `${current} ${word}`.length <= maxChars) {
      lines[lines.length - 1] = `${current} ${word}`;
    } else if (lines.length < maxLines) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current}…`;
      return lines;
    }
  }
  return lines;
};

const charsFor = (widthPx: number, fontSize: number) => Math.max(4, Math.floor(widthPx / (fontSize * GLYPH_WIDTH_EM)));

export function fitWheelLabel(name: string, widthPx: number, baseFontSize: number): FittedLabel {
  const text = name.trim().replace(/\s+/g, ' ');
  const minFont = Math.min(MIN_LABEL_FONT_PX, baseFontSize);
  for (const maxLines of [2, 3]) {
    for (let font = baseFontSize; font >= minFont - 0.001; font -= 0.5) {
      const lines = wrapWords(text, charsFor(widthPx, font), maxLines);
      if (lines) return { lines, fontSize: font };
    }
  }
  return { lines: wrapWithEllipsis(text, charsFor(widthPx, minFont), 3), fontSize: minFont };
}
