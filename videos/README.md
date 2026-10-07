# Videos

Graphical demonstrations of privacy preservation in the current landscape. Every
frame of diagram is rendered by JointJS; animation is applied from JavaScript.

## Packages

| Package | What it is |
| --- | --- |
| `scene-kit` | Shared isometric stage, timeline engine, shape library, HUD, capture harness |
| `01-opening` | Video 1 — the question the rest of the video answers |
| `02-boundaries-outer` | Video 1, Act 2a — the users and their provider, and boundaries 01–04 |
| `03-boundaries-inner` | Video 1, Act 2b — inside the cloud, boundaries 05–09 |
| `04-what-do-we-call-it` | Video 1, Act 3 — the vocabulary, and the answer |
| `05-the-promise` | Video 1, close — the adversaries, and the promise underneath |
| `audio/` | Narration script, ElevenLabs generation, and the mix (not a package) |

`_archive/` holds the retired threat-models scene. It is outside the workspace
glob so it is not installed or rendered, but the work is still there.

One pnpm package per scene, as required. `scene-kit` is a library, not a scene.

Scenes 2 and 3 both build the *whole* `buildArchitecture` graph — users, provider
and cloud together. Neither hides the other's half; the camera simply points at
one end of it. That is what makes the join between them work.

## Joins

Every join is a plain cut and the stitch is a stream copy. Each cut is authored
to be invisible on its own terms:

- **1 → 2** and **3 → 4** meet through black.
- **2 → 3** is a continuing camera move. At the end of scene 2 the camera pans
  east: the users slide off the western edge and the cloud, which has been
  sitting off frame the whole scene, slides in. Scene 3 opens on that same pose
  with the same diagram, so the frames either side of the cut are identical and
  the move simply continues.

Both scenes derive that pose from `focusCloud` in scene-kit rather than
recomputing it, because the two must agree to the pixel. They currently do — the
frames either side of the cut diff to zero. Three things will break that if you
change one scene without the other:

- **Camera pose.** Always go through `focusUsers` / `focusCloud` / `focusInstance`.
- **Persistent scene state.** The ground grid, cell opacities and label
  visibility must match across the cut, not just the camera.
- **Anything moving.** A travelling packet cannot be phase-matched across a cut,
  so scene 2 stops its ambient traffic before the pan and scene 3 fades it back
  in a beat after opening. Both sides of the cut are static.

To check a change, probe the last frame of scene 2 and the first of scene 3 and
diff them:

```bash
ffmpeg -i a.png -i b.png -filter_complex \
  "[0:v][1:v]blend=all_mode=difference,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YMAX:file=-" \
  -f null -
```

## The boundary tracker

The privacy boundary being demonstrated *is* the page title, over a strip of
chips recording which of the nine have been covered. Both scenes read the list
from `scene-kit/src/boundaries.js`, which is what keeps the count continuous:
scene 3 opens with 01–04 already marked.

## The beat grid

Everything is cut to 96 BPM — 0.625 s to the beat, 2.5 s to the bar
(`scene-kit/src/tempo.js`). Scene starts, boundary beats and narration lines all
land on bar lines, so the voice and the picture arrive together and the music has
something to sit under. Sub-beat detail (fades, packet travel, glyph churn) is
left free on purpose; quantising that too makes the motion feel mechanical.

Scenes occupy bars 0–3, 4–23, 24–45, 46–60 and 61–82 — 83 bars, 207.5 s. `SCENE_BARS` in
`audio/script.mjs` mirrors that, and `render-all.mjs` warns if the rendered video
drifts from it, because a drift silently moves every later narration line off its
beat.

## Audio

```bash
pnpm audio          # generate narration + music (cached; only new text costs credits)
pnpm audio:mix      # rebuild soundtrack.m4a alone, to audition without re-rendering
```

`audio/script.mjs` is the single source for the narration: each line carries the
absolute bar it starts on. `generate.mjs` synthesises it, then prints how each
line actually landed and flags any that run into the next one — writing to a beat
grid means a line that is three words too long silently desyncs the ones after
it, so the report is the thing to read after any script edit.

Narration and music are cached by a hash of the request, so re-running is free
unless the text, the voice settings or the music prompt changed.

The mix ducks the bed under the voice with a sidechain compressor keyed off the
narration, rather than holding the music at a fixed low level — that way it comes
back up in the gaps, which is where the picture is doing the talking. Output is
normalised to −16 LUFS.

Requires `ELEVENLABS_API_KEY` in the repo-root `.env`.

## Commands

```bash
pnpm render               # render all five scenes, generate audio, stitch and mux
pnpm dev:02               # open a scene live in the browser
```

Inside a scene package:

```bash
pnpm dev                              # live preview; space pauses, arrows step a frame
pnpm probe 6.5,12.9,20.5              # dump single frames as PNG for inspection
pnpm exec render-scene --out foo.mp4  # render just this scene
```

Output lands in each package's `out/`, and the stitched video in `videos/out/`.

## How a scene works

Each scene exposes a single function of time. `seek(t)` clears state and then
replays the timeline to produce the frame at `t` — it never steps state forward
from the previous frame. Live playback is a `requestAnimationFrame` loop calling
`seek(now - start)`; capture is a Playwright loop calling `seek(frame / fps)`.
Same function, so what you scrub in the browser is what lands in the MP4, and a
re-render is byte-identical.

Two consequences worth knowing before editing a scene:

- **A track that sets something must have a matching line in `reset()`.** If it
  does not, scrubbing backwards leaves residue on screen.
- **Anything derived from the camera is applied after `tl.seek()`**, not inside a
  track. Tracks run in registration order, so a track registered early would
  otherwise compute against a camera that a later track is about to change. That
  is why label positions and the containment overlays are synced in the `seek`
  callback.

## The isometric projection

The diagram is authored as a flat floor plan in world coordinates. The paper's
transformation matrix does the projection, so scene code never thinks in screen
space:

```
world (1, 0)   ->  screen ( s·cos30,  s/2)    east, down-right
world (0, 1)   ->  screen (-s·cos30,  s/2)    south, down-left
world (-1, -1) ->  screen ( 0,       -s  )    straight up
```

That third identity is why height works: a box's top face is its footprint
translated by `(-h, -h)`, and a point sitting `h` above `(x, y)` is just the flat
point `(x - h, y - h)`. Stacking and elevated link endpoints both fall out of it,
with no 3D machinery.

Two papers are stacked. The **stage** carries the isometric matrix and holds the
diagram; the **HUD** is untransformed and holds every piece of text. Text on the
stage would be skewed by the projection and would scale during camera moves, so
labels live on the HUD and are repositioned each frame from projected world
anchors. Both are JointJS papers — nothing else draws.

Strokes on stage geometry use `vector-effect: non-scaling-stroke`. Without it the
matrix scales them, and a 1px edge becomes a 20px slab at diagram zoom; dash
patterns are in screen pixels for the same reason.

## Rendering

`render-scene` starts a Vite dev server, drives the page frame by frame in
headless Chromium, and pipes PNGs into `ffmpeg` at 1920×1080. Papers render
synchronously (`async: false`), so when `seek()` returns the DOM is final and the
next screenshot is guaranteed to be that frame.

`render-all.mjs` then concatenates the five scenes with the concat demuxer — a
stream copy, so the cut points are exactly as rendered and nothing is re-encoded —
generates and mixes the soundtrack, and muxes it onto the video.

Requires `ffmpeg` with libx264 on PATH, and Playwright's Chromium.

## Gotchas worth knowing

- **Ambient tracks must be marked `{ ambient: true }`.** They are given long
  durations to mean "run for the whole scene", and without the flag they extend
  `timeline.duration` and pad the scene with dead frames.
- **`cell.attr({'sel/attr': v})` silently does nothing.** JointJS does not expand
  slash paths used as object keys; use `cell.attr('sel/attr', v)`.
- **Stage strokes need `vector-effect: non-scaling-stroke`.** The isometric
  matrix scales them otherwise, and dash patterns are then in screen pixels.
- **The curtain sits above the HUD; the stage scrim sits below it.** Use the
  scrim to push the diagram back behind text, the curtain to fade the whole
  frame.
