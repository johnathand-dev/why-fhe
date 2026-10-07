import {
    Stage,
    Timeline,
    HudText,
    COLOR,
    FONT,
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
import { layoutCloud } from './layout.js';

// ---------------------------------------------------------------------------
// Video 1, Act 3 — the question.
//
// Ten boundaries have just been walked. The industry has a great many names for
// the property they add up to, and the point of the cloud is that none of them
// is the one people already understand.
// ---------------------------------------------------------------------------

const stage = new Stage({ el: document.getElementById('stage') });
fitToWindow(stage.root);

const W = stage.width;

// Weights drive font size. The terms that name the whole category sit largest;
// the vendor-specific and long-tail ones sit smaller, which is what makes the
// sprawl legible as sprawl.
const PHRASES = [
    { text: 'AMD SEV', weight: 1.0 },
    { text: 'AMD SEV-SNP', weight: 1.15 },
    { text: 'AMD SEV-TIO', weight: 0.9 },
    { text: 'AMD SEV-TSME', weight: 0.85 },
    { text: 'Remote Attestation', weight: 1.3 },
    { text: 'Attestable Compute', weight: 1.1 },
    { text: 'Trusted Compute', weight: 1.15 },
    { text: 'Secure Boot', weight: 1.0 },
    { text: 'Confidential Compute', weight: 1.5 },
    { text: 'Intel SGX', weight: 1.1 },
    { text: 'Intel TDX', weight: 1.15 },
    { text: 'Confidential Computing Zoo', weight: 0.85 },
    { text: 'Entity Attestation Tokens', weight: 0.9 },
    { text: 'Zero-trust', weight: 1.1 },
    { text: 'Multi-party computation', weight: 1.2 },
    { text: 'Zero-knowledge proofs', weight: 1.25 },
    { text: 'Partially homomorphic encryption', weight: 0.95 },
    { text: 'Fully homomorphic encryption', weight: 1.3 },
    { text: 'Oblivious RAM', weight: 1.0 },
    { text: 'TEE', weight: 1.4 },
    { text: 'Secure Enclave', weight: 1.2 }
];

const PALETTE = [COLOR.cipher, COLOR.container, COLOR.accel, COLOR.storage, COLOR.text, COLOR.plain];

const placed = layoutCloud(PHRASES);
if (placed.length !== PHRASES.length) {
    console.warn(`word cloud: placed ${placed.length} of ${PHRASES.length} phrases`);
}

// --- HUD --------------------------------------------------------------------

const question = stage.addHud(
    new HudText({
        position: { x: W / 2, y: 520 },
        attrs: {
            label: { fontSize: 52, fontWeight: 700, fill: COLOR.text, fontFamily: FONT },
            sub: { text: '' }
        }
    })
);

const words = placed.map((w) =>
    stage.addHud(
        new HudText({
            position: { x: w.x, y: w.y },
            attrs: {
                label: {
                    fontSize: w.fontSize,
                    fontWeight: w.fontSize > 38 ? 700 : 600,
                    fill: PALETTE[Math.floor(hashRandom(w.i, 11) * PALETTE.length)],
                    fontFamily: FONT,
                    text: w.text
                },
                sub: { text: '' }
            }
        })
    )
);

const answer = stage.addHud(
    new HudText({
        position: { x: W / 2, y: 540 },
        attrs: {
            label: { fontSize: 68, fontWeight: 700, fill: COLOR.text, fontFamily: FONT },
            sub: { y: 68, fontSize: 24, fill: COLOR.textDim, fontFamily: FONT }
        }
    })
);

// --- Timing -----------------------------------------------------------------

const CLOUD_IN = bars(2.5); // 6.25 s — first phrase appears
const STAGGER = beats(1); // one phrase per beat
const FADE_IN = 0.8;
const HOLD = 7.0;
const FADE_OUT = 0.9;
const FADE_ALL = bars(9); // 22.5 s — everything still up starts leaving
const FADE_ALL_DUR = bars(1);

/** A phrase's own opacity envelope: in, hold, out. */
function envelope(t, start) {
    if (t < start) return 0;
    const a = clamp((t - start) / FADE_IN);
    const b = 1 - clamp((t - start - FADE_IN - HOLD) / FADE_OUT);
    return Math.min(a, b);
}

// --- Timeline ---------------------------------------------------------------

const tl = new Timeline();

// Up from the black scene 3 ends on.
tl.add(0, bars(0.4), (p) => stage.setCurtain(1 - p), { ease: ease.inOutQuad });

// The question, centred and alone.
tl.add(beats(1), bars(0.7), (p) => {
    question.setOpacity(p).setShift(0, lerp(20, 0, p));
    question.setText('What do we call this level of privacy guarantee?');
}, { ease: ease.outQuart });

// It moves up and shrinks to make room for the answers.
tl.add(bars(1.8), bars(0.5), (p) => {
    question.attr('label/fontSize', lerp(52, 33, p));
    question.setShift(0, lerp(0, -370, p));
    question.attr('label/fill', p > 0.5 ? COLOR.textDim : COLOR.text);
}, { ease: ease.inOutCubic });

// The vocabulary arrives, churning: each phrase fades in, holds, and leaves,
// with lifetimes overlapping enough that the cloud is full through the middle
// of the beat. One track drives all of them, because each phrase's opacity is a
// pure function of the clock and its own index.
tl.add(CLOUD_IN, FADE_ALL + FADE_ALL_DUR - CLOUD_IN, (p, t) => {
    const globalAlpha = 1 - clamp((t - FADE_ALL) / FADE_ALL_DUR);
    words.forEach((cell, i) => {
        cell.setOpacity(envelope(t, CLOUD_IN + i * STAGGER) * globalAlpha);
    });
});

// The question leaves with the cloud.
tl.add(FADE_ALL, FADE_ALL_DUR, (p) => {
    question.setOpacity(1 - p);
}, { ease: ease.inOutQuad });

// One phrase left standing.
tl.add(bars(10.2), bars(0.7), (p) => {
    answer.setOpacity(p).setShift(0, lerp(18, 0, p));
    answer.setText('End-to-end Encryption?');
}, { ease: ease.outQuart });

tl.add(bars(14), bars(1), (p) => {
    stage.setCurtain(p);
}, { ease: ease.inOutQuad });

// --- Reset ------------------------------------------------------------------

function reset() {
    stage.setCurtain(0);
    question.setOpacity(0).setShift(0, 0);
    question.attr({ 'label/fontSize': 52, 'label/fill': COLOR.text });
    words.forEach((cell) => cell.setOpacity(0));
    answer.setOpacity(0).setShift(0, 0);
}

mountScene({
    name: '04-what-do-we-call-it',
    fps: 60,
    timeline: tl,
    seek: (t) => {
        reset();
        tl.seek(t);
    }
});
