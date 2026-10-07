import { dia, V } from '@joint/core';
import { CANVAS, COLOR } from './theme.js';
import { cameraMatrix, ISO_SCALE, project, unproject, riseOf, toScreen } from './iso.js';

const clampUnit = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
import { cellNamespace } from './shapes.js';
import { hudNamespace } from './hud.js';

/**
 * A Stage owns the two papers every scene is built from:
 *
 *   stage — the isometric diagram. Its viewport matrix is the isometric
 *           projection composed with the camera, so scene code only ever
 *           thinks in flat world coordinates.
 *   hud   — an untransformed paper on top, holding all text and overlays.
 *
 * Both papers render synchronously (`async: false`). That matters for capture:
 * when `seek()` returns, the DOM is final, so the very next screenshot is
 * guaranteed to show that frame and not the previous one.
 */
export class Stage {
    constructor({ el, width = CANVAS.width, height = CANVAS.height, background = COLOR.bg } = {}) {
        this.width = width;
        this.height = height;

        this.root = el;
        this.root.classList.add('ppai-stage');
        this.root.style.width = `${width}px`;
        this.root.style.height = `${height}px`;
        this.root.style.background = background;

        this.stageGraph = new dia.Graph({}, { cellNamespace });
        this.hudGraph = new dia.Graph({}, { cellNamespace: hudNamespace });

        const common = {
            width,
            height,
            async: false,
            sorting: dia.Paper.sorting.APPROX,
            interactive: false,
            background: { color: 'transparent' },
            preventDefaultBlankAction: false
        };

        this.stagePaper = new dia.Paper({
            ...common,
            model: this.stageGraph,
            cellViewNamespace: cellNamespace,
            // Links are routed between explicit world points, so no router or
            // connection-point maths should interfere with the geometry.
            defaultRouter: { name: 'normal' },
            defaultConnector: { name: 'straight' },
            defaultAnchor: { name: 'center' },
            defaultConnectionPoint: { name: 'anchor' }
        });

        this.hudPaper = new dia.Paper({
            ...common,
            model: this.hudGraph,
            cellViewNamespace: hudNamespace
        });

        for (const paper of [this.stagePaper, this.hudPaper]) {
            paper.el.style.position = 'absolute';
            paper.el.style.inset = '0';
        }
        this.root.appendChild(this.stagePaper.el);

        // A scrim between the diagram and the HUD. Scenes use it to push the
        // architecture back behind a closing statement — the curtain sits above
        // everything and would take the statement down with it.
        this.scrimEl = document.createElement('div');
        Object.assign(this.scrimEl.style, {
            position: 'absolute',
            inset: '0',
            background: COLOR.bgDeep,
            opacity: '0',
            pointerEvents: 'none'
        });
        this.root.appendChild(this.scrimEl);

        this.root.appendChild(this.hudPaper.el);
        this.hudPaper.el.style.pointerEvents = 'none';

        this.camera = {
            center: { x: 0, y: 0 },
            zoom: 1,
            width,
            height,
            scale: ISO_SCALE
        };
        this.applyCamera();
    }

    /** Push the current camera onto the stage paper's viewport matrix. */
    applyCamera() {
        this.stagePaper.matrix(cameraMatrix(this.camera));
        return this;
    }

    /**
     * Set the camera. Called every frame by scenes that move it, so it must
     * stay cheap and side-effect free beyond the matrix write.
     */
    setCamera({ center, zoom }) {
        if (center) this.camera.center = center;
        if (zoom != null) this.camera.zoom = zoom;
        return this.applyCamera();
    }

    /** Project a flat world point (optionally lifted by height `h`) to screen. */
    project(x, y, h = 0) {
        return toScreen(this.camera, x, y, h);
    }

    /**
     * Compute the camera that frames the given cells (default: everything on
     * the stage) with `padding` pixels of margin.
     *
     * `frame` fits the content into a sub-rect of the canvas rather than the
     * whole thing. The HUD keeps a text column down the left side, so scenes
     * that would otherwise centre a diagram underneath it push the framing
     * right instead of shrinking the diagram to get out of the way.
     *
     * Returns `{ center, zoom }` rather than applying it, so a scene can keep
     * it as a named pose and interpolate toward a closer one.
     */
    fitCamera({ padding = 90, cells = null, maxZoom = 4, frame = null } = {}) {
        const list = cells ?? this.stageGraph.getElements();
        if (!list.length) return { center: { x: 0, y: 0 }, zoom: 1 };

        const scale = this.camera.scale;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const cell of list) {
            const { x, y } = cell.position();
            const { width, height } = cell.size();
            const h = cell.get('isoHeight') ?? 0;
            // All four footprint corners, at ground level and lifted by the
            // element's height — the silhouette is the union of both.
            for (const [cx, cy] of [
                [x, y],
                [x + width, y],
                [x, y + height],
                [x + width, y + height]
            ]) {
                const p = project(cx, cy, scale);
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y - riseOf(h, scale));
                maxY = Math.max(maxY, p.y);
            }
        }

        const spanX = Math.max(1, maxX - minX);
        const spanY = Math.max(1, maxY - minY);
        const box = frame ?? { x: 0, y: 0, width: this.width, height: this.height };
        const zoom = Math.min(
            maxZoom,
            (box.width - padding * 2) / spanX,
            (box.height - padding * 2) / spanY
        );

        // The content's midpoint should land at the middle of `box`. Screen
        // position is `viewportCentre + zoom * (point - cameraCentre)`, so
        // solving for the camera centre gives the offset below.
        const mid = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const center = unproject(
            mid.x - (target.x - this.width / 2) / zoom,
            mid.y - (target.y - this.height / 2) / zoom,
            scale
        );
        return { center, zoom };
    }

    /**
     * Screen-space bounding rect of a world region `{x, y, w, d, base, h}`.
     *
     * Projects all eight corners of the box — the footprint at `base` height
     * and again at `h` — and takes the extent. Containment overlays live on the
     * HUD, so they need the region expressed in screen pixels, and the extent
     * has to come from the projected silhouette rather than the footprint alone
     * or a tall box's overlay would sit well below its top face.
     */
    regionRect({ x, y, w, d, base = 0, h = 0 }, padding = 0) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const lift of [base, h]) {
            for (const [cx, cy] of [
                [x, y],
                [x + w, y],
                [x, y + d],
                [x + w, y + d]
            ]) {
                const p = this.project(cx, cy, lift);
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            }
        }
        return {
            x: minX - padding,
            y: minY - padding,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2
        };
    }

    /** Add cells to the isometric stage. */
    add(...cells) {
        this.stageGraph.addCells(cells.flat());
        return cells.length === 1 ? cells[0] : cells;
    }

    /** Add cells to the screen-space HUD. */
    addHud(...cells) {
        this.hudGraph.addCells(cells.flat());
        return cells.length === 1 ? cells[0] : cells;
    }

    /**
     * Draw the isometric ground grid into the stage paper's back layer.
     * Lines are authored in world space, so the paper matrix projects them.
     */
    drawGrid({ from = -40, to = 40, step = 4, color = COLOR.grid, strong = COLOR.gridStrong, every = 5, opacity = 0.5 } = {}) {
        const minor = [];
        const major = [];
        for (let i = from; i <= to; i += step) {
            const isMajor = Math.round(i / step) % every === 0;
            (isMajor ? major : minor).push(`M ${from} ${i} L ${to} ${i}`, `M ${i} ${from} L ${i} ${to}`);
        }
        const layer = this.stagePaper.getLayerNode(dia.Paper.Layers.BACK);
        const group = V('g').attr({ class: 'ppai-grid', opacity });
        // non-scaling-stroke keeps these hairlines hairline at any zoom; without
        // it the grid thickens into solid bands as the camera pushes in.
        V('path')
            .attr({ d: minor.join(' '), fill: 'none', stroke: color, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' })
            .appendTo(group);
        V('path')
            .attr({ d: major.join(' '), fill: 'none', stroke: strong, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' })
            .appendTo(group);
        group.appendTo(layer);
        this.gridEl = group;
        this.gridBaseOpacity = opacity;
        return group;
    }

    /** Fade the ground grid (0 hides it entirely). */
    setGridOpacity(o) {
        if (this.gridEl) this.gridEl.attr('opacity', o);
        return this;
    }

    /** Dim the diagram without touching the HUD drawn over it. */
    setStageScrim(opacity) {
        this.scrimEl.style.opacity = String(clampUnit(opacity));
        return this;
    }

    /** Full-frame colour wash, used for fades to and from black between scenes. */
    ensureCurtain() {
        if (this.curtain) return this.curtain;
        const el = document.createElement('div');
        el.className = 'ppai-curtain';
        Object.assign(el.style, {
            position: 'absolute',
            inset: '0',
            background: COLOR.bgDeep,
            opacity: '0',
            pointerEvents: 'none'
        });
        this.root.appendChild(el);
        this.curtain = el;
        return el;
    }

    setCurtain(opacity, color) {
        const el = this.ensureCurtain();
        el.style.opacity = String(opacity);
        if (color) el.style.background = color;
        return this;
    }
}
