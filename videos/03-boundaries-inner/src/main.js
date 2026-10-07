import {
    Stage,
    Timeline,
    HudText,
    HudLockBox,
    HudWire,
    buildArchitecture,
    BoundaryTracker,
    focusCloud,
    focusInstance,
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
    hexBlock,
    hashRandom,
    mountScene,
    fitToWindow
} from '@ppai/scene-kit';
import '@ppai/scene-kit/style.css';

// ---------------------------------------------------------------------------
// Video 1, Act 2b — the boundaries the user never sees.
//
//   5   SaaS provider  ->  its orchestration layer   (locked box: container)
//   6   compute unit   ->  its hardware              (locked box: inside EC2)
//   7   compute unit   ->  its accelerator cards
//   8   compute unit   ->  its storage
//   9   every downstream service, on every channel
//  10   and therefore: the cloud provider learns nothing
// ---------------------------------------------------------------------------

const stage = new Stage({ el: document.getElementById('stage') });
fitToWindow(stage.root);
// Identical to scene 2's grid: this scene opens on the frame that one ends
// on, so every persistent element has to match, the ground included.
stage.drawGrid({ from: -24, to: 70, step: 4, opacity: 0.3 });

const arch = buildArchitecture(stage);
const A = arch.anchors;
const R = arch.regions;

// The whole diagram is rendered here too. The users are still there, just off
// frame to the west — scene 2 panned the camera off them, and this scene picks
// up on exactly that pose. Both scenes derive it from the same function so the
// join between them lands on identical frames.
const CLOUD_WIDE = focusCloud(stage, arch);
const CLOSE = focusInstance(stage, arch);

// --- HUD --------------------------------------------------------------------

const sceneTitle = stage.addHud(
    new HudText({
        position: { x: 96, y: 92 },
        attrs: {
            label: { fontSize: 40, fontWeight: 700, fill: COLOR.text, textAnchor: 'start' },
            sub: { y: 42, fontSize: 21, fill: COLOR.textDim, textAnchor: 'start' }
        }
    })
);

const note = stage.addHud(
    new HudText({
        position: { x: 96, y: 252 },
        attrs: {
            label: { fontSize: 22, fontWeight: 600, fill: COLOR.safe, textAnchor: 'start' },
            sub: { y: 30, fontSize: 18, fill: COLOR.textDim, textAnchor: 'start' }
        }
    })
);

// Same tracker as scene 2. It reads from the shared boundary list, so the
// first four chips are already marked covered when this scene opens.
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

const lockContainer = stage.addHud(new HudLockBox({ position: { x: -900, y: -900 } }));
const lockHardware = stage.addHud(new HudLockBox({ position: { x: -900, y: -900 } }));
// Tinted to match the guest VM it encloses, so the two nested boxes are
// distinguishable at a glance. One `attr(path, value)` call per attribute:
// the object form does not expand slash-separated paths, and passing them as
// object keys silently sets nothing.
lockHardware.attr('frame/stroke', COLOR.vm);
lockHardware.attr('frame/fill', 'rgba(139,92,246,0.06)');
lockHardware.attr('shackle/fill', COLOR.vm);
lockHardware.attr('lockBody/fill', COLOR.vm);
lockHardware.attr('caption/fill', COLOR.vm);

const payload = stage.addHud(new HudWire({ position: { x: -900, y: -900 } }));
const wireAccel = stage.addHud(new HudWire({ position: { x: -900, y: -900 } }));
const wireStore = stage.addHud(new HudWire({ position: { x: -900, y: -900 } }));

// Closing statement, held on its own over a darkened stage.
const closer = stage.addHud(
    new HudText({
        position: { x: stage.width / 2, y: 470 },
        attrs: {
            label: { fontSize: 46, fontWeight: 700, fill: COLOR.text },
            sub: { y: 62, fontSize: 25, fill: COLOR.textDim }
        }
    })
);
const closerTail = stage.addHud(
    new HudText({
        position: { x: stage.width / 2, y: 640 },
        attrs: {
            label: { fontSize: 27, fontWeight: 500, fill: COLOR.cipher },
            sub: { y: 40, fontSize: 21, fill: COLOR.textFaint }
        }
    })
);

// --- Helpers ----------------------------------------------------------------

const lerpPt = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

function placeAlong(cell, from, to, t) {
    const p = lerpPt(from, to, t);
    const s = stage.project(p.x, p.y);
    cell.position(s.x, s.y);
}

function setBoundary(num, color = COLOR.cipher) {
    tracker.set(num, { color });
}

function setVerdict(text, color = COLOR.safe) {
    verdict.setText(text);
    verdict.attr('label/fill', color);
}

// Containment overlays are screen-space, so they depend on the camera. Tracks
// only record *what* they want; the framing itself happens after the timeline
// has finished, once the camera for this frame is final. Doing it inside the
// tracks framed them against whatever camera existed at their registration
// point, which left them a pose behind during the pull-back.
const lockState = {
    container: { on: 0, p: 0, region: R.container, pad: 30, caption: 'sealed harness', side: 'top' },
    // The hardware box encloses the container box, so its padlock goes on the
    // bottom edge to keep the two captions apart.
    hardware: { on: 0, p: 0, region: R.vm, pad: 20, caption: 'encrypted guest', side: 'bottom' }
};

function applyLock(cell, state) {
    cell.setOpacity(state.on);
    if (state.on <= 0) return;
    cell.frameRect(stage.regionRect(state.region, state.pad), state.side);
    cell.setCaption(state.caption);
    cell.setProgress(state.p);
}

function ambient(link, t, { speed = 0.24, count = 3, color = COLOR.textDim, opacity = 0.8, seed = 0 } = {}) {
    link.hidePackets();
    for (let i = 0; i < count; i++) {
        const phase = (t * speed + i / count + hashRandom(seed, i) * 0.15) % 1;
        link.packet(i, phase, { opacity, fill: color });
    }
}

/** Interpolate between the two camera poses. */
function camera(t) {
    return {
        center: lerpPt(CLOUD_WIDE.center, CLOSE.center, t),
        zoom: lerp(CLOUD_WIDE.zoom, CLOSE.zoom, t)
    };
}

// --- Timeline ---------------------------------------------------------------

const tl = new Timeline();

// ===== 0 – 5  Open on the cloud, then push into the instance ================
//
// No fade up from black: scene 2 dissolves directly into this frame, so the
// first second has to be a stable, fully lit composition.

tl.add(beats(1.5), bars(0.6), (p) => {
    sceneTitle.setOpacity(p).setShift(0, lerp(14, 0, p));
    sceneTitle.setText('The SaaS provider has providers.', 'Everything below this line is someone else’s computer.');
}, { ease: ease.outCubic });

// Push in.
tl.add(bars(0.6), bars(1.2), (p) => {
    stage.setCamera(camera(p));
    // The ground grid and the outer regions drop back so the instance reads as
    // the subject rather than one object among many.
    stage.setGridOpacity(lerp(0.3, 0.1, p));
    arch.setOpacity([arch.cells.cloud, arch.cells.vpc], 1 - p * 0.5);
    arch.setOpacity([arch.cells.azB, arch.cells.publicB, arch.cells.publicA], 1 - p * 0.55);
    arch.setLabels({ cloud: 1 - p, vpc: 1 - p, azA: 1 - p, azB: 1 - p, igw: 1 - p, saas: 1 - p, users: 1 - p });

    // The users and the provider leave with the wide shot. The camera move
    // alone does not clear them — the provider block stays clipped to the
    // western edge at every zoom this scene uses, and comes back into frame
    // during the pull-back at boundary 09.
    const o = 1 - p;
    arch.cells.users.forEach((u) => {
        u.desk.setOpacity(o);
        u.screen.setOpacity(o);
    });
    arch.cells.saas.setOpacity(o);
    arch.cells.userLinks.forEach((l) => l.setOpacity(o * 0.9));
    arch.cells.saasToCloud.setOpacity(o * 0.8);
}, { ease: ease.inOutCubic });

// Once close, name the parts of the stack.
tl.add(bars(1.9), bars(0.4), (p) => arch.setLabels({ vm: p, container: p }), { ease: ease.outCubic });
tl.add(bars(1.9), bars(0.4), () => arch.setLabels({ ec2: 1, accel: 1, rds: 1 }));

// Ambient internal traffic for the rest of the scene.
// Internal traffic starts just after the cut and fades up, for the same
// phase-matching reason: at t = 0 these links must be as static as they were in
// the frame this scene is joined to.
tl.add(bars(0.4), 120, (p, t) => {
    const alpha = clamp((t - bars(0.4)) / 0.9);
    if (alpha <= 0) {
        arch.cells.computeToAccel.hidePackets();
        arch.cells.computeToRds.hidePackets();
        return;
    }
    ambient(arch.cells.computeToAccel, t, { seed: 3, color: COLOR.accel, speed: 0.34, count: 3, opacity: 0.8 * alpha });
    ambient(arch.cells.computeToRds, t, { seed: 4, color: COLOR.storage, speed: 0.28, count: 3, opacity: 0.8 * alpha });
}, { ambient: true });

tl.add(bars(2), bars(0.3), (p) => {
    sceneTitle.attr('label/opacity', 1 - p);
    sceneTitle.attr('sub/opacity', 1 - p);
}, { ease: ease.inOutQuad });

tl.add(bars(2.3), bars(0.3), (p) => {
    sceneTitle.setOpacity(1);
    sceneTitle.setText('Six more boundaries, none of them user-visible.', 'Each one has to hold on its own.');
    sceneTitle.attr('label/opacity', p);
    sceneTitle.attr('sub/opacity', p);
}, { ease: ease.outCubic });

// ===== 6.6 – 13  Boundary 5: provider to its orchestration layer ============

const B5 = bars(3);    //  7.5 s

tl.add(B5, 0.7, (p) => {
    tracker.setOpacity(p).setShift(0, lerp(14, 0, p));
    setBoundary('05');
    sceneTitle.setOpacity(1 - p);
}, { ease: ease.outCubic });

// A query arrives from off-stage and enters the container.
tl.add(B5 + 0.5, 2.0, (p, t) => {
    payload.setOpacity(clamp(p * 5, 0, 1) * clamp((1 - p) * 5, 0, 1));
    payload.setPayload(cipherText(18, t, { seed: 2 }), COLOR.cipher);
    // Enters along the same vector the SaaS link used, from outside the frame.
    placeAlong(payload, { x: A.container.x - 26, y: A.container.y + 26 }, A.container, p);
}, { ease: ease.inOutQuad });

tl.add(B5 + 1.6, 1.4, (p) => {
    lockState.container.on = 1;
    lockState.container.p = p;
}, { ease: ease.outCubic });

tl.add(B5 + 2.4, 0.8, (p) => {
    note.setOpacity(p);
    note.setText('The orchestrator schedules ciphertext', 'It never holds a key, so it never holds a secret');
    note.attr('label/fill', COLOR.container);
}, { ease: ease.outCubic });

tl.add(B5 + 2.6, 0.6, (p) => {
    setVerdict('HOLDS  —  orchestration is blind', COLOR.safe);
    verdict.setOpacity(p);
}, { ease: ease.outCubic });

// ===== 13 – 19  Boundary 6: compute unit to its hardware ====================

const B6 = bars(6);    // 15.0 s

tl.add(B6, 0.7, () => {
    setBoundary('06');
    tracker.setOpacity(1);
});

tl.add(B6 + 0.3, 1.4, (p) => {
    lockState.hardware.on = 1;
    lockState.hardware.p = p;
}, { ease: ease.outCubic });

tl.add(B6 + 1.2, 0.8, (p) => {
    note.setOpacity(p);
    note.setText('The hypervisor is outside the boundary', 'Guest memory is encrypted with a key the host never sees');
    note.attr('label/fill', COLOR.vm);
}, { ease: ease.outCubic });

tl.add(B6 + 1.4, 0.6, (p) => {
    setVerdict('HOLDS  —  the host cannot look in', COLOR.safe);
    verdict.setOpacity(p);
}, { ease: ease.outCubic });

// ===== 19 – 25  Boundary 7: compute unit to its accelerator =================

const B7 = bars(9);    // 22.5 s

tl.add(B7, 0.7, () => {
    setBoundary('07');
    tracker.setOpacity(1);
    note.setOpacity(0);
});

tl.add(B7 + 0.3, 4.4, (p, t) => {
    // Ciphertext streaming down the PCIe link, in both directions.
    const cycle = (p * 2.2) % 1;
    wireAccel.setOpacity(1);
    wireAccel.setPayload(hexBlock(12, t, { seed: 5 }), COLOR.accel);
    placeAlong(wireAccel, A.container, A.accel, cycle);

    arch.cells.computeToAccel.hidePackets();
    for (let i = 0; i < 4; i++) {
        const q = (t * 0.5 + i / 4) % 1;
        arch.cells.computeToAccel.packet(i, q, { opacity: 1, fill: COLOR.accel, r: 0.42 });
    }
});

tl.add(B7 + 0.9, 0.8, (p) => {
    note.setOpacity(p);
    note.setText('Even the bus carries ciphertext', 'The card computes on data it cannot decrypt');
    note.attr('label/fill', COLOR.accel);
}, { ease: ease.outCubic });

tl.add(B7 + 1.1, 0.6, (p) => {
    setVerdict('HOLDS  —  the interconnect learns nothing', COLOR.safe);
    verdict.setOpacity(p);
}, { ease: ease.outCubic });

// ===== 25 – 31  Boundary 8: compute unit to its storage =====================

const B8 = bars(12);   // 30.0 s

tl.add(B8, 0.7, () => {
    setBoundary('08');
    tracker.setOpacity(1);
    wireAccel.setOpacity(0);
});

tl.add(B8 + 0.3, 4.4, (p, t) => {
    const cycle = (p * 2.0) % 1;
    wireStore.setOpacity(1);
    wireStore.setPayload(cipherText(16, t, { seed: 7 }), COLOR.storage);
    placeAlong(wireStore, A.container, A.rds, cycle);

    arch.cells.computeToRds.hidePackets();
    for (let i = 0; i < 4; i++) {
        const q = (t * 0.42 + i / 4) % 1;
        arch.cells.computeToRds.packet(i, q, { opacity: 1, fill: COLOR.storage, r: 0.42 });
    }
});

tl.add(B8 + 0.9, 0.8, (p) => {
    note.setOpacity(p);
    note.setText('Storage is a ciphertext store', 'Queries run without the engine seeing a plaintext row');
    note.attr('label/fill', COLOR.storage);
}, { ease: ease.outCubic });

tl.add(B8 + 1.1, 0.6, (p) => {
    setVerdict('HOLDS  —  at rest and in use', COLOR.safe);
    verdict.setOpacity(p);
}, { ease: ease.outCubic });

// ===== 31 – 38  Boundary 9: and so on, all the way down =====================

const B9 = bars(15);   // 37.5 s

tl.add(B9, 0.7, () => {
    setBoundary('09');
    tracker.setOpacity(1);
    wireStore.setOpacity(0);
});

// Pull back out a little so the whole maze is visible at once.
tl.add(B9 + 0.2, 1.8, (p) => {
    stage.setCamera(camera(1 - p * 0.42));
}, { ease: ease.inOutCubic });

// Every channel at once, saturated with ciphertext.
tl.add(B9 + 0.6, 7.4, (p, t) => {
    const links = [arch.cells.computeToAccel, arch.cells.computeToRds];
    links.forEach((link, li) => {
        link.hidePackets();
        for (let i = 0; i < 5; i++) {
            const q = (t * (0.4 + li * 0.08) + i / 5) % 1;
            link.packet(i, q, { opacity: 1, fill: li ? COLOR.storage : COLOR.accel, r: 0.4 });
        }
    });

    // A drifting field of ciphertext over the instance, so "a maze of gibberish
    // on all channels" is something you can actually see rather than infer.
    mazeOpacity(clamp(remap(p, 0, 0.16)) * (1 - clamp(remap(p, 0.86, 1))));
    mazeText(t);
});

tl.add(B9 + 1.0, 0.9, (p) => {
    note.setOpacity(p);
    note.setText('The same property, recursively', 'Every provider in the chain is blind to the layer above it');
    note.attr('label/fill', COLOR.cipher);
}, { ease: ease.outCubic });

tl.add(B9 + 1.2, 0.6, (p) => {
    setVerdict('HOLDS  —  all the way down', COLOR.safe);
    verdict.setOpacity(p);
}, { ease: ease.outCubic });

// ===== 38 – 47  Boundary 10: the claim ======================================

const B10 = bars(19);  // 47.5 s

tl.add(B10, bars(0.5), (p) => {
    // The diagram recedes behind the closing statement, but the statement is
    // itself HUD, so this is the stage scrim rather than the curtain.
    stage.setStageScrim(p * 0.86);
    note.setOpacity(1 - p);
    verdict.setOpacity(1 - p);
    tracker.setOpacity(1 - p);
    tracker.setAllCovered();
    sceneTitle.attr('label/opacity', 1 - p);
    sceneTitle.attr('sub/opacity', 1 - p);
    mazeOpacity((1 - p) * 0.5);
    // The diagram's own labels live on the HUD, so they have to be faded
    // explicitly — the scrim passes underneath them.
    arch.setLabels({ ec2: 1 - p, vm: 1 - p, container: 1 - p, accel: 1 - p, rds: 1 - p });
    lockState.container.on = 1 - p;
    lockState.hardware.on = 1 - p;
}, { ease: ease.inOutQuad });

tl.add(B10 + bars(0.4), bars(0.7), (p) => {
    closer.setOpacity(p).setShift(0, lerp(22, 0, p));
    closer.setText(
        'The cloud provider operates the hypervisor',
        'and still learns nothing about the workload.'
    );
}, { ease: ease.outQuart });

tl.add(B10 + bars(1), bars(0.7), (p) => {
    closerTail.setOpacity(p).setShift(0, lerp(18, 0, p));
    closerTail.setText('And the guest can prove it.', 'Attestation turns the claim into evidence.');
}, { ease: ease.outQuart });

tl.add(B10 + bars(2.5), bars(0.5), (p) => {
    stage.setCurtain(p);
    closer.setOpacity(1 - p);
    closerTail.setOpacity(1 - p);
}, { ease: ease.inOutQuad });

// --- The ciphertext maze ----------------------------------------------------
//
// Plain SVG in the HUD's back layer rather than cells: it is a field of forty
// short strings redrawn every frame, and routing that through the cell graph
// would cost more than it is worth.

let mazeGroup = null;
let mazeNodes = [];
const MAZE_N = 44;

function ensureMaze() {
    if (mazeGroup) return;
    const ns = 'http://www.w3.org/2000/svg';
    mazeGroup = document.createElementNS(ns, 'g');
    mazeGroup.setAttribute('opacity', '0');
    for (let i = 0; i < MAZE_N; i++) {
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('font-family', MONO);
        t.setAttribute('font-size', String(13 + Math.floor(hashRandom(i, 1) * 6)));
        t.setAttribute('fill', [COLOR.cipher, COLOR.accel, COLOR.storage, COLOR.container][i % 4]);
        t.setAttribute('opacity', String(0.28 + hashRandom(i, 2) * 0.5));
        mazeGroup.appendChild(t);
        mazeNodes.push(t);
    }
    stage.hudPaper.getLayerNode('back').appendChild(mazeGroup);
}

function mazeOpacity(o) {
    ensureMaze();
    mazeGroup.setAttribute('opacity', String(clamp(o)));
}

// The left column carries the title, the beat caption, the badge and the
// verdict. Ciphertext drifting through those makes them hard to read, so a
// string entering either block is simply not drawn until it has passed.
const KEEP_CLEAR = [
    { x: 0, y: 0, w: 800, h: 300 },
    { x: 0, y: 900, w: 800, h: 180 }
];

const inAnyClearZone = (x, y) =>
    KEEP_CLEAR.some((z) => x > z.x - 130 && x < z.x + z.w && y > z.y && y < z.y + z.h);

function mazeText(t) {
    ensureMaze();
    for (let i = 0; i < MAZE_N; i++) {
        const node = mazeNodes[i];
        // Each string drifts along its own slow diagonal and wraps, so the
        // field keeps moving without any per-frame state.
        const speed = 14 + hashRandom(i, 3) * 26;
        const x0 = hashRandom(i, 4) * 2100 - 90;
        const y0 = hashRandom(i, 5) * 1080;
        const x = ((x0 + t * speed) % 2200) - 140;
        const y = ((y0 + t * speed * 0.42) % 1180) - 50;
        node.setAttribute('x', x.toFixed(1));
        node.setAttribute('y', y.toFixed(1));
        node.setAttribute('display', inAnyClearZone(x, y) ? 'none' : 'inline');
        node.textContent = cipherText(6 + Math.floor(hashRandom(i, 6) * 9), t, { seed: 40 + i, churnHz: 5 });
    }
}

// --- Reset ------------------------------------------------------------------

function reset() {
    stage.setCamera(CLOUD_WIDE);
    stage.setCurtain(0);
    stage.setStageScrim(0);
    stage.setGridOpacity(0.3);

    arch.setOpacity(arch.cloudCells, 1);
    // The users and the provider are still on stage, off frame to the west.
    // Their state matches scene 2's final frame exactly — including packets,
    // which are stopped on both sides of the cut because a moving dot cannot be
    // phase-matched across it.
    arch.cells.users.forEach((u) => {
        u.desk.setOpacity(1);
        u.screen.setOpacity(1);
    });
    arch.cells.saas.setOpacity(1);
    arch.cells.userLinks.forEach((l) => {
        l.setOpacity(0.9);
        l.hidePackets();
    });
    arch.cells.saasToCloud.setOpacity(0.8);
    arch.cells.saasToCloud.hidePackets();
    arch.cells.computeToAccel.setOpacity(0.85);
    arch.cells.computeToAccel.hidePackets();
    arch.cells.computeToRds.setOpacity(0.85);
    arch.cells.computeToRds.hidePackets();

    arch.hideAllLabels();
    // saas and users included: they are still on frame at the opening pose,
    // and scene 2 hands over with their labels up.
    arch.setLabels({ cloud: 1, vpc: 1, azA: 1, azB: 1, igw: 1, ec2: 1, accel: 1, rds: 1, saas: 1, users: 1 });

    sceneTitle.setOpacity(0).setShift(0, 0);
    sceneTitle.attr({ 'label/opacity': 1, 'sub/opacity': 1 });
    note.setOpacity(0);
    tracker.setOpacity(0).setShift(0, 0);
    verdict.setOpacity(0);
    lockState.container.on = 0;
    lockState.container.p = 0;
    lockState.hardware.on = 0;
    lockState.hardware.p = 0;
    payload.setOpacity(0);
    wireAccel.setOpacity(0);
    wireStore.setOpacity(0);
    closer.setOpacity(0).setShift(0, 0);
    closerTail.setOpacity(0).setShift(0, 0);
    mazeOpacity(0);
}

mountScene({
    name: '03-boundaries-inner',
    fps: 60,
    timeline: tl,
    seek: (t) => {
        reset();
        tl.seek(t);
        // Both of these depend on the camera, so they run after the timeline
        // has settled it for this frame.
        arch.syncLabels();
        applyLock(lockContainer, lockState.container);
        applyLock(lockHardware, lockState.hardware);
    }
});
