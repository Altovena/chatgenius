// ChatGenius chess archive. Server-only credentials; no dependency on RealtyFlow.
const URL = process.env.CHESS_SUPABASE_URL || 'https://ereapsfcsqtdmzosgnnn.supabase.co';
const KEY = process.env.CHESS_SUPABASE_SERVICE_ROLE_KEY;
const MAX_BODY_BYTES = 210000;
const json = (res,status,body) => {res.setHeader('Cache-Control','no-store');return res.status(status).json(body)};
async function database(path,{method='GET',body,query=''}={}){
  const response=await fetch(URL+'/rest/v1/'+path+query,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json','Accept':'application/json','Accept-Profile':'chatgenius','Content-Profile':'chatgenius',Prefer:'return=representation,resolution=merge-duplicates'},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw new Error('Database request failed: '+response.status+' '+String(result?.code||'')+' '+String(result?.message||'').slice(0,240));
  return result;
}
export default async function handler(req,res){
  if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
  if(!KEY)return json(res,503,{error:'Chess storage is not configured'});
  const token=/^Bearer\s+([^\s]+)$/i.exec(req.headers.authorization||'')?.[1];
  if(!token)return json(res,401,{error:'Sign in required'});
  try{
    const auth=await fetch(URL+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+token}});
    if(!auth.ok)return json(res,401,{error:'Invalid user session'});
    const user=await auth.json();
    if(!user?.id||user.is_anonymous)return json(res,401,{error:'Invalid user session'});
    const id=encodeURIComponent(user.id);
    if(req.method==='GET'){
      const [games,progress,preferences]=await Promise.all([
        database('chess_games',{query:'?select=id,source,client_game_id,pgn,result,opponent,difficulty,played_at&user_id=eq.'+id+'&order=played_at.desc&limit=50'}),
        database('chess_progress',{query:'?select=state,state_version,updated_at&user_id=eq.'+id+'&limit=1'}),
        database('chess_preferences',{query:'?select=chess_com_username&user_id=eq.'+id+'&limit=1'})
      ]);
      return json(res,200,{games,progress:progress[0]||null,preferences:preferences[0]||null});
    }
    const body=req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body),'utf8')>MAX_BODY_BYTES)return json(res,400,{error:'Invalid payload'});
    if(body.type==='preferences'){
      const username=body.chess_com_username;
      if(typeof username!=='string'||(username!==''&&!/^[A-Za-z0-9_-]{2,30}$/.test(username)))return json(res,400,{error:'Invalid Chess.com username'});
      await database('chess_preferences',{method:'POST',query:'?on_conflict=user_id',body:{user_id:user.id,chess_com_username:username||null,updated_at:new Date().toISOString()}});
      return json(res,200,{saved:true,chess_com_username:username||null});
    }
    if(body.type==='game'){
      const g=body.game;
      if(!g||!['academy','chess_com','import'].includes(g.source)||typeof g.client_game_id!=='string'||!/^[\w:-]{1,100}$/.test(g.client_game_id)||typeof g.pgn!=='string'||!g.pgn.trim()||Buffer.byteLength(g.pgn,'utf8')>90000||!['1-0','0-1','1/2-1/2','*'].includes(g.result))return json(res,400,{error:'Invalid chess game fields'});
      const data=await database('chess_games',{method:'POST',query:'?on_conflict=user_id,source,client_game_id',body:{user_id:user.id,source:g.source,client_game_id:g.client_game_id,pgn:g.pgn,result:g.result,opponent:typeof g.opponent==='string'?g.opponent.slice(0,120):null,difficulty:typeof g.difficulty==='string'?g.difficulty.slice(0,50):null,played_at:typeof g.played_at==='string'&&!Number.isNaN(Date.parse(g.played_at))?new Date(g.played_at).toISOString():new Date().toISOString()}});
      return json(res,200,{saved:true,id:data[0]?.id});
    }
    if(body.type==='progress'){
      if(!body.state||typeof body.state!=='object'||Array.isArray(body.state)||Buffer.byteLength(JSON.stringify(body.state),'utf8')>180000||!(body.expected_version===null||(Number.isSafeInteger(body.expected_version)&&body.expected_version>=1)))return json(res,400,{error:'Invalid progress'});
      const old=await database('chess_progress',{query:'?select=state_version&user_id=eq.'+id+'&limit=1'});
      const current=old[0]?.state_version??null;
      if(current!==body.expected_version)return json(res,409,{error:'Progress changed on another device. Reload before saving.'});
      if(current===null){
        try {await database('chess_progress',{method:'POST',body:{user_id:user.id,state:body.state,state_version:1}});}
        catch(error){return json(res,409,{error:'Progress may have changed on another device. Reload before saving.'});}
        return json(res,200,{saved:true,state_version:1});
      }
      const response=await database('chess_progress',{method:'PATCH',query:'?user_id=eq.'+id+'&state_version=eq.'+current,body:{state:body.state,state_version:current+1,updated_at:new Date().toISOString()}});
      if(!response.length)return json(res,409,{error:'Progress changed on another device. Reload before saving.'});
      return json(res,200,{saved:true,state_version:current+1});
    }
    return json(res,400,{error:'Unsupported action'});
  }catch(err){console.error('[ChatGenius Chess API]',err.message);return json(res,503,{error:'Chess storage temporarily unavailable'})}
}
