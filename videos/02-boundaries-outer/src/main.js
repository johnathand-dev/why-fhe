import {
    Stage,
    Timeline,
    HudText,
    HudCross,
    HudWire,
    buildArchitecture,
    BoundaryTracker,
    focusUsers,
    focusCloud,
    COLOR,
    MONO,
    bars,
    beats,
    ease,
    lerp,
    clamp,
    remap,
    scramble,
    cipherText,
    hashRandom,
    mountScene,
    fitToWindow
} from '@ppai/scene-kit';
import '@ppai/scene-kit/style.css';

// ---------------------------------------------------------------------------
// Video 1, Act 2a — the architecture, and the four boundaries that face users.
//
//   1  user  <-> user          leaks who else was active   (violated: red X)
//   2  user  <-> SaaS          query must be opaque in flight
//   3  SaaS  <-> user          a user tries to prompt-inject the provider
//   4  SaaS  <-> all users     the whole population colludes
// ---------------------------------------------------------------------------

const stage = new Stage({ el: document.getElementById('stage') });
fitToWindow(stage.root);
stage.drawGrid({ from: -24, to: 70, step: 4, opacity: 0.3 });

const arch = buildArchitecture(stage);

// The whole diagram is rendered throughout, cloud included. The camera simply
// starts pointed at the users, with the cloud running off frame to the east —
// and at the end of the scene it pans east, sliding the users out and the cloud
// in, rather than cutting between two separate compositions.
const FOCUS = focusUsers(stage, arch);
const CLOUD = focusCloud(stage, arch);

// --- HUD furniture ----------------------------------------------------------

const sceneTitle = stage.addHud(
    new HudText({
        position: { x: 96, y: 92 },
        attrs: {
            label: { fontSize: 40, fontWeight: 700, fill: COLOR.text, textAnchor: 'start' },
            sub: { y: 42, fontSize: 21, fill: COLOR.textDim, textAnchor: 'start' }
        }
    })
);

// The boundary under discussion is the page title, with a strip of chips under
// it recording the ones already covered. It shares the top-left slot with
// `sceneTitle`, and the two cross-fade.
const tracker = new BoundaryTracker(stage);

const verdict = stage.addHud(
    new HudText({
        position: { x: 96, y: 1044 },
        attrs: {
            label: { fontSize: 20, fontWeight: 600, fill: COLOR.safe, textAnchor: 'start', fontFamily: MONO },
            sub: { text: '' }
        }
    })
);

// A payload that rides a link. Positioned by lerping between two world anchors
// and projecting — links here are straight point-to-point, so the lerp is exact
// and this stays crisp screen-space text instead of skewed diagram text.
const payload = stage.addHud(new HudWire({ position: { x: -500, y: -500 } }));
const payloadB = stage.addHud(new HudWire({ position: { x: -500, y: -500 } }));
// Boundary 1 needs a third slot: two requests stay parked on the provider while
// a reply travels back, so the reply cannot reuse either of their elements.
const response = stage.addHud(new HudWire({ position: { x: -500, y: -500 } }));

const cross = stage.addHud(new HudCross({ position: { x: -500, y: -500 } }));

// Beat commentary. This is a fixed caption slot under the title rather than a
// floating annotation: pinned to the diagram it collided with user labels and
// the provider block on almost every beat, and it reads as narration anyway.
const note = stage.addHud(
    new HudText({
        position: { x: 96, y: 252 },
        attrs: {
            label: { fontSize: 22, fontWeight: 600, fill: COLOR.danger, textAnchor: 'start' },
            sub: { y: 30, fontSize: 18, fill: COLOR.textDim, textAnchor: 'start' }
        }
    })
);

// The hacker beside the SaaS provider, drawn as a HUD glyph so it reads at any
// zoom and does not have to be an isometric solid.
const hacker = stage.addHud(
    new HudText({
        position: { x: -500, y: -500 },
        attrs: {
            label: { fontSize: 62, fontWeight: 700, fill: COLOR.hacker, text: '☠' },
            sub: { y: 46, fontSize: 17, fontWeight: 600, fill: COLOR.hacker, text: '' }
        }
    })
);

// --- Helpers ----------------------------------------------------------------

const lerpPt = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/** Place a HUD cell at a point `t` of the way along a world-space link. */
function placeAlong(cell, from, to, t) {
    const p = lerpPt(from, to, t);
    const s = stage.project(p.x, p.y);
    cell.position(s.x, s.y);
    return s;
}

/** Put a HUD cell on a world point with a screen-space offset. */
function placeAt(cell, world, dx = 0, dy = 0) {
    const s = stage.project(world.x, world.y);
    cell.position(s.x + dx, s.y + dy);
    return s;
}

function setBoundary(num, color = COLOR.cipher) {
    tracker.set(num, { color });
}

function setVerdict(text, color) {
    verdict.setText(text);
    verdict.attr('label/fill', color);
}

/** Ambient dots drifting along a link, phase-offset per slot. */
function ambient(link, t, { speed = 0.22, count = 3, color = COLOR.textDim, opacity = 0.7, seed = 0 } = {}) {
    link.hidePackets();
    for (let i = 0; i < count; i++) {
        const phase = (t * speed + i / count + hashRandom(seed, i) * 0.15) % 1;
        link.packet(i, phase, { opacity, fill: color });
    }
}

const A = arch.anchors;

// --- Timeline ---------------------------------------------------------------

const tl = new Timeline();

// Beat clock, hoisted so tracks registered early can still refer to late
// events. The ambient traffic track needs the pan time in particular: tracks
// run in registration order, so it cannot read a value a later track sets.
const B1 = bars(2);    //  5.0 s
const B2 = bars(7);    // 17.5 s
const B3 = bars(11);   // 27.5 s
const B4 = bars(14);   // 35.0 s
const OUT = bars(17);  // 42.5 s
const PAN_START = bars(18);
const PAN_DUR = bars(1);

// ===== 0.0 – 4.2  The users and their provider assemble ======================

// Open from black, held over from scene 1's fade out.
tl.add(0, bars(0.4), (p) => stage.setCurtain(1 - p), { ease: ease.inOutQuad });

tl.add(beats(0.5), bars(0.6), (p) => {
    sceneTitle.setOpacity(p).setShift(0, lerp(16, 0, p));
    sceneTitle.setText('Three users. One provider.', 'Start with what the user can actually see.');
}, { ease: ease.outCubic });

arch.cells.users.forEach((u, i) => {
    tl.add(beats(1) + i * beats(0.4), bars(0.3), (p) => {
        u.desk.setOpacity(p);
        u.screen.setOpacity(p);
    }, { ease: ease.outCubic });
});
tl.add(beats(2.4), bars(0.4), (p) => arch.setLabels({ users: p }), { ease: ease.outCubic });

tl.add(bars(1), bars(0.35), (p) => arch.cells.saas.setOpacity(p), { ease: ease.outCubic });
tl.add(bars(1.3), bars(0.4), (p) => arch.setLabels({ saas: p }), { ease: ease.outCubic });

arch.cells.userLinks.forEach((l, i) => {
    tl.add(bars(1.4) + i * beats(0.25), bars(0.25), (p) => l.setOpacity(p * 0.9), { ease: ease.outCubic });
});

// The provider's own uplink runs off the eastern edge of frame. Nothing is
// shown at the far end of it yet — that is what scene 3 dissolves into.
tl.add(bars(1.7), bars(0.35), (p) => arch.cells.saasToCloud.setOpacity(p * 0.8), { ease: ease.outCubic });

tl.add(bars(1.8), 120, (p, t) => {
    // Packets stop before the pan. A moving dot cannot be phase-matched across
    // a cut, so the scene hands over on static lines instead.
    const alpha = 1 - clamp((t - (PAN_START - 0.8)) / 0.8);
    if (alpha <= 0) {
        arch.cells.userLinks.forEach((l) => l.hidePackets());
        arch.cells.saasToCloud.hidePackets();
        return;
    }
    arch.cells.userLinks.forEach((l, i) =>
        ambient(l, t, { seed: i, color: '#93A5C0', speed: 0.18, opacity: 0.7 * alpha })
    );
    ambient(arch.cells.saasToCloud, t, { seed: 9, color: COLOR.cipher, speed: 0.16, count: 4, opacity: alpha });
}, { ambient: true });

// No second scene title here: the first boundary takes over the title slot at
// B1, and retitling in between would be one change too many.

// ===== 8.5 – 17  Boundary 1: user to user ===================================
//
// Two users query the provider; the responses come back carrying a trace of
// who else was on the box at the time. This one is deliberately broken.

tl.add(B1, 0.8, (p) => {
    tracker.setOpacity(p).setShift(0, lerp(14, 0, p));
    setBoundary('01', COLOR.danger);
    sceneTitle.setOpacity(1 - p);
}, { ease: ease.outCubic });

// Both users send a real request, staggered so they read as two separate
// tenants rather than one event. The requests then stay parked on the provider
// while the reply travels back — that concurrency is the entire reason the
// reply can leak, and without it on screen the leak arrives from nowhere.

const REQUEST_A = 'summarise my notes';
const REQUEST_C = 'draft the Q3 memo';

// A asks first.
tl.add(B1 + 0.5, 1.5, (p) => {
    payload.setOpacity(clamp(p * 4));
    payload.setPayload(REQUEST_A, COLOR.plain);
    placeAlong(payload, A.users[0], A.saas, p);
}, { ease: ease.inOutQuad });

// A's request lands and shrinks to a tenant chip above the provider.
tl.add(B1 + 2.1, 0.35, (p) => payload.setOpacity(1 - p), { ease: ease.inOutQuad });
tl.add(B1 + 2.5, 0.4, (p) => {
    payload.setOpacity(p);
    payload.setPayload('A', COLOR.plain);
    placeAt(payload, A.saas, -6, -176);
}, { ease: ease.outCubic });

// C asks a moment later.
tl.add(B1 + 1.4, 1.5, (p) => {
    payloadB.setOpacity(clamp(p * 4));
    payloadB.setPayload(REQUEST_C, COLOR.plain);
    placeAlong(payloadB, A.users[2], A.saas, p);
}, { ease: ease.inOutQuad });

tl.add(B1 + 3.0, 0.35, (p) => payloadB.setOpacity(1 - p), { ease: ease.inOutQuad });
tl.add(B1 + 3.4, 0.4, (p) => {
    payloadB.setOpacity(p);
    payloadB.setPayload('C', COLOR.plain);
    placeAt(payloadB, A.saas, -6, -128);
}, { ease: ease.outCubic });

// A's reply comes back, and past the halfway point it is carrying C.
//
// It does not fade out on arrival. The leaked reply is the evidence for the
// verdict, so it settles just below A's desk and stays there while the X is
// struck over the desk itself — otherwise the one frame that proves the point
// is gone before the viewer has read it.
tl.add(B1 + 4.1, 1.5, (p) => {
    response.setOpacity(clamp(p * 4));
    const leaked = p > 0.4;
    response.setPayload(
        leaked ? 'your summary  +  “C is on this host”' : 'your summary',
        leaked ? COLOR.danger : COLOR.safe
    );
    const s = placeAlong(response, A.saas, A.users[0], p);
    // Settles down and to the right of the seat, clear of both A's name label
    // and the X that is about to be struck over the desk.
    const settle = clamp((p - 0.72) / 0.28);
    response.position(s.x + lerp(0, 76, settle), s.y + lerp(0, 152, settle));
}, { ease: ease.inOutQuad });

// The X lands on user A's seat.
tl.add(B1 + 5.8, 0.9, (p) => {
    cross.setOpacity(1).setProgress(p);
    placeAt(cross, A.users[0], 0, -10);
}, { ease: ease.outCubic });

tl.add(B1 + 6.1, 0.8, (p) => {
    note.setOpacity(p);
    note.setText('Timing, cache state, shared context', 'A asked about A, and learned about C');
    note.attr('label/fill', COLOR.danger);
}, { ease: ease.outCubic });

tl.add(B1 + 6.1, 0.6, (p) => {
    setVerdict('VIOLATED  —  co-tenancy is observable', COLOR.danger);
    verdict.setOpacity(p);
}, { ease: ease.outCubic });

// Clear the beat.
tl.add(B1 + 9.2, 0.7, (p) => {
    cross.setOpacity(1 - p);
    note.setOpacity(1 - p);
    verdict.setOpacity(1 - p);
    payload.setOpacity(1 - p);
    payloadB.setOpacity(1 - p);
    response.setOpacity(1 - p);
}, { ease: ease.inOutQuad });

// ===== 17 – 25  Boundary 2: user to SaaS ====================================
//
// The query leaves in plaintext and shuffles into ciphertext as it approaches
// the provider. A hacker beside the provider inspects it and gets nothing.

tl.add(B2, 0.7, (p) => {
    tracker.setOpacity(1).setShift(0, 0);
    setBoundary('02');
}, { ease: ease.outCubic });

tl.add(B2 + 0.5, 1.0, (p) => {
    hacker.setOpacity(p);
    hacker.setText(undefined, 'inspecting');
    placeAt(hacker, A.saas, -30, -250);
}, { ease: ease.outCubic });

// The query travels; scramble progress is tied to how close it is to the block.
tl.add(B2 + 1.0, 3.0, (p, t) => {
    payload.setOpacity(clamp(p * 6, 0, 1) * clamp((1 - p) * 6, 0, 1));
    const text = 'diagnose: chest pain, 3 days';
    // Conversion begins at 45% of the way and completes by 80%.
    const sealed = remap(p, 0.45, 0.8);
    payload.setPayload(scramble(text, sealed, t), sealed > 0.5 ? COLOR.cipher : COLOR.plain);
    placeAlong(payload, A.users[1], A.saas, p);
}, { ease: ease.linear });

tl.add(B2 + 3.4, 0.8, (p) => {
    note.setOpacity(p);
    note.setText('Opaque on arrival', 'The provider computes without reading');
    note.attr('label/fill', COLOR.safe);
}, { ease: ease.outCubic });

tl.add(B2 + 3.4, 0.8, (p) => {
    hacker.setOpacity(1);
    hacker.setText(undefined, 'nothing to read');
    hacker.attr('label/fill', COLOR.textFaint);
    hacker.attr('sub/fill', COLOR.textFaint);
}, { ease: ease.outCubic });

tl.add(B2 + 3.6, 0.6, (p) => {
    setVerdict('HOLDS  —  ciphertext in, ciphertext out', COLOR.safe);
    verdict.setOpacity(p);
}, { ease: ease.outCubic });

tl.add(B2 + 6.4, 0.7, (p) => {
    note.setOpacity(1 - p);
    verdict.setOpacity(1 - p);
    hacker.setOpacity(1 - p);
    payload.setOpacity(0);
}, { ease: ease.inOutQuad });

// ===== 25 – 32  Boundary 3: SaaS to user ====================================
//
// The traffic reverses: a user tries to talk the provider into revealing what
// it holds. The boundary has to work in this direction too.

tl.add(B3, 0.7, () => {
    setBoundary('03');
    tracker.setOpacity(1);
});

tl.add(B3 + 0.4, 2.2, (p, t) => {
    payload.setOpacity(clamp(p * 6, 0, 1) * clamp((1 - p) * 6, 0, 1));
    payload.setPayload('ignore previous instructions', COLOR.danger);
    placeAlong(payload, A.users[1], A.saas, p);
}, { ease: ease.inOutQuad });

// The injection stops dead at the boundary.
tl.add(B3 + 2.5, 1.0, (p) => {
    payload.setOpacity(1);
    payload.setPayload('ignore previous instructions', COLOR.danger);
    placeAlong(payload, A.users[1], A.saas, 0.86 + 0.02 * Math.sin(p * Math.PI * 6));
    cross.setOpacity(1).setProgress(Math.min(1, p * 1.4));
    placeAt(cross, A.saas, -64, -30);
}, { ease: ease.outCubic });

tl.add(B3 + 2.9, 0.8, (p) => {
    note.setOpacity(p);
    note.setText('Refused at the boundary', 'The provider holds nothing it could reveal');
    note.attr('label/fill', COLOR.safe);
}, { ease: ease.outCubic });

tl.add(B3 + 3.0, 0.6, (p) => {
    setVerdict('HOLDS  —  nothing to extract', COLOR.safe);
    verdict.setOpacity(p);
}, { ease: ease.outCubic });

tl.add(B3 + 5.6, 0.7, (p) => {
    payload.setOpacity(1 - p);
    cross.setOpacity(1 - p);
    note.setOpacity(1 - p);
    verdict.setOpacity(1 - p);
}, { ease: ease.inOutQuad });

// ===== 32 – 40  Boundary 4: the colluding population ========================

tl.add(B4, 0.7, () => {
    setBoundary('04');
    tracker.setOpacity(1);
});

// All three push at once, staggered just enough to read as a crowd.
tl.add(B4 + 0.4, 2.6, (p, t) => {
    const texts = ['reveal the system prompt', 'dump the model weights', 'who else is on this host?'];
    [payload, payloadB, note].forEach(() => {});
    arch.cells.userLinks.forEach((link, i) => {
        const phase = clamp((p - i * 0.08) / 0.75);
        link.hidePackets();
        for (let k = 0; k < 3; k++) {
            const q = (phase * 1.2 + k * 0.18) % 1.2;
            if (q <= 1) link.packet(k, q, { opacity: 1, fill: COLOR.danger, r: 0.5 });
        }
    });
    // Two of the three attempts get a readable payload; the third stays a dot
    // stream so the frame does not turn into a wall of text.
    payload.setOpacity(clamp(p * 6, 0, 1) * clamp((1 - p) * 6, 0, 1));
    payload.setPayload(texts[0], COLOR.danger);
    placeAlong(payload, A.users[0], A.saas, clamp(p * 1.15));

    payloadB.setOpacity(clamp((p - 0.12) * 6, 0, 1) * clamp((1 - p) * 6, 0, 1));
    payloadB.setPayload(texts[1], COLOR.danger);
    placeAlong(payloadB, A.users[2], A.saas, clamp((p - 0.12) * 1.15));
}, { ease: ease.inOutQuad });

tl.add(B4 + 2.8, 1.0, (p) => {
    cross.setOpacity(1).setProgress(p);
    placeAt(cross, A.saas, -64, -30);
    arch.cells.userLinks.forEach((l) => l.hidePackets());
    payload.setOpacity(0);
    payloadB.setOpacity(0);
}, { ease: ease.outCubic });

tl.add(B4 + 3.1, 0.9, (p) => {
    note.setOpacity(p);
    note.setText('Collusion changes nothing', 'No quorum of users can open another user');
    note.attr('label/fill', COLOR.safe);
}, { ease: ease.outCubic });

tl.add(B4 + 3.2, 0.6, (p) => {
    setVerdict('HOLDS  —  against every user at once', COLOR.safe);
    verdict.setOpacity(p);
}, { ease: ease.outCubic });

// ===== 40 – 44  Hand off to the infrastructure half =========================

tl.add(OUT, 1.0, (p) => {
    cross.setOpacity(1 - p);
    note.setOpacity(1 - p);
    verdict.setOpacity(1 - p);
    tracker.setOpacity(1 - p);
}, { ease: ease.inOutQuad });

tl.add(OUT + 0.4, 1.6, (p) => {
    sceneTitle.setOpacity(1);
    sceneTitle.attr('label/opacity', p);
    sceneTitle.attr('sub/opacity', p);
    sceneTitle.setText('But that is only the half you can see.', 'The provider has compute providers of its own.');
}, { ease: ease.outCubic });

// The camera pans east. The users slide off the western edge and the cloud —
// which has been sitting there off frame the whole scene — slides in.
tl.add(PAN_START, PAN_DUR, (p) => {
    stage.setCamera({
        center: lerpPt(FOCUS.center, CLOUD.center, p),
        zoom: lerp(FOCUS.zoom, CLOUD.zoom, p)
    });
}, { ease: ease.inOutCubic });

// The title leaves during the move, so the scene ends on the cloud alone. That
// final frame has to match scene 3's opening frame exactly — the cut between
// them is a straight join, and any HUD left on screen here would pop.
tl.add(PAN_START, 1.2, (p) => {
    sceneTitle.attr('label/opacity', 1 - p);
    sceneTitle.attr('sub/opacity', 1 - p);
}, { ease: ease.inOutQuad });

// Hold on the cloud so the join lands on a settled frame.
tl.add(PAN_START + PAN_DUR, bars(1), () => {});

// --- Reset ------------------------------------------------------------------

function reset() {
    stage.setCamera(FOCUS);
    stage.setCurtain(0);

    // The cloud is up for the whole scene, just off frame to the east until the
    // camera pans onto it.
    arch.setOpacity(arch.cloudCells, 1);
    arch.cells.users.forEach((u) => {
        u.desk.setOpacity(0);
        u.screen.setOpacity(0);
    });
    arch.cells.saas.setOpacity(0);
    [...arch.cells.userLinks, arch.cells.saasToCloud].forEach((l) => {
        l.setOpacity(0);
        l.hidePackets();
    });
    // Cloud-internal links are drawn but carry no packets here. Scene 3 starts
    // their traffic a beat after the cut; animating them on both sides would
    // land the join on two different packet phases and show a jump.
    [arch.cells.computeToAccel, arch.cells.computeToRds].forEach((l) => {
        l.setOpacity(0.85);
        l.hidePackets();
    });
    arch.hideAllLabels();
    arch.setLabels({ cloud: 1, vpc: 1, azA: 1, azB: 1, igw: 1, ec2: 1, accel: 1, rds: 1 });

    sceneTitle.setOpacity(0).setShift(0, 0);
    sceneTitle.attr({ 'label/opacity': 1, 'sub/opacity': 1 });
    tracker.setOpacity(0).setShift(0, 0);
    verdict.setOpacity(0);
    note.setOpacity(0);
    payload.setOpacity(0);
    payloadB.setOpacity(0);
    response.setOpacity(0);
    cross.setOpacity(0);
    hacker.setOpacity(0);
    hacker.attr({ 'label/fill': COLOR.hacker, 'sub/fill': COLOR.hacker });
}

mountScene({
    name: '02-boundaries-outer',
    fps: 60,
    timeline: tl,
    seek: (t) => {
        reset();
        tl.seek(t);
        // Labels track the camera, so they are repositioned after the timeline
        // has settled this frame's camera and opacities.
        arch.syncLabels();
    }
});
