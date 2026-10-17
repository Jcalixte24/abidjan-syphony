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

/* ================== COMPTE À REBOURS ================== */
(function(){
  const d=document.getElementById('tc-d'),h=document.getElementById('tc-h'),m=document.getElementById('tc-m'),s=document.getElementById('tc-s'),lab=document.getElementById('tc-label');
  const p=n=>String(n).padStart(2,'0');
  function tick(){
    let diff=EVENT_START-Date.now();
    if(diff<=0){lab.textContent="C'est aujourd'hui";d.textContent=h.textContent=m.textContent=s.textContent='00';return}
    const j=Math.floor(diff/864e5);diff-=j*864e5;
    const hh=Math.floor(diff/36e5);diff-=hh*36e5;
    const mm=Math.floor(diff/6e4);diff-=mm*6e4;
    d.textContent=p(j);h.textContent=p(hh);m.textContent=p(mm);s.textContent=p(Math.floor(diff/1e3));
  }
  tick();setInterval(tick,1000);
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

/* ================== INSCRIPTIONS ================== */
(function(){
  const choices=document.getElementById('m-choices');
  THEMES.forEach(t=>{const ch=document.createElement('label');ch.className='choice';ch.innerHTML=`<input type="radio" name="thematique" value="${t.title}" data-id="${t.id}" required><span>${t.title}<small class="hor">${t.horaire}</small></span>`;choices.appendChild(ch)});
  const tabs=[...document.querySelectorAll('.tab')];
  const boxes={masterclass:document.getElementById('box-masterclass'),cineconcert:document.getElementById('box-cineconcert')};
  function openTab(id){
    tabs.forEach(t=>t.setAttribute('aria-selected',t.dataset.tab===id));
    Object.entries(boxes).forEach(([k,b])=>b.hidden=k!==id);
  }
  tabs.forEach(t=>t.addEventListener('click',()=>openTab(t.dataset.tab)));
  document.querySelectorAll('[data-open-form]').forEach(a=>a.addEventListener('click',()=>openTab(a.dataset.openForm)));

  // liens venant des pages Masterclass et Ciné-concert : #inscription-masterclass, #inscription-masterclass-<thématique>, #inscription-cineconcert
  function depuisAncre(){
    const m=location.hash.match(/^#inscription-(masterclass|cineconcert)(?:-([a-z0-9-]+))?$/);
    if(!m)return;
    openTab(m[1]);
    if(m[2]){const r=document.querySelector(`#m-choices input[data-id="${m[2]}"]`);if(r)r.checked=true}
    const sec=document.getElementById('inscriptions');if(sec)sec.scrollIntoView({behavior:'instant',block:'start'});
  }
  addEventListener('hashchange',depuisAncre);
  setTimeout(depuisAncre,60);
  addEventListener('load',()=>setTimeout(depuisAncre,250),{once:true});

  // masterclass : étudiant ou autre profil
  (function(){
    const sel=document.getElementById('m-statut');if(!sel)return;
    const gEtu=document.getElementById('m-grp-etu'),gPro=document.getElementById('m-grp-pro');
    function maj(){
      const etu=sel.value==='Étudiant(e)',pro=sel.value==='Professionnel(le)';
      gEtu.hidden=!etu;gPro.hidden=!pro;
      gEtu.querySelectorAll('input,select').forEach(i=>{i.disabled=!etu;i.required=etu&&i.dataset.req==='1'});
      gPro.querySelectorAll('input,select').forEach(i=>{i.disabled=!pro;i.required=pro&&i.dataset.req==='1'});
    }
    sel.addEventListener('change',maj);maj();
    document.getElementById('form-masterclass').addEventListener('reset',()=>setTimeout(maj));
  })();

  /** Réservation via le système Google : le code du billet est fabriqué ici pour afficher le QR immédiatement. */
  async function reserver(key,d,{box,form,err,ok,wrap}){
    const API=String(window.ASYM_API);
    const t=v=>String(v||'').trim();
    const btn=form.querySelector('button[type=submit]'),label=btn.innerHTML;
    btn.disabled=true;btn.textContent='Envoi en cours…';
    let code=ASYM.code(key==='masterclass'?'MC':'CC');
    let r=null;
    await new Promise(fin=>ASYM.jsonp(API+'?'+new URLSearchParams({...d,formulaire:key,code,a:'inscrire'}).toString(),x=>{r=x;fin()},()=>fin()));
    btn.disabled=false;btn.innerHTML=label;
    if(!r){err.textContent="Le serveur n'a pas répondu à temps. Si vous ne recevez pas d'e-mail de confirmation d'ici quelques minutes, réessayez : une réservation déjà enregistrée ne sera pas doublée.";err.hidden=false;return}
    if(!r.ok){
      err.textContent=r.erreur==='complet'?'Le ciné-concert est complet : toutes les places sont réservées.'
        :r.erreur==='trop_de_demandes'?'Trop de demandes en peu de temps. Patientez quelques minutes puis réessayez.'
        :r.erreur==='robot'?'Vérification impossible : cochez « Je ne suis pas un robot », prenez le temps de remplir le formulaire puis réessayez.'
        :r.erreur==='ferme'?(key==='masterclass'?'Les candidatures aux masterclass sont closes.':'Les réservations du ciné-concert sont closes.')
        :"Votre demande n'a pas pu être enregistrée ("+(r.erreur||'erreur')+'). Vérifiez les champs puis réessayez.';
      err.hidden=false;return;
    }
    code=r.code||code;
    const cine=key!=='masterclass',qr=ok.querySelector('.ok-qr'),save=ok.querySelector('[data-save-billet]'),wa=ok.querySelector('.wa-again');
    ok.querySelector('h3').textContent=cine?'Réservation enregistrée':'Candidature envoyée';
    ok.querySelector('.ok-msg').textContent=cine
      ?`Merci ${t(d.prenom)}. Voici votre billet : présentez ce QR code à l'entrée. ${r.doublon?"Cette réservation existait déjà : votre code est conservé et un e-mail vous le renvoie.":''} ${r.mail===false?"L'e-mail de confirmation n'a pas pu partir : enregistrez votre billet ci-dessous, il suffit à l'entrée.":`Un e-mail de confirmation est envoyé à ${t(d.email)} (pensez à vérifier vos courriers indésirables).`}`
      :`Merci ${t(d.prenom)}. Votre candidature est bien reçue. Une seule réservation par personne et par masterclass. Un e-mail de confirmation, avec votre code, est envoyé à ${t(d.email)} ; vous recevrez ensuite une réponse.`;
    if(wa)wa.hidden=true;
    if(qr)qr.hidden=!cine;
    if(save)save.hidden=!cine;
    if(cine&&qr&&window.qrcode){
      const carte=qr.querySelector('.carte');carte.textContent='';carte.appendChild(ASYM.qrCanvas(code,640));
      qr.querySelector('.ok-code').textContent=code;
      save.onclick=()=>ASYM.telecharger(ASYM.billetPng(code,[t(d.prenom)+' '+t(d.nom),`${t(d.places)} place${+d.places>1?'s':''} · vendredi 13 novembre 2026`,'YELAM’S, Abidjan']),'billet-'+code+'.png');
    }
    wrap.hidden=true;ok.hidden=false;ok.scrollIntoView({behavior:'smooth',block:'center'});
    if(AU.on)[69,72,76,81].forEach((m,i)=>tone(midi(m),{when:i*.12,vol:.3}));
  }

  Object.keys(boxes).forEach(key=>{
    const box=boxes[key],form=box.querySelector('form'),err=box.querySelector('.err'),ok=box.querySelector('.ok'),wrap=box.querySelector('.form-wrap');
    if(window.ASYM_API){
      form.querySelector('button[type=submit]').textContent=key==='masterclass'?'Envoyer ma candidature':'Réserver mes places';
      const sm=form.querySelector('.submit-row small');
      if(sm)sm.textContent=key==='masterclass'?"Tous les champs sont obligatoires, sauf mention contraire. Vous recevrez une confirmation par e-mail.":'Tous les champs sont obligatoires. Votre billet (QR code) s\'affiche tout de suite et vous est envoyé par e-mail.';
    }
    form._t0=Date.now();
    form.addEventListener('submit',e=>{
      e.preventDefault();err.hidden=true;
      form.querySelectorAll('.ferr').forEach(x=>x.remove());
      form.querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));
      if(!form.checkValidity()){
        const seen=new Set();
        form.querySelectorAll('input:invalid,select:invalid,textarea:invalid').forEach(f=>{
          if(f.type==='radio'){if(seen.has(f.name))return;seen.add(f.name)}
          const host=f.type==='radio'?f.closest('fieldset'):(f.closest('.f')||f.closest('.check'));
          const id='e-'+form.id+'-'+(f.name||Math.random().toString(36).slice(2));
          const m=document.createElement('small');m.className='ferr';m.id=id;
          m.textContent=f.validity&&f.validity.patternMismatch?'Numéro incorrect, ex. +225 07 00 00 00 00':f.type==='email'&&f.value?'Adresse e-mail incomplète, ex. vous@exemple.com':f.type==='checkbox'?'Cochez cette case pour continuer.':f.type==='radio'?'Choisissez une masterclass.':'Ce champ est obligatoire.';
          host.appendChild(m);f.setAttribute('aria-invalid','true');f.setAttribute('aria-describedby',id);
        });
        const first=form.querySelector('input:invalid,select:invalid,textarea:invalid');if(first)first.focus();
        err.textContent='Certains champs sont manquants ou incorrects : ils sont signalés en rouge.';err.hidden=false;return;
      }
      const d=Object.fromEntries(new FormData(form).entries());
      d.humain='1';d.droit_image='Oui';d.delai=String(Date.now()-(form._t0||Date.now()));
      const t=v=>String(v||'').trim();
      if(window.ASYM_API){reserver(key,d,{box,form,err,ok,wrap});return}
      const num=String(WHATSAPP[key]||'').replace(/\D/g,'');
      if(!num){err.textContent="L'envoi par WhatsApp n'est pas encore configuré. Réessayez plus tard.";err.hidden=false;return}
      const lines=key==='masterclass'
        ? ['*CANDIDATURE MASTERCLASS*','BOMLAAH · 13.11.2026','',
           `*Nom :* ${t(d.prenom)} ${t(d.nom)}`,`*E-mail :* ${t(d.email)}`,`*Téléphone :* ${t(d.telephone)}`,`*Statut :* ${t(d.statut)}`,...(t(d.statut)==='Étudiant(e)'?[`*Établissement :* ${t(d.etablissement)}`,`*Filière :* ${t(d.niveau)}`]:[`*Profil :* ${t(d.profil)}`,...(t(d.structure)?[`*Structure :* ${t(d.structure)}`]:[])]),'',
           '*Masterclass :*',t(d.thematique),...(t(d.motivation)?['','*Motivation :*',t(d.motivation)]:[]),'','_Envoyé depuis le site_']
        : ['*RÉSERVATION CINÉ-CONCERT*','BOMLAAH · 13.11.2026 · YELAM’S','',
           `*Nom :* ${t(d.prenom)} ${t(d.nom)}`,`*E-mail :* ${t(d.email)}`,`*Téléphone :* ${t(d.telephone)}`,`*Places :* ${t(d.places)}`,`*Profil :* ${t(d.profil)}`,'','_Envoyé depuis le site_'];
      const url=`https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`;
      let w=null;try{w=window.open(url,'_blank');if(w)w.opener=null}catch(x){}
      const quoi=key==='masterclass'?'candidature':'réservation';
      const again=box.querySelector('.wa-again');again.href=url;again.hidden=false;
      again.lastChild.textContent=w?'Rouvrir WhatsApp':'Ouvrir WhatsApp';
      box.querySelector('.ok-msg').textContent=w
        ? `Merci ${t(d.prenom)}. WhatsApp s'est ouvert avec votre ${quoi} déjà rédigée : appuyez sur Envoyer dans WhatsApp pour la transmettre à l'équipe. Si rien ne s'est ouvert, utilisez le bouton ci-dessous.`
        : `Merci ${t(d.prenom)}. Votre ${quoi} est prête : ouvrez WhatsApp avec le bouton ci-dessous, puis appuyez sur Envoyer pour la transmettre à l'équipe.`;
      wrap.hidden=true;ok.hidden=false;ok.scrollIntoView({behavior:'smooth',block:'center'});
      if(AU.on)[69,72,76,81].forEach((m,i)=>tone(midi(m),{when:i*.12,vol:.3}));
    });
    form.addEventListener('input',e=>{const f=e.target;if(f.getAttribute('aria-invalid')&&f.checkValidity()){f.removeAttribute('aria-invalid');const m=document.getElementById(f.getAttribute('aria-describedby'));if(m)m.remove()}});
    box.querySelector('[data-reset]').addEventListener('click',()=>{form.reset();ok.hidden=true;wrap.hidden=false});
  });
})();

/* ================== HERO : caméra qui descend vers la scène ================== */
(function(){
  const h=document.querySelector('.hero-scene');if(!h||REDUCE)return;
  let tick=false;
  function maj(){tick=false;const r=h.getBoundingClientRect(),p=Math.max(0,Math.min(1,-r.top/Math.max(r.height*.8,1)));h.style.setProperty('--p',p.toFixed(3))}
  addEventListener('scroll',()=>{if(!tick){tick=true;requestAnimationFrame(maj)}},{passive:true});maj();
})();

/* ================== PLACES RESTANTES ET FERMETURE ================== */
(function(){
  if(!window.ASYM_API||!window.ASYM)return;
  const sel=document.getElementById('c-places'),boxC=document.getElementById('box-cineconcert'),boxM=document.getElementById('box-masterclass');
  function ferme(box,texte){if(!box)return;const b=box.querySelector('button[type=submit]'),note=box.querySelector('.note');if(b)b.disabled=true;if(note)note.textContent=texte}
  ASYM.jsonp(window.ASYM_API+'?a=dispo',r=>{
    if(!r||!r.ok)return;
    if(r.master&&r.master.ferme)ferme(boxM,'Les candidatures aux masterclass sont closes.');
    if(!r.cine)return;
    if(r.cine.ferme){ferme(boxC,'Les réservations du ciné-concert sont closes.');return}
    if(r.cine.restantes==null)return;
    const n=r.cine.restantes,note=boxC&&boxC.querySelector('.note');
    if(n<=0){ferme(boxC,'Le ciné-concert est complet : toutes les places sont réservées.');return}
    if(sel)[...sel.options].forEach(o=>{if(+o.value>n)o.remove()});
    if(n<=40&&note)note.textContent+=' Il reste '+n+' place'+(n>1?'s':'')+'.';
  });
})();


/* ciné-concert : « Autre » demande une précision */
(function(){
  const sel=document.getElementById('c-profil'),g=document.getElementById('c-grp-autre');if(!sel||!g)return;
  const inp=g.querySelector('input');
  function maj(){const a=/^autre/i.test(sel.value);g.hidden=!a;inp.disabled=!a;inp.required=a}
  sel.addEventListener('change',maj);maj();
  document.getElementById('form-cineconcert').addEventListener('reset',()=>setTimeout(maj));
})();
