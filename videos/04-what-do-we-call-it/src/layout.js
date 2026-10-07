import { hashRandom } from '@ppai/scene-kit';

// Deterministic word-cloud placement.
//
// Boxes are placed largest-first along an Archimedean spiral out from the
// centre, taking the first position that clears everything already placed. The
// spiral is elliptical because the frame is 16:9 — a circular one leaves the
// sides empty and stacks too much above and below.
//
// Nothing here reads the clock or Math.random, so the layout is identical on
// every render and the capture stays reproducible.

/**
 * Estimate a rendered text box. Measuring for real would mean laying the text
 * out in the DOM first; for a cloud, an estimate that errs slightly wide is
 * better anyway, since it keeps neighbours from touching.
 */
function measure(text, fontSize) {
    // Average advance width for mixed-case text in the HUD's sans stack,
    // as a fraction of the font size.
    const width = text.length * fontSize * 0.55 + fontSize * 0.5;
    const height = fontSize * 1.32;
    return { width, height };
}

const overlaps = (a, b, pad) =>
    Math.abs(a.cx - b.cx) * 2 < a.width + b.width + pad * 2 &&
    Math.abs(a.cy - b.cy) * 2 < a.height + b.height + pad * 2;

/**
 * @param {{text: string, weight: number}[]} phrases
 * @returns {{text: string, x: number, y: number, fontSize: number}[]}
 *   Positions are the *centre* of each phrase, in screen coordinates.
 */
export function layoutCloud(phrases, {
    cx = 960,
    cy = 610,
    baseSize = 34,
    pad = 17,
    aspect = 0.52,
    bounds = { x: 130, y: 290, width: 1660, height: 660 }
} = {}) {
    const items = phrases
        .map((p, i) => ({ ...p, i, fontSize: Math.round(baseSize * p.weight) }))
        .sort((a, b) => b.fontSize - a.fontSize || a.i - b.i);

    const placed = [];
    const out = [];

    for (const item of items) {
        const { width, height } = measure(item.text, item.fontSize);
        // Each phrase starts its spiral at a different angle so equal-sized
        // boxes do not all pile onto the same side of the centre.
        const theta0 = hashRandom(item.i, 7) * Math.PI * 2;

        let placedBox = null;
        for (let step = 0; step < 4000; step++) {
            const theta = theta0 + step * 0.28;
            const r = step * 1.9;
            const box = {
                cx: cx + Math.cos(theta) * r,
                cy: cy + Math.sin(theta) * r * aspect,
                width,
                height
            };

            const inBounds =
                box.cx - width / 2 >= bounds.x &&
                box.cx + width / 2 <= bounds.x + bounds.width &&
                box.cy - height / 2 >= bounds.y &&
                box.cy + height / 2 <= bounds.y + bounds.height;
            if (!inBounds) continue;

            if (placed.every((q) => !overlaps(box, q, pad))) {
                placedBox = box;
                break;
            }
        }

        // A phrase that cannot be placed is dropped rather than allowed to
        // overlap; the caller logs the count so a silent loss is visible.
        if (!placedBox) continue;

        placed.push(placedBox);
        out.push({ text: item.text, x: placedBox.cx, y: placedBox.cy, fontSize: item.fontSize, i: item.i });
    }

    return out;
}
