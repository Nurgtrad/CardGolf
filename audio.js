/**
 * DECK GOLF - 16-bit Audio Engine vFinal
 */
const AudioEngine = (() => {
    let ctx = null;
    let mainGain = null;
    let sequenceTimer = null;
    let currentTrack = null;
    let currentStep = 0;
    let isMuted = false;
    let lastVolume = 0.3;

    const _ = 0;
    const f = (n) => n === 0 ? 0 : 440 * Math.pow(2, (n - 69) / 12);

    // PATRONES [Lead, Bass, Drum]
    const mA = [[64,48,1], [_,_,3], [67,_,3], [_,_,0], [71,_,2], [_,43,3], [69,_,3], [67,_,0], [65,41,1], [_,_,3], [69,_,3], [_,_,0], [72,_,2], [_,45,3], [71,_,3], [69,_,0]];
    const mB = [[67,48,1], [_,_,3], [71,_,3], [_,_,0], [74,_,2], [_,43,3], [72,_,3], [71,_,0], [69,45,1], [_,_,3], [72,_,3], [_,_,0], [76,_,2], [_,47,3], [74,_,3], [72,_,0]];
    const mC = [[65,41,1], [_,_,3], [69,_,3], [_,_,0], [72,_,2], [_,45,3], [71,_,3], [69,_,0], [67,43,1], [_,_,3], [71,_,3], [_,_,0], [74,_,2], [_,43,3], [72,_,3], [71,_,0]];
    const mD = [[60,36,1], [64,_,3], [67,_,3], [72,_,0], [_,_,2], [71,43,3], [69,_,3], [67,_,0], [65,41,1], [_,_,3], [64,_,3], [62,_,0], [60,_,2], [_,45,3], [59,_,3], [_,_,0]];

    const gA = [[72,36,1], [_,_,3], [70,_,3], [67,48,0], [65,_,2], [67,46,3], [_,_,3], [63,_,0], [60,36,1], [_,_,3], [63,_,3], [_,48,1], [65,_,2], [_,_,3], [67,46,3], [_,_,0]];
    const gB = [[75,41,1], [_,_,3], [72,_,3], [70,53,0], [67,_,2], [70,51,3], [_,_,3], [65,_,0], [63,41,1], [_,_,3], [65,_,3], [_,53,1], [67,_,2], [_,_,3], [72,51,3], [_,_,0]];
    const gC = [[67,43,1], [_,_,3], [67,_,3], [70,43,0], [72,_,2], [_,_,3], [74,_,3], [75,_,0], [74,43,1], [72,_,3], [70,_,3], [67,_,0], [65,_,2], [63,_,3], [60,_,3], [58,_,0]];
    const gD = [[_,36,1], [_,_,3], [_,36,3], [_,_,0], [_,36,2], [_,_,3], [_,36,3], [_,_,0], [_,36,1], [_,36,3], [_,36,3], [_,36,0], [_,36,2], [_,36,3], [_,36,3], [_,36,1]];

    const tA = [[84,36,1], [_,_,0], [85,_,0], [_,_,0], [84,_,1], [_,_,0], [85,_,0], [_,_,0]];

    const trackMenu = { bpm: 110, score: [...mA, ...mB, ...mA, ...mC, ...mA, ...mB, ...mD, ...mC, ...mA, ...mB, ...mA, ...mC, ...mA, ...mB, ...mD, ...mD] };
    const trackGame = { bpm: 125, score: [...gA, ...gA, ...gB, ...gA, ...gC, ...gB, ...gA, ...gD, ...gA, ...gA, ...gB, ...gA, ...gC, ...gC, ...gD, ...gD] };
    const trackTension = { bpm: 130, score: tA }; 

    const init = () => {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        mainGain = ctx.createGain();
        mainGain.gain.value = lastVolume;
        mainGain.connect(ctx.destination);
    };

    // Parche iOS: Desbloquear motor de audio al primer toque
    const unlockAudio = () => {
        init();
        if (ctx.state === 'suspended') ctx.resume();
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        if(source.start) source.start(0); else source.noteOn(0);
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('touchend', unlockAudio);
        document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('touchstart', unlockAudio, {once: true});
    document.addEventListener('touchend', unlockAudio, {once: true});
    document.addEventListener('click', unlockAudio, {once: true});

    const playDrum = (type, time) => {
        if (type === 1) { 
            const osc = ctx.createOscillator(); const g = ctx.createGain();
            osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
            g.gain.setValueAtTime(1, time); g.gain.linearRampToValueAtTime(0, time + 0.1);
            osc.connect(g); g.connect(mainGain); osc.start(time); osc.stop(time + 0.1);
        } else if (type === 2 || type === 3) { 
            const dur = type === 2 ? 0.15 : 0.03;
            const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource(); noise.buffer = buffer;
            const filter = ctx.createBiquadFilter(); filter.type = "highpass"; filter.frequency.value = type === 2 ? 1500 : 6000;
            const g = ctx.createGain();
            g.gain.setValueAtTime(type === 2 ? 0.35 : 0.08, time); g.gain.exponentialRampToValueAtTime(0.01, time + dur);
            noise.connect(filter); filter.connect(g); g.connect(mainGain); noise.start(time); noise.stop(time + dur);
        }
    };

    const playBass = (freq, time, dur) => {
        if (!freq) return;
        const osc = ctx.createOscillator(); const filter = ctx.createBiquadFilter(); const g = ctx.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = freq;
        filter.type = 'lowpass'; filter.frequency.setValueAtTime(freq * 4, time); filter.frequency.exponentialRampToValueAtTime(freq, time + dur * 0.5);
        g.gain.setValueAtTime(0.4, time); g.gain.exponentialRampToValueAtTime(0.01, time + dur);
        osc.connect(filter); filter.connect(g); g.connect(mainGain); osc.start(time); osc.stop(time + dur);
    };

    const playLead = (freq, time, dur) => {
        if (!freq) return;
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = 'square'; osc.frequency.value = freq;
        const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
        lfo.frequency.value = 5; lfoGain.gain.value = 4;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        lfo.start(time); lfo.stop(time + dur);
        g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(0.12, time + 0.02); g.gain.setTargetAtTime(0.08, time + 0.05, 0.1); g.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(g); g.connect(mainGain); osc.start(time); osc.stop(time + dur);
    };

    const sequence = () => {
        if (!currentTrack || isMuted) return;
        const now = ctx.currentTime;
        const stepTime = (60 / currentTrack.bpm) / 4;
        const data = currentTrack.score[currentStep % currentTrack.score.length];
        
        const isTension = currentTrack === trackTension;
        playLead(f(data[0]), now, isTension ? stepTime * 0.3 : stepTime * 1.5);
        playBass(f(data[1]), now, stepTime * 0.9);
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
            
            const detune = (Math.random() - 0.5) * 60; // Humanización
            
            if (type === 'hit') {
                const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(800 + detune, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
                sfxG.gain.setValueAtTime(0.8, now); sfxG.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.connect(sfxG); osc.start(now); osc.stop(now + 0.1);
            } else if (type === 'bounce') {
                const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(300 + detune, now); osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
                sfxG.gain.setValueAtTime(0.4, now); sfxG.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                osc.connect(sfxG); osc.start(now); osc.stop(now + 0.05);
            } else if (type === 'water') {
                const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(300 + detune, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
                sfxG.gain.setValueAtTime(0.7, now); sfxG.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc.connect(sfxG); osc.start(now); osc.stop(now + 0.15);
            } else if (type === 'sand') {
                const b = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate); const d = b.getChannelData(0);
                for (let i = 0; i < b.length; i++) d[i] = Math.random() * 2 - 1;
                const n = ctx.createBufferSource(); n.buffer = b; const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 600 + detune;
                sfxG.gain.setValueAtTime(0.6, now); sfxG.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                n.connect(flt); flt.connect(sfxG); n.start(now); n.stop(now + 0.1);
            } else if (type === 'hole') {
                const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(600, now); osc.frequency.setValueAtTime(800, now + 0.05);
                sfxG.gain.setValueAtTime(0.8, now); sfxG.gain.linearRampToValueAtTime(0, now + 0.15);
                osc.connect(sfxG); osc.start(now); osc.stop(now + 0.15);
            } else if (type === 'holeinone') {
                [60, 64, 67, 72, 76, 79, 84].forEach((f_midi, i) => { 
                    const osc = ctx.createOscillator(); const g = ctx.createGain(); osc.frequency.value = f(f_midi);
                    g.gain.setValueAtTime(0, now + i*0.08); g.gain.linearRampToValueAtTime(0.3, now + i*0.08 + 0.01); g.gain.exponentialRampToValueAtTime(0.01, now + i*0.08 + 0.3);
                    osc.connect(g); g.connect(sfxG); osc.start(now + i*0.08); osc.stop(now + i*0.08 + 0.3);
                });
            }
        },
        setVolume: (v) => { lastVolume = v; if (mainGain) mainGain.gain.setTargetAtTime(isMuted ? 0 : v, ctx.currentTime, 0.05); },
        toggleMute: () => { isMuted = !isMuted; if (mainGain) mainGain.gain.setTargetAtTime(isMuted ? 0 : lastVolume, ctx.currentTime, 0.05); return isMuted; }
    };
})();