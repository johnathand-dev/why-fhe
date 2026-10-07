import { dia, util } from '@joint/core';
import { boxFaces, facePath } from './iso.js';
import { COLOR, FACE } from './theme.js';
import { shade } from './timeline.js';

// Everything here is authored in flat world coordinates. Height is expressed
// by the (-h, -h) identity from iso.js, which means a point sitting `h` units
// above (x, y) is simply the flat point (x - h, y - h). `lift` is that, and it
// lets links terminate on elevated features without any 3D machinery.
export const lift = (x, y, h = 0) => ({ x: x - h, y: y - h });

/**
 * A solid isometric box: three shaded faces sharing one base colour.
 * Footprint is the element size; `isoHeight` extrudes it upward.
 */
export const IsoBox = dia.Element.define(
    'ppai.IsoBox',
    {
        size: { width: 40, height: 40 },
        isoHeight: 20,
        baseColor: COLOR.compute,
        attrs: {
            root: { magnetSelector: 'top' },
            // Strokes must not be scaled by the isometric matrix, or a 1px
            // edge becomes a 20px slab at diagram zoom. With non-scaling-stroke
            // both widths and dash patterns stay in screen pixels.
            top: { stroke: 'rgba(255,255,255,0.28)', strokeWidth: 1, strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' },
            left: { stroke: 'rgba(0,0,0,0.35)', strokeWidth: 1, strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' },
            right: { stroke: 'rgba(0,0,0,0.25)', strokeWidth: 1, strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' }
        }
    },
    {
        markup: util.svg`
            <g @selector="body">
                <path @selector="left" />
                <path @selector="right" />
                <path @selector="top" />
            </g>
        `,

        initialize(...args) {
            dia.Element.prototype.initialize.apply(this, args);
            this.on('change:size change:isoHeight change:baseColor', () => this.refresh());
            this.refresh();
        },

        /** Recompute face geometry and shading from the current size/height/colour. */
        refresh() {
            const { width, height } = this.size();
            const h = this.get('isoHeight') ?? 0;
            const base = this.get('baseColor') ?? COLOR.compute;
            const faces = boxFaces(width, height, h);
            this.attr({
                top: { d: faces.top, fill: shade(base, FACE.top) },
                left: { d: faces.left, fill: shade(base, FACE.left) },
                right: { d: faces.right, fill: shade(base, FACE.right) }
            });
            return this;
        },

        /** Set footprint and height in one call. */
        setBox(width, depth, isoHeight) {
            this.set({ size: { width, height: depth }, isoHeight });
            return this;
        },

        /** Uniform opacity across all three faces. */
        setOpacity(o) {
            this.attr('body/opacity', o);
            return this;
        },

        /** World point at the centre of the top face, as a flat (lifted) point. */
        topCenter() {
            const { x, y } = this.position();
            const { width, height } = this.size();
            const h = this.get('isoHeight') ?? 0;
            return lift(x + width / 2, y + height / 2, h);
        },

        /** World point at the centre of the footprint, on the ground plane. */
        groundCenter() {
            const { x, y } = this.position();
            const { width, height } = this.size();
            return { x: x + width / 2, y: y + height / 2 };
        }
    }
);

/**
 * A flat plate on the ground plane — used for the cloud, the VPC, and the
 * availability zones. Reads as a translucent region rather than a solid.
 */
export const IsoPlate = dia.Element.define(
    'ppai.IsoPlate',
    {
        size: { width: 200, height: 200 },
        attrs: {
            root: { magnetSelector: 'face' },
            face: {
                fill: COLOR.vpc,
                fillOpacity: 0.55,
                stroke: COLOR.azEdge,
                strokeWidth: 1.5,
                strokeLinejoin: 'round',
                vectorEffect: 'non-scaling-stroke'
            }
        }
    },
    {
        markup: util.svg`<path @selector="face" />`,

        initialize(...args) {
            dia.Element.prototype.initialize.apply(this, args);
            this.on('change:size', () => this.refresh());
            this.refresh();
        },

        refresh() {
            const { width, height } = this.size();
            this.attr('face/d', facePath(width, height));
            return this;
        },

        setOpacity(o) {
            this.attr('face/opacity', o);
            return this;
        },

        groundCenter() {
            const { x, y } = this.position();
            const { width, height } = this.size();
            return { x: x + width / 2, y: y + height / 2 };
        }
    }
);

/**
 * An isometric cylinder, for the database.
 *
 * Drawn bottom-cap, then wall, then top-cap. The wall is a plain quad: its
 * straight lower edge is covered by the near bulge of the bottom ellipse and
 * its straight upper edge by the top ellipse, so no arc maths is needed.
 *
 * The silhouette extremes of a projected circle lie along the world (1, -1)
 * diagonal, because that is the direction the projection maps to horizontal.
 */
export const IsoCylinder = dia.Element.define(
    'ppai.IsoCylinder',
    {
        size: { width: 40, height: 40 },
        isoHeight: 18,
        baseColor: COLOR.storage,
        attrs: {
            root: { magnetSelector: 'capTop' },
            capBottom: { stroke: 'rgba(0,0,0,0.3)', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' },
            wall: { stroke: 'rgba(0,0,0,0.3)', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' },
            capTop: { stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' }
        }
    },
    {
        markup: util.svg`
            <g @selector="body">
                <ellipse @selector="capBottom" />
                <path @selector="wall" />
                <ellipse @selector="capTop" />
            </g>
        `,

        initialize(...args) {
            dia.Element.prototype.initialize.apply(this, args);
            this.on('change:size change:isoHeight change:baseColor', () => this.refresh());
            this.refresh();
        },

        refresh() {
            const { width, height } = this.size();
            const h = this.get('isoHeight') ?? 0;
            const base = this.get('baseColor') ?? COLOR.storage;
            const rx = width / 2;
            const ry = height / 2;
            const cx = rx;
            const cy = ry;
            // Horizontal silhouette extremes lie along the world (1, -1)
            // diagonal, at radius/sqrt(2) in each axis. Assumes a circular
            // footprint (width === height), which every cylinder here uses.
            const u = rx / Math.SQRT2;
            const ax = cx + u;
            const ay = cy - u;
            const bx = cx - u;
            const by = cy + u;

            this.attr({
                capBottom: { cx, cy, rx, ry, fill: shade(base, FACE.left) },
                capTop: { cx: cx - h, cy: cy - h, rx, ry, fill: shade(base, FACE.top) },
                wall: {
                    d: `M ${ax} ${ay} L ${ax - h} ${ay - h} L ${bx - h} ${by - h} L ${bx} ${by} Z`,
                    fill: shade(base, FACE.right)
                }
            });
            return this;
        },

        setOpacity(o) {
            this.attr('body/opacity', o);
            return this;
        },

        topCenter() {
            const { x, y } = this.position();
            const { width, height } = this.size();
            const h = this.get('isoHeight') ?? 0;
            return lift(x + width / 2, y + height / 2, h);
        },

        groundCenter() {
            const { x, y } = this.position();
            const { width, height } = this.size();
            return { x: x + width / 2, y: y + height / 2 };
        }
    }
);

/**
 * A link that carries animated packets.
 *
 * Packets ride the connection via `atConnectionRatio`, a JointJS link
 * attribute that positions a subelement at a fractional distance along the
 * rendered path. Setting it per frame keeps the motion inside the timeline —
 * no CSS animation, so headless capture sees exactly what the browser does.
 *
 * Five packet slots is enough for every stream in this series; unused slots
 * are simply hidden.
 */
export const PACKET_SLOTS = 5;

export const FlowLink = dia.Link.define(
    'ppai.FlowLink',
    {
        attrs: {
            line: {
                connection: true,
                fill: 'none',
                stroke: COLOR.textFaint,
                strokeWidth: 2,
                strokeLinecap: 'round',
                vectorEffect: 'non-scaling-stroke'
            },
            // Packet radii are in world units and so are projected along with
            // everything else. Kept small: at diagram zoom these read as
            // travelling dots, and anything larger shows the ellipse that the
            // isometric matrix necessarily makes of a circle.
            ...Object.fromEntries(
                Array.from({ length: PACKET_SLOTS }, (_, i) => [
                    `packet${i}`,
                    {
                        r: 0.32,
                        fill: COLOR.plain,
                        stroke: 'none',
                        atConnectionRatio: 0,
                        opacity: 0
                    }
                ])
            )
        }
    },
    {
        markup: util.svg`
            <path @selector="line" />
            <circle @selector="packet0" />
            <circle @selector="packet1" />
            <circle @selector="packet2" />
            <circle @selector="packet3" />
            <circle @selector="packet4" />
        `,

        /** Route between two flat world points. */
        route(from, to) {
            this.set({ source: { x: from.x, y: from.y }, target: { x: to.x, y: to.y } });
            return this;
        },

        /**
         * Place packet `i` at `ratio` along the path.
         * Pass `opacity: 0` (the default when a slot is unused) to hide it.
         */
        packet(i, ratio, { opacity = 1, fill, r } = {}) {
            const attrs = { atConnectionRatio: Math.max(0, Math.min(1, ratio)), opacity };
            if (fill) attrs.fill = fill;
            if (r != null) attrs.r = r;
            this.attr(`packet${i}`, attrs);
            return this;
        },

        hidePackets() {
            for (let i = 0; i < PACKET_SLOTS; i++) this.attr(`packet${i}/opacity`, 0);
            return this;
        },

        setLine(attrs) {
            this.attr('line', attrs);
            return this;
        },

        setOpacity(o) {
            this.attr('line/opacity', o);
            return this;
        }
    }
);

export const cellNamespace = {
    ppai: { IsoBox, IsoPlate, IsoCylinder, FlowLink }
};
