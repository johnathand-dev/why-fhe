import { HudText, HudChip } from './hud.js';
import { COLOR, FONT, MONO } from './theme.js';

// The nine privacy boundaries, in the order the video walks them. Shared by
// scenes 2 and 3 so the progress strip is continuous across the cut: scene 3
// opens with the first four already marked as covered.
export const BOUNDARIES = [
    { num: '01', label: 'User ↔ user', detail: 'Two tenants, one provider' },
    { num: '02', label: 'User ↔ SaaS provider', detail: 'The provider must not read the query' },
    { num: '03', label: 'SaaS provider ↔ user', detail: 'A user probes the provider' },
    { num: '04', label: 'SaaS provider ↔ all users', detail: 'The whole population colludes' },
    { num: '05', label: 'Provider ↔ orchestration', detail: 'The harness runs the work it cannot read' },
    { num: '06', label: 'Compute unit ↔ hardware', detail: 'The guest does not trust the host' },
    { num: '07', label: 'Compute unit ↔ accelerator', detail: 'The link to the card is a public wire' },
    { num: '08', label: 'Compute unit ↔ storage', detail: 'The database holds rows it cannot read' },
    { num: '09', label: 'Every downstream service', detail: 'Orchestration, compute, storage, network, hardware' }
];

const indexOfNum = (num) => BOUNDARIES.findIndex((b) => b.num === num);

/**
 * The boundary being demonstrated, shown as the page title, over a strip of
 * chips recording which boundaries have already been covered.
 *
 * The strip is the reason this lives in scene-kit rather than in a scene: the
 * count has to keep running across the scene boundary, so both scenes read
 * from the same list.
 */
export class BoundaryTracker {
    constructor(stage, { x = 96, y = 92, chipY = 182, gap = 50 } = {}) {
        this.stage = stage;
        this.x = x;

        this.title = stage.addHud(
            new HudText({
                position: { x, y },
                attrs: {
                    label: {
                        fontSize: 40,
                        fontWeight: 700,
                        fill: COLOR.text,
                        textAnchor: 'start',
                        fontFamily: FONT
                    },
                    sub: {
                        y: 42,
                        fontSize: 21,
                        fill: COLOR.textDim,
                        textAnchor: 'start',
                        fontFamily: FONT
                    }
                }
            })
        );

        this.chips = BOUNDARIES.map((b, i) =>
            stage.addHud(
                new HudChip({ position: { x: x + i * gap, y: chipY } }).setNumber(b.num).setState('future')
            )
        );

        this.setOpacity(0);
    }

    /**
     * Show boundary `num` as current. Everything before it is marked covered,
     * everything after it stays dim.
     *
     * `color` tints the current chip and the number in the title, so a
     * violated boundary can be red while the rest stay violet.
     */
    set(num, { color = COLOR.cipher } = {}) {
        const i = indexOfNum(num);
        if (i < 0) return this;
        const b = BOUNDARIES[i];
        this.title.setText(`${b.num}   ${b.label}`, b.detail);
        this.title.attr('label/fill', COLOR.text);
        this.chips.forEach((chip, j) => {
            chip.setState(j === i ? 'current' : j < i ? 'past' : 'future', j === i ? color : COLOR.cipher);
        });
        return this;
    }

    /** Mark every boundary as covered, with none current. Used on the outro. */
    setAllCovered() {
        this.chips.forEach((chip) => chip.setState('past'));
        return this;
    }

    setOpacity(o) {
        this.title.setOpacity(o);
        this.chips.forEach((chip) => chip.setOpacity(o));
        return this;
    }

    /** Fade the strip independently of the title, for the intro and outro. */
    setChipsOpacity(o) {
        this.chips.forEach((chip) => chip.setOpacity(o));
        return this;
    }

    setShift(dx, dy) {
        this.title.setShift(dx, dy);
        return this;
    }
}
