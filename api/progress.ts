import crypto from "node:crypto";

const cookieName = "vip_admin_session";
const GOAL_KM = 10000;

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
    const i=v.indexOf("=");
    return [v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1).trim())];
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
function monthRange(){
  const now=new Date();
  const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));
  const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
  const month=`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}`;
  return {month,start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}

export async function GET(request:Request){
  try{
    if(!env("SUPABASE_URL")||!env("SUPABASE_SERVICE_ROLE_KEY")) return json({error:"Supabase is not configured."},500);
    const {month,start,end}=monthRange();
    const isAdmin=new URL(request.url).searchParams.get("admin")==="1";
    if(isAdmin && !(await currentAdmin(request))) return json({error:"Unauthorized"},401);

    const [driversResponse,deliveriesResponse]=await Promise.all([
      supabase("drivers?select=id,name,rank,flag&order=name.asc"),
      supabase(`delivery_records?delivery_date=gte.${start}&delivery_date=lt.${end}&select=id,driver_id,delivery_date,origin,destination,cargo,distance_km,created_at&order=delivery_date.desc,created_at.desc`)
    ]);
    if(!driversResponse.ok||!deliveriesResponse.ok){
      const details=!driversResponse.ok?await driversResponse.text():await deliveriesResponse.text();
      console.error("PROGRESS LOAD ERROR",details);
      return json({error:"Unable to load driver progress."},500);
    }
    const drivers=await driversResponse.json() as Array<{id:string;name:string;rank:string;flag:string}>;
    const records=await deliveriesResponse.json() as Array<{id:string;driver_id:string;delivery_date:string;origin:string;destination:string;cargo:string;distance_km:number;created_at:string}>;
    const byDriver=new Map<string,{deliveries:number;distance_km:number}>();
    for(const r of records){
      const current=byDriver.get(r.driver_id)||{deliveries:0,distance_km:0};
      current.deliveries+=1;
      current.distance_km+=Number(r.distance_km)||0;
      byDriver.set(r.driver_id,current);
    }
    const rows=drivers.map(d=>{
      const x=byDriver.get(d.id)||{deliveries:0,distance_km:0};
      return {driver_id:d.id,driver_name:d.name,deliveries:x.deliveries,distance_km:x.distance_km,progress:Math.min(100,Math.round((x.distance_km/GOAL_KM)*100)),goal_met:x.distance_km>=GOAL_KM};
    }).filter(r=>r.deliveries>0).sort((a,b)=>b.distance_km-a.distance_km);
    if(isAdmin){
      const nameMap=new Map(drivers.map(d=>[d.id,d.name]));
      return json({deliveries:records.map(r=>({...r,driver_name:nameMap.get(r.driver_id)||r.driver_id})),month,goal_km:GOAL_KM});
    }
    return json({progress:{month,goal_km:GOAL_KM,rows,recent:[]}});
  }catch(e){ console.error(e); return json({error:"Unable to load driver progress."},500); }
}

export async function POST(request:Request){
  try{
    if(!(await currentAdmin(request))) return json({error:"Unauthorized"},401);
    const body=await request.json().catch(()=>({})) as Record<string,any>;
    const driver_id=String(body.driver_id||"").trim();
    const delivery_date=String(body.delivery_date||"").trim();
    const origin=String(body.origin||"").trim();
    const destination=String(body.destination||"").trim();
    const cargo=String(body.cargo||"").trim();
    const distance_km=Math.round(Number(body.distance_km));
    if(!driver_id||!/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)||!Number.isFinite(distance_km)||distance_km<=0) return json({error:"Driver, valid date and a positive distance are required."},400);
    const driverResponse=await supabase(`drivers?id=eq.${encodeURIComponent(driver_id)}&select=id,name&limit=1`);
    if(!driverResponse.ok) return json({error:"Unable to verify driver."},500);
    const driverRows=await driverResponse.json();
    if(!driverRows.length) return json({error:"Driver not found. Add the driver first in Management → Drivers."},404);
    const r=await supabase("delivery_records",{method:"POST",body:JSON.stringify({driver_id,delivery_date,origin,destination,cargo,distance_km})});
    if(!r.ok){console.error("PROGRESS INSERT ERROR",await r.text());return json({error:"Unable to save delivery record."},500);}
    return json({ok:true,item:(await r.json())[0]});
  }catch(e){console.error(e);return json({error:"Invalid delivery record."},400);}
}

export async function DELETE(request:Request){
  try{
    if(!(await currentAdmin(request))) return json({error:"Unauthorized"},401);
    const id=new URL(request.url).searchParams.get("id");
    if(!id) return json({error:"Delivery ID is required."},400);
    const r=await supabase(`delivery_records?id=eq.${encodeURIComponent(id)}`,{method:"DELETE"});
    if(!r.ok){console.error("PROGRESS DELETE ERROR",await r.text());return json({error:"Unable to delete delivery record."},500);}
    return json({ok:true});
  }catch(e){console.error(e);return json({error:"Invalid request."},400);}
}
