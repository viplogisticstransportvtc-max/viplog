const cookieName = "vip_admin_session";
function env(name:string){ return process.env[name] || ""; }
function json(data:Record<string,unknown>, status=200){ return Response.json(data,{status,headers:{"Cache-Control":"no-store"}}); }
function supabase(path:string, init:RequestInit={}){
  const base=env("SUPABASE_URL").replace(/\/+$/,"" ).replace(/\/rest\/v1$/i,"");
  const key=env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${base}/rest/v1/${path.replace(/^\/+/,"")}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=representation",...(init.headers||{})}});
}
function parseCookies(request:Request){return Object.fromEntries((request.headers.get("cookie")||"").split(";").filter(Boolean).map(v=>{const i=v.indexOf("=");return [v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1).trim())];}));}
async function isAdmin(request:Request){const token=parseCookies(request)[cookieName]; if(!token)return false; const crypto=await import("node:crypto"); const hash=crypto.createHash("sha256").update(token).digest("hex"); const r=await supabase(`admin_sessions?token_hash=eq.${hash}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`); return r.ok && (await r.json()).length>0;}
function clean(v:any,max=160){return String(v??"").trim().slice(0,max);}

export async function POST(request:Request){
  try{
    const body=await request.json().catch(()=>({})) as Record<string,any>;
    const username=clean(body.truckersmp_username,80), origin=clean(body.origin), destination=clean(body.destination), cargo=clean(body.cargo), truck=clean(body.truck,100), trailer=clean(body.trailer,100), date=clean(body.delivery_date,20);
    const start=Math.round(Number(body.start_km)), end=Math.round(Number(body.end_km));
    if(!username||!origin||!destination||!cargo||!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start) return json({error:"Enter your TruckersMP username, delivery details, and valid start/end KM. End KM must be greater than start KM."},400);
    const distance_km=end-start;
    const id=crypto.randomUUID();
    const r=await supabase("delivery_submissions",{method:"POST",body:JSON.stringify({id,truckersmp_username:username,origin,destination,cargo,truck,trailer,delivery_date:date,start_km:start,end_km:end,distance_km,status:"PENDING"})});
    if(!r.ok){const details=await r.text();console.error(details);return json({error:"Unable to submit delivery.",details},500);}
    return json({ok:true,distance_km});
  }catch(e){console.error(e);return json({error:"Invalid delivery submission."},400);}
}

export async function GET(request:Request){
  if(!(await isAdmin(request))) return json({error:"Unauthorized"},401);
  const r=await supabase("delivery_submissions?status=eq.PENDING&select=id,truckersmp_username,origin,destination,cargo,truck,trailer,delivery_date,start_km,end_km,distance_km,status,created_at&order=created_at.desc");
  if(!r.ok)return json({error:"Unable to load pending deliveries.",details:await r.text()},500);
  return json({submissions:await r.json()});
}

export async function PATCH(request:Request){
  if(!(await isAdmin(request))) return json({error:"Unauthorized"},401);
  try{
    const body=await request.json().catch(()=>({})) as Record<string,any>;
    const id=clean(body.id,80), action=clean(body.action,20).toUpperCase();
    if(!id||!["APPROVE","REJECT"].includes(action))return json({error:"Invalid moderation request."},400);
    const find=await supabase(`delivery_submissions?id=eq.${encodeURIComponent(id)}&status=eq.PENDING&select=*`);
    if(!find.ok)return json({error:"Unable to find submission."},500);
    const rows=await find.json(); if(!rows.length)return json({error:"Submission not found or already processed."},404);
    const s=rows[0];
    if(action==="REJECT"){
      const r=await supabase(`delivery_submissions?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({status:"REJECTED",reviewed_at:new Date().toISOString()})});
      if(!r.ok)return json({error:"Unable to reject submission.",details:await r.text()},500);
      return json({ok:true,status:"REJECTED"});
    }
    const members=await supabase(`truckersmp_members?active=eq.true&username=ilike.${encodeURIComponent(s.truckersmp_username)}&select=user_id,username&limit=1`);
    let driverId="";
    if(members.ok){const m=await members.json();if(m[0]?.user_id)driverId=String(m[0].user_id);}
    if(!driverId){
      const drivers=await supabase(`drivers?name=ilike.${encodeURIComponent(s.truckersmp_username)}&select=id&limit=1`);
      if(drivers.ok){const d=await drivers.json();if(d[0]?.id)driverId=String(d[0].id);}
    }
    if(!driverId){return json({error:`No driver profile found for ${s.truckersmp_username}. Sync TruckersMP members or create the driver first.`},404);}
    const record=await supabase("delivery_records",{method:"POST",body:JSON.stringify({driver_id:driverId,delivery_date:s.delivery_date,origin:s.origin,destination:s.destination,cargo:s.cargo,distance_km:s.distance_km,source:"vip-delivery" ,external_id:`vip-${s.id}`})});
    if(!record.ok){const details=await record.text();console.error(details);return json({error:"Unable to create the delivery record.",details},500);}
    const update=await supabase(`delivery_submissions?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({status:"APPROVED",reviewed_at:new Date().toISOString(),driver_id:driverId})});
    if(!update.ok)return json({error:"Delivery was recorded but submission status could not be updated.",details:await update.text()},500);
    return json({ok:true,status:"APPROVED"});
  }catch(e){console.error(e);return json({error:"Unable to process submission."},500);}
}
