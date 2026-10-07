// A timeline is a list of tracks. Seeking evaluates every track against an
// absolute time and calls its update function with a normalised progress.
//
// The hard rule: `update` must be a *pure* description of the scene at time t.
// It may not accumulate, increment, or read the previous frame. That is what
// makes live playback and offline capture produce identical output, and what
// lets you scrub backwards.

export const ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
    outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outBack: (t) => {
        const c = 1.70158;
        return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
    outElastic: (t) => {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    }
};

/** Linear interpolation. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Clamp to a range. */
export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Map `v` from [inLo, inHi] onto [outLo, outHi], clamped at both ends.
 * The workhorse for "between second 3 and second 5, fade this in".
 */
export function remap(v, inLo, inHi, outLo = 0, outHi = 1) {
    if (inHi === inLo) return v < inLo ? outLo : outHi;
    return lerp(outLo, outHi, clamp((v - inLo) / (inHi - inLo)));
}

/** Interpolate between two `#rrggbb` colours. */
export function mixColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const k = clamp(t);
    const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, k));
    const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, k));
    const bl = Math.round(lerp(pa & 255, pb & 255, k));
    return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Darken a `#rrggbb` colour toward black by factor `k` (1 = unchanged). */
export function shade(hex, k) {
    const p = parseInt(hex.slice(1), 16);
    const r = Math.round(clamp(((p >> 16) & 255) * k, 0, 255));
    const g = Math.round(clamp(((p >> 8) & 255) * k, 0, 255));
    const b = Math.round(clamp((p & 255) * k, 0, 255));
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export class Timeline {
    constructor() {
        this.tracks = [];
        this.cursor = 0;
        this.markers = new Map();
    }

    /**
     * Add a track.
     * @param {number} at    absolute start time in seconds
     * @param {number} dur   duration in seconds
     * @param {(p: number, tAbs: number) => void} update
     * @param {{ease?: (t:number)=>number, hold?: boolean, ambient?: boolean}} [opts]
     *   `hold` (default true) keeps calling update with p=1 after the track
     *   ends, so a track that reveals something leaves it revealed.
     *
     *   `ambient` marks background motion — drifting packets, idle traffic —
     *   that should run for as long as the scene does but must not decide how
     *   long that is. Such tracks are usually given an arbitrarily long
     *   duration, and without this they silently extend the scene into a tail
     *   of dead frames.
     */
    add(at, dur, update, opts = {}) {
        const { ease: easing = ease.linear, hold = true, ambient = false } = opts;
        this.tracks.push({ at, dur, update, easing, hold, ambient });
        if (!ambient) this.cursor = Math.max(this.cursor, at + dur);
        return this;
    }

    /** Add a track starting `gap` seconds after the current end of the timeline. */
    then(gap, dur, update, opts) {
        return this.add(this.cursor + gap, dur, update, opts);
    }

    /** Record a named time so scenes can cross-reference beats readably. */
    mark(name, at = this.cursor) {
        this.markers.set(name, at);
        return at;
    }

    at(name) {
        if (!this.markers.has(name)) throw new Error(`Unknown marker: ${name}`);
        return this.markers.get(name);
    }

    /** Total timeline length in seconds, ignoring ambient background tracks. */
    get duration() {
        return this.tracks.reduce((m, t) => (t.ambient ? m : Math.max(m, t.at + t.dur)), 0);
    }

    /**
     * Evaluate the whole timeline at absolute time `t` (seconds).
     * Tracks run in registration order, so later tracks may overwrite earlier
     * ones — that is the intended way to express "and then this takes over".
     */
    seek(t) {
        for (const track of this.tracks) {
            const { at, dur, update, easing, hold } = track;
            if (t < at) continue;
            if (t > at + dur && !hold) continue;
            const raw = dur === 0 ? 1 : clamp((t - at) / dur);
            update(easing(raw), t);
        }
    }
}

/**
 * Deterministic pseudo-random number in [0, 1) from integer inputs.
 * Used anywhere the scene needs "random-looking" but must render identically
 * on every pass (ciphertext glyphs, jitter, particle offsets).
 */
export function hashRandom(...ints) {
    let h = 2166136261 >>> 0;
    for (const n of ints) {
        let x = (n | 0) >>> 0;
        for (let i = 0; i < 4; i++) {
            h ^= x & 255;
            h = Math.imul(h, 16777619) >>> 0;
            x >>>= 8;
        }
    }
    h ^= h >>> 13;
    h = Math.imul(h, 1274126177) >>> 0;
    h ^= h >>> 16;
    // `^` yields a signed int32, so coerce back to unsigned before dividing —
    // otherwise this returns a negative number and callers indexing an array
    // with it get undefined.
    return (h >>> 0) / 4294967296;
}
