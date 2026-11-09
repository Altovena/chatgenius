// Sjakkakademiet: lokal historikk fungerer også uten innlogging.
const $ = id => document.getElementById(id);
const SUPABASE_URL = 'https://ereapsfcsqtdmzosgnnn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KTywNu5kx3HfcOLInKOUjA_5Py79jZm';
const API = '/api/chess';
let authClient = null;
let session = null;
let cloudGames = [];
let cloudProgress = null;
let syncing = false;
let progressTimer = null;
let lastProgressFingerprint = '';
let progressBaselineVersion = null;
let progressBackupInFlight = false;
const AUTO_PROGRESS_KEY = 'freddyChessAutoProgressBackup';
const SYNC_FINGERPRINT_KEY = 'freddyChessProgressSyncedFingerprint';
const SYNC_USER_KEY = 'freddyChessProgressSyncedUser';
function rememberProgressOwner(){localStorage.setItem(SYNC_USER_KEY,session.user.id);}
function ownsProgressBaseline(){return Boolean(session?.user?.id)&&localStorage.getItem(SYNC_USER_KEY)===session.user.id;}
const autoProgress = $('accountAutoProgress');
autoProgress.checked = localStorage.getItem(AUTO_PROGRESS_KEY) === 'true';
function progressInfo(message){$('accountProgressStatus').textContent=message;}
function updateProgressComparison(){
  const local=$('accountLocalProgressSummary'),remote=$('accountCloudProgressSummary');
  const raw=localStorage.getItem('freddyChessProgress');
  let parsed=null;
  try{if(raw)parsed=JSON.parse(raw);}catch{}
  local.textContent=parsed?'Treningsfremgang finnes på denne enheten.':'Ingen lokal treningsfremgang lagret.';
  if(!session?.user){remote.textContent='Logg inn for å se skyarkivet.';return;}
  if(!cloudProgress?.state){remote.textContent='Ingen sikkerhetskopi i skyen.';return;}
  const version=cloudProgress.state_version;
  const same=raw&&JSON.stringify(parsed)===JSON.stringify(cloudProgress.state);
  const baseline=ownsProgressBaseline()&&progressBaselineVersion===version;
  remote.textContent='Versjon '+version+(same?' · Samme fremgang som på denne enheten':baseline?' · Lokal fremgang kan være nyere':' · Sammenlign før du erstatter');
}



function localGames(){
  try { const games=JSON.parse(localStorage.getItem('freddyChessSavedGames')||'[]');return Array.isArray(games)?games.filter(g=>g&&typeof g.pgn==='string'):[]; }
  catch { return []; }
}
function setStatus(message){ $('accountStatus').textContent=message; }
function setSyncStatus(message){ $('accountSyncStatus').textContent=message; }
function escapeText(value){ return String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function renderGames(){
  const local=localGames();
  const localIds=new Set(local.map(g=>g.client_game_id));
  const combined=[...local.map(g=>({...g,_local:true})),...cloudGames.filter(g=>!localIds.has(g.client_game_id)).map(g=>({...g,_cloud:true}))].sort((a,b)=>new Date(b.played_at||0)-new Date(a.played_at||0));
  const box=$('accountGames');
  box.replaceChildren();
  if(!combined.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Ingen ferdige partier er lagret ennå. Spill et parti mot datamaskinen først.';box.append(empty);return;}
  combined.forEach((g,i)=>{
    const article=document.createElement('article');article.className='account-game';
    const details=document.createElement('div');
    const heading=document.createElement('strong');
    heading.textContent=`${new Date(g.played_at||Date.now()).toLocaleDateString('nb-NO')} · ${g.result==='1-0'?'Hvit vant':g.result==='0-1'?'Svart vant':'Remis'}`;
    const sub=document.createElement('small');sub.textContent=`${g.opponent||'Datamaskinen'} · ${g.difficulty||'Sjakk'} · ${g._local?'Lagret her':'Fra skyen'}`;
    details.append(heading,sub);
    const button=document.createElement('button');button.className='secondary';button.type='button';button.textContent='Kopier PGN';
    button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(g.pgn);button.textContent='Kopiert ✓';}catch{const dialog=window.prompt('Kopier PGN:',g.pgn);void dialog;}});
    article.append(details,button);box.append(article);
  });
}
async function getSupabase(){
  if(authClient)return authClient;
  // Hentes først når kontofunksjonen brukes. Resten av sjakkspillet fungerer uten nett.
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.0');
  authClient=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  authClient.auth.onAuthStateChange((_event,nextSession)=>{
    session=nextSession;
    renderSession();
    if(nextSession)queueMicrotask(()=>loadCloud().catch(err=>setSyncStatus(err.message)));
  });
  const {data,error}=await authClient.auth.getSession();
  if(error)throw error;
  session=data.session;
  renderSession();
  if(session)await loadCloud();
  if(session&&autoProgress.checked)scheduleProgressBackup();
  return authClient;
}
function renderSession(){
  const signed=Boolean(session?.user);
  $('accountLoginForm').hidden=signed;
  $('accountSignedIn').hidden=!signed;
  $('accountSyncGames').disabled=!signed||syncing;
  $('accountSyncProgress').disabled=!signed||syncing;
  $('accountRestoreProgress').disabled=!signed||syncing;
  $('accountRefreshCloud').disabled=!signed||syncing;
  $('accountExportCloudProgress').disabled=!signed||syncing||!cloudProgress?.state;
  $('accountSaveChessUsername').disabled=!signed;
  $('accountIdentity').textContent=signed?`Innlogget som ${session.user.email||'sjakkspiller'}`:'';
  setStatus(signed?'Du er innlogget. Nå kan du lagre ferdige partier på kontoen din.':'Du spiller uten innlogging. De lokale partiene dine er fortsatt tilgjengelige.');
  if(!signed)setSyncStatus('Innlogging kreves for skylagring.');
  updateProgressComparison();
}
async function api(method,body){
  if(!session?.access_token)throw new Error('Logg inn før synkronisering.');
  let response;
  try {
    response=await fetch(API,{method,headers:{'Authorization':`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  } catch(error) {
    // A rejected fetch has no HTTP response: DNS, TLS, connectivity or CORS may be responsible.
    throw new Error('Ingen forbindelse til skyarkivet ('+new URL(API,location.origin).hostname+'). Nettverk, DNS eller CORS kan blokkere forespørselen. Partiet er fortsatt lagret på denne enheten.');
  }
  let data={};
  try{data=await response.json();}catch{}
  if(!response.ok)throw new Error(response.status===404?'Skyarkivet svarer med HTTP 404. Lokale partier er trygge.':response.status===401?'Skyarkivet avviste innloggingen (HTTP 401). Prøv å logge ut og inn igjen.':`Skyarkivet svarte HTTP ${response.status}: ${data.error||'ukjent feil'}`);
  return data;
}
async function loadCloud(){
  if(!session)return;
  const remote=await api('GET');
  cloudGames=remote.games||[];
  cloudProgress=remote.progress||null;
  const remoteName=remote.preferences?.chess_com_username;
  if(typeof remoteName==='string'&&remoteName){
    $('accountChessUsername').value=remoteName;
    localStorage.setItem('freddyChessComUsername',remoteName);
    const field=$('chessUser');if(field)field.value=remoteName;
    $('accountChessUsernameStatus').textContent='Chess.com-brukernavnet er hentet fra kontoen din.';
  }else{
    $('accountChessUsername').value=localStorage.getItem('freddyChessComUsername')||'';
    $('accountChessUsernameStatus').textContent='Du kan lagre Chess.com-brukernavnet på kontoen din.';
  }
  if(cloudProgress?.state && ownsProgressBaseline() && Number(localStorage.getItem('freddyChessProgressCloudVersion'))===cloudProgress.state_version){
    progressBaselineVersion=cloudProgress.state_version;
    lastProgressFingerprint=localStorage.getItem(SYNC_FINGERPRINT_KEY)||'';
  }else{
    progressBaselineVersion=null;
    lastProgressFingerprint='';
  }
  progressInfo(cloudProgress?.state ? `Skykopi tilgjengelig (versjon ${cloudProgress.state_version}).` : 'Ingen treningsfremgang lagret i skyen ennå.');
  renderGames();
  updateProgressComparison();
  renderSession();
  setSyncStatus(`${cloudGames.length} partier funnet i skyen. ${localGames().length} lokale partier på denne enheten.`);
}
async function withSync(task){
  if(syncing)return;
  syncing=true;renderSession();
  try{await task();}catch(error){setSyncStatus(error.message||'Synkroniseringen mislyktes. Lokale data er beholdt.');}
  finally{syncing=false;renderSession();}
}
$('accountLoginForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const email=$('accountEmail').value.trim();
  if(!email)return;
  setStatus('Sender innloggingslenke …');
  try{
    const client=await getSupabase();
    const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/spill/sjakk/?chessAccount=1'}});
    if(error)throw error;
    setStatus('Sjekk e-posten din og åpne innloggingslenken på denne eller en annen enhet.');
  }catch(error){setStatus(`Innlogging er ikke tilgjengelig nå: ${error.message}`);}
});
$('accountSaveChessUsername').addEventListener('click',()=>withSync(async()=>{
  const username=$('accountChessUsername').value.trim();
  const status=$('accountChessUsernameStatus');
  if(username&&!/^[A-Za-z0-9_-]{2,30}$/.test(username)){
    status.textContent='Bruk 2–30 bokstaver, tall, bindestrek eller understrek.';return;
  }
  status.textContent='Lagrer Chess.com-brukernavnet …';
  try{
    await api('POST',{type:'preferences',chess_com_username:username});
    if(username)localStorage.setItem('freddyChessComUsername',username);
    else localStorage.removeItem('freddyChessComUsername');
    const field=$('chessUser');if(field)field.value=username;
    status.textContent=username?'Chess.com-brukernavnet er lagret på kontoen og tilgjengelig på andre enheter.':'Chess.com-brukernavnet er fjernet fra kontoen.';
  }catch(error){
    status.textContent='Kunne ikke lagre Chess.com-brukernavnet: '+(error.message||'ukjent feil')+'. Prøv igjen.';
    throw error;
  }
}));
$('accountSignOut').addEventListener('click',async()=>{
  try{const client=await getSupabase();const {error}=await client.auth.signOut();if(error)throw error;session=null;cloudGames=[];cloudProgress=null;progressBaselineVersion=null;lastProgressFingerprint='';renderSession();renderGames();}
  catch(error){setSyncStatus(error.message);}
});
let pendingProgressImport=null;
$('accountImportProgressFile').addEventListener('change',async event=>{
  pendingProgressImport=null;
  $('accountConfirmImportProgress').hidden=true;
  const file=event.target.files?.[0];
  if(!file){$('accountImportProgressStatus').textContent='Ingen sikkerhetskopi valgt.';return;}
  if(file.size>2*1024*1024){$('accountImportProgressStatus').textContent='Filen er for stor. Maksimal størrelse er 2 MB.';return;}
  try{
    const payload=JSON.parse(await file.text());
    if(payload?.format!=='chatgenius-chess-progress-backup'||payload.schema_version!==1||!validProgressState(payload.state))throw new Error('Ukjent eller ugyldig sikkerhetskopiformat.');
    pendingProgressImport=payload;
    const date=new Date(payload.exported_at);
    const when=Number.isNaN(date.getTime())?'ukjent dato':date.toLocaleString('nb-NO');
    $('accountImportProgressStatus').textContent='Valgt: '+file.name+' · Kilde: '+(payload.source==='sky'?'skykopi':'lokal kopi')+' · Eksportert: '+when+'. XP: '+payload.state.xp+' · Løste oppgaver: '+payload.state.solved+' · Partier: '+payload.state.games+'. Dette vil bare erstatte lokal treningsfremgang, ikke skyarkivet eller partiene.';
    $('accountConfirmImportProgress').hidden=false;
  }catch(error){$('accountImportProgressStatus').textContent='Kunne ikke lese sikkerhetskopien: '+(error.message||'ugyldig JSON');}
});
$('accountConfirmImportProgress').addEventListener('click',()=>{
  if(!pendingProgressImport)return;
  const current=localStorage.getItem('freddyChessProgress');
  if(!window.confirm('Gjenopprette treningsfremgang fra valgt fil på denne enheten? Nåværende lokal fremgang tas vare på som en separat kopi. Skyarkivet endres ikke.'))return;
  try{
    if(current)localStorage.setItem('freddyChessProgressBeforeRestore',current);
    localStorage.setItem('freddyChessProgress',JSON.stringify(pendingProgressImport.state));
    // En importert fil må ikke automatisk overskrive en nyere skykopi.
    progressBaselineVersion=null;
    lastProgressFingerprint='';
    localStorage.removeItem('freddyChessProgressCloudVersion');
    localStorage.removeItem(SYNC_FINGERPRINT_KEY);
    localStorage.removeItem(SYNC_USER_KEY);
    $('accountImportProgressStatus').textContent='Fremgangen er gjenopprettet lokalt. Laster siden på nytt …';
    window.location.reload();
  }catch(error){$('accountImportProgressStatus').textContent='Kunne ikke gjenopprette filen: '+(error.message||'ukjent feil');}
});
function validProgressState(state){
  if(!state||typeof state!=='object'||Array.isArray(state))return false;
  for(const key of ['xp','solved','attempts','streak','games','wins']){
    if(!Number.isSafeInteger(state[key])||state[key]<0)return false;
  }
  for(const key of ['skills','puzzles','analyzedGames']){
    if(state[key]!==undefined&&(!state[key]||typeof state[key]!=='object'||Array.isArray(state[key])))return false;
  }
  return true;
}
function downloadProgressBackup(source,state,version){
  const payload={format:'chatgenius-chess-progress-backup',schema_version:1,source,exported_at:new Date().toISOString(),cloud_version:version??null,state};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='sjakk-fremgang-'+source+'-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('accountExportLocalProgress').addEventListener('click',()=>{
  try{
    const raw=localStorage.getItem('freddyChessProgress');
    if(!raw){setSyncStatus('Ingen lokal treningsfremgang å laste ned.');return;}
    downloadProgressBackup('lokal',JSON.parse(raw),null);
    setSyncStatus('Lokal treningsfremgang er klargjort for nedlasting.');
  }catch{setSyncStatus('Lokal fremgang kunne ikke eksporteres. Ingen data ble endret.');}
});
$('accountExportCloudProgress').addEventListener('click',()=>{
  if(!session?.user||!cloudProgress?.state){setSyncStatus('Oppdater status fra skyen før du laster ned skykopien.');return;}
  downloadProgressBackup('sky',cloudProgress.state,cloudProgress.state_version);
  setSyncStatus('Skykopien er klargjort for nedlasting. Ingen data ble endret.');
});
$('accountRefreshCloud').addEventListener('click',()=>withSync(async()=>{
  setSyncStatus('Kontrollerer siste status fra skyarkivet …');
  await loadCloud();
  setSyncStatus('Status oppdatert fra skyarkivet. Ingen lokale data ble endret.');
}));
$('accountSyncGames').addEventListener('click',()=>withSync(async()=>{
  const games=localGames();let count=0;
  for(const game of games){
    await api('POST',{type:'game',game});
    count++;
    setSyncStatus(`Lagrer partier: ${count} av ${games.length} …`);
  }
  await loadCloud();
  setSyncStatus(`${count} lokale partier kontrollert og synkronisert.`);
}));
$('accountSyncProgress').addEventListener('click',()=>withSync(async()=>{
  // Aldri skriv over fremgang fra en annen enhet uten et eksplisitt samtykke.
  await loadCloud();
  const raw=localStorage.getItem('freddyChessProgress');
  if(!raw){setSyncStatus('Fant ingen lokal fremgang å sikkerhetskopiere.');return;}
  const state=JSON.parse(raw);
  if(cloudProgress?.state){
    const confirmed=window.confirm('Det finnes allerede lagret fremgang i skyen. Vil du erstatte den med fremgangen fra denne enheten?');
    if(!confirmed){setSyncStatus('Ingen endringer gjort i skyen.');return;}
  }
  const result=await api('POST',{type:'progress',state,expected_version:cloudProgress?.state_version??null});
  cloudProgress={state,state_version:result.state_version};
  lastProgressFingerprint=JSON.stringify(state);
  localStorage.setItem(SYNC_FINGERPRINT_KEY,lastProgressFingerprint);
  rememberProgressOwner();
  progressBaselineVersion=result.state_version;
  localStorage.setItem('freddyChessProgressCloudVersion',String(result.state_version));
  progressInfo('Automatisk oppdatering er nå aktiv for denne enheten når valget er slått på.');
  setSyncStatus('Fremgangen er sikkerhetskopiert. Lokale data er beholdt.');
  updateProgressComparison();
}));
$('accountRestoreProgress').addEventListener('click',()=>withSync(async()=>{
  await loadCloud();
  if(!cloudProgress?.state){setSyncStatus('Det finnes ennå ingen lagret fremgang i skyen.');return;}
  const existing=localStorage.getItem('freddyChessProgress');
  if(existing&&!window.confirm('Dette erstatter treningsfremgangen på denne enheten med kopien i skyen. Vil du fortsette?')){
    setSyncStatus('Din lokale fremgang ble beholdt.');return;
  }
  // En separat sikkerhetskopi lar brukeren gjenopprette den lokale tilstanden ved behov.
  if(existing)localStorage.setItem('freddyChessProgressBeforeRestore',existing);
  localStorage.setItem('freddyChessProgress',JSON.stringify(cloudProgress.state));
  localStorage.setItem('freddyChessProgressCloudVersion',String(cloudProgress.state_version));
  localStorage.setItem(SYNC_FINGERPRINT_KEY,JSON.stringify(cloudProgress.state));
  rememberProgressOwner();
  setSyncStatus('Fremgangen ble hentet. Laster sjakkakademiet på nytt …');
  window.location.reload();
}));
autoProgress.addEventListener('change',()=>{
  localStorage.setItem(AUTO_PROGRESS_KEY,String(autoProgress.checked));
  if(autoProgress.checked){progressInfo('Automatisk sikkerhetskopiering er aktivert på denne enheten.');scheduleProgressBackup();}
  else{if(progressTimer)clearTimeout(progressTimer);progressInfo('Automatisk sikkerhetskopiering er slått av.');}
});
async function backupProgressSafely(){
  if(!autoProgress.checked||!session?.access_token)return;
  if(syncing||progressBackupInFlight){scheduleProgressBackup();return;}
  const raw=localStorage.getItem('freddyChessProgress');
  if(!raw||raw===lastProgressFingerprint)return;
  // Første automatiske kopi tillates bare når skyen er tom. Ellers må brukeren
  // eksplisitt velge enhetens fremgang via knappen for sikkerhetskopi.
  if(cloudProgress?.state && progressBaselineVersion !== cloudProgress.state_version){
    progressInfo('Skyen inneholder fremgang fra før. Velg «Hent fremgang fra skyen» eller bekreft en sikkerhetskopi før automatisk oppdatering.');
    return;
  }
  progressBackupInFlight=true;
  try{
    const state=JSON.parse(raw);
    const result=await api('POST',{type:'progress',state,expected_version:cloudProgress?.state_version??null});
    cloudProgress={state,state_version:result.state_version};
    progressBaselineVersion=result.state_version;
    localStorage.setItem('freddyChessProgressCloudVersion',String(result.state_version));
    lastProgressFingerprint=raw;
    localStorage.setItem(SYNC_FINGERPRINT_KEY,raw);
    rememberProgressOwner();
    progressInfo('Treningsfremgangen er oppdatert i skyen.');
    updateProgressComparison();
  }catch(error){
    if(String(error.message).includes('409')){
      progressBaselineVersion=null;
      progressInfo('Fremgangen ble endret på en annen enhet. Ingen data ble overskrevet. Velg hvilken versjon du vil beholde.');
    }else progressInfo('Automatisk sikkerhetskopi ble ikke fullført: '+(error.message||'ukjent feil')+'. Lokal fremgang er beholdt.');
  }finally{
    progressBackupInFlight=false;
    if(localStorage.getItem('freddyChessProgress')!==raw && progressBaselineVersion!==null)scheduleProgressBackup();
  }
}
function scheduleProgressBackup(){
  if(!autoProgress.checked)return;
  if(progressTimer)clearTimeout(progressTimer);
  progressTimer=setTimeout(()=>{progressTimer=null;backupProgressSafely();},1800);
}
window.addEventListener('chess:progress-saved',()=>{updateProgressComparison();scheduleProgressBackup();});
window.addEventListener('chess:game-saved',event=>{
  renderGames();
  // Skyarkivering er ekstra sikring: lokalt arkiv er allerede skrevet til disk.
  if(!session?.access_token||!event.detail)return;
  api('POST',{type:'game',game:event.detail})
    .then(()=>loadCloud())
    .catch(()=>setSyncStatus('Partiet er lagret lokalt. Kunne ikke synkronisere automatisk; prøv «Synkroniser lokale partier».'));
});
renderGames();
updateProgressComparison();
// Start sesjonskontroll først etter at hele sjakkspillet er klart.
getSupabase().catch(error=>setSyncStatus('Konto eller skyarkiv kan ikke kobles til nå: '+(error.message||'ukjent feil')+'. Partier lagres fortsatt lokalt.'));
