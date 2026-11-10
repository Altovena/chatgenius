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
  old.last=Date.now();
  old.history ||= [];
  old.history.push({at:old.last,correct:Boolean(success)});
  if(old.history.length>30)old.history=old.history.slice(-30);
  stats.puzzles[key]=old;
  if(trainingOrigin==='analysis'){
    // Spaced repetition: difficult positions return sooner; repeated successes extend the interval.
    const recentErrors=old.history.slice(-5).filter(entry=>!entry.correct).length;
    const baseDays=[0,1,3,7,14,30,60][Math.min(6,old.streak)];
    const intervalDays=success?Math.max(old.streak>=2?1:0,Math.round(baseDays/(1+recentErrors*0.35))):0;
    old.nextReview=old.last+intervalDays*86400000;
  }
}
function archiveFinishedGame(){
  if(!gameRecorded||(!game.isGameOver()&&!currentGameOutcome().mate))return;
  const pgn=game.pgn({maxWidth:0,newline:'\n'});
  if(!pgn||game._archivedToHistory)return;
  const result=currentGameOutcome().mate?(game.turn()==='b'?'1-0':'0-1'):'1/2-1/2';
  const record={client_game_id:globalThis.crypto?.randomUUID?.()||`academy-${Date.now()}-${Math.random().toString(36).slice(2)}`,source:'academy',pgn,result,opponent:'Stockfish',difficulty:$('difficulty')?.selectedOptions?.[0]?.textContent||'Datamaskinen',played_at:new Date().toISOString()};
  try{const list=JSON.parse(localStorage.getItem('freddyChessSavedGames')||'[]');list.unshift(record);localStorage.setItem('freddyChessSavedGames',JSON.stringify(list.slice(0,60)));game._archivedToHistory=true;window.dispatchEvent(new CustomEvent('chess:game-saved',{detail:record}))}catch(e){console.warn('Kunne ikke lagre lokal sjakkhistorikk',e)}
}
function persist(){localStorage.setItem('freddyChessProgress',JSON.stringify(stats));archiveFinishedGame();window.dispatchEvent(new Event('chess:progress-saved'));updateStats();updateCoach()}
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
    if(!result.has(topic))result.set(topic,{topic,total:0,trained:0,mastered:0,wrong:0,due:0,lossTotal:0,lossSamples:0});
    const row=result.get(topic),attempt=stats.puzzles[puzzleKey(p)];
    row.total++;
    if(Number.isFinite(p.loss)&&p.loss>=0){row.lossTotal+=Math.min(p.loss,1000);row.lossSamples++;}
    if(attempt?.right||attempt?.wrong)row.trained++;
    if((attempt?.streak||0)>=2)row.mastered++;
    row.wrong+=attempt?.wrong||0;
    if(!attempt?.right||!Number.isFinite(attempt.nextReview)||attempt.nextReview<=Date.now())row.due++;
  }
  return [...result.values()].sort((a,b)=>{const priority=x=>x.due*(1+Math.min(x.lossSamples?x.lossTotal/x.lossSamples:100,600)/300);return priority(b)-priority(a)||b.total-a.total;});
}
function updateGameTrend(analyzed){
  let root=$('gameTrend');
  if(!root){
    root=document.createElement('section');root.id='gameTrend';root.className='game-trend';
    $('ownLearningStats').after(root);
  }
  root.replaceChildren();
  const heading=document.createElement('h3');heading.textContent='Utvikling fra parti til parti';root.appendChild(heading);
  const cohorts=[
    {source:'academy',label:'Mot datamaskinen'},
    {source:'imported',label:'Chess.com'}
  ];
  for(const cohort of cohorts){
    const section=document.createElement('section');section.className='game-trend-cohort';
    const title=document.createElement('h4');title.textContent=cohort.label;section.appendChild(title);
    const tracked=analyzed.filter(g=>g.source===cohort.source&&g.analysisVersion>=4&&g.checked>0&&g.date&&Number.isFinite(Number(g.count)))
      .sort((a,b)=>a.date.localeCompare(b.date)).slice(-20);
    if(!tracked.length){
      const empty=document.createElement('p');empty.className='muted';
      empty.textContent='Ingen sammenlignbare analyser ennå. Analyser flere partier for å se utviklingen.';
      section.appendChild(empty);root.appendChild(section);continue;
    }
    const latest=tracked.slice(-5),previous=tracked.slice(-10,-5);
    const mean=arr=>arr.reduce((sum,g)=>sum+g.count/g.checked*100,0)/arr.length;
    const recentRate=mean(latest),earlierRate=previous.length?mean(previous):null;
    const summary=document.createElement('p');summary.className='muted';
    summary.textContent=`Siste ${latest.length} partier: ${Math.round(recentRate)} forbedringspunkter per 100 undersøkte trekk. ${earlierRate===null?'Analyser minst seks partier for sammenligning.':`Foregående ${previous.length}: ${Math.round(earlierRate)}. ${recentRate<earlierRate?'Færre funn i den nyeste gruppen.':recentRate>earlierRate?'Flere funn i den nyeste gruppen.':'Omtrent samme nivå.'}`}`;
    section.appendChild(summary);
    const chart=document.createElement('div');chart.className='game-trend-chart';chart.setAttribute('role','list');
    for(const record of tracked){
      const rate=Math.min(100,record.count/record.checked*100);
      const item=document.createElement('div');item.className='game-trend-item';item.setAttribute('role','listitem');
      const bar=document.createElement('div');bar.className='game-trend-bar';bar.style.height=`${Math.max(5,rate)}%`;
      const date=document.createElement('small');date.textContent=(record.date||'').slice(-5);
      item.setAttribute('aria-label',`${record.date}: ${record.count} funn i ${record.checked} undersøkte trekk (${Math.round(rate)} %). ${record.white} – ${record.black}`);
      item.append(bar,date);chart.appendChild(item);
    }
    section.appendChild(chart);root.appendChild(section);
  }
  const disclaimer=document.createElement('small');disclaimer.className='muted';
  disclaimer.textContent='Kortere søyler betyr færre funn per undersøkte trekk. Grafene viser bare analyser med samme metode; motstandere, vanskelighetsgrad og utvalgte stillinger kan variere. Ikke sammenlign søylene direkte mellom de to spilltypene.';
  root.appendChild(disclaimer);
}
function updateTopicTrends(analyzed){
  let root=$('topicTrends');
  if(!root){
    root=document.createElement('section');root.id='topicTrends';root.className='own-topic-guidance';
    $('gameTrend').after(root);
  }
  root.replaceChildren();
  const title=document.createElement('h3');title.textContent='Hvilke feil gjør du sjeldnere?';root.appendChild(title);
  const records=analyzed.filter(g=>g.source==='imported'&&g.analysisVersion>=4&&g.checked>0&&g.date&&Array.isArray(g.topics))
    .sort((a,b)=>a.date.localeCompare(b.date));
  if(records.length<6){
    const note=document.createElement('p');note.className='muted';note.textContent='Analyser minst seks Chess.com-partier med den nye metoden for å sammenligne feiltypene. Partier mot datamaskinen vurderes separat.';root.appendChild(note);return;
  }
  const latest=records.slice(-5),previous=records.slice(-10,-5);
  const totals=new Map();
  for(const game of [...latest,...previous])for(const topic of game.topics)totals.set(topic,(totals.get(topic)||0)+1);
  const top=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,4);
  const rate=(games,topic)=>{
    const checked=games.reduce((sum,g)=>sum+g.checked,0);
    const count=games.reduce((sum,g)=>sum+g.topics.filter(t=>t===topic).length,0);
    return checked?100*count/checked:0;
  };
  for(const [topic] of top){
    const before=rate(previous,topic),after=rate(latest,topic);
    const row=document.createElement('div');row.className='own-topic-row';
    const header=document.createElement('div');const name=document.createElement('strong');name.textContent=topic;
    const change=document.createElement('span');change.textContent=after<before?'Færre funn':after>before?'Flere funn':'Uendret';
    header.append(name,change);
    const detail=document.createElement('small');detail.textContent=`Per 100 undersøkte trekk: tidligere ${before.toFixed(1)} → siste fem ${after.toFixed(1)}`;
    row.append(header,detail);
    const available=allOwnPositions().filter(p=>p.topic===topic).length;
    const train=document.createElement('button');train.className='secondary';
    train.textContent=available?`Tren på ${topic.toLowerCase()} (${Math.min(10,available)}) →`:'Ingen lagrede øvelser ennå';
    train.disabled=!available;
    train.onclick=()=>{
      const filter=$('chessThemeFilter');
      if(![...filter.options].some(option=>option.value===topic)){
        $('coachAllStatus').textContent='Temaet har ingen tilgjengelige øvelser ennå.';return;
      }
      filter.value=topic;
      $('coachTen').click();
    };
    row.appendChild(train);root.appendChild(row);
  }
  const caveat=document.createElement('p');caveat.className='muted';caveat.textContent='Dette er en indikasjon, ikke en presis ferdighetsmåling. Motoren undersøker et utvalg trekk, og feiltypene er automatiske kategorier. Sammenlign bare innenfor Chess.com-gruppen.';root.appendChild(caveat);
}
function updateSessionHistory(){
  let root=$('sessionHistory');
  if(!root){
    root=document.createElement('section');root.id='sessionHistory';root.className='own-topic-guidance';
    $('practiceProgress').after(root);
  }
  root.replaceChildren();
  const heading=document.createElement('h3');heading.textContent='Treningshistorikk';root.appendChild(heading);
  const sessions=(stats.practiceSessions||[]).filter(s=>Number.isFinite(s.at)&&Number.isFinite(s.correct)&&Number.isFinite(s.wrong)).slice(-14);

  const days=new Set(sessions.map(s=>new Date(s.at).toLocaleDateString('sv-SE')));
  const totals=sessions.reduce((a,s)=>({correct:a.correct+s.correct,wrong:a.wrong+s.wrong}),{correct:0,wrong:0});
  const summary=document.createElement('p');summary.className='muted';
  summary.textContent=`${sessions.length} fullførte økter · ${days.size} treningsdager · ${totals.correct+totals.wrong?Math.round(100*totals.correct/(totals.correct+totals.wrong)):0} % riktige totalt.`;
  root.appendChild(summary);
  const allSessions=(stats.practiceSessions||[]).filter(s=>Number.isFinite(s.at));
  const dayKeys=[...new Set(allSessions.map(s=>new Date(s.at).toLocaleDateString('sv-SE')))].sort();
  const dayNumber=key=>Math.floor(Date.parse(key+'T00:00:00Z')/86400000);
  let longest=0,run=0;
  for(let i=0;i<dayKeys.length;i++){
    run=i>0&&dayNumber(dayKeys[i])-dayNumber(dayKeys[i-1])===1?run+1:1;
    longest=Math.max(longest,run);
  }
  const todayKey=today(),yesterday=new Date(Date.now()-86400000).toLocaleDateString('sv-SE');
  let streak=0;
  if(dayKeys.length&&(dayKeys.at(-1)===todayKey||dayKeys.at(-1)===yesterday)){
    streak=1;
    for(let i=dayKeys.length-1;i>0&&dayNumber(dayKeys[i])-dayNumber(dayKeys[i-1])===1;i--)streak++;
  }
  const goal=Number.isInteger(stats.weeklyPracticeGoal)&&stats.weeklyPracticeGoal>=1&&stats.weeklyPracticeGoal<=7?stats.weeklyPracticeGoal:3;
  const weekStart=new Date();weekStart.setHours(0,0,0,0);
  const weekday=(weekStart.getDay()+6)%7;weekStart.setDate(weekStart.getDate()-weekday);
  const weeklyDays=dayKeys.filter(key=>new Date(key+'T12:00:00')>=weekStart).length;
  const progress=document.createElement('p');progress.className='muted';
  progress.textContent=`Treningsserie: ${streak} dager · lengste serie: ${longest} dager · denne uken: ${weeklyDays} av ${goal} treningsdager.`;
  root.appendChild(progress);
  const goalRow=document.createElement('div');goalRow.className='own-topic-row';
  const goalLabel=document.createElement('label');goalLabel.textContent='Mitt ukentlige treningsmål: ';
  const goalSelect=document.createElement('select');goalSelect.setAttribute('aria-label','Treningsdager per uke');
  for(let n=1;n<=7;n++){const option=new Option(`${n} ${n===1?'dag':'dager'}`,String(n));goalSelect.add(option);}
  goalSelect.value=String(goal);
  goalSelect.onchange=()=>{stats.weeklyPracticeGoal=Number(goalSelect.value);persist();updateSessionHistory();};
  goalLabel.appendChild(goalSelect);goalRow.appendChild(goalLabel);root.appendChild(goalRow);
  const week=document.createElement('div');week.className='own-topic-row';
  const weekHeading=document.createElement('strong');weekHeading.textContent='Denne uken (mandag–søndag)';week.appendChild(weekHeading);
  const dayRow=document.createElement('div');dayRow.style.display='grid';dayRow.style.gridTemplateColumns='repeat(7,minmax(0,1fr))';dayRow.style.gap='6px';dayRow.style.marginTop='10px';
  for(let offset=0;offset<7;offset++){
    const date=new Date(weekStart);date.setDate(weekStart.getDate()+offset);
    const key=date.toLocaleDateString('sv-SE');
    const completed=dayKeys.includes(key),future=date.getTime()>Date.now();
    const cell=document.createElement('div');cell.style.textAlign='center';cell.style.padding='8px 2px';cell.style.borderRadius='8px';
    cell.style.background=completed?'var(--accent, #587d68)':'rgba(128,128,128,.12)';
    cell.style.color=completed?'white':'inherit';
    cell.style.opacity=future?'.55':'1';
    cell.textContent=['Man','Tir','Ons','Tor','Fre','Lør','Søn'][offset]+(completed?' ✓':'');
    cell.setAttribute('aria-label',`${date.toLocaleDateString('nb-NO',{weekday:'long',day:'numeric',month:'long'})}: ${completed?'trening gjennomført':future?'kommende dag':'ingen fullført økt'}`);
    dayRow.appendChild(cell);
  }
  week.appendChild(dayRow);
  const remaining=document.createElement('small');remaining.className='muted';
  remaining.textContent=weeklyDays>=goal?'Ukens mål er nådd!':`${goal-weeklyDays} treningsdag${goal-weeklyDays===1?'':'er'} igjen til ukesmålet.`;
  week.appendChild(remaining);root.appendChild(week);
  if(!sessions.length){
    const empty=document.createElement('p');empty.className='muted';
    empty.textContent='Fullfør en treningsøkt for å se utviklingen i riktigprosent.';root.appendChild(empty);return;
  }
  const chart=document.createElement('div');chart.className='game-trend-chart';chart.setAttribute('role','list');
  for(const session of sessions){
    const total=session.correct+session.wrong,percent=total?Math.round(100*session.correct/total):0;
    const item=document.createElement('div');item.className='game-trend-item';item.setAttribute('role','listitem');
    item.setAttribute('aria-label',`${new Date(session.at).toLocaleDateString('nb-NO')}: ${session.correct} riktige av ${total} forsøk, ${percent} prosent.`);
    const bar=document.createElement('div');bar.className='game-trend-bar';bar.style.height=`${Math.max(5,percent)}%`;
    const label=document.createElement('small');label.textContent=new Date(session.at).toLocaleDateString('nb-NO',{day:'2-digit',month:'2-digit'});
    item.append(bar,label);chart.appendChild(item);
  }
  root.appendChild(chart);
  const note=document.createElement('small');note.className='muted';note.textContent='Høyere søyler betyr større andel riktige forsøk. Grafen viser de siste 14 lagrede øktene, ikke partier.';root.appendChild(note);
}
function updatePracticeProgress(positions){
  let root=$('practiceProgress');
  if(!root){
    root=document.createElement('section');root.id='practiceProgress';root.className='own-topic-guidance';
    $('ownLearningStats').after(root);
  }
  root.replaceChildren();
  const title=document.createElement('h3');title.textContent='Blir du bedre på øvelsene?';root.appendChild(title);
  const now=Date.now();
  const due=positions.filter(p=>{const a=stats.puzzles[puzzleKey(p)];return !a?.right||!Number.isFinite(a.nextReview)||a.nextReview<=now;});
  const upcoming=positions.filter(p=>{const a=stats.puzzles[puzzleKey(p)];return a?.right&&Number.isFinite(a.nextReview)&&a.nextReview>now;});
  const mastered=positions.filter(p=>(stats.puzzles[puzzleKey(p)]?.streak||0)>=2);
  const schedule=document.createElement('p');schedule.className='muted';
  schedule.textContent=`Treningsplan: ${due.length} klare nå · ${upcoming.length} planlagt senere · ${mastered.length} av ${positions.length} mestret.`;
  root.appendChild(schedule);
  if(positions.length){
    const daily=document.createElement('button');daily.className='secondary';
    daily.textContent='Start dagens treningsøkt (inntil 10 stillinger) →';
    daily.onclick=()=>{
      const all=allOwnPositions();
      const now=Date.now();
      const dueItems=all.filter(p=>{
        const a=stats.puzzles[puzzleKey(p)];
        return a?.right&&(!Number.isFinite(a.nextReview)||a.nextReview<=now);
      });
      const newItems=all.filter(p=>{
        const a=stats.puzzles[puzzleKey(p)];
        return !a?.right&&!a?.wrong;
      });
      const missed=all.filter(p=>{
        const a=stats.puzzles[puzzleKey(p)];
        return a?.wrong&&!a?.right;
      });
      const pick=(items,count)=>items.sort((a,b)=>{
        const x=stats.puzzles[puzzleKey(a)]||{},y=stats.puzzles[puzzleKey(b)]||{};
        return (x.nextReview||0)-(y.nextReview||0)||(x.last||0)-(y.last||0);
      }).slice(0,count);
      const chosen=[...pick(dueItems,6),...pick(missed,2),...pick(newItems,2)];
      const seen=new Set();
      const session=chosen.filter(p=>{const key=puzzleKey(p);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,10);
      if(session.length<10){
        const extra=all.filter(p=>!seen.has(puzzleKey(p))&&(!stats.puzzles[puzzleKey(p)]?.right||!Number.isFinite(stats.puzzles[puzzleKey(p)]?.nextReview)||stats.puzzles[puzzleKey(p)].nextReview<=now));
        for(const p of extra.slice(0,10-session.length))session.push(p);
      }
      startOwnPractice(session);
    };
    root.appendChild(daily);
  }
  if(due.length){
    const start=document.createElement('button');start.className='secondary';
    start.textContent=`Tren ${Math.min(10,due.length)} oppgaver som er klare nå →`;
    start.onclick=()=>{
      const ranked=rankedOwnPositions().filter(p=>{const a=stats.puzzles[puzzleKey(p)];return !a?.right||!Number.isFinite(a.nextReview)||a.nextReview<=Date.now();});
      startOwnPractice(ranked.slice(0,10));
    };
    root.appendChild(start);
  }
  if(upcoming.length){
    const next=Math.min(...upcoming.map(p=>stats.puzzles[puzzleKey(p)].nextReview));
    const nextDate=document.createElement('p');nextDate.className='muted';
    nextDate.textContent=`Neste planlagte repetisjon: ${new Date(next).toLocaleDateString('nb-NO')}.`;
    root.appendChild(nextDate);
  }
  const keys=new Set(positions.map(puzzleKey));
  const attempts=[...keys].flatMap(key=>(stats.puzzles[key]?.history||[]).map(h=>({...h,key})))
    .filter(h=>Number.isFinite(h.at)&&typeof h.correct==='boolean').sort((a,b)=>a.at-b.at);
  if(!attempts.length){
    const note=document.createElement('p');note.className='muted';
    note.textContent='Fullfør treningsstillinger for å begynne å måle utviklingen. Tidligere resultater beholdes, men har ikke detaljert forsøkshistorikk.';
    root.appendChild(note);return;
  }
  const recent=attempts.slice(-20),prior=attempts.slice(-40,-20);
  const percent=arr=>Math.round(100*arr.filter(x=>x.correct).length/arr.length);
  const line=document.createElement('p');line.className='muted';
  line.textContent=`Siste ${recent.length} forsøk: ${percent(recent)} % riktige.`+(prior.length?` Forrige ${prior.length}: ${percent(prior)} %.`:' Flere forsøk trengs for å sammenligne perioder.');
  root.appendChild(line);
  const topics=topicLearningSnapshot(positions);
  for(const item of topics.slice(0,4)){
    const row=document.createElement('div');row.className='own-topic-row';
    const header=document.createElement('div');const name=document.createElement('strong');name.textContent=item.topic;
    const status=document.createElement('span');status.textContent=`${item.mastered} av ${item.total} mestret`;
    header.append(name,status);
    const track=document.createElement('div');track.className='own-topic-track';
    const fill=document.createElement('i');fill.style.width=`${item.total?Math.round(item.mastered/item.total*100):0}%`;track.appendChild(fill);
    row.append(header,track);root.appendChild(row);
  }
  const caveat=document.createElement('small');caveat.className='muted';caveat.textContent='Riktigprosenten gjelder registrerte øvingsforsøk, ikke partier. To riktige på rad regnes som mestret; repetisjon kan fortsatt være nødvendig.';root.appendChild(caveat);
}
function updateChessDashboard(positions){
  let root=$('chessDashboard');
  if(!root){
    root=document.createElement('section');root.id='chessDashboard';root.className='own-topic-guidance';
    $('allGamesSummary').after(root);
  }
  root.replaceChildren();
  const heading=document.createElement('h3');heading.textContent='Din sjakktrening i dag';root.appendChild(heading);
  const now=Date.now();
  const due=positions.filter(p=>{const a=stats.puzzles[puzzleKey(p)];return !a?.right||!Number.isFinite(a.nextReview)||a.nextReview<=now;}).length;
  const newCount=positions.filter(p=>{const a=stats.puzzles[puzzleKey(p)];return !a?.right&&!a?.wrong;}).length;
  const goal=Number.isInteger(stats.weeklyPracticeGoal)&&stats.weeklyPracticeGoal>=1&&stats.weeklyPracticeGoal<=7?stats.weeklyPracticeGoal:3;
  const weekStart=new Date();weekStart.setHours(0,0,0,0);weekStart.setDate(weekStart.getDate()-(weekStart.getDay()+6)%7);
  const sessions=(stats.practiceSessions||[]).filter(s=>Number.isFinite(s.at));
  const thisWeek=new Set(sessions.filter(s=>s.at>=weekStart.getTime()).map(s=>new Date(s.at).toLocaleDateString('sv-SE')));
  const details=document.createElement('p');details.className='muted';
  details.textContent=`${due} stillinger klare for trening · ${newCount} nye · ${thisWeek.size} av ${goal} treningsdager denne uken.`;
  root.appendChild(details);
  const track=document.createElement('div');track.className='own-topic-track';track.style.margin='10px 0';
  const fill=document.createElement('div');fill.style.width=`${Math.min(100,Math.round(thisWeek.size/goal*100))}%`;fill.style.height='100%';fill.style.background='var(--accent, #587d68)';fill.style.borderRadius='inherit';
  track.appendChild(fill);track.setAttribute('role','progressbar');track.setAttribute('aria-valuenow',String(Math.min(thisWeek.size,goal)));track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(goal));track.setAttribute('aria-label','Ukentlig treningsmål');root.appendChild(track);
  const saved=stats.ownQueue;
  if(saved?.keys?.length&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<saved.keys.length){
    const completed=saved.index,total=saved.keys.length;
    const resume=document.createElement('div');resume.className='chess-resume-card';
    const status=document.createElement('strong');status.textContent=`Forrige økt: oppgave ${completed+1} av ${total}`;
    const hint=document.createElement('p');hint.className='muted';hint.textContent=`${completed} av ${total} oppgaver passert. Fortsett der du slapp.`;
    const resumeButton=document.createElement('button');resumeButton.className='secondary';resumeButton.textContent='Fortsett forrige økt →';
    resumeButton.onclick=()=>$('resumeOwnTraining').click();
    resume.append(status,hint,resumeButton);root.appendChild(resume);
  }
  const start=document.createElement('button');start.className='secondary';
  start.textContent='Start dagens økt →';start.disabled=!positions.length;
  start.onclick=()=>{const daily=$('practiceProgress')?.querySelector('button');if(daily)daily.click();};
  root.appendChild(start);
  if(!positions.length){
    const help=document.createElement('p');help.className='muted';help.textContent='Analyser et parti først for å få personlige treningsoppgaver.';root.appendChild(help);
  }
}
function updateAllGamesPlan(){
  const analyzed=Object.values(stats.analyzedGames),positions=allOwnPositions();
  const byTopic={};
  for(const record of analyzed)for(const topic of record.topics||[])byTopic[topic]=(byTopic[topic]||0)+1;
  const review=positions.filter(p=>{const s=stats.puzzles[puzzleKey(p)];return !s?.right||!Number.isFinite(s.nextReview)||s.nextReview<=Date.now()});
  const practiced=positions.filter(p=>stats.puzzles[puzzleKey(p)]?.right).length;
  const mastered=positions.filter(p=>(stats.puzzles[puzzleKey(p)]?.streak||0)>=2).length;
  $('allGamesSummary').textContent=`${analyzed.length} analyserte partier · ${positions.length} unike treningsstillinger.`;
  updateGameTrend(analyzed);
  updateTopicTrends(analyzed);
  $('ownLearningStats').replaceChildren();
  for(const [label,count] of [['Trent minst én gang',practiced],['Klare for repetisjon',review.length],['Mestret to ganger på rad',mastered]]){
    const item=document.createElement('div');item.className='own-learning-stat';const b=document.createElement('b');b.textContent=count;const span=document.createElement('span');span.textContent=label;item.append(b,span);$('ownLearningStats').appendChild(item);
  }
  updatePracticeProgress(positions);
  updateSessionHistory();
  updateChessDashboard(positions);
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
      const detail=document.createElement('small');detail.textContent=`${item.trained} øvd på · ${item.mastered} mestret to ganger · ${item.wrong} feilforsøk`+(item.lossSamples?` · gjennomsnittlig estimert tap ${Math.round(item.lossTotal/item.lossSamples)} centipawn`:'');
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
function setTab(tab){document.body.classList.toggle('chess-playing',tab==='play');document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('hidden',p.id!==tab+'Panel'));const headings={play:['Din neste gode','Utfordre datamaskinen, oppdag mønstre og bygg ferdigheter – ett parti om gangen.'],train:['Tren blikket ditt','Gjenkjenn sjakkmønstre og lær av hver oppgave.'],analysis:['Dine partier, din læring','Analyser egne trekk med Stockfish og tren der du har mest å hente.'],learn:['Forstå spillet','Små leksjoner som gjør de neste trekkene dine bedre.'],progress:['Se hvor langt du har kommet','Hvert parti og hver oppgave bygger erfaring.'],account:['Mine sjakkpartier','Samle partier, treningshistorikk og fremgang på ett sted.']};$('pageTitle').innerHTML=headings[tab][0].replace('gode','gode <em>trekk.</em>').replace('ditt','ditt <em>sjakkblikk.</em>').replace('spillet','<em>spillet.</em>').replace('kommet','<em>kommet.</em>').replace('læring','<em>læring.</em>');$('pageDesc').textContent=headings[tab][1]}
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
// Checkmate is a check with no legal replies. Re-evaluate from FEN so that
// move generation is not affected by any temporary engine search/undo state.
function currentGameOutcome(){
  const check=game.isCheck();
  const legalReplies=check?new Chess(game.fen()).moves({verbose:true}):null;
  const mate=check&&legalReplies.length===0;
  return {check,mate,legalReplies};
}
function updateGame(){const outcome=currentGameOutcome();renderBoard('board',game,selected,orientation,onPlayerSquare,hintSquare);refreshThinkingChecklist();material();const list=$('moveList');const hist=game.history();list.innerHTML=hist.length?hist.map((m,i)=>`<div class="move-item"><span>${i%2===0?Math.floor(i/2)+1+'.':'···'}</span>${m}</div>`).join(''):'<div class="empty">Partiet er klart. Ditt første trekk venter.</div>';$('moveCount').textContent=`${hist.length} halvtrekk`;$('boardStatus').textContent=outcome.mate?'Sjakk matt':outcome.check?'Sjakk!':game.isDraw()?'Remis':thinking?'Datamaskinen tenker …':game.turn()==='w'?'Din tur til å trekke':'Datamaskinens tur';const alert=$('boardAlert');const isMate=outcome.mate,isCheck=outcome.check;alert.classList.toggle('hidden',!isMate&&!isCheck&&!game.isGameOver());alert.classList.toggle('mate',isMate);$('boardEndActions').hidden=!(isMate||game.isGameOver());$('boardAnalyzeGame').disabled=!analysisApi;if(isMate){$('boardAlertTitle').textContent='SJAKK MATT!';$('boardAlertText').textContent=game.turn()==='b'?'Gratulerer, Freddy! Du vant partiet.':'Datamaskinen vant. Prøv et nytt parti!'}else if(game.isGameOver()){$('boardAlertTitle').textContent='REMIS';$('boardAlertText').textContent=game.isStalemate()?'Patt: Spilleren som skal trekke, har ingen lovlige trekk, men er ikke i sjakk.':game.isInsufficientMaterial()?'Remis: Det er ikke nok brikker igjen til å sette sjakk matt.':'Partiet endte uavgjort.'}else if(isCheck){$('boardAlertTitle').textContent='SJAKK!';$('boardAlertText').textContent=game.turn()==='w'?'Kongen din er truet – du må svare på sjakken.':'Datamaskinens konge er truet.'}if((isMate||game.isGameOver())&&!gameRecorded){thinking=false;stats.games++;if(isMate&&game.turn()==='b'){stats.wins++;stats.xp+=30}$('coachMessage').textContent=isMate?(game.turn()==='b'?'Gratulerer! Du vant med sjakk matt.':'Sjakk matt. Se på trekkhistorikken og prøv igjen.'):'Partiet endte remis. God anledning til å analysere!';gameRecorded=true;persist()}}
function onPlayerSquare(sq){if(thinking||currentGameOutcome().mate||game.isGameOver()||game.turn()!=='w')return;const p=game.get(sq);if(selected){const possible=game.moves({square:selected,verbose:true}).find(m=>m.to===sq);if(possible){if(thinkingChecklistEnabled&&!thinkingChecklistApproved){$('thinkStatus').textContent='Svar på de tre spørsmålene og bekreft før du utfører trekket.';return}const move=game.move({from:selected,to:sq,promotion:'q'});thinkingChecklistApproved=false;resetThinkingChecklist();selected=null;hintSquare=null;$('coachMessage').textContent=describeMove(move);thinking=!currentGameOutcome().mate&&!game.isGameOver();updateGame();if(thinking)window.setTimeout(()=>computerMove(),280);return}}selected=p?.color==='w'?sq:null;hintSquare=null;updateGame()}
function evaluate(g){if(g.isCheckmate())return g.turn()==='b'?100000:-100000;if(g.isDraw())return 0;let score=0;for(let r=0;r<8;r++)for(let c=0;c<8;c++){let p=g.board()[r][c];if(!p)continue;let central=(3.5-Math.abs(c-3.5))+(3.5-Math.abs(r-3.5));let bonus=(p.type==='n'||p.type==='b'?central*7:p.type==='p'?central*3:0);score+=(p.color==='w'?1:-1)*(value[p.type]+bonus)}return score}
function orderedMoves(g){return g.moves({verbose:true}).sort((a,b)=>(b.captured?value[b.captured]+100:0)+(b.san.includes('+')?40:0)-(a.captured?value[a.captured]+100:0)-(a.san.includes('+')?40:0))}
function search(g,depth,alpha,beta){if(depth===0||g.isGameOver())return evaluate(g);const maximize=g.turn()==='w';let best=maximize?-Infinity:Infinity;for(const m of orderedMoves(g)){g.move(m);const v=search(g,depth-1,alpha,beta);g.undo();best=maximize?Math.max(best,v):Math.min(best,v);if(maximize)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(beta<=alpha)break}return best}
function fallbackComputerMove(){if(game.turn()!=='b'||game.isGameOver()){thinking=false;updateGame();return}const level=Number($('difficulty').value),moves=orderedMoves(game);let chosen;if(level===1){chosen=moves[Math.floor(Math.random()*moves.length)]}else{const depth=level<=2?1:level===3?2:3;let ranked=moves.map(m=>{game.move(m);const score=search(game,depth-1,-Infinity,Infinity);game.undo();return {m,score:score+(Math.random()-.5)*(level===2?165:level===3?60:level===4?15:4)}}).sort((a,b)=>a.score-b.score);chosen=ranked[0].m}const m=game.move(chosen);thinking=false;$('coachMessage').textContent=`Datamaskinen spilte ${m.san}. ${describeMove(m)} Se etter sjakker, slag og trusler før ditt neste trekk.`;updateGame()}
async function computerMove(){const fen=game.fen(),level=Number($('difficulty').value);if(!engine.ready){fallbackComputerMove();return}try{const result=await engine.search(fen,{skill:[0,1,4,9,18,20][level],ms:[0,130,250,450,650,900][level]});if(game.fen()!==fen||game.turn()!=='b')return;const uci=result.move;const move=game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});thinking=false;$('coachMessage').textContent=`Stockfish spilte ${move.san}. ${describeMove(move)} Se etter sjakker, slag og trusler.`;updateGame()}catch{if(game.fen()===fen)fallbackComputerMove()}}
// Keep the coach immediately below the board on mobile and before settings on every screen.
const liveCoach=$('coachMessage').closest('.panel');
// Keep game-end announcements below the board so no checkmating piece is hidden.
$('board').closest('.board-frame').after($('boardAlert'));
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
  if((!game.isGameOver()&&!currentGameOutcome().mate)||!analysisApi)return;
  const history=game.pgn({maxWidth:0,newline:'\n'});
  const pgn=`[Event "Parti mot datamaskinen"]\n[White "Freddy"]\n[Black "Datamaskinen"]\n[Result "${currentGameOutcome().mate?(game.turn()==='b'?'1-0':'0-1'):'1/2-1/2'}"]\n\n${history}`;
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
$('boardNewGame').onclick=()=>$('newGame').click();
$('boardAnalyzeGame').onclick=()=>document.getElementById('reviewFinishedGame')?.click();
$('newGame').onclick=()=>{game=new Chess();resetThinkingChecklist();selected=null;thinking=false;hintSquare=null;gameRecorded=false;$('coachMessage').textContent='Nytt parti! Et godt mål er å kontrollere sentrum, utvikle offiserene og sikre kongen.';updateGame()};$('flipBtn').onclick=()=>{orientation=orientation==='w'?'b':'w';updateGame()};$('undoBtn').onclick=()=>{if(thinking)return;game.undo();if(game.turn()==='b')game.undo();gameRecorded=false;game._archivedToHistory=false;resetThinkingChecklist();selected=null;hintSquare=null;$('coachMessage').textContent='Trekkene er angret. Prøv en annen plan.';updateGame()};$('hintBtn').onclick=()=>{if(thinking||game.turn()!=='w'||game.isGameOver())return;const moves=orderedMoves(game);let best=null,score=-Infinity;for(const m of moves){game.move(m);const v=search(game,1,-Infinity,Infinity);game.undo();if(v>score){score=v;best=m}}if(best){selected=best.from;hintSquare=best.to;$('coachMessage').textContent=`Prøv ${best.san}. Dette er et forslag basert på materiell og aktivitet – se også etter motstanderens svar.`;updateGame()}};
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
  $('puzzleTitle').textContent=trainingOrigin==='analysis'?puzzle.title:`Utfordring ${trainingRound}`;$('puzzleLevel').textContent=trainingOrigin==='analysis'?(puzzle.source==='academy'?'Fra partiet mot datamaskinen':puzzle.source==='imported'?'Fra Chess.com-partiet ditt':'Fra analysen av ditt eget parti'):'Tenk selv – se etter sjakker, slag og trusler';
  $('puzzleIndex').textContent=trainingOrigin==='analysis'?`Forbedringspunkt ${analysisPracticeIndex+1} av ${analysisPractice.length}`:`${puzzleData.length} varianter`;$('skillBadge').hidden=true;
  $('puzzlePrompt').textContent=trainingOrigin==='analysis'?(puzzle.prompt||'Finn en bedre fortsettelse i ditt eget parti.') :Number($('trainingDifficulty').value)===1?'Finn et godt og trygt trekk.':'Finn det sterkeste trekket i stillingen.';
  $('puzzleFeedback').textContent='Kontroller motstanderens mulige svar før du spiller.';$('puzzleFeedback').style.color='';
  $('puzzleTurn').textContent=puzzleColor==='w'?'Hvit trekker':'Svart trekker';
  const backLabel=analysisReturnTab==='progress'?'← Tilbake til treningsplanen':'← Tilbake til partianalysen';
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
          $('puzzleFeedback').textContent='Dette var ikke motorens anbefalte trekk. Se etter sjakker, slag og trusler før du prøver igjen.';
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
function completeOwnQueue(){if(analysisReturnTab==='progress'){stats.ownQueue=null;persist();$('coachAllStatus').textContent='Økten er fullført! Se oppsummeringen nedenfor.';showPracticeSessionSummary();updateAllGamesPlan()}backToAnalysis()}
$('nextPuzzle').onclick=()=>{if(trainingOrigin==='analysis'){if(analysisPracticeIndex+1<analysisPractice.length){analysisPracticeIndex++;loadPuzzle()}else completeOwnQueue()}else loadPuzzle()};
const analysisBack=document.createElement('button');analysisBack.id='analysisBack';analysisBack.className='secondary analysis-back';analysisBack.textContent='← Tilbake til partianalysen';analysisBack.hidden=true;$('trainPanel').querySelector('.training-layout').before(analysisBack);analysisBack.onclick=backToAnalysis;
const showLine=document.createElement('button');showLine.id='showLine';showLine.className='secondary';showLine.textContent='Se den viktige fortsettelsen →';showLine.hidden=true;$('nextPuzzle').before(showLine);
showLine.onclick=()=>{if(!puzzleSolved||!puzzle.continuation)return;showLine.hidden=true;const line=puzzle.continuation;let i=0;function step(){if(i>=line.length)return;const next=line[i++];const move=training.move({...next,promotion:'q'});$('puzzleTurn').textContent=`Fortsettelse: ${move.san}`;renderPuzzle();if(i<line.length)setTimeout(step,850)}step()};
const skipPuzzle=document.createElement('button');skipPuzzle.id='skipPuzzle';skipPuzzle.className='secondary';skipPuzzle.textContent='Hopp over uten å se svaret';$('nextPuzzle').after(skipPuzzle);
skipPuzzle.onclick=()=>{if(trainingOrigin==='analysis'){if(!puzzleSolved){if(!puzzleMissed)recordPuzzleAttempt(false);stats.attempts++;stats.streak=0;persist()}if(analysisPracticeIndex+1<analysisPractice.length){analysisPracticeIndex++;loadPuzzle()}else completeOwnQueue();return}if(!puzzleSolved){recordPuzzleAttempt(false);stats.attempts++;stats.streak=0;const skill=stats.skills[puzzle.skill]||{attempts:0,correct:0};skill.attempts++;stats.skills[puzzle.skill]=skill;if(!queue.includes(puzzleData.indexOf(puzzle)))queue.push(puzzleData.indexOf(puzzle));persist()}loadPuzzle()};
const lessons=[{title:'Kontroller sentrum',tag:'ÅPNING',body:'Feltene e4, d4, e5 og d5 er sjakkbrettets knutepunkt.',points:['Flytt én eller to sentrumsbønder tidlig.','Utvikle springere og løpere mot sentrum.','Unngå å flytte samme brikke mange ganger i åpningen.']},{title:'Sikre kongen',tag:'KONGESIKKERHET',body:'Selv en sterk stilling kan rakne hvis kongen står utsatt.',points:['Gjør rokade relativt tidlig.','Unngå unødvendige bondetrekk foran kongen.','Se etter motstanderens sjakker før hvert trekk.']},{title:'Se etter taktikk',tag:'MØNSTRE',body:'Gaffel, binding og spidd er mønstre som vinner materiell.',points:['Se først etter sjakker, deretter slag og trusler.','Undersøk alle ubeskyttede brikker.','Spør: Hva truer motstanderen etter mitt trekk?']},{title:'Tenk som en trener',tag:'BESLUTNINGER',body:'En enkel sjekkliste gir færre unødvendige feil.',points:['Hva var hensikten med motstanderens trekk?','Hvilke to eller tre kandidattrekk har jeg?','Kan en av mine brikker slås gratis etterpå?']},{title:'Lær sluttspill',tag:'SLUTTSPILL',body:'Når få brikker er igjen blir kongen sterkere og bondene avgjør.',points:['Aktiver kongen.','Lag fribønder som kan forvandles.','Øv på matt med dronning og tårn.']},{title:'Bygg gode vaner',tag:'SMART TRENING',body:'Hyppig, fokusert trening med repetisjon slår ofte lange tilfeldige økter.',points:['Ta 10 minutter med taktikk daglig.','Gå gjennom partier og finn én lærdom.','Gjenta vanskelige mønstre til de sitter.']}];
$('lessons').innerHTML=lessons.map((l,i)=>`<article class="lesson"><span class="num">LEKSJON ${String(i+1).padStart(2,'0')} · ${l.tag}</span><h3>${l.title}</h3><p>${l.body}</p><ul>${l.points.map(p=>`<li>${p}</li>`).join('')}</ul><button data-lesson="${i}">${i===2||i===4?'Øv på temaet →':'Prøv i et parti →'}</button></article>`).join('');document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{if(['2','4'].includes(b.dataset.lesson)){setTab('train')}else{setTab('play')}});
analysisApi=setupAnalysis(engine,(positions,index)=>{analysisScrollY=window.scrollY;analysisReturnTab='analysis';trainingOrigin='analysis';analysisPractice=positions;analysisPracticeIndex=index;loadPuzzle();setTab('train')},summary=>{stats.analyzedGames[summary.gameId]={topics:summary.topics,count:summary.count,positions:summary.positions,source:summary.source,date:summary.date,white:summary.white,black:summary.black,checked:summary.checked,analysisVersion:summary.analysisVersion};const keys=Object.keys(stats.analyzedGames);if(keys.length>100)delete stats.analyzedGames[keys[0]];persist()});
$('coachAnalyze').onclick=()=>setTab('analysis');
let practiceSessionStart=null;
function showPracticeSessionSummary(){
  if(!practiceSessionStart)return;
  const session=practiceSessionStart;practiceSessionStart=null;
  const attempts=session.keys.flatMap(key=>(stats.puzzles[key]?.history||[]).filter(h=>h.at>=session.started));
  const correct=attempts.filter(h=>h.correct).length;
  const wrong=attempts.length-correct;
  let root=$('sessionSummary');
  if(!root){
    root=document.createElement('section');root.id='sessionSummary';root.className='own-topic-guidance';
    $('practiceProgress').after(root);
  }
  root.replaceChildren();
  const heading=document.createElement('h3');heading.textContent='Oppsummering av treningsøkten';root.appendChild(heading);
  const result=document.createElement('p');result.textContent=`${correct} riktige og ${wrong} feilforsøk i ${session.keys.length} valgte stillinger.`;root.appendChild(result);
  const previous=(stats.practiceSessions||[]).slice(-5);
  if(previous.length){
    const total=previous.reduce((sum,x)=>sum+x.correct+x.wrong,0);
    if(total){
      const compare=document.createElement('p');compare.className='muted';
      compare.textContent=`Riktigprosent: ${attempts.length?Math.round(correct/attempts.length*100):0} %. Forrige ${previous.length} økter: ${Math.round(previous.reduce((sum,x)=>sum+x.correct,0)/total*100)} %.`;
      root.appendChild(compare);
    }
  }
  const reminder=document.createElement('p');reminder.className='muted';
  reminder.textContent=wrong?'Stillinger med feil blir prioritert ved neste repetisjon.':'Ingen registrerte feilforsøk i denne økten.';
  root.appendChild(reminder);
  if(attempts.length){
    stats.practiceSessions ||= [];
    stats.practiceSessions.push({at:Date.now(),correct,wrong,positions:session.keys.length});
    stats.practiceSessions=stats.practiceSessions.slice(-40);
    persist();
    updateSessionHistory();
  }
}
function startOwnPractice(positions,resumeIndex=0){
  if(!positions.length){setTab('analysis');return}
  const keys=positions.map(puzzleKey);
  const saved=stats.ownQueue;
  const continuing=resumeIndex>0&&saved?.keys?.length===keys.length&&saved.keys.every((key,i)=>key===keys[i]);
  const started=continuing&&Number.isFinite(saved.started)?saved.started:Date.now();
  practiceSessionStart={started,keys:[...new Set(keys)]};
  analysisPractice=positions;analysisPracticeIndex=resumeIndex;analysisReturnTab='progress';trainingOrigin='analysis';
  stats.ownQueue={keys,index:resumeIndex,started};
  persist();loadPuzzle();setTab('train');
}
$('coachFive').onclick=()=>{
  startOwnPractice(allOwnPositions().slice(-5).reverse());
};
function rankedOwnPositions(){
  const topic=$('chessThemeFilter').value;
  const positions=allOwnPositions().filter(p=>topic==='alle'||p.topic===topic);
  // Review due and repeatedly missed positions first; engine loss breaks ties.
  // Solved positions still appear in "all", but not ahead of unfinished practice.
  const now=Date.now();
  const priority=p=>{
    const a=stats.puzzles[puzzleKey(p)]||{};
    const due=!a.right||!Number.isFinite(a.nextReview)||a.nextReview<=now;
    const severity=p.forcedMate?5:Number.isFinite(p.loss)?Math.min(Math.max(p.loss,0),1000)/200:0;
    const mistakes=Math.min(a.wrong||0,10);
    return (due?100:0)+mistakes*8+severity*3-Math.min(a.streak||0,5)*6+(a.last?Math.min(5,(now-a.last)/86400000):6);
  };
  positions.sort((a,b)=>priority(b)-priority(a));
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
