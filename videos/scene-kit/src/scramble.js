import { hashRandom, clamp } from './timeline.js';

const CIPHER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const HEX_ALPHABET = '0123456789abcdef';

/**
 * Pick a glyph by normalised position, clamped into range.
 * Indexing an alphabet directly is one arithmetic slip away from splicing the
 * literal text "undefined" into a frame, which is both wrong and very visible.
 */
function glyph(alphabet, r) {
    const i = Math.floor(r * alphabet.length);
    return alphabet[i < 0 ? 0 : i >= alphabet.length ? alphabet.length - 1 : i];
}

/**
 * Progressively replace a plaintext string with ciphertext-looking glyphs.
 *
 * `p` = 0 is untouched plaintext, `p` = 1 is fully scrambled. Characters
 * convert left-to-right so the effect reads as the message being sealed as it
 * travels, which is what the encryption beats in scenes 2 and 3 need.
 *
 * The glyph for a given character is a pure function of its index and a
 * time bucket, so a re-render produces byte-identical frames. `churnHz`
 * controls how often already-scrambled glyphs reshuffle — a low value keeps
 * the ciphertext alive without turning it into noise.
 */
export function scramble(text, p, t = 0, { churnHz = 12, alphabet = CIPHER_ALPHABET, seed = 0 } = {}) {
    const k = clamp(p);
    const converted = Math.round(k * text.length);
    const bucket = Math.floor(t * churnHz);
    let out = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (i >= converted) {
            out += ch;
        } else if (ch === ' ') {
            // Preserve spacing so the block keeps its shape and width.
            out += ' ';
        } else {
            out += glyph(alphabet, hashRandom(i, bucket, seed));
        }
    }
    return out;
}

/** A block of stable-looking ciphertext of a given length. */
export function cipherText(length, t = 0, { churnHz = 8, seed = 0, alphabet = CIPHER_ALPHABET } = {}) {
    const bucket = Math.floor(t * churnHz);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += glyph(alphabet, hashRandom(i, bucket, seed));
    }
    return out;
}

/** Hex-flavoured ciphertext, for anything that should read as raw bytes. */
export function hexBlock(length, t = 0, opts = {}) {
    return cipherText(length, t, { alphabet: HEX_ALPHABET, churnHz: 6, ...opts });
}

/**
 * Reveal `text` one character at a time. Unlike `scramble`, nothing is
 * substituted — the tail is simply not shown yet.
 */
export function typeOn(text, p) {
    return text.slice(0, Math.round(clamp(p) * text.length));
}
