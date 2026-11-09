// Sjakkakademiet: lokal historikk fungerer også uten innlogging.
const $ = id => document.getElementById(id);
const SUPABASE_URL = 'https://ereapsfcsqtdmzosgnnn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KTywNu5kx3HfcOLInKOUjA_5Py79jZm';
const API = 'https://realtyflow.chatgenius.pro/api/public/chess';
let authClient = null;
let session = null;
let cloudGames = [];
let cloudProgress = null;
let syncing = false;

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
  return authClient;
}
function renderSession(){
  const signed=Boolean(session?.user);
  $('accountLoginForm').hidden=signed;
  $('accountSignedIn').hidden=!signed;
  $('accountSyncGames').disabled=!signed||syncing;
  $('accountSyncProgress').disabled=!signed||syncing;
  $('accountRestoreProgress').disabled=!signed||syncing;
  $('accountIdentity').textContent=signed?`Innlogget som ${session.user.email||'sjakkspiller'}`:'';
  setStatus(signed?'Du er innlogget. Nå kan du lagre ferdige partier på kontoen din.':'Du spiller uten innlogging. De lokale partiene dine er fortsatt tilgjengelige.');
  if(!signed)setSyncStatus('Innlogging kreves for skylagring.');
}
async function api(method,body){
  if(!session?.access_token)throw new Error('Logg inn før synkronisering.');
  let response;
  try {
    response=await fetch(API,{method,headers:{'Authorization':`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  } catch(error) {
    // A rejected fetch has no HTTP response: DNS, TLS, connectivity or CORS may be responsible.
    throw new Error('Ingen forbindelse til skyarkivet ('+new URL(API).hostname+'). Nettverk, DNS eller CORS kan blokkere forespørselen. Partiet er fortsatt lagret på denne enheten.');
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
  renderGames();
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
$('accountSignOut').addEventListener('click',async()=>{
  try{const client=await getSupabase();const {error}=await client.auth.signOut();if(error)throw error;session=null;cloudGames=[];cloudProgress=null;renderSession();renderGames();}
  catch(error){setSyncStatus(error.message);}
});
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
  setSyncStatus('Fremgangen er sikkerhetskopiert. Lokale data er beholdt.');
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
  setSyncStatus('Fremgangen ble hentet. Laster sjakkakademiet på nytt …');
  window.location.reload();
}));
window.addEventListener('chess:game-saved',event=>{
  renderGames();
  // Skyarkivering er ekstra sikring: lokalt arkiv er allerede skrevet til disk.
  if(!session?.access_token||!event.detail)return;
  api('POST',{type:'game',game:event.detail})
    .then(()=>loadCloud())
    .catch(()=>setSyncStatus('Partiet er lagret lokalt. Kunne ikke synkronisere automatisk; prøv «Synkroniser lokale partier».'));
});
renderGames();
// Start sesjonskontroll først etter at hele sjakkspillet er klart.
getSupabase().catch(error=>setSyncStatus('Konto eller skyarkiv kan ikke kobles til nå: '+(error.message||'ukjent feil')+'. Partier lagres fortsatt lokalt.'));
