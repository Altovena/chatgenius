import { Chess } from './chess.js';

export function setupAnalysis(engine,onPractice,onFindings){
  const el=id=>document.getElementById(id);
  let games=[],selected=null,busy=false,page=0,batchCursor=0,stopBatch=false;
  const PAGE_SIZE=12,MAX_GAMES=100;
  const status=(message)=>el('importStatus').textContent=message;
  const safe=(text)=>String(text||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  function parsePgn(input){
    const blocks=input.replaceAll('\r\n','\n').trim().split(/\n\s*\n(?=\[Event\s)/g);
    const result=[];
    for(const block of blocks){
      const g=new Chess();
      try{g.loadPgn(block,{strict:false});if(g.history().length)result.push({pgn:block,white:g.header().White||'Hvit',black:g.header().Black||'Svart',result:g.header().Result||'*',date:g.header().Date||'',moves:g.history().length})}catch{/* ignore incomplete PGN */}
    }
    return result;
  }
  function choose(i){selected=games[i];el('analysisMeta').textContent=`${selected.white} – ${selected.black} · ${selected.moves} halvtrekk · ${selected.result}`;el('analyzeGame').disabled=false;el('analysisResults').replaceChildren();el('analysisStatus').textContent='Velg «Analyser partiet» for å finne læringsmuligheter.';renderGames()}
  function renderGames(){
    const root=el('importedGames');root.replaceChildren();
    const start=page*PAGE_SIZE;
    games.slice(start,start+PAGE_SIZE).forEach((g,j)=>{
      const i=start+j,b=document.createElement('button');b.className='game-choice';b.textContent=`${g.date} · ${g.white} – ${g.black} (${g.result})`;
      b.classList.toggle('picked',selected===g);b.onclick=()=>choose(i);root.appendChild(b);
    });
    const pages=Math.ceil(games.length/PAGE_SIZE);
    if(pages>1){
      const controls=document.createElement('div');controls.className='archive-pagination';
      const prev=document.createElement('button');prev.className='secondary';prev.textContent='← Forrige';prev.disabled=page===0;prev.onclick=()=>{page--;renderGames()};
      const count=document.createElement('span');count.textContent=`Side ${page+1} av ${pages} · ${games.length} partier`;
      const next=document.createElement('button');next.className='secondary';next.textContent='Neste →';next.disabled=page===pages-1;next.onclick=()=>{page++;renderGames()};
      controls.append(prev,count,next);root.appendChild(controls);
    }
  }
  function showGames(list){games=list.slice(0,MAX_GAMES);page=0;batchCursor=0;selected=null;el('batchSummary').textContent='';el('analyzeBatch').disabled=!games.length;if(games.length)choose(0);else renderGames()}
  el('loadPgn').onclick=()=>{const results=parsePgn(el('pgnText').value);if(!results.length){status('Ingen gyldige PGN-partier funnet. Lim inn et komplett parti fra Chess.com.');return}showGames(results);status(`${results.length} parti(er) importert fra PGN.`)};
  el('fetchGames').onclick=async()=>{
    const name=el('chessUser').value.trim();if(!/^[\w-]{2,30}$/.test(name)){status('Skriv inn et gyldig Chess.com-brukernavn.');return}
    const button=el('fetchGames');button.disabled=true;status('Henter siste offentlige partier fra Chess.com …');
    try{
      const archiveResp=await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(name)}/games/archives`,{signal:AbortSignal.timeout(10000)});
      if(!archiveResp.ok)throw new Error('Fant ikke spillarkivet. Kontroller brukernavnet.');
      const archive=await archiveResp.json();const urls=(archive.archives||[]).slice(-8).reverse();let records=[];
      for(const url of urls){
        status(`Henter arkiv ${Math.min(urls.indexOf(url)+1,urls.length)} av ${urls.length} …`);
        try{const response=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!response.ok)continue;const data=await response.json();records.push(...(data.games||[]).filter(g=>g.pgn&&[g.white?.username?.toLowerCase(),g.black?.username?.toLowerCase()].includes(name.toLowerCase())))}catch{/* Keep already loaded months */}
        if(records.length>=MAX_GAMES)break;
      }
      records.sort((a,b)=>(b.end_time||0)-(a.end_time||0));const parsed=records.slice(0,MAX_GAMES).flatMap(g=>parsePgn(g.pgn));
      if(!parsed.length)throw new Error('Fant ingen tilgjengelige partier.');
      showGames(parsed);status(`${parsed.length} partier hentet fra Chess.com. Velg ett for analyse.`);
    }catch(e){status(`${e.message} Hvis nettleseren blokkerer Chess.com, kan du lime inn PGN fra Analyse → Del → PGN.`)}finally{button.disabled=false}
  };
  async function analyzeOne(game,progress,maxMoves=8){
    const replay=new Chess();replay.loadPgn(game.pgn,{strict:false});const allMoves=replay.history({verbose:true});
    const name=el('chessUser').value.trim().toLowerCase();
    let color=game.white.toLowerCase()===name?'w':game.black.toLowerCase()===name?'b':null;
    if(!color)color=game.white.toLowerCase().includes('freddy')?'w':game.black.toLowerCase().includes('freddy')?'b':'w';
    const indices=allMoves.map((_,i)=>i).filter(i=>i%2===(color==='w'?0:1)).slice(-maxMoves);
    const position=new Chess(),before=[];for(const move of allMoves){before.push(position.fen());position.move(move)}
    const findings=[];let skipped=0;
    for(let k=0;k<indices.length;k++){
      if(stopBatch)break;
      progress(k+1,indices.length);
      const i=indices[k],actual=allMoves[i],fen=before[i];
      try{
        const suggestion=await engine.search(fen,{ms:500,skill:20});
        if(!suggestion.move||suggestion.move==='(none)')continue;
        const trial=new Chess(fen),recommended=trial.move({from:suggestion.move.slice(0,2),to:suggestion.move.slice(2,4),promotion:suggestion.move[4]||'q'});
        const played=new Chess(fen);played.move({from:actual.from,to:actual.to,promotion:actual.promotion||'q'});
        const evaluation=await engine.search(played.fen(),{ms:500,skill:20});
        const lost=Math.max(0,suggestion.score+evaluation.score);
        if(suggestion.move.slice(0,4)!==actual.from+actual.to&&lost>=75){
          const topic=actual.piece==='k'?'Kongesikkerhet':i<20?'Åpning':actual.captured?'Taktikk':'Stillingsspill';
          findings.push({moveNo:Math.floor(i/2)+1,actual:actual.san,best:recommended.san,fen,from:recommended.from,to:recommended.to,color,loss:lost,topic});
        }
      }catch{skipped++}
      // Give Safari a chance to render progress and honor a stop request.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    let fingerprint=2166136261;for(const char of game.pgn)fingerprint=Math.imul(fingerprint^char.charCodeAt(0),16777619);
    findings.sort((a,b)=>b.loss-a.loss);
    const practicePositions=findings.map(f=>({fen:f.fen,from:f.from,to:f.to,skill:'Egne partier',topic:f.topic,title:`Partiet ditt · trekk ${f.moveNo}`,prompt:'Finn et bedre trekk i stillingen.',explain:`Motoren foretrekker ${f.best}. Undersøk hvorfor motstanderens svar gjør dette bedre.`}));
    if(!stopBatch&&skipped<indices.length)onFindings?.({gameId:String(fingerprint>>>0),topics:findings.map(f=>f.topic),count:findings.length,positions:practicePositions,date:game.date,white:game.white,black:game.black,checked:indices.length-skipped,analysisVersion:2});
    return {findings,practicePositions,skipped};
  }
  function showFindings(result){
    const root=el('analysisResults');root.replaceChildren();
    result.findings.forEach((f,i)=>{
      const card=document.createElement('div');card.className='finding';
      card.innerHTML=`<div class="finding-head"><b>Trekk ${f.moveNo}: ${safe(f.topic)}</b><span>≈ ${Math.round(f.loss/10)/10} bondepoeng</span></div><p>Du spilte <b>${safe(f.actual)}</b>. Stockfish foreslår <b>${safe(f.best)}</b>.</p>`;
      const button=document.createElement('button');button.className='secondary';button.textContent='Tren på denne stillingen →';button.onclick=()=>onPractice(result.practicePositions,i);card.appendChild(button);root.appendChild(card);
    });
  }
  el('analyzeGame').onclick=async()=>{
    if(!selected||busy)return;if(!engine.ready){el('analysisStatus').textContent='Stockfish starter fortsatt. Vent litt og prøv igjen.';return}
    busy=true;stopBatch=false;el('analyzeGame').disabled=true;el('analyzeBatch').disabled=true;
    try{
      const result=await analyzeOne(selected,(k,total)=>el('analysisStatus').textContent=`Analyserer trekk ${k} av ${total} …`,10);
      showFindings(result);el('analysisStatus').textContent=`Ferdig: ${result.findings.length} forbedringspunkter. ${result.skipped?'Noen stillinger ble hoppet over fordi motoren svarte for sent.':''}`;
    }catch(e){el('analysisStatus').textContent='Analysen stoppet: '+e.message}finally{busy=false;el('analyzeGame').disabled=false;el('analyzeBatch').disabled=false}
  };
  el('analyzeBatch').onclick=async()=>{
    if(busy||!games.length)return;if(!engine.ready){el('analysisStatus').textContent='Vent til Stockfish er klar.';return}
    busy=true;stopBatch=false;el('analyzeBatch').disabled=true;el('analyzeGame').disabled=true;el('stopBatch').hidden=false;
    const end=Math.min(games.length,batchCursor+10),start=batchCursor;let completed=0,found=0;
    try{
      for(let i=start;i<end&&!stopBatch;i++){
        const game=games[i];el('analysisStatus').textContent=`Parti ${i+1} av ${games.length} – forbereder analyse …`;
        const result=await analyzeOne(game,(k,total)=>el('analysisStatus').textContent=`Parti ${i+1} av ${games.length} · trekk ${k} av ${total} …`,6);
        if(!stopBatch){completed++;found+=result.findings.length;batchCursor=i+1;el('batchSummary').textContent=`${batchCursor} av ${games.length} partier gjennomgått. ${found} nye forbedringspunkter i denne økten. Se «Din utvikling» for samlet læringsplan.`;}
      }
      el('analysisStatus').textContent=stopBatch?'Analysen er satt på pause. Trykk «Analyser neste 10» for å fortsette.':`Ferdig med ${completed} partier. Du kan fortsette med neste gruppe.`;
      if(batchCursor>=games.length){batchCursor=0;el('analysisStatus').textContent='Alle importerte partier er gjennomgått. Tren på forbedringspunktene under «Din utvikling».'}
    }catch(e){el('analysisStatus').textContent='Batchanalysen stoppet: '+e.message}
    finally{busy=false;stopBatch=false;el('stopBatch').hidden=true;el('analyzeBatch').disabled=false;el('analyzeGame').disabled=false}
  };
  el('stopBatch').onclick=()=>{stopBatch=true;el('analysisStatus').textContent='Stopper etter pågående stilling …'};
  el('analyzeBatch').disabled=true;
}
