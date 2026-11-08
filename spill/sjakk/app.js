import { Chess } from './chess.js';
import { ChessEngine } from './engine.js';
import { setupAnalysis } from './analysis.js';
const engine=new ChessEngine();
const $=id=>document.getElementById(id);
const glyph={w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}};
const value={p:100,n:320,b:335,r:500,q:900,k:0};
const difficultyCopy={1:'Spiller enkle, til dels tilfeldige trekk. Fin for å komme i gang.',2:'En vennlig motstander som også ser noen taktiske muligheter.',3:'Ser etter materiell og enkle kombinasjoner.',4:'Beregner flere trekk fremover og straffer feil.',5:'Den sterkeste lokale motstanderen, men ikke en stormestermotor.'};
let game=new Chess(),selected=null,orientation='w',thinking=false,gameRecorded=false,hintSquare=null,analysisApi=null;
let thinkingChecklistEnabled=localStorage.getItem('freddyChessThinkFirst')==='true',thinkingChecklistApproved=false;
let appearance={theme:'sage',pieces:'classic',level:'2'};
try{appearance={...appearance,...JSON.parse(localStorage.getItem('freddyChessAppearance')||'{}')}}catch{}
if(!['sage','wood','blue','mono','luxury','marble'].includes(appearance.theme))appearance.theme='sage';
if(!['classic','symbols','premium'].includes(appearance.pieces))appearance.pieces='classic';
if(!['1','2','3','4','5'].includes(String(appearance.level)))appearance.level='2';
let training=new Chess(),puzzleSelected=null,puzzle=null,puzzleSolved=false,trainHint=null,puzzleColor='w';
let trainingStage=0,hintCount=0,trainingRound=0,puzzleMissed=false,checkingAlternative=false;
let trainingOrigin='general',analysisScrollY=0,analysisPractice=[],analysisPracticeIndex=0,analysisReturnTab='analysis';
const today=()=>new Date().toLocaleDateString('sv-SE');
let stats;try{stats=JSON.parse(localStorage.getItem('freddyChessProgress'))||{xp:0,solved:0,attempts:0,streak:0,games:0,wins:0,skills:{},daily:{date:today(),count:0}}}catch{stats={xp:0,solved:0,attempts:0,streak:0,games:0,wins:0,skills:{},daily:{date:today(),count:0}}}
stats.skills ||= {};stats.daily ||= {date:today(),count:0};if(stats.daily.date!==today())stats.daily={date:today(),count:0};
stats.puzzles ||= {};
stats.analyzedGames ||= {};
stats.ownQueue ||= null;
const puzzleKey=p=>`${p.fen}|${p.from}${p.to}`;
function recordPuzzleAttempt(success){
  const key=puzzleKey(puzzle),old=stats.puzzles[key]||{right:0,wrong:0,last:0,streak:0};
  old[success?'right':'wrong']++;old.streak=success?old.streak+1:0;
  old.last=Date.now();stats.puzzles[key]=old;
  if(trainingOrigin==='analysis'){
    old.nextReview=success?Date.now()+[0,1,3,7,14][Math.min(4,old.streak)]*86400000:Date.now();
  }
}
function persist(){localStorage.setItem('freddyChessProgress',JSON.stringify(stats));updateStats();updateCoach()}
function updateStats(){ $('xpTop').textContent=`✦ ${stats.xp} XP`; $('dailyTrack').style.width=`${Math.min(stats.daily.count,3)/3*100}%`; $('dailyLabel').textContent=`${Math.min(stats.daily.count,3)} av 3 oppgaver`; $('solvedMini').textContent=stats.solved;$('accuracyMini').textContent=(stats.attempts?Math.round(stats.solved/stats.attempts*100):0)+'%';$('streakMini').textContent=stats.streak;$('xpStat').textContent=stats.xp+' XP';$('solvedStat').textContent=stats.solved;$('gamesStat').textContent=stats.games;$('winsStat').textContent=stats.wins;const skills=['Gaffel','Matt','Binding','Åpning','Sluttspill','Egne partier'];$('skillProgress').innerHTML=skills.map(k=>{let s=stats.skills[k]||{correct:0,attempts:0};let pct=s.attempts?Math.round(s.correct/s.attempts*100):0;return `<div class="skill-row">${k}<span>${s.correct}/${s.attempts} riktig · ${pct}%</span></div><div class="skill-track"><i style="width:${pct}%"></i></div>`}).join('')}
function updateCoach(){
  const skills=['Gaffel','Matt','Binding','Åpning','Sluttspill'];
  const ranked=skills.map(name=>({name,...(stats.skills[name]||{attempts:0,correct:0})})).filter(s=>s.attempts>0)
    .sort((a,b)=>(a.correct/a.attempts)-(b.correct/b.attempts)||b.attempts-a.attempts);
  const weak=ranked[0],records=Object.values(stats.puzzles),due=records.filter(p=>p.wrong>0&&p.streak<2).length;
  const analyzed=Object.values(stats.analyzedGames),themes={};
  for(const g of analyzed)for(const topic of g.topics)themes[topic]=(themes[topic]||0)+1;
  const chessTheme=Object.entries(themes).sort((a,b)=>b[1]-a[1])[0];
  const practice=weak?`Ditt viktigste fokus fra oppgavene: ${weak.name.toLowerCase()} (${weak.correct} av ${weak.attempts} riktige forsøk). ${due?`${due} vanskelige stillinger er merket for repetisjon. `:''}`:'Start med noen taktikkoppgaver for å finne treningsnivået ditt. ';
  const ownGames=analyzed.length?`Du har analysert ${analyzed.length} ulike partier. ${chessTheme?`Vanligste forbedringstema i de analyserte trekkene: ${chessTheme[0].toLowerCase()} (${chessTheme[1]} funn).`: 'Ingen tydelige forbedringspunkter funnet ennå.'} `:'Hent partier fra Chess.com for å få en treningsplan basert på egne feil. ';
  $('coachPlan').textContent=practice+ownGames+'Se etter motstanderens beste svar før du flytter. Dette er et lokalt estimat, ikke en offisiell Chess.com-rating.';
  updateAllGamesPlan();
}
function allOwnPositions(){
  const unique=new Map();
  for(const record of Object.values(stats.analyzedGames))for(const p of record.positions||[]){
    if(p?.fen&&p.from&&p.to&&!unique.has(puzzleKey(p)))unique.set(puzzleKey(p),p);
  }
  return [...unique.values()];
}
function topicLearningSnapshot(positions){
  const result=new Map();
  for(const p of positions){
    const topic=p.topic||'Andre forbedringspunkter';
    if(!result.has(topic))result.set(topic,{topic,total:0,trained:0,mastered:0,wrong:0,due:0});
    const row=result.get(topic),attempt=stats.puzzles[puzzleKey(p)];
    row.total++;
    if(attempt?.right||attempt?.wrong)row.trained++;
    if((attempt?.streak||0)>=2)row.mastered++;
    row.wrong+=attempt?.wrong||0;
    if(!attempt?.right||attempt.nextReview<=Date.now()||attempt.wrong>attempt.right)row.due++;
  }
  return [...result.values()].sort((a,b)=>b.due-a.due||b.total-a.total);
}
function updateGameTrend(analyzed){
  let root=$('gameTrend');
  if(!root){
    root=document.createElement('section');root.id='gameTrend';root.className='game-trend';
    $('ownLearningStats').after(root);
  }
  root.replaceChildren();
  const heading=document.createElement('h3');heading.textContent='Utvikling fra parti til parti';root.appendChild(heading);
  const tracked=analyzed.filter(g=>g.checked>0&&g.date&&Number.isFinite(Number(g.count)))
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(-20);
  if(!tracked.length){
    const empty=document.createElement('p');empty.className='muted';empty.textContent='Analyser flere Chess.com-partier for å se en sammenlignbar utvikling. Eldre analyser uten registrert antall undersøkte trekk vises ikke i denne rapporten.';root.appendChild(empty);return;
  }
  const latest=tracked.slice(-5),previous=tracked.slice(-10,-5);
  const mean=arr=>arr.reduce((s,g)=>s+g.count/g.checked*100,0)/arr.length;
  const summary=document.createElement('p');summary.className='muted';
  const recentRate=mean(latest),earlierRate=previous.length?mean(previous):null;
  summary.textContent=`Siste ${latest.length} partier: ${Math.round(recentRate)} forbedringspunkter per 100 undersøkte trekk. ${earlierRate===null?'Analyser minst seks partier for å få en sammenligning.':`Foregående ${previous.length}: ${Math.round(earlierRate)}. ${recentRate<earlierRate?'Færre funn i den nyeste gruppen.':recentRate>earlierRate?'Flere funn i den nyeste gruppen.':'Omtrent samme nivå.'}`} Dette er en indikasjon basert på utvalgte trekk, ikke en full partivurdering.`;
  root.appendChild(summary);
  const chart=document.createElement('div');chart.className='game-trend-chart';chart.setAttribute('role','list');
  for(const record of tracked){
    const rate=Math.min(100,record.count/record.checked*100);
    const item=document.createElement('div');item.className='game-trend-item';item.setAttribute('role','listitem');
    const bar=document.createElement('div');bar.className='game-trend-bar';bar.style.height=`${Math.max(5,rate)}%`;
    const date=document.createElement('small');date.textContent=(record.date||'').slice(-5);
    const name=document.createElement('span');name.textContent=`${record.date}: ${record.count} funn i ${record.checked} undersøkte trekk (${Math.round(rate)} %). ${record.white} – ${record.black}`;
    name.className='sr-only';item.setAttribute('aria-label',name.textContent);item.append(bar,date);chart.appendChild(item);
  }
  root.appendChild(chart);
  const disclaimer=document.createElement('small');disclaimer.className='muted';disclaimer.textContent='Søylene viser andelen undersøkte trekk der motoren fant et tydelig bedre alternativ. Kortere søyler er bedre. Partier med forskjellig motstand og vanskelighetsgrad er ikke direkte sammenlignbare.';root.appendChild(disclaimer);
}
function updateAllGamesPlan(){
  const analyzed=Object.values(stats.analyzedGames),positions=allOwnPositions();
  const byTopic={};
  for(const record of analyzed)for(const topic of record.topics||[])byTopic[topic]=(byTopic[topic]||0)+1;
  const review=positions.filter(p=>{const s=stats.puzzles[puzzleKey(p)];return !s?.right||s.nextReview<=Date.now()||s.wrong>s.right});
  const practiced=positions.filter(p=>stats.puzzles[puzzleKey(p)]?.right).length;
  const mastered=positions.filter(p=>(stats.puzzles[puzzleKey(p)]?.streak||0)>=2).length;
  $('allGamesSummary').textContent=`${analyzed.length} analyserte partier · ${positions.length} unike treningsstillinger.`;
  updateGameTrend(analyzed);
  $('ownLearningStats').replaceChildren();
  for(const [label,count] of [['Trent minst én gang',practiced],['Klare for repetisjon',review.length],['Mestret to ganger på rad',mastered]]){
    const item=document.createElement('div');item.className='own-learning-stat';const b=document.createElement('b');b.textContent=count;const span=document.createElement('span');span.textContent=label;item.append(b,span);$('ownLearningStats').appendChild(item);
  }
  $('chessThemes').replaceChildren();
  for(const [topic,count] of Object.entries(byTopic).sort((a,b)=>b[1]-a[1])){
    const chip=document.createElement('span');chip.className='chess-theme';chip.textContent=`${topic}: ${count}`;$('chessThemes').appendChild(chip);
  }
  let guidance=$('ownTopicGuidance');
  if(!guidance){
    guidance=document.createElement('section');guidance.id='ownTopicGuidance';guidance.className='own-topic-guidance';guidance.setAttribute('aria-live','polite');
    $('chessThemes').after(guidance);
  }
  guidance.replaceChildren();
  const topics=topicLearningSnapshot(positions);
  if(topics.length){
    const title=document.createElement('h3');title.textContent='Dine viktigste treningsområder';guidance.appendChild(title);
    for(const item of topics.slice(0,3)){
      const card=document.createElement('div');card.className='own-topic-row';
      const header=document.createElement('div');const strong=document.createElement('strong');strong.textContent=item.topic;
      const count=document.createElement('span');count.textContent=`${item.due} til repetisjon av ${item.total}`;
      header.append(strong,count);
      const track=document.createElement('div');track.className='own-topic-track';
      const fill=document.createElement('i');fill.style.width=`${Math.round(item.mastered/item.total*100)}%`;track.appendChild(fill);
      const detail=document.createElement('small');detail.textContent=`${item.trained} øvd på · ${item.mastered} mestret to ganger · ${item.wrong} feilforsøk`;
      card.append(header,track,detail);guidance.appendChild(card);
    }
    const note=document.createElement('p');note.className='muted';note.textContent=`Anbefalt nå: ${topics[0].topic.toLowerCase()}. Start med «Tren 10 anbefalte», eller velg tema nedenfor. Et punkt regnes som mestret etter to riktige løsninger på rad.`;guidance.appendChild(note);
  }
  const filter=$('chessThemeFilter'),selected=filter.value;
  filter.replaceChildren(new Option('Alle forbedringspunkter','alle'));
  for(const topic of Object.keys(byTopic).sort())filter.add(new Option(topic,topic));
  filter.value=Object.hasOwn(byTopic,selected)?selected:'alle';
  $('coachAll').disabled=!positions.length;
  $('coachTen').disabled=!positions.length;
  const saved=stats.ownQueue;
  $('resumeOwnTraining').hidden=!saved?.keys?.length||saved.index>=saved.keys.length;
  if(saved?.keys?.length)$('resumeOwnTraining').textContent=`Fortsett forrige økt (${saved.index+1} av ${saved.keys.length}) →`;
}
// Keep the coaching summary in sync with every persisted training attempt.
function setTab(tab){document.body.classList.toggle('chess-playing',tab==='play');document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('hidden',p.id!==tab+'Panel'));const headings={play:['Din neste gode','Utfordre datamaskinen, oppdag mønstre og bygg ferdigheter – ett parti om gangen.'],train:['Tren blikket ditt','Gjenkjenn sjakkmønstre og lær av hver oppgave.'],analysis:['Dine partier, din læring','Analyser egne trekk med Stockfish og tren der du har mest å hente.'],learn:['Forstå spillet','Små leksjoner som gjør de neste trekkene dine bedre.'],progress:['Se hvor langt du har kommet','Hvert parti og hver oppgave bygger erfaring.']};$('pageTitle').innerHTML=headings[tab][0].replace('gode','gode <em>trekk.</em>').replace('ditt','ditt <em>sjakkblikk.</em>').replace('spillet','<em>spillet.</em>').replace('kommet','<em>kommet.</em>').replace('læring','<em>læring.</em>');$('pageDesc').textContent=headings[tab][1]}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.tab==='train'){trainingOrigin='general';queue=[];loadPuzzle()}setTab(b.dataset.tab)});$('dailyGo').onclick=()=>{trainingOrigin='general';queue=[];loadPuzzle();setTab('train')};$('progressTrain').onclick=()=>{trainingOrigin='general';queue=[];loadPuzzle();setTab('train')};
const files='abcdefgh';
function renderBoard(target,position,sel,side,onClick,marked=null){
  if(target==='board'&&document.getElementById('reviewFinishedGame'))$('reviewFinishedGame').hidden=!game.isGameOver();
  const root=$(target);
  // Build the 64 DOM cells ONCE. Never remove a piece node during a move:
  // Safari's scroll anchoring can otherwise visibly shift the chessboard.
  if(root.children.length!==64){
    root.replaceChildren();
    // On iPhone Safari a tap can be treated as a tiny page pan. Consume touch
    // gestures on the board and route genuine taps directly to the square.
    root.addEventListener('touchstart',event=>{
      const touch=event.touches[0];
      if(!touch)return;
      root._touchStart={x:touch.clientX,y:touch.clientY,scrollY:window.scrollY};
      event.preventDefault();
    },{passive:false});
    root.addEventListener('touchmove',event=>event.preventDefault(),{passive:false});
    root.addEventListener('touchend',event=>{
      event.preventDefault();
      const start=root._touchStart,touch=event.changedTouches[0];
      if(!start||!touch)return;
      if(Math.hypot(touch.clientX-start.x,touch.clientY-start.y)>14)return;
      const square=document.elementFromPoint(touch.clientX,touch.clientY)?.closest('.square');
      if(square&&root.contains(square))square.onclick?.();
      // Keep the viewport exactly where it was before the tap. Do not scroll
      // the board into view or change the page position when a piece is chosen.
      if(Math.abs(window.scrollY-start.scrollY)>0)window.scrollTo(0,start.scrollY);
    },{passive:false});
    root.addEventListener('touchcancel',()=>{root._touchStart=null},{passive:true});
    for(let i=0;i<64;i++){
      const sq=document.createElement('div');sq.className='square';
      const svg=document.createElement('img');
      svg.className='piece piece-svg';svg.alt='';svg.draggable=false;
      svg.decoding='sync';
      const rank=document.createElement('span');rank.className='coord rank';
      const file=document.createElement('span');file.className='coord file';
      const symbol=document.createElement('span');symbol.className='piece-glyph';symbol.setAttribute('aria-hidden','true');
      sq.append(svg,rank,file,symbol);root.appendChild(sq);
    }
  }
  root.dataset.theme=appearance.theme;
  root.dataset.pieces=appearance.pieces;
  root.parentElement.dataset.theme=appearance.theme;
  const ranks=side==='w'?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
  const cols=side==='w'?[...files]:[...files].reverse();
  const legal=sel?position.moves({square:sel,verbose:true}).map(m=>m.to):[];
  const last=position.history({verbose:true}).at(-1);
  let i=0;
  for(const rank of ranks)for(const file of cols){
    const name=file+rank,p=position.get(name),square=root.children[i++];
    square.className=`square ${(files.indexOf(file)+rank)%2===0?'light':'dark'}`;
    if(sel===name||marked===name)square.classList.add('selected');
    if(legal.includes(name))square.classList.add('legal');
    if(last&&(last.from===name||last.to===name))square.classList.add('last');
    if(position.isCheck()&&p?.type==='k'&&p.color===position.turn())square.classList.add('check');
    square.onclick=()=>onClick(name);
    const svg=square.children[0];
    const image=p?`./piece-${p.color}${p.type}.svg`:'';
    if(svg.dataset.piece!==image){
      svg.dataset.piece=image;
      if(p){svg.src=image;svg.alt=`${p.color==='w'?'Hvit':'Svart'} ${ {k:'konge',q:'dronning',r:'tårn',b:'løper',n:'springer',p:'bonde'}[p.type]}`}
    }
    svg.style.visibility=p&&appearance.pieces!=='symbols'?'visible':'hidden';
    const symbol=square.children[3];symbol.textContent=p&&appearance.pieces==='symbols'?glyph[p.color][p.type]:'';
    symbol.classList.toggle('white-piece',p?.color==='w');
    square.children[1].textContent=file===cols[0]?rank:'';
    square.children[2].textContent=rank===ranks.at(-1)?file:'';
  }
}
function describeMove(move){if(move.san.includes('#'))return `Matt! ${move.san} avslutter partiet.`;if(move.san.includes('+'))return `${move.san} setter kongen i sjakk. Se etter hvordan motstanderen kan svare.`;if(move.captured)return `${move.san} slår en brikke. Tenk alltid gjennom om brikken kan slås tilbake.`;if(move.piece==='n'||move.piece==='b')return `${move.san} utvikler en lett offiser. Aktivitet og kontroll over sentrum er viktige.`;if(move.san==='O-O'||move.san==='O-O-O')return 'Bra! Rokade bringer kongen i trygghet og setter tårnet i spill.';if(['e4','d4','e5','d5'].includes(move.san))return 'Sentrum er viktig: sentrumsbønder åpner linjer for offiserene.';return `Trekket ${move.san} er spilt. Sjekk hvilke brikker som nå er truet og hvilke felt som er svake.`}
function material(){const board=game.board();let w=0,b=0;for(const row of board)for(const p of row)if(p&&p.type!=='k'){if(p.color==='w')w+=value[p.type];else b+=value[p.type]}$('whiteMaterial').textContent=w>b?`+${Math.round((w-b)/100)}`:'';$('blackMaterial').textContent=b>w?`+${Math.round((b-w)/100)}`:''}
function updateGame(){renderBoard('board',game,selected,orientation,onPlayerSquare,hintSquare);material();const list=$('moveList');const hist=game.history();list.innerHTML=hist.length?hist.map((m,i)=>`<div class="move-item"><span>${i%2===0?Math.floor(i/2)+1+'.':'···'}</span>${m}</div>`).join(''):'<div class="empty">Partiet er klart. Ditt første trekk venter.</div>';$('moveCount').textContent=`${hist.length} halvtrekk`;$('boardStatus').textContent=game.isCheckmate()?'Sjakk matt':game.isCheck()?'Sjakk!':game.isDraw()?'Remis':thinking?'Datamaskinen tenker …':game.turn()==='w'?'Din tur til å trekke':'Datamaskinens tur';const alert=$('boardAlert');const isMate=game.isCheckmate(),isCheck=game.isCheck();alert.classList.toggle('hidden',!isMate&&!isCheck);alert.classList.toggle('mate',isMate);if(isMate){$('boardAlertTitle').textContent='SJAKK MATT!';$('boardAlertText').textContent=game.turn()==='b'?'Gratulerer, Freddy! Du vant partiet.':'Datamaskinen vant. Prøv et nytt parti!'}else if(isCheck){$('boardAlertTitle').textContent='SJAKK!';$('boardAlertText').textContent=game.turn()==='w'?'Kongen din er truet – du må svare på sjakken.':'Datamaskinens konge er truet.'}if(game.isGameOver()&&!gameRecorded){stats.games++;if(isMate&&game.turn()==='b'){stats.wins++;stats.xp+=30}$('coachMessage').textContent=isMate?(game.turn()==='b'?'Gratulerer! Du vant med sjakk matt.':'Sjakk matt. Se på trekkhistorikken og prøv igjen.'):'Partiet endte remis. God anledning til å analysere!';gameRecorded=true;persist()}}
function onPlayerSquare(sq){if(thinking||game.isGameOver()||game.turn()!=='w')return;const p=game.get(sq);if(selected){const possible=game.moves({square:selected,verbose:true}).find(m=>m.to===sq);if(possible){if(thinkingChecklistEnabled&&!thinkingChecklistApproved){$('thinkStatus').textContent='Svar på de tre spørsmålene og bekreft før du utfører trekket.';return}const move=game.move({from:selected,to:sq,promotion:'q'});thinkingChecklistApproved=false;resetThinkingChecklist();selected=null;hintSquare=null;$('coachMessage').textContent=describeMove(move);thinking=true;updateGame();window.setTimeout(()=>computerMove(),280);return}}selected=p?.color==='w'?sq:null;hintSquare=null;updateGame()}
function evaluate(g){if(g.isCheckmate())return g.turn()==='b'?100000:-100000;if(g.isDraw())return 0;let score=0;for(let r=0;r<8;r++)for(let c=0;c<8;c++){let p=g.board()[r][c];if(!p)continue;let central=(3.5-Math.abs(c-3.5))+(3.5-Math.abs(r-3.5));let bonus=(p.type==='n'||p.type==='b'?central*7:p.type==='p'?central*3:0);score+=(p.color==='w'?1:-1)*(value[p.type]+bonus)}return score}
function orderedMoves(g){return g.moves({verbose:true}).sort((a,b)=>(b.captured?value[b.captured]+100:0)+(b.san.includes('+')?40:0)-(a.captured?value[a.captured]+100:0)-(a.san.includes('+')?40:0))}
function search(g,depth,alpha,beta){if(depth===0||g.isGameOver())return evaluate(g);const maximize=g.turn()==='w';let best=maximize?-Infinity:Infinity;for(const m of orderedMoves(g)){g.move(m);const v=search(g,depth-1,alpha,beta);g.undo();best=maximize?Math.max(best,v):Math.min(best,v);if(maximize)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha)break}return best}
function fallbackComputerMove(){if(game.turn()!=='b'||game.isGameOver()){thinking=false;updateGame();return}const level=Number($('difficulty').value),moves=orderedMoves(game);let chosen;if(level===1){chosen=moves[Math.floor(Math.random()*moves.length)]}else{const depth=level<=2?1:level===3?2:3;let ranked=moves.map(m=>{game.move(m);const score=search(game,depth-1,-Infinity,Infinity);game.undo();return {m,score:score+(Math.random()-.5)*(level===2?165:level===3?60:level===4?15:4)}}).sort((a,b)=>a.score-b.score);chosen=ranked[0].m}const m=game.move(chosen);thinking=false;$('coachMessage').textContent=`Datamaskinen spilte ${m.san}. ${describeMove(m)} Se etter sjakker, slag og trusler før ditt neste trekk.`;updateGame()}
async function computerMove(){const fen=game.fen(),level=Number($('difficulty').value);if(!engine.ready){fallbackComputerMove();return}try{const result=await engine.search(fen,{skill:[0,1,4,9,18,20][level],ms:[0,130,250,450,650,900][level]});if(game.fen()!==fen||game.turn()!=='b')return;const uci=result.move;const move=game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});thinking=false;$('coachMessage').textContent=`Stockfish spilte ${move.san}. ${describeMove(move)} Se etter sjakker, slag og trusler.`;updateGame()}catch{if(game.fen()===fen)fallbackComputerMove()}}
// Keep the coach immediately below the board on mobile and before settings on every screen.
const liveCoach=$('coachMessage').closest('.panel');
liveCoach.querySelector('h2').textContent='Analyse og anbefalinger';
liveCoach.parentElement.prepend(liveCoach);
const thinkFirst=document.createElement('section');thinkFirst.className='think-first';thinkFirst.innerHTML='<label class="think-toggle"><input id="thinkMode" type="checkbox"> <span>🧠 Tenk før du trekker</span></label><div id="thinkChecklist" class="think-questions" hidden><p>Før du flytter brikken:</p><label><input type="checkbox" class="think-question"> Hva truer motstanderen?</label><label><input type="checkbox" class="think-question"> Har jeg sjakker, slag eller trusler?</label><label><input type="checkbox" class="think-question"> Hva er motstanderens beste svar?</label><button type="button" id="thinkApprove" class="secondary" disabled>Jeg har vurdert trekket ✓</button><small id="thinkStatus" aria-live="polite">Svar på alle tre før du spiller.</small></div>';
liveCoach.querySelector('h2').after(thinkFirst);
const thinkChecks=[...thinkFirst.querySelectorAll('.think-question')];
function resetThinkingChecklist(){thinkingChecklistApproved=false;thinkChecks.forEach(c=>c.checked=false)}
function refreshThinkingChecklist(){const active=thinkingChecklistEnabled&&game.turn()==='w'&&!game.isGameOver()&&!thinking;$('thinkChecklist').hidden=!thinkingChecklistEnabled;$('thinkApprove').disabled=!active||thinkingChecklistApproved||!thinkChecks.every(c=>c.checked);$('thinkStatus').textContent=!active?'Vent på din tur.':thinkingChecklistApproved?'✓ Bra! Nå kan du utføre trekket på brettet.':'Svar på alle tre før du spiller.'}
$('thinkMode').checked=thinkingChecklistEnabled;
$('thinkMode').onchange=()=>{thinkingChecklistEnabled=$('thinkMode').checked;localStorage.setItem('freddyChessThinkFirst',String(thinkingChecklistEnabled));resetThinkingChecklist();refreshThinkingChecklist()};
thinkChecks.forEach(c=>c.onchange=refreshThinkingChecklist);
$('thinkApprove').onclick=()=>{if(thinkChecks.every(c=>c.checked)&&game.turn()==='w'&&!thinking&&!game.isGameOver()){thinkingChecklistApproved=true;refreshThinkingChecklist()}};
const analyzePosition=document.createElement('button');analyzePosition.type='button';analyzePosition.id='analyzePosition';analyzePosition.className='primary';analyzePosition.textContent='♟ Få Stockfish-anbefaling';
$('coachMessage').after(analyzePosition);
const reviewFinishedGame=document.createElement('button');reviewFinishedGame.id='reviewFinishedGame';reviewFinishedGame.type='button';reviewFinishedGame.className='primary';reviewFinishedGame.textContent='♟ Analyser partiet jeg nettopp spilte →';reviewFinishedGame.hidden=true;
analyzePosition.after(reviewFinishedGame);
reviewFinishedGame.onclick=()=>{
  if(!game.isGameOver()||!analysisApi)return;
  const history=game.pgn({maxWidth:0,newline:'\n'});
  const pgn=`[Event "Parti mot datamaskinen"]\n[White "Freddy"]\n[Black "Datamaskinen"]\n[Result "${game.isCheckmate()?(game.turn()==='b'?'1-0':'0-1'):'1/2-1/2'}"]\n\n${history}`;
  setTab('analysis');analysisApi.analyzeFinishedGame(pgn);
};
analyzePosition.onclick=async()=>{
  if(thinking||game.turn()!=='w'){ $('coachMessage').textContent='Vent til det er din tur før du analyserer.';return }
  if(game.isGameOver()){$('coachMessage').textContent='Partiet er avsluttet. Bruk «Angre» for å se på en tidligere stilling, eller start et nytt parti.';return}
  if(!engine.ready){$('coachMessage').textContent='Stockfish starter fortsatt. Prøv igjen om litt.';return}
  const fen=game.fen();analyzePosition.disabled=true;$('coachMessage').textContent='Stockfish undersøker stillingen …';
  try{
    const result=await engine.search(fen,{ms:900,skill:20});
    if(game.fen()!==fen)return;
    if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(result.move||''))throw new Error('Ugyldig trekk');
    const trial=new Chess(fen),move=trial.move({from:result.move.slice(0,2),to:result.move.slice(2,4),promotion:result.move[4]||'q'});
    if(!move)throw new Error('Ulovlig trekk');
    const threatened=threatenedPieces(game,'w');
    selected=move.from;hintSquare=move.to;
    $('coachMessage').textContent=`Stockfish anbefaler ${move.san}. ${threatened.length?'Vær særlig oppmerksom på '+threatened[0].name+' på '+threatened[0].square+'. ':''}${describeMove(move)} Forslaget er markert på brettet; se alltid etter motstanderens beste svar.`;
    updateGame();
  }catch{if(game.fen()===fen)$('coachMessage').textContent='Analysen kunne ikke fullføres akkurat nå. Prøv igjen.'}
  finally{analyzePosition.disabled=false}
};
$('difficulty').value=String(appearance.level);
$('boardTheme').value=appearance.theme;$('pieceStyle').value=appearance.pieces;
function saveAppearance(){localStorage.setItem('freddyChessAppearance',JSON.stringify(appearance));$('appearanceStatus').textContent='✓ Innstillingene er lagret på denne enheten.'}
$('difficulty').onchange=()=>{appearance.level=$('difficulty').value;$('difficultyText').textContent=difficultyCopy[appearance.level];$('opponentLabel').textContent='Datamaskin · '+$('difficulty').selectedOptions[0].textContent.replace(/[^\p{L} ]/gu,'').trim();saveAppearance()};
$('boardTheme').onchange=()=>{appearance.theme=$('boardTheme').value;saveAppearance();updateGame();renderPuzzle()};
$('pieceStyle').onchange=()=>{appearance.pieces=$('pieceStyle').value;saveAppearance();updateGame();renderPuzzle()};
$('difficulty').dispatchEvent(new Event('change'));
$('mobileSettings').onclick=()=>{$('gameSettings').scrollIntoView({behavior:'smooth',block:'start'});$('gameSettings').classList.add('settings-focus');setTimeout(()=>$('gameSettings').classList.remove('settings-focus'),1800)};
$('newGame').onclick=()=>{game=new Chess();resetThinkingChecklist();selected=null;thinking=false;hintSquare=null;gameRecorded=false;$('coachMessage').textContent='Nytt parti! Et godt mål er å kontrollere sentrum, utvikle offiserene og sikre kongen.';updateGame()};$('flipBtn').onclick=()=>{orientation=orientation==='w'?'b':'w';updateGame()};$('undoBtn').onclick=()=>{if(thinking)return;game.undo();if(game.turn()==='b')game.undo();gameRecorded=false;resetThinkingChecklist();selected=null;hintSquare=null;$('coachMessage').textContent='Trekkene er angret. Prøv en annen plan.';updateGame()};$('hintBtn').onclick=()=>{if(thinking||game.turn()!=='w'||game.isGameOver())return;const moves=orderedMoves(game);let best=null,score=-Infinity;for(const m of moves){game.move(m);const v=search(game,1,-Infinity,Infinity);game.undo();if(v>score){score=v;best=m}}if(best){selected=best.from;hintSquare=best.to;$('coachMessage').textContent=`Prøv ${best.san}. Dette er et forslag basert på materiell og aktivitet – se også etter motstanderens svar.`;updateGame()}};
const puzzleData=[
 {skill:'Matt',title:'Matt på bakerste rad',fen:'6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',from:'e1',to:'e8',prompt:'Hvit trekker. Finn matt i ett.',hint:'Tårnet kan nå helt til åttende rad.',explain:'Te8# er matt: kongen er sperret av sine egne bønder.'},
 {skill:'Gaffel',title:'Springergaffel',fen:'3q3k/5ppp/8/4N3/8/8/5PPP/6K1 w - - 0 1',from:'e5',to:'f7',prompt:'Hvit trekker. Finn en gaffel, og tenk ett trekk videre: kan springeren faktisk ta dronningen?',hint:'Se etter springersjakk. Svart må først svare på sjakken.',explain:'Sxf7+ er en ekte gaffel: springeren sjakker kongen på h8 og angriper dronningen på d8. Etter ...Kg8 følger Sxd8 og hvit vinner dronningen. Svart får ikke tatt springeren gratis.',continuation:[{from:'h8',to:'g8'},{from:'f7',to:'d8'}]},
 {skill:'Binding',title:'Ta springeren trygt',fen:'4k3/4n3/8/2B5/8/8/8/4R1K1 w - - 0 1',from:'e1',to:'e7',prompt:'Hvit trekker. Vinn springeren med tårnet uten å miste tårnet etterpå.',hint:'Se langs e-linjen, men sjekk også hvem som forsvarer feltet e7.',explain:'Txe7+ vinner springeren. Løperen på c5 forsvarer e7, så kongen på e8 kan ikke spille Kxe7. Dette var feilen i den forrige oppgaven.'},
 {skill:'Matt',title:'Dronning og løper samarbeider',fen:'5rk1/5ppp/8/7Q/8/3B4/5PPP/6K1 w - - 0 1',from:'h5',to:'h7',prompt:'Hvit trekker. Finn matt i ett ved hjelp av dronning og løper.',hint:'Løperen forsvarer h7. Hva kan dronningen slå der?',explain:'Dxh7# er matt. Løperen på d3 forsvarer dronningen på h7, og den svarte kongen har ingen sikre fluktfelt.'},
 {skill:'Åpning',title:'Ta sentrum',fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',from:'e2',to:'e4',prompt:'Start et parti med en klassisk sentrumsbonde.',hint:'Flytt e-bonden to felt.',explain:'e4 kontrollerer sentrum og åpner diagonaler for løper og dronning.'},
 {skill:'Åpning',title:'Utvikle springeren',fen:'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',from:'g1',to:'f3',prompt:'Utvikle en springer og angrip bonden på e5.',hint:'Kongespringeren passer godt på f3.',explain:'Sf3 utvikler en brikke, angriper e5 og bidrar til kontroll over sentrum.'},
 {skill:'Sluttspill',title:'Aktiv konge',fen:'8/8/8/8/4k3/8/4P3/4K3 w - - 0 1',from:'e1',to:'d2',prompt:'Aktiver kongen i sluttspillet.',hint:'Kongen må nærmere sentrum og bonden.',explain:'Kd2 gjør kongen mer aktiv. I sluttspill er kongen en viktig kampbrikke.'},
 {skill:'Gaffel',title:'Dobbel trussel',fen:'6k1/3q1p1p/8/8/4N3/8/5PPP/6K1 w - - 0 1',from:'e4',to:'f6',prompt:'Flytt springeren slik at den sjakker kongen og angriper dronningen. Sjekk at svart ikke kan slå springeren.',hint:'Springeren kan hoppe frem til f6. Se hvorfor ingen svart bonde kan slå den.',explain:'Sf6+ angriper kongen på g8 og dronningen på d7. Her finnes ingen g-bonde som kan slå springeren på f6. Etter ...Kh8 kan springeren vinne dronningen med Sxd7.',continuation:[{from:'g8',to:'h8'},{from:'f6',to:'d7'}]},
 {skill:'Binding',title:'Ubeskyttet tårn',fen:'4k3/8/8/8/8/8/4r3/4R1K1 w - - 0 1',from:'e1',to:'e2',prompt:'Slå tårnet som står rett foran ditt.',hint:'Se på e2.',explain:'Txe2+ bytter ut den angripende brikken med sjakk.'},
 {skill:'Sluttspill',title:'Bonden mot mål',fen:'7k/P7/8/8/8/8/8/7K w - - 0 1',from:'a7',to:'a8',prompt:'Forvandle bonden til en dronning.',hint:'Flytt a-bonden til siste rad.',explain:'a8=D gir deg en ny dronning. Bondeforvandling kan avgjøre sluttspill.'}
];
// Symmetry-preserving variants increase variety without introducing unverified
// random moves. Rotations also let Freddy train from Black's perspective.
function transformPuzzle(p,mode){
  const flipFiles=mode==='mirror'||mode==='rotate';
  const flipRanks=mode==='rotate'||mode==='vertical';
  const swapColors=flipRanks;
  const mapSquare=s=>files[flipFiles?7-files.indexOf(s[0]):files.indexOf(s[0])]+(flipRanks?9-Number(s[1]):s[1]);
  const original=p.fen.split(' '),ranks=original[0].split('/').map(row=>row.replace(/[1-8]/g,n=>'.'.repeat(Number(n))).split(''));
  const out=Array.from({length:8},()=>Array(8).fill('.'));
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
    const c=ranks[y][x];if(c==='.')continue;
    const ny=flipRanks?7-y:y,nx=flipFiles?7-x:x;
    out[ny][nx]=swapColors?(c===c.toUpperCase()?c.toLowerCase():c.toUpperCase()):c;
  }
  const board=out.map(row=>row.join('').replace(/\.+/g,m=>String(m.length))).join('/');
  const turn=swapColors?(original[1]==='w'?'b':'w'):original[1];
  const fen=`${board} ${turn} - - 0 1`;
  try{new Chess(fen)}catch{return null}
  return {...p,fen,from:mapSquare(p.from),to:mapSquare(p.to),continuation:p.continuation?.map(m=>({from:mapSquare(m.from),to:mapSquare(m.to)})),mirrored:true,
    explain:p.skill==='Matt'?'Dette er matt: kongen har ingen lovlige svar.':p.skill==='Gaffel'?'En springergaffel tvinger kongen til å svare på sjakken før du kan vinne dronningen.':p.skill==='Binding'?'Trekket vinner materiell fordi feltet er beskyttet og motstanderen ikke kan slå tilbake.':p.explain};
}
const originals=puzzleData.filter(p=>p.fen.split(' ')[2]==='-');
for(const p of originals)for(const variant of ['mirror','rotate','vertical']){
  const next=transformPuzzle(p,variant);if(next)puzzleData.push(next);
}
let queue=[];
function newQueue(){
  const difficulty=Number($('trainingDifficulty').value);
  const eligible=puzzleData.map((p,i)=>({p,i})).filter(({p})=>p.skill!=='Egne partier'&&(difficulty===1?!p.mirrored||p.skill==='Matt':difficulty===2?p.skill!=='Åpning':p.skill==='Matt'||p.skill==='Gaffel'||p.skill==='Binding'));
  queue=eligible.map(({p,i})=>{
    const r=stats.puzzles[puzzleKey(p)]||{right:0,wrong:0,last:0,streak:0};
    const category=stats.skills[p.skill]||{attempts:0,correct:0};
    const categoryError=category.attempts?(category.attempts-category.correct)/category.attempts:0;
    const elapsed=r.last?(Date.now()-r.last)/86400000:100;
    // New positions stay in rotation. A mistake makes a position return;
    // two consecutive correct repetitions gradually reduce its priority.
    const weight=categoryError*2+Math.min(3,r.wrong)*2-Math.min(3,r.streak)*1.5+(r.last?Math.min(2,elapsed/2):-0.5)+Math.random()*1.5;
    return {i,weight};
  }).sort((a,b)=>b.weight-a.weight).map(x=>x.i);
}
function expectedStep(){return trainingStage===0?{from:puzzle.from,to:puzzle.to}:puzzle.continuation[1]}
function threatenedPieces(position,color){
  const enemy=color==='w'?'b':'w',names={q:'dronningen',r:'tårnet',b:'løperen',n:'springeren',p:'bonden'};
  const found=[];
  for(const row of position.board())for(const piece of row){
    if(!piece||piece.color!==color||piece.type==='k')continue;
    const sq=piece.square;
    if(position.isAttacked(sq,enemy))found.push({square:sq,name:names[piece.type],value:value[piece.type],defended:position.isAttacked(sq,color)});
  }
  return found.sort((a,b)=>b.value-a.value);
}
function explainThreats(position=training){
  if(position.isCheck())return {square:null,text:'Kongen er i sjakk. Før du gjør noe annet må sjakken stoppes. Se etter å flytte kongen, slå angriperen eller blokkere angrepet.'};
  const threatened=threatenedPieces(position,position.turn());
  if(!threatened.length)return {square:null,text:'Ingen av dine brikker står under direkte angrep akkurat nå. Se videre etter sjakker, slag, trusler og ubeskyttede brikker hos motstanderen.'};
  const top=threatened[0];
  const attackers=position.attackers(top.square,position.turn()==='w'?'b':'w');
  const attackersText=attackers.map(sq=>{const piece=position.get(sq);return `${{p:'bonden',n:'springeren',b:'løperen',r:'tårnet',q:'dronningen',k:'kongen'}[piece?.type]||'brikken'} på ${sq}`}).join(' og ');
  const legal=position.moves({verbose:true});
  const captures=legal.filter(m=>attackers.includes(m.to));
  const escapes=legal.filter(m=>m.from===top.square&&(()=>{const next=new Chess(position.fen());next.move(m);return !next.isAttacked(m.to,next.turn())})());
  const options=[];
  if(captures.length)options.push(`Slå angriperen: ${captures.slice(0,2).map(m=>m.san).join(' eller ')}.`);
  if(escapes.length)options.push(`Flytt ${top.name} til et tryggere felt, for eksempel ${escapes.slice(0,2).map(m=>m.san).join(' eller ')}.`);
  if(!options.length)options.push('Undersøk om du kan forsvare brikken, bytte brikker eller finne et taktisk mellomtrekk.');
  return {square:top.square,text:`${top.name.charAt(0).toUpperCase()+top.name.slice(1)} på ${top.square} angripes av ${attackersText}${top.defended?', men har også forsvar':', og er ikke direkte forsvart'}. ${options.join(' ')} Dette er kandidater, ikke en fasit: kontroller motstanderens beste svar før du bestemmer deg.`};
}
const showThreats=document.createElement('button');showThreats.id='showThreats';showThreats.className='secondary';showThreats.type='button';showThreats.textContent='♛ Hva er truet i stillingen?';
$('puzzleHint').after(showThreats);
showThreats.onclick=()=>{if(checkingAlternative)return;const result=explainThreats();trainHint=result.square;$('puzzleFeedback').textContent=result.text;$('puzzleFeedback').style.color='#e2d39f';renderPuzzle()};
const compareMoves=document.createElement('button');compareMoves.id='compareMoves';compareMoves.className='secondary';compareMoves.type='button';compareMoves.textContent='⚖ Sammenlign tre trekk med Stockfish';
showThreats.after(compareMoves);
const comparisonPreview=document.createElement('div');comparisonPreview.id='comparisonPreview';comparisonPreview.className='comparison-preview hidden';
comparisonPreview.innerHTML='<p class="muted">Trykk på et alternativ for å se trekkene på brettet.</p><div class="comparison-choices"></div><div class="board-frame comparison-frame"><div id="comparisonBoard" class="chessboard" aria-label="Analysebrett"></div></div><p class="muted comparison-caption" aria-live="polite"></p><div class="comparison-steps"><button type="button" class="secondary" data-step="0">Startstilling</button><button type="button" class="secondary" data-step="1">Ditt trekk</button><button type="button" class="secondary" data-step="2">Motstanderens svar</button></div>';
compareMoves.after(comparisonPreview);
function clearComparison(){comparisonPreview.classList.add('hidden');comparisonPreview.querySelector('.comparison-choices').replaceChildren()}
compareMoves.onclick=async()=>{
  if(checkingAlternative)return;
  if(!engine.ready){$('puzzleFeedback').textContent='Stockfish starter fortsatt. Prøv sammenligningen igjen om litt.';return}
  // Compare from the original exercise, even after the player has solved it.
  const startPosition=new Chess(puzzle.fen);
  const legal=startPosition.moves({verbose:true}),threat=threatenedPieces(startPosition,startPosition.turn())[0];
  const attackers=threat?startPosition.attackers(threat.square,startPosition.turn()==='w'?'b':'w'):[];
  const candidates=[];
  const add=(move,reason)=>{if(move&&!candidates.some(c=>c.move.from===move.from&&c.move.to===move.to))candidates.push({move,reason})};
  const round=trainingRound,fen=startPosition.fen();checkingAlternative=true;compareMoves.disabled=true;
  clearComparison();
  $('puzzleFeedback').textContent='Stockfish sammenligner trekkene. Dette kan ta noen sekunder …';
  try{
    // Include what Freddy played, the exercise's recommendation, and the engine's
    // own best move before filling any remaining slots with useful alternatives.
    const played=training.history({verbose:true})[0];
    if(played)add(legal.find(m=>m.from===played.from&&m.to===played.to&&m.promotion===played.promotion),'trekket du spilte');
    add(legal.find(m=>m.from===puzzle.from&&m.to===puzzle.to),'treningsforslaget');
    const bestSearch=await engine.search(fen,{ms:650,skill:20});
    if(round!==trainingRound)return;
    if(typeof bestSearch.move==='string'&&/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestSearch.move)){
      add(legal.find(m=>m.from===bestSearch.move.slice(0,2)&&m.to===bestSearch.move.slice(2,4)&&(!m.promotion||m.promotion===(bestSearch.move[4]||'q'))),'Stockfish sitt forslag');
    }
    add(legal.find(m=>attackers.includes(m.to)),'slår en angripende brikke');
    add(legal.find(m=>m.from===threat?.square&&(()=>{const next=new Chess(fen);next.move(m);return !next.isAttacked(m.to,next.turn())})()),'flytter en truet brikke');
    add(legal.find(m=>['n','b'].includes(m.piece)),'utvikler en lett offiser');
    for(const move of legal){if(candidates.length>=3)break;add(move,move.captured?'slår en brikke':'et annet lovlig valg')}
    if(!candidates.length)throw new Error('Ingen lovlige trekk å sammenligne i denne stillingen');
    const results=[];
    for(const candidate of candidates.slice(0,3)){
      const next=new Chess(fen);next.move(candidate.move);
      // After our candidate move Stockfish evaluates from the opponent's point of view.
      const evaluation=await engine.search(next.fen(),{ms:650,skill:20});
      if(round!==trainingRound)return;
      if(!Number.isFinite(evaluation.score))throw new Error('Ingen gyldig motorevaluering');
      let reply='',replyMove=null;
      if(typeof evaluation.move==='string'&&/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(evaluation.move)){
        try{
          const response=next.move({from:evaluation.move.slice(0,2),to:evaluation.move.slice(2,4),promotion:evaluation.move[4]||'q'});
          reply=response?.san||'';replyMove=response?{from:response.from,to:response.to,promotion:response.promotion||'q'}:null;
        }catch{/* A returned principal variation may be unavailable in this position */}
      }
      results.push({...candidate,score:-evaluation.score,reply,replyMove});
    }
    results.sort((a,b)=>b.score-a.score);
    const best=results[0].score;
    const lines=results.map((r,i)=>`${i+1}. ${r.move.san} (${r.reason})${r.reply?' → motstanderen svarer '+r.reply:''}${i===0?' – beste av disse':' – ca. '+Math.max(0,Math.round((best-r.score)/10)/10)+' bondepoeng svakere'}`);
    $('puzzleFeedback').textContent=`Stockfish sammenlignet ${results.length} kandidater: ${lines.join(' · ')}. Motstanderens svar er motorens forslag ved kort betenkningstid, ikke en garantert fortsettelse.`;
    $('puzzleFeedback').style.color='#e2d39f';
    const choices=comparisonPreview.querySelector('.comparison-choices');choices.replaceChildren();comparisonPreview.classList.remove('hidden');
    const view=(result,step)=>{
      const position=new Chess(fen);
      if(step>=1)position.move(result.move);
      if(step>=2&&result.replyMove)position.move(result.replyMove);
      renderBoard('comparisonBoard',position,null,puzzleColor,()=>{});
      comparisonPreview.querySelector('.comparison-caption').textContent=step===0?'Startstillingen':step===1?`Valgt trekk: ${result.move.san}`:result.replyMove?`Motstanderens svar: ${result.reply} etter ${result.move.san}`:'Motoren fant ikke et tilgjengelig svar. Viser valgt trekk.';
      comparisonPreview.querySelectorAll('[data-step]').forEach(b=>{
        b.onclick=()=>view(result,Number(b.dataset.step));
        b.disabled=Number(b.dataset.step)===2&&!result.replyMove;
        b.classList.toggle('picked',Number(b.dataset.step)===step);
        b.setAttribute('aria-pressed',String(Number(b.dataset.step)===step));
      });
      [...choices.children].forEach((b,i)=>b.classList.toggle('picked',results[i]===result));
    };
    for(const result of results){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=`${result.move.san}${result.reply?' → '+result.reply:''}`;button.onclick=()=>view(result,1);choices.appendChild(button)}
    view(results[0],1);
    comparisonPreview.scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(e){$('puzzleFeedback').textContent=`Stockfish klarte ikke å fullføre sammenligningen: ${e?.message||'ukjent feil'}. Prøv igjen om litt.`}
  finally{checkingAlternative=false;compareMoves.disabled=false}
};
function loadPuzzle(){
  if(trainingOrigin==='analysis'){
    puzzle=analysisPractice[analysisPracticeIndex];
    if(!puzzle){backToAnalysis();return}
  }else{
    if(!queue.length)newQueue();const idx=queue.shift();puzzle=puzzleData[idx];
  }
  training=new Chess(puzzle.fen);puzzleColor=training.turn();puzzleSelected=null;puzzleSolved=false;puzzleMissed=false;checkingAlternative=false;trainHint=null;trainingStage=0;hintCount=0;trainingRound++;
  compareMoves.disabled=false;clearComparison();
  if(trainingOrigin==='analysis'&&analysisReturnTab==='progress'&&stats.ownQueue){stats.ownQueue.index=analysisPracticeIndex;persist()}
  $('puzzleTitle').textContent=trainingOrigin==='analysis'?puzzle.title:`Utfordring ${trainingRound}`;$('puzzleLevel').textContent=trainingOrigin==='analysis'?'Fra Chess.com-analysen din':'Tenk selv – se etter sjakker, slag og trusler';
  $('puzzleIndex').textContent=trainingOrigin==='analysis'?`Forbedringspunkt ${analysisPracticeIndex+1} av ${analysisPractice.length}`:`${puzzleData.length} varianter`;$('skillBadge').hidden=true;
  $('puzzlePrompt').textContent=trainingOrigin==='analysis'?(puzzle.prompt||'Finn en bedre fortsettelse i ditt eget parti.') :Number($('trainingDifficulty').value)===1?'Finn et godt og trygt trekk.':'Finn det sterkeste trekket i stillingen.';
  $('puzzleFeedback').textContent='Kontroller motstanderens mulige svar før du spiller.';$('puzzleFeedback').style.color='';
  $('puzzleTurn').textContent=puzzleColor==='w'?'Hvit trekker':'Svart trekker';
  const backLabel=analysisReturnTab==='progress'?'← Tilbake til treningsplanen':'← Tilbake til Chess.com-analysen';
  $('nextPuzzle').disabled=true;$('nextPuzzle').textContent=trainingOrigin==='analysis'?(analysisPracticeIndex+1<analysisPractice.length?'Neste forbedringspunkt →':backLabel):'Neste oppgave →';$('puzzleHint').disabled=Number($('trainingDifficulty').value)===3;
  $('analysisBack').hidden=trainingOrigin!=='analysis';$('analysisBack').textContent=backLabel;$('skipPuzzle').textContent=trainingOrigin==='analysis'?(analysisPracticeIndex+1<analysisPractice.length?'Hopp over og gå videre →':backLabel):'Hopp over uten å se svaret';
  if($('showLine'))$('showLine').hidden=true;renderPuzzle();
}
function renderPuzzle(){renderBoard('puzzleBoard',training,puzzleSelected,puzzleColor,onPuzzleSquare,trainHint)}
function finishPuzzle(){
  // A position solved only after a wrong guess is not a first-try success.
  if(!puzzleMissed)recordPuzzleAttempt(true);
  const skill=stats.skills[puzzle.skill]||{attempts:0,correct:0};skill.attempts++;if(!puzzleMissed)skill.correct++;stats.skills[puzzle.skill]=skill;stats.attempts++;
  stats.solved++;stats.streak++;stats.xp+=Math.max(5,Number($('trainingDifficulty').value)*12-hintCount*3);stats.daily.count++;puzzleSolved=true;
  $('skillBadge').textContent='✦ '+puzzle.skill;$('skillBadge').hidden=false;
  $('puzzleTitle').textContent=puzzle.title;$('puzzleFeedback').textContent='✓ Riktig! '+puzzle.explain;
  $('puzzleFeedback').style.color='#c2e6a8';$('puzzleTurn').textContent='Kombinasjonen løst!';
  $('nextPuzzle').disabled=false;$('puzzleHint').disabled=true;
  if(trainingOrigin==='analysis')$('skipPuzzle').textContent=analysisPracticeIndex+1<analysisPractice.length?'Hopp til neste stilling →':'← Tilbake til oversikten';
  if($('showLine'))$('showLine').hidden=Number($('trainingDifficulty').value)>=2||!puzzle.continuation;
  persist();renderPuzzle();
}
async function onPuzzleSquare(sq){
  if(puzzleSolved||checkingAlternative)return;const p=training.get(sq);
  if(puzzleSelected){
    const valid=training.moves({square:puzzleSelected,verbose:true}).find(m=>m.to===sq);
    if(valid){
      const expected=expectedStep();let correct=puzzleSelected===expected.from&&sq===expected.to;
      puzzleSelected=null;trainHint=null;
      let alternative=false;
      if(!correct&&trainingOrigin==='analysis'&&trainingStage===0){
        if(!engine.ready){$('puzzleFeedback').textContent='Motoren er ikke klar. Jeg kan ikke bedømme alternativet ditt ennå – prøv igjen om litt.';renderPuzzle();return}
        const checkedRound=trainingRound,checkedFen=training.fen();
        checkingAlternative=true;
        $('puzzleFeedback').textContent='Stockfish vurderer trekket ditt mot anbefalingen …';renderPuzzle();
        try{
          const expectedBoard=new Chess(training.fen());expectedBoard.move({...expected,promotion:'q'});
          const candidateBoard=new Chess(training.fen());candidateBoard.move(valid);
          const [expectedScore,candidateScore]=await Promise.all([
            engine.search(expectedBoard.fen(),{ms:550,skill:20}),
            engine.search(candidateBoard.fen(),{ms:550,skill:20})
          ]);
          // A user may leave this exercise while Stockfish is still working.
          if(checkedRound!==trainingRound||checkedFen!==training.fen()||trainingOrigin!=='analysis')return;
          // Both evaluations are from the opponent's perspective after our move.
          // An alternative within roughly 0.75 pawns is good enough for practice.
          const difference=candidateScore.score-expectedScore.score;
          alternative=Number.isFinite(difference)&&difference<=75;
          correct=alternative;
          if(!alternative)$('puzzleFeedback').textContent=`Dette trekket ser svakere ut (omtrent ${Math.max(0,Math.round(difference/10)/10)} bondepoeng). Se etter sjakker, slag og trusler før du prøver igjen.`;
        }catch{
          if(checkedRound!==trainingRound||checkedFen!==training.fen()||trainingOrigin!=='analysis')return;
          $('puzzleFeedback').textContent='Motoren klarte ikke å vurdere dette alternativet. Trekket regnes ikke som feil. Prøv igjen eller gå videre.';
          checkingAlternative=false;renderPuzzle();return;
        }
        checkingAlternative=false;
      }
      if(correct){
        training.move(alternative?valid:{...expected,promotion:puzzle.toPromotion||'q'});
        if(alternative){finishPuzzle();$('puzzleFeedback').textContent='✓ Godt alternativ! Stockfish vurderer trekket ditt som omtrent like godt som forslaget. '+puzzle.explain}
        else if(trainingStage===0&&puzzle.continuation&&Number($('trainingDifficulty').value)>=2){
          trainingStage=1;const reply=training.move({...puzzle.continuation[0],promotion:'q'});
          $('puzzleFeedback').textContent=`Svart/hvit svarte ${reply.san}. Nå må du finne neste trekk selv.`;
          $('puzzleTurn').textContent='Finn fortsettelsen';
        }else finishPuzzle();
      }else{
        puzzleMissed=true;
        recordPuzzleAttempt(false);
        stats.streak=0;stats.attempts++;const skill=stats.skills[puzzle.skill]||{attempts:0,correct:0};skill.attempts++;stats.skills[puzzle.skill]=skill;
        if(trainingOrigin!=='analysis')$('puzzleFeedback').textContent='Trekket er lovlig, men det gir ikke den beste fortsettelsen. Se etter motspillet og prøv igjen.';
        else {
          const after=new Chess(training.fen());after.move(valid);
          const risk=threatenedPieces(after,puzzleColor).find(t=>t.value>=500);
          if(risk)$('puzzleFeedback').textContent+=` Merk også at ${risk.name} på ${risk.square} er angrepet etter trekket. Vurder om den kan slås eller forsvares.`;
        }
        $('puzzleFeedback').style.color='#e5bb8f';
        if(trainingOrigin!=='analysis'&&!queue.includes(puzzleData.indexOf(puzzle)))queue.push(puzzleData.indexOf(puzzle));
      }
      persist();renderPuzzle();return;
    }
  }
  puzzleSelected=p?.color===training.turn()?sq:null;trainHint=null;renderPuzzle();
}
$('puzzleHint').onclick=()=>{
  if(Number($('trainingDifficulty').value)===3)return;
  hintCount++;const target=expectedStep(),piece=training.get(target.from);
  const labels={p:'bonde',n:'springer',b:'løper',r:'tårn',q:'dronning',k:'konge'};
  const messages=['Start med å undersøke sjakker, slag og ubeskyttede brikker.',`Se nærmere på en ${labels[piece?.type]||'brikke'}.`,`Brikken du trenger står på ${target.from}.`,`Vurder feltet ${target.to}.`];
  $('puzzleFeedback').textContent=messages[Math.min(hintCount-1,3)];
  if(hintCount>=4){puzzleSelected=target.from;trainHint=target.to}renderPuzzle();
};
$('trainingDifficulty').onchange=()=>{if(trainingOrigin==='analysis')return;queue=[];loadPuzzle()};
function backToAnalysis(){trainingOrigin='general';setTab(analysisReturnTab);if(analysisReturnTab==='analysis')requestAnimationFrame(()=>window.scrollTo(0,analysisScrollY))}
function completeOwnQueue(){if(analysisReturnTab==='progress'){stats.ownQueue=null;persist();$('coachAllStatus').textContent='Økten er fullført! Feilene dine prioriteres ved neste trening.'}backToAnalysis()}
$('nextPuzzle').onclick=()=>{if(trainingOrigin==='analysis'){if(analysisPracticeIndex+1<analysisPractice.length){analysisPracticeIndex++;loadPuzzle()}else completeOwnQueue()}else loadPuzzle()};
const analysisBack=document.createElement('button');analysisBack.id='analysisBack';analysisBack.className='secondary analysis-back';analysisBack.textContent='← Tilbake til Chess.com-analysen';analysisBack.hidden=true;$('trainPanel').querySelector('.training-layout').before(analysisBack);analysisBack.onclick=backToAnalysis;
const showLine=document.createElement('button');showLine.id='showLine';showLine.className='secondary';showLine.textContent='Se den viktige fortsettelsen →';showLine.hidden=true;$('nextPuzzle').before(showLine);
showLine.onclick=()=>{if(!puzzleSolved||!puzzle.continuation)return;showLine.hidden=true;const line=puzzle.continuation;let i=0;function step(){if(i>=line.length)return;const next=line[i++];const move=training.move({...next,promotion:'q'});$('puzzleTurn').textContent=`Fortsettelse: ${move.san}`;renderPuzzle();if(i<line.length)setTimeout(step,850)}step()};
const skipPuzzle=document.createElement('button');skipPuzzle.id='skipPuzzle';skipPuzzle.className='secondary';skipPuzzle.textContent='Hopp over uten å se svaret';$('nextPuzzle').after(skipPuzzle);
skipPuzzle.onclick=()=>{if(trainingOrigin==='analysis'){if(!puzzleSolved){recordPuzzleAttempt(false);stats.attempts++;stats.streak=0;persist()}if(analysisPracticeIndex+1<analysisPractice.length){analysisPracticeIndex++;loadPuzzle()}else completeOwnQueue();return}if(!puzzleSolved){recordPuzzleAttempt(false);stats.attempts++;stats.streak=0;const skill=stats.skills[puzzle.skill]||{attempts:0,correct:0};skill.attempts++;stats.skills[puzzle.skill]=skill;if(!queue.includes(puzzleData.indexOf(puzzle)))queue.push(puzzleData.indexOf(puzzle));persist()}loadPuzzle()};
const lessons=[{title:'Kontroller sentrum',tag:'ÅPNING',body:'Feltene e4, d4, e5 og d5 er sjakkbrettets knutepunkt.',points:['Flytt én eller to sentrumsbønder tidlig.','Utvikle springere og løpere mot sentrum.','Unngå å flytte samme brikke mange ganger i åpningen.']},{title:'Sikre kongen',tag:'KONGESIKKERHET',body:'Selv en sterk stilling kan rakne hvis kongen står utsatt.',points:['Gjør rokade relativt tidlig.','Unngå unødvendige bondetrekk foran kongen.','Se etter motstanderens sjakker før hvert trekk.']},{title:'Se etter taktikk',tag:'MØNSTRE',body:'Gaffel, binding og spidd er mønstre som vinner materiell.',points:['Se først etter sjakker, deretter slag og trusler.','Undersøk alle ubeskyttede brikker.','Spør: Hva truer motstanderen etter mitt trekk?']},{title:'Tenk som en trener',tag:'BESLUTNINGER',body:'En enkel sjekkliste gir færre unødvendige feil.',points:['Hva var hensikten med motstanderens trekk?','Hvilke to eller tre kandidattrekk har jeg?','Kan en av mine brikker slås gratis etterpå?']},{title:'Lær sluttspill',tag:'SLUTTSPILL',body:'Når få brikker er igjen blir kongen sterkere og bondene avgjør.',points:['Aktiver kongen.','Lag fribønder som kan forvandles.','Øv på matt med dronning og tårn.']},{title:'Bygg gode vaner',tag:'SMART TRENING',body:'Hyppig, fokusert trening med repetisjon slår ofte lange tilfeldige økter.',points:['Ta 10 minutter med taktikk daglig.','Gå gjennom partier og finn én lærdom.','Gjenta vanskelige mønstre til de sitter.']}];
$('lessons').innerHTML=lessons.map((l,i)=>`<article class="lesson"><span class="num">LEKSJON ${String(i+1).padStart(2,'0')} · ${l.tag}</span><h3>${l.title}</h3><p>${l.body}</p><ul>${l.points.map(p=>`<li>${p}</li>`).join('')}</ul><button data-lesson="${i}">${i===2||i===4?'Øv på temaet →':'Prøv i et parti →'}</button></article>`).join('');document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{if(['2','4'].includes(b.dataset.lesson)){setTab('train')}else{setTab('play')}});
analysisApi=setupAnalysis(engine,(positions,index)=>{analysisScrollY=window.scrollY;analysisReturnTab='analysis';trainingOrigin='analysis';analysisPractice=positions;analysisPracticeIndex=index;loadPuzzle();setTab('train')},summary=>{stats.analyzedGames[summary.gameId]={topics:summary.topics,count:summary.count,positions:summary.positions,date:summary.date,white:summary.white,black:summary.black,checked:summary.checked,analysisVersion:summary.analysisVersion};const keys=Object.keys(stats.analyzedGames);if(keys.length>100)delete stats.analyzedGames[keys[0]];persist()});
$('coachAnalyze').onclick=()=>setTab('analysis');
function startOwnPractice(positions,resumeIndex=0){
  if(!positions.length){setTab('analysis');return}
  analysisPractice=positions;analysisPracticeIndex=resumeIndex;analysisReturnTab='progress';trainingOrigin='analysis';
  stats.ownQueue={keys:positions.map(puzzleKey),index:resumeIndex};
  persist();loadPuzzle();setTab('train');
}
$('coachFive').onclick=()=>{
  startOwnPractice(allOwnPositions().slice(-5).reverse());
};
function rankedOwnPositions(){
  const topic=$('chessThemeFilter').value;
  const positions=allOwnPositions().filter(p=>topic==='alle'||p.topic===topic);
  // Prioritize incorrectly solved positions, then older attempts, then new positions.
  positions.sort((a,b)=>{
    const x=stats.puzzles[puzzleKey(a)]||{},y=stats.puzzles[puzzleKey(b)]||{};
    const priority=p=>(p.wrong||0)*3-(p.streak||0)*2+(p.last?Math.min(4,(Date.now()-p.last)/86400000):5);
    return priority(y)-priority(x);
  });
  return positions;
}
$('coachAll').onclick=()=>{
  const positions=rankedOwnPositions();
  $('coachAllStatus').textContent=positions.length?`Starter ${positions.length} stillinger. Du kan gå tilbake til oversikten når du vil.`:'Ingen stillinger for valgt tema. Velg et annet tema.';
  startOwnPractice(positions);
};
$('coachTen').onclick=()=>startOwnPractice(rankedOwnPositions().slice(0,10));
$('resumeOwnTraining').onclick=()=>{
  const saved=stats.ownQueue;if(!saved?.keys?.length)return;
  const map=new Map(allOwnPositions().map(p=>[puzzleKey(p),p]));
  const positions=saved.keys.map(k=>map.get(k)).filter(Boolean);
  if(!positions.length){stats.ownQueue=null;persist();return}
  startOwnPractice(positions,Math.min(saved.index,positions.length-1));
};
$('chessThemeFilter').onchange=()=>{
  const topic=$('chessThemeFilter').value,count=allOwnPositions().filter(p=>topic==='alle'||p.topic===topic).length;
  $('coachAllStatus').textContent=`${count} treningsstillinger tilgjengelig for valgt tema.`;
};
const motorStatus=document.createElement('div');motorStatus.className='motor-status';motorStatus.textContent='♜ Stockfish starter …';$('difficultyText').after(motorStatus);engine.onReady(()=>{motorStatus.textContent='♜ Stockfish er klar';motorStatus.classList.add('ready')});
newQueue();loadPuzzle();updateGame();persist();setTab('play');
