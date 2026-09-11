import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const cookieName="vip_admin_session";
function env(name:string){return process.env[name]||"";}
function json(data:Record<string,unknown>,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});}
function supabase(path:string,init:RequestInit={}){const base=env("SUPABASE_URL").replace(/\/+$/i,"").replace(/\/rest\/v1$/i,"");const key=env("SUPABASE_SERVICE_ROLE_KEY");return fetch(`${base}/rest/v1/${path.replace(/^\/+/,"")}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=representation",...(init.headers||{})}})}
function parseCookies(request:Request){return Object.fromEntries((request.headers.get("cookie")||"").split(";").filter(Boolean).map(v=>{const i=v.indexOf("=");return[v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1).trim())]}));}
function hashToken(token:string){return crypto.createHash("sha256").update(token).digest("hex");}
async function isAdmin(request:Request){const token=parseCookies(request)[cookieName];if(!token)return false;const r=await supabase(`admin_sessions?token_hash=eq.${hashToken(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`);return r.ok&&(await r.json()).length>0;}
function clean(v:any,max=160){return String(v??"").trim().slice(0,max);}

export async function GET(request:Request){
  if(!(await isAdmin(request)))return json({error:"Unauthorized"},401);
  const r=await supabase("driver_accounts?select=id,username,driver_id,truckersmp_username,active,status,reviewed_by,reviewed_at,created_at,last_login_at,drivers(name,rank)&order=created_at.desc");
  if(!r.ok)return json({error:"Unable to load driver accounts.",details:await r.text()},500);
  return json({accounts:await r.json()});
}

export async function POST(request:Request){
  if(!(await isAdmin(request)))return json({error:"Unauthorized"},401);
  try{
    const body=await request.json().catch(()=>({})) as Record<string,any>;
    const action=clean(body.action,40).toLowerCase();
    if(action==="create"){
      const username=clean(body.username,80).toLowerCase(), password=String(body.password||""), driverId=clean(body.driver_id,120), tmp=clean(body.truckersmp_username,80);
      if(!/^[a-z0-9._-]{3,32}$/.test(username))return json({error:"Username must be 3-32 characters using letters, numbers, dot, underscore or hyphen."},400);
      if(password.length<8)return json({error:"Password must be at least 8 characters."},400);
      if(!driverId||!tmp)return json({error:"Select a driver and provide the TruckersMP username."},400);
      const existing=await supabase(`driver_accounts?username=eq.${encodeURIComponent(username)}&select=id&limit=1`);
      if(existing.ok&&(await existing.json()).length)return json({error:"That driver username is already in use."},409);
      const driver=await supabase(`drivers?id=eq.${encodeURIComponent(driverId)}&select=id,name&limit=1`);
      if(!driver.ok||!(await driver.json()).length)return json({error:"Selected driver profile was not found."},404);
      const password_hash=await bcrypt.hash(password,12);
      const r=await supabase("driver_accounts",{method:"POST",body:JSON.stringify({username,password_hash,driver_id:driverId,truckersmp_username:tmp,active:true,status:"APPROVED",reviewed_at:new Date().toISOString()})});
      if(!r.ok)return json({error:"Unable to create driver account.",details:await r.text()},500);
      return json({ok:true,account:(await r.json())[0]});
    }
    if(action==="approve" || action==="reject"){
      const id=clean(body.id,80); if(!id)return json({error:"Account ID is required."},400);
      const approved=action==="approve";
      const patch:any={status:approved?"APPROVED":"REJECTED",active:approved,reviewed_by:"management",reviewed_at:new Date().toISOString()};
      const r=await supabase(`driver_accounts?id=eq.${encodeURIComponent(id)}&status=eq.PENDING`,{method:"PATCH",body:JSON.stringify(patch)});
      if(!r.ok)return json({error:`Unable to ${approved?'approve':'reject'} registration.`,details:await r.text()},500);
      const rows=await r.json() as Array<any>;
      if(!rows.length)return json({error:"Registration not found or already reviewed."},404);
      if(!approved)await supabase(`driver_sessions?account_id=eq.${encodeURIComponent(id)}`,{method:"DELETE"});
      return json({ok:true,status:patch.status});
    }
    if(action==="reset-password"){
      const id=clean(body.id,80), password=String(body.password||"");
      if(!id||password.length<8)return json({error:"Account and a password of at least 8 characters are required."},400);
      const password_hash=await bcrypt.hash(password,12);
      const r=await supabase(`driver_accounts?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({password_hash,active:true})});
      if(!r.ok)return json({error:"Unable to reset driver password.",details:await r.text()},500);
      await supabase(`driver_sessions?account_id=eq.${encodeURIComponent(id)}`,{method:"DELETE"});
      return json({ok:true});
    }
    if(action==="toggle"){
      const id=clean(body.id,80);if(!id)return json({error:"Account ID is required."},400);
      const find=await supabase(`driver_accounts?id=eq.${encodeURIComponent(id)}&select=id,active,status&limit=1`);if(!find.ok)return json({error:"Unable to find account."},500);const rows=await find.json();if(!rows.length)return json({error:"Account not found."},404);
      if(rows[0].status!=="APPROVED")return json({error:"Approve the registration before enabling or disabling it."},400);
      const active=!Boolean(rows[0].active);
      const r=await supabase(`driver_accounts?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({active})});if(!r.ok)return json({error:"Unable to update account.",details:await r.text()},500);
      if(!active)await supabase(`driver_sessions?account_id=eq.${encodeURIComponent(id)}`,{method:"DELETE"});
      return json({ok:true,active});
    }
    return json({error:"Unknown action."},404);
  }catch(e){console.error(e);return json({error:"Invalid request."},400)}
}
