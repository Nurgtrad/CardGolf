const $ = id => document.getElementById(id);

const CLUBS_POOL = [
  {id:'d', name:'Driver', dist:240, icon:'🏌', type:'club'},{id:'3w', name:'3 Wood', dist:215, icon:'🌲', type:'club'},
  {id:'5w', name:'5 Wood', dist:200, icon:'🌲', type:'club'},{name:'3 Iron', dist:190, icon:'⛳', type:'club'},
  {name:'4 Iron', dist:180, icon:'⛳', type:'club'},{name:'5 Iron', dist:170, icon:'⛳', type:'club'},
  {name:'6 Iron', dist:160, icon:'⛳', type:'club'},{name:'7 Iron', dist:150, icon:'⛳', type:'club'},
  {name:'8 Iron', dist:140, icon:'⛳', type:'club'},{name:'9 Iron', dist:130, icon:'⛳', type:'club'},
  {name:'Pitch W', dist:110, icon:'🎯', type:'club'},{name:'Gap W', dist:95,  icon:'🎯', type:'club'},
  {name:'Sand W', dist:80,  icon:'⏳', type:'club'},{name:'Lob W', dist:60,  icon:'📐', type:'club'}
];
CLUBS_POOL.forEach((c,i) => c.baseId = c.id || `c${i}`);

const UPGRADES_POOL = [
  {id:'u_power', name:'Power', icon:'🔥', effect:'power', desc:'+25% distancia', type:'upgrade'},
  {id:'u_heavy', name:'Heavy', icon:'🪨', effect:'heavy', desc:'Ignora viento', type:'upgrade'},
  {id:'u_mulligan', name:'Mulligan', icon:'⏪', effect:'mulligan', desc:'Rebobina (OB/Agua)', type:'upgrade'},
  {id:'u_frog', name:'Rana', icon:'🐸', effect:'frog', desc:'Rebota sobre agua', type:'upgrade'},
  {id:'u_tractor', name:'Oruga', icon:'🚜', effect:'tractor', desc:'Sin penaliz. terreno', type:'upgrade'}
];

const GEMS_POOL = [
  {id:'g_dia', name:'Diamante', icon:'💎', price:500, chance:5, type:'gem'},
  {id:'g_rub', name:'Rubí', icon:'👑', price:250, chance:15, type:'gem'},
  {id:'g_esm', name:'Esmeralda', icon:'💍', price:100, chance:25, type:'gem'},
  {id:'g_top', name:'Topacio', icon:'💰', price:50, chance:30, type:'gem'},
  {id:'g_cua', name:'Cuarzo', icon:'🪙', price:25, chance:25, type:'gem'}
];

const PUTTER_CARD = {baseId:'putt', name:'Putt', dist:30, icon:'🕳', type:'club', isPutt:true};
const HOLE_PARS = [4,4,3,5,4,3,4,5,4, 4,3,4,4,5,4,3,5,4];
const MAX_CLUBS = 20, MAX_UPGRADES = 2, MAX_INVENTORY = 6;

let state = {
  upgradesConfig:{}, drawPile:[], hand:[], gems:[], activeUpgrades:[], missions:[],
  money:0, hole:0, totalScore:0, scores:[], holeData:null,
  ball:{x:0, y:0}, target:{x:0, y:0}, prevPos:{x:0, y:0}, currentTerrain:'tee', shotTerrain:'tee',
  strokes:0, phase:'card_select', selectedClub:null, currentUpgradeSelected:null,
  wind:{speed:0, dir:0}, powerVal:0, powerDir:1, powerHeld:false, aimVal:0.5, aimDir:1,
  ballAnim:null, cachedPattern:null, paths:{},
  m_hz:false, m_upgs:0, m_c200:false 
};

// TEXTOS LIMPIOS Y LOGICA REPARADA
const M_TYPES = [
  { id:'drive', n:(v)=>`Drive ${v}m+`, c:(st)=>st.strokes===1 && st.dist>=st.m.v },
  { id:'prize', n:()=>`Cae en Prize Zone`, c:(st)=>st.pzHit },
  { id:'bunker', n:()=>`Cae en Bunker`, c:(st)=>st.terr==='bunker' },
  { id:'chip', n:()=>`Emboca fuera de Green`, c:(st)=>st.inHole && st.pTerr!=='green' },
  { id:'club', n:(v)=>`Emboca con ${v}`, c:(st)=>st.inHole && st.club===st.m.v },
  { id:'score', n:(v)=>`Score: ${v}`, cH:(st)=>st.score===st.m.v },
  { id:'hio', n:()=>`Hoyo en 1`, cH:(st)=>st.strokes===1 },
  { id:'u0', n:()=>`Usa 0 Mejoras`, cH:(st)=>st.uUpg===0 },
  { id:'u1', n:()=>`Usa 1 Mejora`, c:(st)=>st.uUpg>=1 }, // Check instantáneo (c)
  { id:'u2', n:()=>`Usa 2 Mejoras`, c:(st)=>st.uUpg>=2 }, // Check instantáneo (c)
  { id:'nohaz', n:()=>`Sin Agua/OB/Bunker`, cH:(st)=>!st.hz },
  { id:'noc200', n:()=>`Sin palos de 200m+`, cH:(st)=>!st.c200 }
];

function cloneCard(c) { return {...c, uid: Math.random().toString(36).substr(2, 9)}; }
function shuffle(array) { for(let i=array.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
function showToast(t) { const el = document.createElement('div'); el.textContent = t; el.style.cssText = 'position:absolute;top:25%;left:50%;transform:translate(-50%,-50%);background:var(--accent2);color:#000;padding:12px 24px;border-radius:30px;font-family:"DM Mono",monospace;font-size:12px;text-transform:uppercase;font-weight:bold;z-index:100;box-shadow:0 10px 20px rgba(0,0,0,0.5);pointer-events:none;animation:toastFade 2s forwards;text-align:center;'; $('game').appendChild(el); setTimeout(()=>el.remove(), 2000); }
const getTotalClubsInDeck = () => state.hand.filter(c=>c.type==='club').length + state.drawPile.filter(c=>c.type==='club').length;
function getRandomGem() { let r = Math.random() * 100, a = 0; for(let g of GEMS_POOL) { a += g.chance; if(r <= a) return g; } return GEMS_POOL[4]; }

function grantRandomUpgrade() { 
    let u = UPGRADES_POOL[Math.floor(Math.random()*UPGRADES_POOL.length)]; 
    let ex = state.activeUpgrades.find(x=>x.id===u.id); 
    if(ex) ex.uses++; 
    else state.activeUpgrades.push({...u, uses:1, active:false}); 
    if(typeof renderUpgrades === 'function') renderUpgrades(); 
    return u; 
}

function getLiePenalty(club, terrain) {
  let lF=Math.max(0,Math.min(1,((club?club.dist:150)-80)/160)), pD=0, pDM=1;
  if(state.activeUpgrades.some(u=>u.id==='u_tractor'&&u.active) || (club?.name==='Sand W'&&terrain==='bunker')) return {pDist:0, pDevMulti:1};
  if(terrain==='rough'){pD=0.08+0.17*lF; pDM=1.2+0.8*lF;} else if(terrain==='semirough'){pD=0.03+0.07*lF; pDM=1.1+0.4*lF;} else if(terrain==='deeprough'){pD=0.12+0.25*lF; pDM=1.4+1.0*lF;} else if(terrain==='bunker'){pD=0.20+0.30*lF; pDM=1.5+1.5*lF;}
  return {pDist:pD, pDevMulti:pDM};
}