/* BOMLAAH · page d'accueil */
/* ================== RIDEAU ================== */
(function(){
  const cur = document.getElementById('curtain'), root = document.documentElement;
  let done = false;
  function open(){
    if (done) return; done = true;
    cur.classList.add('open'); root.classList.add('ready');
    setTimeout(() => cur.classList.add('gone'), 1700);
  }
  if (REDUCE) { cur.classList.add('gone'); root.classList.add('ready'); return; }
  cur.addEventListener('click', open);
  addEventListener('keydown', open, {once:true});
  addEventListener('load', () => setTimeout(open, 600));
  setTimeout(open, 3200); // filet de sécurité
})();

/* ================== POUSSIÈRE DANS LE FAISCEAU ================== */
(function(){
  const c = document.getElementById('dust'), ctx = c.getContext('2d');
  let w, h, run = false, P = [];
  function size(){
    const r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    P = Array.from({length: Math.round(w * h / 9000)}, () => ({x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + .3, vx: -(Math.random() * .25 + .05), vy: (Math.random() - .5) * .18, ph: Math.random() * 6.28}));
  }
  function draw(t){
    ctx.clearRect(0, 0, w, h);
    for (const p of P) {
      p.x += p.vx; p.y += p.vy + Math.sin(t / 1400 + p.ph) * .08;
      if (p.x < -4) p.x = w + 4; if (p.y < -4) p.y = h + 4; if (p.y > h + 4) p.y = -4;
      ctx.globalAlpha = .25 + .55 * (.5 + .5 * Math.sin(t / 700 + p.ph));
      ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
  }
  function loop(t){ if (!run) return; draw(t); requestAnimationFrame(loop); }
  addEventListener('resize', size); size(); draw(0);
  if (!REDUCE) whenVisible(c.closest('.hero'), v => { if (v && !run) { run = true; requestAnimationFrame(loop); } else if (!v) run = false; });
})();

/* ================== PORTÉE ANIMÉE (HERO) ================== */
(function(){
  const c=document.getElementById('staff'),ctx=c.getContext('2d');
  let w=0,h=0,gap=20,top=0,running=false,t0=performance.now(),mx=-1e4,tmx=-1e4,mAct=0,tAct=0,prevPx=-1e9;
  // [position horizontale 0-1, ligne de la portée 0 (haut) à 8 (bas)]
  const NOTES=[[.09,6],[.15,4],[.21,5],[.28,2],[.34,3],[.41,0],[.48,2],[.55,4],[.62,3],[.69,5],[.76,7],[.84,4],[.9,6]];
  // la mineur pentatonique, du haut vers le bas
  const PITCH=[76,74,72,69,67,64,62,60,57];
  const flash=new Array(NOTES.length).fill(0);
  function size(){
    const r=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    w=r.width;h=r.height;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
    gap=Math.max(11,Math.min(24,h*.13));top=h/2-gap*2;
    if(!running)draw(performance.now());
  }
  function amp(x,px){return 1.1+20*Math.exp(-Math.pow((x-px)/(w*.085),2))+mAct*16*Math.exp(-Math.pow((x-mx)/(w*.06),2))}
  function ly(pos,x,t,px){return top+pos*gap/2+amp(x,px)*Math.sin(x*.011+t*1.5+pos*.6)*.55}
  function clef(){
    // clé de sol dessinée à la main (approximation en courbes)
    const x=Math.max(16,w*.025),g=gap;
    ctx.save();ctx.strokeStyle='rgba(255,208,138,.75)';ctx.lineWidth=1.8;ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(x+g*.55,top+g*4.9);
    ctx.bezierCurveTo(x+g*.2,top+g*5.6,x-g*.4,top+g*4.9,x+g*.2,top+g*4.4);
    ctx.lineTo(x+g*.55,top-g*1.1);
    ctx.bezierCurveTo(x+g*.65,top-g*1.9,x+g*1.3,top-g*1.2,x+g*.9,top-g*.2);
    ctx.bezierCurveTo(x+g*.4,top+g*.9,x-g*.7,top+g*1.8,x-g*.5,top+g*3);
    ctx.bezierCurveTo(x-g*.3,top+g*4.1,x+g*1.4,top+g*4.1,x+g*1.3,top+g*2.9);
    ctx.bezierCurveTo(x+g*1.2,top+g*2,x-g*.1,top+g*2,x+g*.1,top+g*2.9);
    ctx.stroke();ctx.restore();
  }
  function draw(now){
    const t=(now-t0)/1000;
    const prog=REDUCE?.38:((t/17)%1);
    const px=prog*(w*1.1)-w*.05;
    mx+=(tmx-mx)*.12;mAct+=(tAct-mAct)*.08;
    ctx.clearRect(0,0,w,h);
    const g=ctx.createLinearGradient(px-w*.18,0,px+w*.18,0);
    g.addColorStop(0,'rgba(255,208,138,0)');g.addColorStop(.5,'rgba(255,208,138,.95)');g.addColorStop(1,'rgba(255,208,138,0)');
    for(let i=0;i<5;i++){
      ctx.beginPath();
      for(let x=-10;x<=w+10;x+=6){const y=ly(i*2,x,t,px);x===-10?ctx.moveTo(x,y):ctx.lineTo(x,y)}
      ctx.lineWidth=1.1;ctx.strokeStyle='rgba(255,179,71,.26)';ctx.stroke();
      ctx.lineWidth=1.5;ctx.strokeStyle=g;ctx.stroke();
    }
    clef();
    // tête de lecture
    const y1=top-gap*1.6,y2=top+gap*5.6;
    const pg=ctx.createLinearGradient(0,y1,0,y2);
    pg.addColorStop(0,'rgba(255,208,138,0)');pg.addColorStop(.5,'rgba(255,208,138,.85)');pg.addColorStop(1,'rgba(255,208,138,0)');
    ctx.fillStyle=pg;ctx.fillRect(px-.5,y1,1,y2-y1);
    NOTES.forEach(([f,pos],k)=>{
      const nx=f*w,ny=ly(pos,nx,t,px),age=px-nx;
      if(prevPx<nx&&px>=nx){flash[k]=1;if(AU.on)tone(midi(PITCH[pos]),{vol:.38,dur:2.2})}
      flash[k]*=.965;
      const glow=Math.max(age>0?Math.exp(-age/(w*.16)):0,flash[k]);
      const r=gap*.62;
      ctx.save();
      ctx.shadowColor='rgba(255,179,71,'+(.9*glow)+')';ctx.shadowBlur=22*glow;
      ctx.fillStyle='rgba(255,179,71,'+(.3+.7*glow)+')';ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=1.6;
      ctx.beginPath();ctx.ellipse(nx,ny,r*(1+.28*glow),r*.74*(1+.28*glow),-.4,0,Math.PI*2);ctx.fill();
      const up=pos>=4,sx=up?nx+r*.9:nx-r*.9;
      ctx.beginPath();ctx.moveTo(sx,ny);ctx.lineTo(sx,ny+(up?-1:1)*gap*3.1);ctx.stroke();
      ctx.restore();
    });
    prevPx=px;
  }
  function loop(now){if(!running)return;draw(now);requestAnimationFrame(loop)}
  const stage=c.parentElement;
  whenVisible(stage,v=>{if(v&&!running&&!REDUCE){running=true;prevPx=-1e9;requestAnimationFrame(loop)}else if(!v){running=false}});
  addEventListener('resize',size);
  const hero=stage.closest('.hero');
  hero.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();tmx=e.clientX-r.left;tAct=1});
  hero.addEventListener('pointerleave',()=>{tAct=0});
  // toucher la portée joue la note la plus proche
  c.addEventListener('pointerdown',e=>{
    const r=c.getBoundingClientRect(),x=e.clientX-r.left;
    let best=0,bd=1e9;NOTES.forEach(([f],k)=>{const d=Math.abs(f*w-x);if(d<bd){bd=d;best=k}});
    flash[best]=1;if(audioInit())tone(midi(PITCH[NOTES[best][1]]),{vol:.4,dur:2.2});
  });
  document.fonts&&document.fonts.ready.then(size);
  size();draw(performance.now());
})();

/* ================== CLAVIER ================== */
(function(){
  const box=document.getElementById('keys');
  const N=innerWidth<620?14:21, START=48; // do3
  const WHITE=[0,2,4,5,7,9,11], HAS_BLACK=[1,1,0,1,1,1,0];
  const keys={};
  for(let i=0;i<N;i++){
    const oct=Math.floor(i/7),deg=i%7,m=START+oct*12+WHITE[deg];
    const k=document.createElement('button');k.className='wk';k.type='button';k.tabIndex=-1;k.setAttribute('aria-hidden','true');k.dataset.m=m;box.appendChild(k);keys[m]=k;
    if(HAS_BLACK[deg]&&i<N-1){
      const b=document.createElement('button');b.className='bk';b.type='button';b.tabIndex=-1;b.setAttribute('aria-hidden','true');b.dataset.m=m+1;
      b.style.left=`calc(${(i+1)/N*100}% - ${100/N*0.3}%)`;b.style.width=`${100/N*0.6}%`;box.appendChild(b);keys[m+1]=b;
    }
  }
  function hit(m,audible){const k=keys[m];if(!k)return;k.classList.add('hit');setTimeout(()=>k.classList.remove('hit'),260);if(audible)tone(midi(m),{vol:.36,dur:1.6})}
  box.addEventListener('pointerdown',e=>{const k=e.target.closest('[data-m]');if(!k)return;audioInit();hit(+k.dataset.m,true)});
  // une petite phrase rejouée quand le clavier est visible
  const PHRASE=[57,60,64,69,67,64,62,64,60,57,55,57];
  let vis=false,timer=null;
  function phrase(){if(!vis)return;PHRASE.forEach((m,i)=>setTimeout(()=>hit(m,AU.on),i*190));timer=setTimeout(phrase,8000)}
  if(!REDUCE)whenVisible(box,v=>{vis=v;clearTimeout(timer);if(v)timer=setTimeout(phrase,500)},.6);
})();

/* ================== CHIFFRES ================== */
(function(){
  const els=document.querySelectorAll('[data-count]');
  if(REDUCE)return;
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    if(!e.isIntersecting)return;io.unobserve(e.target);
    const el=e.target,end=+el.dataset.count,start=performance.now(),dur=1300;
    (function step(n){const p=Math.min((n-start)/dur,1),k=1-Math.pow(1-p,3);el.textContent=Math.round(end*k);if(p<1)requestAnimationFrame(step)})(start);
  }),{threshold:.6});
  els.forEach(e=>{e.textContent='0';io.observe(e)});
})();

/* ================== BILLET (inclinaison) ================== */
(function(){
  const t=document.getElementById('ticket');
  if(REDUCE||!matchMedia('(hover:hover)').matches)return;
  t.parentElement.addEventListener('pointermove',e=>{
    const r=t.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
    t.style.transform=`rotate(-2deg) rotateY(${x*14}deg) rotateX(${-y*12}deg)`;
  });
  t.parentElement.addEventListener('pointerleave',()=>{t.style.transform=''});
})();

/* ================== HERO : caméra qui descend vers la scène ================== */
(function(){
  const h=document.querySelector('.hero-scene');if(!h||REDUCE)return;
  let tick=false;
  function maj(){tick=false;const r=h.getBoundingClientRect(),p=Math.max(0,Math.min(1,-r.top/Math.max(r.height*.8,1)));h.style.setProperty('--p',p.toFixed(3))}
  addEventListener('scroll',()=>{if(!tick){tick=true;requestAnimationFrame(maj)}},{passive:true});maj();
})();
