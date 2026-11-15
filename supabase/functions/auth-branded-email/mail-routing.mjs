// Pure, dependency-free routing logic for a Supabase Send Email Hook.
// NOT activated in production. Caller MUST authenticate the signed webhook first.
export const PROJECT_ORIGIN = "https://ereapsfcsqtdmzosgnnn.supabase.co";
const EMAIL_TYPES = new Set(["signup","magiclink","recovery","invite","email_change","reauthentication"]);
const CHESS_CALLBACK_PATH = "/spill/sjakk/";
const CHESS_ORIGINS = new Set(["https://chatgenius.pro","https://www.chatgenius.pro"]);
const HOST_REGEX = /^[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/i;
const SENDER_REGEX = /^([^<>\r\n]{1,80}) <([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>$/i;
const escapeHtml = value => String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const nonEmpty = (s,max=2048) => typeof s==="string"&&s.length>0&&s.length<=max;
export function chessRedirect(input){
  if(!nonEmpty(input,800)) return false;
  try{
    const url=new URL(input);
    // Disallow URLs with credential tricks, alternate ports, fragments, and lookalike paths.
    return CHESS_ORIGINS.has(url.origin)&&!url.username&&!url.password&&url.pathname===CHESS_CALLBACK_PATH
      &&url.searchParams.get("chessAccount")==="1"&&!url.hash
      &&[...url.searchParams.keys()].every(k=>k==="chessAccount");
  }catch{return false}
}
export function classifyBrand(payload){
  const redirect=payload?.email_data?.redirect_to;
  if(chessRedirect(redirect))return "chatgenius";
  // No implicit default! Supabase Auth is shared with Art and other brands.
  // An unrecognized redirect must not be silently branded as Chess or Art.
  return null;
}
export function validateSender(value){
  if(!nonEmpty(value,150)||!SENDER_REGEX.test(value))throw Error("Sender configuration is missing or invalid");
  return value;
}
function verifyBaseUrl(origin){
  const u=new URL(origin);
  if(u.protocol!=="https:"||!HOST_REGEX.test(u.hostname)||u.pathname!=="/")throw Error("Invalid auth origin");
  return u.origin;
}
export function verificationLink({hash,type,redirect,authOrigin=PROJECT_ORIGIN}){
  if(!nonEmpty(hash,500)||!nonEmpty(redirect,800)||!EMAIL_TYPES.has(type))throw Error("Invalid verification link data");
  if(!chessRedirect(redirect))throw Error("Unrecognized ChatGenius redirect");
  const url=new URL(verifyBaseUrl(authOrigin)+"/auth/v1/verify");
  url.searchParams.set("token",hash);
  url.searchParams.set("type",type);
  url.searchParams.set("redirect_to",redirect);
  return url.toString();
}
const subjects={
  signup:"Bekreft e-postadressen din – Freddys Sjakkakademi",
  magiclink:"Din innloggingslenke – Freddys Sjakkakademi",
  recovery:"Tilbakestill passordet – Freddys Sjakkakademi",
  invite:"Invitasjon til Freddys Sjakkakademi",
  email_change:"Bekreft endring av e-post – Freddys Sjakkakademi",
  reauthentication:"Bekreft handlingen – Freddys Sjakkakademi"
};
export function prepareChessMessages(payload,{from,authOrigin=PROJECT_ORIGIN}={}){
  if(classifyBrand(payload)!=="chatgenius")throw Error("Not a ChatGenius Auth email");
  validateSender(from);
  const {user,email_data:data}=payload||{},type=data?.email_action_type;
  if(!EMAIL_TYPES.has(type))throw Error("Unsupported email action");
  const original=user?.email,newEmail=user?.new_email;
  const validEmail=e=>nonEmpty(e,320)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  if(!validEmail(original))throw Error("Invalid Auth recipient");
  const infos=[];
  if(type==="email_change"){
    if(!validEmail(newEmail))throw Error("Missing new email recipient");
    if(data.token_hash&&data.token_hash_new){
      // Supabase documents this counterintuitive mapping for secure email change.
      infos.push([original,data.token_hash_new]);
      infos.push([newEmail,data.token_hash]);
    }else{
      infos.push([newEmail,data.token_hash||data.token_hash_new]);
    }
  }else infos.push([original,data.token_hash]);
  return infos.map(([to,hash])=>{
    const url=verificationLink({hash,type,redirect:data.redirect_to,authOrigin});
    const subject=subjects[type];
    const text="Hei!\n\nDu har bedt om en bekreftelseslenke til Freddys Sjakkakademi.\n\n"+url+"\n\nHvis du ikke ba om dette, kan du se bort fra e-posten.\n\nFreddys Sjakkakademi · chatgenius.pro";
    const html='<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#18222d"><h1>♞ Freddys Sjakkakademi</h1><p>Bruk knappen nedenfor for å fortsette. Lenken er personlig og skal ikke deles.</p><p><a href="'+escapeHtml(url)+'" style="display:inline-block;padding:14px 21px;background:#123a40;color:#fff;text-decoration:none;border-radius:8px">Bekreft og fortsett</a></p><p>Hvis du ikke ba om dette, kan du se bort fra e-posten.</p><p style="color:#65737e;font-size:12px">Freddys Sjakkakademi · chatgenius.pro</p></div>';
    return {from,to:[to],subject,text,html};
  });
}
