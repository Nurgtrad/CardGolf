const $ = id => document.getElementById(id);

// ─── DATA ────────────────────────────────────────────────────────────────────
const CARDS_POOL = [
  {id:'d', name:'Driver', dist:240, icon:'🏌', type:'club'},
  {id:'3w', name:'3 Wood', dist:215, icon:'🌲', type:'club'},
  {id:'5w', name:'5 Wood', dist:200, icon:'🌲', type:'club'},
  {name:'3 Iron', dist:190, icon:'⛳', type:'club'},
  {name:'4 Iron', dist:180, icon:'⛳', type:'club'},
  {name:'5 Iron', dist:170, icon:'⛳', type:'club'},
  {name:'6 Iron', dist:160, icon:'⛳', type:'club'},
  {name:'7 Iron', dist:150, icon:'⛳', type:'club'},
  {name:'8 Iron', dist:140, icon:'⛳', type:'club'},
  {name:'9 Iron', dist:130, icon:'⛳', type:'club'},
  {name:'Pitch W', dist:110, icon:'🎯', type:'club'},
  {name:'Gap W', dist:95,  icon:'🎯', type:'club'},
  {name:'Sand W', dist:80,  icon:'⏳', type:'club'},
  {name:'Lob W', dist:60,  icon:'📐', type:'club'},
  
  {id:'scope', name:'Scope', icon:'🔭', effect:'guide', desc:'Visualiza trayectoria de tiro', type:'ball'},
  {name:'Control', icon:'🎱', effect:'control', desc:'-60% desvío', type:'ball'},
  {name:'Power', icon:'💥', effect:'power', desc:'+20% dist.', type:'ball'},
  {name:'Backspin', icon:'↩', effect:'Backspin', desc:'Retroceso', type:'ball'},
  {name:'Fallstop', icon:'📍', effect:'fallstop', desc:'0 rodadura', type:'ball'},
  {name:'Heavy', icon:'🪨', effect:'heavy', desc:'Ignora viento', type:'ball'},
];
CARDS_POOL.forEach((c,i) => c.baseId = c.id || `c${i}`);

const PUTTER_CARD = {baseId:'putt', name:'Putt', dist:30, icon:'🕳', type:'club', isPutt:true};
const HOLE_PARS = [4,4,3,5,4,3,4,5,4, 4,3,4,4,5,4,3,5,4];

// ─── STATE ───────────────────────────────────────────────────────────────────
let state = {
  collection: [], deckConfig: {}, drawPile: [], discardPile: [], hand: [],
  hole: 0, totalScore: 0, scores: [], holeData: null,
  ball: {x:0, y:0}, target: {x:0, y:0}, prevPos: {x:0, y:0}, currentTerrain: 'tee',
  strokes: 0, phase: 'card_select', selectedClub: null, selectedBall: null, itemLocked: false,
  wind: {speed:0, dir:0}, powerVal: 0, powerDir: 1, powerHeld: false, aimVal: 0.5, aimDir: 1,
  ballAnim: null, cachedPattern: null, paths: {}
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
function cloneCard(c) { return {...c, uid: Math.random().toString(36).substr(2, 9)}; }
function shuffle(array) {
  for(let i=array.length-1; i>0; i--){
    const j=Math.floor(Math.random()*(i+1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ─── TOAST NOTIFICATIONS ─────────────────────────────────────────────────────
function showToast(text) {
  const t = document.createElement('div');
  t.textContent = text;
  t.style.cssText = 'position:absolute;top:25%;left:50%;transform:translate(-50%,-50%);background:var(--accent2);color:#000;padding:12px 24px;border-radius:30px;font-family:"DM Mono",monospace;font-size:12px;text-transform:uppercase;font-weight:bold;z-index:100;box-shadow:0 10px 20px rgba(0,0,0,0.5);pointer-events:none;animation:toastFade 2s forwards;text-align:center;';
  $('game').appendChild(t);
  setTimeout(()=>t.remove(), 2000);
}

function autoSelectBestClub() {
  let bestClub = null;
  let minDiff = Infinity;
  state.hand.forEach(c => {
    if(c.type === 'club') {
      if(state.currentTerrain === 'green') {
        if(c.isPutt) bestClub = c;
      } else if (!c.isPutt) {
         let diff = Math.abs(c.dist - state.distToHole);
         if (diff < minDiff) { minDiff = diff; bestClub = c; }
      }
    }
  });
  if (bestClub) {
      state.selectedClub = bestClub.uid;
      state.selectedBall = null; 
      renderCards(); updateShootBtnUI(); updateReachDisplay(); drawUI();
  }
}

// ─── CANVAS & INPUT ──────────────────────────────────────────────────────────
const cCourse = $('c-course'), cBall = $('c-ball'), cUI = $('c-ui');
const ctxC = cCourse.getContext('2d'), ctxB = cBall.getContext('2d'), ctxU = cUI.getContext('2d');

function resizeCanvases() {
  const wrap = $('canvas-wrap');
  [cCourse, cBall, cUI].forEach(c => { c.width = wrap.clientWidth; c.height = wrap.clientHeight; });
  if(state.holeData) { drawCourse(); drawBall(); drawUI(); }
}
window.addEventListener('resize', resizeCanvases);

function updateAimTarget(e) {
  if (state.phase !== 'card_select') return;
  e.preventDefault();
  const rect = cUI.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  state.target = { x: clientX - rect.left, y: clientY - rect.top };
  drawUI();
}
cUI.addEventListener('touchstart', updateAimTarget, {passive: false});
cUI.addEventListener('touchmove', updateAimTarget, {passive: false});
cUI.addEventListener('mousedown', updateAimTarget);
cUI.addEventListener('mousemove', (e) => { if(e.buttons > 0) updateAimTarget(e); });

// ─── PROCEDURAL COURSE ─────────────────────────────
function generateHole(holeIndex) {
  const W = cCourse.width, H = cCourse.height, par = HOLE_PARS[holeIndex];
  const logicalDist = par === 3 ? 150+Math.random()*30 : par === 4 ? 330+Math.random()*70 : 490+Math.random()*60;
  const difficulty = holeIndex / 17;
  
  const isMobile = W <= 600;
  const teeY = isMobile ? H - 230 : H * 0.8; 
  const visualLengthPx = isMobile ? teeY * 0.8 : H * 0.60;
  const scale = visualLengthPx / logicalDist;
  
  const teeX = W/2;
  const holeX = W/2 + (Math.random()-0.5)*W*(0.2 + difficulty*0.4);
  const holeY = teeY - visualLengthPx;
  
  const dev1 = (Math.random()-0.5) * W * (0.3 + difficulty * 0.5);
  const dev2 = (Math.random()-0.5) * W * (0.3 + difficulty * 0.5);
  const cp1x = W/2 + dev1, cp1y = teeY - visualLengthPx*(0.2 + Math.random()*0.2);
  const cp2x = holeX + dev2, cp2y = teeY - visualLengthPx*(0.5 + Math.random()*0.3);
  
  const fairwayW = Math.max(45, 90 - difficulty*35) + Math.random()*20;
  
  const fNoise = {
     l1: Math.random()*Math.PI*2, l2: Math.random()*Math.PI*2, r1: Math.random()*Math.PI*2, r2: Math.random()*Math.PI*2,
     srL1: Math.random()*Math.PI*2, srL2: Math.random()*Math.PI*2, srR1: Math.random()*Math.PI*2, srR2: Math.random()*Math.PI*2
  };
  
  const isSplitHole = par >= 4 && (Math.random() < 0.2 + difficulty * 0.3);
  let gapStartT = 0.45 + Math.random()*0.1, gapEndT = gapStartT + 0.12 + Math.random()*0.08;

  let sandTraps = [];
  const numSand = (par===3?1:2) + Math.floor(difficulty*4);
  for(let i=0;i<numSand;i++) {
    const t = 0.15 + Math.random()*0.8;
    if (isSplitHole && t >= gapStartT && t <= gapEndT) continue;
    const bx = bezierPoint(teeX, cp1x, cp2x, holeX, t), by = bezierPoint(teeY, cp1y, cp2y, holeY, t);
    sandTraps.push({
      cx: bx + (Math.random()-0.5)*(fairwayW + 40), cy: by + (Math.random()-0.5)*20,
      rx: 15+Math.random()*15, ry: 10+Math.random()*10, angle: Math.random()*Math.PI
    });
  }

  let rivers = [], lakes = [];
  const numRivers = Math.floor(difficulty * 2.5);
  for(let i=0; i<numRivers; i++) {
     let rt = 0.3 + Math.random() * 0.5;
     let rw = 15 + Math.random() * 20;
     let rcy = bezierPoint(teeY, cp1y, cp2y, holeY, rt);
     rivers.push({ y: rcy, width: rw, phase: Math.random()*Math.PI*2, angle: (Math.random()-0.5)*0.5 });
  }
  const numLakes = Math.floor(difficulty * 3);
  for(let i=0; i<numLakes; i++) {
    const t = 0.2 + Math.random()*0.6;
    const bx = bezierPoint(teeX, cp1x, cp2x, holeX, t), by = bezierPoint(teeY, cp1y, cp2y, holeY, t);
    const offset = (Math.random()>0.5?1:-1) * (fairwayW*0.6 + 10 + Math.random()*30);
    lakes.push({
      cx: bx + offset, cy: by + (Math.random()-0.5)*20,
      rx: 20+Math.random()*25, ry: 15+Math.random()*15, angle: Math.random()*Math.PI
    });
  }
  
  const greenR = Math.max(30, 50 - difficulty*15);

  let trees = [];
  const numTrees = Math.floor(60 + difficulty*60); 
  for(let i=0;i<numTrees;i++) {
      let tx, ty, valid = false, attempts = 0;
      while(!valid && attempts < 15) {
          attempts++;
          if (trees.length > 0 && Math.random() < 0.75) { 
              const sibling = trees[Math.floor(Math.random()*trees.length)];
              tx = sibling.x + (Math.random()-0.5)*35; ty = sibling.y + (Math.random()-0.5)*35;
          } else { tx = Math.random()*W; ty = Math.random()*H; }
          
          if (Math.hypot(tx - teeX, ty - teeY) < 40 || Math.hypot(tx - holeX, ty - holeY) < greenR + 20) continue;
          let minD = Infinity;
          for(let t=0; t<=1; t+=0.05) {
              const bx = bezierPoint(teeX, cp1x, cp2x, holeX, t), by = bezierPoint(teeY, cp1y, cp2y, holeY, t);
              minD = Math.min(minD, Math.hypot(tx-bx, ty-by));
          }
          if (Math.random() < 0.03 || minD > fairwayW/2 + 5) valid = true;
      }
      if(valid) trees.push({x: tx, y: ty, r: 8 + Math.random()*12});
  }
  trees.sort((a,b) => a.y - b.y);

  return { par, holeLength: logicalDist, scale, difficulty, teeX, teeY, holeX, holeY, cp1x, cp1y, cp2x, cp2y, fairwayW, sandTraps, rivers, lakes, trees, greenR, fNoise, isSplitHole, gapStartT, gapEndT, obFlanks: { left: [], right: [] } };
}

function bezierPoint(p0,p1,p2,p3,t) { return (1-t)**3*p0 + 3*(1-t)**2*t*p1 + 3*(1-t)*t**2*p2 + t**3*p3; }
function bezierTangent(p0,p1,p2,p3,t) { return 3*(1-t)**2*(p1-p0) + 6*(1-t)*t*(p2-p1) + 3*t**2*(p3-p2); }

function createTerrainPaths(hd) {
    const paths = { fairway: new Path2D(), semirough: new Path2D(), rough: new Path2D(), ob: new Path2D() };
    let segments = [];
    if (hd.isSplitHole) { segments.push([0, hd.gapStartT]); segments.push([hd.gapEndT, 1.0]); }
    else { segments.push([0, 1.0]); }

    hd.obFlanks = { left: [], right: [] }; 

    for (let seg of segments) {
        const tStart = seg[0], tEnd = seg[1];
        const steps = Math.ceil((tEnd - tStart) / 0.02);
        const pts = { fairway: {l:[], r:[]}, semirough: {l:[], r:[]}, rough: {l:[], r:[]}, ob: {l:[], r:[]} };

        for(let i=0; i<=steps; i++) {
            const tt = tStart + (i/steps) * (tEnd - tStart);
            const bx = bezierPoint(hd.teeX, hd.cp1x, hd.cp2x, hd.holeX, tt);
            const by = bezierPoint(hd.teeY, hd.cp1y, hd.cp2y, hd.holeY, tt);
            const dx = bezierTangent(hd.teeX, hd.cp1x, hd.cp2x, hd.holeX, tt);
            const dy = bezierTangent(hd.teeY, hd.cp1y, hd.cp2y, hd.holeY, tt);
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy/len, ny = dx/len;

            const env = Math.sin((i/steps) * Math.PI);
            const noiseL = (Math.sin(tt * Math.PI * 5 + hd.fNoise.l1) * 0.25 + Math.sin(tt * Math.PI * 9 + hd.fNoise.l2) * 0.15) * env;
            const noiseR = (Math.sin(tt * Math.PI * 4 + hd.fNoise.r1) * 0.25 + Math.sin(tt * Math.PI * 11 + hd.fNoise.r2) * 0.15) * env;
            const widthProgress = 0.6 + tt * 0.4;

            const fwL = (hd.fairwayW/2) * (1 + noiseL) * widthProgress;
            const fwR = (hd.fairwayW/2) * (1 + noiseR) * widthProgress;

            const srNoiseL = (Math.sin(tt * Math.PI * 6 + hd.fNoise.srL1) * 0.2 + Math.sin(tt * Math.PI * 13 + hd.fNoise.srL2) * 0.1) * env;
            const srNoiseR = (Math.sin(tt * Math.PI * 5 + hd.fNoise.srR1) * 0.2 + Math.sin(tt * Math.PI * 15 + hd.fNoise.srR2) * 0.1) * env;
            const srW_L = 10 + Math.max(5, (hd.fairwayW * 0.3) * (1 + srNoiseL));
            const srW_R = 10 + Math.max(5, (hd.fairwayW * 0.3) * (1 + srNoiseR));

            const obNoiseL = (Math.sin(tt * Math.PI * 3 + hd.fNoise.l1) * 40 * env) + 70;
            const obNoiseR = (Math.sin(tt * Math.PI * 2 + hd.fNoise.r2) * 40 * env) + 70;

            pts.fairway.l.push({x: bx + nx*fwL, y: by + ny*fwL});
            pts.fairway.r.push({x: bx - nx*fwR, y: by - ny*fwR});

            pts.semirough.l.push({x: bx + nx*(fwL + srW_L), y: by + ny*(fwL + srW_L)});
            pts.semirough.r.push({x: bx - nx*(fwR + srW_R), y: by - ny*(fwR + srW_R)});

            pts.rough.l.push({x: bx + nx*(fwL + srW_L + 16), y: by + ny*(fwL + srW_L + 16)});
            pts.rough.r.push({x: bx - nx*(fwR + srW_R + 16), y: by - ny*(fwR + srW_R + 16)});

            pts.ob.l.push({x: bx + nx*(fwL + srW_L + obNoiseL), y: by + ny*(fwL + srW_L + obNoiseL)});
            pts.ob.r.push({x: bx - nx*(fwR + srW_R + obNoiseR), y: by - ny*(fwR + srW_R + obNoiseR)});

            if (segments.length === 1 || (segments.length === 2 && seg === segments[0])) {
                 hd.obFlanks.left.push({x: bx + nx*(fwL + srW_L + obNoiseL), y: by + ny*(fwL + srW_L + obNoiseL)});
                 hd.obFlanks.right.push({x: bx - nx*(fwR + srW_R + obNoiseR), y: by - ny*(fwR + srW_R + obNoiseR)});
            } else if (seg === segments[1]) {
                 hd.obFlanks.left.push({x: bx + nx*(fwL + srW_L + obNoiseL), y: by + ny*(fwL + srW_L + obNoiseL)});
                 hd.obFlanks.right.push({x: bx - nx*(fwR + srW_R + obNoiseR), y: by - ny*(fwR + srW_R + obNoiseR)});
            }
        }

        ['fairway', 'semirough', 'rough', 'ob'].forEach(type => {
            const poly = pts[type];
            paths[type].moveTo(poly.r[0].x, poly.r[0].y);
            for(let i=1; i<poly.r.length; i++) paths[type].lineTo(poly.r[i].x, poly.r[i].y);

            const bxEnd = bezierPoint(hd.teeX, hd.cp1x, hd.cp2x, hd.holeX, tEnd);
            const byEnd = bezierPoint(hd.teeY, hd.cp1y, hd.cp2y, hd.holeY, tEnd);
            const dxEnd = bezierTangent(hd.teeX, hd.cp1x, hd.cp2x, hd.holeX, tEnd);
            const dyEnd = bezierTangent(hd.teeY, hd.cp1y, hd.cp2y, hd.holeY, tEnd);
            const angEnd = Math.atan2(dyEnd, dxEnd);
            const wEnd = Math.hypot(poly.l[poly.l.length-1].x - bxEnd, poly.l[poly.l.length-1].y - byEnd);
            paths[type].arc(bxEnd, byEnd, wEnd, angEnd + Math.PI/2, angEnd - Math.PI/2, true);

            for(let i=poly.l.length-1; i>=0; i--) paths[type].lineTo(poly.l[i].x, poly.l[i].y);

            const bxStart = bezierPoint(hd.teeX, hd.cp1x, hd.cp2x, hd.holeX, tStart);
            const byStart = bezierPoint(hd.teeY, hd.cp1y, hd.cp2y, hd.holeY, tStart);
            const dxStart = bezierTangent(hd.teeX, hd.cp1x, hd.cp2x, hd.holeX, tStart);
            const dyStart = bezierTangent(hd.teeY, hd.cp1y, hd.cp2y, hd.holeY, tStart);
            const angStart = Math.atan2(dyStart, dxStart);
            const wStart = Math.hypot(poly.l[0].x - bxStart, poly.l[0].y - byStart);
            paths[type].arc(bxStart, byStart, wStart, angStart - Math.PI/2, angStart + Math.PI/2, true);
            paths[type].closePath();
        });
    }
    return paths;
}

function getTerrain(x, y) {
  try {
    const hd = state.holeData;
    if(!hd) return 'fairway';
    
    for (let r of hd.rivers) {
       let wave = Math.sin(x/50 + r.phase) * 10, center_y = r.y + (x - cCourse.width/2) * r.angle + wave;
       if (Math.abs(y - center_y) <= r.width/2) return 'agua';
    }
    for (let l of hd.lakes) {
      const nx = x - l.cx, ny = y - l.cy;
      const rdx = nx * Math.cos(-l.angle) - ny * Math.sin(-l.angle), rdy = nx * Math.sin(-l.angle) + ny * Math.cos(-l.angle);
      if ((rdx*rdx)/(l.rx*l.rx) + (rdy*rdy)/(l.ry*l.ry) <= 1) return 'agua';
    }
    if (Math.hypot(x - hd.holeX, y - hd.holeY) <= hd.greenR + 6) return 'green';
    for(let s of hd.sandTraps) {
      const nx = x - s.cx, ny = y - s.cy;
      const rdx = nx * Math.cos(-s.angle) - ny * Math.sin(-s.angle), rdy = nx * Math.sin(-s.angle) + ny * Math.cos(-s.angle);
      if ((rdx*rdx)/(s.rx*s.rx) + (rdy*rdy)/(s.ry*s.ry) <= 1) return 'bunker';
    }
    
    if (state.paths.fairway && ctxC.isPointInPath(state.paths.fairway, x, y)) return 'fairway';
    if (state.paths.semirough && ctxC.isPointInPath(state.paths.semirough, x, y)) return 'semirough';
    if (state.paths.rough && ctxC.isPointInPath(state.paths.rough, x, y)) return 'rough';
    if (state.paths.ob && ctxC.isPointInPath(state.paths.ob, x, y)) return 'deeprough';
    return 'ob';
  } catch(e) { return 'fairway'; }
}

function getFairwayPattern(ctx) {
  if(state.cachedPattern) return state.cachedPattern;
  try {
    const pCanvas = document.createElement('canvas'); pCanvas.width = 40; pCanvas.height = 40;
    const pCtx = pCanvas.getContext('2d');
    pCtx.fillStyle = '#315424'; pCtx.fillRect(0,0,40,40); pCtx.fillStyle = '#2b4d1f';
    pCtx.beginPath(); pCtx.moveTo(-1, 41); pCtx.lineTo(41, -1); pCtx.lineTo(41, 20); pCtx.lineTo(19, 41); pCtx.fill();
    pCtx.beginPath(); pCtx.moveTo(-1, 21); pCtx.lineTo(21, -1); pCtx.lineTo(-1, -1); pCtx.fill();
    state.cachedPattern = ctx.createPattern(pCanvas, 'repeat');
    return state.cachedPattern;
  } catch(e) { return null; }
}

function drawCourse() {
  const W = cCourse.width, H = cCourse.height, hd = state.holeData;
  if(!hd) return;
  
  ctxC.fillStyle = '#111a0e'; ctxC.fillRect(0,0,W,H);
  state.paths = createTerrainPaths(hd);
  
  ctxC.fillStyle = '#111a0e'; ctxC.fill(state.paths.ob);

  ctxC.setLineDash([8, 8]); ctxC.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctxC.lineWidth = 2;
  if(hd.obFlanks.left.length > 0) {
      ctxC.beginPath(); ctxC.moveTo(hd.obFlanks.left[0].x, hd.obFlanks.left[0].y);
      for(let i=1; i<hd.obFlanks.left.length; i++) ctxC.lineTo(hd.obFlanks.left[i].x, hd.obFlanks.left[i].y);
      ctxC.stroke();
  }
  if(hd.obFlanks.right.length > 0) {
      ctxC.beginPath(); ctxC.moveTo(hd.obFlanks.right[0].x, hd.obFlanks.right[0].y);
      for(let i=1; i<hd.obFlanks.right.length; i++) ctxC.lineTo(hd.obFlanks.right[i].x, hd.obFlanks.right[i].y);
      ctxC.stroke();
  }
  ctxC.setLineDash([]);

  ctxC.fillStyle = '#162312';
  for(let i=0; i<1500; i++) {
     let x = Math.random()*W, y=Math.random()*H;
     const terr = getTerrain(x,y);
     if(terr === 'rough' || terr === 'semirough' || terr === 'deeprough') ctxC.fillRect(x, y, 3, 2);
  }

  if(state.paths.rough) { ctxC.fillStyle = '#1e3218'; ctxC.fill(state.paths.rough); }
  if(state.paths.semirough) { ctxC.fillStyle = '#223d1b'; ctxC.fill(state.paths.semirough); }
  if(state.paths.fairway) { ctxC.fillStyle = getFairwayPattern(ctxC) || '#2b4d1f'; ctxC.fill(state.paths.fairway); }

  ctxC.fillStyle = '#1c3d5a';
  hd.rivers.forEach(r => {
       ctxC.beginPath();
       for(let x=0; x<=W; x+=20) {
           let wave = Math.sin(x/50 + r.phase) * 10, y = r.y + (x - W/2) * r.angle + wave;
           if(x===0) ctxC.moveTo(x, y - r.width/2); else ctxC.lineTo(x, y - r.width/2);
       }
       for(let x=W; x>=0; x-=20) {
           let wave = Math.sin(x/50 + r.phase) * 10, y = r.y + (x - W/2) * r.angle + wave;
           ctxC.lineTo(x, y + r.width/2);
       }
       ctxC.closePath(); ctxC.fill();
       ctxC.strokeStyle = '#2b5f8c'; ctxC.lineWidth = 1; ctxC.beginPath();
       for(let x=20; x<W; x+=40) {
           let wave = Math.sin(x/50 + r.phase) * 10, y = r.y + (x - W/2) * r.angle + wave;
           ctxC.moveTo(x, y); ctxC.lineTo(x+10, y);
       }
       ctxC.stroke();
  });

  hd.lakes.forEach(l => {
    ctxC.save(); ctxC.translate(l.cx, l.cy); ctxC.rotate(l.angle);
    ctxC.fillStyle = '#1c3d5a'; ctxC.beginPath(); ctxC.ellipse(0, 0, l.rx, l.ry, 0, 0, Math.PI*2); ctxC.fill();
    ctxC.strokeStyle = '#2b5f8c'; ctxC.lineWidth = 1; 
    ctxC.beginPath(); ctxC.moveTo(-l.rx*0.5, 0); ctxC.lineTo(l.rx*0.5, 0); ctxC.stroke();
    ctxC.beginPath(); ctxC.moveTo(-l.rx*0.3, l.ry*0.4); ctxC.lineTo(l.rx*0.3, l.ry*0.4); ctxC.stroke();
    ctxC.restore();
  });

  hd.sandTraps.forEach(s => {
    ctxC.save(); ctxC.translate(s.cx, s.cy); ctxC.rotate(s.angle);
    ctxC.fillStyle = '#5c4d24'; ctxC.beginPath(); ctxC.ellipse(0, 0, s.rx+4, s.ry+4, 0, 0, Math.PI*2); ctxC.fill();
    ctxC.fillStyle = '#c2a86b'; ctxC.beginPath(); ctxC.ellipse(0, 0, s.rx, s.ry, 0, 0, Math.PI*2); ctxC.fill();
    ctxC.fillStyle = '#a68f56';
    for(let i=0;i<20;i++){
      const angle=Math.random()*Math.PI*2, r=Math.random(); ctxC.fillRect(Math.cos(angle)*s.rx*r, Math.sin(angle)*s.ry*r, 3,1.5);
    }
    ctxC.restore();
  });
  
  const gx=hd.holeX, gy=hd.holeY, gr=hd.greenR;
  ctxC.fillStyle = '#224a1e'; ctxC.beginPath(); ctxC.arc(gx, gy, gr + 6, 0, Math.PI*2); ctxC.fill();
  ctxC.fillStyle = '#32702c'; ctxC.beginPath(); ctxC.arc(gx, gy, gr, 0, Math.PI*2); ctxC.fill();
  
  ctxC.fillStyle = '#000'; ctxC.beginPath();ctxC.arc(gx,gy,7,0,Math.PI*2);ctxC.fill();
  ctxC.strokeStyle = '#e0e0e0'; ctxC.lineWidth = 1.5; ctxC.beginPath();ctxC.moveTo(gx,gy);ctxC.lineTo(gx,gy-32);ctxC.stroke();
  ctxC.fillStyle = '#e84832'; ctxC.beginPath();ctxC.moveTo(gx,gy-32);ctxC.lineTo(gx+18,gy-26);ctxC.lineTo(gx,gy-20);ctxC.fill();
  
  ctxC.fillStyle = '#173614'; ctxC.beginPath();ctxC.ellipse(hd.teeX, hd.teeY, 26, 14, 0, 0, Math.PI*2);ctxC.fill();
  ctxC.fillStyle = '#ffffff'; ctxC.beginPath();ctxC.arc(hd.teeX - 12, hd.teeY, 2.5, 0, Math.PI*2);ctxC.fill();
  ctxC.beginPath();ctxC.arc(hd.teeX + 12, hd.teeY, 2.5, 0, Math.PI*2);ctxC.fill();
  
  hd.trees.forEach(t => {
     ctxC.fillStyle = '#3a2a18'; ctxC.fillRect(t.x-2, t.y, 4, 12);
     ctxC.fillStyle = 'rgba(0,0,0,0.3)'; ctxC.beginPath(); ctxC.ellipse(t.x, t.y+10, t.r*0.8, t.r*0.4, 0, 0, Math.PI*2); ctxC.fill();
     ctxC.fillStyle = '#1e3d22'; ctxC.beginPath(); ctxC.arc(t.x, t.y, t.r, 0, Math.PI*2); ctxC.fill();
     ctxC.fillStyle = '#27522c'; ctxC.beginPath(); ctxC.arc(t.x-t.r*0.2, t.y-t.r*0.2, t.r*0.7, 0, Math.PI*2); ctxC.fill();
  });
}

function drawBall() {
  const W=cBall.width, H=cBall.height;
  ctxB.clearRect(0,0,W,H);
  const b = state.ball; const r = b.airR || 5;
  ctxB.fillStyle = 'rgba(0,0,0,0.4)'; ctxB.beginPath(); ctxB.ellipse(b.x, b.y+(r*0.5), r*0.8, r*0.25, 0, 0, Math.PI*2); ctxB.fill();
  ctxB.fillStyle = '#fff'; ctxB.beginPath(); ctxB.arc(b.x, b.y, r, 0, Math.PI*2); ctxB.fill();
}

function drawUI() {
  const W=cUI.width, H=cUI.height;
  ctxU.clearRect(0,0,W,H);
  
  if(state.phase === 'card_select' && state.target) {
    const dx = state.target.x - state.ball.x, dy = state.target.y - state.ball.y;
    const ang = Math.atan2(dy, dx);
    const activeBall = state.hand.find(c => c.uid === state.selectedBall);
    const hasScope = activeBall && activeBall.effect === 'guide';
    
    let isWarning = (state.currentTerrain === 'rough' || state.currentTerrain === 'semirough' || state.currentTerrain === 'deeprough' || state.currentTerrain === 'bunker');

    ctxU.fillStyle = 'rgba(255,255,255,0.8)';
    ctxU.beginPath(); ctxU.arc(state.target.x, state.target.y, 2.5, 0, Math.PI*2); ctxU.fill();
    ctxU.strokeStyle = 'rgba(255,255,255,0.6)'; ctxU.lineWidth = 1.5;
    ctxU.beginPath();
    ctxU.moveTo(state.target.x - 7, state.target.y - 7); ctxU.lineTo(state.target.x + 7, state.target.y + 7);
    ctxU.moveTo(state.target.x + 7, state.target.y - 7); ctxU.lineTo(state.target.x - 7, state.target.y + 7);
    ctxU.stroke();

    ctxU.beginPath(); ctxU.moveTo(state.ball.x, state.ball.y);
    
    if (hasScope) {
      ctxU.setLineDash([4, 4]); ctxU.lineWidth = 2; ctxU.strokeStyle = isWarning ? 'rgba(232,72,50,0.6)' : 'rgba(255,255,255,0.4)';
      ctxU.lineTo(state.ball.x + Math.cos(ang)*W*2, state.ball.y + Math.sin(ang)*H*2);
      ctxU.stroke(); ctxU.setLineDash([]);
      
      if (state.selectedClub) {
        const club = state.hand.find(c => c.uid === state.selectedClub);
        let clubDist = club.dist;
        if(activeBall && activeBall.effect === 'power') clubDist = Math.round(clubDist*1.2);
        
        let lFactor = Math.max(0, Math.min(1, (club.dist - 80) / 160));
        let pDist = 0;
        if (state.currentTerrain === 'rough') pDist = 0.08 + (0.17 * lFactor);
        else if (state.currentTerrain === 'semirough') pDist = 0.03 + (0.07 * lFactor);
        else if (state.currentTerrain === 'deeprough') pDist = 0.12 + (0.25 * lFactor);
        else if (state.currentTerrain === 'bunker') pDist = 0.20 + (0.30 * lFactor);
        clubDist = Math.round(clubDist * (1 - pDist));

        const pxDist = clubDist * state.holeData.scale;
        const reachX = state.ball.x + Math.cos(ang)*pxDist, reachY = state.ball.y + Math.sin(ang)*pxDist;
        ctxU.fillStyle = isWarning ? 'rgba(232,72,50,0.8)' : 'rgba(168,216,120,0.8)';
        ctxU.beginPath(); ctxU.arc(reachX, reachY, 5, 0, Math.PI*2); ctxU.fill();
      }
    } else {
      ctxU.lineWidth = 3; ctxU.strokeStyle = 'rgba(0,0,0,0.6)'; // Sombra
      ctxU.lineTo(state.ball.x + Math.cos(ang)*40, state.ball.y + Math.sin(ang)*40); 
      ctxU.stroke();
      
      ctxU.beginPath(); ctxU.moveTo(state.ball.x, state.ball.y);
      ctxU.lineWidth = 1.5; ctxU.strokeStyle = isWarning ? 'rgba(232,72,50,0.9)' : 'rgba(255,255,255,0.9)'; // Trazo real
      ctxU.lineTo(state.ball.x + Math.cos(ang)*40, state.ball.y + Math.sin(ang)*40); 
      ctxU.stroke();
    }
  }
  
  if(state.phase === 'flight' && state.ballAnim && state.ballAnim.trace.length > 1) {
    const tr = state.ballAnim.trace;
    ctxU.strokeStyle = 'rgba(255,255,255,0.4)'; ctxU.lineWidth = 1.5; ctxU.setLineDash([3,5]);
    ctxU.beginPath(); ctxU.moveTo(tr[0].x, tr[0].y);
    for(let i=1;i<tr.length;i++) ctxU.lineTo(tr[i].x, tr[i].y);
    ctxU.stroke(); ctxU.setLineDash([]);
  }
}

function resetMetersUI() { $('power-fill').style.width = '0%'; $('aim-cursor').style.left = '50%'; }
function updateShootBtnUI() {
  const btn = $('shoot-btn');
  if (state.phase === 'card_select') {
      btn.disabled = !state.selectedClub; btn.textContent = state.selectedClub ? 'MANTENER' : 'GOLPEAR';
  } else if (state.phase === 'power') { btn.disabled = false; btn.textContent = 'SOLTAR'; }
  else if (state.phase === 'aim') { btn.disabled = false; btn.textContent = 'PULSAR'; }
  else { btn.disabled = true; btn.textContent = '...'; }
}

// ─── WIND & CARDS ────────────────────────────────────────────────────────────
function generateWind() {
  state.wind.speed = Math.random() * (4 + state.holeData.difficulty * 12);
  state.wind.dir = Math.random()*Math.PI*2;
  $('wind-text').textContent = state.wind.speed.toFixed(1)+' m/s';
  $('wind-arrow').style.transform = `rotate(${state.wind.dir}rad)`;
  const flagEl = $('flag-shape'), animAmt = Math.min(state.wind.speed/15, 1);
  flagEl.setAttribute('points', `20,6 ${34+Math.cos(state.wind.dir)*animAmt*8},${12+animAmt*2} 20,18`);
}

function initDeck() {
  state.drawPile = []; state.discardPile = []; state.hand = [];
  for(const [baseId, count] of Object.entries(state.deckConfig)) {
      const template = CARDS_POOL.find(c => c.baseId === baseId);
      for(let i=0; i<count; i++) state.drawPile.push(cloneCard(template));
  }
  shuffle(state.drawPile);
}

function drawCardsToHand() {
  const hasPutt = state.hand.some(c => c.isPutt);
  if (state.distToHole <= 40 && !hasPutt) {
      const clubIndex = state.hand.findIndex(c => c.type === 'club');
      if(clubIndex !== -1) { state.discardPile.push(state.hand[clubIndex]); state.hand[clubIndex] = cloneCard(PUTTER_CARD); }
      else state.hand.push(cloneCard(PUTTER_CARD));
  } else if (state.distToHole > 40 && hasPutt) state.hand = state.hand.filter(c => !c.isPutt);

  let shuffleHappened = false;
  while(state.hand.length < 5) {
      if (state.drawPile.length === 0) {
          if (state.discardPile.length === 0) break;
          state.drawPile = shuffle([...state.discardPile]); state.discardPile = [];
          shuffleHappened = true;
      }
      state.hand.push(state.drawPile.pop());
  }
  if (shuffleHappened) showToast("Mazo vacío. Barajando descartes...");

  let validClubs = state.hand.filter(c => c.type === 'club');
  if (validClubs.length === 0 && state.currentTerrain !== 'green') {
      showToast("¡Mano sin palos! Descartando y robando...");
      setTimeout(() => {
          state.hand.forEach(c => state.discardPile.push(c));
          state.hand = [];
          drawCardsToHand();
      }, 1500);
      return;
  }

  $('deck-count').textContent = state.drawPile.length; renderCards();
}

function discardPlayedCards() {
  const played = state.hand.filter(c => c.uid === state.selectedClub || c.uid === state.selectedBall);
  state.hand = state.hand.filter(c => c.uid !== state.selectedClub && c.uid !== state.selectedBall);
  played.forEach(c => { if(!c.isPutt) state.discardPile.push(c); });
  state.selectedClub = null; state.selectedBall = null;
}

let pendingBallCard = null;

function renderCards() {
  const row = $('cards-row'); row.innerHTML = '';
  state.hand.forEach((card) => {
    const div = document.createElement('div');
    
    let disabled = false;
    if(state.currentTerrain === 'green' && card.type === 'ball') disabled = true;
    if(state.itemLocked && card.type === 'ball' && state.selectedBall !== card.uid) disabled = true;

    div.className = 'card' + (card.type==='ball'?' ball-card':'') + (disabled?' disabled':'');
    const isSel = (card.type==='club' && state.selectedClub===card.uid) || (card.type==='ball' && state.selectedBall===card.uid);
    if(isSel) div.classList.add('selected');
    if(disabled) { div.style.opacity = '0.3'; div.style.pointerEvents = 'none'; }

    div.innerHTML = `<span class="card-type">${card.type==='club'?'Palo':'Bola'}</span><div class="card-icon">${card.icon}</div><div class="card-name">${card.name}</div>${card.type==='club' ? `<div class="card-dist">~${card.dist}m</div>` : `<div class="card-dist gold">${card.icon}</div>`}`;
    
    div.onclick = () => {
      if(state.phase!=='card_select' || disabled) return;
      if(card.type==='club') {
         state.selectedClub = state.selectedClub === card.uid ? null : card.uid;
         renderCards(); updateShootBtnUI(); updateReachDisplay(); drawUI();
      } else {
         if (state.itemLocked) return;
         if (state.selectedBall === card.uid) {
            state.selectedBall = null;
            renderCards(); updateReachDisplay(); drawUI();
         } else {
            pendingBallCard = card;
            $('cc-title').innerHTML = `${card.name} ${card.icon}`;
            $('cc-desc').textContent = card.desc;
            $('card-confirm-overlay').style.display = 'flex';
         }
      }
    };
    row.appendChild(div);
  });
}

$('cc-btn-cancel').onclick = () => { $('card-confirm-overlay').style.display = 'none'; pendingBallCard = null; };
$('cc-btn-accept').onclick = () => {
    $('card-confirm-overlay').style.display = 'none';
    if(pendingBallCard) {
        state.selectedBall = pendingBallCard.uid;
        state.itemLocked = true;
        pendingBallCard = null;
        renderCards(); updateShootBtnUI(); updateReachDisplay(); drawUI();
    }
};

// ─── DECK BUILDER UI ─────────────────────────────────────────────────────────
function showDeckBuilder() {
  $('deck-overlay').style.display = 'flex'; state.deckConfig = {}; let totalCards = 0;
  const grid = $('deck-grid'); grid.innerHTML = ''; const btn = $('deck-btn'); btn.disabled = true;
  CARDS_POOL.forEach((card) => {
    state.deckConfig[card.baseId] = 0;
    const div = document.createElement('div'); div.className = 'card' + (card.type==='ball'?' ball-card':'');
    div.innerHTML = `<div class="card-badge" style="display:none"></div><div class="card-icon">${card.icon}</div><div class="card-name">${card.name}</div>${card.type==='club' ? `<div class="card-dist">~${card.dist}m</div>` : `<div class="card-dist gold">${card.icon}</div>`}`;
    const badge = div.querySelector('.card-badge');
    
    div.onclick = () => {
      let count = state.deckConfig[card.baseId];
      if (count === 2) {
          state.deckConfig[card.baseId] = 0; totalCards -= 2;
      } else if (count === 1) {
          if (totalCards < 16) { state.deckConfig[card.baseId] = 2; totalCards++; }
          else { state.deckConfig[card.baseId] = 0; totalCards--; }
      } else if (count === 0 && totalCards < 16) {
          state.deckConfig[card.baseId] = 1; totalCards++;
      }
      
      count = state.deckConfig[card.baseId];
      if(count > 0) { div.classList.add('selected'); badge.style.display = 'flex'; badge.textContent = `x${count}`; }
      else { div.classList.remove('selected'); badge.style.display = 'none'; }
      $('deck-counter').textContent = `${totalCards} / 16`; btn.disabled = totalCards !== 16;
    };
    grid.appendChild(div);
  });
  btn.onclick = () => { $('deck-overlay').style.display = 'none'; initDeck(); startHole(0); };
}

// ─── SHOT MECHANICS ──────────────────────────────────────────────────────────
let powerRaf=null, aimRaf=null;
function startPowerMeter() { state.phase = 'power'; state.powerVal = 0; state.powerDir = 1; state.powerHeld = true; lastPowerTime = performance.now(); updateShootBtnUI(); animatePower(performance.now()); }
function stopPower() { if(state.phase!=='power') return; state.powerHeld = false; cancelAnimationFrame(powerRaf); startAimMeter(); }
function startAimMeter() {
  const club = state.hand.find(c=>c.uid===state.selectedClub);
  if(club && club.isPutt) { state.aimVal = 0.5; executeShot(); return; }
  state.phase = 'aim'; state.aimVal = 0; state.aimDir = 1; lastAimTime = performance.now(); updateShootBtnUI(); animateAim(performance.now());
}
function stopAim() { if(state.phase!=='aim') return; cancelAnimationFrame(aimRaf); executeShot(); }

let lastPowerTime=0;
function animatePower(ts) {
  const dt = Math.min((ts-lastPowerTime)/1000, 0.05); lastPowerTime=ts;
  if(state.powerHeld) {
     state.powerVal += state.powerDir * dt * 2.0; 
     if (state.powerVal >= 1) { state.powerVal = 1; state.powerDir = -1; }
     if (state.powerVal <= 0) { state.powerVal = 0; state.powerDir = 1; }
  }
  $('power-fill').style.width = (state.powerVal*100)+'%';
  if(state.phase==='power') powerRaf=requestAnimationFrame(animatePower);
}
let lastAimTime=0;
function animateAim(ts){
  const dt=Math.min((ts-lastAimTime)/1000,0.05); lastAimTime=ts;
  state.aimVal = Math.max(0,Math.min(1,state.aimVal+state.aimDir*dt*2.2));
  if(state.aimVal>=1||state.aimVal<=0) state.aimDir*=-1;
  $('aim-cursor').style.left = (state.aimVal*100)+'%';
  if(state.phase==='aim') aimRaf=requestAnimationFrame(animateAim);
}

const sBtn = $('shoot-btn');
function onBtnDown(e){
    if(sBtn.disabled) return; if(e && e.type !== 'keydown') e.preventDefault();
    if (state.phase === 'card_select' && state.selectedClub) { $('cards-row').style.pointerEvents='none'; startPowerMeter(); }
    else if (state.phase === 'aim') stopAim();
}
function onBtnUp(e){
    if(e && e.type !== 'keyup') e.preventDefault();
    if(state.phase === 'power') stopPower();
}
sBtn.addEventListener('touchstart', onBtnDown, {passive: false}); sBtn.addEventListener('touchend', onBtnUp, {passive: false});
sBtn.addEventListener('mousedown', onBtnDown); window.addEventListener('mouseup', onBtnUp);
window.addEventListener('keydown', (e) => { if(e.code==='Space' && !e.repeat) onBtnDown(e); });
window.addEventListener('keyup', (e) => { if(e.code==='Space') onBtnUp(e); });

// ─── EXECUTE SHOT ────────────────────────────────────────────────────────────
function updateReachDisplay() {
  if(!state.selectedClub) { $('d-reach').innerHTML = '— m'; return; }
  const club = state.hand.find(c=>c.uid===state.selectedClub); if(!club) return;
  
  let dist = club.dist;
  if(state.selectedBall) {
     const bc = state.hand.find(b=>b.uid===state.selectedBall);
     if(bc && bc.effect === 'power') dist = Math.round(dist*1.2);
  }

  let lFactor = Math.max(0, Math.min(1, (dist - 80) / 160));
  let pDist = 0;
  if (state.currentTerrain === 'rough') pDist = 0.08 + (0.17 * lFactor);
  else if (state.currentTerrain === 'semirough') pDist = 0.03 + (0.07 * lFactor);
  else if (state.currentTerrain === 'deeprough') pDist = 0.12 + (0.25 * lFactor);
  else if (state.currentTerrain === 'bunker') pDist = 0.20 + (0.30 * lFactor);
  
  let finalReach = Math.round(dist * (1 - pDist));
  let html = `~${finalReach} m`;
  if (pDist > 0) html += `<br><span style="color:var(--danger);font-size:9px;">Penalización Lie -${Math.round(pDist*100)}%</span>`;
  $('d-reach').innerHTML = html;
}

function executeShot() {
  state.phase = 'flight'; state.strokes++; $('h-strokes').textContent = state.strokes; updateShootBtnUI();
  
  const clubCard = state.hand.find(c=>c.uid===state.selectedClub);
  const ballCard = state.selectedBall ? state.hand.find(b=>b.uid===state.selectedBall) : null;
  
  let baseDist = clubCard.dist;
  if(ballCard?.effect==='power') baseDist = Math.round(baseDist*1.2);
  
  // APLICAR LIE PENALTY
  let lFactor = Math.max(0, Math.min(1, (clubCard.dist - 80) / 160));
  let pDist = 0, pDevMulti = 1;
  if (state.currentTerrain === 'rough') { pDist = 0.08 + (0.17 * lFactor); pDevMulti = 1.2 + (0.8 * lFactor); }
  else if (state.currentTerrain === 'semirough') { pDist = 0.03 + (0.07 * lFactor); pDevMulti = 1.1 + (0.4 * lFactor); }
  else if (state.currentTerrain === 'deeprough') { pDist = 0.12 + (0.25 * lFactor); pDevMulti = 1.4 + (1.0 * lFactor); }
  else if (state.currentTerrain === 'bunker') { pDist = 0.20 + (0.30 * lFactor); pDevMulti = 1.5 + (1.5 * lFactor); }
  
  const actualBaseDist = baseDist * (1 - pDist);
  const powerFactor = Math.max(0.05, Math.pow(state.powerVal, 1.6));
  let shotDist = Math.round(actualBaseDist * powerFactor);
  
  const startX = state.ball.x, startY = state.ball.y;
  const dx = state.target.x - startX, dy = state.target.y - startY;
  const targetPx = Math.hypot(dx, dy);
  const dirX = targetPx === 0 ? 0 : dx/targetPx, dirY = targetPx === 0 ? -1 : dy/targetPx;
  const perpX = -dirY, perpY = dirX;

  let deviation = 0;
  if(!clubCard.isPutt) {
    const aimOff = (state.aimVal - 0.5) * 2;
    let devFactor = 0.40 * (1 + state.holeData.difficulty * 0.5) * pDevMulti;
    if(ballCard?.effect==='control') devFactor *= 0.4;
    deviation = aimOff * shotDist * devFactor;
    
    if(ballCard?.effect !== 'heavy') {
       const wX = Math.cos(state.wind.dir) * state.wind.speed, wY = Math.sin(state.wind.dir) * state.wind.speed;
       deviation += (wX * perpX + wY * perpY) * (shotDist/100) * 1.5;
       shotDist += (wX * dirX + wY * dirY) * (shotDist/100) * 1.0; 
       shotDist = Math.max(5, shotDist);
    }
  }
  
  state.prevPos = {x: state.ball.x, y: state.ball.y};
  animateFlight(shotDist, deviation, clubCard, ballCard, dirX, dirY, perpX, perpY);
}

function animateFlight(dist, deviation, club, ballCard, dirX, dirY, perpX, perpY) {
  const hd = state.holeData;
  const startX = state.ball.x, startY = state.ball.y;
  
  const distPx = dist * hd.scale, devPx = deviation * hd.scale;
  const landX = startX + dirX*distPx + perpX*devPx, landY = startY + dirY*distPx + perpY*devPx;
  const landingTerrain = getTerrain(landX, landY);
  
  let rollDistM = dist * 0.15; 
  if (landingTerrain === 'green') rollDistM *= 0.6;
  else if (landingTerrain === 'fairway') rollDistM *= 1.2;
  else if (landingTerrain === 'semirough') rollDistM *= 0.5;
  else if (landingTerrain === 'rough') rollDistM *= 0.2;
  else if (landingTerrain === 'deeprough') rollDistM *= 0.1;
  else if (landingTerrain === 'bunker' || landingTerrain === 'agua') rollDistM *= 0.02;
  
  if (ballCard?.effect === 'fallstop') rollDistM = 0;
  if (ballCard?.effect === 'Backspin') rollDistM = -dist * 0.08;
  
  const rollPx = rollDistM * hd.scale;
  const rDX = dirX * distPx + perpX * devPx;
  const rDY = dirY * distPx + perpY * devPx;
  const rLen = Math.sqrt(rDX * rDX + rDY * rDY) || 1;
  const fDX = rDX / rLen, fDY = rDY / rLen;
  
  const finalX = landX + fDX * rollPx;
  const finalY = landY + fDY * rollPx;
  
  const airDur = 800 + dist * 1.5, rollDur = Math.max(200, Math.abs(rollDistM) * 30);
  
  let animPhase = 'air', phaseStart = performance.now();
  state.ballAnim = {trace: [{x:startX,y:startY}]};
  
  function frame(ts){
    const elapsed = ts - phaseStart;
    
    if (animPhase === 'air') {
      const t = Math.min(elapsed / airDur, 1);
      const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      const arcT = Math.sin(t * Math.PI);
      
      state.ball.x = startX + dirX * (distPx * ease) + perpX * (devPx * (ease * ease));
      state.ball.y = startY + dirY * (distPx * ease) + perpY * (devPx * (ease * ease)) - arcT * 80 * (dist / 200);
      state.ball.airR = 5 + (club.isPutt ? 0 : arcT * (dist > 150 ? 14 : 7));
      
      if (t >= 1) { 
        animPhase = 'roll'; 
        phaseStart = ts; 
        state.ball.airR = 5; 
      }
    } else {
      const t = Math.min(elapsed / rollDur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      
      state.ball.x = landX + (finalX - landX) * ease; 
      state.ball.y = landY + (finalY - landY) * ease;
      
      const dHole = Math.hypot(state.ball.x - hd.holeX, state.ball.y - hd.holeY);
      
      if (dHole <= 10) { 
          state.ball.x = hd.holeX; 
          state.ball.y = hd.holeY; 
          endShot(true); 
          return; 
      }
      
      if (t >= 1) { 
          endShot(false); 
          return; 
      }
    }
    drawBall(); drawUI(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function endShot(inHoleEarly) {
  const hd = state.holeData;
  state.distToHole = Math.hypot(state.ball.x - hd.holeX, state.ball.y - hd.holeY) / hd.scale;
  
  const terrain = getTerrain(state.ball.x, state.ball.y);
  drawBall(); 
  drawUI(); 
  resetMetersUI();
  
  if(terrain === 'ob' || terrain === 'agua') {
      const msgOverlay = $('msg-overlay');
      $('msg-title').textContent = terrain === 'agua' ? "AGUA" : "FUERA DE LÍMITES";
      $('msg-sub').textContent = "Penalización: +1 golpe";
      $('msg-btn').textContent = 'Continuar';
      msgOverlay.style.display = 'flex';
      
      $('msg-btn').onclick = () => {
          msgOverlay.style.display = 'none';
          state.ball.x = state.prevPos.x; 
          state.ball.y = state.prevPos.y;
          state.strokes++;
          state.distToHole = Math.hypot(state.ball.x - hd.holeX, state.ball.y - hd.holeY) / hd.scale;
          
          if (state.strokes >= hd.par + 5) {
              holeComplete(true);
          } else {
              finishTurn(state.currentTerrain); 
          }
      };
      return;
  }
  
  if(inHoleEarly || state.distToHole <= 3.0) { 
      setTimeout(() => holeComplete(false), 600); 
  } 
  else if (state.strokes >= hd.par + 5) {
      setTimeout(() => holeComplete(true), 600);
  }
  else {
      finishTurn(terrain);
  }
}

function finishTurn(terrain) {
    discardPlayedCards(); drawCardsToHand();
    state.phase = 'card_select'; state.powerHeld = false; state.itemLocked = false; state.currentTerrain = terrain;
    state.target = {x: state.holeData.holeX, y: state.holeData.holeY};
    
    autoSelectBestClub();

    updateShootBtnUI();
    const lbls = {'green':'Green', 'fairway':'Fairway', 'semirough':'SemiRough', 'rough':'Rough', 'deeprough': 'Deep Rough', 'bunker':'Bunker', 'ob':'Fuera', 'agua':'Agua', 'tee':'Tee'};
    $('d-pos').textContent = lbls[terrain] || 'Fairway';
    $('d-hole').textContent = Math.round(state.distToHole)+' m';
    $('cards-row').style.pointerEvents = 'auto'; 
    updateReachDisplay();
}

// ─── HOLE FLOW ───────────────────────────────────────────────────────────────
function startHole(holeIdx) {
  if (holeIdx > 17) {
      showScorecard(false);
      return;
  }

  state.paths = { fairway: null, semirough: null, rough: null, ob: null };
  state.cachedPattern = null; 
  state.ballAnim = null;

  state.hole = holeIdx;
  state.strokes = 0;
  state.selectedClub = null;
  state.selectedBall = null;
  state.itemLocked = false;
  state.phase = 'card_select';
  state.currentTerrain = 'tee';

  resizeCanvases();

  state.holeData = generateHole(holeIdx);
  state.ball = {x: state.holeData.teeX, y: state.holeData.teeY, airR: 5};
  state.target = {x: state.holeData.holeX, y: state.holeData.holeY};
  state.distToHole = state.holeData.holeLength;
  
  $('h-hole').textContent = state.hole + 1;
  $('h-par').textContent = state.holeData.par;
  $('h-strokes').textContent = 0;
  $('d-hole').textContent = Math.round(state.distToHole) + ' m';
  $('d-pos').textContent = 'Tee';
  
  generateWind();
  drawCardsToHand();
  resetMetersUI();
  
  autoSelectBestClub();
  drawCourse();
  drawBall();
  drawUI();
  updateShootBtnUI();
  updateReachDisplay();
  
  $('cards-row').style.pointerEvents = 'auto';
}

function holeComplete(maxLimit = false) {
  if (state.strokes > state.holeData.par + 5) state.strokes = state.holeData.par + 5;
  
  const diff = state.strokes - state.holeData.par;
  state.totalScore += diff;
  state.scores.push({hole: state.hole + 1, par: state.holeData.par, strokes: state.strokes, diff});
  
  $('h-score').textContent = state.totalScore === 0 ? 'E' : (state.totalScore > 0 ? '+' + state.totalScore : state.totalScore);
  
  const names = {'-3':'Albatross', '-2':'Eagle', '-1':'Birdie', '0':'Par', '1':'Bogey', '2':'Doble Bogey'};
  const msgOverlay = $('msg-overlay');
  
  if (maxLimit) {
      $('msg-title').textContent = "LÍMITE +5";
      $('msg-sub').textContent = `Hoyo ${state.hole+1} — Has alcanzado el límite máximo.`;
  } else {
      $('msg-title').textContent = names[String(diff)] || (diff > 0 ? '+' + diff : diff);
      $('msg-sub').textContent = `Hoyo ${state.hole+1} completado en ${state.strokes} golpes.`;
  }
  
  $('msg-btn').textContent = 'Siguiente Hoyo';
  msgOverlay.style.display = 'flex';
  
  const oldBtn = $('msg-btn');
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);

  newBtn.onclick = (e) => {
    e.preventDefault();
    $('msg-overlay').style.display = 'none'; 
    
    state.hand.forEach(c => {
        if(!c.isPutt) state.discardPile.push(c);
    });
    
    state.hand = []; 
    state.selectedClub = null;
    state.selectedBall = null;
    
    if(state.hole === 8 || state.hole === 17) {
        showScorecard(state.hole === 8);
    } else {
        startHole(state.hole + 1);
    }
  };
}

function showScorecard(isMidGame) {
  $('score-title').textContent = isMidGame ? 'Front 9 (Ida)' : 'Resultados Finales';
  const totalStr = state.totalScore===0?'E':state.totalScore>0?'+'+state.totalScore:state.totalScore;
  $('score-sub').textContent = `Score: ${totalStr}`;
  
  let html = `<div class="sc-header"><span>HOYO</span><span>PAR</span><span>GOLPES</span><span>SCORE</span></div>`;
  
  let p=0, s=0;
  for(let i=0; i < state.scores.length; i++) {
    const sc = state.scores[i];
    p += sc.par; s += sc.strokes;
    const dStr = sc.diff===0?'E':sc.diff>0?'+'+sc.diff:sc.diff;
    const color = sc.diff<0?'var(--accent)':sc.diff>0?'var(--danger)':'var(--text-muted)';
    html += `<div class="sc-row"><span>#${i+1}</span><span>${sc.par}</span><span>${sc.strokes}</span><span style="color:${color}">${dStr}</span></div>`;
    
    if (i === 8 && !isMidGame) {
        html += `<div class="sc-row total" style="color:var(--text-muted); border-top:1px dashed rgba(255,255,255,0.1)"><span>IDA</span><span>${p}</span><span>${s}</span><span></span></div>`;
    }
  }
  html += `<div class="sc-row total"><span>${isMidGame?'IDA':'TOTAL'}</span><span>${p}</span><span>${s}</span><span></span></div>`;
  
  $('score-table-wrap').innerHTML = html;
  
  $('score-btn').textContent = isMidGame ? 'Jugar la Vuelta' : 'Nueva Partida';
  $('score-overlay').style.display = 'flex';
  
  $('score-btn').onclick = () => {
    $('score-overlay').style.display = 'none';
    if(isMidGame) startHole(9); else location.reload();
  };
}

// ─── INIT ────────────────────────────────────────────────────────────────────
window.addEventListener('load', ()=>{
  resizeCanvases();
  $('msg-warn').style.display = 'block'; $('version-text').style.display = 'block';
  $('msg-btn').onclick = () => {
    $('msg-overlay').style.display = 'none'; $('msg-warn').style.display = 'none'; $('version-text').style.display = 'none';
    showDeckBuilder();
  }
  $('msg-overlay').style.display = 'flex';
});