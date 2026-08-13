(() => {
  const root = document.querySelector('[data-payment-result]');
  if(!root) return;
  const params = new URLSearchParams(location.search);
  const order = params.get('order');
  const provider = params.get('provider');
  const state = params.get('state') || document.body.dataset.state || 'success';
  if(state === 'success'){
    try{ window.AlJariri?.clear(); }catch{}
    root.innerHTML = `<div class="success-icon">✓</div><span class="eyebrow">Pagamento completato</span><h1>Ordine ricevuto.</h1><p>${provider ? `Pagamento tramite ${provider}. ` : ''}${order ? `Riferimento ordine: ${order}. ` : ''}Riceverai le istruzioni per il corso o il servizio ai recapiti inseriti durante l'acquisto.</p><div class="hero-actions" style="justify-content:center"><a class="btn btn-dark" href="index.html">Torna alla home</a><a class="btn btn-light" href="contatti.html">Contattaci</a></div>`;
  }
})();
