(() => {
  const api = window.AlJariri;
  if(!api) return;
  const form = document.querySelector('[data-checkout-form]');
  const linesTarget = document.querySelector('[data-checkout-lines]');
  const totalTarget = document.querySelector('[data-checkout-total]');
  const status = document.querySelector('[data-checkout-status]');
  const submit = document.querySelector('[data-checkout-submit]');

  function render(){
    const lines = api.lines();
    if(!lines.length){
      linesTarget.innerHTML = '<p>Il carrello è vuoto.</p>';
      totalTarget.textContent = api.euro(0);
      submit.disabled = true;
      return;
    }
    linesTarget.innerHTML = lines.map(({product:p, qty}) => `<div class="order-line"><div class="order-thumb ${p.accent}" style="background:var(--${p.accent})">${p.glyph}</div><div><strong>${p.name}</strong><small>${api.euro(p.price)} × ${qty}</small></div><strong>${api.euro(p.price*qty)}</strong></div>`).join('');
    totalTarget.textContent = api.euro(api.total());
  }

  function show(message, kind=''){ status.hidden = false; status.className = `status-box ${kind}`; status.textContent = message; }

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const cart = api.lines().map(({product, qty}) => ({id:product.id, qty}));
    if(!cart.length) return show('Il carrello è vuoto.', 'error');
    const fd = new FormData(form);
    const payload = {
      provider: fd.get('provider'),
      customer: {
        givenName: String(fd.get('givenName')||'').trim(),
        familyName: String(fd.get('familyName')||'').trim(),
        email: String(fd.get('email')||'').trim(),
        phone: String(fd.get('phone')||'').trim(),
        address1: String(fd.get('address1')||'').trim(),
        city: String(fd.get('city')||'').trim(),
        postalCode: String(fd.get('postalCode')||'').trim(),
        country: String(fd.get('country')||'IT').trim(),
        notes: String(fd.get('notes')||'').trim()
      },
      cart
    };
    submit.disabled = true; submit.textContent = 'Apro il pagamento…'; show('Sto creando un ordine sicuro. I prezzi vengono ricalcolati dal server.', '');
    try{
      const apiBase = String(window.ALJ_API_BASE || '').replace(/\/$/,'');
      if(!apiBase && location.hostname.endsWith('github.io')) throw new Error('Checkout live non ancora collegato: GitHub Pages ospita il frontend, mentre i pagamenti richiedono il backend sicuro.');
      const res = await fetch(`${apiBase}/api/checkout`, {method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body:JSON.stringify(payload)});
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || 'Impossibile iniziare il pagamento.');
      if(!data.redirectUrl) throw new Error('Il provider non ha restituito una pagina di pagamento.');
      location.href = data.redirectUrl;
    }catch(err){
      show(err.message || 'Errore nel checkout.', 'error');
      submit.disabled = false; submit.textContent = 'Vai al pagamento ↗';
    }
  });
  render();
})();
