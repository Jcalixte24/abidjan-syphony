/* BOMLAAH · page Ciné-concert */
/* ================== TIMECODES DES FILMS ================== */
(function(){
  const els=[...document.querySelectorAll('[data-ftc]')],p=n=>String(n).padStart(2,'0');
  let run=false,t0=performance.now();
  function loop(now){
    if(!run)return;
    const f=Math.floor((now-t0)/1000*24);
    els.forEach((el,i)=>{const ff=f+i*9137,s=Math.floor(ff/24);el.textContent=`00:${p(Math.floor(s/60)%60)}:${p(s%60)}:${p(ff%24)}`});
    requestAnimationFrame(loop);
  }
  if(!REDUCE)whenVisible(document.querySelector('.films'),v=>{if(v&&!run){run=true;requestAnimationFrame(loop)}else if(!v)run=false});
})();

/* ================== ORCHESTRE (plan de scène) ================== */
(function(){
  const svg=document.getElementById('stage');
  const CX=280,CY=292;
  let out=`<defs><radialGradient id="spot" cx=".5" cy="1" r=".9"><stop offset="0" stop-color="#8B3DFF" stop-opacity=".16"/><stop offset="1" stop-color="#8B3DFF" stop-opacity="0"/></radialGradient></defs>
    <path d="M20 300 A260 260 0 0 1 540 300 Z" fill="url(#spot)"/>
    <path d="M20 300 A260 260 0 0 1 540 300" fill="none" stroke="rgba(139,61,255,.35)" stroke-dasharray="3 6"/>
    <path d="M10 304H550" stroke="rgba(75,22,125,.25)"/>`;
  const rows=[{n:5,r:108},{n:7,r:205}];let k=0;
  rows.forEach(row=>{for(let i=0;i<row.n;i++){
    const a=Math.PI*(1-(i+.5)/row.n),x=CX+row.r*Math.cos(a),y=CY-row.r*Math.sin(a)*.95;
    // pupitre orienté vers le chef
    const dx=CX-x,dy=CY-30-y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,sx=x+ux*16,sy=y+uy*16;
    out+=`<g class="mus" data-k="${k}" style="--d:${(k*.4).toFixed(1)}s" tabindex="0" role="button" aria-label="Pupitre ${k+1} : jouer une note">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="40" fill="transparent"/>
      <circle class="halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/>
      <path class="stand" d="M${(sx-uy*8).toFixed(1)} ${(sy+ux*8).toFixed(1)} L${(sx+uy*8).toFixed(1)} ${(sy-ux*8).toFixed(1)}"/>
      <circle class="head" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/>
      <text class="fly" x="${(x+6).toFixed(1)}" y="${(y-14).toFixed(1)}" font-size="16">♪</text>
    </g>`;k++;
  }});
  // le chef
  out+=`<rect x="256" y="284" width="48" height="12" rx="2" style="fill:var(--lav)" stroke="rgba(75,22,125,.35)"/>
    <circle cx="280" cy="258" r="7" style="fill:var(--or-doux)"/><path d="M280 265v19" style="stroke:var(--or-doux)" stroke-width="3" stroke-linecap="round"/>
    <g class="baton"><path d="M280 268l20-12" style="stroke:var(--or-doux)" stroke-width="3" stroke-linecap="round"/><path d="M300 256l18-12" style="stroke:var(--blanc)" stroke-width="1.4" stroke-linecap="round"/></g>
    <path d="M280 268l-16 8" style="stroke:var(--or-doux)" stroke-width="3" stroke-linecap="round"/>`;
  svg.innerHTML=out;
  const mus=[...svg.querySelectorAll('.mus')];
  // chaque pupitre a sa note (accord de la mineur 9 réparti du grave à l'aigu)
  const NOTE=[45,52,57,60,64,48,55,59,62,67,69,72];
  function play(i,vol=.34){
    const g=mus[i];g.classList.remove('hit');void g.getBBox();g.classList.add('hit');
    if(AU.ctx)tone(midi(NOTE[i]),{vol,dur:2.4,type:i<5?'sine':'triangle'});
  }
  mus.forEach((g,i)=>{
    g.addEventListener('click',()=>{audioInit();play(i)});
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();audioInit();play(i)}});
    g.addEventListener('pointerenter',e=>{if(AU.on&&e.pointerType==='mouse')play(i,.22)});
  });
  // son activé : l'orchestre joue une progression lente (la m · fa · do · sol)
  const PROG=[[0,2,4,7,9,11],[5,2,3,8,4,10],[5,6,3,4,9,11],[1,6,8,4,9,7]];
  let vis=false,beat=0;
  whenVisible(svg,v=>vis=v,.3);
  setInterval(()=>{
    if(!vis||!AU.on)return;
    const bar=PROG[Math.floor(beat/4)%4],i=bar[beat%4===0?0:(beat%4)+Math.floor(Math.random()*2)];
    if(beat%4===0)play(bar[0],.3);
    play(i,.22);beat++;
  },500);
})();

/* ================== RÉSIDENCE (5 pages de partition) ================== */
(function(){
  const box=document.getElementById('pages');let out='';
  const rnd=s=>{const x=Math.sin(s*12.9898)*43758.5453;return x-Math.floor(x)};
  for(let d=0;d<5;d++){
    let svg='<svg viewBox="0 0 100 150">';
    [16,62,108].forEach(y0=>{for(let l=0;l<5;l++)svg+=`<path class="sl" d="M4 ${y0+l*5}H96"/>`});
    const n=3+d*6;
    for(let j=0;j<n;j++){
      const st=j%3,col=Math.floor(j/3),cols=Math.ceil(n/3);
      const x=14+col*(78/Math.max(cols,1))+rnd(d*31+j)*4,y=[16,62,108][st]+Math.floor(rnd(d*17+j*3)*9)*2.5;
      svg+=`<g class="n" style="--d:${(d*.25+j*.05).toFixed(2)}s"><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.6" ry="1.9" transform="rotate(-20 ${x.toFixed(1)} ${y.toFixed(1)})"/><rect x="${(x+2.1).toFixed(1)}" y="${(y-11).toFixed(1)}" width=".7" height="11"/></g>`;
    }
    if(d===4)svg+=`<path d="M93 108v20M96 108v20" style="stroke:var(--encre)" stroke-width="1"/><path d="M96 108v20" style="stroke:var(--encre)" stroke-width="2.2"/>`;
    svg+='</svg>';
    const rot=[-6,3,-2,4,-3][d],ty=[10,0,14,4,0][d];
    out+=`<div class="pg" style="--rot:${rot}deg;--ty:${ty}px"><header><span>Jour ${d+1}</span><span>${d+1}/5</span></header>${svg}</div>`;
  }
  box.innerHTML=out;
  new IntersectionObserver((es,o)=>es.forEach(e=>{if(e.isIntersecting){box.classList.add('on');o.disconnect()}}),{threshold:.3}).observe(box);
})();
