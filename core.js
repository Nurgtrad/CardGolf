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

function generateWind() { state.wind.speed=Math.random()*(4+state.holeData.difficulty*12); state.wind.dir=Math.random()*Math.PI*2; $('wind-text').innerHTML=state.wind.speed.toFixed(1)+'<br>m/s'; $('wind-arrow').style.transform=`rotate(${state.wind.dir}rad)`; $('flag-shape').setAttribute('points', `20,6 ${34+Math.cos(state.wind.dir)*Math.min(state.wind.speed/15,1)*8},${12+Math.min(state.wind.speed/15,1)*2} 20,18`); }

function generateMissions(par) {
  let count = par === 3 ? 1 : par === 4 ? 2 : 3;
  let avail = [...M_TYPES]; if(par !== 3) avail = avail.filter(m=>m.id!=='hio');
  
  if(!state.holeData.prizeZones || state.holeData.prizeZones.length === 0) avail = avail.filter(m=>m.id!=='prize');
  if(!state.holeData.sandTraps || state.holeData.sandTraps.length === 0) avail = avail.filter(m=>m.id!=='bunker');
  
  let myHandClubs = state.hand.filter(c => c.type === 'club' && !c.isPutt);
  let myClubNames = myHandClubs.map(c => c.name);

  if(myHandClubs.length === 0) {
      avail = avail.filter(m=>m.id!=='club' && m.id!=='drive');
  }

  state.missions = [];
  let hasUpgMission = false; // SOLUCIÓN: Flag para evitar múltiples misiones de mejoras
  
  for(let i=0; i<count; i++) {
     let currentAvail = avail.filter(m => {
         if (hasUpgMission && ['u0','u1','u2'].includes(m.id)) return false;
         return true;
     });
     
     if(currentAvail.length===0) break;
     
     let m = currentAvail.splice(Math.floor(Math.random()*currentAvail.length), 1)[0];
     avail = avail.filter(x => x.id !== m.id); // Elimina de la pool global
     
     if(['u0','u1','u2'].includes(m.id)) hasUpgMission = true;
     
     let val = null;
     if(m.id==='drive') {
         let maxDist = Math.max(150, ...myHandClubs.map(c=>c.dist));
         val = [maxDist - 30, maxDist - 15, maxDist][Math.floor(Math.random()*3)];
     }
     
     if(m.id==='club') val = myClubNames[Math.floor(Math.random()*myClubNames.length)];
     if(m.id==='score') { let s = par===3 ? ['Par','Birdie'] : par===4 ? ['Par','Birdie','Eagle'] : ['Par','Birdie','Eagle','Albatross']; val = s[Math.floor(Math.random()*s.length)]; }
     
     state.missions.push({ ...m, v: val, done: false });
  }
  renderMissions();
}

function renderMissions() {
  const p = $('missions-panel'); p.innerHTML='';
  state.missions.forEach(m => {
     const d=document.createElement('div'); d.className='mission-item'+(m.done?' done':'');
     d.innerHTML = (m.done?'✅ ':'⬜ ') + m.n(m.v); p.appendChild(d);
  });
}

function updateReachDisplay() {
  if(!state.selectedClub) { $('d-reach').innerHTML='— m'; return; }
  const c=state.hand.find(x=>x.uid===state.selectedClub);
  if(!c) { $('d-reach').innerHTML='— m'; return; }
  
  let bD = state.activeUpgrades.some(u=>u.id==='u_power'&&u.active) ? c.dist*1.25 : c.dist;
  let d=Math.round(bD*(1-getLiePenalty(c,state.currentTerrain).pDist));
  $('d-reach').innerHTML=`~${d} m` + (getLiePenalty(c,state.currentTerrain).pDist>0?`<br><span style="color:var(--danger);font-size:9px;">Penalización Lie -${Math.round(getLiePenalty(c,state.currentTerrain).pDist*100)}%</span>`:'');
}

function executeShot() {
  state.phase='flight'; state.strokes++; $('h-strokes').textContent=state.strokes; updateShootBtnUI(); if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('hit');
  const c=state.hand.find(x=>x.uid===state.selectedClub); const {pDist, pDevMulti} = getLiePenalty(c, state.currentTerrain);
  let bD = state.activeUpgrades.some(u=>u.id==='u_power'&&u.active) ? c.dist*1.25 : c.dist;
  let sD=Math.round(bD*(1-pDist)*Math.max(0.05,Math.pow(state.powerVal,1.6)));
  const dx=state.target.x-state.ball.x, dy=state.target.y-state.ball.y, tPx=Math.hypot(dx,dy), dX=tPx===0?0:dx/tPx, dY=tPx===0?-1:dy/tPx, pX=-dY, pY=dX;
  let dev=0;
  if(!c.isPutt){
    let fDev = state.activeUpgrades.some(u=>u.id==='u_control'&&u.active) ? 0.4 : 1.0;
    dev=((state.aimVal-0.5)*2)*sD*(0.40*(1+state.holeData.difficulty*0.5)*pDevMulti)*fDev;
    if(!state.activeUpgrades.some(u=>u.id==='u_heavy'&&u.active)){ const wX=Math.cos(state.wind.dir)*state.wind.speed, wY=Math.sin(state.wind.dir)*state.wind.speed; dev+=(wX*pX+wY*pY)*(sD/100)*2.5; sD+=(wX*dX+wY*dY)*(sD/100)*2.0; sD=Math.max(5,sD); }
  }
  
  if(c && c.dist >= 200) state.m_c200 = true;
  state.m_upgs += state.activeUpgrades.filter(u=>u.active).length;
  
  state.prevPos={x:state.ball.x, y:state.ball.y}; state.shotTerrain=state.currentTerrain; animateFlight(sD, dev, c, dX, dY, pX, pY);
}

function animateFlight(d, dev, c, dX, dY, pX, pY) {
  const hd=state.holeData, sX=state.ball.x, sY=state.ball.y, dPx=d*hd.scale, devPx=dev*hd.scale;
  const lX=sX+dX*dPx+pX*devPx, lY=sY+dY*dPx+pY*devPx, lT=getTerrain(lX,lY);
  let rM=d*0.20; if(lT==='green')rM*=0.8; else if(lT==='fairway')rM*=1.5; else if(lT==='semirough')rM*=0.6; else if(lT==='rough')rM*=0.3; else if(lT==='deeprough')rM*=0.15; else if(lT==='bunker'||lT==='agua')rM*=0.02;
  const rPx=rM*hd.scale, rL=Math.hypot(dX*dPx+pX*devPx, dY*dPx+pY*devPx)||1, fDX=(dX*dPx+pX*devPx)/rL, fDY=(dY*dPx+pY*devPx)/rL;
  const fX=lX+fDX*rPx, fY=lY+fDY*rPx, aD=800+d*1.5, rD=Math.max(200,Math.abs(rM)*30);
  let aP='air', pS=performance.now(); state.ballAnim={trace:[{x:sX,y:sY}]};
  
  function frame(ts){
    const e=ts-pS;
    if(aP==='air') {
      const t=Math.min(e/aD,1), ease=t<0.5?2*t*t:-1+(4-2*t)*t, arcT=Math.sin(t*Math.PI);
      state.ball.x=sX+dX*(dPx*ease)+pX*(devPx*(ease*ease)); state.ball.y=sY+dY*(dPx*ease)+pY*(devPx*(ease*ease))-arcT*80*(d/200); state.ball.airR=5+(c.isPutt?0:arcT*(d>150?14:7));
      if(state.activeUpgrades.some(u=>u.id==='u_power'&&u.active)) addFire(state.ball.x,state.ball.y); if(state.activeUpgrades.some(u=>u.id==='u_heavy'&&u.active)) addRockTrail(state.ball.x,state.ball.y);
      state.ballAnim.trace.push({x:state.ball.x, y:state.ball.y}); if(state.ballAnim.trace.length>40) state.ballAnim.trace.shift();
      if(t>=1) { aP='roll'; pS=ts; state.ball.airR=5; if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('bounce'); }
    } else if(aP==='roll') {
      const t=Math.min(e/rD,1), ease=1-Math.pow(1-t,3), cx=lX+(fX-lX)*ease, cy=lY+(fY-lY)*ease, cT=getTerrain(cx,cy);
      if(cT==='agua') { if(state.activeUpgrades.some(u=>u.id==='u_frog'&&u.active)){if(Math.random()<0.15)addRipple(cx,cy); state.ball.x=cx; state.ball.y=cy;} else{state.ball.x=cx; state.ball.y=cy; addRipple(cx,cy); if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('water'); endShot(false,'agua'); return;} }
      else if(cT==='bunker') { state.ball.x=cx; state.ball.y=cy; addDust(cx,cy); if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('sand'); endShot(false,'bunker'); return; }
      else { state.ball.x=cx; state.ball.y=cy; }
      state.ballAnim.trace.push({x:state.ball.x, y:state.ball.y}); if(state.ballAnim.trace.length>40) state.ballAnim.trace.shift();
      if(Math.hypot(state.ball.x-hd.holeX, state.ball.y-hd.holeY)<=10) { state.ball.x=hd.holeX; state.ball.y=hd.holeY; if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('hole'); endShot(true); return; }
      if(t>=1) { let fT=getTerrain(state.ball.x,state.ball.y); if(fT==='agua'){if(state.activeUpgrades.some(u=>u.id==='u_frog'&&u.active))aP='frog_skip'; else{if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('water'); endShot(false,'agua'); return;}} else {endShot(false); return;} }
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

function showDriveDistance(x, y, dist) {
    const el = document.createElement('div');
    el.textContent = `${dist}m`;
    el.style.cssText = `position:absolute; left:${x}px; top:${y-15}px; transform:translate(-50%,0); color:#fff; font-size:16px; font-weight:900; font-family:'DM Mono',monospace; text-shadow:0 2px 4px #000, 0 0 8px var(--accent); pointer-events:none; z-index:100; animation:floatUpFade 2.5s forwards;`;
    $('canvas-wrap').appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

function endShot(iHE, fT) {
  const hd=state.holeData; state.distToHole=Math.hypot(state.ball.x-hd.holeX, state.ball.y-hd.holeY)/hd.scale;
  const t=fT||getTerrain(state.ball.x, state.ball.y);
  
  if(t==='ob'||t==='agua') {
      const mul = state.activeUpgrades.find(u=>u.id==='u_mulligan' && u.uses > 0);
      if(mul) {
          const m=$('mulligan-overlay') || createMulliganUI(); $('mul-title').textContent=t==='agua'?"¡Al Agua!":"¡Fuera de Límites!"; $('logo-svg').style.display='none'; m.style.display='flex';
          $('mul-btn-no').onclick=()=>{ m.style.display='none'; applyPenalty(t); };
          $('mul-btn-yes').onclick=()=>{ 
              m.style.display='none'; mul.uses--; 
              state.m_upgs++; 
              renderUpgrades(); state.ballAnim=null; state.ball.x=state.prevPos.x; state.ball.y=state.prevPos.y; state.strokes--; state.distToHole=Math.hypot(state.ball.x-hd.holeX, state.ball.y-hd.holeY)/hd.scale; state.itemLocked=false; vfxList=[]; drawCourse(); drawBall(); drawUI(); resetMetersUI(); state.phase='card_select'; updateShootBtnUI(); renderCards(); updateReachDisplay(); $('cards-row').style.pointerEvents='auto'; showToast("⏳ Tiempo rebobinado"); 
              
              state.missions.forEach(ms => { if(!ms.done && ms.c && ms.c({ strokes:state.strokes, dist:0, pzHit:false, terr:'fairway', inHole:false, pTerr:'fairway', club:null, uUpg:state.m_upgs, m:ms })) { ms.done = true; showToast("Misión Completada"); renderMissions(); } });
          }; 
          return;
      } else { applyPenalty(t); return; }
  }

  state.ballAnim=null; vfxList=[]; drawCourse(); drawBall(); drawUI(); resetMetersUI();
  
  if(['bunker','agua','ob'].includes(t)) state.m_hz = true;
  let sD = Math.round(Math.hypot(state.ball.x - state.prevPos.x, state.ball.y - state.prevPos.y) / hd.scale);
  
  let delaySlot = 0;
  if (state.strokes === 1 && !['ob','agua'].includes(t)) {
      showDriveDistance(state.ball.x, state.ball.y, sD);
      delaySlot = 2500; // SOLUCIÓN: Esperar a que el texto desaparezca para abrir el Slot
  }

  let pZHit = null; let pZSpins = 0; let baseCash = 0;
  for(let pz of hd.prizeZones) {
      let d = Math.hypot(state.ball.x - pz.cx, state.ball.y - pz.cy);
      if(d <= pz.r3 + 5) { pZHit = pz; pZSpins = 3; baseCash = 150; break; }
      else if(d <= pz.r2 + 5) { pZHit = pz; pZSpins = 2; baseCash = 100; break; }
      else if(d <= pz.r1 + 5) { pZHit = pz; pZSpins = 1; baseCash = 50; break; }
  }

  state.missions.forEach(m => {
     if(!m.done && m.c && m.c({ strokes:state.strokes, dist:sD, pzHit:pZHit!==null, terr:t, inHole:iHE||state.distToHole<=3.0, pTerr:state.shotTerrain, club:state.hand.find(x=>x.uid===state.selectedClub)?.name, uUpg:state.m_upgs, m:m })) {
         m.done = true; showToast("Misión Completada"); renderMissions();
     }
  });

  const proceed = () => { if(iHE||state.distToHole<=3.0) setTimeout(()=>holeComplete(false),600); else if(state.strokes>=hd.par+5) setTimeout(()=>holeComplete(true),600); else finishTurn(t); };
  
  if(pZHit) {
      setTimeout(() => { showSlotMachine(pZSpins, baseCash, proceed); }, delaySlot);
  } else { 
      proceed(); 
  }
}

function applyPenalty(t) {
    const hd=state.holeData; state.ballAnim=null; vfxList=[]; state.ball.x=state.prevPos.x; state.ball.y=state.prevPos.y; state.strokes++; state.distToHole=Math.hypot(state.ball.x-hd.holeX, state.ball.y-hd.holeY)/hd.scale; drawCourse(); drawBall(); drawUI(); resetMetersUI(); state.m_hz = true;
    const m=$('msg-overlay'); $('logo-svg').style.display='none'; $('msg-title').textContent=t==='agua'?"AGUA":"FUERA DE LÍMITES"; $('msg-sub').textContent="Penalización: +1 golpe"; $('msg-btn').textContent='Continuar'; m.style.display='flex';
    $('msg-btn').onclick=()=>{ m.style.display='none'; if(state.strokes>=hd.par+5) holeComplete(true); else finishTurn(state.currentTerrain); };
}

function finishTurn(t) { 
    state.currentTerrain=t; 
    state.target={x:state.holeData.holeX, y:state.holeData.holeY}; 
    discardPlayedCards(); 
    drawCardsToHand(); 
    state.phase='card_select'; 
    state.powerHeld=false; 
    state.itemLocked=false; 
    autoSelectBestClub(); 
    updateShootBtnUI(); 
    $('d-pos').textContent={'green':'Green','fairway':'Fairway','semirough':'SemiRough','rough':'Rough','deeprough':'Deep Rough','bunker':'Bunker','ob':'Fuera','agua':'Agua','tee':'Tee'}[t]||'Fairway'; 
    $('d-hole').textContent=Math.round(state.distToHole)+' m'; 
    $('cards-row').style.pointerEvents='auto'; 
    updateReachDisplay(); 
}

function startHole(idx) {
  if(idx>17) return showScorecard(false);
  state.paths={fairway:null, semirough:null, rough:null, ob:null}; state.cachedPattern=null; state.ballAnim=null; vfxList=[];
  state.hole=idx; state.strokes=0; state.selectedClub=null; state.selectedBall=null; state.itemLocked=false; state.phase='card_select'; state.currentTerrain='tee'; state.shotTerrain='tee';
  state.m_hz=false; state.m_upgs=0; state.m_c200=false;
  resizeCanvases(); state.holeData=generateHole(idx); state.ball={x:state.holeData.teeX, y:state.holeData.teeY, airR:5}; state.target={x:state.holeData.holeX, y:state.holeData.holeY}; state.distToHole=state.holeData.holeLength;
  $('h-hole').textContent=state.hole+1; $('h-par').textContent=state.holeData.par; $('h-strokes').textContent=0; $('d-hole').textContent=Math.round(state.distToHole)+' m'; $('d-pos').textContent='Tee';
  
  generateWind(); 
  drawCardsToHand(); 
  generateMissions(state.holeData.par); 
  
  resetMetersUI(); autoSelectBestClub(); drawCourse(); drawBall(); drawUI(); updateShootBtnUI(); updateReachDisplay(); $('cards-row').style.pointerEvents='auto';
  if(typeof AudioEngine!=='undefined') AudioEngine.playBGM('game');
}

function holeComplete(max) {
  if(typeof AudioEngine !== 'undefined') AudioEngine.playBGM('menu'); 
  if(state.strokes>state.holeData.par+5) state.strokes=state.holeData.par+5;
  const d=state.strokes-state.holeData.par; state.totalScore+=d; state.scores.push({hole:state.hole+1, par:state.holeData.par, strokes:state.strokes, diff:d});
  $('h-score').textContent=state.totalScore===0?'E':(state.totalScore>0?'+'+state.totalScore:state.totalScore);
  let e=0; if(state.strokes===1)e+=450; else if(d===-3)e+=300; else if(d===-2)e+=225; else if(d===-1)e+=150; else if(d===0)e+=100; if(state.shotTerrain==='fairway')e+=50; state.money+=e; $('h-money').textContent=state.money;
  
  const ns={'-3':'Albatross', '-2':'Eagle', '-1':'Birdie', '0':'Par', '1':'Bogey', '2':'Doble Bogey'};
  let sN = ns[String(d)] || 'Otra';
  
  state.missions.forEach(m => { if(!m.done && m.cH && m.cH({ strokes:state.strokes, score:sN, uUpg:state.m_upgs, hz:state.m_hz, c200:state.m_c200, m:m })) m.done = true; }); renderMissions();
  let mDone = state.missions.filter(m=>m.done).length;
  let mTotal = state.missions.length;
  let allMissionsDone = mTotal > 0 && mDone === mTotal;

  const m=$('msg-overlay'); $('logo-svg').style.display='none';
  
  let baseTitle = max ? "LÍMITE +5" : (state.strokes===1 ? "¡HOLE IN ONE!" : (sN||(d>0?'+'+d:d)));
  $('msg-title').textContent = baseTitle;
  
  let resText = `Hoyo ${state.hole+1} en ${state.strokes} golpes.<br><br>Ganaste ${e} 🪙`;
  if (mTotal > 0) resText += `<br><br><span style="color:var(--accent2); font-size:15px; font-weight:bold;">Misiones completadas: ${mDone} / ${mTotal}</span>`;
  $('msg-sub').innerHTML = resText;

  $('msg-btn').textContent = allMissionsDone ? 'Recoger Recompensa Misión' : 'Continuar a Recompensas';
  m.style.display='flex';
  
  const oB=$('msg-btn'), nB=oB.cloneNode(true); oB.parentNode.replaceChild(nB,oB);
  nB.onclick=(ev)=>{
    ev.preventDefault(); $('msg-overlay').style.display='none'; discardPlayedCards();
    if(state.strokes===1 && typeof AudioEngine!=='undefined') AudioEngine.playBGM('menu'); 
    
    let q=[]; 
    if(allMissionsDone) q.push((cb) => showMissionReward(cb));
    if(state.strokes===1) q.push((cb)=>grantReward(3,"¡Hole In One! 3 Cartas",cb)); else if(d<=-2) q.push((cb)=>showPickReward(2,false,cb)); else if(d===-1) q.push((cb)=>showPickReward(1,false,cb));
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
