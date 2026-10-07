// Shared visual language for every scene in the privacy-preservation series.
// Keep all colour and type decisions here so the three scenes cut together cleanly.

export const CANVAS = { width: 1920, height: 1080 };

export const FONT = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const MONO = '"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

export const COLOR = {
    // Ground
    bg: '#080D18',
    bgDeep: '#05080F',
    grid: '#14203A',
    gridStrong: '#1D2D4D',

    // Type
    text: '#E8EEF9',
    textDim: '#8FA3C0',
    textFaint: '#4F6280',

    // Cloud / infrastructure
    cloud: '#101B2E',
    cloudEdge: '#2B4066',
    vpc: '#122740',
    az: '#0F1E33',
    azEdge: '#2F5F8F',

    // Services (roughly AWS-flavoured, tuned for a dark stage)
    compute: '#F0932B',
    computeDim: '#8A5416',
    vm: '#8B5CF6',
    vmDim: '#4A2F86',
    container: '#22D3EE',
    containerDim: '#12707E',
    storage: '#3B82F6',
    storageDim: '#1E4585',
    accel: '#34D399',
    accelDim: '#1A7355',

    // Actors
    user: '#CBD5E1',
    userDim: '#64748B',
    saas: '#334155',
    saasEdge: '#64748B',
    hacker: '#F43F5E',

    // Semantics
    danger: '#F43F5E',
    safe: '#34D399',
    cipher: '#A78BFA',
    plain: '#FBBF24',
    lock: '#FCD34D'
};

// Face shading multipliers for the three visible faces of an isometric box.
export const FACE = { top: 1.0, left: 0.62, right: 0.8 };

// One world unit is one grid cell before projection.
export const GRID = 20;
