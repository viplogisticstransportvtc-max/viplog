import crypto from "node:crypto";

const cookieName = "vip_admin_session";
const VTC_ID = "91177";

function env(name:string){ return process.env[name] || ""; }
function json(data:Record<string,unknown>, status=200){ return Response.json(data,{status,headers:{"Cache-Control":"no-store"}}); }
function supabase(path:string, init:RequestInit={}){
  const base=env("SUPABASE_URL").replace(/\/+$/,"" ).replace(/\/rest\/v1$/i,"");
  const key=env("SUPABASE_SERVICE_ROLE_KEY");
  const clean=path.replace(/^\/+/,"");
  return fetch(`${base}/rest/v1/${clean}`,{
    ...init,
    headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=representation",...(init.headers||{})}
  });
}
function hashToken(token:string){ return crypto.createHash("sha256").update(token).digest("hex"); }
function parseCookies(request:Request){
  return Object.fromEntries((request.headers.get("cookie")||"").split(";").filter(Boolean).map(v=>{
    const i=v.indexOf("="); return [v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1).trim())];
  }));
}
async function currentAdmin(request:Request){
  const token=parseCookies(request)[cookieName];
  if(!token||!env("SUPABASE_URL")||!env("SUPABASE_SERVICE_ROLE_KEY")) return null;
  const r=await supabase(`admin_sessions?token_hash=eq.${hashToken(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,admin_id&limit=1`);
  if(!r.ok) return null;
  const rows=await r.json() as Array<{id:string;admin_id:string}>;
  return rows[0]||null;
}
function cronAuthorized(request:Request){
  const secret=env("CRON_SECRET");
  if(!secret) return false;
  const auth=request.headers.get("authorization")||"";
  return auth===`Bearer ${secret}`;
}
function first(...values:any[]){ return values.find(v=>v!==undefined&&v!==null&&String(v).trim()!==""); }
function normalizeMember(raw:any){
  const nestedUser=raw.user||raw.player||{};
  const userId=first(raw.user_id,raw.userId,raw.userid,raw.userID,nestedUser.id,nestedUser.user_id,nestedUser.userId);
  const memberId=first(raw.id,raw.member_id,raw.memberId,raw.vtc_member_id);
  const username=first(raw.username,raw.name,raw.user_name,raw.userName,nestedUser.name,nestedUser.username)||`Member ${memberId||userId||""}`;
  const avatar=first(raw.avatar,raw.avatar_url,nestedUser.avatar,nestedUser.avatar_url)||"";
  const role=first(raw.role_name,raw.roleName,raw.role?.name,raw.role,nestedUser.vtc?.role?.name)||"Member";
  const joinedAt=first(raw.joinDate,raw.joined_at,raw.joinedAt,raw.created_at,raw.createdAt)||null;
  return {
    member_id:String(memberId||userId||crypto.randomUUID()),
    user_id:userId?String(userId):null,
    username:String(username), avatar_url:String(avatar), role:String(role),
    joined_at:joinedAt, raw:raw
  };
}
async function fetchTruckersMP(){
  const r=await fetch(`https://api.truckersmp.com/v2/vtc/${VTC_ID}/members`,{
    headers:{
      Accept:"application/json",
      "User-Agent":"VIP-LOGISTICS-TRANSPORT-VTC/1.0"
    },
    cache:"no-store"
  });
  const text=await r.text();
  if(!r.ok) throw new Error(`TruckersMP API returned HTTP ${r.status}: ${text.slice(0,300)}`);
  let data:any;
  try {
    data=JSON.parse(text);
  } catch {
    throw new Error(`TruckersMP returned a non-JSON response. HTTP ${r.status}: ${text.slice(0,300)}`);
  }
  // Official v2 API wraps VTC results in a "response" object.
  // Keep compatibility with older/alternate response shapes too.
  const members=Array.isArray(data?.response?.members)
    ? data.response.members
    : Array.isArray(data?.members)
      ? data.members
      : Array.isArray(data)
        ? data
        : [];
  if(data?.error===true) throw new Error(String(data?.descriptor||data?.response||"TruckersMP API reported an error."));
  return members.map(normalizeMember);
}
async function syncMembers(){
  const members=await fetchTruckersMP();
  if(!env("SUPABASE_URL")||!env("SUPABASE_SERVICE_ROLE_KEY")) throw new Error("Supabase is not configured.");
  const upsert=await supabase("truckersmp_members?on_conflict=member_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(members.map(m=>({member_id:m.member_id,user_id:m.user_id,username:m.username,avatar_url:m.avatar_url,role:m.role,joined_at:m.joined_at,active:true,last_synced_at:new Date().toISOString(),raw:m.raw}))) });
  if(!upsert.ok) throw new Error(await upsert.text());
  const ids=members.map(m=>m.member_id);
  if(ids.length){
    const filter=ids.map(id=>`\"${id.replace(/\"/g,"\\\"")}\"`).join(",");
    const deactivate=await supabase(`truckersmp_members?member_id=not.in.(${filter})`,{method:"PATCH",body:JSON.stringify({active:false,last_synced_at:new Date().toISOString()})});
    if(!deactivate.ok) console.error("Unable to mark former members inactive",await deactivate.text());
  } else {
    await supabase("truckersmp_members?active=eq.true",{method:"PATCH",body:JSON.stringify({active:false,last_synced_at:new Date().toISOString()})});
  }
  return members.length;
}

export async function GET(request:Request){
  try{
    const url=new URL(request.url);
    const doSync=url.searchParams.get("sync")==="1";
    const isCron=url.searchParams.get("cron")==="1";
    if(doSync || isCron){
      if(!(await currentAdmin(request)) && !cronAuthorized(request)) return json({error:"Unauthorized"},401);
      const count=await syncMembers();
      return json({ok:true,synced:count});
    }
    const r=await supabase("truckersmp_members?active=eq.true&select=member_id,user_id,username,avatar_url,role,joined_at,active,last_synced_at&order=username.asc");
    if(!r.ok) return json({error:"Unable to load TruckersMP members."},500);
    const members=await r.json();
    return json({members,vtc_id:VTC_ID});
  }catch(e){ console.error("TRUCKERSMP",e); return json({error:e instanceof Error?e.message:"Unable to sync TruckersMP members."},500); }
}

export async function POST(request:Request){
  try{
    if(!(await currentAdmin(request))) return json({error:"Unauthorized"},401);
    const count=await syncMembers();
    return json({ok:true,synced:count});
  }catch(e){ console.error("TRUCKERSMP SYNC",e); return json({error:e instanceof Error?e.message:"Unable to sync TruckersMP members."},500); }
}
