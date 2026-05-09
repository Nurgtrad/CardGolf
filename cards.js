function initDeck() { 
    state.drawPile=[]; state.hand=[]; state.money=0; state.gems=[]; state.activeUpgrades=[];
    CLUBS_POOL.forEach(c => state.drawPile.push(cloneCard(c))); 
    for(const[id,c] of Object.entries(state.upgradesConfig)) { if(c > 0) { let t = UPGRADES_POOL.find(x=>x.id===id); if(t) state.activeUpgrades.push({...t, uses:3, active:false}); } }
    shuffle(state.drawPile); $('h-money').textContent=state.money; renderUpgrades();
}

function renderUpgrades() {
    const bar = $('upgrades-bar'); bar.innerHTML = '';
    state.activeUpgrades.forEach(u => {
        const btn = document.createElement('div'); btn.className = 'upgrade-btn' + (u.active ? ' active' : '') + (u.uses === 0 ? ' empty' : '');
        btn.innerHTML = `${u.icon}<div class="upgrade-uses">${u.uses}</div>`;
        btn.onclick = () => { if(state.phase !== 'card_select' || u.uses === 0) return; u.active = !u.active; renderUpgrades(); updateShootBtnUI(); updateReachDisplay(); drawUI(); };
        bar.appendChild(btn);
    });
}

function drawCardsToHand() {
  if(!state.holeData) return;
  const sHP = state.currentTerrain === 'green';
  if(sHP && typeof AudioEngine!=='undefined') AudioEngine.playBGM('tension');
  
  const ePI = state.hand.findIndex(c=>c.isPutt); 
  if(!sHP && ePI !== -1) state.hand.splice(ePI,1); 
  
  while(state.hand.length < 5) { if(!state.drawPile.length) break; state.hand.push(state.drawPile.pop()); }
  if(sHP && ePI === -1){ state.hand.push(cloneCard(PUTTER_CARD)); }
  
  if(!state.hand.some(c=>c.type==='club') && !sHP && state.hand.length>0) return state.drawPile.some(c=>c.type==='club') ? showSoftlockOverlay() : $('gameover-overlay').style.display='flex';
  if(!state.hand.length && !state.drawPile.length) return $('gameover-overlay').style.display='flex';
  $('deck-count').textContent=state.drawPile.length; renderCards();
}

function discardPlayedCards() { 
    state.hand=state.hand.filter(c=>c.uid!==state.selectedClub); state.selectedClub=null; 
    state.activeUpgrades.forEach(u => { if(u.active && u.id !== 'u_mulligan') { u.uses--; u.active=false; } }); renderUpgrades();
}

function renderCards() {
  $('cards-row').innerHTML='';
  state.hand.forEach(c => {
    let d = (state.currentTerrain==='green'&&!c.isPutt);
    const div=document.createElement('div'); div.className='card'+(d?' disabled':'')+(state.selectedClub===c.uid?' selected':'');
    if(d) div.style.cssText='opacity:0.3;pointer-events:none;';
    div.innerHTML=`<span class="card-type">Palo</span><div class="card-icon">${c.icon}</div><div class="card-name">${c.name}</div><div class="card-dist">~${c.dist}m</div>`;
    div.onclick=() => { if(state.phase!=='card_select'||d) return; state.selectedClub=state.selectedClub===c.uid?null:c.uid; renderCards(); updateShootBtnUI(); updateReachDisplay(); drawUI(); };
    $('cards-row').appendChild(div);
  });
}

function showDeckBuilder() {
  $('deck-overlay').style.display='flex'; state.upgradesConfig={}; let tU=0; $('deck-btn').disabled=true;
  
  $('deck-grid').innerHTML = `
      <div style="width:100%; text-align:center; font-weight:bold; color:var(--text-muted); margin-bottom:5px; font-size:12px; letter-spacing:0.1em; text-transform:uppercase;">Tus Palos Base</div>
      <div id="db-clubs" style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center; width:100%;"></div>
      <div style="width:100%; border-bottom: 2px dashed var(--border); margin: 15px 0;"></div>
      <div style="width:100%; text-align:center; font-weight:bold; color:var(--accent2); margin-bottom:5px; font-size:14px; letter-spacing:0.1em; text-transform:uppercase;">Elige tus Mejoras</div>
      <div id="db-upgrades" style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; width:100%;"></div>
  `;

  const clubsContainer = $('db-clubs');
  const upgradesContainer = $('db-upgrades');

  CLUBS_POOL.forEach(c => {
    const div=document.createElement('div'); div.className='card'; 
    div.style.opacity = '0.5'; div.style.transform = 'scale(0.85)'; div.style.pointerEvents = 'none'; div.style.margin = '-4px';
    div.innerHTML=`<span class="card-type">Palo</span><div class="card-icon">${c.icon}</div><div class="card-name">${c.name}</div><div class="card-dist">~${c.dist}m</div>`;
    clubsContainer.appendChild(div);
  });

  UPGRADES_POOL.forEach(c => {
    state.upgradesConfig[c.id]=0; 
    const div=document.createElement('div'); div.className='card upgrade-card';
    div.innerHTML=`<div class="card-badge" style="display:none"></div><div class="card-icon">${c.icon}</div><div class="card-name">${c.name}</div><div class="card-dist" style="font-size:12px; color:var(--text)">3 Usos</div>${c.desc?`<div class="card-tooltip">${c.desc}</div>`:''}`;
    
    div.onclick=() => {
      document.querySelectorAll('.card').forEach(x=>x.classList.remove('show-tooltip')); 
      if(c.desc){ div.classList.add('show-tooltip'); setTimeout(()=>div.classList.remove('show-tooltip'),2500); }
      
      let n = state.upgradesConfig[c.id];
      if (n === 1) { state.upgradesConfig[c.id] = 0; tU--; } else if (n === 0 && tU < MAX_UPGRADES) { state.upgradesConfig[c.id] = 1; tU++; }
      
      const badge = div.querySelector('.card-badge');
      if (state.upgradesConfig[c.id] > 0) { div.classList.add('selected'); badge.style.display='flex'; badge.textContent='✔'; } else { div.classList.remove('selected'); badge.style.display='none'; }
      
      $('deck-counter').textContent=`Mejoras: ${tU} / ${MAX_UPGRADES}`; 
      $('deck-btn').disabled=!(tU===MAX_UPGRADES);
    }; 
    upgradesContainer.appendChild(div);
  });
  
  $('deck-btn').onclick=()=>{ $('deck-overlay').style.display='none'; initDeck(); startHole(0); };
}

function showSoftlockOverlay() {
  const o=$('softlock-overlay'), c=$('softlock-cards'), b=$('softlock-btn'); c.innerHTML=''; let s=new Set();
  state.hand.forEach(x => {
    const div=document.createElement('div'); div.className='card'; div.innerHTML=`<span class="card-type">Palo</span><div class="card-icon">${x.icon}</div><div class="card-name">${x.name}</div><div class="card-dist">~${x.dist}m</div>`;
    div.onclick=()=>{ if(s.has(x.uid)){s.delete(x.uid);div.classList.remove('to-return');}else{s.add(x.uid);div.classList.add('to-return');} b.disabled=!s.size; }; c.appendChild(div);
  });
  b.disabled=true; o.style.display='flex';
  b.onclick=()=>{ o.style.display='none'; state.hand.filter(x=>s.has(x.uid)).forEach(x=>state.drawPile.push(x)); state.hand=state.hand.filter(x=>!s.has(x.uid)); shuffle(state.drawPile); drawCardsToHand(); };
}

function grantReward(n, t, cb) {
    $('reward-title').textContent=t; $('reward-cards').innerHTML='';
    for(let i=0;i<n;i++){ 
        const c=cloneCard(CLUBS_POOL[Math.floor(Math.random()*CLUBS_POOL.length)]); state.drawPile.push(c); 
        const d=document.createElement('div'); d.className='card'; d.innerHTML=`<span class="card-type">Palo</span><div class="card-icon">${c.icon}</div><div class="card-name">${c.name}</div><div class="card-dist">~${c.dist}m</div>`; $('reward-cards').appendChild(d); 
    }
    shuffle(state.drawPile); $('reward-overlay').style.display='flex'; $('reward-btn').onclick=()=>{ $('reward-overlay').style.display='none'; if(cb)cb(); };
}

function showPickReward(n, clubsOnly, cb) {
    $('pick-title').textContent=clubsOnly?"¡Recompensa de Misión!":(n>1?"¡Eagle o Mejor!":"¡Birdie!"); $('pick-sub').textContent=`Elige ${n} palo de los 3.`; $('pick-cards').innerHTML=''; let pL=n; $('pick-btn').disabled=true;
    let pool = [...CLUBS_POOL];
    for(let i=0;i<3;i++){
        let c = pool.splice(Math.floor(Math.random()*pool.length), 1)[0];
        const d=document.createElement('div'); d.className='card face-down';
        const bD=document.createElement('div'); bD.style.cssText='font-size:30px;'; bD.textContent='❓';
        const fD=document.createElement('div'); fD.style.cssText='display:none;flex-direction:column;align-items:center;'; fD.innerHTML=`<span class="card-type">Palo</span><div class="card-icon">${c.icon}</div><div class="card-name">${c.name}</div><div class="card-dist">~${c.dist}m</div>`;
        d.append(bD, fD); let f=false;
        d.onclick=()=>{ if(!f&&pL>0){ f=true; pL--; d.classList.remove('face-down'); bD.style.display='none'; fD.style.display='flex'; state.drawPile.push(cloneCard(c)); if(!pL)$('pick-btn').disabled=false; } };
        $('pick-cards').appendChild(d);
    }
    $('pick-reward-overlay').style.display='flex'; $('pick-btn').onclick=()=>{ $('pick-reward-overlay').style.display='none'; shuffle(state.drawPile); if(cb)cb(); };
}

// NUEVA FUNCIÓN: PANTALLA EXCLUSIVA PARA MISIONES COMPLETADAS
function showMissionReward(cb) {
    const par = state.holeData.par;
    $('mission-reward-overlay').style.display = 'flex';
    $('mr-pick-cards').innerHTML = '';
    $('mr-extra-rewards').innerHTML = '';
    $('mr-btn').disabled = true;

    // Generar 3 Palos Boca Arriba (A elegir 1)
    let pool = [...CLUBS_POOL];
    let pL = 1; 
    for(let i=0;i<3;i++) {
        let c = pool.splice(Math.floor(Math.random()*pool.length), 1)[0];
        const d=document.createElement('div'); d.className='card';
        d.innerHTML=`<span class="card-type">Palo</span><div class="card-icon">${c.icon}</div><div class="card-name">${c.name}</div><div class="card-dist">~${c.dist}m</div>`;
        d.onclick=()=>{
            if(pL>0) {
                pL--; d.classList.add('selected');
                state.drawPile.push(cloneCard(c));
                $('mr-btn').disabled=false;
                Array.from($('mr-pick-cards').children).forEach(el => { if(el !== d) el.style.opacity = '0.3'; el.style.pointerEvents = 'none'; });
            }
        };
        $('mr-pick-cards').appendChild(d);
    }

    // EXTRAS AUTOMÁTICOS (Según el PAR) se añaden visualmente abajo sin interactuar
    if (par >= 4) {
        let u = grantRandomUpgrade();
        const dU=document.createElement('div'); dU.className='card upgrade-card'; dU.style.pointerEvents='none';
        dU.innerHTML=`<span class="card-type">Mejora</span><div class="card-icon">${u.icon}</div><div class="card-name">${u.name}</div><div class="card-dist gold">Auto</div>`;
        $('mr-extra-rewards').appendChild(dU);
    }
    if (par === 5) {
        let g = cloneCard(getRandomGem()); state.gems.push(g);
        const dG=document.createElement('div'); dG.className='card gem-card'; dG.style.pointerEvents='none';
        dG.innerHTML=`<span class="card-type">Gema</span><div class="card-icon">${g.icon}</div><div class="card-name">${g.name}</div><div class="card-dist gold">${g.price}🪙</div>`;
        $('mr-extra-rewards').appendChild(dG);
    }

    $('mr-btn').onclick = () => {
        $('mission-reward-overlay').style.display = 'none';
        shuffle(state.drawPile);
        if(cb)cb();
    };
}

function showSlotMachine(spins, baseCash, cb) {
    const o = $('slot-overlay'), rls = [$('slot-reel-1'), $('slot-reel-2'), $('slot-reel-3')], btn = $('slot-spin-btn'), eBtn = $('slot-exit-btn'), res = $('slot-result');
    let sL = spins; $('slot-spins').textContent = sL; eBtn.style.display = 'none'; btn.style.display = 'block'; btn.disabled = false; 
    state.money += baseCash; $('h-money').textContent = state.money; res.textContent = `¡Diana! +${baseCash} 🪙`; $('slot-sub').textContent = `¡Premio por puntería!`; rls.forEach(r => r.textContent = '❓');
    const items = ['🪙', '⛳', '💎', '🔥']; let sI; o.style.display = 'flex';
    
    btn.onclick = () => {
        if(sL <= 0) return; sL--; $('slot-spins').textContent = sL; btn.disabled = true; $('slot-machine').classList.add('slot-spinning'); res.textContent = '...Girando...';
        
        if(typeof AudioEngine!=='undefined') AudioEngine.playBGM('slot');
        let ticks = 0; sI = setInterval(() => { 
            rls.forEach(r => r.textContent = items[ticks % items.length]); 
            ticks++; 
            if(typeof AudioEngine!=='undefined') AudioEngine.playSFX('tick');
        }, 100);

        setTimeout(() => {
            clearInterval(sI); $('slot-machine').classList.remove('slot-spinning');
            if(typeof AudioEngine!=='undefined') { AudioEngine.stopBGM(); AudioEngine.playSFX('slot_stop'); }

            let isLow = getTotalClubsInDeck() < 8; let r1, r2, r3;
            if (isLow && Math.random() < 0.8) { r1 = r2 = r3 = '⛳'; } else if (Math.random() < 0.35) { let w = items[Math.floor(Math.random()*items.length)]; r1 = r2 = r3 = w; } else { r1 = items[Math.floor(Math.random()*items.length)]; r2 = items[Math.floor(Math.random()*items.length)]; r3 = items[Math.floor(Math.random()*items.length)]; if (r1 === r2 && r2 === r3) r3 = items[(items.indexOf(r3)+1)%items.length]; }
            rls[0].textContent = r1; rls[1].textContent = r2; rls[2].textContent = r3;
            
            if (r1 === r2 && r2 === r3) {
                if(r1 === '🪙') { let m = [50,100][Math.floor(Math.random()*2)]; state.money += m; $('h-money').textContent = state.money; res.textContent = `¡LÍNEA! +${m} 🪙`; showToast(`+${m} Monedas`); }
                else if(r1 === '⛳') { const c=cloneCard(CLUBS_POOL[Math.floor(Math.random()*CLUBS_POOL.length)]); state.drawPile.push(c); res.textContent = `¡LÍNEA! Palo: ${c.name}`; showToast(`+1 ${c.name}`); }
                else if(r1 === '💎') { const g=cloneCard(getRandomGem()); state.gems.push(g); res.textContent = `¡LÍNEA! Gema: ${g.name}`; showToast(`+1 ${g.name}`); }
                else if(r1 === '🔥') { let u=grantRandomUpgrade(); res.textContent = `¡LÍNEA! Mejora: ${u.name}`; showToast(`+1 Uso ${u.name}`); }
                
                if(typeof AudioEngine!=='undefined') setTimeout(()=>AudioEngine.playSFX('slot_win'), 200);
            } else { 
                res.textContent = 'Sin premio extra.'; 
                if(typeof AudioEngine!=='undefined') setTimeout(()=>AudioEngine.playSFX('slot_lose'), 200); 
            }
            if(sL > 0) btn.disabled = false; else { btn.style.display = 'none'; eBtn.style.display = 'block'; }
        }, 1500);
    };
    eBtn.onclick = () => { o.style.display = 'none'; if(typeof AudioEngine!=='undefined') AudioEngine.playBGM('game'); if(cb)cb(); };
}

function showShop(callback) {
    const overlay = $('shop-overlay'); $('shop-money').textContent = state.money; const grid = $('shop-grid');
    grid.innerHTML = '<div style="width:100%;font-weight:bold;color:var(--text);margin-bottom:5px;text-align:center;">OFERTAS</div><div id="shop-buy-area" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;width:100%;"></div><div style="width:100%;font-weight:bold;color:var(--text);margin-top:15px;margin-bottom:5px;text-align:center;">VENDER GEMAS Y PALOS</div><div id="shop-sell-area" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;width:100%;"></div>';
    const buyArea = $('shop-buy-area'), sellArea = $('shop-sell-area'), btnBuy = $('shop-buy-btn'), costSpan = $('shop-cost'), cardsSpan = $('shop-total-cards');
    let selectedItems = new Set(), shopCards = [];

    for(let i=0;i<6;i++){ let t=CLUBS_POOL[Math.floor(Math.random()*CLUBS_POOL.length)]; shopCards.push({ id:Math.random().toString(), t, p:t.dist*2, oP:t.dist*2 }); }
    let validClubs = shopCards.filter(x => x.t.dist >= 100);
    if(validClubs.length > 0) { let dc = validClubs[Math.floor(Math.random()*validClubs.length)]; let desc = [0.2, 0.3, 0.4, 0.5][Math.floor(Math.random()*4)]; dc.p = Math.round(dc.p * (1-desc)); dc.discount = `-${desc*100}%`; }
    shuffle(shopCards);

    const upd = () => { let c=0; selectedItems.forEach(x=>c+=x.p); costSpan.textContent=c; $('shop-money').textContent=state.money; let cTC=getTotalClubsInDeck(); cardsSpan.innerHTML=selectedItems.size>0?`${cTC} <span style="color:var(--accent)">(+${selectedItems.size})</span>`:cTC; costSpan.style.color=c>state.money?'var(--danger)':!selectedItems.size?'var(--text)':'var(--accent)'; btnBuy.disabled=c>state.money||!selectedItems.size; };

    function renderSellArea() {
        sellArea.innerHTML = ''; let myItems = [...state.gems, ...state.hand.filter(c=>!c.isPutt), ...state.drawPile];
        if(myItems.length === 0) sellArea.innerHTML = '<span style="color:var(--text-muted);font-size:11px;">No tienes objetos para vender.</span>';
        myItems.forEach(b => {
            const isGem = b.type === 'gem'; const d = document.createElement('div'); d.className = 'card' + (isGem?' gem-card':'');
            d.innerHTML = `<span class="card-type">${isGem?'Gema':'Palo'}</span><div class="card-icon">${b.icon}</div><div class="card-name">${b.name}</div><div class="card-dist gold">${isGem?b.price:40}🪙</div>`;
            d.onclick = () => {
                let pV = isGem ? b.price : 40; state.money += pV; $('h-money').textContent=state.money;
                if(isGem) { state.gems.splice(state.gems.findIndex(x=>x.uid===b.uid), 1); } else { const hIdx = state.hand.findIndex(x=>x.uid === b.uid); if(hIdx > -1) state.hand.splice(hIdx, 1); else { const pIdx = state.drawPile.findIndex(x=>x.uid === b.uid); if(pIdx > -1) state.drawPile.splice(pIdx, 1); } }
                renderSellArea(); upd(); showToast(`+${pV} Monedas`);
            }; sellArea.appendChild(d);
        });
    }

    shopCards.forEach(x => {
        const d=document.createElement('div'); d.className='card';
        d.innerHTML=`<div class="shop-price">${x.p} 🪙</div><span class="card-type">Palo</span><div class="card-icon">${x.t.icon}</div><div class="card-name">${x.t.name}</div><div class="card-dist">~${x.t.dist}m</div>${x.discount?`<div style="position:absolute;bottom:-10px;background:var(--danger);color:#fff;font-size:9px;padding:2px 4px;border-radius:4px;z-index:5;">${x.discount} (<del>${x.oP}</del>)</div>`:''}`;
        let b=false; d.onclick=() => { if(!b&&state.money>=x.p){ if(selectedItems.has(x)){selectedItems.delete(x);d.classList.remove('shop-selected');}else{selectedItems.add(x);d.classList.add('shop-selected');} upd(); }else if(!b&&state.money<x.p&&!selectedItems.has(x)) showToast("No tienes suficientes monedas."); }; buyArea.appendChild(d);
    });

    renderSellArea(); upd(); overlay.style.display='flex';
    $('shop-buy-btn').onclick=() => { let c=0; selectedItems.forEach(x=>{c+=x.p; state.drawPile.push(cloneCard(x.t));}); state.money-=c; $('h-money').textContent=state.money; $('shop-overlay').style.display='none'; shuffle(state.drawPile); if(callback)callback(); };
    $('shop-exit-btn').onclick=() => { $('shop-overlay').style.display='none'; if(callback)callback(); };
}