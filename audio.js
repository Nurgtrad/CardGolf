/**
 * DECK GOLF - 16-bit Audio Engine v3
 */
const AudioEngine = (() => {
    let ctx = null;
    let mainGain = null;
    let sequenceTimer = null;
    let currentTrack = null;
    let currentStep = 0;
    let isMuted = false;
    let lastVolume = 0.3;

    const N = {
        off: 0,
        C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
        C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
        C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
        C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77
    };

    const trackMenu = { bpm: 110, score: [[N.E4, N.C3, 1], [N.off, N.off, 3], [N.G4, N.off, 3], [N.off, N.C3, 0], [N.B4, N.off, 2], [N.off, N.G2, 3], [N.A4, N.off, 3], [N.G4, N.off, 0], [N.F4, N.A2, 1], [N.off, N.off, 3], [N.A4, N.off, 3], [N.off, N.A2, 0], [N.C5, N.off, 2], [N.off, N.E2, 3], [N.B4, N.off, 3], [N.A4, N.off, 0]] };
    const trackGame = { bpm: 125, score: [[N.C5, N.C2, 1], [N.off, N.C3, 3], [N.Bb4, N.off, 3], [N.G4, N.off, 0], [N.F4, N.F2, 2], [N.G4, N.F3, 3], [N.off, N.off, 3], [N.Eb4, N.off, 0], [N.C4, N.G2, 1], [N.off, N.off, 3], [N.Eb4, N.C3, 3], [N.off, N.off, 1], [N.F4, N.C2, 2], [N.off, N.off, 3], [N.G4, N.G2, 3], [N.off, N.off, 0]] };
    const trackTension = { bpm: 90, score: [[N.off, N.C2, 1], [N.off, N.off, 0], [N.off, N.C2, 0], [N.off, N.off, 0], [N.off, N.off, 0], [N.off, N.off, 0], [N.off, N.off, 0], [N.off, N.off, 0], [N.G4, N.off, 0], [N.off, N.off, 0], [N.off, N.off, 0], [N.off, N.off, 0], [N.off, N.off, 0], [N.off, N.off, 0], [N.off, N.off, 0], [N.off, N.off, 0]] };

    const init = () => {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        mainGain = ctx.createGain();
        mainGain.gain.value = lastVolume;
        mainGain.connect(ctx.destination);
    };

    const playDrum = (type, time) => {
        if (type === 1) { 
            const osc = ctx.createOscillator(); const g = ctx.createGain();
            osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
            g.gain.setValueAtTime(1, time); g.gain.linearRampToValueAtTime(0, time + 0.1);
            osc.connect(g); g.connect(mainGain); osc.start(time); osc.stop(time + 0.1);
        } else if (type === 2 || type === 3) {
            const dur = type === 2 ? 0.1 : 0.03;
            const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource(); noise.buffer = buffer;
            const filter = ctx.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = type === 2 ? 1000 : 5000;
            const g = ctx.createGain();
            g.gain.setValueAtTime(type === 2 ? 0.3 : 0.1, time); g.gain.exponentialRampToValueAtTime(0.01, time + dur);
            noise.connect(filter); filter.connect(g); g.connect(mainGain); noise.start(time); noise.stop(time + dur);
        }
    };

    const playBass = (freq, time, dur) => {
        if (!freq) return;
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0.5, time); g.gain.exponentialRampToValueAtTime(0.01, time + dur);
        osc.connect(g); g.connect(mainGain); osc.start(time); osc.stop(time + dur);
    };

    const playLead = (freq, time, dur) => {
        if (!freq) return;
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'square'; osc.frequency.value = freq;
        g.gain.setValueAtTime(0.15, time); g.gain.setTargetAtTime(0.1, time + dur*0.1); g.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(g); g.connect(mainGain); osc.start(time); osc.stop(time + dur);
    };

    const sequence = () => {
        if (!currentTrack || isMuted) return;
        const now = ctx.currentTime;
        const stepTime = (60 / currentTrack.bpm) / 4;
        const data = currentTrack.score[currentStep % currentTrack.score.length];
        playLead(data[0], now, stepTime * 1.5);
        playBass(data[1], now, stepTime * 0.9);
        playDrum(data[2], now);
        currentStep++;
        sequenceTimer = setTimeout(sequence, stepTime * 1000);
    };

    return {
        playBGM: (trackName) => {
            init(); if (ctx.state === 'suspended') ctx.resume();
            let targetTrack = trackName === 'menu' ? trackMenu : trackName === 'game' ? trackGame : trackTension;
            if (currentTrack === targetTrack) return;
            clearTimeout(sequenceTimer);
            currentTrack = targetTrack; currentStep = 0;
            if (currentTrack) sequence();
        },
        stopBGM: () => { clearTimeout(sequenceTimer); currentTrack = null; },
        playSFX: (type) => {
            if (!ctx || isMuted) return;
            const now = ctx.currentTime; const sfxG = ctx.createGain(); sfxG.connect(ctx.destination);
            sfxG.gain.value = mainGain.gain.value * 1.5;
            if (type === 'hit') {
                const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
                sfxG.gain.setValueAtTime(0.8, now); sfxG.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.connect(sfxG); osc.start(now); osc.stop(now + 0.1);
            } else if (type === 'bounce') {
                const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
                sfxG.gain.setValueAtTime(0.4, now); sfxG.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                osc.connect(sfxG); osc.start(now); osc.stop(now + 0.05);
            } else if (type === 'water') {
                const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
                sfxG.gain.setValueAtTime(0.7, now); sfxG.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.connect(sfxG); osc.start(now); osc.stop(now + 0.15);
            } else if (type === 'sand') {
                const b = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate); const d = b.getChannelData(0);
                for (let i = 0; i < b.length; i++) d[i] = Math.random() * 2 - 1;
                const n = ctx.createBufferSource(); n.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
                sfxG.gain.setValueAtTime(0.6, now); sfxG.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                n.connect(f); f.connect(sfxG); n.start(now); n.stop(now + 0.1);
            } else if (type === 'hole') {
                const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(600, now); osc.frequency.setValueAtTime(800, now + 0.05);
                sfxG.gain.setValueAtTime(0.8, now); sfxG.gain.linearRampToValueAtTime(0, now + 0.15);
                osc.connect(sfxG); osc.start(now); osc.stop(now + 0.15);
            } else if (type === 'holeinone') {
                [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5, N.C6].forEach((f, i) => {
                    const osc = ctx.createOscillator(); const g = ctx.createGain(); osc.frequency.value = f;
                    g.gain.setValueAtTime(0, now + i*0.08); g.gain.linearRampToValueAtTime(0.3, now + i*0.08 + 0.01); g.gain.exponentialRampToValueAtTime(0.01, now + i*0.08 + 0.3);
                    osc.connect(g); g.connect(sfxG); osc.start(now + i*0.08); osc.stop(now + i*0.08 + 0.3);
                });
            }
        },
        setVolume: (v) => { lastVolume = v; if (mainGain) mainGain.gain.setTargetAtTime(isMuted ? 0 : v, ctx.currentTime, 0.05); },
        toggleMute: () => { isMuted = !isMuted; if (mainGain) mainGain.gain.setTargetAtTime(isMuted ? 0 : lastVolume, ctx.currentTime, 0.05); return isMuted; }
    };
})();