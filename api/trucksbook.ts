import crypto from "node:crypto";
const cookieName="vip_admin_session";
function env(n:string){return process.env[n]||""}
function json(data:Record<string,unknown>,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}})}
function supabase(path:string,init:RequestInit={}){const base=env("SUPABASE_URL").replace(/\/+$/,"" ).replace(/\/rest\/v1$/i,"");const key=env("SUPABASE_SERVICE_ROLE_KEY");return fetch(`${base}/rest/v1/${path.replace(/^\/+/,"")}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=representation",...(init.headers||{})}})}
function hashToken(t:string){return crypto.createHash("sha256").update(t).digest("hex")}
function cookies(r:Request){return Object.fromEntries((r.headers.get("cookie")||"").split(";").filter(Boolean).map(v=>{const i=v.indexOf("=");return [v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1).trim())]}))}
async function admin(r:Request){const token=cookies(r)[cookieName];if(!token||!env("SUPABASE_URL")||!env("SUPABASE_SERVICE_ROLE_KEY"))return false;const q=await supabase(`admin_sessions?token_hash=eq.${hashToken(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`);if(!q.ok)return false;return (await q.json()).length>0}
function splitCSV(text:string){
 const sample=text.split(/\r?\n/).slice(0,8).join("\n");
 const candidates=[",",";","\t","|"];
 let delimiter=","; let best=-1;
 for(const d of candidates){
  let count=0,quote=false;
  for(let i=0;i<sample.length;i++){const c=sample[i];if(c==='"'){if(quote&&sample[i+1]==='"')i++;else quote=!quote}else if(!quote&&c===d)count++}
  if(count>best){best=count;delimiter=d}
 }
 const rows:string[][]=[];let row:string[]=[],cell="",quote=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else quote=!quote}
  else if(c===delimiter&&!quote){row.push(cell);cell=""}
  else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=""}
  else cell+=c
 }
 if(cell||row.length){row.push(cell);if(row.some(x=>x.trim()))rows.push(row)}
 return rows;
}
function norm(s:string){
 return String(s||"").toLowerCase().replace(/^\uFEFF/,"").replace(/[\u00A0]/g," ").trim().replace(/[\[\](){}]/g," ").replace(/[^a-z0-9]+/g,"");
}
function col(headers:string[],names:string[],contains:string[]=[]){
 const normalized=headers.map(h=>norm(h));
 for(const n of names){const target=norm(n);const i=normalized.findIndex(h=>h===target);if(i>=0)return i;}
 if(contains.length){const i=normalized.findIndex(h=>contains.every(x=>h.includes(norm(x))));if(i>=0)return i;}
 return -1;
}
function val(row:string[],i:number){return i>=0?String(row[i]??"").trim().replace(/^\uFEFF/,""):"";}
function dateValue(s:string){
 if(!s)return "";
 const t=s.trim();
 if(/^\d{4}-\d{2}-\d{2}/.test(t))return t.slice(0,10);
 const m=t.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
 if(m)return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
 const d=new Date(t);return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10);
}
function numberValue(s:string){
 const raw=String(s||"").replace(/\u00A0/g," ").trim();
 if(!raw)return 0;
 const cleaned=raw.replace(/[^0-9.,-]/g,"");
 if(!cleaned)return 0;
 const lastComma=cleaned.lastIndexOf(","),lastDot=cleaned.lastIndexOf(".");
 let normalized=cleaned;
 if(lastComma>lastDot) normalized=cleaned.replace(/\./g,"").replace(",",".");
 else normalized=cleaned.replace(/,/g,"");
 const n=Number(normalized);
 return Number.isFinite(n)?Math.round(n):0;
}

export async function POST(request:Request){
 try{
  if(!(await admin(request)))return json({error:"Unauthorized"},401);
  const body=await request.json().catch(()=>({})) as {csv?:string};
  const csv=String(body.csv||"").replace(/^\uFEFF/,"");
  if(!csv.trim())return json({error:"CSV data is required."},400);
  const rows=splitCSV(csv);
  if(rows.length<2)return json({error:"The CSV must contain a header row and at least one delivery."},400);

  const headers=rows[0].map(h=>String(h||"").replace(/^\uFEFF/,"").trim());

  // TrucksBook Log Overview currently exports columns such as:
  // Name | Game | From | To | ... | Planned distance | Accepted distance | ... | Cargo | ... | TrucksBookID | Date | Time
  const driverI=col(headers,["Name","Username","Driver","Driver Name","Nickname","User","User Name","Player","Player Name","Employee","Employee Name"]);
  const dateI=col(headers,["Date","Delivery Date","Completed","Completion Date","Delivered"]);
  const timeI=col(headers,["Time"]);
  const acceptedDistanceI=col(headers,["Accepted distance","Accepted Distance [km]","Accepted distance (km)","Driven distance","Driven Distance","Distance","Distance km","Distance (km)","Distance [km]"],["accepteddistance"]);
  const plannedDistanceI=col(headers,["Planned distance","Planned Distance [km]","Planned distance (km)","Planned Distance","Distance planned"],["planneddistance"]);
  const originI=col(headers,["From","Origin","Initial City","Start","Start City","Initial"]);
  const destinationI=col(headers,["To","Destination","Target City","End","Target City","Target"]);
  const cargoI=col(headers,["Cargo","Cargo Name","Freight","Goods","Cargo type"],["cargo"]);
  const idI=col(headers,["TrucksBookID","TrucksBook ID","Job ID","ID"]);

  if(driverI<0 || (acceptedDistanceI<0 && plannedDistanceI<0)){
   const detected=headers.filter(Boolean).slice(0,60);
   return json({error:`Could not identify the TrucksBook Log Overview columns. Detected headers: ${detected.join(" | ")}. Your file format is supported; make sure you uploaded the deliveries export, not User Summaries.`},400);
  }

  const [driversR,membersR]=await Promise.all([
   supabase("drivers?select=id,name"),
   supabase("truckersmp_members?active=eq.true&select=member_id,user_id,username")
  ]);
  if(!driversR.ok||!membersR.ok)return json({error:"Unable to load website drivers/members."},500);
  const drivers=await driversR.json() as Array<{id:string,name:string}>;
  const members=await membersR.json() as Array<{member_id:string;user_id:string;username:string}>;

  const driverMap=new Map<string,string>();
  for(const d of drivers) driverMap.set(norm(d.name), d.id);

  // TrucksBook names should work even when the website's legacy Drivers list
  // has not been populated yet. Use the synchronized TruckersMP member as the
  // source of truth and create a compatible driver row when necessary.
  const memberByName=new Map<string,{member_id:string;username:string}>();
  for(const m of members){
   if(m.username) memberByName.set(norm(m.username),m);
  }

  const missingDrivers:Array<{id:string;name:string;rank:string;flag:string;km:string}> = [];
  for(const m of members){
   const key=norm(m.username);
   if(!key || driverMap.has(key)) continue;
   const id=String(m.member_id||) || `TMP-${crypto.createHash("sha1").update(m.username).digest("hex").slice(0,12)}`;
   missingDrivers.push({id,name:m.username,rank:"Driver",flag:"🌍",km:"0 KM"});
   driverMap.set(key,id);
  }

  if(missingDrivers.length){
   const create=await supabase("drivers?on_conflict=id",{
    method:"POST",
    body:JSON.stringify(missingDrivers),
    headers:{Prefer:"resolution=ignore-duplicates,return=representation"}
   });
   if(!create.ok){
    const details=await create.text();
    return json({error:"Supabase rejected the driver records required for the TrucksBook import.",details,hint:"The importer found TruckersMP members that are not in the Drivers table. Check that public.drivers exists and that its columns are id, name, rank, flag and km."},500);
   }
  }

  let imported=0,skipped=0,unmatched=0;
  const unmatchedNames=new Set<string>();
  const records:any[]=[];

  for(let r=1;r<rows.length;r++){
   const row=rows[r];
   const username=val(row,driverI);
   const deliveryDate=dateValue(val(row,dateI));
   const accepted=acceptedDistanceI>=0?numberValue(val(row,acceptedDistanceI)):0;
   const planned=plannedDistanceI>=0?numberValue(val(row,plannedDistanceI)):0;
   const distance=accepted>0?accepted:planned;
   if(!username||!distance||!deliveryDate){skipped++;continue;}

   const driver_id=driverMap.get(norm(username));
   if(!driver_id){unmatched++;unmatchedNames.add(username);continue;}

   const trucksBookId=idI>=0?val(row,idI):"";
   const identity=trucksBookId || JSON.stringify({username,date:deliveryDate,time:val(row,timeI),origin:val(row,originI),destination:val(row,destinationI),cargo:val(row,cargoI),distance});
   const external_id=crypto.createHash("sha256").update(identity).digest("hex");
   records.push({
    external_id,driver_id,delivery_date:deliveryDate,
    origin:val(row,originI),destination:val(row,destinationI),cargo:val(row,cargoI),
    distance_km:distance,source:"trucksbook"
   });
  }

  if(records.length){
   // Import in small batches so one bad row cannot hide the real Supabase error.
   // First use the TrucksBook-aware schema; if the migration is not installed,
   // fall back to the original delivery_records columns.
   const fullRecords=records;
   let useExtended=true;

   let probe=await supabase("delivery_records?select=id&limit=1");
   if(!probe.ok){
    const probeError=await probe.text();
    return json({
     error:"Supabase rejected the delivery records.",
     details:probeError,
     hint:"The delivery_records table is missing or cannot be read with the configured SUPABASE_SERVICE_ROLE_KEY. Run supabase-schema.sql in Supabase SQL Editor and redeploy."
    },500);
   }

   // Detect whether the optional TrucksBook columns are present.
   const columnProbe=await supabase("delivery_records?select=external_id,source&limit=1");
   if(!columnProbe.ok){
    useExtended=false;
    console.warn("TrucksBook migration columns are not available; using legacy delivery_records schema.");
   }

   const payload=useExtended
    ? fullRecords
    : fullRecords.map(({external_id,source,...record})=>record);

   // Insert in chunks. PostgREST returns the database's actual constraint/error
   // message, which is much more useful than a generic import failure.
   const chunkSize=50;
   const insertedIds:string[]=[];
   for(let i=0;i<payload.length;i+=chunkSize){
    const chunk=payload.slice(i,i+chunkSize);
    const endpoint=useExtended
      ? "delivery_records?on_conflict=external_id"
      : "delivery_records";
    const headers:Record<string,string>=useExtended
      ? {Prefer:"resolution=ignore-duplicates,return=representation"}
      : {Prefer:"return=representation"};
    const ins=await supabase(endpoint,{method:"POST",body:JSON.stringify(chunk),headers});
    if(!ins.ok){
     const errorText=await ins.text();
     console.error("TrucksBook Supabase insert failed:",errorText);
     return json({
      error:"Supabase rejected the delivery records.",
      details:errorText,
      failed_batch:i+1,
      batch_size:chunk.length,
      hint:"The import now creates missing Drivers from synchronized TruckersMP members. If this still fails, check the exact PostgreSQL error above and confirm delivery_records.driver_id references drivers.id."
     },500);
    }
    const inserted=await ins.json().catch(()=>[]);
    if(Array.isArray(inserted)){
      for(const item of inserted){if(item?.id)insertedIds.push(String(item.id));}
    }
   }
   imported=insertedIds.length;
  }

  return json({ok:true,imported,skipped,unmatched,unmatched_names:Array.from(unmatchedNames).slice(0,50),total_rows:rows.length-1,detected_headers:headers});
 }catch(e){console.error(e);return json({error:"Unable to process TrucksBook CSV."},400);}
}
