import bcrypt from "bcryptjs";
import crypto from "node:crypto";

type Content = {
  drivers: Array<{id:string;name:string;rank:string;flag:string;km:string}>;
  fleet: Array<{id:string;make:string;model:string;image:string}>;
  convoys: Array<{id:string;name:string;date:string;time:string;from:string;to:string;server:string;distance:string}>;
  news: Array<{id:string;category:string;date:string;title:string;description:string}>;
};
type GalleryItem = { id:string; title:string; image_url:string; category:string; description:string; sort_order:number; created_at?:string };

const cookieName="vip_admin_session"; const sessionHours=24;
function env(name:string){return process.env[name]||"";}
function json(data:Record<string,unknown>,status=200,headers:Record<string,string>={}){return Response.json(data,{status,headers:{"Cache-Control":"no-store",...headers}});}
function supabase(path:string,init:RequestInit={}){
  const base=env("SUPABASE_URL").replace(/\/+$/,"").trim().replace(/\/rest\/v1$/i,"");
  const key=env("SUPABASE_SERVICE_ROLE_KEY"); const clean=path.replace(/^\/+/,"");
  return fetch(`${base}/rest/v1/${clean}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=representation",...(init.headers||{})}});
}
function randomToken(){return crypto.randomBytes(32).toString("hex");}
function hashToken(token:string){return crypto.createHash("sha256").update(token).digest("hex");}
function parseCookies(request:Request){return Object.fromEntries((request.headers.get("cookie")||"").split(";").filter(Boolean).map(v=>{const i=v.indexOf("=");return[v.slice(0,i).trim(),decodeURIComponent(v.slice(i+1).trim())]}));}
function cookie(value:string,maxAge:number){return `${cookieName}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`}
async function currentAdmin(request:Request){const token=parseCookies(request)[cookieName];if(!token||!env("SUPABASE_URL")||!env("SUPABASE_SERVICE_ROLE_KEY"))return null;const r=await supabase(`admin_sessions?token_hash=eq.${hashToken(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,admin_id&limit=1`);if(!r.ok)return null;const rows=await r.json() as Array<{id:string;admin_id:string}>;return rows[0]||null;}

async function readTable(table:string){const r=await supabase(`${table}?select=*&order=created_at.desc`);if(!r.ok)throw new Error(await r.text());return await r.json();}
async function readContent():Promise<Content>{
  const [drivers,fleet,convoys,news]=await Promise.all([readTable("drivers"),readTable("fleet"),readTable("convoys"),readTable("news")]);
  return {drivers,fleet,convoys,news};
}

export async function GET(request:Request){
 try{
  const action=new URL(request.url).searchParams.get("action");
  if(action==="session")return json({authenticated:!!(await currentAdmin(request))});
  if(action==="content")return json({content:await readContent()});
  if(action==="gallery"){const r=await supabase("gallery?select=id,title,image_url,category,description,sort_order,created_at&order=sort_order.asc,created_at.desc");if(!r.ok)return json({error:"Unable to load gallery."},500);return json({items:await r.json()});}
  return json({error:"Unknown action."},404);
 }catch(e){console.error(e);return json({error:"Unable to load content."},500)}
}

export async function POST(request:Request){
 try{
  const body=await request.json().catch(()=>({})) as Record<string,any>;
  if(body.action==="logout"){const token=parseCookies(request)[cookieName];if(token)await supabase(`admin_sessions?token_hash=eq.${hashToken(token)}`,{method:"DELETE"});return json({ok:true},200,{"Set-Cookie":cookie("",0)});}
  if(body.action==="login"){
   const username=(body.username||"").trim(),password=body.password||"",adminUser=env("ADMIN_USERNAME"),passwordHash=env("ADMIN_PASSWORD_HASH");
   if(!adminUser||!passwordHash)return json({error:"Admin authentication is not configured."},500);
   if(!(username===adminUser&&await bcrypt.compare(password,passwordHash)))return json({error:"Invalid username or password."},401);
   const token=randomToken(),expires=new Date(Date.now()+sessionHours*3600_000).toISOString();
   const r=await supabase("admin_sessions",{method:"POST",body:JSON.stringify({token_hash:hashToken(token),admin_id:username,expires_at:expires})});
   if(!r.ok){const details=await r.text();console.error("SUPABASE SESSION ERROR",details);return json({error:"Unable to create secure session.",debug:`Supabase ${r.status}: ${details}`},500)}
   return json({ok:true},200,{"Set-Cookie":cookie(token,sessionHours*3600)});
  }
  if(!(await currentAdmin(request)))return json({error:"Unauthorized"},401);
  if(body.action==="create-content"){
   const entity=body.entity as string;
   const allowed=["drivers","fleet","convoys","news"];
   if(!allowed.includes(entity)) return json({error:"Invalid content entity."},400);
   const clean:any = entity==="drivers"
    ? {id:String(body.id||"").trim(),name:String(body.name||"").trim(),rank:String(body.rank||"Driver").trim(),flag:String(body.flag||"🌍").trim(),km:String(body.km||"0 KM").trim()}
    : entity==="fleet"
    ? {id:String(body.id||"").trim(),make:String(body.make||"").trim(),model:String(body.model||"").trim(),image:String(body.image||"").trim()}
    : entity==="convoys"
    ? {id:String(body.id||crypto.randomUUID()).trim(),name:String(body.name||"").trim(),date:String(body.date||"").trim(),time:String(body.time||"").trim(),from:String(body.from||"").trim(),to:String(body.to||"").trim(),server:String(body.server||"Simulation 1").trim(),distance:String(body.distance||"").trim()}
    : {id:String(body.id||crypto.randomUUID()).trim(),category:String(body.category||"VTC News").trim(),date:String(body.date||"").trim(),title:String(body.title||"").trim(),description:String(body.description||"").trim()};
   if(!clean.id || (entity==="drivers"&&!clean.name) || (entity==="fleet"&&(!clean.make||!clean.model)) || (entity==="convoys"&&!clean.name) || (entity==="news"&&!clean.title)) return json({error:"Required fields are missing."},400);
   const r=await supabase(entity,{method:"POST",body:JSON.stringify(clean)});
   if(!r.ok) return json({error:`Unable to create ${entity}.`,debug:await r.text()},500);
   return json({ok:true,item:(await r.json())[0]});
  }
  if(body.action==="reset-demo"){
   const demo:any={
    drivers:[{id:"VIP-001",name:"John Driver",rank:"Senior Driver",flag:"🇬🇧",km:"25,430 KM"},{id:"VIP-014",name:"Alex Roads",rank:"Professional Driver",flag:"🇬🇭",km:"21,810 KM"},{id:"VIP-027",name:"Mike Transit",rank:"Driver",flag:"🇩🇪",km:"18,620 KM"},{id:"VIP-041",name:"Daniel Haul",rank:"Junior Driver",flag:"🇳🇱",km:"12,450 KM"}],
    fleet:[{id:"VIP-001",make:"Scania",model:"S Series",image:"https://images.unsplash.com/photo-1601584115197-04ecc0da31d8?auto=format&fit=crop&w=1000&q=80"},{id:"VIP-002",make:"Volvo",model:"FH",image:"https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1000&q=80"},{id:"VIP-003",make:"Mercedes-Benz",model:"Actros",image:"https://images.unsplash.com/photo-1586191582114-9d9c2d2b2d8f?auto=format&fit=crop&w=1000&q=80"},{id:"VIP-004",make:"DAF",model:"XF",image:"https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?auto=format&fit=crop&w=1000&q=80"}],
    convoys:[{id:"convoy-1",name:"VIP COMMUNITY CONVOY",date:"18 SEP 2026",time:"19:00 UTC",from:"London",to:"Dover",server:"Simulation 1",distance:"250 KM"},{id:"convoy-2",name:"RED ROAD RUN",date:"25 SEP 2026",time:"20:00 UTC",from:"Manchester",to:"Calais",server:"Simulation 2",distance:"340 KM"},{id:"convoy-3",name:"TOGETHER WE CAN",date:"02 OCT 2026",time:"19:30 UTC",from:"Rotterdam",to:"Brussels",server:"Simulation 1",distance:"190 KM"}],
    news:[{id:"news-1",category:"VTC News",date:"12 SEP 2026",title:"Welcome to V.I.P LOGISTICS TRANSPORT",description:"Our doors are open. Meet the team, explore our standards and start your journey with us."},{id:"news-2",category:"Convoys",date:"08 SEP 2026",title:"September Convoy Calendar",description:"Three community events are now scheduled. Bring your best truck and join the formation."},{id:"news-3",category:"Recruitment",date:"01 SEP 2026",title:"Driver Recruitment Open",description:"Applications are open for motivated drivers who want a friendly, rule-focused VTC experience."}]
   };
   for(const table of ["drivers","fleet","convoys","news"]){const d=await supabase(`${table}?id=not.is.null`,{method:"DELETE"});if(!d.ok)return json({error:`Unable to clear ${table}.`,debug:await d.text()},500);const r=await supabase(table,{method:"POST",body:JSON.stringify(demo[table])});if(!r.ok)return json({error:`Unable to restore ${table}.`,debug:await r.text()},500);}
   return json({ok:true});
  }
  if(body.action==="sync-content"){
   const c=body.content as Content;
   if(!c||!Array.isArray(c.drivers)||!Array.isArray(c.fleet)||!Array.isArray(c.convoys)||!Array.isArray(c.news))return json({error:"Invalid content payload."},400);
   for(const table of ["drivers","fleet","convoys","news"]){const d=await supabase(`${table}?id=not.is.null`,{method:"DELETE"});if(!d.ok)return json({error:`Unable to clear ${table}.`},500);}
   const inserts:[string,any[]][]=[
    ["drivers",c.drivers.map(x=>({id:x.id,name:x.name,rank:x.rank,flag:x.flag,km:x.km}))],
    ["fleet",c.fleet.map(x=>({id:x.id,make:x.make,model:x.model,image:x.image}))],
    ["convoys",c.convoys.map(x=>({id:x.id||crypto.randomUUID(),name:x.name,date:x.date,time:x.time,from:x.from,to:x.to,server:x.server,distance:x.distance}))],
    ["news",c.news.map(x=>({id:x.id||crypto.randomUUID(),category:x.category,date:x.date,title:x.title,description:x.description}))]
   ];
   for(const [table,rows] of inserts){if(rows.length){const r=await supabase(table,{method:"POST",body:JSON.stringify(rows)});if(!r.ok)return json({error:`Unable to save ${table}.`,debug:await r.text()},500);}}
   return json({ok:true});
  }
  if(body.action==="gallery-create"){const item={title:(body.title||"").trim(),image_url:(body.image_url||"").trim(),category:(body.category||"VTC").trim(),description:(body.description||"").trim(),sort_order:Number(body.sort_order||0)};if(!item.title||!item.image_url)return json({error:"Title and image URL are required."},400);const r=await supabase("gallery",{method:"POST",body:JSON.stringify(item)});if(!r.ok)return json({error:"Unable to create gallery item.",debug:await r.text()},500);return json({ok:true,item:(await r.json())[0]});}
  return json({error:"Unknown action."},404);
 }catch(e){console.error(e);return json({error:"Invalid request."},400)}
}

export async function PUT(request:Request){
 try{
  if(!(await currentAdmin(request)))return json({error:"Unauthorized"},401);
  const body=await request.json() as Record<string,any>, entity=body.entity,id=body.id;
  if(entity==="gallery"){const patch={title:(body.title||"").trim(),image_url:(body.image_url||"").trim(),category:(body.category||"VTC").trim(),description:(body.description||"").trim(),sort_order:Number(body.sort_order||0)};if(!id||!patch.title||!patch.image_url)return json({error:"Gallery ID, title and image URL are required."},400);const r=await supabase(`gallery?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify(patch)});if(!r.ok)return json({error:"Unable to update gallery item.",debug:await r.text()},500);return json({ok:true,item:(await r.json())[0]});}
  if(!["drivers","fleet","convoys","news"].includes(entity)||!id)return json({error:"Invalid content item."},400);
  const data={...body};delete data.entity;delete data.id;const r=await supabase(`${entity}?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify(data)});if(!r.ok)return json({error:`Unable to update ${entity}.`,debug:await r.text()},500);return json({ok:true,item:(await r.json())[0]});
 }catch(e){console.error(e);return json({error:"Invalid request."},400)}
}

export async function DELETE(request:Request){
 try{if(!(await currentAdmin(request)))return json({error:"Unauthorized"},401);const u=new URL(request.url),entity=u.searchParams.get("entity"),id=u.searchParams.get("id");if(!entity||!id)return json({error:"Entity and ID are required."},400);if(entity!=="gallery"&&!['drivers','fleet','convoys','news'].includes(entity))return json({error:"Invalid entity."},400);const r=await supabase(`${entity}?id=eq.${encodeURIComponent(id)}`,{method:"DELETE"});if(!r.ok)return json({error:`Unable to delete ${entity}.`,debug:await r.text()},500);return json({ok:true});}
 catch(e){console.error(e);return json({error:"Invalid request."},400)}
}
