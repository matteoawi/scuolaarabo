import {readFile, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const FILE = new URL('./data/orders.json', import.meta.url);

async function all(){
  try { return JSON.parse(await readFile(FILE, 'utf8')); } catch { return []; }
}
async function persist(rows){ await writeFile(FILE, JSON.stringify(rows, null, 2)); }
export async function createOrder({provider, customer, cart, total}){
  const rows = await all();
  const order = {ref:`AJ-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${randomUUID().slice(0,8).toUpperCase()}`, provider, customer, cart, total, currency:'EUR', status:'created', createdAt:new Date().toISOString(), providerId:null, meta:{}};
  rows.unshift(order); await persist(rows); return order;
}
export async function updateOrder(ref, patch){
  const rows = await all(); const i = rows.findIndex(x => x.ref === ref); if(i < 0) return null;
  rows[i] = {...rows[i], ...patch, updatedAt:new Date().toISOString()}; await persist(rows); return rows[i];
}
export async function getOrder(ref){ return (await all()).find(x => x.ref === ref) || null; }
export async function findByProviderId(providerId){ return (await all()).find(x => x.providerId === providerId) || null; }
