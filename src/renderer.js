const $ = (id) => document.getElementById(id);
let games = [];
let toastTimer;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notify(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
function artLetter(name) { const words=name.trim().split(/\s+/); return escapeHtml((words.length>1?words[0][0]+words[1][0]:words[0].slice(0,2)).toUpperCase()); }
function card(game) { return `<article class="game-card"><div class="game-art"><span class="art-tag">X STATION • ${game.kind==='installer'?'INSTALLER':'PC GAME'}</span><span class="art-letter">${artLetter(game.name)}</span></div><div class="game-info"><h3 title="${escapeHtml(game.name)}">${escapeHtml(game.name)}</h3><p>${game.kind==='installer'?'Installer file':'Ready to launch'} · ${escapeHtml(game.path.split(/[\\/]/).pop())}</p><div class="game-actions"><button class="play-btn" data-play="${escapeHtml(game.id)}">${game.kind==='installer'?'RUN SETUP':'▶  PLAY'}</button><button class="more-btn" title="Remove from library" data-remove="${escapeHtml(game.id)}">•••</button></div></div></article>`; }
function render() {
  $('navCount').textContent=games.length;
  $('libraryCount').textContent=`${games.length} GAMES`;
  $('homeGames').innerHTML=games.slice(0,3).map(card).join('');
  $('homeEmpty').hidden=games.length>0;
  $('libraryGames').innerHTML=games.map(card).join('');
  $('libraryEmpty').hidden=games.length>0;
  const recent=games.filter(g=>g.lastPlayed).sort((a,b)=>new Date(b.lastPlayed)-new Date(a.lastPlayed));
  $('recentGames').innerHTML=recent.map(card).join('');
  $('recentEmpty').hidden=recent.length>0;
  applySearch();
}
function applySearch(){const q=$('searchInput').value.toLowerCase();[...$('libraryGames').children].forEach(node=>{node.hidden=!node.querySelector('h3').textContent.toLowerCase().includes(q)});}
function navigate(view){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));$(view+'View').classList.add('active');document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('pageName').textContent=view.toUpperCase().replace('RECENT','RECENTLY PLAYED');}
function openModal(){$('addModal').classList.add('open')};function closeModal(){$('addModal').classList.remove('open')};
async function add(kind){closeModal();try{const item=await window.xstation.addGame(kind);if(item){games=await window.xstation.listGames();render();notify(kind==='installer'?'Installer added to your library.':'Game added successfully.');}}catch(e){notify('Could not add the selected file.');}}
async function launch(id){const result=await window.xstation.launchGame(id);if(result.ok){games=await window.xstation.listGames();render();notify('Launching…');}else notify(result.message||'Could not launch this file.');}
async function remove(id){if(!confirm('Remove this entry from X Station? The original file will not be deleted.'))return;games=await window.xstation.removeGame(id);render();notify('Removed from library.');}
document.addEventListener('click',async e=>{const play=e.target.closest('[data-play]');if(play)return launch(play.dataset.play);const rem=e.target.closest('[data-remove]');if(rem)return remove(rem.dataset.remove);});
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
['heroAdd','emptyAdd','libraryAdd','libraryEmptyAdd'].forEach(id=>$(id).addEventListener('click',openModal));
$('exploreBtn').addEventListener('click',()=>navigate('library'));$('viewAll').addEventListener('click',()=>navigate('library'));
$('modalClose').addEventListener('click',closeModal);$('addModal').addEventListener('click',e=>{if(e.target===$('addModal'))closeModal()});
$('chooseExe').addEventListener('click',()=>add('game'));$('chooseSetup').addEventListener('click',()=>add('installer'));
$('searchInput').addEventListener('input',applySearch);$('openFolder').addEventListener('click',()=>window.xstation.openDataFolder());
window.xstation.listGames().then(data=>{games=data;render()}).catch(()=>notify('Could not load your game library.'));
