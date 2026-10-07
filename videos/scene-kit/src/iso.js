// Isometric projection as a JointJS paper matrix.
//
// The whole diagram is authored in ordinary 2D world coordinates — a floor
// plan. The paper's transformation matrix does the projection, so nothing in
// the scene code has to think in screen space. This is the same trick the
// vendored `isometric-diagram` demo uses, with the vertical constant solved
// exactly rather than approximated.
//
//   world (1, 0)  ->  screen ( s·cos30,  s/2)   "east", down-right
//   world (0, 1)  ->  screen (-s·cos30,  s/2)   "south", down-left
//   world (-1,-1) ->  screen ( 0,       -s  )   straight up
//
// That last identity is the reason a box's top face is drawn by translating
// its footprint by (-h, -h): height extrudes vertically on screen with no
// horizontal drift, at exactly `s` screen pixels per world unit of height.

const COS30 = Math.cos(Math.PI / 6);

/**
 * Base world-units-to-screen-pixels scale before any camera zoom.
 * Chosen so the wide architecture shot sits near zoom = 1, which leaves the
 * camera's zoom range free to mean "how far in are we" rather than having to
 * make up for an arbitrary base.
 */
export const ISO_SCALE = 11;

/** Project a world point to unzoomed, untranslated screen space. */
export function project(x, y, scale = ISO_SCALE) {
    return {
        x: (x - y) * scale * COS30,
        y: (x + y) * scale * 0.5
    };
}

/** Screen-space rise, in pixels, of `h` world units of isometric height. */
export function riseOf(h, scale = ISO_SCALE) {
    return h * scale;
}

/**
 * Build the full paper matrix for a camera looking at `center` (a world point)
 * with a given zoom, framed in a viewport of `width` x `height`.
 *
 * Composed as  T(viewport centre) · S(zoom) · T(-projected centre) · P
 * so that the world point `center` lands dead centre of frame.
 */
export function cameraMatrix({ center, zoom = 1, width, height, scale = ISO_SCALE }) {
    const c = project(center.x, center.y, scale);
    const a = scale * COS30 * zoom;
    const b = scale * 0.5 * zoom;
    return {
        a,
        b: b,
        c: -a,
        d: b,
        e: width / 2 - c.x * zoom,
        f: height / 2 - c.y * zoom
    };
}

/**
 * Where does a world point (optionally lifted by `h` units of height) land on
 * screen under the given camera? Used to hang HUD labels off diagram features:
 * text lives on an untransformed paper so it never skews, but it tracks the
 * geometry through camera moves.
 */
export function toScreen(camera, x, y, h = 0) {
    const p = project(x, y, camera.scale ?? ISO_SCALE);
    const zoom = camera.zoom ?? 1;
    const c = project(camera.center.x, camera.center.y, camera.scale ?? ISO_SCALE);
    return {
        x: camera.width / 2 + (p.x - c.x) * zoom,
        y: camera.height / 2 + (p.y - c.y) * zoom - riseOf(h, camera.scale ?? ISO_SCALE) * zoom
    };
}

/**
 * Inverse of `project`: recover the world point that lands on a given
 * unzoomed screen point. Used to turn a desired screen framing back into a
 * camera centre.
 */
export function unproject(sx, sy, scale = ISO_SCALE) {
    const dx = sx / (scale * COS30); // = x - y
    const sy2 = (2 * sy) / scale; // = x + y
    return { x: (dx + sy2) / 2, y: (sy2 - dx) / 2 };
}

/**
 * SVG path data for a rhombus: the projection of an axis-aligned world
 * rectangle, expressed in *world* coordinates so the paper matrix projects it.
 * Because the matrix does the work, this is just the rectangle itself.
 */
export function facePath(w, d) {
    return `M 0 0 L ${w} 0 L ${w} ${d} L 0 ${d} Z`;
}

/**
 * The three faces of a box of footprint `w` x `d` and height `h`, in world
 * coordinates, ready to be projected by the paper matrix.
 *
 * Height is applied as the (-h, -h) translation described above.
 */
export function boxFaces(w, d, h) {
    return {
        top: `M ${-h} ${-h} L ${w - h} ${-h} L ${w - h} ${d - h} L ${-h} ${d - h} Z`,
        // South-west facing wall (screen left)
        left: `M ${-h} ${d - h} L ${w - h} ${d - h} L ${w} ${d} L 0 ${d} Z`,
        // South-east facing wall (screen right)
        right: `M ${w - h} ${-h} L ${w - h} ${d - h} L ${w} ${d} L ${w} 0 Z`
    };
}

/**
 * Painter's-algorithm depth key. Larger means nearer the camera, so it should
 * be drawn later. For axis-aligned footprints on a shared ground plane,
 * x + y is an exact ordering.
 */
export function depthKey(x, y) {
    return x + y;
}
