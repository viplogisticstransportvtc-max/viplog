import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight, Award, CalendarDays, CheckCircle2, ChevronDown, Clock3,
  Globe2, Instagram, Mail, MapPin, Menu, MessageCircle, ShieldCheck,
  Truck, Users, X, Youtube, Route
} from "lucide-react";
import "./index.css";

export const VTC_CONFIG = {
  name: "V.I.P LOGISTICS TRANSPORT VTC",
  shortName: "VIP LOGISTICS",
  slogan: "TOGETHER WE CAN",
  logo: "/assets/logo.png",
  favicon: "/assets/logo.png",
  discord: "https://discord.gg/V8EC5SnSUJ",
  truckersmp: "https://truckersmp.com/vtc/91177",
  email: "viplogisticstransportvtc@gmail.com",
  stats: { drivers: "20+", kilometers: "50K+", convoys: "25+", members: "30+" },
  social: {
    discord: "https://discord.gg/V8EC5SnSUJ",
    truckersmp: "https://truckersmp.com/vtc/91177",
    facebook: "https://facebook.com/",
    youtube: "https://youtube.com/",
    tiktok: "https://tiktok.com/"
  }
};

const requirements = [
  "Must be at least 16 years old. Exceptions can be based on maturity.",
  "Must be able to write and understand English on a basic level.",
  "Must be able to attend 5 convoys OR complete 1 convoy + log 10000 KM each month.",
  "Must have a minimum of 24 hours in Euro Truck Simulator 2.",
  "Must always follow the TruckersMP Rules and Terms of Service.",
  "Must follow Discord Rules and Terms of Service.",
  "TruckersMP account must be at least 1 month old.",
  "TruckersMP account must not have more than 5 current active bans.",
  "Must be willing to use the V.I.P LOGISTICS TRANSPORT VTC paint job during official VTC events.",
  "Must be willing to use the V.I.P LOGISTICS TRANSPORT VTC tag in TruckersMP."
];

const defaultFleet = [
  ["Scania", "S Series", "VIP-001", "https://images.unsplash.com/photo-1601584115197-04ecc0da31d8?auto=format&fit=crop&w=1000&q=80"],
  ["Volvo", "FH", "VIP-002", "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1000&q=80"],
  ["Mercedes-Benz", "Actros", "VIP-003", "https://images.unsplash.com/photo-1586191582114-9d9c2d2b2d8f?auto=format&fit=crop&w=1000&q=80"],
  ["DAF", "XF", "VIP-004", "https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?auto=format&fit=crop&w=1000&q=80"]
];

const defaultDrivers = [
  ["VIP-001", "John Driver", "Senior Driver", "🇬🇧", "25,430 KM"],
  ["VIP-014", "Alex Roads", "Professional Driver", "🇬🇭", "21,810 KM"],
  ["VIP-027", "Mike Transit", "Driver", "🇩🇪", "18,620 KM"],
  ["VIP-041", "Daniel Haul", "Junior Driver", "🇳🇱", "12,450 KM"]
];

const defaultConvoys = [
  ["VIP COMMUNITY CONVOY", "18 SEP 2026", "19:00 UTC", "London", "Dover", "Simulation 1", "250 KM"],
  ["RED ROAD RUN", "25 SEP 2026", "20:00 UTC", "Manchester", "Calais", "Simulation 2", "340 KM"],
  ["TOGETHER WE CAN", "02 OCT 2026", "19:30 UTC", "Rotterdam", "Brussels", "Simulation 1", "190 KM"]
];

const gallery = [
  "https://www.image2url.com/r2/default/images/1788908404310-8c976346-c92c-4f23-b2a2-c36f6e1a8420.jpg",
  "https://www.image2url.com/r2/default/images/1788908148951-1d326553-4549-43e8-ab5d-175ed7612ed8.jpg",
  "https://www.image2url.com/r2/default/images/1788908270193-79fc1439-f253-44c5-93b9-8ad408aae7c9.jpg",
  "https://www.image2url.com/r2/default/images/1788908307460-636cd9f4-c520-4635-bb49-dc4f3cdd62f8.jpg",
  "https://www.image2url.com/r2/default/images/1788908345744-2f653300-356e-4586-99b8-68c336a99f7a.jpg",
  "https://www.image2url.com/r2/default/images/1788908378888-d914b834-8f82-4fad-90cd-fb9f12da8022.jpg"
];

const defaultNews = [
  ["VTC News", "12 SEP 2026", "Welcome to V.I.P LOGISTICS TRANSPORT", "Our doors are open. Meet the team, explore our standards and start your journey with us."],
  ["Convoys", "08 SEP 2026", "September Convoy Calendar", "Three community events are now scheduled. Bring your best truck and join the formation."],
  ["Recruitment", "01 SEP 2026", "Driver Recruitment Open", "Applications are open for motivated drivers who want a friendly, rule-focused VTC experience."]
];


type Driver = { id: string; name: string; rank: string; flag: string; km: string };
type FleetItem = { make: string; model: string; id: string; image: string };
type Convoy = { id: string; name: string; date: string; time: string; from: string; to: string; server: string; distance: string };
type NewsItem = { id: string; category: string; date: string; title: string; description: string };
type GalleryItem = { id: string; title: string; image_url: string; category: string; description: string; sort_order: number; created_at?: string };
type Store = { drivers: Driver[]; fleet: FleetItem[]; convoys: Convoy[]; news: NewsItem[] };
type ProgressRow = { driver_id:string; driver_name:string; deliveries:number; distance_km:number; progress:number; goal_met:boolean };
type ProgressResponse = { progress?: { month:string; goal_km:number; rows:ProgressRow[] } };
type DeliveryRecord = { id:string; driver_id:string; driver_name:string; delivery_date:string; origin:string; destination:string; cargo:string; distance_km:number };

function useProgress(){
  const [data,setData]=useState<ProgressResponse['progress']|null>(null);
  const [loading,setLoading]=useState(true);
  const load=async()=>{try{const r=await fetch('/api/progress'); const d=await r.json(); if(r.ok&&d.progress) setData(d.progress);}catch{}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  return {data,loading,refresh:load};
}


const defaultStore: Store = {
  drivers: defaultDrivers.map(([id,name,rank,flag,km]) => ({id,name,rank,flag,km})),
  fleet: defaultFleet.map(([make,model,id,image]) => ({id,make,model,image})),
  convoys: defaultConvoys.map(([name,date,time,from,to,server,distance],i) => ({id:`convoy-${i+1}`,name,date,time,from,to,server,distance})),
  news: defaultNews.map(([category,date,title,description],i) => ({id:`news-${i+1}`,category,date,title,description}))
};
function useVtcStore(admin=false) {
  const [store,setStore] = useState<Store>(defaultStore);
  const refresh = async () => {
    try {
      const r=await fetch(admin ? '/api/admin?action=content' : '/api/content');
      const d=await r.json();
      if(r.ok&&d.content) setStore({drivers:d.content.drivers||[],fleet:d.content.fleet||[],convoys:d.content.convoys||[],news:d.content.news||[]});
    } catch {}
  };
  useEffect(()=>{refresh();},[]);
  return [store,setStore,refresh] as const;
}

function useGallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  useEffect(() => {
    fetch('/api/content')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => setItems([]));
  }, []);
  return items;
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [store] = useVtcStore(false);
  const dbGallery = useGallery();

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#080808]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
          <a href="#home" className="flex items-center gap-3" onClick={closeMenu}>
            <img src={VTC_CONFIG.logo} alt={VTC_CONFIG.name} className="h-12 w-12 rounded-full object-contain" />
            <div className="hidden sm:block">
              <div className="text-sm font-black tracking-wide">V.I.P LOGISTICS</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">Transport VTC</div>
            </div>
          </a>

          <nav className="hidden items-center gap-5 xl:flex">
            {["Home","About Us","Requirements","Fleet","Drivers","Deliveries Progress","Convoys","Gallery","News","Contact"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`} className="nav-link">{item}</a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <a href={VTC_CONFIG.discord} target="_blank" rel="noreferrer" className="icon-btn" aria-label="Discord">
              <MessageCircle size={18} />
            </a>
            <a href="#application" className="red-btn">JOIN THE VTC <ArrowRight size={16}/></a>
          </div>

          <button className="rounded-lg border border-white/10 p-2 lg:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <X/> : <Menu/>}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 bg-[#0d0d0d] px-5 py-4 lg:hidden">
            {["Home","About Us","Requirements","Fleet","Drivers","Deliveries Progress","Convoys","Gallery","News","Contact"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`} onClick={closeMenu} className="block border-b border-white/5 py-3 text-sm font-semibold">{item}</a>
            ))}
            <a href="#application" onClick={closeMenu} className="red-btn mt-4 w-full justify-center">JOIN THE VTC <ArrowRight size={16}/></a>
          </div>
        )}
      </header>

      <main>
        <section id="home" className="hero min-h-[760px]">
          <div className="hero-overlay"/>
          <div className="relative mx-auto flex min-h-[760px] max-w-7xl items-center px-5 pt-24 lg:px-8">
            <div className="max-w-4xl">
              <div className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.28em] text-red-400">
                <span className="h-px w-10 bg-red-500"/> TruckersMP Virtual Trucking Company
              </div>
              <h1 className="text-5xl font-black leading-[.94] tracking-tight sm:text-7xl lg:text-8xl">
                V.I.P LOGISTICS
                <span className="block text-gradient">TRANSPORT</span>
              </h1>
              <p className="mt-6 text-xl font-bold uppercase tracking-[0.18em] text-white/85 sm:text-2xl">{VTC_CONFIG.slogan}</p>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                Professional on the road. United as a team. Join a friendly and professional trucking community built around safe driving, teamwork and great TruckersMP experiences.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#application" className="red-btn">JOIN OUR VTC <ArrowRight size={17}/></a>
                <a href="#about-us" className="outline-btn">EXPLORE OUR VTC</a>
              </div>
              <a href="#deliveries-progress" className="mt-8 block max-w-2xl rounded-2xl border border-red-500/30 bg-black/70 p-5 backdrop-blur-md transition hover:border-red-500/60 hover:bg-black/80">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.28em] text-red-400">Driver Performance</div>
                    <div className="mt-1 text-2xl font-black">DELIVERIES &amp; PROGRESS</div>
                    <div className="mt-1 text-sm text-white/55">Track monthly deliveries and progress toward the <b className="text-white">10,000 KM</b> target.</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black">VIEW PROGRESS <ArrowRight size={16}/></div>
                </div>
              </a>
            </div>
          </div>
          <a href="#about-us" className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/50"><ChevronDown/></a>
        </section>

        <section id="about-us" className="section">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:px-8">
            <div className="relative">
              <div className="section-kicker">Who we are</div>
              <h2 className="section-title">BUILT FOR THE ROAD.<br/><span>UNITED BY TEAMWORK.</span></h2>
              <p className="body-copy">
                V.I.P LOGISTICS TRANSPORT VTC is a dynamic virtual trucking company where each trucker prioritizes road safety and adherence to traffic laws, all while enjoying a fun, friendly atmosphere.
              </p>
              <p className="body-copy">
                Whether cruising in single-player mode with a variety of mods or trucking in TruckersMP while following TMP rules, we aim to maintain the perfect balance between professionalism and enjoyment on the road.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  [ShieldCheck, "Professionalism", "Safe, responsible and professional driving."],
                  [Users, "Community", "A friendly place for drivers from different backgrounds."],
                  [Award, "Teamwork", "Together we can achieve more."],
                  [Truck, "Fun", "Enjoy trucking while respecting the rules."]
                ].map(([Icon, title, text]) => (
                  <div className="feature-card" key={title as string}>
                    {React.createElement(Icon as React.ElementType, {size: 22})}
                    <div><h3>{title as string}</h3><p>{text as string}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="about-image">
              <div className="image-frame">
                <img src="https://www.image2url.com/r2/default/images/1788908939904-16672be9-97a2-4945-ad0f-94afbae53cae.jpg" alt="European truck on the road"/>
                <div className="absolute bottom-5 left-5 rounded-xl border border-white/15 bg-black/65 px-5 py-4 backdrop-blur">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/45">Our promise</div>
                  <div className="mt-1 text-lg font-black">Professional on the road.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#101010]">
          <div className="mx-auto grid max-w-7xl grid-cols-2 px-5 py-10 sm:grid-cols-4 lg:px-8">
            {[
              [VTC_CONFIG.stats.drivers, "Drivers"],
              [VTC_CONFIG.stats.kilometers, "Kilometres Driven"],
              [VTC_CONFIG.stats.convoys, "Convoys"],
              [VTC_CONFIG.stats.members, "Community Members"]
            ].map(([value,label]) => (
              <div className="stat" key={label}><strong>{value}</strong><span>{label}</span></div>
            ))}
          </div>
        </section>

        <section id="requirements" className="section bg-[#0d0d0d]">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-3xl"><div className="section-kicker">Recruitment</div><h2 className="section-title">READY TO JOIN <span>THE TEAM?</span></h2><p className="body-copy">We are looking for mature, respectful and active drivers who want to enjoy TruckersMP as part of a team.</p></div>
            <div className="mt-10 grid gap-3 md:grid-cols-2">
              {requirements.map((r, i) => <div className="requirement" key={i}><CheckCircle2 size={20}/><span>{r}</span></div>)}
            </div>
            <a href="#application" className="red-btn mt-8">APPLY NOW <ArrowRight size={17}/></a>
          </div>
        </section>

        <section id="application" className="section">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[.75fr_1.25fr] lg:px-8">
            <div><div className="section-kicker">Become a driver</div><h2 className="section-title">START YOUR <span>JOURNEY.</span></h2><p className="body-copy">Complete the application and our management team can review your details.</p><div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6"><p className="text-sm leading-6 text-white/65"></p></div></div>
            <ApplicationForm/>
          </div>
        </section>

        <section id="fleet" className="section bg-[#0d0d0d]">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="section-kicker">Our trucks</div><h2 className="section-title">THE <span>FLEET.</span></h2></div><span className="text-sm text-white/40">Fleet data is managed from the admin panel.</span></div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {store.fleet.map(({make,model,id,image}) => <div className="fleet-card" key={id}><div className="overflow-hidden"><img src={image} alt={`${make} ${model}`} /></div><div className="p-5"><div className="text-xs uppercase tracking-[.22em] text-red-400">{id}</div><h3 className="mt-2 text-xl font-black">{make}</h3><p className="text-white/50">{model}</p></div></div>)}
            </div>
          </div>
        </section>

        <DriverProgressSection />

        <section id="drivers" className="section">
          <div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="section-kicker">The people</div><h2 className="section-title">MEET OUR <span>DRIVERS.</span></h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {store.drivers.map(({id,name,rank,flag,km}) => <div className="driver-card" key={id}><div className="avatar">{name.split(" ").map(x=>x[0]).join("")}</div><div className="mt-5 flex items-center justify-between"><span className="text-xs font-bold text-red-400">{id}</span><span>{flag}</span></div><h3 className="mt-2 text-xl font-black">{name}</h3><p className="text-sm text-white/45">{rank}</p><div className="mt-5 border-t border-white/10 pt-4 text-sm font-bold">{km}</div></div>)}
            </div>
          </div>
        </section>

        <section className="section bg-[#0d0d0d]">
          <div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="section-kicker">Progression</div><h2 className="section-title">DRIVER <span>RANKS.</span></h2>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {["Recruit","Junior Driver","Driver","Senior Driver","Professional Driver","Convoy Leader","Management"].map((rank,i)=><div className="rank-card" key={rank}><span>0{i+1}</span><h3>{rank}</h3></div>)}
            </div>
          </div>
        </section>

        <section id="convoys" className="section">
          <div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="section-kicker">Events</div><h2 className="section-title">UPCOMING <span>CONVOYS.</span></h2>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {store.convoys.map(({name,date,time,from,to,server,distance})=><div className="convoy-card" key={name}><div className="flex items-center justify-between"><span className="badge">UPCOMING</span><CalendarDays size={19}/></div><h3>{name}</h3><div className="mt-5 space-y-3 text-sm text-white/60"><p><CalendarDays size={16}/> {date}</p><p><Clock3 size={16}/> {time}</p><p><MapPin size={16}/> {from} → {to}</p><p><Globe2 size={16}/> TruckersMP {server}</p></div><div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5"><b>{distance}</b><a href={VTC_CONFIG.discord} target="_blank" rel="noreferrer" className="text-sm font-bold text-red-400">JOIN CONVOY →</a></div></div>)}
            </div>
          </div>
        </section>

        <section className="split-section">
          <div className="split-image"></div>
          <div className="split-copy"><div className="section-kicker">TruckersMP</div><h2 className="section-title">TRUCKING ON <span>TRUCKERSMP.</span></h2><p className="body-copy">We regularly take to the roads of TruckersMP, attending official convoys and enjoying the experience of virtual trucking together.</p><div className="mt-8 grid gap-4">{[["TruckersMP Rules","We respect and follow TruckersMP rules."],["Official Convoys","Join us during our official VTC events."],["Professional Driving","Safety and responsible driving come first."]].map(([a,b])=><div className="mini-feature" key={a}><ShieldCheck size={21}/><div><b>{a}</b><p>{b}</p></div></div>)}</div><a href={VTC_CONFIG.truckersmp} target="_blank" rel="noreferrer" className="red-btn mt-8">VIEW OUR TRUCKERSMP PROFILE <ArrowRight size={16}/></a></div>
        </section>

        <section id="gallery" className="section">
          <div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="section-kicker">Our moments</div><h2 className="section-title">VTC <span>GALLERY.</span></h2>
            <div className="gallery mt-10">{(dbGallery.length ? dbGallery : gallery.map((src,i)=>({id:`demo-${i}`,title:`VTC Gallery ${i+1}`,image_url:src,category:"VTC",description:"",sort_order:i}))).map((item,i)=><button key={item.id} onClick={()=>setLightbox(item.image_url)} className={`gallery-item g${(i%6)+1}`}><img src={item.image_url} alt={item.title}/></button>)}</div>
          </div>
        </section>

        <section className="discord-cta">
          <div className="relative mx-auto max-w-5xl px-5 py-24 text-center"><MessageCircle className="mx-auto mb-5 text-red-500" size={42}/><div className="section-kicker justify-center">Community</div><h2 className="text-4xl font-black sm:text-6xl">JOIN OUR <span className="text-gradient">COMMUNITY.</span></h2><p className="mx-auto mt-5 max-w-2xl text-white/60">Our Discord is where drivers communicate, organize convoys, share screenshots and enjoy the VTC experience together.</p><a href={VTC_CONFIG.discord} target="_blank" rel="noreferrer" className="red-btn mx-auto mt-8">JOIN DISCORD <ArrowRight size={16}/></a></div>
        </section>

        <section id="news" className="section bg-[#0d0d0d]">
          <div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="section-kicker">Latest updates</div><h2 className="section-title">NEWS & <span>ANNOUNCEMENTS.</span></h2>
            <div className="mt-10 grid gap-6 lg:grid-cols-3">{store.news.map(({category:cat,date,title,description:desc})=><article className="news-card" key={title}><div className="flex justify-between text-xs font-bold uppercase tracking-wider"><span className="text-red-400">{cat}</span><span className="text-white/35">{date}</span></div><h3>{title}</h3><p>{desc}</p><button>READ MORE <ArrowRight size={15}/></button></article>)}</div>
          </div>
        </section>

        <section id="contact" className="section">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:px-8"><div><div className="section-kicker">Contact</div><h2 className="section-title">GET IN <span>TOUCH.</span></h2><p className="body-copy">Have a question about recruitment, convoys or the VTC? Send us a message or join our community.</p><div className="mt-8 space-y-4"><a href={VTC_CONFIG.discord} className="contact-link"><MessageCircle/> Discord <span>→</span></a><a href={VTC_CONFIG.truckersmp} className="contact-link"><Truck/> TruckersMP <span>→</span></a><a href={`mailto:${VTC_CONFIG.email}`} className="contact-link"><Mail/> {VTC_CONFIG.email} <span>→</span></a></div></div><ContactForm/></div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#050505]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2"><img src={VTC_CONFIG.logo} alt={VTC_CONFIG.name} className="h-20 w-20 rounded-full object-contain"/><h3 className="mt-4 text-xl font-black">{VTC_CONFIG.name}</h3><p className="mt-2 text-sm font-bold uppercase tracking-[.22em] text-red-400">{VTC_CONFIG.slogan}</p><p className="mt-4 max-w-md text-sm leading-6 text-white/40">Professional on the road. United as a team.</p></div>
          <div><h4 className="footer-head">VTC</h4>{["About Us","Requirements","Drivers","Fleet"].map(x=><a className="footer-link" href={`#${x.toLowerCase().replace(/ /g, "-")}`} key={x}>{x}</a>)}</div>
          <div><h4 className="footer-head">COMMUNITY</h4>{["Discord","Convoys","Gallery","News"].map(x=><a className="footer-link" href={x==="Discord"?VTC_CONFIG.discord:`#${x.toLowerCase()}`} key={x}>{x}</a>)}</div>
        </div>
        <div className="border-t border-white/5 px-5 py-6 text-center text-xs text-white/30">© AgendaSoft 2026 V.I.P LOGISTICS TRANSPORT VTC. All Rights Reserved. · This is a virtual trucking company and is not affiliated with TruckersMP unless explicitly stated.</div>
      </footer>

      {lightbox && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-5" onClick={()=>setLightbox(null)}><button className="absolute right-6 top-6 rounded-full bg-white/10 p-3"><X/></button><img src={lightbox} alt="Gallery enlarged" className="max-h-[88vh] max-w-[95vw] rounded-2xl object-contain"/></div>}
    </div>
  );
}

function ApplicationForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      truckersMPUsername: form.get("truckersMPUsername"),
      truckersMPProfile: form.get("truckersMPProfile"),
      discordUsername: form.get("discordUsername"),
      age: form.get("age"),
      country: form.get("country"),
      ets2Hours: form.get("ets2Hours"),
      accountAge: form.get("accountAge"),
      previousVtc: form.get("previousVtc"),
      whyJoin: form.get("whyJoin"),
      foundUs: form.get("foundUs"),
      website: form.get("website")
    };

    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      // Read the response as text first so an empty/non-JSON response does not
      // crash with: "Unexpected end of JSON input".
      const raw = await response.text();
      let result: { error?: string; ok?: boolean } = {};
      if (raw.trim()) {
        try {
          result = JSON.parse(raw);
        } catch {
          throw new Error(
            response.ok
              ? "The application server returned an invalid response. Please try again."
              : `Application server error (${response.status}). Please try again.`
          );
        }
      }
      if (!response.ok) throw new Error(result.error || `Application failed (${response.status}).`);
      if (result.ok === false) throw new Error(result.error || "Application failed.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit application.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) return <div className="form-card flex min-h-[480px] flex-col items-center justify-center text-center"><CheckCircle2 size={54} className="text-red-500"/><h3 className="mt-5 text-2xl font-black">APPLICATION SENT</h3><p className="mt-2 max-w-md text-white/50">Thank you. Your application has been sent to the V.I.P LOGISTICS TRANSPORT recruitment team.</p></div>;

  return <form className="form-card grid gap-4 sm:grid-cols-2" onSubmit={submit}>
    {[
      ["TruckersMP Username", "truckersMPUsername"], ["TruckersMP Profile URL", "truckersMPProfile"],
      ["Discord Username", "discordUsername"], ["Age", "age"], ["Country", "country"],
      ["ETS2 Hours", "ets2Hours"], ["TruckersMP Account Age", "accountAge"], ["Previous VTC", "previousVtc"]
    ].map(([label, name]) => <label className="field" key={name}><span>{label}</span><input name={name} required placeholder={label}/></label>)}
    <label className="field sm:col-span-2"><span>Why do you want to join?</span><textarea name="whyJoin" required rows={4} placeholder="Tell us about yourself..."/></label>
    <label className="field sm:col-span-2"><span>How did you find us?</span><input name="foundUs" placeholder="Discord, TruckersMP, friend, etc."/></label>
    <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
    <label className="sm:col-span-2 flex items-start gap-3 text-sm text-white/60"><input required type="checkbox" className="mt-1 accent-red-600"/><span>I confirm that I have read and agree to the V.I.P LOGISTICS TRANSPORT VTC requirements.</span></label>
    {error && <div className="sm:col-span-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
    <button disabled={loading} className="red-btn disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2 sm:w-fit">{loading ? "SENDING..." : "SUBMIT APPLICATION"} <ArrowRight size={16}/></button>
  </form>;
}

function ContactForm() {
  const [sent, setSent] = useState(false);
  if (sent) return <div className="form-card flex min-h-[350px] items-center justify-center text-center"><div><CheckCircle2 size={48} className="mx-auto text-red-500"/><h3 className="mt-4 text-2xl font-black">MESSAGE READY</h3><p className="mt-2 text-white/50"></p></div></div>;
  return <form className="form-card grid gap-4 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();setSent(true)}}><label className="field"><span>Name</span><input required/></label><label className="field"><span>Email</span><input required type="email"/></label><label className="field sm:col-span-2"><span>Discord Username</span><input/></label><label className="field sm:col-span-2"><span>Message</span><textarea required rows={5}/></label><button className="red-btn sm:w-fit">SEND MESSAGE <ArrowRight size={16}/></button></form>;
}



function DriverProgressSection(){
  const {data,loading}=useProgress();
  const goal=data?.goal_km||10000; const rows=data?.rows||[];
  const totalKm=rows.reduce((a,r)=>a+r.distance_km,0); const totalDeliveries=rows.reduce((a,r)=>a+r.deliveries,0); const met=rows.filter(r=>r.goal_met).length;
  return <section id="deliveries-progress" className="section bg-[#0d0d0d] border-y border-red-500/10">
    <div className="mx-auto max-w-7xl px-5 lg:px-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="section-kicker">Monthly Driver Tracking</div><h2 className="section-title">DELIVERIES <span>& PROGRESS.</span></h2><p className="mt-4 max-w-2xl text-white/55">Track every driver's deliveries and kilometres toward the <b className="text-white">10,000 KM monthly target</b>. Progress resets automatically at the start of each month.</p></div><a href="#drivers" className="red-btn w-fit">VIEW DRIVERS <ArrowRight size={16}/></a></div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-[#111] p-6"><div className="text-3xl font-black text-red-500">{loading?'—':totalDeliveries}</div><div className="mt-2 text-sm text-white/45">DELIVERIES THIS MONTH</div></div><div className="rounded-2xl border border-white/10 bg-[#111] p-6"><div className="text-3xl font-black text-red-500">{loading?'—':totalKm.toLocaleString()} KM</div><div className="mt-2 text-sm text-white/45">TOTAL DISTANCE</div></div><div className="rounded-2xl border border-white/10 bg-[#111] p-6"><div className="text-3xl font-black text-red-500">{loading?'—':met}</div><div className="mt-2 text-sm text-white/45">DRIVERS AT 10,000 KM</div></div></div>
      <div className="mt-8 rounded-2xl border border-white/10 bg-[#101010] p-5 lg:p-7"><div className="flex items-center justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-[.22em] text-red-400">{data?.month||'CURRENT MONTH'}</div><h3 className="mt-1 text-2xl font-black">DRIVER DELIVERY LEADERBOARD</h3></div><div className="text-right text-xs text-white/40">GOAL <b className="text-white">{goal.toLocaleString()} KM</b></div></div>
      {loading?<div className="py-12 text-center text-white/40">Loading delivery progress...</div>:rows.length===0?<div className="mt-6 rounded-xl border border-dashed border-white/10 p-10 text-center"><Route className="mx-auto text-red-500" size={36}/><h4 className="mt-4 text-lg font-black">NO DELIVERIES LOGGED YET</h4><p className="mt-2 text-sm text-white/40">Management can add delivery records from the admin panel under DELIVERIES & PROGRESS.</p></div>:<div className="mt-6 space-y-4">{rows.map((r,i)=><div key={r.driver_id} className="rounded-xl border border-white/5 bg-white/[.02] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-sm font-black text-red-400">{String(i+1).padStart(2,'0')}</div><div><b>{r.driver_name}</b><div className="text-xs text-white/40">{r.deliveries} deliveries · {r.distance_km.toLocaleString()} KM</div></div></div><div className="text-sm font-black">{r.progress}% {r.goal_met?'✓':''}</div></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-red-500 transition-all" style={{width:`${r.progress}%`}}/></div><div className="mt-2 flex justify-between text-[11px] uppercase tracking-wider text-white/30"><span>0 KM</span><span>{Math.min(r.distance_km,goal).toLocaleString()} / {goal.toLocaleString()} KM</span></div></div>)}</div>}
      </div>
    </div>
  </section>;
}

function ProgressManagement({drivers}:{drivers:Driver[]}){
  const [records,setRecords]=useState<DeliveryRecord[]>([]); const [goal,setGoal]=useState(10000); const [loading,setLoading]=useState(true); const [message,setMessage]=useState('');
  const [form,setForm]=useState({driver_id:drivers[0]?.id||'',delivery_date:new Date().toISOString().slice(0,10),origin:'',destination:'',cargo:'',distance_km:''});
  const load=async()=>{setLoading(true);try{const r=await fetch('/api/progress?admin=1');const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load deliveries');setRecords(d.deliveries||[]);setGoal(d.goal_km||10000);if(!form.driver_id&&drivers[0])setForm(f=>({...f,driver_id:drivers[0].id}));}catch(e){setMessage(e instanceof Error?e.message:'Unable to load deliveries.')}finally{setLoading(false);}};
  useEffect(()=>{load();},[drivers.length]);
  const save=async()=>{setMessage('');try{const r=await fetch('/api/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,distance_km:Number(form.distance_km)})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to save delivery');setForm(f=>({...f,origin:'',destination:'',cargo:'',distance_km:''}));await load();}catch(e){setMessage(e instanceof Error?e.message:'Unable to save delivery.')}};
  const remove=async(id:string)=>{if(!confirm('Delete this delivery record?'))return;try{const r=await fetch(`/api/progress?id=${encodeURIComponent(id)}`,{method:'DELETE'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to delete');await load();}catch(e){setMessage(e instanceof Error?e.message:'Unable to delete delivery.')}};
  return <div className="space-y-6"><div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="text-xs font-bold uppercase tracking-[.22em] text-red-400">Monthly target</div><h2 className="mt-1 text-3xl font-black">DELIVERIES & PROGRESS</h2><p className="mt-2 text-sm text-white/45">Add each completed delivery here. The public website automatically calculates each driver's monthly progress.</p></div><div className="text-3xl font-black text-red-500">{goal.toLocaleString()} KM</div></div></div>
  <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]"><Panel title="ADD DELIVERY"><div className="grid gap-3"><label className="field"><span>Driver</span><select value={form.driver_id} onChange={e=>setForm({...form,driver_id:e.target.value})}>{drivers.map(d=><option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}</select></label><label className="field"><span>Delivery Date</span><input type="date" value={form.delivery_date} onChange={e=>setForm({...form,delivery_date:e.target.value})}/></label><label className="field"><span>Origin</span><input value={form.origin} onChange={e=>setForm({...form,origin:e.target.value})} placeholder="London"/></label><label className="field"><span>Destination</span><input value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})} placeholder="Berlin"/></label><label className="field"><span>Cargo</span><input value={form.cargo} onChange={e=>setForm({...form,cargo:e.target.value})} placeholder="General Cargo"/></label><label className="field"><span>Distance (KM)</span><input type="number" min="1" value={form.distance_km} onChange={e=>setForm({...form,distance_km:e.target.value})} placeholder="500"/></label>{message&&<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{message}</div>}<button onClick={save} disabled={!drivers.length} className="red-btn justify-center">ADD DELIVERY <ArrowRight size={16}/></button></div></Panel>
  <Panel title={`THIS MONTH'S DELIVERY RECORDS (${records.length})`}>{loading?<div className="py-8 text-center text-white/40">Loading...</div>:records.length===0?<div className="py-8 text-center text-white/40">No delivery records yet.</div>:<div className="space-y-2">{records.map(r=><div key={r.id} className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[.02] p-4 sm:flex-row sm:items-center sm:justify-between"><div><b>{r.driver_name}</b><div className="mt-1 text-xs text-white/40">{r.delivery_date} · {r.origin||'—'} → {r.destination||'—'} · {r.cargo||'—'} · <span className="text-white">{Number(r.distance_km).toLocaleString()} KM</span></div></div><RowButton onClick={()=>remove(r.id)}>DELETE</RowButton></div>)}</div>}</Panel></div></div>;
}

function AdminApp() {
  const [store, , refreshStore] = useVtcStore(true);
  const [tab, setTab] = useState<"dashboard"|"drivers"|"fleet"|"convoys"|"news"|"gallery"|"progress">("dashboard");
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  // Do not automatically sign the user into management from an existing browser session.
  // The admin page always starts at the login screen; successful login unlocks the dashboard
  // for the current page session. The public website never checks admin authentication.
  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage("");
    try {
      const r = await fetch('/api/admin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'login',username,password}) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.debug || data.error || 'Login failed.');
      setLoggedIn(true); setPassword("");
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Login failed.'); }
  };
  const logout = async () => { await fetch('/api/admin', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>{}); setLoggedIn(false); };
  const reset = async () => { if (!confirm("Reset all drivers, fleet, convoys and news to the original demo data?")) return; const r=await fetch("/api/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reset-demo"})}); if(!r.ok){const d=await r.json().catch(()=>({})); setMessage(d.error||"Unable to reset demo data."); return;} await refreshStore(); };

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const loadGallery = async () => { const r=await fetch('/api/admin?action=gallery'); if(r.ok){ const d=await r.json(); setGalleryItems(d.items || []); } };
  useEffect(() => { if(loggedIn) loadGallery().catch(()=>{}); }, [loggedIn]);

  if (!loggedIn) return <div className="min-h-screen bg-[#080808] px-5 py-16 text-white"><div className="mx-auto max-w-md"><a href="/" className="text-sm text-red-400">← Back to website</a><div className="form-card mt-6"><img src={VTC_CONFIG.logo} className="mx-auto h-24 w-24 rounded-full"/><h1 className="mt-6 text-center text-3xl font-black">VTC MANAGEMENT</h1><p className="mt-2 text-center text-sm text-white/45">V.I.P LOGISTICS TRANSPORT VTC</p><form onSubmit={login} className="mt-8 grid gap-4"><label className="field"><span>Admin Username</span><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" autoComplete="username"/></label><label className="field"><span>Admin Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password"/></label>{message && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{message}</div>}<button className="red-btn w-full justify-center">LOGIN <ArrowRight size={16}/></button></form><p className="mt-5 text-center text-xs text-white/30">Secure server-side authentication. All management content is stored in Supabase.</p></div></div></div>;
  const stats = [
    [store.drivers.length, "Drivers"], [store.fleet.length, "Fleet Vehicles"], [store.convoys.length, "Convoys"], [store.news.length, "News Posts"], [galleryItems.length, "Gallery Images"]
  ];
  return <div className="min-h-screen bg-[#080808] text-white">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-[#0b0b0b] p-5 lg:block"><img src={VTC_CONFIG.logo} className="h-16 w-16 rounded-full"/><div className="mt-4 text-lg font-black">VIP MANAGEMENT</div><div className="text-xs uppercase tracking-widest text-white/35">Control Center</div><nav className="mt-8 space-y-2">{[["dashboard","Dashboard"],["drivers","Drivers"],["fleet","Fleet"],["convoys","Convoys"],["news","News"],["gallery","Gallery"],["progress","DELIVERIES & PROGRESS"]].map(([key,label])=><button key={key} onClick={()=>setTab(key as typeof tab)} className={`w-full rounded-xl px-4 py-3 text-left text-sm font-bold ${tab===key?"bg-red-600 text-white":"text-white/55 hover:bg-white/5 hover:text-white"}`}>{label}</button>)}</nav><div className="absolute bottom-5 left-5 right-5 space-y-2"><a href="/" className="block rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-bold">View Website</a><button onClick={logout} className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-white/50">Logout</button></div></aside>
    <main className="lg:ml-64"><header className="sticky top-0 z-20 border-b border-white/10 bg-[#080808]/85 px-5 py-4 backdrop-blur-xl lg:px-8"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[.25em] text-red-400">VTC Management</div><h1 className="mt-1 text-2xl font-black">{tab[0].toUpperCase()+tab.slice(1)}</h1></div><button onClick={reset} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/50 hover:text-white">RESET DEMO DATA</button></div><div className="mt-4 flex gap-2 overflow-x-auto lg:hidden">{[["dashboard","Dashboard"],["drivers","Drivers"],["fleet","Fleet"],["convoys","Convoys"],["news","News"],["gallery","Gallery"],["progress","DELIVERIES & PROGRESS"]].map(([key,label])=><button key={key} onClick={()=>setTab(key as typeof tab)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${tab===key?"bg-red-600":"bg-white/5 text-white/55"}`}>{label}</button>)}</div></header>
    <div className="p-5 lg:p-8">
      {tab==="dashboard" && <Dashboard stats={stats} setTab={setTab} />}
      {tab==="drivers" && <CrudDrivers store={store} refresh={refreshStore} />}
      {tab==="fleet" && <CrudFleet store={store} refresh={refreshStore} />}
      {tab==="convoys" && <CrudConvoys store={store} refresh={refreshStore} />}
      {tab==="news" && <CrudNews store={store} refresh={refreshStore} />}
      {tab==="gallery" && <CrudGallery items={galleryItems} reload={loadGallery} />}
      {tab==="progress" && <ProgressManagement drivers={store.drivers} />}
    </div></main>
  </div>;
}

function Dashboard({stats,setTab}:{stats:(string|number)[][];setTab:(x:"dashboard"|"drivers"|"fleet"|"convoys"|"news"|"gallery"|"progress")=>void}) {
  return <div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([n,l])=><div className="rounded-2xl border border-white/10 bg-[#111] p-6" key={String(l)}><div className="text-4xl font-black text-red-500">{n}</div><div className="mt-2 text-sm text-white/45">{l}</div></div>)}</div><div className="mt-8 grid gap-5 md:grid-cols-2"><AdminQuick title="Manage Drivers" text="Add, edit and remove VTC drivers." onClick={()=>setTab("drivers")}/><AdminQuick title="Manage Fleet" text="Track trucks and vehicle assignments." onClick={()=>setTab("fleet")}/><AdminQuick title="Manage Convoys" text="Keep upcoming event information current." onClick={()=>setTab("convoys")}/><AdminQuick title="Manage News" text="Publish announcements and recruitment updates." onClick={()=>setTab("news")}/><AdminQuick title="Manage Gallery" text="Add, edit and remove VTC photos stored in the database." onClick={()=>setTab("gallery")}/><AdminQuick title="DELIVERIES & PROGRESS" text="Log deliveries, kilometres and track the 10,000 KM monthly target for every driver." onClick={()=>setTab("progress")}/></div></div>;
}
function AdminQuick({title,text,onClick}:{title:string;text:string;onClick:()=>void}) { return <button onClick={onClick} className="rounded-2xl border border-white/10 bg-[#101010] p-6 text-left hover:border-red-500/30"><div className="text-xl font-black">{title}</div><p className="mt-2 text-sm text-white/45">{text}</p><div className="mt-5 text-sm font-bold text-red-400">OPEN →</div></button>; }
function Panel({title,children}:{title:string;children:React.ReactNode}) { return <div className="rounded-2xl border border-white/10 bg-[#101010] p-5 lg:p-6"><h2 className="text-xl font-black">{title}</h2>{children}</div>; }
function RowButton({children,onClick}:{children:React.ReactNode;onClick:()=>void}) { return <button onClick={onClick} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold hover:border-red-500/30 hover:text-red-400">{children}</button>; }

async function adminRequest(body:any, method="POST", query="") {
  const r=await fetch(`/api/admin${query}`,{method,headers:{"Content-Type":"application/json"},body:method==="DELETE"?undefined:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||d.debug||"Request failed.");
  return d;
}
function CrudDrivers({store,refresh}:{store:Store;refresh:()=>Promise<void>}) {
  const blank:Driver={id:"",name:"",rank:"Driver",flag:"🌍",km:"0 KM"}; const [form,setForm]=useState(blank); const [editing,setEditing]=useState<string|null>(null); const [message,setMessage]=useState("");
  const save=async()=>{setMessage("");if(!form.id||!form.name){setMessage("Driver ID and name are required.");return;}try{if(editing) await adminRequest({entity:"drivers",id:editing,...form},"PUT");else await adminRequest({action:"create-content",entity:"drivers",...form});setForm(blank);setEditing(null);await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to save driver.");}};
  const remove=async(id:string)=>{if(!confirm("Delete this driver?"))return;try{await adminRequest({},"DELETE",`?entity=drivers&id=${encodeURIComponent(id)}`);await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to delete driver.");}};
  return <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]"><Panel title={editing?"Edit Driver":"Add Driver"}><div className="grid gap-3">{([['id','Driver ID'],['name','Name'],['rank','Rank'],['flag','Country Flag'],['km','Kilometres']] as const).map(([k,l])=><label className="field" key={k}><span>{l}</span><input value={form[k]} disabled={!!editing&&k==='id'} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}{message&&<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{message}</div>}<button onClick={save} className="red-btn mt-2 justify-center">{editing?"SAVE CHANGES":"ADD DRIVER"}</button>{editing&&<button onClick={()=>{setEditing(null);setForm(blank)}} className="text-sm text-white/40">Cancel</button>}</div></Panel><Panel title={`Drivers (${store.drivers.length})`}><div className="space-y-2">{store.drivers.map(d=><div key={d.id} className="flex flex-col justify-between gap-3 rounded-xl border border-white/5 bg-white/[.02] p-4 sm:flex-row sm:items-center"><div><b>{d.name}</b><div className="text-xs text-white/40">{d.id} · {d.rank} · {d.flag} · {d.km}</div></div><div className="flex gap-2"><RowButton onClick={()=>{setEditing(d.id);setForm(d)}}>EDIT</RowButton><RowButton onClick={()=>remove(d.id)}>DELETE</RowButton></div></div>)}</div></Panel></div>;
}
function CrudFleet({store,refresh}:{store:Store;refresh:()=>Promise<void>}) {
  const blank:FleetItem={make:"",model:"",id:"",image:""}; const [form,setForm]=useState(blank); const [editing,setEditing]=useState<string|null>(null); const [message,setMessage]=useState("");
  const save=async()=>{setMessage("");if(!form.id||!form.make||!form.model){setMessage("Fleet ID, brand and model are required.");return;}try{if(editing) await adminRequest({entity:"fleet",id:editing,...form},"PUT");else await adminRequest({action:"create-content",entity:"fleet",...form});setForm(blank);setEditing(null);await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to save truck.");}};
  const remove=async(id:string)=>{if(!confirm("Delete this truck?"))return;try{await adminRequest({},"DELETE",`?entity=fleet&id=${encodeURIComponent(id)}`);await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to delete truck.");}};
  return <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]"><Panel title={editing?"Edit Truck":"Add Truck"}><div className="grid gap-3">{([['id','Fleet ID'],['make','Brand'],['model','Model'],['image','Image URL']] as const).map(([k,l])=><label className="field" key={k}><span>{l}</span><input value={form[k]} disabled={!!editing&&k==='id'} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}{message&&<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{message}</div>}<button onClick={save} className="red-btn justify-center">{editing?"SAVE CHANGES":"ADD TRUCK"}</button>{editing&&<button onClick={()=>{setEditing(null);setForm(blank)}} className="text-sm text-white/40">Cancel</button>}</div></Panel><Panel title={`Fleet (${store.fleet.length})`}><div className="space-y-2">{store.fleet.map(x=><div key={x.id} className="flex gap-3 rounded-xl border border-white/5 p-3"><img src={x.image} className="h-16 w-24 rounded-lg object-cover"/><div className="min-w-0 flex-1"><b>{x.make} {x.model}</b><div className="text-xs text-white/40">{x.id}</div></div><div className="flex gap-2"><RowButton onClick={()=>{setEditing(x.id);setForm(x)}}>EDIT</RowButton><RowButton onClick={()=>remove(x.id)}>DELETE</RowButton></div></div>)}</div></Panel></div>;
}
function CrudConvoys({store,refresh}:{store:Store;refresh:()=>Promise<void>}) {
  const blank:Convoy={id:"",name:"",date:"",time:"",from:"",to:"",server:"Simulation 1",distance:""}; const [form,setForm]=useState(blank); const [editing,setEditing]=useState<string|null>(null); const [message,setMessage]=useState("");
  const save=async()=>{setMessage("");if(!form.name){setMessage("Event name is required.");return;}try{if(editing) await adminRequest({entity:"convoys",id:editing,...form},"PUT");else await adminRequest({action:"create-content",entity:"convoys",...form});setForm(blank);setEditing(null);await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to save convoy.");}};
  const remove=async(id:string)=>{if(!confirm("Delete this convoy?"))return;try{await adminRequest({},"DELETE",`?entity=convoys&id=${encodeURIComponent(id)}`);await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to delete convoy.");}};
  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><Panel title={editing?"Edit Convoy":"Add Convoy"}><div className="grid gap-3">{([['name','Event Name'],['date','Date'],['time','Time'],['from','Departure'],['to','Destination'],['server','Server'],['distance','Distance']] as const).map(([k,l])=><label className="field" key={k}><span>{l}</span><input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}{message&&<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{message}</div>}<button onClick={save} className="red-btn justify-center">{editing?"SAVE CHANGES":"ADD CONVOY"}</button>{editing&&<button onClick={()=>{setEditing(null);setForm(blank)}} className="text-sm text-white/40">Cancel</button>}</div></Panel><Panel title={`Convoys (${store.convoys.length})`}><div className="space-y-2">{store.convoys.map(x=><div key={x.id} className="rounded-xl border border-white/5 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><b>{x.name}</b><div className="mt-1 text-xs text-white/40">{x.date} · {x.time} · {x.from} → {x.to} · {x.server} · {x.distance}</div></div><div className="flex gap-2"><RowButton onClick={()=>{setEditing(x.id);setForm(x)}}>EDIT</RowButton><RowButton onClick={()=>remove(x.id)}>DELETE</RowButton></div></div></div>)}</div></Panel></div>;
}
function CrudNews({store,refresh}:{store:Store;refresh:()=>Promise<void>}) {
  const blank:NewsItem={id:"",category:"VTC News",date:"",title:"",description:""}; const [form,setForm]=useState(blank); const [editing,setEditing]=useState<string|null>(null); const [message,setMessage]=useState("");
  const save=async()=>{setMessage("");if(!form.title){setMessage("News title is required.");return;}try{if(editing) await adminRequest({entity:"news",id:editing,...form},"PUT");else await adminRequest({action:"create-content",entity:"news",...form});setForm(blank);setEditing(null);await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to save news.");}};
  const remove=async(id:string)=>{if(!confirm("Delete this news post?"))return;try{await adminRequest({},"DELETE",`?entity=news&id=${encodeURIComponent(id)}`);await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to delete news.");}};
  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><Panel title={editing?"Edit News":"Add News"}><div className="grid gap-3"><label className="field"><span>Category</span><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label><label className="field"><span>Date</span><input value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label className="field"><span>Title</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label className="field"><span>Description</span><textarea rows={5} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>{message&&<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{message}</div>}<button onClick={save} className="red-btn justify-center">{editing?"SAVE CHANGES":"PUBLISH NEWS"}</button>{editing&&<button onClick={()=>{setEditing(null);setForm(blank)}} className="text-sm text-white/40">Cancel</button>}</div></Panel><Panel title={`News Posts (${store.news.length})`}><div className="space-y-2">{store.news.map(x=><div key={x.id} className="rounded-xl border border-white/5 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="text-xs font-bold uppercase tracking-wider text-red-400">{x.category} · {x.date}</div><b className="mt-1 block">{x.title}</b><p className="mt-1 text-sm text-white/40">{x.description}</p></div><div className="flex gap-2"><RowButton onClick={()=>{setEditing(x.id);setForm(x)}}>EDIT</RowButton><RowButton onClick={()=>remove(x.id)}>DELETE</RowButton></div></div></div>)}</div></Panel></div>;
}

function CrudGallery({items,reload}:{items:GalleryItem[];reload:()=>Promise<void>}) {
  const blank:Omit<GalleryItem,'id'|'created_at'>={title:'',image_url:'',category:'VTC',description:'',sort_order:0};
  const [form,setForm]=useState(blank); const [editing,setEditing]=useState<string|null>(null); const [message,setMessage]=useState('');
  const save=async()=>{setMessage(''); if(!form.title||!form.image_url){setMessage('Title and image URL are required.');return;} const action=editing?'PUT':'POST'; const payload=editing?{...form,id:editing}:{...form,action:'gallery-create'}; const r=await fetch('/api/admin',{method:action,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const d=await r.json(); if(!r.ok){setMessage(d.error||'Unable to save image.');return;} setForm(blank);setEditing(null);await reload();};
  const remove=async(id:string)=>{if(!confirm('Delete this gallery image?'))return; const r=await fetch(`/api/admin?id=${encodeURIComponent(id)}`,{method:'DELETE'}); if(r.ok) await reload(); else {const d=await r.json();setMessage(d.error||'Unable to delete image.');}};
  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><Panel title={editing?'Edit Gallery Image':'Add Gallery Image'}><div className="grid gap-3"><label className="field"><span>Title</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label className="field"><span>Image URL</span><input value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})} placeholder="https://..."/></label><label className="field"><span>Category</span><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label><label className="field"><span>Description</span><textarea rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="field"><span>Sort Order</span><input type="number" value={form.sort_order} onChange={e=>setForm({...form,sort_order:Number(e.target.value)})}/></label>{message&&<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{message}</div>}<button onClick={save} className="red-btn justify-center">{editing?'SAVE CHANGES':'ADD IMAGE'}</button>{editing&&<button onClick={()=>{setEditing(null);setForm(blank)}} className="text-sm text-white/40">Cancel</button>}</div></Panel><Panel title={`Gallery (${items.length})`}><div className="grid gap-3 sm:grid-cols-2">{items.map(x=><div key={x.id} className="overflow-hidden rounded-xl border border-white/5 bg-white/[.02]"><img src={x.image_url} className="h-40 w-full object-cover"/><div className="p-3"><b>{x.title}</b><div className="mt-1 text-xs text-white/40">{x.category} · order {x.sort_order}</div><div className="mt-3 flex gap-2"><RowButton onClick={()=>{setEditing(x.id);setForm({title:x.title,image_url:x.image_url,category:x.category,description:x.description,sort_order:x.sort_order})}}>EDIT</RowButton><RowButton onClick={()=>remove(x.id)}>DELETE</RowButton></div></div></div>)}</div>{!items.length&&<p className="mt-4 text-sm text-white/40">No database gallery images yet.</p>}</Panel></div>;
}

createRoot(document.getElementById("root")!).render((window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/")) ? <AdminApp /> : <App />);
