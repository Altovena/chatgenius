// Supabase Send Email Hook endpoint. DO NOT ENABLE until all brands on the shared
// Auth project are migrated to the router (including Art) and approved.
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { classifyBrand, prepareChessMessages } from "./mail-routing.mjs";

const required=(name)=>{
  const value=Deno.env.get(name);
  if(!value)throw new Error("Missing server-side configuration: "+name);
  return value;
};
const json=(status,message)=>new Response(JSON.stringify({error:{http_code:status,message}}),{
  status,headers:{"content-type":"application/json"}
});
Deno.serve(async req=>{
  if(req.method!=="POST")return json(405,"POST required");
  // An inactive or half-configured hook must NEVER claim a message was sent.
  if(Deno.env.get("AUTH_EMAIL_HOOK_ENABLED")!=="true")return json(503,"Email hook not activated");
  let payload;
  try{
    const raw=await req.text();
    if(raw.length>30000)return json(413,"Payload too large");
    const secret=required("SEND_EMAIL_HOOK_SECRET").replace(/^v1,whsec_/,"");
    payload=new Webhook(secret).verify(raw,Object.fromEntries(req.headers));
  }catch{
    // Never log signed payloads, OTPs, magic links or recipient email addresses.
    return json(401,"Invalid auth hook signature");
  }
  if(classifyBrand(payload)!=="chatgenius"){
    // Deliberately fail closed. Activation is forbidden until Art and every other
    // shared brand have real, tested delivery handlers. A 200 here would lose email.
    return json(422,"Auth brand is not configured");
  }
  let emails;
  try{
    emails=prepareChessMessages(payload,{from:required("CHESS_AUTH_FROM")});
  }catch{
    return json(422,"Invalid authentication email data");
  }
  let apiKey;
  try{apiKey=required("RESEND_API_KEY")}catch{return json(503,"Email provider not configured")}
  for(const email of emails){
    let response;
    try{
      response=await fetch("https://api.resend.com/emails",{
        method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
        body:JSON.stringify(email)
      });
    }catch{return json(502,"Email provider unreachable")}
    if(!response.ok)return json(502,"Email provider rejected message");
  }
  return new Response("{}",{status:200,headers:{"content-type":"application/json"}});
});
