import { IsoBox, IsoPlate, IsoCylinder, FlowLink, lift } from './shapes.js';
import { HudText } from './hud.js';
import { COLOR, FONT, MONO } from './theme.js';

// The cloud architecture from the brief, built once and shared by both infra
// scenes: a multi-AZ VPC with one EC2 instance running a VM and a container,
// an accelerator and an RDS database alongside, three home users outside the
// cloud, and a SaaS provider between them.
//
// Everything is authored in flat world coordinates on a single ground plane.
// A box that sits on top of another is offset by the base's height in both
// axes — that is the (-h, -h) identity from iso.js — so `stackOn` is the only
// bit of stacking arithmetic anywhere in the scenes.

const stackOn = (x, y, baseHeight) => ({ x: x - baseHeight, y: y - baseHeight });

/**
 * The screen rect every camera pose frames content into. Left of it is the HUD
 * text column. Shared by every pose so a camera move is a pan across one
 * consistent stage rather than a jump between differently-framed shots.
 */
export const CAMERA_FRAME = { x: 620, y: 140, width: 1260, height: 810 };

// The three poses, defined here rather than in the scenes because scene 2 ends
// on `focusCloud` and scene 3 opens on it. They must agree to the pixel or the
// cut between the two shows a jump — deriving both from one function is what
// guarantees that.

/** Wide on the users and the provider, with the cloud off frame to the east. */
export const focusUsers = (stage, arch) =>
    stage.fitCamera({
        padding: 60,
        cells: [...arch.cells.users.flatMap((u) => [u.desk, u.screen]), arch.cells.saas],
        frame: CAMERA_FRAME
    });

/** Wide on the cloud, with the users off frame to the west. */
export const focusCloud = (stage, arch) =>
    stage.fitCamera({ padding: 60, cells: arch.cloudCells, frame: CAMERA_FRAME });

/**
 * Close on the instance and the resources beside it.
 *
 * Padding here is small on purpose. The instance group is short relative to the
 * frame, so its fit is height-limited; generous padding drives the zoom *below*
 * the wide shot's and the "push in" ends up pulling out.
 */
export const focusInstance = (stage, arch) =>
    stage.fitCamera({
        padding: 100,
        cells: [arch.cells.ec2, arch.cells.vm, arch.cells.container, arch.cells.accel, arch.cells.rds],
        frame: CAMERA_FRAME
    });

// Heights of the nested compute stack, in world units.
export const H = {
    plate: 0,
    ec2: 1.6,
    vm: 3.2,
    container: 2.4,
    accel: 1.2,
    rds: 4.0,
    saas: 4.2,
    desk: 0.5,
    screen: 2.0,
    igw: 1.6
};

/** Depth order. Larger draws later, i.e. nearer the viewer. */
const Z = {
    cloud: 1,
    vpc: 2,
    az: 3,
    subnet: 4,
    link: 8,
    // The user-facing links sit above the desks and the SaaS block so the
    // dotted connection to the provider stays visible instead of being buried
    // behind the furniture it connects.
    userLink: 23,
    igw: 10,
    ec2: 12,
    vm: 13,
    container: 14,
    accel: 12,
    rds: 12,
    desk: 20,
    screen: 21,
    saas: 22
};

function plate(x, y, w, d, { fill, stroke, dash, opacity = 1, z = Z.subnet }) {
    return new IsoPlate({
        position: { x, y },
        size: { width: w, height: d },
        z,
        attrs: {
            face: {
                fill,
                fillOpacity: opacity,
                stroke,
                strokeWidth: 1.4,
                strokeDasharray: dash ?? 'none'
            }
        }
    });
}

function box(x, y, w, d, h, color, z) {
    return new IsoBox({
        position: { x, y },
        size: { width: w, height: d },
        isoHeight: h,
        baseColor: color,
        z
    });
}

/**
 * Build the whole diagram onto a stage.
 *
 * Returns handles for every cell plus the world anchor points the scenes need
 * to route packets between, and a `syncLabels()` that reprojects every text
 * label for the current camera.
 */
export function buildArchitecture(stage) {
    const cells = {};
    const labels = [];

    // --- Cloud, VPC, availability zones, subnets ---------------------------

    // The five nested regions step up in lightness so the containment reads at
    // a glance: cloud < VPC < AZ < subnet.
    cells.cloud = plate(10, 0, 36, 30, {
        fill: '#0E1626',
        stroke: COLOR.cloudEdge,
        opacity: 1,
        z: Z.cloud
    });

    // Dash lengths are in screen pixels, because every stroke here uses
    // non-scaling-stroke.
    cells.vpc = plate(12, 2, 32, 26, {
        fill: '#12243C',
        stroke: '#3B6EA8',
        dash: '10 7',
        opacity: 1,
        z: Z.vpc
    });

    cells.azA = plate(13.5, 3.5, 16, 23, {
        fill: '#16304F',
        stroke: COLOR.azEdge,
        dash: '6 5',
        opacity: 0.9,
        z: Z.az
    });
    cells.azB = plate(31, 3.5, 12, 23, {
        fill: '#16304F',
        stroke: COLOR.azEdge,
        dash: '6 5',
        opacity: 0.9,
        z: Z.az
    });

    cells.publicA = plate(14.5, 4.5, 14, 5, { fill: '#1B4368', stroke: '#3E86BE', opacity: 0.9 });
    cells.privateA = plate(14.5, 11, 14, 14, { fill: '#152C48', stroke: '#35608E', opacity: 0.9 });
    cells.publicB = plate(32, 4.5, 10, 5, { fill: '#1B4368', stroke: '#3E86BE', opacity: 0.9 });
    cells.privateB = plate(32, 11, 10, 14, { fill: '#152C48', stroke: '#35608E', opacity: 0.9 });

    // Internet gateway on the public edge of the VPC.
    cells.igw = box(18, 5.6, 3.5, 2.6, H.igw, '#4B7BB5', Z.igw);

    // --- Compute stack: EC2 pedestal -> VM -> container --------------------

    const EC2 = { x: 16, y: 13, w: 8, d: 10 };
    cells.ec2 = box(EC2.x, EC2.y, EC2.w, EC2.d, H.ec2, COLOR.compute, Z.ec2);

    const VM = { x: 17.3, y: 14.3, w: 5.4, d: 7.4 };
    const vmPos = stackOn(VM.x, VM.y, H.ec2);
    cells.vm = box(vmPos.x, vmPos.y, VM.w, VM.d, H.vm, COLOR.vm, Z.vm);

    const CON = { x: 18.5, y: 15.7, w: 3, d: 4.6 };
    const conPos = stackOn(CON.x, CON.y, H.ec2 + H.vm);
    cells.container = box(conPos.x, conPos.y, CON.w, CON.d, H.container, COLOR.container, Z.container);

    // --- Accelerator and database ------------------------------------------

    const ACCEL = { x: 25, y: 14, w: 3, d: 6 };
    cells.accel = box(ACCEL.x, ACCEL.y, ACCEL.w, ACCEL.d, H.accel, COLOR.accel, Z.accel);

    const RDS = { x: 34, y: 15, w: 6.5, d: 6.5 };
    cells.rds = new IsoCylinder({
        position: { x: RDS.x, y: RDS.y },
        size: { width: RDS.w, height: RDS.d },
        isoHeight: H.rds,
        baseColor: COLOR.storage,
        z: Z.rds
    });

    // --- Home users, outside the cloud -------------------------------------
    //
    // Placed along the world (1, 1) diagonal, which projects to straight down,
    // so the three of them stack vertically on screen at a constant x.

    // Seats share a constant (x - y), which projects to a constant screen x, so
    // the three of them stack in a vertical column. Stepping (x + y) by 12 sets
    // the spacing between them.
    //
    // The column sits far enough west of the provider that the two together
    // make a roughly 16:9 group — scene 2 frames these cells alone, with no
    // cloud to balance the composition.
    const USER_SEATS = [
        { x: -14, y: 46, name: 'User A' },
        { x: -8, y: 52, name: 'User B' },
        { x: -2, y: 58, name: 'User C' }
    ];

    cells.users = USER_SEATS.map((seat, i) => {
        const desk = box(seat.x, seat.y, 4.2, 3.2, H.desk, '#26364F', Z.desk + i * 2);
        const screenPos = stackOn(seat.x + 0.3, seat.y + 0.2, H.desk);
        const screen = box(screenPos.x, screenPos.y, 3.6, 0.35, H.screen, COLOR.user, Z.screen + i * 2);
        return { desk, screen, seat };
    });

    // --- The SaaS provider, between the users and the cloud ----------------

    // East of the users, but still clear of the cloud plate's western tip so
    // the two never collide if a scene ever shows both at once.
    const SAAS = { x: 9, y: 39, w: 5, d: 5 };
    cells.saas = box(SAAS.x, SAAS.y, SAAS.w, SAAS.d, H.saas, COLOR.saas, Z.saas);
    cells.saas.attr({
        top: { stroke: COLOR.saasEdge, strokeWidth: 1.4 },
        left: { stroke: 'rgba(0,0,0,0.5)' },
        right: { stroke: 'rgba(0,0,0,0.4)' }
    });

    // --- Anchor points for packet routing ----------------------------------
    //
    // Each is a flat world point, already lifted to the height of the feature
    // it belongs to, so links terminate where the geometry actually is.

    const anchors = {
        saas: lift(SAAS.x + SAAS.w / 2, SAAS.y + SAAS.d / 2, H.saas),
        saasFront: lift(SAAS.x + SAAS.w, SAAS.y + SAAS.d, H.saas * 0.6),
        container: lift(CON.x + CON.w / 2, CON.y + CON.d / 2, H.ec2 + H.vm + H.container),
        vm: lift(VM.x + VM.w / 2, VM.y + VM.d / 2, H.ec2 + H.vm),
        ec2: lift(EC2.x + EC2.w / 2, EC2.y + EC2.d / 2, H.ec2),
        ec2West: lift(EC2.x + 1, EC2.y + EC2.d, H.ec2),
        accel: lift(ACCEL.x + ACCEL.w / 2, ACCEL.y + ACCEL.d / 2, H.accel),
        rds: lift(RDS.x + RDS.w / 2, RDS.y + RDS.d / 2, H.rds),
        igw: lift(cells.igw.position().x + 2, cells.igw.position().y + 1.5, H.igw),
        users: cells.users.map((u) => lift(u.seat.x + 2.1, u.seat.y + 0.4, H.desk + H.screen * 0.8))
    };

    // Regions, in world space, that scene 3 draws containment boxes around.
    const regions = {
        container: { x: CON.x, y: CON.y, w: CON.w, d: CON.d, h: H.ec2 + H.vm + H.container, base: H.ec2 + H.vm },
        vm: { x: VM.x, y: VM.y, w: VM.w, d: VM.d, h: H.ec2 + H.vm, base: H.ec2 },
        ec2: { x: EC2.x, y: EC2.y, w: EC2.w, d: EC2.d, h: H.ec2, base: 0 },
        accel: { x: ACCEL.x, y: ACCEL.y, w: ACCEL.w, d: ACCEL.d, h: H.accel, base: 0 },
        rds: { x: RDS.x, y: RDS.y, w: RDS.w, d: RDS.d, h: H.rds, base: 0 }
    };

    // --- Links --------------------------------------------------------------

    const mkLink = (from, to, attrs = {}, z = Z.link) =>
        new FlowLink({ z }).route(from, to).setLine({
            stroke: COLOR.textFaint,
            strokeWidth: 1.6,
            strokeDasharray: '7 6',
            opacity: 0.75,
            ...attrs
        });

    cells.userLinks = anchors.users.map((u) =>
        mkLink(u, anchors.saas, { stroke: '#7C8FAB', strokeWidth: 1.8, opacity: 0.9 }, Z.userLink)
    );
    cells.saasToCloud = mkLink(
        anchors.saas,
        anchors.container,
        { stroke: COLOR.cipher, strokeWidth: 2.2, strokeDasharray: '9 7' },
        Z.userLink
    );
    cells.computeToAccel = mkLink(anchors.container, anchors.accel, {
        stroke: COLOR.accel,
        strokeDasharray: 'none',
        strokeWidth: 2,
        opacity: 0.85
    });
    cells.computeToRds = mkLink(anchors.container, anchors.rds, {
        stroke: COLOR.storage,
        strokeDasharray: 'none',
        strokeWidth: 2,
        opacity: 0.85
    });

    // --- Commit to the stage, back to front --------------------------------

    stage.add([
        cells.cloud,
        cells.vpc,
        cells.azA,
        cells.azB,
        cells.publicA,
        cells.privateA,
        cells.publicB,
        cells.privateB,
        cells.igw,
        cells.ec2,
        cells.vm,
        cells.container,
        cells.accel,
        cells.rds,
        ...cells.users.flatMap((u) => [u.desk, u.screen]),
        cells.saas,
        ...cells.userLinks,
        cells.saasToCloud,
        cells.computeToAccel,
        cells.computeToRds
    ]);

    // --- Labels -------------------------------------------------------------
    //
    // Text lives on the untransformed HUD paper and is repositioned from
    // projected world anchors every frame, so it never skews and stays a
    // constant size through camera moves.

    const label = (world, text, sub, opts = {}) => {
        const cell = new HudText({
            position: { x: 0, y: 0 },
            attrs: {
                label: {
                    fontSize: opts.size ?? 19,
                    fontWeight: opts.weight ?? 600,
                    fill: opts.color ?? COLOR.textDim,
                    fontFamily: opts.mono ? MONO : FONT,
                    letterSpacing: opts.tracking ?? '0',
                    textAnchor: opts.anchor ?? 'middle',
                    text
                },
                sub: {
                    y: 22,
                    fontSize: opts.subSize ?? 15,
                    fill: opts.subColor ?? COLOR.textFaint,
                    fontFamily: opts.mono ? MONO : FONT,
                    textAnchor: opts.anchor ?? 'middle',
                    text: sub ?? ''
                }
            }
        });
        stage.addHud(cell);
        labels.push({ cell, world, dx: opts.dx ?? 0, dy: opts.dy ?? 0 });
        return cell;
    };

    // Region labels hang off deliberately different corners of their plates.
    // A plate's north corner is (xMin, yMin), its west corner (xMin, yMax) and
    // its east corner (xMax, yMin); those project to the top, left and right
    // extremes respectively, which is what keeps these from stacking up.
    const L = {};
    // The four region labels are deliberately hung off four different corners:
    // south, east and the two north corners. The cloud's west corner is the one
    // place they cannot go — that is where traffic from the SaaS provider
    // crosses into the cloud, and a label there sits under every packet.
    L.cloud = label({ x: 46, y: 30, h: 0 }, 'AWS CLOUD', null, {
        size: 18, tracking: '4', color: '#6E93C8', dy: 28
    });
    // Set just inside the eastern edge rather than outside it: the east corner
    // is the rightmost point of the whole diagram, so an outward label is the
    // first thing to run off frame when a scene tightens the framing.
    L.vpc = label({ x: 44, y: 2, h: 0 }, 'VPC  10.0.0.0/16', null, {
        size: 15, tracking: '1', color: '#5D97D4', mono: true, dx: -14, dy: 2, anchor: 'end'
    });
    L.azA = label({ x: 13.5, y: 3.5, h: 0 }, 'us-east-1a', null, {
        size: 14, color: COLOR.azEdge, mono: true, dy: -16
    });
    L.azB = label({ x: 31, y: 3.5, h: 0 }, 'us-east-1b', null, {
        size: 14, color: COLOR.azEdge, mono: true, dy: -16
    });
    L.ec2 = label({ x: EC2.x, y: EC2.y + EC2.d, h: 0 }, 'EC2 instance', null, {
        size: 19, color: COLOR.compute, dx: -12, dy: 14, anchor: 'end'
    });
    L.vm = label({ x: VM.x, y: VM.y + VM.d, h: H.ec2 }, 'Guest VM', null, {
        size: 17, color: COLOR.vm, dx: -12, dy: -4, anchor: 'end'
    });
    // West of the container rather than above it: the top edge is where the
    // containment overlay hangs its padlock and caption in scene 3.
    L.container = label(
        { x: CON.x, y: CON.y + CON.d, h: H.ec2 + H.vm + H.container },
        'Agentic harness', 'container',
        { size: 17, color: COLOR.container, dx: -16, dy: -6, anchor: 'end' }
    );
    L.accel = label({ x: ACCEL.x + ACCEL.w, y: ACCEL.y, h: H.accel }, 'AI accelerator', null, {
        size: 17, color: COLOR.accel, dx: 14, dy: -2, anchor: 'start'
    });
    L.rds = label({ x: RDS.x + RDS.w / 2, y: RDS.y + RDS.d, h: 0 }, 'RDS  Postgres', null, {
        size: 17, color: COLOR.storage, dy: 26
    });
    L.igw = label({ x: 19.75, y: 5.6, h: H.igw }, 'IGW', null, {
        size: 14, color: '#9DC2EC', mono: true, dy: -16
    });
    L.saas = label({ x: SAAS.x + SAAS.w / 2, y: SAAS.y + SAAS.d, h: 0 }, 'SaaS provider', null, {
        size: 21, color: COLOR.text, dy: 24
    });

    // Users are labelled to the west so their names never run into the
    // SaaS block sitting between them and the cloud.
    L.users = cells.users.map((u, i) =>
        label({ x: u.seat.x, y: u.seat.y + 3.2, h: 0 }, USER_SEATS[i].name, null, {
            size: 17, color: COLOR.user, dx: -14, dy: 2, anchor: 'end'
        })
    );

    /** Reproject every label for the stage's current camera. */
    const syncLabels = () => {
        for (const { cell, world, dx, dy } of labels) {
            const p = stage.project(world.x, world.y, world.h ?? 0);
            cell.position(p.x + dx, p.y + dy);
        }
    };

    /** Uniform opacity helper for a set of cells. */
    const setOpacity = (list, o) => {
        for (const c of list) if (c && c.setOpacity) c.setOpacity(o);
    };

    /**
     * Show or hide labels by name. The wide shot cannot carry every label at
     * once — the compute stack alone would stack three of them on one tower —
     * so each scene declares which set it wants at each point in its timeline.
     */
    const setLabels = (spec) => {
        for (const [name, o] of Object.entries(spec)) {
            const target = L[name];
            if (!target) continue;
            if (Array.isArray(target)) target.forEach((c) => c.setOpacity(o));
            else target.setOpacity(o);
        }
    };

    /** Hide every label; scenes then opt individual ones back in. */
    const hideAllLabels = () => {
        for (const { cell } of labels) cell.setOpacity(0);
    };

    return {
        cells,
        anchors,
        regions,
        labels: L,
        allLabels: labels,
        syncLabels,
        setOpacity,
        setLabels,
        hideAllLabels,
        geometry: { EC2, VM, CON, ACCEL, RDS, SAAS, USER_SEATS },
        /** Every cell that makes up the cloud itself, for scene-level fades. */
        cloudCells: [
            cells.cloud, cells.vpc, cells.azA, cells.azB,
            cells.publicA, cells.privateA, cells.publicB, cells.privateB,
            cells.igw, cells.ec2, cells.vm, cells.container, cells.accel, cells.rds
        ],
        userCells: [...cells.users.flatMap((u) => [u.desk, u.screen]), ...cells.userLinks]
    };
}
