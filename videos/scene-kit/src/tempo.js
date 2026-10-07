// The beat grid the whole video is cut to.
//
// Every major event — a scene start, a boundary, a narration line — lands on a
// bar line, so the animation and the voice arrive together and the music has
// something to sit under. Sub-beat detail (fades, packet travel, glyph churn)
// is deliberately left free; quantising those too makes the motion feel
// mechanical rather than scored.
//
// 96 BPM was chosen because it divides cleanly: 0.625 s to the beat, 2.5 s to
// the bar, which keeps every derived timestamp a short decimal.

export const BPM = 96;
export const BEAT = 60 / BPM; // 0.625 s
export const BAR = BEAT * 4; // 2.5 s

/** `n` bars in seconds. The unit almost every scene constant is written in. */
export const bars = (n) => n * BAR;

/** `n` beats in seconds, for the odd half-bar offset. */
export const beats = (n) => n * BEAT;
