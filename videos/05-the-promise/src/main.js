import {
    Stage,
    Timeline,
    HudText,
    HudCard,
    COLOR,
    FONT,
    MONO,
    bars,
    beats,
    ease,
    lerp,
    clamp,
    hashRandom,
    mountScene,
    fitToWindow
} from '@ppai/scene-kit';
import '@ppai/scene-kit/style.css';

// ---------------------------------------------------------------------------
// Video 1, close.
//
// Three movements:
//   A  the phrase from the previous scene, and the doubt underneath it
//   B  the adversaries the phrase has to survive to mean anything
//   C  the vocabulary collapsing into a single promise
// ---------------------------------------------------------------------------

const stage = new Stage({ el: document.getElementById('stage') });
fitToWindow(stage.root);

const W = stage.width;
const H = stage.height;
const CX = W / 2;

// --- A: the reversal --------------------------------------------------------

const echo = stage.addHud(
    new HudText({
        position: { x: CX, y: 500 },
        attrs: {
            label: { fontSize: 68, fontWeight: 700, fill: COLOR.text, fontFamily: FONT },
            sub: { y: 74, fontSize: 40, fontWeight: 600, fill: COLOR.textFaint, fontFamily: FONT }
        }
    })
);

const doubt = stage.addHud(
    new HudText({
        position: { x: CX, y: 540 },
        attrs: {
            label: { fontSize: 52, fontWeight: 700, fill: COLOR.plain, fontFamily: FONT },
            sub: { text: '' }
        }
    })
);

// --- B: the adversaries -----------------------------------------------------

const advTitle = stage.addHud(
    new HudText({
        position: { x: CX, y: 240 },
        attrs: {
            label: { fontSize: 40, fontWeight: 700, fill: COLOR.text, fontFamily: FONT },
            sub: { y: 44, fontSize: 22, fill: COLOR.textDim, fontFamily: FONT }
        }
    })
);

const ADVERSARIES = [
    {
        index: 'IN YOUR PROVIDER',
        accent: COLOR.hacker,
        title: 'A rogue employee',
        copy: 'Inside your cloud provider, holding\nproduction access and a reason to look.'
    },
    {
        index: 'CLASSIFIED',
        accent: COLOR.plain,
        title: 'A FISA warrant',
        copy: 'Served on your provider, not on you.\nYou may never be told it happened.'
    },
    {
        index: 'UNDER GAG ORDER',
        accent: COLOR.cipher,
        title: 'A national security letter',
        copy: 'A subpoena attached to an order\nforbidding you from disclosing it.'
    }
];

const CARD_W = 500;
const CARD_H = 300;
const GAP = 56;
const ROW_X0 = (W - (CARD_W * 3 + GAP * 2)) / 2;
const ROW_Y = 420;

const cards = ADVERSARIES.map((spec, i) =>
    stage.addHud(
        new HudCard({
            position: { x: ROW_X0 + i * (CARD_W + GAP), y: ROW_Y },
            size: { width: CARD_W, height: CARD_H },
            attrs: {
                title: { fontSize: 27 },
                copy: { fontSize: 18, lineHeight: 28 },
                index: { fill: spec.accent, opacity: 0.9 }
            }
        }).setCopy(spec)
    )
);

const advNote = stage.addHud(
    new HudText({
        position: { x: CX, y: 800 },
        attrs: {
            label: { fontSize: 26, fontWeight: 500, fill: COLOR.textDim, fontFamily: FONT },
            sub: { text: '' }
        }
    })
);

// --- C: the vocabulary collapsing into one promise --------------------------
//
// The same terminology from the previous scene, scattered and then pulled into
// a single point. The collapse is the argument: all of it is describing one
// property, and the property is the thing worth promising.

const FRAGMENTS = [
    'Confidential Compute',
    'AMD SEV-SNP',
    'Remote Attestation',
    'Intel TDX',
    'TEE',
    'Secure Enclave',
    'Zero-knowledge proofs',
    'Fully homomorphic encryption',
    'Trusted Compute',
    'Oblivious RAM',
    'Intel SGX',
    'Multi-party computation',
    'Attestable Compute',
    'Zero-trust'
];

const FRAG_TARGET = { x: CX, y: 470 };

const fragments = FRAGMENTS.map((text, i) => {
    // Scattered deterministically around the target, wider than tall so the
    // field reads as a spread rather than a ring.
    const angle = hashRandom(i, 3) * Math.PI * 2;
    const radius = 300 + hashRandom(i, 4) * 460;
    const size = 20 + Math.round(hashRandom(i, 5) * 12);
    const cell = stage.addHud(
        new HudText({
            position: { x: CX, y: FRAG_TARGET.y },
            attrs: {
                label: {
                    fontSize: size,
                    fontWeight: 600,
                    fill: [COLOR.cipher, COLOR.container, COLOR.accel, COLOR.storage][i % 4],
                    fontFamily: FONT,
                    text
                },
                sub: { text: '' }
            }
        })
    );
    return {
        cell,
        size,
        from: {
            x: CX + Math.cos(angle) * radius * 1.35,
            y: FRAG_TARGET.y + Math.sin(angle) * radius * 0.46
        }
    };
});

const brand = stage.addHud(
    new HudText({
        position: { x: CX, y: 468 },
        attrs: {
            label: { fontSize: 78, fontWeight: 700, fill: COLOR.text, letterSpacing: '-1', fontFamily: FONT },
            sub: { y: 58, fontSize: 19, fontWeight: 600, fill: COLOR.cipher, letterSpacing: '5', fontFamily: MONO }
        }
    })
);

const promise = stage.addHud(
    new HudText({
        position: { x: CX, y: 660 },
        attrs: {
            label: { fontSize: 34, fontWeight: 500, fill: COLOR.text, fontFamily: FONT },
            sub: { y: 50, fontSize: 27, fontWeight: 600, fill: COLOR.safe, fontFamily: FONT }
        }
    })
);

// A hairline under the brand, drawn in the HUD back layer.
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
    const half = 260 * p;
    ruleEl.setAttribute('x1', String(CX - half));
    ruleEl.setAttribute('x2', String(CX + half));
    ruleEl.setAttribute('y1', '576');
    ruleEl.setAttribute('y2', '576');
    ruleEl.setAttribute('opacity', String(clamp(p * 1.6) * 0.85 * fade));
}

// --- Timeline ---------------------------------------------------------------

const tl = new Timeline();

const A = bars(0); // the reversal
const B = bars(5.5); // the adversaries
const C = bars(12); // the collapse

tl.add(0, bars(0.4), (p) => stage.setCurtain(1 - p), { ease: ease.inOutQuad });

// A ---------------------------------------------------------------------------

tl.add(A + beats(1), bars(0.7), (p) => {
    echo.setOpacity(p).setShift(0, lerp(16, 0, p));
    echo.setText('End-to-end encryption.');
}, { ease: ease.outQuart });

tl.add(A + bars(1.6), bars(0.5), (p) => {
    echo.attr('sub/opacity', p);
    echo.setText(undefined, 'Right?');
}, { ease: ease.outCubic });

tl.add(A + bars(3), bars(0.5), (p) => {
    echo.setOpacity(1 - p);
}, { ease: ease.inOutQuad });

tl.add(A + bars(3.3), bars(0.7), (p) => {
    doubt.setOpacity(p).setShift(0, lerp(14, 0, p));
    doubt.setText('Or have we been kidding ourselves this whole time?');
}, { ease: ease.outQuart });

tl.add(A + bars(5), bars(0.4), (p) => doubt.setOpacity(1 - p), { ease: ease.inOutQuad });

// B ---------------------------------------------------------------------------

tl.add(B, bars(0.7), (p) => {
    advTitle.setOpacity(p).setShift(0, lerp(16, 0, p));
    advTitle.setText(
        'Real privacy names its adversaries.',
        'The phrase only means something once you name the other end.'
    );
}, { ease: ease.outQuart });

cards.forEach((card, i) => {
    tl.add(B + bars(1) + i * bars(0.8), bars(0.6), (p) => {
        card.setOpacity(p).setShift(0, lerp(42, 0, p));
    }, { ease: ease.outQuart });
});

tl.add(B + bars(3.8), bars(0.7), (p) => {
    advNote.setOpacity(p);
    advNote.setText('Not one of these is stopped by a checkbox.');
}, { ease: ease.outCubic });

tl.add(B + bars(5.6), bars(0.5), (p) => {
    advTitle.setOpacity(1 - p);
    advNote.setOpacity(1 - p);
    cards.forEach((card) => card.setOpacity(1 - p));
}, { ease: ease.inOutQuad });

// C ---------------------------------------------------------------------------

// The terminology arrives scattered, then collapses to a point.
tl.add(C, bars(1.2), (p) => {
    fragments.forEach(({ cell, from }, i) => {
        const stagger = clamp((p - (i / fragments.length) * 0.5) / 0.5);
        cell.setOpacity(stagger * 0.85);
        cell.position(from.x, from.y);
    });
}, { ease: ease.outCubic });

tl.add(C + bars(1.4), bars(1.4), (p) => {
    fragments.forEach(({ cell, from, size }) => {
        const k = ease.inCubic(p);
        cell.position(lerp(from.x, FRAG_TARGET.x, k), lerp(from.y, FRAG_TARGET.y, k));
        // Shrink from the stored original, not from whatever the cell is
        // currently showing — reading back would make the frame depend on the
        // previous one.
        cell.attr('label/fontSize', lerp(size, size * 0.5, k));
        cell.setOpacity(0.85 * (1 - clamp((p - 0.45) / 0.55)));
    });
}, { ease: ease.linear });

tl.add(C + bars(2.6), bars(0.8), (p) => {
    brand.setOpacity(p).setShift(0, lerp(18, 0, p));
    brand.setText('Rhiannon AI');
}, { ease: ease.outQuart });

tl.add(C + bars(3.4), bars(0.6), (p) => drawRule(p), { ease: ease.inOutCubic });

tl.add(C + bars(4), bars(0.9), (p) => {
    promise.setOpacity(p).setShift(0, lerp(16, 0, p));
    promise.setText(
        'One promise, to your customers and to yourself:',
        'your data actually is completely, end to end, privately encrypted.'
    );
}, { ease: ease.outQuart });

// Out.
tl.add(bars(21), bars(1), (p) => {
    stage.setCurtain(p);
}, { ease: ease.inOutQuad });

// --- Reset ------------------------------------------------------------------

function reset() {
    stage.setCurtain(0);
    echo.setOpacity(0).setShift(0, 0);
    echo.attr({ 'sub/opacity': 0 });
    echo.setText('', '');
    doubt.setOpacity(0).setShift(0, 0);

    advTitle.setOpacity(0).setShift(0, 0);
    advNote.setOpacity(0);
    cards.forEach((card) => card.setOpacity(0).setShift(0, 0));

    fragments.forEach(({ cell, from, size }) => {
        cell.setOpacity(0);
        cell.position(from.x, from.y);
        cell.attr('label/fontSize', size);
    });
    brand.setOpacity(0).setShift(0, 0);
    promise.setOpacity(0).setShift(0, 0);
    drawRule(0);
}

mountScene({
    name: '05-the-promise',
    fps: 60,
    timeline: tl,
    seek: (t) => {
        reset();
        tl.seek(t);
    }
});
