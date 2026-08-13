import {randomUUID} from 'node:crypto';

const money = n => Number(n).toFixed(2);
const cents = n => Math.round(Number(n) * 100);
const basic = (u,p) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;
async function jsonFetch(url, options={}){
  const res = await fetch(url, options);
  const text = await res.text();
  let data={}; try{data=JSON.parse(text)}catch{data={raw:text}}
  if(!res.ok) throw new Error(data?.message || data?.error_description || data?.error?.message || data?.error_code || `${res.status} ${res.statusText}`);
  return data;
}

export async function createStripeCheckout(order, products, baseUrl){
  const key = process.env.STRIPE_SECRET_KEY; if(!key) throw new Error('Stripe non configurato: manca STRIPE_SECRET_KEY.');
  const form = new URLSearchParams();
  form.set('mode','payment');
  form.set('success_url', `${baseUrl}/api/return/stripe?order=${encodeURIComponent(order.ref)}&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${baseUrl}/annullato.html?provider=Stripe&order=${encodeURIComponent(order.ref)}`);
  if(order.customer.email) form.set('customer_email', order.customer.email);
  form.set('client_reference_id', order.ref);
  form.set('metadata[order_ref]', order.ref);
  products.forEach((x,i)=>{
    form.set(`line_items[${i}][price_data][currency]`,'eur');
    form.set(`line_items[${i}][price_data][unit_amount]`, String(cents(x.product.price)));
    form.set(`line_items[${i}][price_data][product_data][name]`, x.product.name);
    form.set(`line_items[${i}][quantity]`, String(x.qty));
  });
  const data = await jsonFetch('https://api.stripe.com/v1/checkout/sessions', {method:'POST', headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/x-www-form-urlencoded'}, body:form});
  return {redirectUrl:data.url, providerId:data.id};
}

async function paypalToken(){
  const id=process.env.PAYPAL_CLIENT_ID, secret=process.env.PAYPAL_CLIENT_SECRET;
  if(!id||!secret) throw new Error('PayPal non configurato: mancano PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET.');
  const root = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
  const res = await jsonFetch(`${root}/v1/oauth2/token`, {method:'POST', headers:{Authorization:basic(id,secret),'Content-Type':'application/x-www-form-urlencoded'}, body:'grant_type=client_credentials'});
  return {token:res.access_token, root};
}
export async function createPayPalCheckout(order, products, baseUrl){
  const {token,root}=await paypalToken();
  const body={intent:'CAPTURE',payment_source:{paypal:{experience_context:{brand_name:'Al Jariri Language & Culture',locale:'it-IT',shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW',return_url:`${baseUrl}/api/return/paypal?order=${encodeURIComponent(order.ref)}`,cancel_url:`${baseUrl}/annullato.html?provider=PayPal&order=${encodeURIComponent(order.ref)}`}}},purchase_units:[{reference_id:order.ref,custom_id:order.ref,amount:{currency_code:'EUR',value:money(order.total),breakdown:{item_total:{currency_code:'EUR',value:money(order.total)}}},items:products.map(x=>({name:x.product.name,unit_amount:{currency_code:'EUR',value:money(x.product.price)},quantity:String(x.qty),category:'DIGITAL_GOODS',sku:x.product.id}))}]};
  const data=await jsonFetch(`${root}/v2/checkout/orders`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','PayPal-Request-Id':randomUUID(),'Prefer':'return=representation'},body:JSON.stringify(body)});
  const link=(data.links||[]).find(x=>x.rel==='payer-action'||x.rel==='approve');
  if(!link?.href) throw new Error('PayPal non ha restituito il link di approvazione.');
  return {redirectUrl:link.href, providerId:data.id};
}
export async function capturePayPal(orderId){
  const {token,root}=await paypalToken();
  return jsonFetch(`${root}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','PayPal-Request-Id':randomUUID()},body:'{}'});
}

export async function createScalapayCheckout(order, products, baseUrl){
  const key=process.env.SCALAPAY_API_KEY; if(!key) throw new Error('Scalapay non configurato: manca SCALAPAY_API_KEY.');
  const root=process.env.SCALAPAY_BASE_URL || 'https://integration.api.scalapay.com';
  const c=order.customer;
  const addr={name:`${c.givenName} ${c.familyName}`.trim(),line1:c.address1,suburb:c.city,postcode:c.postalCode,countryCode:c.country||'IT',phoneNumber:c.phone};
  const body={totalAmount:{amount:money(order.total),currency:'EUR'},consumer:{phoneNumber:c.phone,givenNames:c.givenName,surname:c.familyName,email:c.email},billing:addr,shipping:addr,items:products.map(x=>({sku:x.product.id,name:x.product.name,price:{amount:money(x.product.price),currency:'EUR'},category:'EDUCATION SERVICES',quantity:x.qty})),merchant:{redirectConfirmUrl:`${baseUrl}/api/return/scalapay?order=${encodeURIComponent(order.ref)}`,redirectCancelUrl:`${baseUrl}/annullato.html?provider=Scalapay&order=${encodeURIComponent(order.ref)}`},merchantReference:order.ref,shippingAmount:{amount:'0.00',currency:'EUR'},taxAmount:{amount:'0.00',currency:'EUR'},type:'online',product:process.env.SCALAPAY_PRODUCT||'pay-in-3'};
  const data=await jsonFetch(`${root}/v2/orders`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(body)});
  if(!data.checkoutUrl) throw new Error('Scalapay non ha restituito checkoutUrl.');
  return {redirectUrl:data.checkoutUrl,providerId:data.token,meta:{scalapayToken:data.token}};
}
export async function captureScalapay(token){
  const key=process.env.SCALAPAY_API_KEY; if(!key) throw new Error('Scalapay non configurato.');
  const root=process.env.SCALAPAY_BASE_URL || 'https://integration.api.scalapay.com';
  return jsonFetch(`${root}/v2/payments/capture`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({token})});
}

function klarnaAuth(){
  const u=process.env.KLARNA_USERNAME,p=process.env.KLARNA_PASSWORD;if(!u||!p) throw new Error('Klarna non configurato: mancano KLARNA_USERNAME / KLARNA_PASSWORD.');
  return basic(u,p);
}
function klarnaLines(products){ return products.map(x=>({type:'digital',reference:x.product.id,name:x.product.name,quantity:x.qty,unit_price:cents(x.product.price),tax_rate:0,total_amount:cents(x.product.price*x.qty),total_tax_amount:0})); }
export async function createKlarnaCheckout(order, products, baseUrl){
  const root=process.env.KLARNA_BASE_URL||'https://api.playground.klarna.com'; const auth=klarnaAuth(); const lines=klarnaLines(products); const c=order.customer;
  const paymentBody={acquiring_channel:'ECOMMERCE',intent:'buy',purchase_country:c.country||'IT',purchase_currency:'EUR',locale:'it-IT',order_amount:cents(order.total),order_tax_amount:0,order_lines:lines};
  const kp=await jsonFetch(`${root}/payments/v1/sessions`,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(paymentBody)});
  const hppBody={payment_session_url:`${root}/payments/v1/sessions/${kp.session_id}`,merchant_urls:{success:`${baseUrl}/api/return/klarna?order=${encodeURIComponent(order.ref)}&authorization_token={{authorization_token}}&sid={{session_id}}`,cancel:`${baseUrl}/annullato.html?provider=Klarna&order=${encodeURIComponent(order.ref)}`,back:`${baseUrl}/checkout.html`,failure:`${baseUrl}/annullato.html?provider=Klarna&order=${encodeURIComponent(order.ref)}&state=failure`,error:`${baseUrl}/annullato.html?provider=Klarna&order=${encodeURIComponent(order.ref)}&state=error`}};
  const hpp=await jsonFetch(`${root}/hpp/v1/sessions`,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json','Cache-Control':'no-cache'},body:JSON.stringify(hppBody)});
  if(!hpp.redirect_url) throw new Error('Klarna non ha restituito redirect_url.');
  return {redirectUrl:hpp.redirect_url,providerId:kp.session_id,meta:{klarnaHppSession:hpp.session_id,klarnaLines:lines}};
}
export async function placeKlarnaOrder(order, authorizationToken){
  const root=process.env.KLARNA_BASE_URL||'https://api.playground.klarna.com'; const auth=klarnaAuth(); const c=order.customer;
  const body={purchase_country:c.country||'IT',purchase_currency:'EUR',locale:'it-IT',order_amount:cents(order.total),order_tax_amount:0,order_lines:order.meta.klarnaLines||[],merchant_reference1:order.ref,auto_capture:true,billing_address:{given_name:c.givenName,family_name:c.familyName,email:c.email,phone:c.phone,street_address:c.address1,postal_code:c.postalCode,city:c.city,country:c.country||'IT'}};
  return jsonFetch(`${root}/payments/v1/authorizations/${encodeURIComponent(authorizationToken)}/order`,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(body)});
}

export async function createPayment(provider, order, products, baseUrl){
  if(provider==='stripe') return createStripeCheckout(order,products,baseUrl);
  if(provider==='paypal') return createPayPalCheckout(order,products,baseUrl);
  if(provider==='scalapay') return createScalapayCheckout(order,products,baseUrl);
  if(provider==='klarna') return createKlarnaCheckout(order,products,baseUrl);
  throw new Error('Metodo di pagamento non supportato.');
}

export async function retrieveStripeSession(sessionId){
  const key=process.env.STRIPE_SECRET_KEY; if(!key) throw new Error('Stripe non configurato.');
  return jsonFetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{headers:{Authorization:`Bearer ${key}`}});
}
