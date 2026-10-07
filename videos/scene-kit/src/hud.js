import { dia, util } from '@joint/core';
import { COLOR, FONT, MONO } from './theme.js';

// The HUD is a second JointJS paper stacked over the stage with an identity
// transform. Everything textual lives here, for two reasons: the stage's
// isometric matrix would skew glyphs, and screen-space text stays a constant
// size and stays crisp while the camera zooms.
//
// HUD elements that annotate diagram features are repositioned every frame
// from projected world coordinates, so they track the geometry exactly.

/** A line of text with an optional second line beneath it. */
export const HudText = dia.Element.define(
    'hud.Text',
    {
        size: { width: 1, height: 1 },
        attrs: {
            root: { magnetSelector: 'label' },
            label: {
                x: 0,
                y: 0,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                fontFamily: FONT,
                fontSize: 28,
                fontWeight: 500,
                fill: COLOR.text,
                text: ''
            },
            sub: {
                x: 0,
                y: 30,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                fontFamily: FONT,
                fontSize: 18,
                fontWeight: 400,
                fill: COLOR.textDim,
                text: ''
            }
        }
    },
    {
        markup: util.svg`
            <g @selector="group">
                <text @selector="label" />
                <text @selector="sub" />
            </g>
        `,

        /** Move so that the element's origin sits at this screen point. */
        moveTo(x, y) {
            this.position(x, y);
            return this;
        },

        /**
         * Set either line. Passing `undefined` leaves that line alone —
         * passing `''` clears it. The distinction matters because tracks
         * routinely update one line without touching the other.
         */
        setText(text, sub) {
            if (text !== undefined) this.attr('label/text', text);
            if (sub !== undefined) this.attr('sub/text', sub);
            return this;
        },

        setOpacity(o) {
            this.attr('group/opacity', o);
            return this;
        },

        /** Nudge the whole group without changing its anchor point. */
        setShift(dx, dy) {
            this.attr('group/transform', `translate(${dx}, ${dy})`);
            return this;
        }
    }
);

/** A rounded card, used for the threat-model panels and callouts. */
export const HudCard = dia.Element.define(
    'hud.Card',
    {
        size: { width: 420, height: 260 },
        attrs: {
            root: { magnetSelector: 'body' },
            body: {
                x: 0,
                y: 0,
                width: 'calc(w)',
                height: 'calc(h)',
                rx: 14,
                ry: 14,
                fill: '#0E1728',
                stroke: '#24314D',
                strokeWidth: 1.5
            },
            accent: {
                x: 0,
                y: 0,
                width: 4,
                height: 'calc(h)',
                rx: 2,
                ry: 2,
                fill: COLOR.cipher
            },
            // The index sits on its own line above the title so a long title
            // can use the card's full width without colliding with it.
            index: {
                x: 32,
                y: 38,
                textAnchor: 'start',
                textVerticalAnchor: 'middle',
                fontFamily: MONO,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '2',
                fill: COLOR.textFaint,
                text: ''
            },
            title: {
                x: 32,
                y: 80,
                textAnchor: 'start',
                textVerticalAnchor: 'middle',
                fontFamily: FONT,
                fontSize: 25,
                fontWeight: 600,
                fill: COLOR.text,
                text: ''
            },
            copy: {
                x: 32,
                y: 116,
                textAnchor: 'start',
                textVerticalAnchor: 'top',
                fontFamily: FONT,
                fontSize: 18,
                fontWeight: 400,
                lineHeight: 27,
                fill: COLOR.textDim,
                text: ''
            }
        }
    },
    {
        markup: util.svg`
            <g @selector="group">
                <rect @selector="body" />
                <rect @selector="accent" />
                <text @selector="index" />
                <text @selector="title" />
                <text @selector="copy" />
            </g>
        `,

        setCopy({ title, copy, index, accent }) {
            if (title !== undefined) this.attr('title/text', title);
            if (copy !== undefined) this.attr('copy/text', copy);
            if (index !== undefined) this.attr('index/text', index);
            if (accent !== undefined) this.attr('accent/fill', accent);
            return this;
        },

        setOpacity(o) {
            this.attr('group/opacity', o);
            return this;
        },

        setShift(dx, dy) {
            this.attr('group/transform', `translate(${dx}, ${dy})`);
            return this;
        }
    }
);

/** The numbered badge that names each privacy boundary as it is demonstrated. */
export const HudBadge = dia.Element.define(
    'hud.Badge',
    {
        size: { width: 1, height: 1 },
        attrs: {
            root: { magnetSelector: 'chip' },
            chip: {
                x: 0,
                y: -22,
                width: 44,
                height: 44,
                rx: 10,
                ry: 10,
                fill: 'rgba(167,139,250,0.14)',
                stroke: COLOR.cipher,
                strokeWidth: 1.5
            },
            num: {
                x: 22,
                y: 0,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                fontFamily: MONO,
                fontSize: 20,
                fontWeight: 600,
                fill: COLOR.cipher,
                text: ''
            },
            label: {
                x: 64,
                y: -8,
                textAnchor: 'start',
                textVerticalAnchor: 'middle',
                fontFamily: FONT,
                fontSize: 25,
                fontWeight: 600,
                fill: COLOR.text,
                text: ''
            },
            detail: {
                x: 64,
                y: 20,
                textAnchor: 'start',
                textVerticalAnchor: 'middle',
                fontFamily: FONT,
                fontSize: 18,
                fontWeight: 400,
                fill: COLOR.textDim,
                text: ''
            }
        }
    },
    {
        markup: util.svg`
            <g @selector="group">
                <rect @selector="chip" />
                <text @selector="num" />
                <text @selector="label" />
                <text @selector="detail" />
            </g>
        `,

        setBadge({ num, label, detail, color }) {
            if (num !== undefined) this.attr('num/text', String(num));
            if (label !== undefined) this.attr('label/text', label);
            if (detail !== undefined) this.attr('detail/text', detail);
            if (color !== undefined) {
                this.attr('num/fill', color);
                this.attr('chip/stroke', color);
            }
            return this;
        },

        setOpacity(o) {
            this.attr('group/opacity', o);
            return this;
        },

        setShift(dx, dy) {
            this.attr('group/transform', `translate(${dx}, ${dy})`);
            return this;
        }
    }
);

/**
 * A small numbered chip. A row of these is the progress strip that shows which
 * privacy boundaries have already been covered and which is on screen now.
 */
export const HudChip = dia.Element.define(
    'hud.Chip',
    {
        size: { width: 42, height: 42 },
        attrs: {
            root: { magnetSelector: 'box' },
            box: {
                x: 0,
                y: 0,
                width: 'calc(w)',
                height: 'calc(h)',
                rx: 9,
                ry: 9,
                fill: 'transparent',
                stroke: '#24314D',
                strokeWidth: 1.5
            },
            num: {
                x: 'calc(w/2)',
                y: 'calc(h/2)',
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                fontFamily: MONO,
                fontSize: 16,
                fontWeight: 600,
                fill: COLOR.textFaint,
                text: ''
            }
        }
    },
    {
        markup: util.svg`
            <g @selector="group">
                <rect @selector="box" />
                <text @selector="num" />
            </g>
        `,

        setNumber(text) {
            this.attr('num/text', String(text));
            return this;
        },

        /**
         * `state` is 'current', 'past' or 'future'. Past boundaries stay
         * legible rather than dropping away — the point of the strip is that
         * the guarantee is cumulative.
         */
        setState(state, color = COLOR.cipher) {
            if (state === 'current') {
                this.attr({
                    box: { stroke: color, fill: 'rgba(167,139,250,0.16)', strokeWidth: 1.8, opacity: 1 },
                    num: { fill: color, opacity: 1 }
                });
            } else if (state === 'past') {
                this.attr({
                    box: { stroke: color, fill: 'transparent', strokeWidth: 1.4, opacity: 0.45 },
                    num: { fill: color, opacity: 0.6 }
                });
            } else {
                this.attr({
                    box: { stroke: '#24314D', fill: 'transparent', strokeWidth: 1.4, opacity: 0.5 },
                    num: { fill: COLOR.textFaint, opacity: 0.5 }
                });
            }
            return this;
        },

        setOpacity(o) {
            this.attr('group/opacity', o);
            return this;
        }
    }
);

/** The big red X that marks a violated boundary. */
export const HudCross = dia.Element.define(
    'hud.Cross',
    {
        size: { width: 1, height: 1 },
        attrs: {
            root: { magnetSelector: 'strokeA' },
            ring: {
                cx: 0,
                cy: 0,
                r: 78,
                fill: 'rgba(244,63,94,0.10)',
                stroke: COLOR.danger,
                strokeWidth: 3
            },
            strokeA: {
                d: 'M -42 -42 L 42 42',
                stroke: COLOR.danger,
                strokeWidth: 12,
                strokeLinecap: 'round',
                fill: 'none'
            },
            strokeB: {
                d: 'M 42 -42 L -42 42',
                stroke: COLOR.danger,
                strokeWidth: 12,
                strokeLinecap: 'round',
                fill: 'none'
            }
        }
    },
    {
        markup: util.svg`
            <g @selector="group">
                <circle @selector="ring" />
                <path @selector="strokeA" />
                <path @selector="strokeB" />
            </g>
        `,

        /**
         * Draw the X on with two strokes and a scale-in ring.
         * `p` runs 0 -> 1; the strokes are revealed by dash offset so they
         * appear to be slashed on rather than faded in.
         */
        setProgress(p) {
            const len = 120;
            const a = Math.min(1, p / 0.5);
            const b = Math.max(0, Math.min(1, (p - 0.35) / 0.5));
            this.attr({
                ring: { r: 78 * Math.min(1, p / 0.4), opacity: Math.min(1, p / 0.4) },
                strokeA: { strokeDasharray: len, strokeDashoffset: len * (1 - a) },
                strokeB: { strokeDasharray: len, strokeDashoffset: len * (1 - b) }
            });
            return this;
        },

        setOpacity(o) {
            this.attr('group/opacity', o);
            return this;
        }
    }
);

/**
 * A padlocked containment box drawn around a region of the diagram.
 * Used for the "protective locked box" beats around the container and the
 * hardware boundary. The outline draws itself on via dash offset.
 */
export const HudLockBox = dia.Element.define(
    'hud.LockBox',
    {
        size: { width: 300, height: 200 },
        attrs: {
            root: { magnetSelector: 'frame' },
            frame: {
                x: 0,
                y: 0,
                width: 'calc(w)',
                height: 'calc(h)',
                rx: 16,
                ry: 16,
                fill: 'rgba(252,211,77,0.05)',
                stroke: COLOR.lock,
                strokeWidth: 2.5
            },
            shackle: {
                d: 'M -9 -6 A 9 9 0 0 1 9 -6 L 9 0 L 5 0 L 5 -6 A 5 5 0 0 0 -5 -6 L -5 0 L -9 0 Z',
                fill: COLOR.lock,
                stroke: 'none'
            },
            lockBody: {
                x: -13,
                y: 0,
                width: 26,
                height: 20,
                rx: 4,
                ry: 4,
                fill: COLOR.lock,
                stroke: 'none'
            },
            caption: {
                x: 0,
                y: 34,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                fontFamily: FONT,
                fontSize: 17,
                fontWeight: 600,
                fill: COLOR.lock,
                text: ''
            }
        }
    },
    {
        markup: util.svg`
            <g @selector="group">
                <rect @selector="frame" />
                <g @selector="lock">
                    <path @selector="shackle" />
                    <rect @selector="lockBody" />
                    <text @selector="caption" />
                </g>
            </g>
        `,

        /**
         * Frame the box on a screen-space rect and hang the padlock off one
         * edge. Nested boxes need `side: 'bottom'` for the inner one, or the
         * two captions land on top of each other along the shared top edge.
         */
        frameRect({ x, y, width, height }, side = 'top') {
            this.set({ position: { x, y }, size: { width, height } });
            const dy = side === 'bottom' ? height - 6 : -14;
            this.attr('lock/transform', `translate(${width / 2}, ${dy})`);
            return this;
        },

        /** `p` draws the outline on, then the padlock snaps shut. */
        setProgress(p) {
            const { width, height } = this.size();
            const perim = 2 * (width + height);
            const draw = Math.min(1, p / 0.7);
            const lock = Math.max(0, (p - 0.6) / 0.4);
            this.attr({
                frame: { strokeDasharray: perim, strokeDashoffset: perim * (1 - draw) },
                lock: { opacity: lock }
            });
            return this;
        },

        setCaption(text) {
            this.attr('caption/text', text ?? '');
            return this;
        },

        setOpacity(o) {
            this.attr('group/opacity', o);
            return this;
        }
    }
);

/** A free-form monospace readout, for plaintext turning into ciphertext. */
export const HudWire = dia.Element.define(
    'hud.Wire',
    {
        size: { width: 1, height: 1 },
        attrs: {
            root: { magnetSelector: 'plate' },
            plate: {
                x: -12,
                y: -18,
                width: 24,
                height: 36,
                rx: 8,
                ry: 8,
                fill: 'rgba(8,13,24,0.86)',
                stroke: 'rgba(148,163,184,0.35)',
                strokeWidth: 1
            },
            text: {
                x: 0,
                y: 0,
                textAnchor: 'middle',
                textVerticalAnchor: 'middle',
                fontFamily: MONO,
                fontSize: 17,
                fontWeight: 500,
                fill: COLOR.plain,
                text: ''
            }
        }
    },
    {
        markup: util.svg`
            <g @selector="group">
                <rect @selector="plate" />
                <text @selector="text" />
            </g>
        `,

        /** Set the payload and resize the plate to fit it. */
        setPayload(text, color) {
            const width = Math.max(28, text.length * 10.2 + 28);
            this.attr({
                text: { text, fill: color ?? COLOR.plain },
                plate: { x: -width / 2, width }
            });
            return this;
        },

        setOpacity(o) {
            this.attr('group/opacity', o);
            return this;
        }
    }
);

export const hudNamespace = {
    hud: {
        Text: HudText,
        Card: HudCard,
        Badge: HudBadge,
        Chip: HudChip,
        Cross: HudCross,
        LockBox: HudLockBox,
        Wire: HudWire
    }
};
