/* BOMLAAH · noyau commun (outils, son, navigation, révélations) */
/* ================== OUTILS ================== */
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const whenVisible = (el, cb, th = .01) => new IntersectionObserver(es => cb(es[0].isIntersecting), {threshold: th}).observe(el);

/* ================== MOTEUR SONORE (opt-in) ================== */
const AU = {ctx:null, out:null, rev:null, on:false};
function audioInit(){
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return true; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
  const ctx = new C(), out = ctx.createGain(), comp = ctx.createDynamicsCompressor();
  out.gain.value = .22; out.connect(comp); comp.connect(ctx.destination);
  // petite réverbération de salle, générée
  const len = ctx.sampleRate * 2.6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
  const conv = ctx.createConvolver(), wet = ctx.createGain(); conv.buffer = buf; wet.gain.value = .4; conv.connect(wet); wet.connect(out);
  Object.assign(AU, {ctx, out, rev:conv}); return true;
}
function tone(freq, {dur = 1.8, vol = .45, type = 'triangle', when = 0} = {}){
  if (!AU.ctx) return;
  const c = AU.ctx, t = c.currentTime + when;
  const o = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain(), f = c.createBiquadFilter(), g = c.createGain();
  o.type = type; o.frequency.value = freq; o2.type = 'sine'; o2.frequency.value = freq * 2.003; g2.gain.value = .16;
  o.connect(f); o2.connect(g2); g2.connect(f);
  f.type = 'lowpass'; f.frequency.setValueAtTime(Math.min(5000, freq * 7), t); f.frequency.exponentialRampToValueAtTime(Math.max(260, freq * 1.4), t + dur);
  f.connect(g); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  g.connect(AU.out); g.connect(AU.rev);
  o.start(t); o2.start(t); o.stop(t + dur + .05); o2.stop(t + dur + .05);
}
const sndBtn = document.getElementById('snd'), listenL = document.getElementById('listen-l'), listenBtn = document.getElementById('listen');
function setSound(on){
  if (on && !audioInit()) return;
  AU.on = on;
  document.documentElement.classList.toggle('sound-on', on);
  if (sndBtn) { sndBtn.setAttribute('aria-pressed', on); sndBtn.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son'); }
  if (listenL) listenL.textContent = on ? 'Couper le son' : 'Écouter la portée';
  if (on) [57, 64, 69, 72].forEach((m, i) => tone(midi(m), {when: i * .09, vol: .25, dur: 2.4}));
}
if (sndBtn) sndBtn.addEventListener('click', () => setSound(!AU.on));
if (listenBtn) listenBtn.addEventListener('click', () => setSound(!AU.on));

/* ================== NAV ================== */
const nav = document.getElementById('nav'), burger = document.getElementById('burger');
const onScroll = () => nav.classList.toggle('solid', scrollY > 30);
addEventListener('scroll', onScroll, {passive:true}); onScroll();
function closeMenu(){ nav.classList.remove('open'); burger.setAttribute('aria-expanded', false); burger.setAttribute('aria-label', 'Ouvrir le menu'); document.body.style.overflow = document.documentElement.style.overflow = ''; }
burger.addEventListener('click', () => {
  const o = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', o);
  burger.setAttribute('aria-label', o ? 'Fermer le menu' : 'Ouvrir le menu');
  document.body.style.overflow = document.documentElement.style.overflow = o ? 'hidden' : '';
});
document.querySelectorAll('#links a').forEach(a => a.addEventListener('click', closeMenu));
addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) closeMenu(); });

/* ================== PAUSE DES ANIMATIONS HORS ÉCRAN ================== */
(function(){
  const io=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('offscreen',!e.isIntersecting)),{rootMargin:'120px 0px'});
  document.querySelectorAll('main > section, footer').forEach(s=>io.observe(s));
})();

/* ================== RÉVÉLATIONS ================== */
(function(){
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), {threshold:.12, rootMargin:'0px 0px -30px 0px'});
  document.querySelectorAll('.rv').forEach(el => io.observe(el));
})();
