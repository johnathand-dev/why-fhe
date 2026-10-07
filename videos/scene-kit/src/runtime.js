import { CANVAS } from './theme.js';

/**
 * The contract between a scene and the outside world.
 *
 * A scene calls `mountScene({ timeline, seek, ... })`. That does two things:
 *
 *  1. Starts a requestAnimationFrame loop for live viewing, driven by wall
 *     clock but only ever *reading* it — every frame is produced by calling
 *     `seek(t)`, never by stepping state forward.
 *  2. Publishes `window.__scene`, which the capture harness drives frame by
 *     frame. Because the same `seek` produces both, the MP4 matches the
 *     browser exactly.
 *
 * A scene's seek function must be total: given any t in [0, duration] it sets
 * every animated property, including resetting things that are not yet
 * visible. Anything left untouched leaks state across a scrub.
 */
export function mountScene({ timeline, seek, fps = 60, name = 'scene', autoplay = true, loop = true }) {
    const duration = timeline ? timeline.duration : seek.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error(`Scene "${name}" has no positive duration`);
    }

    // `seek` wins when both are given: a scene that needs to clear state before
    // each frame passes its own function and drives the timeline from inside it.
    // `timeline` is then only consulted for the duration.
    const paint =
        typeof seek === 'function' ? seek : (t) => timeline.seek(t);

    const render = (t) => {
        paint(Math.max(0, Math.min(duration, t)));
    };

    // Draw the first frame immediately so a paused page is never blank.
    render(0);

    const state = { playing: autoplay, t: 0, origin: 0 };

    const tick = (now) => {
        if (state.playing) {
            if (!state.origin) state.origin = now;
            let t = (now - state.origin) / 1000;
            if (t > duration) {
                if (loop) {
                    state.origin = now;
                    t = 0;
                } else {
                    t = duration;
                    state.playing = false;
                }
            }
            state.t = t;
            render(t);
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Space toggles playback, arrows step a frame, useful while iterating.
    window.addEventListener('keydown', (e) => {
        const frame = 1 / fps;
        if (e.code === 'Space') {
            e.preventDefault();
            state.playing = !state.playing;
            state.origin = performance.now() - state.t * 1000;
        } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
            e.preventDefault();
            state.playing = false;
            state.t = Math.max(0, Math.min(duration, state.t + (e.code === 'ArrowRight' ? frame : -frame)));
            render(state.t);
        } else if (e.code === 'Home') {
            e.preventDefault();
            state.t = 0;
            state.origin = performance.now();
            render(0);
        }
    });

    window.__scene = {
        name,
        fps,
        duration,
        width: CANVAS.width,
        height: CANVAS.height,
        /** Render exactly the frame at absolute time `t` (seconds). */
        seek(t) {
            state.playing = false;
            state.t = t;
            render(t);
        },
        /** Render frame index `i` at the scene's frame rate. */
        seekFrame(i) {
            this.seek(i / fps);
        },
        frameCount() {
            return Math.round(duration * fps);
        }
    };

    // The capture harness waits on this flag rather than a fixed timeout.
    window.__sceneReady = true;
    document.documentElement.setAttribute('data-scene-ready', '1');

    return window.__scene;
}

/** Scale the 1920x1080 stage to fit the browser window during live viewing. */
export function fitToWindow(el, { width = CANVAS.width, height = CANVAS.height } = {}) {
    const apply = () => {
        // In capture the viewport is exactly the canvas size, so the scale is
        // 1 and no transform is introduced to blur the output.
        const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
        el.style.transformOrigin = 'top left';
        el.style.transform = scale === 1 ? 'none' : `scale(${scale})`;
        el.style.position = 'absolute';
        el.style.left = `${Math.max(0, (window.innerWidth - width * scale) / 2)}px`;
        el.style.top = `${Math.max(0, (window.innerHeight - height * scale) / 2)}px`;
    };
    apply();
    window.addEventListener('resize', apply);
    return apply;
}
