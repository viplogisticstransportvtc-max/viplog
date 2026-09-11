import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const SESSION_HOURS = 168; // 7 days
const cookieName = "vip_driver_session";

function env(name:string){ return process.env[name] || ""; }
function json(data:Record<string,unknown>, status=200){
  return Response.json(data,{status,headers:{"Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET, POST, OPTIONS"}});
}
function supabase(path:string, init:RequestInit={}){
  const base=env("SUPABASE_URL").replace(/\/+$/i,"").replace(/\/rest\/v1$/i,"");
  const key=env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${base}/rest/v1/${path.replace(/^\/+/,"")}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=representation",...(init.headers||{})}});
}
function clean(v:any,max=160){return String(v??"").trim().slice(0,max);}
function randomToken(){return crypto.randomBytes(32).toString("hex");}
function hashToken(token:string){return crypto.createHash("sha256").update(token).digest("hex");}
function parseCookies(request:Request){return Object.fromEntries((request.headers.get("cookie")||"").split(";").filter(Boolean).map(v=>{const i=v.indexOf("=");return [v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1).trim())];}));}
function cookie(value:string,maxAge:number){return `${cookieName}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`}
function bearer(request:Request){const h=request.headers.get("authorization")||"";return h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";}

export async function currentDriver(request:Request){
  const token=bearer(request)||parseCookies(request)[cookieName];
  if(!token || !env("SUPABASE_URL") || !env("SUPABASE_SERVICE_ROLE_KEY")) return null;
  const r=await supabase(`driver_sessions?token_hash=eq.${encodeURIComponent(hashToken(token))}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,account_id,expires_at&limit=1`);
  if(!r.ok) return null;
  const rows=await r.json() as Array<{id:string;account_id:string;expires_at:string}>;
  if(!rows[0]) return null;
  const a=await supabase(`driver_accounts?id=eq.${encodeURIComponent(rows[0].account_id)}&active=eq.true&status=eq.APPROVED&select=id,username,driver_id,truckersmp_username,active,status&limit=1`);
  if(!a.ok) return null;
  const accounts=await a.json() as Array<any>;
  if(!accounts[0]) return null;
  return {...accounts[0],session_id:rows[0].id};
}

export async function OPTIONS(){return json({ok:true});}

export async function POST(request:Request){
  try{
    const body=await request.json().catch(()=>({})) as Record<string,any>;
    const action=clean(body.action,30).toLowerCase();
    if(action==="logout"){
      const token=bearer(request)||parseCookies(request)[cookieName];
      if(token) await supabase(`driver_sessions?token_hash=eq.${encodeURIComponent(hashToken(token))}`,{method:"DELETE"});
      return new Response(JSON.stringify({ok:true}),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Set-Cookie":cookie("",0)}});
    }
    if(action==="register"){
      const username=clean(body.username,80).toLowerCase();
      const password=String(body.password||"");
      const confirm=String(body.confirmPassword||"");
      const tmp=clean(body.truckersmp_username,80);
      if(!/^[a-z0-9._-]{3,32}$/.test(username)) return json({error:"Username must be 3-32 characters using letters, numbers, dot, underscore or hyphen."},400);
      if(password.length<8) return json({error:"Password must be at least 8 characters."},400);
      if(password!==confirm) return json({error:"Passwords do not match."},400);
      if(!tmp) return json({error:"Enter your TruckersMP username."},400);
      const memberR=await supabase(`truckersmp_members?username=ilike.${encodeURIComponent(tmp)}&active=eq.true&select=member_id,user_id,username&limit=1`);
      if(!memberR.ok) return json({error:"Registration is temporarily unavailable."},500);
      const members=await memberR.json() as Array<any>;
      if(!members[0]) return json({error:"That TruckersMP username is not an active member of the VTC."},403);
      const member=members[0];
      const existing=await supabase(`driver_accounts?or=(username.eq.${encodeURIComponent(username)},truckersmp_username.ilike.${encodeURIComponent(member.username)})&select=id,username,status,active&limit=5`);
      if(!existing.ok) return json({error:"Registration is temporarily unavailable."},500);
      const ex=await existing.json() as Array<any>;
      if(ex.some((a:any)=>String(a.username).toLowerCase()===username)) return json({error:"That login username is already in use."},409);
      if(ex.some((a:any)=>String(a.truckersmp_username||'').toLowerCase()===String(member.username).toLowerCase())) return json({error:"An account already exists for that TruckersMP member."},409);
      let driverR=await supabase(`drivers?name=ilike.${encodeURIComponent(member.username)}&select=id,name&limit=1`);
      if(!driverR.ok) return json({error:"Unable to verify your VTC driver profile."},500);
      let drivers=await driverR.json() as Array<any>;
      let driverId=drivers[0]?.id;
      if(!driverId){
        const createDriver=await supabase("drivers",{method:"POST",body:JSON.stringify({id:member.user_id||member.member_id,name:member.username,rank:"Member",flag:"",km:"0"})});
        if(!createDriver.ok) return json({error:"Your VTC member profile could not be created automatically. Please contact management."},500);
        driverId=(await createDriver.json())[0]?.id;
      }
      const password_hash=await bcrypt.hash(password,12);
      const created=await supabase("driver_accounts",{method:"POST",body:JSON.stringify({username,password_hash,driver_id:driverId,truckersmp_username:member.username,active:false,status:"PENDING"})});
      if(!created.ok) return json({error:"Unable to submit registration.",details:await created.text()},500);
      return json({ok:true,status:"PENDING",message:"Registration submitted. Management must approve your account before you can log in."});
    }
    if(action!=="login") return json({error:"Unknown action."},404);
    const username=clean(body.username,80).toLowerCase();
    const password=String(body.password||"");
    if(!username||!password) return json({error:"Enter your username and password."},400);
    const r=await supabase(`driver_accounts?username=eq.${encodeURIComponent(username)}&active=eq.true&status=eq.APPROVED&select=id,username,password_hash,driver_id,truckersmp_username,active,status&limit=1`);
    if(!r.ok) return json({error:"Driver authentication is unavailable."},500);
    const rows=await r.json() as Array<any>;
    const account=rows[0];
    if(!account || !(await bcrypt.compare(password,String(account.password_hash)))) return json({error:"Invalid username or password."},401);
    const token=randomToken();
    const expires=new Date(Date.now()+SESSION_HOURS*3600_000).toISOString();
    const session=await supabase("driver_sessions",{method:"POST",body:JSON.stringify({token_hash:hashToken(token),account_id:account.id,expires_at:expires})});
    if(!session.ok) return json({error:"Unable to create secure driver session."},500);
    await supabase(`driver_accounts?id=eq.${encodeURIComponent(account.id)}`,{method:"PATCH",body:JSON.stringify({last_login_at:new Date().toISOString()})});
    return json({ok:true,token,expires_at:expires,driver:{username:account.username,driver_id:account.driver_id,truckersmp_username:account.truckersmp_username}});
  }catch(e){console.error(e);return json({error:"Invalid authentication request."},400)}
}

export async function GET(request:Request){
  try{
    const driver=await currentDriver(request);
    if(!driver) return json({authenticated:false},401);
    return json({authenticated:true,driver:{username:driver.username,driver_id:driver.driver_id,truckersmp_username:driver.truckersmp_username}});
  }catch(e){console.error(e);return json({authenticated:false},401)}
}
