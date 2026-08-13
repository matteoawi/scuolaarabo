import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PRODUCTS, byId} from './catalog.mjs';
import {createOrder, updateOrder, getOrder} from './orders.mjs';
import {createPayment, capturePayPal, captureScalapay, placeKlarnaOrder, retrieveStripeSession} from './payments.mjs';
import {getGoogleReviews} from './reviews.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const BASE = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/,'');
const FRONTEND = (process.env.FRONTEND_BASE_URL || BASE).replace(/\/$/,'');
const ALLOWED_ORIGINS = new Set(String(process.env.CORS_ORIGINS || FRONTEND).split(',').map(x=>x.trim()).filter(Boolean).map(x=>{try{return new URL(x).origin}catch{return x}}));
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const SECURITY_HEADERS={'X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
const cleanMap={'/':'index.html','/home':'index.html','/shop':'shop.html','/corsi':'corsi.html','/traduzioni':'traduzioni.html','/chi-siamo':'chi-siamo.html','/recensioni':'recensioni.html','/contatti':'contatti.html','/checkout':'checkout.html'};

function send(res,status,body,type='application/json; charset=utf-8'){ res.writeHead(status,{...SECURITY_HEADERS,'Content-Type':type,'Cache-Control':'no-store'}); res.end(typeof body==='string'?body:JSON.stringify(body)); }
function redirect(res,url,status=302){res.writeHead(status,{...SECURITY_HEADERS,Location:url,'Cache-Control':'no-store'});res.end();}
async function readJson(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1e6)throw new Error('Payload troppo grande');}return raw?JSON.parse(raw):{};}
function safeCustomer(c={}){
  const out={givenName:String(c.givenName||'').trim(),familyName:String(c.familyName||'').trim(),email:String(c.email||'').trim(),phone:String(c.phone||'').trim(),address1:String(c.address1||'').trim(),city:String(c.city||'').trim(),postalCode:String(c.postalCode||'').trim(),country:String(c.country||'IT').trim().toUpperCase(),notes:String(c.notes||'').trim().slice(0,1500)};
  if(!out.givenName||!out.familyName||!/^\S+@\S+\.\S+$/.test(out.email)||!out.phone||!out.address1||!out.city||!out.postalCode) throw new Error('Compila tutti i dati obbligatori del checkout.');
  return out;
}
function priceCart(cart=[]){
  if(!Array.isArray(cart)||!cart.length)throw new Error('Carrello vuoto.');
  const normalized=[];
  for(const line of cart){const p=byId(String(line.id));const qty=Math.max(1,Math.min(20,Number(line.qty)||1));if(!p)throw new Error('Nel carrello c’è un prodotto non valido.');normalized.push({product:p,qty});}
  const total=normalized.reduce((s,x)=>s+x.product.price*x.qty,0);return {normalized,total:Number(total.toFixed(2))};
}

async function api(req,res,url){
  if(req.method==='GET'&&url.pathname==='/api/catalog') return send(res,200,{products:PRODUCTS});
  if(req.method==='GET'&&url.pathname==='/api/health') return send(res,200,{ok:true,app:'aljariri-commerce',time:new Date().toISOString()});
  if(req.method==='GET'&&url.pathname==='/api/google-reviews'){
    try{return send(res,200,await getGoogleReviews());}catch(e){return send(res,502,{configured:true,averageRating:5,totalReviewCount:266,reviews:[],error:e.message});}
  }
  if(req.method==='POST'&&url.pathname==='/api/checkout'){
    try{
      const body=await readJson(req); const provider=String(body.provider||'').toLowerCase();
      if(!['stripe','paypal','klarna','scalapay'].includes(provider))throw new Error('Scegli un metodo di pagamento.');
      const customer=safeCustomer(body.customer); const {normalized,total}=priceCart(body.cart);
      const order=await createOrder({provider,customer,cart:normalized.map(x=>({id:x.product.id,qty:x.qty,unitPrice:x.product.price,name:x.product.name})),total});
      const payment=await createPayment(provider,order,normalized,BASE);
      await updateOrder(order.ref,{providerId:payment.providerId,meta:payment.meta||{},status:'payment_pending'});
      return send(res,200,{orderRef:order.ref,redirectUrl:payment.redirectUrl});
    }catch(e){return send(res,400,{error:e.message||'Errore checkout'});}
  }
  if(req.method==='GET'&&url.pathname==='/api/return/stripe'){
    const ref=url.searchParams.get('order'), sessionId=url.searchParams.get('session_id');
    try{const order=await getOrder(ref);if(!order||!sessionId)throw new Error('Ordine non trovato.');const session=await retrieveStripeSession(sessionId);if(session.payment_status!=='paid'&&session.status!=='complete')throw new Error('Pagamento Stripe non completato.');await updateOrder(ref,{status:'paid',providerId:sessionId,paidAt:new Date().toISOString(),meta:{...order.meta,stripePaymentStatus:session.payment_status}});return redirect(res,`${FRONTEND}/successo.html?provider=Stripe&order=${encodeURIComponent(ref)}`);}catch(e){return redirect(res,`${FRONTEND}/annullato.html?provider=Stripe&order=${encodeURIComponent(ref||'')}&reason=${encodeURIComponent(e.message)}`);}
  }
  if(req.method==='GET'&&url.pathname==='/api/return/paypal'){
    const ref=url.searchParams.get('order'), paypalId=url.searchParams.get('token');
    try{if(!ref||!paypalId)throw new Error('Ritorno PayPal incompleto.');const capture=await capturePayPal(paypalId);const ok=capture.status==='COMPLETED'||(capture.purchase_units||[]).some(u=>(u.payments?.captures||[]).some(c=>c.status==='COMPLETED'));if(!ok)throw new Error('PayPal non ha confermato il pagamento.');await updateOrder(ref,{status:'paid',providerId:paypalId,paidAt:new Date().toISOString(),meta:{paypalStatus:capture.status}});return redirect(res,`${FRONTEND}/successo.html?provider=PayPal&order=${encodeURIComponent(ref)}`);}catch(e){return redirect(res,`${FRONTEND}/annullato.html?provider=PayPal&order=${encodeURIComponent(ref||'')}&reason=${encodeURIComponent(e.message)}`);}
  }
  if(req.method==='GET'&&url.pathname==='/api/return/scalapay'){
    const ref=url.searchParams.get('order');
    try{const order=await getOrder(ref);if(!order?.meta?.scalapayToken)throw new Error('Token Scalapay non trovato.');const capture=await captureScalapay(order.meta.scalapayToken);await updateOrder(ref,{status:'paid',paidAt:new Date().toISOString(),meta:{...order.meta,scalapayCapture:capture}});return redirect(res,`${FRONTEND}/successo.html?provider=Scalapay&order=${encodeURIComponent(ref)}`);}catch(e){return redirect(res,`${FRONTEND}/annullato.html?provider=Scalapay&order=${encodeURIComponent(ref||'')}&reason=${encodeURIComponent(e.message)}`);}
  }
  if(req.method==='GET'&&url.pathname==='/api/return/klarna'){
    const ref=url.searchParams.get('order'), token=url.searchParams.get('authorization_token');
    try{const order=await getOrder(ref);if(!order||!token)throw new Error('Autorizzazione Klarna non trovata.');const placed=await placeKlarnaOrder(order,token);await updateOrder(ref,{status:'paid',providerId:placed.order_id||order.providerId,paidAt:new Date().toISOString(),meta:{...order.meta,klarnaOrderId:placed.order_id,klarnaFraudStatus:placed.fraud_status}});return redirect(res,`${FRONTEND}/successo.html?provider=Klarna&order=${encodeURIComponent(ref)}`);}catch(e){return redirect(res,`${FRONTEND}/annullato.html?provider=Klarna&order=${encodeURIComponent(ref||'')}&reason=${encodeURIComponent(e.message)}`);}
  }
  return false;
}

async function serveStatic(req,res,url){
  let rel=cleanMap[url.pathname] || decodeURIComponent(url.pathname).replace(/^\//,'');
  if(!rel) rel='index.html';
  const full=path.resolve(ROOT,rel); if(!full.startsWith(ROOT))return send(res,403,'Forbidden','text/plain');
  try{const s=await stat(full);if(!s.isFile())throw new Error();const body=await readFile(full);res.writeHead(200,{...SECURITY_HEADERS,'Content-Type':MIME[path.extname(full)]||'application/octet-stream','Cache-Control':path.extname(full)==='.html'?'no-cache':'public, max-age=3600'});res.end(body);}catch{send(res,404,'404 — pagina non trovata','text/plain; charset=utf-8');}
}

const server=http.createServer(async(req,res)=>{
  try{
    const origin=req.headers.origin;
    if(origin && ALLOWED_ORIGINS.has(origin)){
      res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Vary','Origin');
      res.setHeader('Access-Control-Allow-Headers','Content-Type, Accept');
      res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    }
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const url=new URL(req.url,BASE);if(url.pathname.startsWith('/api/')){const handled=await api(req,res,url);if(handled===false)return send(res,404,{error:'API route not found'});return;}await serveStatic(req,res,url);}catch(e){send(res,500,{error:'Errore interno',detail:process.env.NODE_ENV==='development'?e.message:undefined});}
});
server.listen(PORT,()=>console.log(`Al Jariri Commerce → ${BASE}`));
