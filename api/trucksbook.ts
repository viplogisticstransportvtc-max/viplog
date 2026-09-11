import crypto from "node:crypto";
const cookieName="vip_admin_session";
function env(n:string){return process.env[n]||""}
function json(data:Record<string,unknown>,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}})}
function supabase(path:string,init:RequestInit={}){const base=env("SUPABASE_URL").replace(/\/+$/,"" ).replace(/\/rest\/v1$/i,"");const key=env("SUPABASE_SERVICE_ROLE_KEY");return fetch(`${base}/rest/v1/${path.replace(/^\/+/,"")}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=representation",...(init.headers||{})}})}
function hashToken(t:string){return crypto.createHash("sha256").update(t).digest("hex")}
function cookies(r:Request){return Object.fromEntries((r.headers.get("cookie")||"").split(";").filter(Boolean).map(v=>{const i=v.indexOf("=");return [v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1).trim())]}))}
async function admin(r:Request){const token=cookies(r)[cookieName];if(!token||!env("SUPABASE_URL")||!env("SUPABASE_SERVICE_ROLE_KEY"))return false;const q=await supabase(`admin_sessions?token_hash=eq.${hashToken(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`);if(!q.ok)return false;return (await q.json()).length>0}
function splitCSV(text:string){const rows:string[][]=[];let row:string[]=[],cell="",quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else quote=!quote}else if(c===','&&!quote){row.push(cell);cell=""}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=""}else cell+=c}if(cell||row.length){row.push(cell);rows.push(row)}return rows}
function norm(s:string){return s.toLowerCase().replace(/[^a-z0-9]/g,"")}
function col(headers:string[],names:string[]){for(const n of names){const i=headers.findIndex(h=>norm(h)===norm(n));if(i>=0)return i}return -1}
function val(row:string[],i:number){return i>=0?(row[i]||"").trim():""}
function dateValue(s:string){if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const d=new Date(s);return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10)}
function numberValue(s:string){const m=s.replace(/[^0-9.,-]/g,"").replace(/,/g,"");return Math.round(Number(m))}
export async function POST(request:Request){
 try{
  if(!(await admin(request)))return json({error:"Unauthorized"},401);
  const body=await request.json().catch(()=>({})) as {csv?:string};
  const csv=String(body.csv||"").replace(/^\uFEFF/,""); if(!csv.trim())return json({error:"CSV data is required."},400);
  const rows=splitCSV(csv); if(rows.length<2)return json({error:"The CSV must contain a header row and at least one delivery."},400);
  const headers=rows[0];
  const driverI=col(headers,["Username","Driver","Driver Name","Nickname","User","User Name"]);
  const dateI=col(headers,["Date","Delivery Date","Completed","Completion Date","Time"]);
  const distanceI=col(headers,["Distance","Distance km","Distance (km)","Driven Distance","Accepted Distance"]);
  const originI=col(headers,["Origin","Initial City","From","Start"]);
  const destinationI=col(headers,["Destination","Target City","To","End"]);
  const cargoI=col(headers,["Cargo","Cargo Name","Freight"]);
  if(driverI<0||distanceI<0)return json({error:"Could not find driver/username and distance columns in the TrucksBook CSV. Export the Log Overview CSV and try again."},400);
  const [driversR,membersR]=await Promise.all([supabase("drivers?select=id,name"),supabase("truckersmp_members?active=eq.true&select=member_id,user_id,username")]);
  if(!driversR.ok||!membersR.ok)return json({error:"Unable to load website drivers/members."},500);
  const drivers=await driversR.json() as Array<{id:string,name:string}>; const members=await membersR.json() as Array<{member_id:string;user_id:string;username:string}>;
  const driverMap=new Map<string,string>(); for(const d of drivers)driverMap.set(norm(d.name),d.id); for(const m of members){const match=drivers.find(d=>norm(d.name)===norm(m.username));if(match)driverMap.set(norm(m.username),match.id)}
  let imported=0,skipped=0,unmatched=0; const unmatchedNames=new Set<string>(); const records:any[]=[];
  for(let r=1;r<rows.length;r++){
   const row=rows[r]; const username=val(row,driverI); const distance=numberValue(val(row,distanceI)); const deliveryDate=dateValue(val(row,dateI)); if(!username||!distance||!deliveryDate){skipped++;continue}
   const driver_id=driverMap.get(norm(username)); if(!driver_id){unmatched++;unmatchedNames.add(username);continue}
   const source=JSON.stringify({username,date:deliveryDate,origin:val(row,originI),destination:val(row,destinationI),cargo:val(row,cargoI),distance}); const external_id=crypto.createHash("sha256").update(source).digest("hex");
   records.push({external_id,driver_id,delivery_date:deliveryDate,origin:val(row,originI),destination:val(row,destinationI),cargo:val(row,cargoI),distance_km:distance,source:"trucksbook"});
  }
  if(records.length){const ins=await supabase("delivery_records?on_conflict=external_id",{method:"POST",body:JSON.stringify(records),headers:{Prefer:"resolution=ignore-duplicates,return=representation"}});if(!ins.ok){console.error(await ins.text());return json({error:"Unable to import delivery records into Supabase."},500)}imported=(await ins.json()).length}
  return json({ok:true,imported,skipped,unmatched,unmatched_names:Array.from(unmatchedNames).slice(0,50),total_rows:rows.length-1});
 }catch(e){console.error(e);return json({error:"Unable to process TrucksBook CSV."},400)}
}
