import test from "node:test";
import assert from "node:assert/strict";
import {classifyBrand,chessRedirect,prepareChessMessages,verificationLink} from "../supabase/functions/auth-branded-email/mail-routing.mjs";
const redirect="https://www.chatgenius.pro/spill/sjakk/?chessAccount=1";
const from="Freddys Sjakkakademi <innlogging@chatgenius.pro>";
const payload=(type="magiclink")=>({
 user:{email:"chess@example.org",new_email:"other@example.org"},
 email_data:{email_action_type:type,token:"12345678",token_hash:"private-hash",token_hash_new:"current-hash",redirect_to:redirect}
});
test("Only exact ChatGenius Chess callbacks are assigned the chess brand",()=>{
 assert.equal(chessRedirect(redirect),true);
 assert.equal(chessRedirect("https://chatgenius.pro/spill/sjakk/?chessAccount=1"),true);
 for(const bad of [
  "https://art.example/spill/sjakk/?chessAccount=1",
  "https://chatgenius.pro.evil.tld/spill/sjakk/?chessAccount=1",
  "http://chatgenius.pro/spill/sjakk/?chessAccount=1",
  "https://chatgenius.pro@evil.test/spill/sjakk/?chessAccount=1",
  "https://chatgenius.pro/spill/sjakk/fake?chessAccount=1",
  "https://chatgenius.pro/spill/sjakk/?chessAccount=1&redirect=https://evil.test",
  "https://chatgenius.pro/spill/sjakk/?chessAccount=1#frag",
  "https://chatgenius.pro:8443/spill/sjakk/?chessAccount=1"
 ])assert.equal(chessRedirect(bad),false,bad);
 assert.equal(classifyBrand(payload()),"chatgenius");
 assert.equal(classifyBrand({...payload(),email_data:{...payload().email_data,redirect_to:"https://art.example/"}}),null);
});
test("Chess magic-link email has a verifiable correct redirect and domain identity",()=>{
 const [email]=prepareChessMessages(payload(),{from});
 assert.equal(email.from,from);
 assert.deepEqual(email.to,["chess@example.org"]);
 assert.match(email.subject,/Sjakkakademi/);
 assert.match(email.text,/chatgenius.pro/);
 const link=email.text.match(/https:\/\/[^\s]+/)[0];
 const u=new URL(link);
 assert.equal(u.hostname,"ereapsfcsqtdmzosgnnn.supabase.co");
 assert.equal(u.pathname,"/auth/v1/verify");
 assert.equal(u.searchParams.get("type"),"magiclink");
 assert.equal(u.searchParams.get("token"),"private-hash");
 assert.equal(u.searchParams.get("redirect_to"),redirect);
 assert.ok(email.html.includes("&amp;redirect_to="));
});
test("Each supported Auth action is branded without silently changing receiver",()=>{
 for(const type of ["signup","invite","magiclink","recovery"]){
  const [email]=prepareChessMessages(payload(type),{from});
  assert.equal(email.to[0],"chess@example.org");
  assert.equal(email.from,from);
  assert.equal(new URL(email.text.match(/https:\/\/[^\s]+/)[0]).searchParams.get("type"),type);
 }
});
test("Email-change pairing honors Supabase secure-email-change reversed hashes",()=>{
 const messages=prepareChessMessages(payload("email_change"),{from});
 assert.equal(messages.length,2);
 const old=messages.find(x=>x.to[0]==="chess@example.org");
 const fresh=messages.find(x=>x.to[0]==="other@example.org");
 assert.equal(new URL(old.text.match(/https:\/\/[^\s]+/)[0]).searchParams.get("token"),"current-hash");
 assert.equal(new URL(fresh.text.match(/https:\/\/[^\s]+/)[0]).searchParams.get("token"),"private-hash");
});
test("Reject unsupported actions and missing verified sender before email delivery",()=>{
 assert.throws(()=>prepareChessMessages(payload(),{from:"Art <hello@art.example>\nBcc: x"}));
 assert.throws(()=>prepareChessMessages(payload("wrong"),{from}));
 assert.throws(()=>prepareChessMessages({...payload(),email_data:{...payload().email_data,redirect_to:"https://evil.test/"}},{from}));
 assert.throws(()=>verificationLink({hash:"hash",type:"magiclink",redirect:"https://evil.test"}));
});

test("Reauthentication sends numeric OTP, not a broken Supabase verification link",()=>{
 const [email]=prepareChessMessages(payload("reauthentication"),{from});
 assert.equal(email.to[0],"chess@example.org");
 assert.match(email.text,/12345678/);
 assert.match(email.html,/12345678/);
 assert.doesNotMatch(email.text,/https:\/\//);
 assert.throws(()=>prepareChessMessages({
  ...payload("reauthentication"),
  email_data:{...payload("reauthentication").email_data,token:"not-a-code"}
 },{from}),/Invalid reauthentication code/);
});
test("Sender must be verified ChatGenius domain, never Art or a lookalike",()=>{
 assert.throws(()=>prepareChessMessages(payload(),{from:"Art <contact@art.example>"}),/verified domain/);
 assert.throws(()=>prepareChessMessages(payload(),{from:"Fake <innlogging@chatgenius.pro.evil.tld>"}),/verified domain/);
 const [message]=prepareChessMessages(payload(),{from});
 assert.equal(message.from,from);
});
test("Server handler batches two email-change verifications, not two independent requests",async()=>{
 const fs=await import("node:fs");
 const handler=fs.readFileSync(new URL("../supabase/functions/auth-branded-email/index.ts",import.meta.url),"utf8");
 assert.match(handler,/https:\/\/api\.resend\.com\/emails\/batch/);
 assert.match(handler,/emails\.length>1\?emails:emails\[0\]/);
 assert.doesNotMatch(handler,/for\(const email of emails\)/);
 assert.match(handler,/AUTH_EMAIL_HOOK_ENABLED/);
 assert.match(handler,/new Webhook\(secret\)\.verify/);
});
