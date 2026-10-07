import {
    Stage,
    Timeline,
    HudText,
    HudCard,
    COLOR,
    FONT,
    ease,
    lerp,
    remap,
    clamp,
    typeOn,
    mountScene,
    fitToWindow
} from '@ppai/scene-kit';
import '@ppai/scene-kit/style.css';

// ---------------------------------------------------------------------------
// Video 1, Act 1 — "What threat models apply?"
//
// A title, then the three claims from the brief, each landing as a card and
// then settling into a row so the closing line can tie them together.
// ---------------------------------------------------------------------------

const stage = new Stage({ el: document.getElementById('stage') });
fitToWindow(stage.root);

const W = stage.width;
const H = stage.height;

const CARDS = [
    {
        index: 'THREAT MODEL 01',
        accent: COLOR.plain,
        title: 'Checkbox encryption is not a sale',
        copy:
            'A team already content with bucket-wide\nencryption under a cloud-managed key has\nbought the feeling, not the property.\n\nThey will never be a paying customer.'
    },
    {
        index: 'THREAT MODEL 02',
        accent: COLOR.container,
        title: 'The customer is not the user',
        copy:
            'The people typing into a product every day\nare often the ones pushing their vendors to\nraise the floor.\n\nThe buyer signs. The user applies pressure.'
    },
    {
        index: 'THREAT MODEL 03',
        accent: COLOR.danger,
        title: 'The customer may oppose the user',
        copy:
            'Sometimes the daily user wants to lift a\nclever network out of the box it shipped in.\n\nUnfortunately for them, the weights are\nencrypted.'
    }
];

// --- Persistent cells -------------------------------------------------------

const title = stage.addHud(
    new HudText({
        position: { x: W / 2, y: 300 },
        attrs: {
            label: { fontSize: 76, fontWeight: 700, fill: COLOR.text, letterSpacing: '-1.5' },
            sub: { y: 76, fontSize: 27, fill: COLOR.textDim, letterSpacing: '0' }
        }
    })
);

const kicker = stage.addHud(
    new HudText({
        position: { x: W / 2, y: 196 },
        attrs: {
            label: { fontSize: 20, fontWeight: 600, fill: COLOR.cipher, letterSpacing: '5' },
            sub: { text: '' }
        }
    })
);

const CARD_W = 500;
const CARD_H = 310;
const GAP = 60;
const ROW_Y = 486;
const RULE_Y = 376;
const ROW_X0 = (W - (CARD_W * 3 + GAP * 2)) / 2;

const cards = CARDS.map((spec, i) =>
    stage.addHud(
        new HudCard({
            position: { x: ROW_X0 + i * (CARD_W + GAP), y: ROW_Y },
            size: { width: CARD_W, height: CARD_H },
            attrs: {
                title: { fontSize: 25 },
                copy: { fontSize: 18, lineHeight: 27 },
                index: { fill: spec.accent, opacity: 0.85 }
            }
        }).setCopy(spec)
    )
);

const closer = stage.addHud(
    new HudText({
        position: { x: W / 2, y: 916 },
        attrs: {
            label: { fontSize: 32, fontWeight: 500, fill: COLOR.text },
            sub: { y: 44, fontSize: 21, fill: COLOR.textFaint }
        }
    })
);

// --- Timeline ---------------------------------------------------------------

const tl = new Timeline();

// 0.0 – 3.6  Title in.
tl.add(0, 1.4, (p) => {
    kicker.setOpacity(p).setText('VIDEO 1 — THE THREAT LANDSCAPE').setShift(0, lerp(18, 0, p));
}, { ease: ease.outCubic });

tl.add(0.5, 1.6, (p) => {
    title.setOpacity(p).setShift(0, lerp(28, 0, p));
    title.setText(typeOn('What threat models apply?', p));
}, { ease: ease.outQuart });

tl.add(1.8, 1.0, (p) => {
    title.attr('sub/opacity', p);
    title.setText(undefined, 'Before you can preserve privacy, decide whose');
}, { ease: ease.outCubic });

// A hairline that draws out under the title.
tl.add(2.0, 1.0, (p) => drawRule(p), { ease: ease.inOutCubic });

// 3.6 – 15.0  Cards land one at a time.
const CARD_IN = 3.9;
const CARD_STAGGER = 2.9;

cards.forEach((card, i) => {
    const at = CARD_IN + i * CARD_STAGGER;

    // The card rises and fades in.
    tl.add(at, 0.9, (p) => {
        card.setOpacity(p).setShift(0, lerp(46, 0, p));
    }, { ease: ease.outQuart });

    // Its body copy types on just behind the card's arrival.
    tl.add(at + 0.45, 1.5, (p) => {
        card.attr('copy/text', typeOn(CARDS[i].copy, p));
    }, { ease: ease.linear });

    // While a card is "current" it sits forward; older cards recede.
    tl.add(at, CARD_STAGGER + 1.2, (p, t) => {
        const isCurrent = t >= at && t < at + CARD_STAGGER;
        const focus = isCurrent ? 1 : 0.42;
        card.attr('body/stroke', isCurrent ? CARDS[i].accent : '#24314D');
        card.attr('body/strokeOpacity', isCurrent ? 0.75 : 1);
        card.attr('accent/opacity', focus);
        card.attr('title/fill', isCurrent ? COLOR.text : COLOR.textDim);
        card.attr('copy/opacity', isCurrent ? 1 : 0.55);
    });
});

// 12.5 – 15.5  Title shrinks up out of the way so the row reads as a set.
tl.add(12.4, 1.2, (p) => {
    const k = 1 - 0.24 * p;
    title.attr('label/fontSize', 76 * k);
    title.setShift(0, lerp(0, -46, p));
    title.attr('sub/opacity', 1 - p);
    // The rule belongs to the title block, so it leaves with it rather than
    // being left stranded above the cards.
    drawRule(1, 1 - p);
}, { ease: ease.inOutCubic });

// 15.6 – 20  All three settle to equal weight, closing line arrives.
tl.add(15.6, 1.2, (p) => {
    cards.forEach((card, i) => {
        card.attr('body/stroke', '#24314D');
        card.attr('accent/opacity', lerp(0.42, 1, p));
        card.attr('title/fill', COLOR.text);
        card.attr('copy/opacity', lerp(0.55, 0.92, p));
        card.setShift(0, lerp(0, -18, p));
        card.attr('accent/fill', CARDS[i].accent);
    });
}, { ease: ease.inOutCubic });

tl.add(16.4, 1.6, (p) => {
    closer.setOpacity(p).setShift(0, lerp(24, 0, p));
    closer.setText(
        'Three different buyers. Three different adversaries.',
        'Only one of them is paying you to make the guarantee real.'
    );
}, { ease: ease.outQuart });

// 20.6 – 23  Fade to black for the cut into the architecture.
tl.add(20.8, 1.6, (p) => {
    stage.setCurtain(p);
}, { ease: ease.inOutQuad });

tl.add(22.4, 0.6, () => {
    stage.setCurtain(1);
});

// --- Helpers ----------------------------------------------------------------

// A plain SVG hairline in the HUD's back layer. Kept out of the cell graph
// because it is decoration, not content, and it never needs to be picked.
let ruleEl = null;
function drawRule(p, fade = 1) {
    if (!ruleEl) {
        const ns = 'http://www.w3.org/2000/svg';
        ruleEl = document.createElementNS(ns, 'line');
        ruleEl.setAttribute('stroke', COLOR.cipher);
        ruleEl.setAttribute('stroke-width', '2');
        ruleEl.setAttribute('stroke-linecap', 'round');
        stage.hudPaper.getLayerNode('back').appendChild(ruleEl);
    }
    const half = 210 * p;
    ruleEl.setAttribute('x1', String(W / 2 - half));
    ruleEl.setAttribute('x2', String(W / 2 + half));
    ruleEl.setAttribute('y1', String(RULE_Y));
    ruleEl.setAttribute('y2', String(RULE_Y));
    ruleEl.setAttribute('opacity', String(clamp(p * 1.6) * 0.9 * fade));
}

// --- Reset ------------------------------------------------------------------

// seek() must be total: anything a later track sets has to be cleared here so
// scrubbing backwards cannot leave residue on screen.
function reset() {
    kicker.setOpacity(0).setShift(0, 0);
    title.setOpacity(0).setShift(0, 0).setText('', '');
    title.attr({ 'label/fontSize': 76, 'sub/opacity': 0 });
    drawRule(0);
    cards.forEach((card, i) => {
        card.setOpacity(0).setShift(0, 0);
        card.attr({
            'copy/text': '',
            'copy/opacity': 1,
            'accent/opacity': 1,
            'accent/fill': CARDS[i].accent,
            'body/stroke': '#24314D',
            'body/strokeOpacity': 1,
            'title/fill': COLOR.text
        });
    });
    closer.setOpacity(0).setShift(0, 0);
    stage.setCurtain(0);
}

mountScene({
    name: '01-threat-models',
    fps: 60,
    timeline: tl,
    seek: (t) => {
        // Reset first, then let the timeline paint the frame on top.
        reset();
        tl.seek(t);
    }
});
