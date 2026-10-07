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
    mountScene,
    fitToWindow
} from '@ppai/scene-kit';
import '@ppai/scene-kit/style.css';

// ---------------------------------------------------------------------------
// Video 1, opening.
//
// One question, held long enough to be worth answering. Everything after this
// is the answer, broken into requirements.
// ---------------------------------------------------------------------------

const stage = new Stage({ el: document.getElementById('stage') });
fitToWindow(stage.root);

const W = stage.width;

const kicker = stage.addHud(
    new HudText({
        position: { x: W / 2, y: 430 },
        attrs: {
            label: { fontSize: 20, fontWeight: 600, fill: COLOR.cipher, letterSpacing: '5', fontFamily: FONT },
            sub: { text: '' }
        }
    })
);

const question = stage.addHud(
    new HudText({
        position: { x: W / 2, y: 540 },
        attrs: {
            label: { fontSize: 76, fontWeight: 700, fill: COLOR.text, letterSpacing: '-1.5', fontFamily: FONT },
            sub: { text: '' }
        }
    })
);

// A hairline that opens under the question. Plain SVG in the HUD's back layer:
// it is decoration, not content, and never needs to be picked.
let ruleEl = null;
const RULE_Y = 626;
function drawRule(p, fade = 1) {
    if (!ruleEl) {
        const ns = 'http://www.w3.org/2000/svg';
        ruleEl = document.createElementNS(ns, 'line');
        ruleEl.setAttribute('stroke', COLOR.cipher);
        ruleEl.setAttribute('stroke-width', '2');
        ruleEl.setAttribute('stroke-linecap', 'round');
        stage.hudPaper.getLayerNode('back').appendChild(ruleEl);
    }
    const half = 300 * p;
    ruleEl.setAttribute('x1', String(W / 2 - half));
    ruleEl.setAttribute('x2', String(W / 2 + half));
    ruleEl.setAttribute('y1', String(RULE_Y));
    ruleEl.setAttribute('y2', String(RULE_Y));
    ruleEl.setAttribute('opacity', String(clamp(p * 1.6) * 0.9 * fade));
}

// --- Timeline ---------------------------------------------------------------

const tl = new Timeline();

tl.add(0, bars(0.5), (p) => stage.setCurtain(1 - p), { ease: ease.inOutQuad });

tl.add(beats(1), bars(0.6), (p) => {
    kicker.setOpacity(p).setShift(0, lerp(14, 0, p));
    kicker.setText('VIDEO 1 — THE REQUIREMENTS');
}, { ease: ease.outCubic });

tl.add(bars(0.5), bars(0.8), (p) => {
    question.setOpacity(p).setShift(0, lerp(26, 0, p));
    question.setText('What does fully private data mean?');
}, { ease: ease.outQuart });

tl.add(bars(1.5), bars(0.6), (p) => drawRule(p), { ease: ease.inOutCubic });

// Out, on the bar, into the first requirement.
tl.add(bars(3.4), bars(0.6), (p) => {
    kicker.setOpacity(1 - p);
    question.setOpacity(1 - p);
    drawRule(1, 1 - p);
    stage.setCurtain(p);
}, { ease: ease.inOutQuad });

function reset() {
    stage.setCurtain(0);
    kicker.setOpacity(0).setShift(0, 0);
    question.setOpacity(0).setShift(0, 0);
    drawRule(0);
}

mountScene({
    name: '01-opening',
    fps: 60,
    timeline: tl,
    seek: (t) => {
        reset();
        tl.seek(t);
    }
});
