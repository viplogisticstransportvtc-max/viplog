type Content = {
  drivers: Array<{id:string;name:string;rank:string;flag:string;km:string}>;
  fleet: Array<{id:string;make:string;model:string;image:string}>;
  convoys: Array<{id:string;name:string;date:string;time:string;from:string;to:string;server:string;distance:string}>;
  news: Array<{id:string;category:string;date:string;title:string;description:string}>;
};

function env(name:string){return process.env[name]||"";}
function json(data:Record<string,unknown>,status=200){return Response.json(data,{status,headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=300"}});}
function supabase(path:string){
  const base=env("SUPABASE_URL").replace(/\/+$/,"").trim().replace(/\/rest\/v1$/i,"");
  const key=env("SUPABASE_SERVICE_ROLE_KEY");
  const clean=path.replace(/^\/+/,"");
  return fetch(`${base}/rest/v1/${clean}`,{headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"}});
}
async function readTable(table:string){
  const r=await supabase(`${table}?select=*&order=created_at.desc`);
  if(!r.ok) throw new Error(await r.text());
  return await r.json();
}
async function readContent():Promise<Content>{
  const [drivers,fleet,convoys,news]=await Promise.all([readTable("drivers"),readTable("fleet"),readTable("convoys"),readTable("news")]);
  return {drivers,fleet,convoys,news};
}

export async function GET(){
  try {
    const [content, galleryResponse] = await Promise.all([
      readContent(),
      supabase("gallery?select=id,title,image_url,category,description,sort_order,created_at&order=sort_order.asc,created_at.desc")
    ]);
    if(!galleryResponse.ok) return json({error:"Unable to load gallery."},500);
    return json({content, items:await galleryResponse.json()});
  } catch(e) {
    console.error(e);
    return json({error:"Unable to load public content."},500);
  }
}
