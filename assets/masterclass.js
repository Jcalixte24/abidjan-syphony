/* BOMLAAH · page Masterclass */
const ART={
  compositeur:`<svg class="art" viewBox="0 0 300 120" aria-hidden="true">
    <g class="st" stroke-width="1">${[30,42,54,66,78].map(y=>`<path d="M10 ${y}H290"/>`).join('')}</g>
    <path class="draw" pathLength="1" d="M20 66 C60 20, 90 96, 130 52 S210 34, 250 58"/>
    ${[[50,66],[88,60],[124,54],[166,44],[208,50]].map(([x,y],i)=>`<ellipse class="pop" style="--d:${.5+i*.18}s" cx="${x}" cy="${y}" rx="7" ry="5" transform="rotate(-20 ${x} ${y})"/>`).join('')}
    <path class="draw" style="--d:1.2s" pathLength="1" d="M250 58 l20 -46 l9 4 l-20 46 z M250 58 l2 10"/>
  </svg>`,
  economie:`<svg class="art" viewBox="0 0 300 120" aria-hidden="true">
    <g class="spin"><circle cx="70" cy="60" r="50" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="70" cy="60" r="38" fill="none" stroke="currentColor" opacity=".35"/><circle cx="70" cy="60" r="28" fill="none" stroke="currentColor" opacity=".35"/><circle cx="70" cy="60" r="16" fill="var(--or)" opacity=".85"/><circle cx="70" cy="60" r="3" style="fill:var(--salle)"/><path d="M70 14a46 46 0 0 1 40 24" stroke="currentColor" fill="none" opacity=".6"/></g>
    <circle class="draw" pathLength="1" cx="180" cy="50" r="26"/>
    <path class="draw" style="--d:.5s" pathLength="1" d="M191 40a13 13 0 1 0 0 20"/>
    ${[0,1,2,3].map(i=>`<ellipse class="pop" style="--d:${.9+i*.15}s" cx="250" cy="${96-i*10}" rx="20" ry="6" fill="none" stroke="currentColor" stroke-width="2"/>`).join('')}
  </svg>`,
  carrieres:`<svg class="art" viewBox="0 0 300 120" aria-hidden="true">
    <path class="draw" pathLength="1" d="M14 110H70V88H126V66H182V44H238V22H286"/>
    ${[[42,110],[98,88],[154,66],[210,44]].map(([x,y],i)=>`<g class="pop" style="--d:${.6+i*.2}s"><ellipse cx="${x}" cy="${y-9}" rx="6" ry="4.4" transform="rotate(-20 ${x} ${y-9})"/><rect x="${x+4.6}" y="${y-34}" width="1.8" height="25"/></g>`).join('')}
    <path class="pop" style="--d:1.5s" d="M262 2l4.5 9 10 1.4-7.2 7 1.7 10-9-4.7-9 4.7 1.7-10-7.2-7 10-1.4z"/>
  </svg>`,
  binome:`<svg class="art" viewBox="0 0 300 120" aria-hidden="true">
    <rect class="draw" pathLength="1" x="14" y="34" width="74" height="52" rx="7"/>
    <circle class="draw" style="--d:.3s" pathLength="1" cx="51" cy="60" r="14"/>
    <path class="draw" style="--d:.3s" pathLength="1" d="M88 50l16-8v36l-16-8"/>
    <path class="draw" style="--d:.6s" pathLength="1" d="M110 60 C130 22,150 22,170 60 S210 98,230 60"/>
    <path class="draw" style="--d:.8s" pathLength="1" d="M110 60 C130 98,150 98,170 60 S210 22,230 60" opacity=".55"/>
    <g class="pop" style="--d:1.3s"><ellipse cx="258" cy="84" rx="10" ry="7.4" transform="rotate(-20 258 84)"/><rect x="266" y="36" width="2.4" height="48"/><path d="M268.4 36c4 6 16 8 14 22" fill="none" stroke="var(--or)" stroke-width="2.4"/></g>
  </svg>`
};

/* ================== THÉMATIQUES ================== */
const INTER = Object.fromEntries(INTERVENANTS.map(p => [p.id, p]));
const initiales = n => n.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
(function(){
  const list=document.getElementById('themes'),panel=document.getElementById('tpanel');
  const seat='<svg viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 2h12M8 2v9M4 17l4-6 4 6"/></svg>';
  THEMES.forEach((t,i)=>{
    const li=document.createElement('li');li.setAttribute('role','presentation');
    li.innerHTML=`<button class="theme-b" role="tab" id="th-${t.id}" aria-selected="${i===0}" aria-controls="tpanel" tabindex="${i===0?0:-1}">${t.title}</button>`;
    list.appendChild(li);
  });
  function show(i,focus){
    const t=THEMES[i];
    list.querySelectorAll('.theme-b').forEach((b,j)=>{b.setAttribute('aria-selected',j===i);b.tabIndex=j===i?0:-1;if(focus&&j===i)b.focus()});
    panel.setAttribute('aria-labelledby','th-'+t.id);
    const who=t.intervenants.map(id=>INTER[id]).map(p=>`<li>${p.photo?`<img class="av-img" src="../${p.photo}" alt="" width="64" height="64" loading="lazy">`:`<span class="av" aria-hidden="true">${initiales(p.name)}</span>`}<span><b>${p.name}</b><small>${p.role}</small></span></li>`).join('');
    panel.innerHTML=`<div class="swap">${ART[t.art]}<span class="tag">${t.tag}</span><h3>${t.title}</h3><p>${t.text}</p><ul class="who">${who}</ul></div>
      <div class="places"><div class="seats" aria-hidden="true">${Array.from({length:12},(_,k)=>seat.replace('<svg ',`<svg style="--i:${k}" `)).join('')}</div><div><b>12 places</b><small>Gratuit, sur inscription · ${t.horaire}</small></div></div>
      <a class="btn btn-or" href="../#inscription-masterclass-${t.id}">Candidater à cette masterclass</a>`;
  }
  list.addEventListener('click',e=>{const b=e.target.closest('.theme-b');if(!b)return;show([...list.querySelectorAll('.theme-b')].indexOf(b))});
  list.addEventListener('keydown',e=>{
    const bs=[...list.querySelectorAll('.theme-b')];let i=bs.findIndex(b=>b.getAttribute('aria-selected')==='true');
    if(e.key==='ArrowDown'||e.key==='ArrowRight'){e.preventDefault();show((i+1)%bs.length,true)}
    if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();show((i-1+bs.length)%bs.length,true)}
  });
  show(0);
  // un lien du type masterclass/#compositeur ouvre directement la bonne thématique
  const h=location.hash.slice(1),k=THEMES.findIndex(t=>t.id===h);if(k>0)show(k);
})();

/* ================== INTERVENANTS ================== */
(function(){
  const box=document.getElementById('team');
  const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  box.innerHTML=INTERVENANTS.map(p=>{
    const mc=THEMES.filter(t=>t.intervenants.includes(p.id)).map(t=>t.tag).join(' · ');
    const src=p.photo?(p.photo.startsWith('data:')?p.photo:'../'+p.photo):'';
    const pic=src?`<img class="pers-photo" src="${src}" alt="${esc(p.name)}" width="640" height="800" loading="lazy">`:`<span class="pers-photo pers-init" aria-hidden="true">${initiales(p.name)}</span>`;
    const bio=(p.bio&&p.bio.length)?`<details class="bio"><summary>Biographie</summary>${p.bio.map(x=>`<p>${esc(x)}</p>`).join('')}</details>`:'';
    return `<article class="pers rv">${pic}<div class="pers-txt"><h3>${esc(p.name)}</h3><p class="role">${esc(p.role)}</p><p class="mc-l">${esc(mc)}</p>${bio}</div></article>`;
  }).join('');
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}}),{threshold:.08});
  box.querySelectorAll('.rv').forEach((el,i)=>{el.style.transitionDelay=(i%3)*.08+'s';io.observe(el)});
})();
