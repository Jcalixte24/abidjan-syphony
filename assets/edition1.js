/* BOMLAAH · page Première édition : compteurs et photos agrandies */
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

(function(){
  const lb=document.getElementById('ed-lb'),grid=document.getElementById('ed-grid');
  if(!lb||!grid||typeof lb.showModal!=='function')return;
  const imgs=[...grid.querySelectorAll('img')],big=lb.querySelector('img');
  let i=0;
  function voir(n){i=(n+imgs.length)%imgs.length;big.src=imgs[i].src;big.alt=imgs[i].alt}
  grid.addEventListener('click',e=>{const b=e.target.closest('.ph');if(!b)return;voir(+b.dataset.i);lb.showModal()});
  lb.querySelector('.x').addEventListener('click',()=>lb.close());
  lb.querySelector('.pv').addEventListener('click',()=>voir(i-1));
  lb.querySelector('.nx').addEventListener('click',()=>voir(i+1));
  lb.addEventListener('click',e=>{if(e.target===lb)lb.close()});
  lb.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')voir(i-1);if(e.key==='ArrowRight')voir(i+1)});
})();
