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

const cCourse = $('c-course'), cBall = $('c-ball'), cUI = $('c-ui');
let CW = 0, CH = 0, DPR = 1;
const ctxC = cCourse.getContext('2d'), ctxB = cBall.getContext('2d'), ctxU = cUI.getContext('2d');

function resizeCanvases() {
  CW = $('canvas-wrap').clientWidth; CH = $('canvas-wrap').clientHeight; DPR = window.devicePixelRatio || 1;
  [cCourse, cBall, cUI].forEach(c => { 
      c.width = CW * DPR; c.height = CH * DPR; 
      c.style.width = CW + 'px'; c.style.height = CH + 'px'; 
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

function getFairwayPattern(ctx) {
  if(state.cachedPattern) return state.cachedPattern;
  const pC = document.createElement('canvas'); pC.width=40; pC.height=40; const pCtx = pC.getContext('2d');
  pCtx.fillStyle='#315424'; pCtx.fillRect(0,0,40,40); pCtx.fillStyle='#2b4d1f';
  pCtx.beginPath(); pCtx.moveTo(-1,41); pCtx.lineTo(41,-1); pCtx.lineTo(41,20); pCtx.lineTo(19,41); pCtx.fill();
  pCtx.beginPath(); pCtx.moveTo(-1,21); pCtx.lineTo(21,-1); pCtx.lineTo(-1,-1); pCtx.fill();
  return state.cachedPattern = ctx.createPattern(pC, 'repeat');
}

function generateHole(holeIndex) {
  const W = CW, H = CH, par = HOLE_PARS[holeIndex], diff = holeIndex / 17;
  const teeY = H * 0.88, vLen = H * 0.72, lDist = par===3 ? 150+Math.random()*30 : par===4 ? 330+Math.random()*70 : 490+Math.random()*60, scale = vLen / lDist;
  const teeX = W/2, holeX = W/2 + (Math.random()-0.5)*W*(0.2 + diff*0.4), holeY = teeY - vLen;
  const dev1 = (Math.random()-0.5)*W*(0.15+diff*0.25), dev2 = (Math.random()-0.5)*W*(0.15+diff*0.25);
  const cp1x = W/2 + dev1, cp1y = teeY - vLen*(0.2 + Math.random()*0.2), cp2x = holeX + dev2, cp2y = teeY - vLen*(0.5 + Math.random()*0.3);
  const fwW = Math.max(45, 90 - diff*35) + Math.random()*20;
  const fN = { l1: Math.random()*6.28, l2: Math.random()*6.28, r1: Math.random()*6.28, r2: Math.random()*6.28, srL1: Math.random()*6.28, srL2: Math.random()*6.28, srR1: Math.random()*6.28, srR2: Math.random()*6.28 };
  const isSplit = par >= 4 && (Math.random() < 0.2 + diff * 0.3); let gST = 0.45 + Math.random()*0.1, gET = gST + 0.12 + Math.random()*0.08;

  let sT = []; for(let i=0;i<(par===3?1:2)+Math.floor(diff*4);i++) { const t = 0.15 + Math.random()*0.8; if (isSplit && t >= gST && t <= gET) continue; sT.push({ cx: bezierPoint(teeX,cp1x,cp2x,holeX,t)+(Math.random()-0.5)*(fwW+40), cy: bezierPoint(teeY,cp1y,cp2y,holeY,t)+(Math.random()-0.5)*20, rx: 15+Math.random()*15, ry: 10+Math.random()*10, angle: Math.random()*Math.PI }); }
  
  let riv = []; for(let i=0; i<(Math.random() < diff * 1.5 ? 1 : 0); i++) { let rt = 0.3 + Math.random()*0.4, cy = bezierPoint(teeY,cp1y,cp2y,holeY,rt), cx = bezierPoint(teeX,cp1x,cp2x,holeX,rt); riv.push({ cx, cy, rx1: cx - W/2 - Math.random()*50, ry1: cy + (Math.random()-0.5)*100, rx2: cx + W/2 + Math.random()*50, ry2: cy + (Math.random()-0.5)*100, width: 15+Math.random()*25 }); }
  let lk = []; for(let i=0; i<Math.floor(diff*3); i++) { const t = 0.2+Math.random()*0.6; lk.push({ cx: bezierPoint(teeX,cp1x,cp2x,holeX,t)+((Math.random()>0.5?1:-1)*(fwW*0.6+10+Math.random()*30)), cy: bezierPoint(teeY,cp1y,cp2y,holeY,t)+(Math.random()-0.5)*20, rx: 20+Math.random()*25, ry: 15+Math.random()*15, angle: Math.random()*Math.PI }); }
  
  const gR = Math.max(30, 50 - diff*15);
  let tr = []; for(let i=0; i<Math.floor(600+diff*400); i++) { let tx, ty, val = false, att = 0; while(!val && att < 20) { att++; if (tr.length > 0 && Math.random() < 0.6) { const s = tr[Math.floor(Math.random()*tr.length)]; tx = s.x+(Math.random()-0.5)*40; ty = s.y+(Math.random()-0.5)*40; } else { tx = (Math.random()-0.2)*W*1.4; ty = (Math.random()-0.2)*H*1.4; } if (Math.hypot(tx-teeX, ty-teeY) < 45 || Math.hypot(tx-holeX, ty-holeY) < gR+25) continue; let minD = Infinity; for(let t=0; t<=1; t+=0.05) minD = Math.min(minD, Math.hypot(tx-bezierPoint(teeX,cp1x,cp2x,holeX,t), ty-bezierPoint(teeY,cp1y,cp2y,holeY,t))); if (minD > fwW/2 + 25 || Math.random() < 0.02) val = true; } if(val) { let type = 'tree', r = Math.random(); if(r<0.3) type='pine'; else if(r<0.6) type='bush'; else if(r<0.75) type='flowers'; tr.push({x: tx, y: ty, r: 8 + Math.random()*12, type: type}); } } tr.sort((a,b) => a.y - b.y);

  let pZ = []; let nZ = Math.random() < 0.3 ? 2 : (Math.random() < 0.7 ? 1 : 0);
  for(let i=0; i<nZ; i++) {
      let val = false, cx, cy, att = 0;
      while(!val && att<40) {
          att++; let t = 0.2 + Math.random()*0.6; cx = bezierPoint(teeX,cp1x,cp2x,holeX,t) + (Math.random()-0.5)*(fwW*0.8); cy = bezierPoint(teeY,cp1y,cp2y,holeY,t) + (Math.random()-0.5)*20; val = true;
          for(let p of pZ) { if(Math.hypot(cx-p.cx, cy-p.cy) < 100 * scale) val = false; }
          for(let l of lk) { const nx=cx-l.cx, ny=cy-l.cy, rdx=nx*Math.cos(-l.angle)-ny*Math.sin(-l.angle), rdy=nx*Math.sin(-l.angle)+ny*Math.cos(-l.angle); if((rdx*rdx)/((l.rx+20)*(l.rx+20))+(rdy*rdy)/((l.ry+20)*(l.ry+20))<=1) val = false; }
          for(let r of riv) { if(Math.abs(cy - r.cy) < r.width + 40) val = false; }
          for(let s of sT) { const nx=cx-s.cx, ny=cy-s.cy, rdx=nx*Math.cos(-s.angle)-ny*Math.sin(-s.angle), rdy=nx*Math.sin(-s.angle)+ny*Math.cos(-s.angle); if((rdx*rdx)/((s.rx+20)*(s.rx+20))+(rdy*rdy)/((s.ry+20)*(s.ry+20))<=1) val = false; }
      }
      if(val) pZ.push({ cx, cy, r1: 18, r2: 12, r3: 6 });
  }

  return { par, holeLength: lDist, scale, difficulty: diff, teeX, teeY, holeX, holeY, cp1x, cp1y, cp2x, cp2y, fairwayW: fwW, sandTraps: sT, rivers: riv, lakes: lk, trees: tr, greenR: gR, prizeZones: pZ, fNoise: fN, isSplitHole: isSplit, gapStartT: gST, gapEndT: gET, obFlanks: { left: [], right: [] } };
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
            const bx = bezierPoint(hd.teeX, hd.cp1x, hd.cp2x, hd.holeX, tt), by = bezierPoint(hd.teeY, hd.cp1y, hd.cp2y, hd.holeY, tt);
            const dx = bezierTangent(hd.teeX, hd.cp1x, hd.cp2x, hd.holeX, tt), dy = bezierTangent(hd.teeY, hd.cp1y, hd.cp2y, hd.holeY, tt);
            const len = Math.hypot(dx, dy) || 1, nx = -dy/len, ny = dx/len, env = Math.sin((i/steps) * Math.PI), wP = 0.6 + tt * 0.4;
            const fwL = Math.max(5, (hd.fairwayW/2) * (1 + (Math.sin(tt*Math.PI*5+hd.fNoise.l1)*0.15 + Math.sin(tt*Math.PI*9+hd.fNoise.l2)*0.1)*env) * wP);
            const fwR = Math.max(5, (hd.fairwayW/2) * (1 + (Math.sin(tt*Math.PI*4+hd.fNoise.r1)*0.15 + Math.sin(tt*Math.PI*11+hd.fNoise.r2)*0.1)*env) * wP);
            const srW_L = 10 + Math.max(5, (hd.fairwayW*0.3)*(1+(Math.sin(tt*Math.PI*6+hd.fNoise.srL1)*0.2+Math.sin(tt*Math.PI*13+hd.fNoise.srL2)*0.1)*env));
            const srW_R = 10 + Math.max(5, (hd.fairwayW*0.3)*(1+(Math.sin(tt*Math.PI*5+hd.fNoise.srR1)*0.2+Math.sin(tt*Math.PI*15+hd.fNoise.srR2)*0.1)*env));
            const obL = (Math.sin(tt*Math.PI*3+hd.fNoise.l1)*40*env)+70, obR = (Math.sin(tt*Math.PI*2+hd.fNoise.r2)*40*env)+70;

            pts.fairway.l.push({x: bx+nx*fwL, y: by+ny*fwL}); pts.fairway.r.push({x: bx-nx*fwR, y: by-ny*fwR});
            pts.semirough.l.push({x: bx+nx*(fwL+srW_L), y: by+ny*(fwL+srW_L)}); pts.semirough.r.push({x: bx-nx*(fwR+srW_R), y: by-ny*(fwR+srW_R)});
            pts.rough.l.push({x: bx+nx*(fwL+srW_L+16), y: by+ny*(fwL+srW_L+16)}); pts.rough.r.push({x: bx-nx*(fwR+srW_R+16), y: by-ny*(fwR+srW_R+16)});
            pts.ob.l.push({x: bx+nx*(fwL+srW_L+obL), y: by+ny*(fwL+srW_L+obL)}); pts.ob.r.push({x: bx-nx*(fwR+srW_R+obR), y: by-ny*(fwR+srW_R+obR)});
            if (segments.length===1 || seg===segments[0] || seg===segments[1]) { hd.obFlanks.left.push({x: bx+nx*(fwL+srW_L+obL), y: by+ny*(fwL+srW_L+obL)}); hd.obFlanks.right.push({x: bx-nx*(fwR+srW_R+obR), y: by-ny*(fwR+srW_R+obR)}); }
        }

        ['fairway', 'semirough', 'rough', 'ob'].forEach(type => {
            if(pts[type].r.length === 0) return;
            const poly = pts[type]; paths[type].moveTo(poly.r[0].x, poly.r[0].y);
            for(let i=1; i<poly.r.length; i++) paths[type].lineTo(poly.r[i].x, poly.r[i].y);
            const bxEnd=bezierPoint(hd.teeX,hd.cp1x,hd.cp2x,hd.holeX,seg[1]), byEnd=bezierPoint(hd.teeY,hd.cp1y,hd.cp2y,hd.holeY,seg[1]);
            const dxEnd=bezierTangent(hd.teeX,hd.cp1x,hd.cp2x,hd.holeX,seg[1]), dyEnd=bezierTangent(hd.teeY,hd.cp1y,hd.cp2y,hd.holeY,seg[1]);
            paths[type].arc(bxEnd, byEnd, Math.max(0.1, Math.hypot(poly.l[poly.l.length-1].x - bxEnd, poly.l[poly.l.length-1].y - byEnd)), Math.atan2(dyEnd, dxEnd)+Math.PI/2, Math.atan2(dyEnd, dxEnd)-Math.PI/2, true);
            for(let i=poly.l.length-1; i>=0; i--) paths[type].lineTo(poly.l[i].x, poly.l[i].y);
            const bxSt=bezierPoint(hd.teeX,hd.cp1x,hd.cp2x,hd.holeX,seg[0]), bySt=bezierPoint(hd.teeY,hd.cp1y,hd.cp2y,hd.holeY,seg[0]);
            const dxSt=bezierTangent(hd.teeX,hd.cp1x,hd.cp2x,hd.holeX,seg[0]), dySt=bezierTangent(hd.teeY,hd.cp1y,hd.cp2y,hd.holeY,seg[0]);
            paths[type].arc(bxSt, bySt, Math.max(0.1, Math.hypot(poly.l[0].x - bxSt, poly.l[0].y - bySt)), Math.atan2(dySt, dxSt)-Math.PI/2, Math.atan2(dySt, dxSt)+Math.PI/2, true);
            paths[type].closePath();
        });
    }
    return paths;
}

function getTerrain(x, y) {
  try {
    const hd = state.holeData; if(!hd) return 'fairway';
    const px = x * DPR, py = y * DPR;
    if (Math.hypot(x - hd.holeX, y - hd.holeY) <= hd.greenR + 6) return 'green';
    for(let s of hd.sandTraps) { const nx=x-s.cx, ny=y-s.cy, rdx=nx*Math.cos(-s.angle)-ny*Math.sin(-s.angle), rdy=nx*Math.sin(-s.angle)+ny*Math.cos(-s.angle); if((rdx*rdx)/(s.rx*s.rx)+(rdy*rdy)/(s.ry*s.ry)<=1) return 'bunker'; }
    for (let l of hd.lakes) { const nx=x-l.cx, ny=y-l.cy, rdx=nx*Math.cos(-l.angle)-ny*Math.sin(-l.angle), rdy=nx*Math.sin(-l.angle)+ny*Math.cos(-l.angle); if((rdx*rdx)/(l.rx*l.rx)+(rdy*rdy)/(l.ry*l.ry)<=1) return 'agua'; }
    let inRiver = false; hd.rivers.forEach(r => { const p = new Path2D(); p.moveTo(r.rx1, r.ry1); p.quadraticCurveTo(r.cx, r.cy, r.rx2, r.ry2); ctxC.lineWidth = r.width; if(ctxC.isPointInStroke(p, px, py)) inRiver = true; });
    if(inRiver) return 'agua';
    if (state.paths.fairway && ctxC.isPointInPath(state.paths.fairway, px, py)) return 'fairway';
    if (state.paths.semirough && ctxC.isPointInPath(state.paths.semirough, px, py)) return 'semirough';
    if (state.paths.rough && ctxC.isPointInPath(state.paths.rough, px, py)) return 'rough';
    if (state.paths.ob && ctxC.isPointInPath(state.paths.ob, px, py)) return 'deeprough';
    return 'ob';
  } catch(e) { return 'fairway'; }
}

function drawCourse() {
  const W = CW, H = CH, hd = state.holeData; if(!hd) return;
  
  ctxC.fillStyle = '#111a0e'; ctxC.fillRect(0,0,W,H);
  state.paths = createTerrainPaths(hd);
  
  ctxC.lineWidth = hd.fairwayW * 2.8 + 40; ctxC.strokeStyle = '#1e3218'; ctxC.lineCap = 'round'; ctxC.lineJoin = 'round';
  ctxC.beginPath(); ctxC.moveTo(hd.teeX, hd.teeY); ctxC.bezierCurveTo(hd.cp1x, hd.cp1y, hd.cp2x, hd.cp2y, hd.holeX, hd.holeY); ctxC.stroke();
  
  ctxC.setLineDash([8,8]); ctxC.strokeStyle = 'rgba(255,255,255,0.4)'; ctxC.lineWidth = 2;
  if(hd.obFlanks.left.length) { ctxC.beginPath(); ctxC.moveTo(hd.obFlanks.left[0].x, hd.obFlanks.left[0].y); for(let i=1; i<hd.obFlanks.left.length; i++) ctxC.lineTo(hd.obFlanks.left[i].x, hd.obFlanks.left[i].y); ctxC.stroke(); }
  if(hd.obFlanks.right.length) { ctxC.beginPath(); ctxC.moveTo(hd.obFlanks.right[0].x, hd.obFlanks.right[0].y); for(let i=1; i<hd.obFlanks.right.length; i++) ctxC.lineTo(hd.obFlanks.right[i].x, hd.obFlanks.right[i].y); ctxC.stroke(); }
  ctxC.setLineDash([]);
  
  ctxC.fillStyle = '#162312'; for(let i=0; i<1500; i++) { let x=Math.random()*W, y=Math.random()*H, t=getTerrain(x,y); if(t==='rough'||t==='semirough'||t==='deeprough') ctxC.fillRect(x,y,3,2); }
  
  if(state.paths.rough) { ctxC.fillStyle='#1e3218'; ctxC.fill(state.paths.rough); }
  if(state.paths.semirough) { ctxC.fillStyle='#223d1b'; ctxC.fill(state.paths.semirough); }
  if(state.paths.fairway) { ctxC.fillStyle=getFairwayPattern(ctxC)||'#2b4d1f'; ctxC.fill(state.paths.fairway); }
  
  ctxC.strokeStyle = '#1c3d5a'; ctxC.lineCap = 'round';
  hd.rivers.forEach(r => { 
      ctxC.lineWidth = r.width; ctxC.beginPath(); ctxC.moveTo(r.rx1, r.ry1); ctxC.quadraticCurveTo(r.cx, r.cy, r.rx2, r.ry2); ctxC.stroke(); 
      ctxC.lineWidth = 1; ctxC.strokeStyle='#2b5f8c'; ctxC.beginPath(); ctxC.moveTo(r.cx-10, r.cy-5); ctxC.lineTo(r.cx+10, r.cy+5); ctxC.stroke(); ctxC.strokeStyle = '#1c3d5a'; 
  });
  hd.lakes.forEach(l => { ctxC.save(); ctxC.translate(l.cx, l.cy); ctxC.rotate(l.angle); ctxC.fillStyle='#1c3d5a'; ctxC.beginPath(); ctxC.ellipse(0,0,Math.max(0.1,l.rx),Math.max(0.1,l.ry),0,0,Math.PI*2); ctxC.fill(); ctxC.strokeStyle='#2b5f8c'; ctxC.lineWidth=1; ctxC.beginPath(); ctxC.moveTo(-l.rx*0.5,0); ctxC.lineTo(l.rx*0.5,0); ctxC.stroke(); ctxC.beginPath(); ctxC.moveTo(-l.rx*0.3,l.ry*0.4); ctxC.lineTo(l.rx*0.3,l.ry*0.4); ctxC.stroke(); ctxC.restore(); });
  hd.sandTraps.forEach(s => { ctxC.save(); ctxC.translate(s.cx, s.cy); ctxC.rotate(s.angle); ctxC.fillStyle='#5c4d24'; ctxC.beginPath(); ctxC.ellipse(0,0,Math.max(0.1,s.rx+4),Math.max(0.1,s.ry+4),0,0,Math.PI*2); ctxC.fill(); ctxC.fillStyle='#c2a86b'; ctxC.beginPath(); ctxC.ellipse(0,0,Math.max(0.1,s.rx),Math.max(0.1,s.ry),0,0,Math.PI*2); ctxC.fill(); ctxC.fillStyle='#a68f56'; for(let i=0;i<20;i++){ let a=Math.random()*Math.PI*2, r=Math.random(); ctxC.fillRect(Math.cos(a)*s.rx*r, Math.sin(a)*s.ry*r, 3,1.5); } ctxC.restore(); });
  
  hd.prizeZones.forEach(pz => { 
      ctxC.fillStyle='rgba(255,255,255,0.7)'; ctxC.beginPath(); ctxC.arc(pz.cx,pz.cy,pz.r1,0,Math.PI*2); ctxC.fill(); 
      ctxC.fillStyle='rgba(232,72,50,0.8)'; ctxC.beginPath(); ctxC.arc(pz.cx,pz.cy,pz.r2,0,Math.PI*2); ctxC.fill(); 
      ctxC.fillStyle='rgba(255,255,255,0.9)'; ctxC.beginPath(); ctxC.arc(pz.cx,pz.cy,pz.r3,0,Math.PI*2); ctxC.fill(); 
  });

  const gx=hd.holeX, gy=hd.holeY, gr=hd.greenR;
  ctxC.fillStyle='#224a1e'; ctxC.beginPath(); ctxC.arc(gx,gy,Math.max(0.1,gr+6),0,Math.PI*2); ctxC.fill();
  ctxC.fillStyle='#32702c'; ctxC.beginPath(); ctxC.arc(gx,gy,Math.max(0.1,gr),0,Math.PI*2); ctxC.fill();
  ctxC.fillStyle='#000'; ctxC.beginPath(); ctxC.arc(gx,gy,7,0,Math.PI*2); ctxC.fill();
  ctxC.strokeStyle='#e0e0e0'; ctxC.lineWidth=1.5; ctxC.beginPath(); ctxC.moveTo(gx,gy); ctxC.lineTo(gx,gy-32); ctxC.stroke();
  ctxC.fillStyle='#e84832'; ctxC.beginPath(); ctxC.moveTo(gx,gy-32); ctxC.lineTo(gx+18,gy-26); ctxC.lineTo(gx,gy-20); ctxC.fill();
  ctxC.fillStyle='#173614'; ctxC.beginPath(); ctxC.ellipse(hd.teeX, hd.teeY, 26, 14, 0, 0, Math.PI*2); ctxC.fill();
  ctxC.fillStyle='#ffffff'; ctxC.beginPath(); ctxC.arc(hd.teeX-12, hd.teeY, 2.5, 0, Math.PI*2); ctxC.fill(); ctxC.beginPath(); ctxC.arc(hd.teeX+12, hd.teeY, 2.5, 0, Math.PI*2); ctxC.fill();
  
  hd.trees.forEach(t => { 
      if(t.type === 'tree') { ctxC.fillStyle='#3a2a18'; ctxC.fillRect(t.x-2, t.y, 4, 12); ctxC.fillStyle='rgba(0,0,0,0.3)'; ctxC.beginPath(); ctxC.ellipse(t.x, t.y+10, Math.max(0.1,t.r*0.8), Math.max(0.1,t.r*0.4), 0, 0, Math.PI*2); ctxC.fill(); ctxC.fillStyle='#1e3d22'; ctxC.beginPath(); ctxC.arc(t.x, t.y, Math.max(0.1,t.r), 0, Math.PI*2); ctxC.fill(); ctxC.fillStyle='#27522c'; ctxC.beginPath(); ctxC.arc(t.x-t.r*0.2, t.y-t.r*0.2, Math.max(0.1,t.r*0.7), 0, Math.PI*2); ctxC.fill(); } 
      else if (t.type === 'pine') { ctxC.fillStyle='rgba(0,0,0,0.3)'; ctxC.beginPath(); ctxC.ellipse(t.x, t.y+10, Math.max(0.1,t.r*0.7), Math.max(0.1,t.r*0.3), 0, 0, Math.PI*2); ctxC.fill(); ctxC.fillStyle='#152e18'; ctxC.beginPath(); ctxC.moveTo(t.x-t.r, t.y+6); ctxC.lineTo(t.x+t.r, t.y+6); ctxC.lineTo(t.x, t.y-t.r*1.5); ctxC.fill(); ctxC.fillStyle='#1e4022'; ctxC.beginPath(); ctxC.moveTo(t.x-t.r*0.5, t.y+6); ctxC.lineTo(t.x, t.y+6); ctxC.lineTo(t.x, t.y-t.r*1.5); ctxC.fill(); } 
      else if (t.type === 'bush') { ctxC.fillStyle='rgba(0,0,0,0.2)'; ctxC.beginPath(); ctxC.ellipse(t.x, t.y+5, Math.max(0.1,t.r), Math.max(0.1,t.r*0.4), 0, 0, Math.PI*2); ctxC.fill(); ctxC.fillStyle='#2a4724'; ctxC.beginPath(); ctxC.arc(t.x-t.r*0.3, t.y, Math.max(0.1,t.r*0.6), 0, Math.PI*2); ctxC.fill(); ctxC.beginPath(); ctxC.arc(t.x+t.r*0.4, t.y-t.r*0.2, Math.max(0.1,t.r*0.7), 0, Math.PI*2); ctxC.fill(); ctxC.beginPath(); ctxC.arc(t.x, t.y-t.r*0.4, Math.max(0.1,t.r*0.5), 0, Math.PI*2); ctxC.fill(); ctxC.fillStyle='#36592e'; ctxC.beginPath(); ctxC.arc(t.x+t.r*0.1, t.y-t.r*0.2, Math.max(0.1,t.r*0.4), 0, Math.PI*2); ctxC.fill(); } 
      else if (t.type === 'flowers') { ctxC.fillStyle='#2a4724'; ctxC.beginPath(); ctxC.arc(t.x, t.y, Math.max(0.1,t.r*0.5), 0, Math.PI*2); ctxC.fill(); const cols = ['#d4a832', '#e84832', '#a8d878', '#fff']; ctxC.fillStyle=cols[Math.abs(Math.floor(t.x))%cols.length]; for(let j=0;j<3;j++){ ctxC.beginPath(); ctxC.arc(t.x+(Math.random()-0.5)*t.r*0.8, t.y+(Math.random()-0.5)*t.r*0.8, 1.5, 0, Math.PI*2); ctxC.fill(); } }
  });
}

function drawBall() {
  ctxB.clearRect(0,0,CW,CH); const b=state.ball, r=b.airR||5;
  ctxB.fillStyle='rgba(0,0,0,0.4)'; ctxB.beginPath(); ctxB.ellipse(b.x, b.y+(r*0.5), r*0.8, r*0.25, 0,0,Math.PI*2); ctxB.fill();
  ctxB.fillStyle='#fff'; ctxB.beginPath(); ctxB.arc(b.x, b.y, Math.max(0.1, r), 0,Math.PI*2); ctxB.fill();
}

function drawUI() {
  ctxU.clearRect(0,0,CW,CH);
  if(state.phase==='card_select' && state.target) {
    const dx=state.target.x-state.ball.x, dy=state.target.y-state.ball.y, ang=Math.atan2(dy,dx), tPx=Math.hypot(dx,dy);
    let mRx=Infinity, oR=false;
    if(state.selectedClub) {
        const cl=state.hand.find(c=>c.uid===state.selectedClub);
        if(cl) {
            let cD=Math.round((state.activeUpgrades.some(u=>u.id==='u_power'&&u.active)?cl.dist*1.25:cl.dist) * (1-getLiePenalty(cl,state.currentTerrain).pDist));
            mRx=cD*state.holeData.scale; oR=tPx>mRx;
        }
    }
    ctxU.fillStyle='rgba(255,255,255,0.8)'; ctxU.beginPath(); ctxU.arc(state.target.x,state.target.y,2.5,0,Math.PI*2); ctxU.fill();
    ctxU.strokeStyle=oR?'rgba(232,72,50,0.6)':'rgba(255,255,255,0.6)'; ctxU.lineWidth=1.5; ctxU.beginPath(); ctxU.moveTo(state.target.x-7,state.target.y-7); ctxU.lineTo(state.target.x+7,state.target.y+7); ctxU.moveTo(state.target.x+7,state.target.y-7); ctxU.lineTo(state.target.x-7,state.target.y+7); ctxU.stroke();
    if(oR) { const rX=state.ball.x+Math.cos(ang)*mRx, rY=state.ball.y+Math.sin(ang)*mRx; ctxU.beginPath(); ctxU.arc(rX,rY,2.5,0,Math.PI*2); ctxU.fill(); ctxU.strokeStyle='rgba(255,255,255,0.6)'; ctxU.beginPath(); ctxU.moveTo(rX-7,rY-7); ctxU.lineTo(rX+7,rY+7); ctxU.moveTo(rX+7,rY-7); ctxU.lineTo(rX-7,rY+7); ctxU.stroke(); }
    ctxU.lineWidth=3; ctxU.strokeStyle='rgba(0,0,0,0.6)'; ctxU.beginPath(); ctxU.moveTo(state.ball.x,state.ball.y); ctxU.lineTo(state.ball.x+Math.cos(ang)*40,state.ball.y+Math.sin(ang)*40); ctxU.stroke();
    ctxU.lineWidth=1.5; ctxU.strokeStyle=['rough','semirough','deeprough','bunker'].includes(state.currentTerrain)?'rgba(232,72,50,0.9)':'rgba(255,255,255,0.9)'; ctxU.beginPath(); ctxU.moveTo(state.ball.x,state.ball.y); ctxU.lineTo(state.ball.x+Math.cos(ang)*40,state.ball.y+Math.sin(ang)*40); ctxU.stroke();
  }
  if(state.phase==='flight' && state.ballAnim?.trace.length>1) {
    const t=state.ballAnim.trace;
    if(state.activeUpgrades.some(u=>u.id==='u_power'&&u.active)) { for(let i=1;i<t.length;i++){ let a=i/t.length; ctxU.strokeStyle=`rgba(255,${Math.floor(150*a)},0,${a})`; ctxU.lineWidth=1+(a*3); ctxU.beginPath(); ctxU.moveTo(t[i-1].x,t[i-1].y); ctxU.lineTo(t[i].x+(Math.random()-0.5)*4,t[i].y+(Math.random()-0.5)*4); ctxU.stroke(); } }
    else { ctxU.strokeStyle='rgba(255,255,255,0.4)'; ctxU.lineWidth=1.5; ctxU.setLineDash([3,5]); ctxU.beginPath(); ctxU.moveTo(t[0].x,t[0].y); for(let i=1;i<t.length;i++) ctxU.lineTo(t[i].x,t[i].y); ctxU.stroke(); ctxU.setLineDash([]); }
  }
  updatePowerMark();
}

function updatePowerMark() {
  let m=$('power-mark'); if(!m){ m=document.createElement('div'); m.id='power-mark'; m.style.cssText='display:none;position:absolute;top:-2px;bottom:-2px;width:3px;background:#fff;z-index:5;transform:translateX(-50%);border-radius:2px;box-shadow:0 0 5px rgba(255,255,255,0.8);pointer-events:none;'; $('power-track').appendChild(m); }
  if(state.phase!=='card_select'||!state.selectedClub||!state.target) return m.style.display='none';
  const c=state.hand.find(x=>x.uid===state.selectedClub); if(!c||c.isPutt) return m.style.display='none';
  let bD=state.activeUpgrades.some(u=>u.id==='u_power'&&u.active)?c.dist*1.25:c.dist, cD=Math.round(bD*(1-getLiePenalty(c,state.currentTerrain).pDist)), tPx=Math.hypot(state.target.x-state.ball.x, state.target.y-state.ball.y);
  if(tPx < cD*state.holeData.scale - 2 && tPx > 0) { m.style.left = (Math.max(0,Math.min(1,Math.pow((tPx/state.holeData.scale)/cD, 1/1.6)))*100)+'%'; m.style.display='block'; } else m.style.display='none';
}

function resetMetersUI() { $('power-fill').style.width='0%'; $('aim-cursor').style.left='50%'; }
function updateShootBtnUI() { const b=$('shoot-btn'); if(state.phase==='card_select'){b.disabled=!state.selectedClub;b.textContent=state.selectedClub?'MANTENER':'GOLPEAR';}else if(state.phase==='power'){b.disabled=false;b.textContent='SOLTAR';}else if(state.phase==='aim'){b.disabled=false;b.textContent='PULSAR';}else{b.disabled=true;b.textContent='...';} }

function autoSelectBestClub() {
  let bC = null, mD = Infinity;
  state.hand.forEach(c => { if(c.type === 'club') { if(state.currentTerrain === 'green') { if(c.isPutt) bC = c; } else if (!c.isPutt) { let d = Math.abs(c.dist - state.distToHole); if (d < mD) { mD = d; bC = c; } } } });
  if(bC) { state.selectedClub = bC.uid; renderCards(); updateShootBtnUI(); updateReachDisplay(); drawUI(); }
}