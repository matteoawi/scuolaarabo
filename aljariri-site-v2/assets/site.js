(() => {
  const PRODUCTS = window.ALJ_PRODUCTS || [];
  const euro = value => new Intl.NumberFormat('it-IT', {style:'currency', currency:'EUR'}).format(value);
  const byId = id => PRODUCTS.find(p => p.id === id);
  const CART_KEY = 'aljariri_cart_v2';
  let cart = {};
  try { cart = JSON.parse(localStorage.getItem(CART_KEY) || '{}'); } catch { cart = {}; }

  const save = () => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
  };
  const lines = () => Object.entries(cart).map(([id, qty]) => ({product:byId(id), qty:Number(qty)})).filter(x => x.product && x.qty > 0);
  const count = () => lines().reduce((s, x) => s + x.qty, 0);
  const total = () => lines().reduce((s, x) => s + x.product.price * x.qty, 0);

  function toast(text){
    const el = document.querySelector('[data-toast]');
    if(!el) return;
    el.textContent = text; el.classList.add('show');
    clearTimeout(window.__aljToast); window.__aljToast = setTimeout(() => el.classList.remove('show'), 1800);
  }
  function add(id, qty=1){ cart[id] = (Number(cart[id]) || 0) + Number(qty); save(); toast('Aggiunto al carrello'); }
  function setQty(id, qty){ qty = Number(qty); if(qty <= 0) delete cart[id]; else cart[id] = qty; save(); }
  function clear(){ cart = {}; save(); }

  function renderCart(){
    document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = count());
    const target = document.querySelector('[data-cart-items]');
    const empty = document.querySelector('[data-cart-empty]');
    const foot = document.querySelector('[data-cart-foot]');
    if(!target) return;
    const current = lines();
    if(!current.length){ target.innerHTML = ''; if(empty) empty.hidden = false; if(foot) foot.hidden = true; return; }
    if(empty) empty.hidden = true; if(foot) foot.hidden = false;
    target.innerHTML = current.map(({product:p, qty}) => `
      <div class="cart-item">
        <div>
          <strong>${p.name}</strong><small>${euro(p.price)} × ${qty}</small>
          <div class="cart-controls">
            <button type="button" data-cart-dec="${p.id}" aria-label="Riduci quantità">−</button>
            <span>${qty}</span>
            <button type="button" data-cart-inc="${p.id}" aria-label="Aumenta quantità">+</button>
            <button type="button" class="remove" data-cart-remove="${p.id}">Rimuovi</button>
          </div>
        </div>
        <strong>${euro(p.price*qty)}</strong>
      </div>`).join('');
    document.querySelector('[data-cart-total]').textContent = euro(total());
    target.querySelectorAll('[data-cart-dec]').forEach(b => b.onclick = () => setQty(b.dataset.cartDec, (cart[b.dataset.cartDec]||0)-1));
    target.querySelectorAll('[data-cart-inc]').forEach(b => b.onclick = () => setQty(b.dataset.cartInc, (cart[b.dataset.cartInc]||0)+1));
    target.querySelectorAll('[data-cart-remove]').forEach(b => b.onclick = () => { delete cart[b.dataset.cartRemove]; save(); });
  }

  function openCart(){ const d = document.querySelector('[data-cart-drawer]'); if(!d) return; d.classList.add('open'); document.body.classList.add('lock'); }
  function closeCart(){ const d = document.querySelector('[data-cart-drawer]'); if(!d) return; d.classList.remove('open'); document.body.classList.remove('lock'); }

  function productCard(p){
    return `<article class="product-card" data-product-card data-category="${p.category.toLowerCase()}" data-name="${p.name.toLowerCase()}">
      <a class="product-visual ${p.accent}" href="prodotto.html?id=${encodeURIComponent(p.id)}" aria-label="${p.name}">
        <div class="product-glyph ${/^\d+$/.test(String(p.glyph))?'num':''}">${p.glyph}</div>
      </a>
      <div class="product-info">
        <div class="product-top"><span>${p.category}</span><span>${p.format}</span></div>
        <h3><a href="prodotto.html?id=${encodeURIComponent(p.id)}">${p.name}</a></h3>
        <p>${p.short}</p>
        <div class="product-bottom"><div class="price">${p.compareAt?`<del>${euro(p.compareAt)}</del>`:''}<strong>${euro(p.price)}</strong></div><button class="round-add" type="button" data-add-product="${p.id}" aria-label="Aggiungi ${p.name}">+</button></div>
      </div>
    </article>`;
  }
  function renderProductTargets(){
    document.querySelectorAll('[data-products]').forEach(target => {
      const limit = Number(target.dataset.limit || PRODUCTS.length);
      const cat = (target.dataset.category || '').toLowerCase();
      const list = PRODUCTS.filter(p => !cat || p.category.toLowerCase() === cat).slice(0, limit);
      target.innerHTML = list.map(productCard).join('');
    });
    bindAdds();
  }
  function bindAdds(){
    document.querySelectorAll('[data-add-product]').forEach(btn => btn.onclick = () => add(btn.dataset.addProduct));
  }

  function initShopFilters(){
    const grid = document.querySelector('[data-shop-grid]'); if(!grid) return;
    grid.innerHTML = PRODUCTS.map(productCard).join(''); bindAdds();
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const search = document.querySelector('[data-shop-search]');
    let active = 'all';
    function apply(){
      const q = (search?.value || '').trim().toLowerCase();
      grid.querySelectorAll('[data-product-card]').forEach(card => {
        const okCat = active === 'all' || card.dataset.category === active;
        const okSearch = !q || card.dataset.name.includes(q);
        card.hidden = !(okCat && okSearch);
      });
    }
    buttons.forEach(btn => btn.onclick = () => { buttons.forEach(x=>x.classList.remove('active')); btn.classList.add('active'); active = btn.dataset.filter; apply(); });
    if(search) search.addEventListener('input', apply);
  }

  async function loadReviews(){
    const grid = document.querySelector('[data-reviews-grid]');
    const summaryTargets = document.querySelectorAll('[data-review-count], [data-review-rating]');
    if(!grid && !summaryTargets.length) return;
    try{
      const apiBase = String(window.ALJ_API_BASE || '').replace(/\/$/,'');
      const res = await fetch(`${apiBase}/api/google-reviews`, {headers:{Accept:'application/json'}});
      const data = await res.json();
      document.querySelectorAll('[data-review-count]').forEach(el => el.textContent = data.totalReviewCount || 266);
      document.querySelectorAll('[data-review-rating]').forEach(el => el.textContent = Number(data.averageRating || 5).toFixed(1));
      if(!grid) return;
      if(Array.isArray(data.reviews) && data.reviews.length){
        grid.innerHTML = data.reviews.slice(0,9).map(r => {
          const comment = String(r.comment || '').trim();
          const text = comment ? `“${comment.replace(/</g,'&lt;')}”` : 'Valutazione positiva su Google.';
          const author = String(r.reviewer?.displayName || 'Cliente Google').replace(/</g,'&lt;');
          return `<article class="review-card"><div class="stars">${'★'.repeat(Math.round(r.rating||5))}</div><blockquote>${text}</blockquote><div class="review-author"><strong>${author}</strong><span>Google</span></div></article>`;
        }).join('');
      }else{
        grid.innerHTML = `<div class="review-empty"><strong>5,0/5 su Google · 266 recensioni.</strong><br>Il sito è già predisposto a caricare automaticamente tutte le recensioni da 4 e 5 stelle tramite Google Business Profile API. Per mostrare i testi reali servono l'accesso OAuth al profilo verificato e l'ID location.</div>`;
      }
    }catch{
      if(grid) grid.innerHTML = `<div class="review-empty"><strong>5,0/5 su Google · 266 recensioni.</strong><br>Le recensioni testuali si popolano automaticamente quando il sito gira con il backend e il profilo Google Business è collegato.</div>`;
    }
  }

  function initProductPage(){
    const root = document.querySelector('[data-product-page]'); if(!root) return;
    const id = new URLSearchParams(location.search).get('id') || PRODUCTS[0]?.id;
    const p = byId(id);
    if(!p){ root.innerHTML = '<div class="success-wrap"><h1>Prodotto non trovato.</h1><a class="btn btn-dark" href="shop.html">Torna allo shop</a></div>'; return; }
    document.title = `${p.name} — Al Jariri`;
    root.innerHTML = `<div class="product-page-art ${p.accent}" style="background:var(--${p.accent})"><div class="product-glyph ${/^\d+$/.test(String(p.glyph))?'num':''}">${p.glyph}</div></div>
      <div class="product-page-copy"><span class="eyebrow">${p.category} · ${p.format}</span><h1>${p.name}</h1><p class="product-desc">${p.short}</p><div class="price">${p.compareAt?`<del>${euro(p.compareAt)}</del>`:''}<strong>${euro(p.price)}</strong></div><ul class="feature-list">${p.details.map(x=>`<li>${x}</li>`).join('')}</ul><div class="qty-row"><input class="qty" type="number" min="1" max="20" value="1" data-product-qty><button class="btn btn-dark" type="button" data-product-add>Metti nel carrello <span>↗</span></button></div><p class="checkout-note">Pagamento disponibile con Stripe, PayPal, Klarna e Scalapay dopo la configurazione delle credenziali merchant.</p></div>`;
    root.querySelector('[data-product-add]').onclick = () => add(p.id, Number(root.querySelector('[data-product-qty]').value || 1));
  }

  function initGlobal(){
    renderProductTargets(); initShopFilters(); initProductPage(); renderCart(); loadReviews();
    document.querySelectorAll('[data-open-cart]').forEach(b => b.onclick = openCart);
    document.querySelectorAll('[data-close-cart]').forEach(b => b.onclick = closeCart);
    document.querySelector('[data-cart-backdrop]')?.addEventListener('click', closeCart);
    document.querySelector('[data-menu-button]')?.addEventListener('click', () => document.querySelector('[data-mobile-menu]')?.classList.toggle('open'));
    document.querySelectorAll('[data-mobile-menu] a').forEach(a => a.onclick = () => document.querySelector('[data-mobile-menu]').classList.remove('open'));
    window.addEventListener('keydown', e => { if(e.key === 'Escape') closeCart(); });
  }

  window.AlJariri = { PRODUCTS, euro, add, clear, lines, total, save, renderCart };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGlobal); else initGlobal();
})();

/* Immersive motion layer — progressive enhancement, no dependency */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer:fine)').matches;
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

  function boot(){
    document.body.classList.add('is-ready');

    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    document.body.appendChild(progress);
    const updateProgress = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      progress.style.width = `${clamp(scrollY / max * 100, 0, 100)}%`;
    };
    addEventListener('scroll', updateProgress, {passive:true}); updateProgress();

    const revealNodes = [...document.querySelectorAll('.section-title,.section-copy,.bento-card,.product-card,.service-card,.level,.review-card,.review-rating,.translation-band,.location-panel,.contact-panel,.checkout-card,.product-page-art,.product-page-copy,.prose,.page-hero .eyebrow')];
    revealNodes.forEach((el,i) => { el.dataset.reveal=''; el.style.setProperty('--reveal-delay', `${(i%4)*65}ms`); });
    if(!reduceMotion && 'IntersectionObserver' in window){
      const io = new IntersectionObserver(entries => entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('is-visible'); io.unobserve(e.target); } }), {threshold:.12, rootMargin:'0px 0px -7%'});
      revealNodes.forEach(el => io.observe(el));
    } else revealNodes.forEach(el => el.classList.add('is-visible'));

    if(finePointer && !reduceMotion){
      const orb = document.createElement('div'); orb.className='cursor-orb'; document.body.appendChild(orb);
      let tx=-60,ty=-60,x=-60,y=-60;
      addEventListener('pointermove', e => {
        tx=e.clientX;ty=e.clientY;
        document.body.style.setProperty('--cursor-x', `${e.clientX}px`);
        document.body.style.setProperty('--cursor-y', `${e.clientY}px`);
      }, {passive:true});
      const tick = () => { x += (tx-x)*.18; y += (ty-y)*.18; orb.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`; requestAnimationFrame(tick); }; tick();
      document.querySelectorAll('a,button,input,textarea,label').forEach(el => { el.addEventListener('mouseenter',()=>orb.classList.add('active')); el.addEventListener('mouseleave',()=>orb.classList.remove('active')); });
    }

    if(finePointer && !reduceMotion){
      document.querySelectorAll('.magnetic,.btn').forEach(el => {
        el.addEventListener('pointermove',e=>{
          const r=el.getBoundingClientRect(); const dx=(e.clientX-r.left-r.width/2)*.09; const dy=(e.clientY-r.top-r.height/2)*.12;
          el.style.transform=`translate(${dx}px,${dy}px) translateY(-2px)`;
        });
        el.addEventListener('pointerleave',()=>{ el.style.transform=''; });
      });
      document.querySelectorAll('.bento-card,.product-card,.service-card,.level').forEach(el => {
        el.addEventListener('pointermove', e => {
          const r=el.getBoundingClientRect();
          const px=(e.clientX-r.left)/r.width-.5, py=(e.clientY-r.top)/r.height-.5;
          el.style.setProperty('--ry',`${px*5}deg`); el.style.setProperty('--rx',`${py*-5}deg`);
        });
        el.addEventListener('pointerleave',()=>{el.style.setProperty('--ry','0deg');el.style.setProperty('--rx','0deg');});
      });
    }

    initHero();
  }

  function initHero(){
    const hero = document.querySelector('[data-hero-wow]');
    if(!hero) return;
    const stage=hero.querySelector('[data-parallax-stage]');
    const portal=hero.querySelector('[data-tilt-card]');
    const floats=[...hero.querySelectorAll('[data-depth]')];
    if(stage && !reduceMotion){
      stage.addEventListener('pointermove', e => {
        const r=stage.getBoundingClientRect();
        const nx=(e.clientX-r.left)/r.width, ny=(e.clientY-r.top)/r.height;
        stage.style.setProperty('--mx',`${nx*100}%`); stage.style.setProperty('--my',`${ny*100}%`);
        const dx=(nx-.5),dy=(ny-.5);
        if(portal) portal.style.transform=`rotateX(${dy*-9}deg) rotateY(${dx*11}deg) translateZ(15px)`;
        floats.forEach(el => { const d=Number(el.dataset.depth||1); el.style.translate=`${dx*22*d}px ${dy*18*d}px`; });
      });
      stage.addEventListener('pointerleave',()=>{ if(portal) portal.style.transform=''; floats.forEach(el=>el.style.translate=''); });
    }
    initParticles(hero.querySelector('[data-hero-particles]'));
  }

  function initParticles(canvas){
    if(!canvas || reduceMotion) return;
    const ctx=canvas.getContext('2d'); if(!ctx) return;
    let w=0,h=0,dpr=1,particles=[],raf=0,visible=true;
    const resize=()=>{
      const r=canvas.getBoundingClientRect(); w=r.width;h=r.height;dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);
      const n=Math.max(28,Math.min(78,Math.floor(w*h/21000)));
      particles=Array.from({length:n},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.18,vy:(Math.random()-.5)*.18,r:Math.random()*1.5+.4,a:Math.random()*.55+.15}));
    };
    const draw=()=>{
      if(!visible){raf=requestAnimationFrame(draw);return;}
      ctx.clearRect(0,0,w,h);
      for(let i=0;i<particles.length;i++){
        const p=particles[i];p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;
        ctx.beginPath();ctx.fillStyle=`rgba(255,231,235,${p.a})`;ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
        for(let j=i+1;j<particles.length;j++){
          const q=particles[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);
          if(d<105){ctx.beginPath();ctx.strokeStyle=`rgba(211,18,54,${(1-d/105)*.11})`;ctx.lineWidth=.6;ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
        }
      }
      raf=requestAnimationFrame(draw);
    };
    new ResizeObserver(resize).observe(canvas);resize();draw();
    if('IntersectionObserver' in window) new IntersectionObserver(([e])=>visible=e.isIntersecting,{threshold:0}).observe(canvas);
    addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
