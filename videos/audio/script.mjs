// Narration, laid out on the same bar grid the animation is cut to.
//
// `bar` is the absolute bar in the finished video, so a line and the beat it
// describes start together. The grid is 96 BPM / 2.5 s per bar; scene starts
// are at bars 0, 4, 24 and 46.
//
// Writing style: short declaratives that each end pointing at the next one.
// The voice is doing the work of keeping someone watching a two-and-a-half
// minute diagram, so no line should feel like it has finished the thought.

export const BPM = 96;
export const BAR = (60 / BPM) * 4; // 2.5 s

/** Scene boundaries in bars, for reference and for the overrun check. */
export const SCENE_BARS = [
    { name: '01-opening', start: 0, length: 4 },
    { name: '02-boundaries-outer', start: 4, length: 20 },
    { name: '03-boundaries-inner', start: 24, length: 22 },
    { name: '04-what-do-we-call-it', start: 46, length: 15 },
    { name: '05-the-promise', start: 61, length: 22 }
];

export const LINES = [
    // --- Opening -----------------------------------------------------------
    { id: 'open-1', bar: 0.6, text: 'What does fully private data mean?' },
    { id: 'open-2', bar: 2.1, text: 'Nine requirements. Miss one, and you have none.' },

    // --- Requirements 01–04: the half the user can see ----------------------
    { id: 's2-intro', bar: 4.5, text: 'Three users. One provider standing between them and the cloud.' },

    { id: 'r1-a', bar: 6.1, text: 'Requirement one. One user must learn nothing about another.' },
    { id: 'r1-c', bar: 8.3, text: 'One answer comes back carrying the other.' },
    { id: 'r1-d', bar: 9.4, text: 'That is the failure. Everything that follows is about closing it.' },

    { id: 'r2-a', bar: 11.1, text: 'Requirement two. The provider runs your query without ever reading it.' },
    { id: 'r2-c', bar: 13.2, text: 'Someone is listening. There is nothing to hear.' },

    { id: 'r3-a', bar: 15.1, text: 'Requirement three. Now the traffic runs the other way.' },
    { id: 'r3-b', bar: 16.6, text: 'A user leans on the provider, and finds nothing worth taking.' },

    { id: 'r4-a', bar: 18.1, text: 'Requirement four. Now every user tries at once.' },
    { id: 'r4-b', bar: 19.7, text: 'Collusion changes nothing. No quorum of users can open another.' },

    { id: 's2-out', bar: 21.3, text: 'And that is only the half you can see.' },

    // --- Requirements 05–09: the infrastructure -----------------------------
    { id: 's3-intro', bar: 24.6, text: 'The provider has providers of its own.' },

    { id: 'r5-a', bar: 27.1, text: 'Requirement five. The orchestrator schedules work it cannot read.' },
    { id: 'r5-b', bar: 28.8, text: 'It never holds a key. So it never holds a secret.' },

    { id: 'r6-a', bar: 30.1, text: 'Six. The guest does not trust the machine it is running on.' },
    { id: 'r6-b', bar: 31.4, text: 'The hypervisor belongs to someone else. It sees nothing.' },

    { id: 'r7-a', bar: 33.1, text: 'Seven. The wire out to the accelerator is a public road.' },
    { id: 'r7-b', bar: 34.7, text: 'So the card computes on data it cannot decrypt.' },

    { id: 'r8-a', bar: 36.4, text: 'Eight. The database holds rows it will never be able to read.' },

    { id: 'r9-a', bar: 39.1, text: 'Nine. And every service underneath that one.' },
    { id: 'r9-b', bar: 40.5, text: 'The same property, recursively, all the way down.' },

    { id: 's3-close-a', bar: 43.4, text: 'The cloud provider operates the hypervisor, and still learns nothing about the workload.' },
    { id: 's3-close-b', bar: 45.5, text: 'And the guest can prove it.' },

    // --- The name ----------------------------------------------------------
    { id: 's4-a', bar: 46.5, text: 'So what do we call this?' },
    { id: 's4-b', bar: 48.6, text: 'The industry is not short of names for it.' },
    { id: 's4-c', bar: 52.4, text: 'Twenty-one of them, and counting.' },
    { id: 's4-d', bar: 55.4, text: 'But we already had a word for this.' },
    { id: 's4-e', bar: 56.6, text: 'End-to-end encryption.' },

    // --- The close ----------------------------------------------------------
    { id: 'p-1', bar: 61.4, text: 'End-to-end encryption. Right?' },
    { id: 'p-2', bar: 64.4, text: 'Or have we been kidding ourselves this whole time?' },

    { id: 'p-3', bar: 66.6, text: 'True, complete, end-to-end privacy takes special consideration for the bad actors in your threat model.' },
    { id: 'p-4', bar: 69.2, text: 'A rogue employee at your cloud provider.' },
    { id: 'p-5', bar: 70.7, text: 'A classified FISA warrant.' },
    { id: 'p-6', bar: 72.0, text: 'A subpoena, arriving with a national security letter attached.' },
    { id: 'p-7', bar: 74.0, text: 'None of them are stopped by a checkbox.' },

    { id: 'p-8', bar: 76.4, text: 'Rhiannon AI turns this confusing, and sometimes actively misleading, terminology' },
    { id: 'p-9', bar: 78.6, text: 'into one promise, to your customers and to yourself.' },
    { id: 'p-10', bar: 80.0, text: 'That your data actually is completely, end to end, privately encrypted.' }
];

/**
 * The background bed.
 *
 * "Quiet energetic" is a narrow target: it has to carry momentum without
 * competing with a voice that is doing all the actual work, so the prompt asks
 * for pulse and restraint rather than melody, and pins the tempo to the grid
 * the video is cut to.
 */
export const MUSIC_PROMPT = [
    'Quiet, restrained, forward-moving instrumental underscore for a technical',
    'explainer film. Exactly 96 BPM, steady four-four pulse.',
    'A soft muted pulse on the off-beats, warm low synth bass holding long notes,',
    'sparse high plucked arpeggios far back in the mix, gentle analogue tape hiss.',
    'Restless and expectant, quietly urgent, a sense of something being uncovered',
    'step by step. Never loud, never triumphant, no drop, no big drums, no melody',
    'that competes with a speaking voice. Leave a wide gap in the mid range for',
    'narration. Dark, clean, modern, minimal, patient.'
].join(' ');

/** Voice: British, warm and captivating, built for narrative storytelling. */
export const VOICE = {
    id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    model: 'eleven_multilingual_v2',
    settings: {
        // Slightly loose stability plus raised style is what gives the delivery
        // its lean-in quality; fully stable reads flat and newsreaderly.
        stability: 0.42,
        similarity_boost: 0.8,
        style: 0.35,
        use_speaker_boost: true,
        speed: 0.94
    }
};
