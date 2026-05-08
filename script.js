const $ = id => document.getElementById(id);

const CARDS_POOL = [
  {id:'d', name:'Driver', dist:240, icon:'🏌', type:'club'},{id:'3w', name:'3 Wood', dist:215, icon:'🌲', type:'club'},
  {id:'5w', name:'5 Wood', dist:200, icon:'🌲', type:'club'},{name:'3 Iron', dist:190, icon:'⛳', type:'club'},
  {name:'4 Iron', dist:180, icon:'⛳', type:'club'},{name:'5 Iron', dist:170, icon:'⛳', type:'club'},
  {name:'6 Iron', dist:160, icon:'⛳', type:'club'},{name:'7 Iron', dist:150, icon:'⛳', type:'club'},
  {name:'8 Iron', dist:140, icon:'⛳', type:'club'},{name:'9 Iron', dist:130, icon:'⛳', type:'club'},
  {name:'Pitch W', dist:110, icon:'🎯', type:'club'},{name:'Gap W', dist:95,  icon:'🎯', type:'club'},
  {name:'Sand W', dist:80,  icon:'⏳', type:'club'},{name:'Lob W', dist:60,  icon:'📐', type:'club'},
  {name:'Power', icon:'🔥', effect:'power', desc:'+25% distancia', type:'ball'},
  {name:'Heavy', icon:'🪨', effect:'heavy', desc:'Ignora viento', type:'ball'},
  {name:'Mulligan', icon:'⏪', effect:'mulligan', desc:'Rebobina tiro (OB/Agua)', type:'ball'},
  {name:'Rana', icon:'🐸', effect:'frog', desc:'Rebota sobre agua', type:'ball'},
  {name:'Oruga', icon:'🚜', effect:'tractor', desc:'Ignora penalización terreno', type:'ball'}
];
CARDS_POOL.forEach((c,i) => c.baseId = c.id || `c${i}`);
const PUTTER_CARD = {baseId:'putt', name:'Putt', dist:30, icon:'🕳', type:'club', isPutt:true};
const HOLE_PARS = [4,4,3,5,4,3,4,5,4, 4,3,4,4,5,4,3,5,4];
const MAX_CLUBS = 20, MAX_BALLS = 4;

let state = {
  deckConfig:{}, drawPile:[], hand:[], money:0, hole:0, totalScore:0, scores:[], holeData:null,
  ball:{x:0, y:0}, target:{x:0, y:0}, prevPos:{x:0, y:0}, currentTerrain:'tee', shotTerrain:'tee',
  strokes:0, phase:'card_select', selectedClub:null, selectedBall:null, itemLocked:false,
  wind:{speed:0, dir:0}, powerVal:0, powerDir:1, powerHeld:false, aimVal:0.5, aimDir:1,
  ballAnim:null, cachedPattern:null, paths:{}
};

function cloneCard(c) { return {...c, uid: Math.random().toString(36).substr(2, 9)}; }
function shuffle(array) { for(let i=array.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
function showToast(text) { const t = document.createElement('div'); t.textContent = text; t.style.cssText = 'position:absolute;top:25%;left:50%;transform:translate(-50%,-50%);background:var(--accent2);color:#000;padding:12px 24px;border-radius:30px;font-family:"DM Mono",monospace;font-size:12px;text-transform:uppercase;font-weight:bold;z-index:100;box-shadow:0 10px 20px rgba(0,0,0,0.5);pointer-events:none;animation:toastFade 2s forwards;text-align:center;'; $('game').appendChild(t); setTimeout(()=>t.remove(), 2000); }

// Calcula cuántos objetos (bolas) tiene el jugador en total
const getTotalObjects = () => state.hand.filter(c=>c.type==='ball').length + state.drawPile.filter(c=>c.type==='ball').length;

let vfxList = [];
function addRipple(x, y) { vfxList.push({type: 'ripple', x, y, age: 0, maxAge: 600}); }
function addDust(x, y) { for(let i=0; i<6; i++) vfxList.push({ type: 'dust', x, y, vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5 - 0.5, age: 0, maxAge: 300 + Math.random()*200 }); }
function addFire(x, y) { for(let i=0; i<3; i++) vfxList.push({ type: 'fire', x: x + (Math.random()-0.5)*6, y: y + (Math.random()-0.5)*6, vx: (Math.random()-0.5)*0.5, vy: -Math.random()*1.5 - 0.5, age: 0, maxAge: 200 + Math.random()*150, size: 3 + Math.random()*3 }); }
function addRockTrail(x, y) { if(Math.random() < 0.3) vfxList.push({ type: 'rock', x: x + (Math.random()-0.5)*8, y: y + (Math.random()-0.5)*8, vx: 0, vy: Math.random()*0.5 + 0.2, age: 0, maxAge: 400 + Math.random()*200, size: 2 + Math.random()*3 }); }

function drawVFX(ctx) {
    for(let i = vfxList.length - 1; i >= 0; i--) {
        let p = vfxList[i]; p.age += 16; 
        if (p.age > p.maxAge) { vfxList.splice(i, 1); continue; }
        let t = p.age / p.maxAge;
        if (p.type === 'ripple') { ctx.strokeStyle = `rgba(255,255,255,${1-t})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 4 + t*12, 0, Math.PI*2); ctx.stroke(); } 
        else if (p.type === 'dust') { p.x += p.vx; p.y += p.vy; ctx.fillStyle = `rgba(200,180,150,${1-t})`; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5*(1-t), 0, Math.PI*2); ctx.fill(); } 
        else if (p.type === 'fire') { p.x += p.vx; p.y += p.vy; let g = Math.floor(150 * (1 - t)); ctx.fillStyle = `rgba(255, ${g}, 0, ${1-t})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size*(1-t), 0, Math.PI*2); ctx.fill(); } 
        else if (p.type === 'rock') { p.x += p.vx; p.y += p.vy; ctx.fillStyle = `rgba(100, 100, 100, ${1-t})`; ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size*(1-t), p.size*(1-t)); }
    }
}

function autoSelectBestClub() {
  let bestClub = null, minDiff = Infinity;
  state.hand.forEach(c => {
    if(c.type === 'club') {
      if(state.currentTerrain === 'green') { if(c.isPutt) bestClub = c; } 
      else if (!c.isPutt) { let diff = Math.abs(c.dist - state.distToHole); if (diff < minDiff) { minDiff = diff; bestClub = c; } }
    }
  });
  if (bestClub) { state.selectedClub = bestClub.uid; state.selectedBall = null; renderCards(); updateShootBtnUI(); updateReachDisplay(); drawUI(); }
}

const cCourse = $('c-course'), cBall = $('c-ball'), cUI = $('c-ui');
let CW = 0, CH = 0, DPR = 1;
const ctxC = cCourse.getContext('2d'), ctxB = cBall.getContext('2d'), ctxU = cUI.getContext('2d');

function resizeCanvases() {
  const wrap = $('canvas-wrap');
  CW = wrap.clientWidth; CH = wrap.clientHeight;
  DPR = window.devicePixelRatio || 1;
  [cCourse, cBall, cUI].forEach(c => { 
      c.width = CW * DPR; 
      c.height = CH * DPR; 
      c.style.width = CW + 'px'; 
      c.style.height = CH + 'px';
      c.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0);
  });
  if(state.holeData) { drawCourse(); drawBall(); drawUI(); }
}
window.addEventListener('resize', resizeCanvases);

function updateAimTarget(e) {
  if (state.phase !== 'card_select') return; e.preventDefault();
  const rect = cUI.getBoundingClientRect();
  state.target = { x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left, y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top };
  drawUI();
}
cUI.addEventListener('touchstart', updateAimTarget, {passive: false}); cUI.addEventListener('touchmove', updateAimTarget, {passive: false});
cUI.addEventListener('mousedown', updateAimTarget); cUI.addEventListener('mousemove', (e) => { if(e.buttons > 0) updateAimTarget(e); });

function bezierPoint(p0,p1,p2,p3,t) { return (1-t)**3*p0 + 3*(1-t)**2*t*p1 + 3*(1-t)*t**2*p2 + t**3*p3; }
function bezierTangent(p0,p1,p2,p3,t) { return 3*(1-t)**2*(p1-p0) + 6*(1-t)*t*(p2-p1) + 3*t**2*(p3-p2); }

function generateHole(holeIndex) {
  const W = CW, H = CH, par = HOLE_PARS[holeIndex], difficulty = holeIndex / 17;
  const teeY = H * 0.88; const visualLengthPx = H * 0.72; 
  const logicalDist = par === 3 ? 150+Math.random()*30 : par === 4 ? 330+Math.random()*70 : 490+Math.random()*60;
  const scale = visualLengthPx / logicalDist;
  const teeX = W/2, holeX = W/2 + (Math.random()-0.5)*W*(0.2 + difficulty*0.4), holeY = teeY - visualLengthPx;
  
  const dev1 = (Math.random()-0.5)*W*(0.15+difficulty*0.25), dev2 = (Math.random()-0.5)*W*(0.15+difficulty*0.25);
  const cp1x = W/2 + dev1, cp1y = teeY - visualLengthPx*(0.2 + Math.random()*0.2);
  const cp2x = holeX + dev2, cp2y = teeY - visualLengthPx*(0.5 + Math.random()*0.3);
  const fairwayW = Math.max(45, 90 - difficulty*35) + Math.random()*20;
  const fNoise = { l1: Math.random()*6.28, l2: Math.random()*6.28, r1: Math.random()*6.28, r2: Math.random()*6.28, srL1: Math.random()*6.28, srL2: Math.random()*6.28, srR1: Math.random()*6.28, srR2: Math.random()*6.28 };
  
  const isSplitHole = par >= 4 && (Math.random() < 0.2 + difficulty * 0.3);
  let gapStartT = 0.45 + Math.random()*0.1, gapEndT = gapStartT + 0.12 + Math.random()*0.08;

  let sandTraps = [];
  for(let i=0;i<(par===3?1:2)+Math.floor(difficulty*4);i++) {
    const t = 0.15 + Math.random()*0.8; if (isSplitHole && t >= gapStartT && t <= gapEndT) continue;
    sandTraps.push({ cx: bezierPoint(teeX,cp1x,cp2x,holeX,t)+(Math.random()-0.5)*(fairwayW+40), cy: bezierPoint(teeY,cp1y,cp2y,holeY,t)+(Math.random()-0.5)*20, rx: 15+Math.random()*15, ry: 10+Math.random()*10, angle: Math.random()*Math.PI });
  }

  let rivers = [], lakes = [];
  for(let i=0; i<Math.floor(difficulty*2.5); i++) rivers.push({ y: bezierPoint(teeY,cp1y,cp2y,holeY,0.3+Math.random()*0.5), width: 15+Math.random()*20, phase: Math.random()*Math.PI*2, angle: (Math.random()-0.5)*0.5 });
  for(let i=0; i<Math.floor(difficulty*3); i++) {
    const t = 0.2+Math.random()*0.6; 
    lakes.push({ cx: bezierPoint(teeX,cp1x,cp2x,holeX,t)+((Math.random()>0.5?1:-1)*(fairwayW*0.6+10+Math.random()*30)), cy: bezierPoint(teeY,cp1y,cp2y,holeY,t)+(Math.random()-0.5)*20, rx: 20+Math.random()*25, ry: 15+Math.random()*15, angle: Math.random()*Math.PI });
  }
  
  const greenR = Math.max(30, 50 - difficulty*15);
  
  let trees = [];
  for(let i=0; i<Math.floor(600+difficulty*400); i++) {
      let tx, ty, valid = false, attempts = 0;
      while(!valid && attempts < 20) {
          attempts++;
          if (trees.length > 0 && Math.random() < 0.6) { 
              const s = trees[Math.floor(Math.random()*trees.length)]; 
              tx = s.x+(Math.random()-0.5)*40; ty = s.y+(Math.random()-0.5)*40; 
          } else { 
              tx = (Math.random()-0.2)*W*1.4; ty = (Math.random()-0.2)*H*1.4; 
          }
          if (Math.hypot(tx-teeX, ty-teeY) < 45 || Math.hypot(tx-holeX, ty-holeY) < greenR+25) continue;
          let minD = Infinity;
          for(let t=0; t<=1; t+=0.05) minD = Math.min(minD, Math.hypot(tx-bezierPoint(teeX,cp1x,cp2x,holeX,t), ty-bezierPoint(teeY,cp1y,cp2y,holeY,t)));
          if (minD > fairwayW/2 + 25 || Math.random() < 0.02) valid = true;
      }
      if(valid) {
          let type = 'tree', r = Math.random();
          if(r<0.3) type='pine'; else if(r<0.6) type='bush'; else if(r<0.75) type='flowers';
          trees.push({x: tx, y: ty, r: 8 + Math.random()*12, type: type});
      }
  }
  trees.sort((a,b) => a.y - b.y);

  return { par, holeLength: logicalDist, scale, difficulty, teeX, teeY, holeX, holeY, cp1x, cp1y, cp2x, cp2y, fairwayW, sandTraps, rivers, lakes, trees, greenR, fNoise, isSplitHole, gapStartT, gapEndT, obFlanks: { left: [], right: [] } };
}

function createTerrainPaths(hd) {
    const paths = { fairway: new Path2D(), semirough: new Path2D(), rough: new Path2D(), ob: new Path2D() };
    let segments = hd.isSplitHole ? [[0, hd.gapStartT], [hd.gapEndT, 1.0]] : [[0, 1.0]];
    hd.obFlanks = { left: [], right: [] }; 

    for (let seg of segments) {
        const steps = Math.ceil((seg[1] - seg[0]) / 0.02);
        const pts = { fairway: {l:[], r:[]}, semirough: {l:[], r:[]}, rough: {l:[], r:[]}, ob: {l:[], r:[]} };

        for(let i=0; i<=steps; i++) {
            const tt = seg[0] + (i/steps) * (seg[1] - seg[0]);
            const bx = bezierPoint(hd.teeX, hd.cp1x, hd.cp2x, hd.holeX, tt);
            const by = bezierPoint(hd.teeY, hd.cp1y, hd.cp2y, hd.holeY, tt);
            const dx = bezierTangent(hd.teeX, hd.cp1x, hd.cp2x, hd.holeX, tt);
            const dy = bezierTangent(hd.teeY, hd.cp1y, hd.cp2y, hd.holeY, tt);
            const len = Math.hypot(dx, dy) || 1, nx = -dy/len, ny = dx/len;
            const env = Math.sin((i/steps) * Math.PI), wP = 0.6 + tt * 0.4;

            const noiseL = (Math.sin(tt*Math.PI*5+hd.fNoise.l1)*0.15 + Math.sin(tt*Math.PI*9+hd.fNoise.l2)*0.1)*env;
            const noiseR = (Math.sin(tt*Math.PI*4+hd.fNoise.r1)*0.15 + Math.sin(tt*Math.PI*11+hd.fNoise.r2)*0.1)*env;

            const fwL = Math.max(5, (hd.fairwayW/2) * (1 + noiseL) * wP);
            const fwR = Math.max(5, (hd.fairwayW/2) * (1 + noiseR) * wP);

            const srW_L = 10 + Math.max(5, (hd.fairwayW*0.3)*(1+(Math.sin(tt*Math.PI*6+hd.fNoise.srL1)*0.2+Math.sin(tt*Math.PI*13+hd.fNoise.srL2)*0.1)*env));
            const srW_R = 10 + Math.max(5, (hd.fairwayW*0.3)*(1+(Math.sin(tt*Math.PI*5+hd.fNoise.srR1)*0.2+Math.sin(tt*Math.PI*15+hd.fNoise.srR2)*0.1)*env));
            const obL = (Math.sin(tt*Math.PI*3+hd.fNoise.l1)*40*env)+70, obR = (Math.sin(tt*Math.PI*2+hd.fNoise.r2)*40*env)+70;

            pts.fairway.l.push({x: bx+nx*fwL, y: by+ny*fwL}); pts.fairway.r.push({x: bx-nx*fwR, y: by-ny*fwR});
            pts.semirough.l.push({x: bx+nx*(fwL+srW_L), y: by+ny*(fwL+srW_L)}); pts.semirough.r.push({x: bx-nx*(fwR+srW_R), y: by-ny*(fwR+srW_R)});
            pts.rough.l.push({x: bx+nx*(fwL+srW_L+16), y: by+ny*(fwL+srW_L+16)}); pts.rough.r.push({x: bx-nx*(fwR+srW_R+16), y: by-ny*(fwR+srW_R+16)});
            pts.ob.l.push({x: bx+nx*(fwL+srW_L+obL), y: by+ny*(fwL+srW_L+obL)}); pts.ob.r.push({x: bx-nx*(fwR+srW_R+obR), y: by-ny*(fwR+srW_R+obR)});

            if (segments.length===1 || seg===segments[0] || seg===segments[1]) {
                 hd.obFlanks.left.push({x: bx+nx*(fwL+srW_L+obL), y: by+ny*(fwL+srW_L+obL)});
                 hd.obFlanks.right.push({x: bx-nx*(fwR+srW_R+obR), y: by-ny*(fwR+srW_R+obR)});
            }
        }

        ['fairway', 'semirough', 'rough', 'ob'].forEach(type => {
            const poly = pts[type]; paths[type].moveTo(poly.r[0].x, poly.r[0].y);
            for(let i=1; i<poly.r.length; i++) paths[type].lineTo(poly.r[i].x, poly.r[i].y);
            const bxEnd=bezierPoint(hd.teeX,hd.cp1x,hd.cp2x,hd.holeX,seg[1]), byEnd=bezierPoint(hd.teeY,hd.cp1y,hd.cp2y,hd.holeY,seg[1]);
            const dxEnd=bezierTangent(hd.teeX,hd.cp1x,hd.cp2x,hd.holeX,seg[1]), dyEnd=bezierTangent(hd.teeY,hd.cp1y,hd.cp2y,hd.holeY,seg[1]);
            const wEnd = Math.max(0.1, Math.hypot(poly.l[poly.l.length-1].x - bxEnd, poly.l[poly.l.length-1].y - byEnd));
            paths[type].arc(bxEnd, byEnd, wEnd, Math.atan2(dyEnd, dxEnd)+Math.PI/2, Math.atan2(dyEnd, dxEnd)-Math.PI/2, true);
            for(let i=poly.l.length-1; i>=0; i--) paths[type].lineTo(poly.l[i].x, poly.l[i].y);
            const bxSt=bezierPoint(hd.teeX,hd.cp1x,hd.cp2x,hd.holeX,seg[0]), bySt=bezierPoint(hd.teeY,hd.cp1y,hd.cp2y,hd.holeY,seg[0]);
            const dxSt=bezierTangent(hd.teeX,hd.cp1x,hd.cp2x,hd.holeX,seg[0]), dySt=bezierTangent(hd.teeY,hd.cp1y,hd.cp2y,hd.holeY,seg[0]);
            const wSt = Math.max(0.1, Math.hypot(poly.l[0].x - bxSt, poly.l[0].y - bySt));
            paths[type].arc(bxSt, bySt, wSt, Math.atan2(dySt, dxSt)-Math.PI/2, Math.atan2(dySt, dxSt)+Math.PI/2, true);
            paths[type].closePath();
        });
    }
    return paths;
}

function getTerrain(x, y) {
  try {
    const hd = state.holeData; if(!hd) return 'fairway';
    const px = x * DPR, py = y * DPR;

    for (let r of hd.rivers) if (Math.abs(y - (r.y + (x - CW/2) * r.angle + Math.sin(x/50 + r.phase)*10)) <= r.width/2) return 'agua';
    for (let l of hd.lakes) { const nx=x-l.cx, ny=y-l.cy, rdx=nx*Math.cos(-l.angle)-ny*Math.sin(-l.angle), rdy=nx*Math.sin(-l.angle)+ny*Math.cos(-l.angle); if((rdx*rdx)/(l.rx*l.rx)+(rdy*rdy)/(l.ry*l.ry)<=1) return 'agua'; }
    if (Math.hypot(x - hd.holeX, y - hd.holeY) <= hd.greenR + 6) return 'green';
    for(let s of hd.sandTraps) { const nx=x-s.cx, ny=y-s.cy, rdx=nx*Math.cos(-s.angle)-ny*Math.sin(-s.angle), rdy=nx*Math.sin(-s.angle)+ny*Math.cos(-s.angle); if((rdx*rdx)/(s.rx*s.rx)+(rdy*rdy)/(s.ry*s.ry)<=1) return 'bunker'; }
    
    if (state.paths.fairway && ctxC.isPointInPath(state.paths.fairway, px, py)) return 'fairway';
    if (state.paths.semirough && ctxC.isPointInPath(state.paths.semirough, px, py)) return 'semirough';
    if (state.paths.rough && ctxC.isPointInPath(state.paths.rough, px, py)) return 'rough';
    if (state.paths.ob && ctxC.isPointInPath(state.paths.ob, px, py)) return 'deeprough';
    return 'ob';
  } catch(e) { return 'fairway'; }
}

function getFairwayPattern(ctx) {
  if(state.cachedPattern) return state.cachedPattern;
  const pC = document.createElement('canvas'); pC.width=40; pC.height=40; const pCtx = pC.getContext('2d');
  pCtx.fillStyle='#315424'; pCtx.fillRect(0,0,40,40); pCtx.fillStyle='#2b4d1f';
  pCtx.beginPath(); pCtx.moveTo(-1,41); pCtx.lineTo(41,-1); pCtx.lineTo(41,20); pCtx.lineTo(19,41); pCtx.fill();
  pCtx.beginPath(); pCtx.moveTo(-1,21); pCtx.lineTo(21,-1); pCtx.lineTo(-1,-1); pCtx.fill();
  return state.cachedPattern = ctx.createPattern(pC, 'repeat');
}

function drawCourse() {
  const W = CW, H = CH, hd = state.holeData; if(!hd) return;
  
  // 1. Fondo Oscuro Principal (O.B.)
  ctxC.fillStyle = '#111a0e';
  ctxC.fillRect(0,0,W,H);

  state.paths = createTerrainPaths(hd);
  
  // 2. PARCHE SPLINE: Capa base color Rough bajo el terreno para tapar posibles "agujeros" matemáticos
  ctxC.lineWidth = hd.fairwayW * 2.8 + 40; 
  ctxC.strokeStyle = '#1e3218'; // Color Rough
  ctxC.lineCap = 'round'; ctxC.lineJoin = 'round';
  ctxC.beginPath(); ctxC.moveTo(hd.teeX, hd.teeY);
  ctxC.bezierCurveTo(hd.cp1x, hd.cp1y, hd.cp2x, hd.cp2y, hd.holeX, hd.holeY);
  ctxC.stroke();
  
  // 3. Límites punteados del O.B.
  ctxC.setLineDash([8,8]); ctxC.strokeStyle = 'rgba(255,255,255,0.4)'; ctxC.lineWidth = 2;
  if(hd.obFlanks.left.length) { ctxC.beginPath(); ctxC.moveTo(hd.obFlanks.left[0].x, hd.obFlanks.left[0].y); for(let i=1; i<hd.obFlanks.left.length; i++) ctxC.lineTo(hd.obFlanks.left[i].x, hd.obFlanks.left[i].y); ctxC.stroke(); }
  if(hd.obFlanks.right.length) { ctxC.beginPath(); ctxC.moveTo(hd.obFlanks.right[0].x, hd.obFlanks.right[0].y); for(let i=1; i<hd.obFlanks.right.length; i++) ctxC.lineTo(hd.obFlanks.right[i].x, hd.obFlanks.right[i].y); ctxC.stroke(); }
  ctxC.setLineDash([]);
  
  ctxC.fillStyle = '#162312'; for(let i=0; i<1500; i++) { let x=Math.random()*W, y=Math.random()*H, t=getTerrain(x,y); if(t==='rough'||t==='semirough'||t==='deeprough') ctxC.fillRect(x,y,3,2); }
  
  if(state.paths.rough) { ctxC.fillStyle='#1e3218'; ctxC.fill(state.paths.rough); }
  if(state.paths.semirough) { ctxC.fillStyle='#223d1b'; ctxC.fill(state.paths.semirough); }
  if(state.paths.fairway) { ctxC.fillStyle=getFairwayPattern(ctxC)||'#2b4d1f'; ctxC.fill(state.paths.fairway); }
  
  ctxC.fillStyle='#1c3d5a'; hd.rivers.forEach(r => { ctxC.beginPath(); for(let x=0;x<=W;x+=20) ctxC[x===0?'moveTo':'lineTo'](x, r.y+(x-W/2)*r.angle+Math.sin(x/50+r.phase)*10 - r.width/2); for(let x=W;x>=0;x-=20) ctxC.lineTo(x, r.y+(x-W/2)*r.angle+Math.sin(x/50+r.phase)*10 + r.width/2); ctxC.fill(); ctxC.strokeStyle='#2b5f8c'; ctxC.lineWidth=1; ctxC.beginPath(); for(let x=20;x<W;x+=40){ let y=r.y+(x-W/2)*r.angle+Math.sin(x/50+r.phase)*10; ctxC.moveTo(x,y); ctxC.lineTo(x+10,y); } ctxC.stroke(); });
  hd.lakes.forEach(l => { ctxC.save(); ctxC.translate(l.cx, l.cy); ctxC.rotate(l.angle); ctxC.fillStyle='#1c3d5a'; ctxC.beginPath(); ctxC.ellipse(0,0,Math.max(0.1,l.rx),Math.max(0.1,l.ry),0,0,Math.PI*2); ctxC.fill(); ctxC.strokeStyle='#2b5f8c'; ctxC.lineWidth=1; ctxC.beginPath(); ctxC.moveTo(-l.rx*0.5,0); ctxC.lineTo(l.rx*0.5,0); ctxC.stroke(); ctxC.beginPath(); ctxC.moveTo(-l.rx*0.3,l.ry*0.4); ctxC.lineTo(l.rx*0.3,l.ry*0.4); ctxC.stroke(); ctxC.restore(); });
  hd.sandTraps.forEach(s => { ctxC.save(); ctxC.translate(s.cx, s.cy); ctxC.rotate(s.angle); ctxC.fillStyle='#5c4d24'; ctxC.beginPath(); ctxC.ellipse(0,0,Math.max(0.1,s.rx+4),Math.max(0.1,s.ry+4),0,0,Math.PI*2); ctxC.fill(); ctxC.fillStyle='#c2a86b'; ctxC.beginPath(); ctxC.ellipse(0,0,Math.max(0.1,s.rx),Math.max(0.1,s.ry),0,0,Math.PI*2); ctxC.fill(); ctxC.fillStyle='#a68f56'; for(let i=0;i<20;i++){ let a=Math.random()*Math.PI*2, r=Math.random(); ctxC.fillRect(Math.cos(a)*s.rx*r, Math.sin(a)*s.ry*r, 3,1.5); } ctxC.restore(); });
  const gx=hd.holeX, gy=hd.holeY, gr=hd.greenR;
  ctxC.fillStyle='#224a1e'; ctxC.beginPath(); ctxC.arc(gx,gy,Math.max(0.1,gr+6),0,Math.PI*2); ctxC.fill();
  ctxC.fillStyle='#32702c'; ctxC.beginPath(); ctxC.arc(gx,gy,Math.max(0.1,gr),0,Math.PI*2); ctxC.fill();
  ctxC.fillStyle='#000'; ctxC.beginPath(); ctxC.arc(gx,gy,7,0,Math.PI*2); ctxC.fill();
  ctxC.strokeStyle='#e0e0e0'; ctxC.lineWidth=1.5; ctxC.beginPath(); ctxC.moveTo(gx,gy); ctxC.lineTo(gx,gy-32); ctxC.stroke();
  ctxC.fillStyle='#e84832'; ctxC.beginPath(); ctxC.moveTo(gx,gy-32); ctxC.lineTo(gx+18,gy-26); ctxC.lineTo(gx,gy-20); ctxC.fill();
  ctxC.fillStyle='#173614'; ctxC.beginPath(); ctxC.ellipse(hd.teeX, hd.teeY, 26, 14, 0, 0, Math.PI*2); ctxC.fill();
  ctxC.fillStyle='#ffffff'; ctxC.beginPath(); ctxC.arc(hd.teeX-12, hd.teeY, 2.5, 0, Math.PI*2); ctxC.fill(); ctxC.beginPath(); ctxC.arc(hd.teeX+12, hd.teeY, 2.5, 0, Math.PI*2); ctxC.fill();
  
  hd.trees.forEach(t => { 
      if(t.type === 'tree') {
          ctxC.fillStyle='#3a2a18'; ctxC.fillRect(t.x-2, t.y, 4, 12); 
          ctxC.fillStyle='rgba(0,0,0,0.3)'; ctxC.beginPath(); ctxC.ellipse(t.x, t.y+10, Math.max(0.1,t.r*0.8), Math.max(0.1,t.r*0.4), 0, 0, Math.PI*2); ctxC.fill(); 
          ctxC.fillStyle='#1e3d22'; ctxC.beginPath(); ctxC.arc(t.x, t.y, Math.max(0.1,t.r), 0, Math.PI*2); ctxC.fill(); 
          ctxC.fillStyle='#27522c'; ctxC.beginPath(); ctxC.arc(t.x-t.r*0.2, t.y-t.r*0.2, Math.max(0.1,t.r*0.7), 0, Math.PI*2); ctxC.fill(); 
      } else if (t.type === 'pine') {
          ctxC.fillStyle='rgba(0,0,0,0.3)'; ctxC.beginPath(); ctxC.ellipse(t.x, t.y+10, Math.max(0.1,t.r*0.7), Math.max(0.1,t.r*0.3), 0, 0, Math.PI*2); ctxC.fill();
          ctxC.fillStyle='#152e18'; ctxC.beginPath(); ctxC.moveTo(t.x-t.r, t.y+6); ctxC.lineTo(t.x+t.r, t.y+6); ctxC.lineTo(t.x, t.y-t.r*1.5); ctxC.fill();
          ctxC.fillStyle='#1e4022'; ctxC.beginPath(); ctxC.moveTo(t.x-t.r*0.5, t.y+6); ctxC.lineTo(t.x, t.y+6); ctxC.lineTo(t.x, t.y-t.r*1.5); ctxC.fill();
      } else if (t.type === 'bush') {
          ctxC.fillStyle='rgba(0,0,0,0.2)'; ctxC.beginPath(); ctxC.ellipse(t.x, t.y+5, Math.max(0.1,t.r), Math.max(0.1,t.r*0.4), 0, 0, Math.PI*2); ctxC.fill();
          ctxC.fillStyle='#2a4724'; ctxC.beginPath(); ctxC.arc(t.x-t.r*0.3, t.y, Math.max(0.1,t.r*0.6), 0, Math.PI*2); ctxC.fill();
          ctxC.beginPath(); ctxC.arc(t.x+t.r*0.4, t.y-t.r*0.2, Math.max(0.1,t.r*0.7), 0, Math.PI*2); ctxC.fill();
          ctxC.beginPath(); ctxC.arc(t.x, t.y-t.r*0.4, Math.max(0.1,t.r*0.5), 0, Math.PI*2); ctxC.fill();
          ctxC.fillStyle='#36592e'; ctxC.beginPath(); ctxC.arc(t.x+t.r*0.1, t.y-t.r*0.2, Math.max(0.1,t.r*0.4), 0, Math.PI*2); ctxC.fill();
      } else if (t.type === 'flowers') {
          ctxC.fillStyle='#2a4724'; ctxC.beginPath(); ctxC.arc(t.x, t.y, Math.max(0.1,t.r*0.5), 0, Math.PI*2); ctxC.fill();
          const cols = ['#d4a832', '#e84832', '#a8d878', '#fff'];
          ctxC.fillStyle=cols[Math.floor(t.x)%cols.length];
          for(let j=0;j<3;j++){ ctxC.beginPath(); ctxC.arc(t.x+(Math.random()-0.5)*t.r*0.8, t.y+(Math.random()-0.5)*t.r*0.8, 1.5, 0, Math.PI*2); ctxC.fill(); }
      }
  });
}

function drawBall() {
  ctxB.clearRect(0,0,CW,CH); const b=state.ball, r=b.airR||5;
  ctxB.fillStyle='rgba(0,0,0,0.4)'; ctxB.beginPath(); ctxB.ellipse(b.x, b.y+(r*0.5), r*0.8, r*0.25, 0,0,Math.PI*2); ctxB.fill();
  ctxB.fillStyle='#fff'; ctxB.beginPath(); ctxB.arc(b.x, b.y, Math.max(0.1, r), 0,Math.PI*2); ctxB.fill();
}

function getLiePenalty(club, ball, terrain) {
  if(ball?.effect==='tractor') return {pDist:0, pDevMulti:1};
  if(club?.name==='Sand W' && terrain==='bunker') return {pDist:0, pDevMulti:1};
  let lF=Math.max(0,Math.min(1,((club?club.dist:150)-80)/160)), pD=0, pDM=1;
  if(terrain==='rough'){pD=0.08+0.17*lF; pDM=1.2+0.8*lF;} else if(terrain==='semirough'){pD=0.03+0.07*lF; pDM=1.1+0.4*lF;} else if(terrain==='deeprough'){pD=0.12+0.25*lF; pDM=1.4+1.0*lF;} else if(terrain==='bunker'){pD=0.20+0.30*lF; pDM=1.5+1.5*lF;}
  return {pDist:pD, pDevMulti:pDM};
}

function drawUI() {
  ctxU.clearRect(0,0,CW,CH);
  if(state.phase==='card_select' && state.target) {
    const dx=state.target.x-state.ball.x, dy=state.target.y-state.ball.y, ang=Math.atan2(dy,dx), tPx=Math.hypot(dx,dy);
    const aB=state.hand.find(c=>c.uid===state.selectedBall);
    let mRx=Infinity, oR=false;
    if(state.selectedClub) {
        const cl=state.hand.find(c=>c.uid===state.selectedClub);
        let cD=Math.round((aB?.effect==='power'?cl.dist*1.25:cl.dist) * (1-getLiePenalty(cl,aB,state.currentTerrain).pDist));
        mRx=cD*state.holeData.scale; oR=tPx>mRx;
    }
    ctxU.fillStyle='rgba(255,255,255,0.8)'; ctxU.beginPath(); ctxU.arc(state.target.x,state.target.y,2.5,0,Math.PI*2); ctxU.fill();
    ctxU.strokeStyle=oR?'rgba(232,72,50,0.6)':'rgba(255,255,255,0.6)'; ctxU.lineWidth=1.5; ctxU.beginPath(); ctxU.moveTo(state.target.x-7,state.target.y-7); ctxU.lineTo(state.target.x+7,state.target.y+7); ctxU.moveTo(state.target.x+7,state.target.y-7); ctxU.lineTo(state.target.x-7,state.target.y+7); ctxU.stroke();
    if(oR) { const rX=state.ball.x+Math.cos(ang)*mRx, rY=state.ball.y+Math.sin(ang)*mRx; ctxU.beginPath(); ctxU.arc(rX,rY,2.5,0,Math.PI*2); ctxU.fill(); ctxU.strokeStyle='rgba(255,255,255,0.6)'; ctxU.beginPath(); ctxU.moveTo(rX-7,rY-7); ctxU.lineTo(rX+7,rY+7); ctxU.moveTo(rX+7,rY-7); ctxU.lineTo(rX-7,rY+7); ctxU.stroke(); }
    ctxU.lineWidth=3; ctxU.strokeStyle='rgba(0,0,0,0.6)'; ctxU.beginPath(); ctxU.moveTo(state.ball.x,state.ball.y); ctxU.lineTo(state.ball.x+Math.cos(ang)*40,state.ball.y+Math.sin(ang)*40); ctxU.stroke();
    ctxU.lineWidth=1.5; ctxU.strokeStyle=['rough','semirough','deeprough','bunker'].includes(state.currentTerrain)?'rgba(232,72,50,0.9)':'rgba(255,255,255,0.9)'; ctxU.beginPath(); ctxU.moveTo(state.ball.x,state.ball.y); ctxU.lineTo(state.ball.x+Math.cos(ang)*40,state.ball.y+Math.sin(ang)*40); ctxU.stroke();
  }
  if(state.phase==='flight' && state.ballAnim?.trace.length>1) {
    const t=state.ballAnim.trace, aB=state.selectedBall?state.hand.find(c=>c.uid===state.selectedBall):null;
    if(aB?.effect==='power') { for(let i=1;i<t.length;i++){ let a=i/t.length; ctxU.strokeStyle=`rgba(255,${Math.floor(150*a)},0,${a})`; ctxU.lineWidth=1+(a*3); ctxU.beginPath(); ctxU.moveTo(t[i-1].x,t[i-1].y); ctxU.lineTo(t[i].x+(Math.random()-0.5)*4,t[i].y+(Math.random()-0.5)*4); ctxU.stroke(); } }
    else { ctxU.strokeStyle='rgba(255,255,255,0.4)'; ctxU.lineWidth=1.5; ctxU.setLineDash([3,5]); ctxU.beginPath(); ctxU.moveTo(t[0].x,t[0].y); for(let i=1;i<t.length;i++) ctxU.lineTo(t[i].x,t[i].y); ctxU.stroke(); ctxU.setLineDash([]); }
  }
  updatePowerMark();
}

function updatePowerMark() {
  let m=$('power-mark'); if(!m){ m=document.createElement('div'); m.id='power-mark'; m.style.cssText='display:none;position:absolute;top:-2px;bottom:-2px;width:3px;background:#fff;z-index:5;transform:translateX(-50%);border-radius:2px;box-shadow:0 0 5px rgba(255,255,255,0.8);pointer-events:none;'; $('power-track').appendChild(m); }
  if(state.phase!=='card_select'||!state.selectedClub||!state.target) return m.style.display='none';
  const c=state.hand.find(x=>x.uid===state.selectedClub), b=state.hand.find(x=>x.uid===state.selectedBall);
  if(!c||c.isPutt) return m.style.display='none';
  let cD=Math.round((b?.effect==='power'?c.dist*1.25:c.dist)*(1-getLiePenalty(c,b,state.currentTerrain).pDist));
  const tPx=Math.hypot(state.target.x-state.ball.x, state.target.y-state.ball.y);
  if(tPx < cD*state.holeData.scale - 2 && tPx > 0) { m.style.left = (Math.max(0,Math.min(1,Math.pow((tPx/state.holeData.scale)/cD, 1/1.6)))*100)+'%'; m.style.display='block'; } else m.style.display='none';
}

function resetMetersUI() { $('power-fill').style.width='0%'; $('aim-cursor').style.left='50%'; }
function updateShootBtnUI() { const b=$('shoot-btn'); if(state.phase==='card_select'){b.disabled=!state.selectedClub;b.textContent=state.selectedClub?'MANTENER':'GOLPEAR';}else if(state.phase==='power'){b.disabled=false;b.textContent='SOLTAR';}else if(state.phase==='aim'){b.disabled=false;b.textContent='PULSAR';}else{b.disabled=true;b.textContent='...';} }

function generateWind() { state.wind.speed=Math.random()*(4+state.holeData.difficulty*12); state.wind.dir=Math.random()*Math.PI*2; $('wind-text').innerHTML=state.wind.speed.toFixed(1)+'<br>m/s'; $('wind-arrow').style.transform=`rotate(${state.wind.dir}rad)`; $('flag-shape').setAttribute('points', `20,6 ${34+Math.cos(state.wind.dir)*Math.min(state.wind.speed/15,1)*8},${12+Math.min(state.wind.speed/15,1)*2} 20,18`); }
function initDeck() { state.drawPile=[]; state.hand=[]; state.money=0; for(const[id,c] of Object.entries(state.deckConfig)) for(let i=0;i<c;i++) state.drawPile.push(cloneCard(CARDS_POOL.find(x=>x.baseId===id))); shuffle(state.drawPile); $('h-money').textContent=state.money; }

function drawCardsToHand() {
  if(!state.holeData) return;
  const dToHolePx = Math.hypot(state.ball.x - state.holeData.holeX, state.ball.y - state.holeData.holeY);
  if (dToHolePx <= state.holeData.greenR + 6) state.currentTerrain = 'green';

  const hP = (state.holeData.greenR/state.holeData.scale)>30, pT = hP?70:40, pD = hP?60:30;
  const sHP = state.currentTerrain==='green' || (['fairway','semirough','tee'].includes(state.currentTerrain) && state.distToHole<=pT);
  if(sHP && typeof AudioEngine!=='undefined') AudioEngine.playBGM('tension');
  
  // SOLUCIÓN PUTTER: El Putter es 100% gratuito. Quitamos cualquier putter viejo
  const ePI = state.hand.findIndex(c=>c.isPutt);
  if(ePI !== -1) state.hand.splice(ePI,1);

  // Llenamos la mano SOLO con cartas normales (hasta 5)
  while(state.hand.length < 5) { 
      if(!state.drawPile.length) break; 
      state.hand.push(state.drawPile.pop()); 
  }

  // Y si estamos cerca, añadimos el putter EXTRA sin eliminar nada
  if(sHP){ 
      let p={baseId:'putt',name:'Putt',dist:pD,icon:'🕳',type:'club',isPutt:true}; 
      state.hand.push(cloneCard(p));
  }
  
  if(!state.hand.some(c=>c.type==='club') && state.currentTerrain!=='green' && state.hand.length>0) return state.drawPile.some(c=>c.type==='club') ? showSoftlockOverlay() : $('gameover-overlay').style.display='flex';
  if(!state.hand.length && !state.drawPile.length) return $('gameover-overlay').style.display='flex';
  $('deck-count').textContent=state.drawPile.length; renderCards();
}

function discardPlayedCards() { state.hand=state.hand.filter(c=>c.uid!==state.selectedClub&&c.uid!==state.selectedBall); state.selectedClub=null; state.selectedBall=null; }

let pendingBallCard = null;
function renderCards() {
  $('cards-row').innerHTML='';
  state.hand.forEach(c => {
    let d=false; if(state.currentTerrain==='green'&&c.type==='ball') d=true; if(state.itemLocked&&c.type==='ball'&&state.selectedBall!==c.uid) d=true;
    const div=document.createElement('div'); div.className='card'+(c.type==='ball'?' ball-card':'')+(d?' disabled':'')+(state.selectedClub===c.uid||state.selectedBall===c.uid?' selected':'');
    if(d) div.style.cssText='opacity:0.3;pointer-events:none;';
    div.innerHTML=`<span class="card-type">${c.type==='club'?'Palo':'Bola'}</span><div class="card-icon">${c.icon}</div><div class="card-name">${c.name}</div>${c.type==='club'?`<div class="card-dist">~${c.dist}m</div>`:`<div class="card-dist gold">${c.icon}</div>`}${c.desc?`<div class="card-tooltip">${c.desc}</div>`:''}`;
    div.onclick=() => {
      document.querySelectorAll('.card').forEach(x=>x.classList.remove('show-tooltip')); if(c.desc){div.classList.add('show-tooltip'); setTimeout(()=>div.classList.remove('show-tooltip'),2500);}
      if(state.phase!=='card_select'||d) return;
      if(c.type==='club') { state.selectedClub=state.selectedClub===c.uid?null:c.uid; renderCards(); updateShootBtnUI(); updateReachDisplay(); drawUI(); }
      else if(!state.itemLocked) { if(state.selectedBall===c.uid){state.selectedBall=null; renderCards(); updateReachDisplay(); drawUI();}else{pendingBallCard=c; $('cc-title').innerHTML=`${c.name} ${c.icon}`; $('cc-desc').textContent=c.desc; $('card-confirm-overlay').style.display='flex';} }
    };
    $('cards-row').appendChild(div);
  });
}

$('cc-btn-cancel').onclick = () => { $('card-confirm-overlay').style.display='none'; pendingBallCard=null; };
$('cc-btn-accept').onclick = () => { $('card-confirm-overlay').style.display='none'; if(pendingBallCard){state.selectedBall=pendingBallCard.uid; state.itemLocked=true; pendingBallCard=null; renderCards(); updateShootBtnUI(); updateReachDisplay(); drawUI();} };

function showDeckBuilder() {
  $('deck-overlay').style.display='flex'; state.deckConfig={}; let tC=0, tB=0; $('deck-grid').innerHTML=''; $('deck-btn').disabled=true;
  CARDS_POOL.forEach(c => {
    state.deckConfig[c.baseId]=0; const div=document.createElement('div'); div.className='card'+(c.type==='ball'?' ball-card':'');
    div.innerHTML=`<div class="card-badge" style="display:none"></div><div class="card-icon">${c.icon}</div><div class="card-name">${c.name}</div>${c.type==='club'?`<div class="card-dist">~${c.dist}m</div>`:`<div class="card-dist gold">${c.icon}</div>`}${c.desc?`<div class="card-tooltip">${c.desc}</div>`:''}`;
    const b=div.querySelector('.card-badge');
    div.onclick=() => {
      document.querySelectorAll('.card').forEach(x=>x.classList.remove('show-tooltip')); if(c.desc){div.classList.add('show-tooltip'); setTimeout(()=>div.classList.remove('show-tooltip'),2500);}
      let n=state.deckConfig[c.baseId], isC=c.type==='club', l=isC?MAX_CLUBS:MAX_BALLS, t=isC?tC:tB;
      if(n===2){state.deckConfig[c.baseId]=0; isC?tC-=2:tB-=2;} else if(n===1){if(t<l){state.deckConfig[c.baseId]=2; isC?tC++:tB++;}else{state.deckConfig[c.baseId]=0; isC?tC--:tB--;}} else if(n===0&&t<l){state.deckConfig[c.baseId]=1; isC?tC++:tB++;}
      let fin=state.deckConfig[c.baseId];
      if(fin>0){div.classList.add('selected'); b.style.display='flex'; b.textContent=`x${fin}`;}else{div.classList.remove('selected'); b.style.display='none';}
      $('deck-counter').textContent=`Palos: ${tC} / ${MAX_CLUBS} | Bolas: ${tB} / ${MAX_BALLS}`; $('deck-btn').disabled=!(tC===MAX_CLUBS&&tB===MAX_BALLS);
    }; $('deck-grid').appendChild(div);
  });
  $('deck-btn').onclick=()=>{ $('deck-overlay').style.display='none'; initDeck(); startHole(0); };
}

function showSoftlockOverlay() {
  const o=$('softlock-overlay'), c=$('softlock-cards'), b=$('softlock-btn'); c.innerHTML=''; let s=new Set();
  state.hand.forEach(x => {
    const div=document.createElement('div'); div.className='card'+(x.type==='ball'?' ball-card':''); div.innerHTML=`<span class="card-type">${x.type==='club'?'Palo':'Bola'}</span><div class="card-icon">${x.icon}</div><div class="card-name">${x.name}</div><div class="card-dist gold">${x.icon}</div>`;
    div.onclick=()=>{ if(s.has(x.uid)){s.delete(x.uid);div.classList.remove('to-return');}else{s.add(x.uid);div.classList.add('to-return');} b.disabled=!s.size; }; c.appendChild(div);
  });
  b.disabled=true; o.style.display='flex';
  b.onclick=()=>{ o.style.display='none'; state.hand.filter(x=>s.has(x.uid)).forEach(x=>state.drawPile.push(x)); state.hand=state.hand.filter(x=>!s.has(x.uid)); shuffle(state.drawPile); drawCardsToHand(); };
}

function grantReward(n, t, cb) {
    $('reward-title').textContent=t; $('reward-cards').innerHTML='';
    let pool = getTotalObjects() >= 6 ? CARDS_POOL.filter(c=>c.type==='club') : CARDS_POOL;
    for(let i=0;i<n;i++){ const c=cloneCard(pool[Math.floor(Math.random()*pool.length)]); state.drawPile.push(c); const d=document.createElement('div'); d.className='card'+(c.type==='ball'?' ball-card':''); d.innerHTML=`<span class="card-type">${c.type==='club'?'Palo':'Bola'}</span><div class="card-icon">${c.icon}</div><div class="card-name">${c.name}</div>${c.type==='club'?`<div class="card-dist">~${c.dist}m</div>`:`<div class="card-dist gold">${c.icon}</div>`}`; $('reward-cards').appendChild(d); }
    shuffle(state.drawPile); $('reward-overlay').style.display='flex'; $('reward-btn').onclick=()=>{ $('reward-overlay').style.display='none'; if(cb)cb(); };
}

function showPickReward(n, cb) {
    $('pick-title').textContent=n>1?"¡Eagle o Mejor!":"¡Birdie!"; $('pick-sub').textContent=`Elige ${n} carta${n>1?'s':''} de las 3. (Max 6 objetos)`; $('pick-cards').innerHTML=''; let pL=n; $('pick-btn').disabled=true;
    let pool = getTotalObjects() >= 6 ? CARDS_POOL.filter(c=>c.type==='club') : CARDS_POOL;
    for(let i=0;i<3;i++){
        const c=pool[Math.floor(Math.random()*pool.length)], d=document.createElement('div'); d.className='card face-down';
        const bD=document.createElement('div'); bD.style.cssText='font-size:30px;'; bD.textContent='❓';
        const fD=document.createElement('div'); fD.style.cssText='display:none;flex-direction:column;align-items:center;'; fD.innerHTML=`<span class="card-type">${c.type==='club'?'Palo':'Bola'}</span><div class="card-icon">${c.icon}</div><div class="card-name">${c.name}</div>${c.type==='club'?`<div class="card-dist">~${c.dist}m</div>`:`<div class="card-dist gold">${c.icon}</div>`}`;
        d.append(bD, fD); let f=false;
        d.onclick=()=>{ if(!f&&pL>0){ f=true; pL--; d.classList.remove('face-down'); if(c.type==='ball')d.classList.add('ball-card'); bD.style.display='none'; fD.style.display='flex'; state.drawPile.push(cloneCard(c)); if(!pL)$('pick-btn').disabled=false; } };
        $('pick-cards').appendChild(d);
    }
    $('pick-reward-overlay').style.display='flex'; $('pick-btn').onclick=()=>{ $('pick-reward-overlay').style.display='none'; shuffle(state.drawPile); if(cb)cb(); };
}

function showShop(callback) {
    const overlay = $('shop-overlay');
    $('shop-money').textContent = state.money;
    const grid = $('shop-grid');
    grid.innerHTML = '<div style="width:100%;font-weight:bold;color:var(--text);margin-bottom:5px;text-align:center;">OFERTAS</div><div id="shop-buy-area" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;width:100%;"></div><div style="width:100%;font-weight:bold;color:var(--text);margin-top:15px;margin-bottom:5px;text-align:center;">VENDER TUS OBJETOS (+40🪙)</div><div id="shop-sell-area" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;width:100%;"></div>';
    
    const buyArea = $('shop-buy-area');
    const sellArea = $('shop-sell-area');
    const btnBuy = $('shop-buy-btn');
    const costSpan = $('shop-cost');
    const cardsSpan = $('shop-total-cards');

    let selectedItems = new Set();
    let shopCards = [];

    let nI=Math.floor(Math.random()*4), iP=shuffle([50,75,100]).slice(0,nI), bP=CARDS_POOL.filter(c=>c.type==='ball'), cP=CARDS_POOL.filter(c=>c.type==='club');
    for(let i=0;i<nI;i++) shopCards.push({ id:Math.random().toString(), t:bP[Math.floor(Math.random()*bP.length)], p:iP[i], oP:iP[i] });
    for(let i=0;i<12-nI;i++){ let t=cP[Math.floor(Math.random()*cP.length)]; shopCards.push({ id:Math.random().toString(), t, p:t.dist*2, oP:t.dist*2 }); }
    
    let validClubs = shopCards.filter(x => x.t.type === 'club' && x.t.dist >= 100);
    if(validClubs.length > 0) {
        let dc = validClubs[Math.floor(Math.random()*validClubs.length)];
        let desc = [0.2, 0.3, 0.4, 0.5][Math.floor(Math.random()*4)];
        dc.p = Math.round(dc.p * (1-desc));
        dc.discount = `-${desc*100}%`;
    }
    
    shuffle(shopCards);

    const upd = () => { 
        let c=0; selectedItems.forEach(x=>c+=x.p); costSpan.textContent=c; $('shop-money').textContent=state.money; 
        let cTC=state.drawPile.length+state.hand.length;
        cardsSpan.innerHTML=selectedItems.size>0?`${cTC} <span style="color:var(--accent)">(+${selectedItems.size})</span>`:cTC; 
        costSpan.style.color=c>state.money?'var(--danger)':!selectedItems.size?'var(--text)':'var(--accent)'; 
        btnBuy.disabled=c>state.money||!selectedItems.size; 
    };

    function renderSellArea() {
        sellArea.innerHTML = '';
        let myBalls = [...state.hand.filter(c=>c.type==='ball'), ...state.drawPile.filter(c=>c.type==='ball')];
        if(myBalls.length === 0) sellArea.innerHTML = '<span style="color:var(--text-muted);font-size:11px;">No tienes objetos para vender.</span>';
        myBalls.forEach(b => {
            const d = document.createElement('div'); d.className = 'card ball-card';
            d.innerHTML = `<span class="card-type">Bola</span><div class="card-icon">${b.icon}</div><div class="card-name">${b.name}</div><div class="card-dist gold">${b.icon}</div>`;
            d.onclick = () => {
                state.money += 40; $('h-money').textContent=state.money;
                const hIdx = state.hand.findIndex(x=>x.uid === b.uid);
                if(hIdx > -1) state.hand.splice(hIdx, 1);
                else { const pIdx = state.drawPile.findIndex(x=>x.uid === b.uid); if(pIdx > -1) state.drawPile.splice(pIdx, 1); }
                renderSellArea(); upd(); showToast("+40 Monedas");
            };
            sellArea.appendChild(d);
        });
    }

    shopCards.forEach(x => {
        const d=document.createElement('div'); d.className='card'+(x.t.type==='ball'?' ball-card':'');
        d.innerHTML=`<div class="shop-price">${x.p} 🪙</div><span class="card-type">${x.t.type==='club'?'Palo':'Bola'}</span><div class="card-icon">${x.t.icon}</div><div class="card-name">${x.t.name}</div>${x.t.type==='club'?`<div class="card-dist">~${x.t.dist}m</div>`:`<div class="card-dist gold">${x.t.icon}</div>`}${x.t.desc?`<div class="card-tooltip">${x.t.desc}</div>`:''}${x.discount?`<div style="position:absolute;bottom:-10px;background:var(--danger);color:#fff;font-size:9px;padding:2px 4px;border-radius:4px;z-index:5;">${x.discount} (<del>${x.oP}</del>)</div>`:''}`;
        let b=false; d.onclick=() => { document.querySelectorAll('.card').forEach(y=>y.classList.remove('show-tooltip')); if(x.t.desc){d.classList.add('show-tooltip');setTimeout(()=>d.classList.remove('show-tooltip'),2500);} if(!b&&state.money>=x.p){ if(selectedItems.has(x)){selectedItems.delete(x);d.classList.remove('shop-selected');}else{selectedItems.add(x);d.classList.add('shop-selected');} upd(); }else if(!b&&state.money<x.p&&!selectedItems.has(x)) showToast("No tienes suficientes monedas."); };
        buyArea.appendChild(d);
    });

    renderSellArea(); upd(); overlay.style.display='flex';
    $('shop-buy-btn').onclick=() => { let c=0; selectedItems.forEach(x=>{c+=x.p; state.drawPile.push(cloneCard(x.t));}); state.money-=c; $('h-money').textContent=state.money; $('shop-overlay').style.display='none'; shuffle(state.drawPile); if(callback)callback(); };
    $('shop-exit-btn').onclick=() => { $('shop-overlay').style.display='none'; if(callback)callback(); };
}

let powerRaf=null, aimRaf=null, lastPowerTime=0, lastAimTime=0;
function startPowerMeter() { state.phase='power'; state.powerVal=0; state.powerDir=1; state.powerHeld=true; lastPowerTime=performance.now(); updateShootBtnUI(); animatePower(performance.now()); }
function stopPower() { if(state.phase!=='power') return; state.powerHeld=false; cancelAnimationFrame(powerRaf); startAimMeter(); }
function startAimMeter() { const c=state.hand.find(x=>x.uid===state.selectedClub); if(c&&c.isPutt){state.aimVal=0.5;executeShot();return;} state.phase='aim'; state.aimVal=0; state.aimDir=1; lastAimTime=performance.now(); updateShootBtnUI(); animateAim(performance.now()); }
function stopAim() { if(state.phase!=='aim') return; cancelAnimationFrame(aimRaf); executeShot(); }
function animatePower(ts) { const dt=Math.min((ts-lastPowerTime)/1000,0.05); lastPowerTime=ts; if(state.powerHeld){ state.powerVal+=state.powerDir*dt*2.0; if(state.powerVal>=1){state.powerVal=1;state.powerDir=-1;} if(state.powerVal<=0){state.powerVal=0;state.powerDir=1;} } $('power-fill').style.width=(state.powerVal*100)+'%'; if(state.phase==='power') powerRaf=requestAnimationFrame(animatePower); }
function animateAim(ts){ const dt=Math.min((ts-lastAimTime)/1000,0.05); lastAimTime=ts; state.aimVal=Math.max(0,Math.min(1,state.aimVal+state.aimDir*dt*2.2)); if(state.aimVal>=1||state.aimVal<=0) state.aimDir*=-1; $('aim-cursor').style.left=(state.aimVal*100)+'%'; if(state.phase==='aim') aimRaf=requestAnimationFrame(animateAim); }

const sBtn=$('shoot-btn');
function onBtnDown(e){ if(sBtn.disabled)return; if(e&&e.type!=='keydown')e.preventDefault(); if(state.phase==='card_select'&&state.selectedClub){$('cards-row').style.pointerEvents='none';startPowerMeter();} else if(state.phase==='aim')stopAim(); }
function onBtnUp(e){ if(e&&e.type!=='keyup')e.preventDefault(); if(state.phase==='power')stopPower(); }
sBtn.addEventListener('touchstart',onBtnDown,{passive:false}); sBtn.addEventListener('touchend',onBtnUp,{passive:false}); sBtn.addEventListener('mousedown',onBtnDown); window.addEventListener('mouseup',onBtnUp); window.addEventListener('keydown',(e)=>{if(e.code==='Space'&&!e.repeat)onBtnDown(e);}); window.addEventListener('keyup',(e)=>{if(e.code==='Space')onBtnUp(e);});

function updateReachDisplay() {
  if(!state.selectedClub) return $('d-reach').innerHTML='— m';
  const c=state.hand.find(x=>x.uid===state.selectedClub), b=state.selectedBall?state.hand.find(x=>x.uid===state.selectedBall):null;
  let d=Math.round((b?.effect==='power'?c.dist*1.25:c.dist)*(1-getLiePenalty(c,b,state.currentTerrain).pDist));
  $('d-reach').innerHTML=`~${d} m` + (getLiePenalty(c,b,state.currentTerrain).pDist>0?`<br><span style="color:var(--danger);font-size:9px;">Penalización Lie -${Math.round(getLiePenalty(c,b,state.currentTerrain).pDist*100)}%</span>`:'');
}

function executeShot() {
  state.phase='flight'; state.strokes++; $('h-strokes').textContent=state.strokes; updateShootBtnUI(); if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('hit');
  const c=state.hand.find(x=>x.uid===state.selectedClub), b=state.selectedBall?state.hand.find(x=>x.uid===state.selectedBall):null;
  const {pDist, pDevMulti} = getLiePenalty(c, b, state.currentTerrain);
  let sD=Math.round((b?.effect==='power'?c.dist*1.25:c.dist)*(1-pDist)*Math.max(0.05,Math.pow(state.powerVal,1.6)));
  const dx=state.target.x-state.ball.x, dy=state.target.y-state.ball.y, tPx=Math.hypot(dx,dy), dX=tPx===0?0:dx/tPx, dY=tPx===0?-1:dy/tPx, pX=-dY, pY=dX;
  let dev=0;
  if(!c.isPutt){
    dev=((state.aimVal-0.5)*2)*sD*(0.40*(1+state.holeData.difficulty*0.5)*pDevMulti);
    if(b?.effect!=='heavy'){ const wX=Math.cos(state.wind.dir)*state.wind.speed, wY=Math.sin(state.wind.dir)*state.wind.speed; dev+=(wX*pX+wY*pY)*(sD/100)*2.5; sD+=(wX*dX+wY*dY)*(sD/100)*2.0; sD=Math.max(5,sD); }
  }
  state.prevPos={x:state.ball.x, y:state.ball.y}; state.shotTerrain=state.currentTerrain;
  animateFlight(sD, dev, c, b, dX, dY, pX, pY);
}

function animateFlight(d, dev, c, b, dX, dY, pX, pY) {
  const hd=state.holeData, sX=state.ball.x, sY=state.ball.y, dPx=d*hd.scale, devPx=dev*hd.scale;
  const lX=sX+dX*dPx+pX*devPx, lY=sY+dY*dPx+pY*devPx, lT=getTerrain(lX,lY);
  let rM=d*0.20; if(lT==='green')rM*=0.8; else if(lT==='fairway')rM*=1.5; else if(lT==='semirough')rM*=0.6; else if(lT==='rough')rM*=0.3; else if(lT==='deeprough')rM*=0.15; else if(lT==='bunker'||lT==='agua')rM*=0.02;
  if(b?.effect==='fallstop')rM=0;
  const rPx=rM*hd.scale, rL=Math.hypot(dX*dPx+pX*devPx, dY*dPx+pY*devPx)||1, fDX=(dX*dPx+pX*devPx)/rL, fDY=(dY*dPx+pY*devPx)/rL;
  const fX=lX+fDX*rPx, fY=lY+fDY*rPx, aD=800+d*1.5, rD=Math.max(200,Math.abs(rM)*30);
  let aP='air', pS=performance.now(); state.ballAnim={trace:[{x:sX,y:sY}]};
  
  function frame(ts){
    const e=ts-pS;
    if(aP==='air') {
      const t=Math.min(e/aD,1), ease=t<0.5?2*t*t:-1+(4-2*t)*t, arcT=Math.sin(t*Math.PI);
      state.ball.x=sX+dX*(dPx*ease)+pX*(devPx*(ease*ease)); state.ball.y=sY+dY*(dPx*ease)+pY*(devPx*(ease*ease))-arcT*80*(d/200); state.ball.airR=5+(c.isPutt?0:arcT*(d>150?14:7));
      if(b?.effect==='power') addFire(state.ball.x,state.ball.y); if(b?.effect==='heavy') addRockTrail(state.ball.x,state.ball.y);
      state.ballAnim.trace.push({x:state.ball.x, y:state.ball.y}); if(state.ballAnim.trace.length>40) state.ballAnim.trace.shift();
      if(t>=1) { aP='roll'; pS=ts; state.ball.airR=5; if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('bounce'); }
    } else if(aP==='roll') {
      const t=Math.min(e/rD,1), ease=1-Math.pow(1-t,3), cx=lX+(fX-lX)*ease, cy=lY+(fY-lY)*ease, cT=getTerrain(cx,cy);
      if(cT==='agua') { if(b?.effect==='frog'){if(Math.random()<0.15)addRipple(cx,cy); state.ball.x=cx; state.ball.y=cy;} else{state.ball.x=cx; state.ball.y=cy; addRipple(cx,cy); if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('water'); endShot(false,'agua'); return;} }
      else if(cT==='bunker') { state.ball.x=cx; state.ball.y=cy; addDust(cx,cy); if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('sand'); endShot(false,'bunker'); return; }
      else { state.ball.x=cx; state.ball.y=cy; }
      state.ballAnim.trace.push({x:state.ball.x, y:state.ball.y}); if(state.ballAnim.trace.length>40) state.ballAnim.trace.shift();
      if(Math.hypot(state.ball.x-hd.holeX, state.ball.y-hd.holeY)<=10) { state.ball.x=hd.holeX; state.ball.y=hd.holeY; if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('hole'); endShot(true); return; }
      if(t>=1) { let fT=getTerrain(state.ball.x,state.ball.y); if(fT==='agua'){if(b?.effect==='frog')aP='frog_skip'; else{if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('water'); endShot(false,'agua'); return;}} else {endShot(false); return;} }
    } else if(aP==='frog_skip') {
        state.ball.x+=fDX*4; state.ball.y+=fDY*4; if(Math.random()<0.2) addRipple(state.ball.x, state.ball.y);
        state.ballAnim.trace.push({x:state.ball.x, y:state.ball.y}); if(state.ballAnim.trace.length>40) state.ballAnim.trace.shift();
        let sT=getTerrain(state.ball.x, state.ball.y); if(sT!=='agua') { endShot(false,sT); return; }
        if(state.ball.x<-200||state.ball.x>CW+200||state.ball.y<-200||state.ball.y>CH+200) { endShot(false,'ob'); return; }
    }
    drawBall(); drawUI(); drawVFX(ctxU); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function createMulliganUI() {
    let m = $('mulligan-overlay');
    if (!m) { m = document.createElement('div'); m.id='mulligan-overlay'; m.className='overlay'; m.style.zIndex=70; m.innerHTML=`<div class="msg-title" style="font-size:28px;" id="mul-title">¡Oh no!</div><div class="msg-sub">Tienes un ⏪ Mulligan en la mano. ¿Quieres gastarlo para rebobinar el tiempo y recuperar tu tiro (y las cartas gastadas)?</div><div style="display:flex; gap:10px; margin-top:10px;"><button class="msg-btn" id="mul-btn-no" style="background:var(--surface2); color:var(--text);">Penalización</button><button class="msg-btn" id="mul-btn-yes">Usar Mulligan</button></div>`; $('game').appendChild(m); }
    return m;
}

function endShot(iHE, fT) {
  const hd=state.holeData; state.distToHole=Math.hypot(state.ball.x-hd.holeX, state.ball.y-hd.holeY)/hd.scale;
  const t=fT||getTerrain(state.ball.x, state.ball.y);
  if(t==='ob'||t==='agua') {
      const mI=state.hand.findIndex(c=>c.effect==='mulligan'&&c.uid!==state.selectedBall);
      if(mI>-1) {
          const m=createMulliganUI(); $('mul-title').textContent=t==='agua'?"¡Al Agua!":"¡Fuera de Límites!"; $('logo-svg').style.display='none'; m.style.display='flex';
          $('mul-btn-no').onclick=()=>{ m.style.display='none'; applyPenalty(t); };
          $('mul-btn-yes').onclick=()=>{ m.style.display='none'; state.hand.splice(mI,1); state.ballAnim=null; state.ball.x=state.prevPos.x; state.ball.y=state.prevPos.y; state.strokes--; state.distToHole=Math.hypot(state.ball.x-hd.holeX, state.ball.y-hd.holeY)/hd.scale; state.itemLocked=false; vfxList=[]; drawCourse(); drawBall(); drawUI(); resetMetersUI(); state.phase='card_select'; updateShootBtnUI(); renderCards(); updateReachDisplay(); $('cards-row').style.pointerEvents='auto'; showToast("⏳ Tiempo rebobinado"); }; return;
      } else { applyPenalty(t); return; }
  }
  state.ballAnim=null; vfxList=[]; drawCourse(); drawBall(); drawUI(); resetMetersUI();
  if(iHE||state.distToHole<=3.0) setTimeout(()=>holeComplete(false),600); else if(state.strokes>=hd.par+5) setTimeout(()=>holeComplete(true),600); else finishTurn(t);
}

function applyPenalty(t) {
    const hd=state.holeData; state.ballAnim=null; vfxList=[]; state.ball.x=state.prevPos.x; state.ball.y=state.prevPos.y; state.strokes++; state.distToHole=Math.hypot(state.ball.x-hd.holeX, state.ball.y-hd.holeY)/hd.scale; drawCourse(); drawBall(); drawUI(); resetMetersUI();
    const m=$('msg-overlay'); $('logo-svg').style.display='none'; $('msg-title').textContent=t==='agua'?"AGUA":"FUERA DE LÍMITES"; $('msg-sub').textContent="Penalización: +1 golpe"; $('msg-btn').textContent='Continuar'; m.style.display='flex';
    $('msg-btn').onclick=()=>{ m.style.display='none'; if(state.strokes>=hd.par+5) holeComplete(true); else finishTurn(state.currentTerrain); };
}

function finishTurn(t) { discardPlayedCards(); drawCardsToHand(); state.phase='card_select'; state.powerHeld=false; state.itemLocked=false; state.currentTerrain=t; state.target={x:state.holeData.holeX, y:state.holeData.holeY}; autoSelectBestClub(); updateShootBtnUI(); $('d-pos').textContent={'green':'Green','fairway':'Fairway','semirough':'SemiRough','rough':'Rough','deeprough':'Deep Rough','bunker':'Bunker','ob':'Fuera','agua':'Agua','tee':'Tee'}[t]||'Fairway'; $('d-hole').textContent=Math.round(state.distToHole)+' m'; $('cards-row').style.pointerEvents='auto'; updateReachDisplay(); }

function startHole(idx) {
  if(idx>17) return showScorecard(false);
  state.paths={fairway:null, semirough:null, rough:null, ob:null}; state.cachedPattern=null; state.ballAnim=null; vfxList=[];
  state.hole=idx; state.strokes=0; state.selectedClub=null; state.selectedBall=null; state.itemLocked=false; state.phase='card_select'; state.currentTerrain='tee'; state.shotTerrain='tee';
  resizeCanvases(); state.holeData=generateHole(idx); state.ball={x:state.holeData.teeX, y:state.holeData.teeY, airR:5}; state.target={x:state.holeData.holeX, y:state.holeData.holeY}; state.distToHole=state.holeData.holeLength;
  $('h-hole').textContent=state.hole+1; $('h-par').textContent=state.holeData.par; $('h-strokes').textContent=0; $('d-hole').textContent=Math.round(state.distToHole)+' m'; $('d-pos').textContent='Tee';
  generateWind(); drawCardsToHand(); resetMetersUI(); autoSelectBestClub(); drawCourse(); drawBall(); drawUI(); updateShootBtnUI(); updateReachDisplay(); $('cards-row').style.pointerEvents='auto';
  if(typeof AudioEngine!=='undefined') AudioEngine.playBGM('game');
}

function holeComplete(max) {
  if(typeof AudioEngine !== 'undefined') AudioEngine.playBGM('menu'); 
  if(state.strokes>state.holeData.par+5) state.strokes=state.holeData.par+5;
  const d=state.strokes-state.holeData.par; state.totalScore+=d; state.scores.push({hole:state.hole+1, par:state.holeData.par, strokes:state.strokes, diff:d});
  $('h-score').textContent=state.totalScore===0?'E':(state.totalScore>0?'+'+state.totalScore:state.totalScore);
  let e=0; if(state.strokes===1)e+=450; else if(d===-3)e+=300; else if(d===-2)e+=225; else if(d===-1)e+=150; else if(d===0)e+=100; if(state.shotTerrain==='fairway')e+=50; state.money+=e; $('h-money').textContent=state.money;
  const n={'-3':'Albatross', '-2':'Eagle', '-1':'Birdie', '0':'Par', '1':'Bogey', '2':'Doble Bogey'}; const m=$('msg-overlay'); $('logo-svg').style.display='none';
  if(max){ $('msg-title').textContent="LÍMITE +5"; $('msg-sub').innerHTML=`Hoyo ${state.hole+1} — Límite superado.<br><br>Ganaste ${e} 🪙`; } 
  else if(state.strokes===1){ $('msg-title').textContent="¡HOLE IN ONE!"; $('msg-sub').innerHTML=`¡Tiro perfecto!<br><br>Ganaste ${e} 🪙`; if(typeof AudioEngine!=='undefined'){AudioEngine.stopBGM(); AudioEngine.playSFX('holeinone');} } 
  else { $('msg-title').textContent=n[String(d)]||(d>0?'+'+d:d); $('msg-sub').innerHTML=`Hoyo ${state.hole+1} en ${state.strokes} golpes.<br><br>Ganaste ${e} 🪙`; }
  $('msg-btn').textContent='Continuar'; m.style.display='flex';
  const oB=$('msg-btn'), nB=oB.cloneNode(true); oB.parentNode.replaceChild(nB,oB);
  nB.onclick=(ev)=>{
    ev.preventDefault(); $('msg-overlay').style.display='none'; discardPlayedCards();
    if(state.strokes===1 && typeof AudioEngine!=='undefined') AudioEngine.playBGM('menu'); 
    let q=[]; if(state.strokes===1) q.push((cb)=>grantReward(3,"¡Hole In One! 3 Cartas",cb)); else if(d<=-2) q.push((cb)=>showPickReward(2,cb)); else if(d===-1) q.push((cb)=>showPickReward(1,cb));
    if(state.hole===5||state.hole===11) q.push((cb)=>showShop(cb));
    function p(){ if(state.hole===8||state.hole===17) showScorecard(state.hole===8); else startHole(state.hole+1); }
    function r(){ if(q.length>0) q.shift()(r); else p(); } r();
  };
}

function showScorecard(mG) {
  $('score-title').textContent=mG?'Front 9 (Ida)':'Resultados Finales'; $('score-sub').textContent=`Score: ${state.totalScore===0?'E':state.totalScore>0?'+'+state.totalScore:state.totalScore}`;
  let h=`<div class="sc-header"><span>HOYO</span><span>PAR</span><span>GOLPES</span><span>SCORE</span></div>`, p=0, s=0;
  state.scores.forEach((x,i)=>{ p+=x.par; s+=x.strokes; h+=`<div class="sc-row"><span>#${i+1}</span><span>${x.par}</span><span>${x.strokes}</span><span style="color:${x.diff<0?'var(--accent)':x.diff>0?'var(--danger)':'var(--text-muted)'}">${x.diff===0?'E':x.diff>0?'+'+x.diff:x.diff}</span></div>`; if(i===8&&!mG) h+=`<div class="sc-row total" style="color:var(--text-muted); border-top:1px dashed rgba(255,255,255,0.1)"><span>IDA</span><span>${p}</span><span>${s}</span><span></span></div>`; });
  h+=`<div class="sc-row total"><span>${mG?'IDA':'TOTAL'}</span><span>${p}</span><span>${s}</span><span></span></div>`; $('score-table-wrap').innerHTML=h;
  $('score-btn').textContent=mG?'Continuar':'Nueva Partida'; $('score-overlay').style.display='flex';
  $('score-btn').onclick=()=>{ $('score-overlay').style.display='none'; if(mG) grantReward(3,"¡Front 9! 3 Cartas",()=>startHole(9)); else location.reload(); };
}

if($('mute-btn')) { $('mute-btn').onclick=()=>{ if(typeof AudioEngine!=='undefined'){ const m=AudioEngine.toggleMute(); $('mute-btn').textContent=m?'🔇':'🔊'; } }; }
if($('volume-slider')) { $('volume-slider').oninput=(e)=>{ if(typeof AudioEngine!=='undefined') AudioEngine.setVolume(parseFloat(e.target.value)); }; }

window.addEventListener('load', ()=>{
  resizeCanvases(); $('msg-warn').style.display='block'; $('version-text').style.display='block';
  $('msg-btn').onclick=()=>{ $('msg-overlay').style.display='none'; $('msg-warn').style.display='none'; $('version-text').style.display='none'; if(typeof AudioEngine!=='undefined') AudioEngine.playBGM('menu'); showDeckBuilder(); }
  $('msg-overlay').style.display='flex';
});