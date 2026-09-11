import { currentDriver } from "./driver-auth";

const cookieName = "vip_admin_session";
function env(name:string){ return process.env[name] || ""; }
function json(data:Record<string,unknown>, status=200){ return Response.json(data,{status,headers:{"Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET, POST, PATCH, OPTIONS"}}); }
export async function OPTIONS(){ return json({ok:true}); }
function supabase(path:string, init:RequestInit={}){
  const base=env("SUPABASE_URL").replace(/\/+$/,"" ).replace(/\/rest\/v1$/i,"");
  const key=env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${base}/rest/v1/${path.replace(/^\/+/,"")}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=representation",...(init.headers||{})}});
}
function parseCookies(request:Request){return Object.fromEntries((request.headers.get("cookie")||"").split(";").filter(Boolean).map(v=>{const i=v.indexOf("=");return [v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1).trim())];}));}
async function isAdmin(request:Request){const token=parseCookies(request)[cookieName]; if(!token)return false; const crypto=await import("node:crypto"); const hash=crypto.createHash("sha256").update(token).digest("hex"); const r=await supabase(`admin_sessions?token_hash=eq.${hash}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`); return r.ok && (await r.json()).length>0;}
function clean(v:any,max=160){return String(v??"").trim().slice(0,max);}
function validKm(v:any){const n=Math.round(Number(v)); return Number.isFinite(n)&&n>=0?n:null;}


async function resolveDriverId(username:string){
  const drivers=await supabase(`drivers?name=ilike.${encodeURIComponent(username)}&select=id,name&limit=1`);
  if(drivers.ok){
    const d=await drivers.json();
    if(d[0]?.id) return String(d[0].id);
  }
  const members=await supabase(`truckersmp_members?active=eq.true&username=ilike.${encodeURIComponent(username)}&select=user_id,username,role&limit=1`);
  let member:any=null;
  if(members.ok){const m=await members.json();member=m[0]||null;}
  const newId=`TMP-${String(member?.user_id||username).replace(/[^A-Za-z0-9_-]/g,'')}`;
  const create=await supabase("drivers",{method:"POST",body:JSON.stringify({
    id:newId,
    name:username,
    rank:member?.role||"Driver",
    flag:"🌍",
    km:"0 KM"
  })});
  if(create.ok){
    const created=await create.json();
    return String(created[0]?.id||newId);
  }
  const retry=await supabase(`drivers?id=eq.${encodeURIComponent(newId)}&select=id&limit=1`);
  if(retry.ok){const rr=await retry.json();if(rr[0]?.id)return String(rr[0].id);}
  return "";
}

async function finalizeCompletedDelivery(a:any,end:number,distance_km:number){
  const submissionId=String(a.submission_id||crypto.randomUUID());
  const driverId=await resolveDriverId(String(a.truckersmp_username));
  if(!driverId) throw new Error(`Unable to identify driver ${a.truckersmp_username}.`);

  // Use the active-delivery ID as the permanent external identity. This makes
  // automatic retries safe and prevents duplicate KM records.
  const externalId=`vip-active-${a.id}`;
  const existing=await supabase(`delivery_records?external_id=eq.${encodeURIComponent(externalId)}&select=id,driver_id,distance_km&limit=1`);
  if(!existing.ok) throw new Error(`Unable to verify existing delivery record: ${await existing.text()}`);
  const existingRows=await existing.json();
  if(!existingRows.length){
    const payload={driver_id:driverId,delivery_date:a.delivery_date,origin:a.origin,destination:a.destination,cargo:a.cargo,distance_km,source:"vip-delivery",external_id:externalId};
    const record=await supabase("delivery_records",{method:"POST",body:JSON.stringify(payload)});
    if(!record.ok){
      const details=await record.text();
      // Retry with the core schema for older deployments that have not yet
      // added the optional source/external_id columns.
      const fallback=await supabase("delivery_records",{method:"POST",body:JSON.stringify({driver_id:driverId,delivery_date:a.delivery_date,origin:a.origin,destination:a.destination,cargo:a.cargo,distance_km})});
      if(!fallback.ok) throw new Error(`Unable to create the delivery record. ${details} | ${await fallback.text()}`);
    }
  }

  const submissionExists=await supabase(`delivery_submissions?id=eq.${encodeURIComponent(submissionId)}&select=id&limit=1`);
  if(submissionExists.ok && (await submissionExists.json()).length){
    const upd=await supabase(`delivery_submissions?id=eq.${encodeURIComponent(submissionId)}`,{method:"PATCH",body:JSON.stringify({status:"APPROVED",driver_id:driverId,reviewed_at:new Date().toISOString(),end_km:end,distance_km})});
    if(!upd.ok) throw new Error(`Delivery was recorded but submission status could not be updated. ${await upd.text()}`);
  }else{
    const sub=await supabase("delivery_submissions",{method:"POST",body:JSON.stringify({id:submissionId,truckersmp_username:a.truckersmp_username,driver_id:driverId,delivery_date:a.delivery_date,origin:a.origin,destination:a.destination,cargo:a.cargo,truck:a.truck,trailer:a.trailer,start_km:a.start_km,end_km:end,distance_km,status:"APPROVED",reviewed_at:new Date().toISOString()})});
    if(!sub.ok){
      // The delivery record is already safely recorded; leave the active row
      // open so the next automatic retry can finish the audit trail.
      throw new Error(`Delivery was recorded but submission history could not be saved. ${await sub.text()}`);
    }
  }

  const done=await supabase(`active_deliveries?id=eq.${encodeURIComponent(a.id)}&status=eq.ACTIVE`,{method:"PATCH",body:JSON.stringify({status:"COMPLETED",end_km:end,distance_km,completed_at:new Date().toISOString(),submission_id:submissionId})});
  if(!done.ok) throw new Error(`Delivery was recorded but the active delivery could not be closed. ${await done.text()}`);
  return {submissionId,driverId};
}

export async function POST(request:Request){
  try{
    const body=await request.json().catch(()=>({})) as Record<string,any>;
    const action=clean(body.action,20).toUpperCase();
    if(action==="START_ADMIN"){
      if(!(await isAdmin(request))) return json({error:"Unauthorized"},401);
      const username=clean(body.truckersmp_username,80), origin=clean(body.origin), destination=clean(body.destination), cargo=clean(body.cargo), truck=clean(body.truck,100), trailer=clean(body.trailer,100), date=clean(body.delivery_date,20);
      const start=validKm(body.start_km);
      if(!username||!origin||!destination||!cargo||!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||start===null) return json({error:"Enter the driver, route, cargo, date and valid starting KM."},400);
      const existing=await supabase(`active_deliveries?truckersmp_username=eq.${encodeURIComponent(username)}&status=eq.ACTIVE&select=id&limit=1`);
      if(existing.ok && (await existing.json()).length) return json({error:"This driver already has an active delivery."},409);
      const id=crypto.randomUUID();
      const r=await supabase("active_deliveries",{method:"POST",body:JSON.stringify({id,truckersmp_username:username,delivery_date:date,origin,destination,cargo,truck,trailer,start_km:start,status:"ACTIVE"})});
      if(!r.ok)return json({error:"Unable to start delivery.",details:await r.text()},500);
      return json({ok:true,delivery:(await r.json())[0]});
    }
    if(action==="START"){
      const driver=await currentDriver(request);
      if(!driver) return json({error:"Driver login required."},401);
      const username=String(driver.truckersmp_username), origin=clean(body.origin), destination=clean(body.destination), cargo=clean(body.cargo), truck=clean(body.truck,100), trailer=clean(body.trailer,100), date=clean(body.delivery_date,20);
      const start=validKm(body.start_km);
      if(!username||!origin||!destination||!cargo||!date||!/^(\d{4})-(\d{2})-(\d{2})$/.test(date)||start===null) return json({error:"Enter your username, route, cargo, delivery date and valid starting KM."},400);
      const existing=await supabase(`active_deliveries?truckersmp_username=eq.${encodeURIComponent(username)}&status=eq.ACTIVE&select=id&limit=1`);
      if(existing.ok && (await existing.json()).length) return json({error:"You already have an active delivery. Complete it before starting another."},409);
      const id=crypto.randomUUID();
      const r=await supabase("active_deliveries",{method:"POST",body:JSON.stringify({id,truckersmp_username:username,delivery_date:date,origin,destination,cargo,truck,trailer,start_km:start,status:"ACTIVE"})});
      if(!r.ok)return json({error:"Unable to start delivery.",details:await r.text()},500);
      return json({ok:true,delivery: (await r.json())[0]});
    }
    // Backwards-compatible one-shot submission.
    const driver=await currentDriver(request);
    if(!driver) return json({error:"Driver login required."},401);
    const username=String(driver.truckersmp_username), origin=clean(body.origin), destination=clean(body.destination), cargo=clean(body.cargo), truck=clean(body.truck,100), trailer=clean(body.trailer,100), date=clean(body.delivery_date,20);
    const start=validKm(body.start_km), end=validKm(body.end_km);
    if(!username||!origin||!destination||!cargo||!date||!/^(\d{4})-(\d{2})-(\d{2})$/.test(date)||start===null||end===null||end<=start) return json({error:"Enter your TruckersMP username, delivery details, and valid start/end KM. End KM must be greater than start KM."},400);
    const distance_km=end-start;
    const id=crypto.randomUUID();
    const r=await supabase("delivery_submissions",{method:"POST",body:JSON.stringify({id,truckersmp_username:username,origin,destination,cargo,truck,trailer,delivery_date:date,start_km:start,end_km:end,distance_km,status:"PENDING"})});
    if(!r.ok){const details=await r.text();console.error(details);return json({error:"Unable to submit delivery.",details},500);}
    return json({ok:true,distance_km});
  }catch(e){console.error(e);return json({error:"Invalid delivery request."},400);}
}

export async function GET(request:Request){
  try {
  const url=new URL(request.url);
  const requestedActive=clean(url.searchParams.get("active"),80);
  if(requestedActive){
    const driver=await currentDriver(request);
    if(!driver) return json({error:"Driver login required."},401);
    const activeUsername=String(driver.truckersmp_username);
    const r=await supabase(`active_deliveries?truckersmp_username=eq.${encodeURIComponent(activeUsername)}&status=eq.ACTIVE&select=id,truckersmp_username,delivery_date,origin,destination,cargo,truck,trailer,start_km,started_at,status&order=started_at.desc&limit=1`);
    if(!r.ok)return json({error:"Unable to load active delivery."},500);
    return json({active:(await r.json())[0]||null});
  }
  if(!(await isAdmin(request))) return json({error:"Unauthorized"},401);
  const [pending, active] = await Promise.all([
    supabase("delivery_submissions?status=eq.PENDING&select=id,truckersmp_username,origin,destination,cargo,truck,trailer,delivery_date,start_km,end_km,distance_km,status,created_at&order=created_at.desc"),
    supabase("active_deliveries?status=eq.ACTIVE&select=id,truckersmp_username,delivery_date,origin,destination,cargo,truck,trailer,start_km,started_at,status&order=started_at.desc")
  ]);
  if(!pending.ok)return json({error:"Unable to load pending deliveries.",details:await pending.text()},500);
  if(!active.ok)return json({error:"Unable to load active deliveries.",details:await active.text()},500);
  const pendingText=await pending.text();
  const activeText=await active.text();
  let pendingRows:any[]=[]; let activeRows:any[]=[];
  try { pendingRows=pendingText?JSON.parse(pendingText):[]; } catch {
    return json({error:"Unable to load pending deliveries.",details:"The database returned an invalid response."},500);
  }
  try { activeRows=activeText?JSON.parse(activeText):[]; } catch {
    return json({error:"Unable to load active deliveries.",details:"The database returned an invalid response."},500);
  }
  return json({submissions:Array.isArray(pendingRows)?pendingRows:[],active_deliveries:Array.isArray(activeRows)?activeRows:[]});
  } catch(e) {
    console.error("GET /api/deliveries failed",e);
    return json({error:"Unable to load pending deliveries.",details:e instanceof Error?e.message:"Unexpected server error."},500);
  }
}

export async function PATCH(request:Request){
  const url=new URL(request.url);
  try{
    const body=await request.json().catch(()=>({})) as Record<string,any>;
    const action=clean(body.action,20).toUpperCase();
    if(action==="COMPLETE_ADMIN"){
      if(!(await isAdmin(request))) return json({error:"Unauthorized"},401);
      const id=clean(body.id,80), end=validKm(body.end_km);
      if(!id||end===null)return json({error:"Missing active delivery or ending KM."},400);
      const find=await supabase(`active_deliveries?id=eq.${encodeURIComponent(id)}&status=eq.ACTIVE&select=*`);
      if(!find.ok)return json({error:"Unable to find active delivery.",details:await find.text()},500);
      const rows=await find.json(); if(!rows.length)return json({error:"Active delivery not found or already completed."},404);
      const a=rows[0]; if(end<=Number(a.start_km))return json({error:"Ending KM must be greater than starting KM."},400);
      const distance_km=end-Number(a.start_km);
      try{
        const result=await finalizeCompletedDelivery(a,end,distance_km);
        return json({ok:true,distance_km,submission_id:result.submissionId,status:"APPROVED",automatic:true});
      }catch(e){return json({error:String(e instanceof Error?e.message:e)},500);}
    }
    if(action==="COMPLETE"){
      const driver=await currentDriver(request);
      if(!driver) return json({error:"Driver login required."},401);
      const id=clean(body.id,80), end=validKm(body.end_km);
      if(!id||end===null)return json({error:"Missing active delivery or ending KM."},400);
      const find=await supabase(`active_deliveries?id=eq.${encodeURIComponent(id)}&status=eq.ACTIVE&select=*`);
      if(!find.ok)return json({error:"Unable to find active delivery.",details:await find.text()},500);
      const rows=await find.json(); if(!rows.length)return json({error:"Active delivery not found or already completed."},404);
      const a=rows[0];
      if(String(a.truckersmp_username).toLowerCase()!==String(driver.truckersmp_username).toLowerCase()) return json({error:"You can only complete your own delivery."},403);
      if(end<=Number(a.start_km))return json({error:"Ending KM must be greater than starting KM."},400);
      const distance_km=end-Number(a.start_km);
      try{
        // Fully automatic mode: completion immediately records and approves the
        // delivery. The admin panel remains an audit/history view instead of a
        // manual approval gate.
        const result=await finalizeCompletedDelivery(a,end,distance_km);
        return json({ok:true,distance_km,submission_id:result.submissionId,status:"APPROVED",automatic:true});
      }catch(e){return json({error:String(e instanceof Error?e.message:e)},500);}
    }
    if(!(await isAdmin(request))) return json({error:"Unauthorized"},401);
    const id=clean(body.id,80);
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
    // Resolve the website driver profile FIRST. A TruckersMP user_id is not the same
    // thing as this site's drivers.id, so using member.user_id directly can violate
    // the delivery_records foreign key.
    const drivers=await supabase(`drivers?name=ilike.${encodeURIComponent(s.truckersmp_username)}&select=id,name&limit=1`);
    let driverId="";
    if(drivers.ok){const d=await drivers.json();if(d[0]?.id)driverId=String(d[0].id);}

    const members=await supabase(`truckersmp_members?active=eq.true&username=ilike.${encodeURIComponent(s.truckersmp_username)}&select=user_id,username,role&limit=1`);
    let member:any=null;
    if(members.ok){const m=await members.json();member=m[0]||null;}

    // If no manual website driver exists, create one from the synced TruckersMP member.
    if(!driverId && member?.user_id){
      const newId=`TMP-${String(member.user_id).replace(/[^A-Za-z0-9_-]/g,"")}`;
      const create=await supabase("drivers",{method:"POST",body:JSON.stringify({
        id:newId,
        name:s.truckersmp_username,
        rank:member.role||"Driver",
        flag:"🌍",
        km:"0 KM"
      })});
      if(create.ok){
        const created=await create.json();
        driverId=String(created[0]?.id||newId);
      }else{
        // Handle a concurrent/previous auto-created profile gracefully.
        const retry=await supabase(`drivers?id=eq.${encodeURIComponent(newId)}&select=id&limit=1`);
        if(retry.ok){const rr=await retry.json();if(rr[0]?.id)driverId=String(rr[0].id);}
      }
    }
    if(!driverId)return json({error:`No driver profile found for ${s.truckersmp_username}. Sync TruckersMP members or create the driver first.`},404);

    const externalId=`vip-${s.id}`;
    // Approval is idempotent: if the same submission was already recorded, do not
    // create a second delivery record.
    const existingRecord=await supabase(`delivery_records?external_id=eq.${encodeURIComponent(externalId)}&select=id,driver_id,distance_km&limit=1`);
    if(existingRecord.ok){
      const er=await existingRecord.json();
      if(er.length){
        const update=await supabase(`delivery_submissions?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({status:"APPROVED",reviewed_at:new Date().toISOString(),driver_id:driverId})});
        if(!update.ok)return json({error:"Delivery record already exists but submission status could not be updated.",details:await update.text()},500);
        return json({ok:true,status:"APPROVED",already_recorded:true});
      }
    }

    const record=await supabase("delivery_records",{method:"POST",body:JSON.stringify({driver_id:driverId,delivery_date:s.delivery_date,origin:s.origin,destination:s.destination,cargo:s.cargo,distance_km:s.distance_km,source:"vip-delivery",external_id:externalId})});
    if(!record.ok){
      const details=await record.text();
      console.error(details);
      // Compatibility fallback for databases where the optional TrucksBook/V.I.P
      // columns have not yet been added. The core delivery schema is sufficient
      // to count the kilometres.
      const fallback=await supabase("delivery_records",{method:"POST",body:JSON.stringify({driver_id:driverId,delivery_date:s.delivery_date,origin:s.origin,destination:s.destination,cargo:s.cargo,distance_km:s.distance_km})});
      if(!fallback.ok){
        const fallbackDetails=await fallback.text();
        return json({error:"Unable to create the delivery record.",details:`Primary insert: ${details}\nFallback insert: ${fallbackDetails}`},500);
      }
    }
    const update=await supabase(`delivery_submissions?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({status:"APPROVED",reviewed_at:new Date().toISOString(),driver_id:driverId})});
    if(!update.ok)return json({error:"Delivery was recorded but submission status could not be updated.",details:await update.text()},500);
    return json({ok:true,status:"APPROVED"});
  }catch(e){console.error(e);return json({error:"Unable to process delivery."},400);}
}
