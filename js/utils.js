export function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9); }
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function formatDate(iso) { if (!iso) return ""; const p = iso.split("-"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : iso; }
export function formatPrice(n) { const num = Number(n) || 0; const fixed = (num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)); const [i,d]=fixed.split('.'); const s=i.replace(/\B(?=(\d{3})+(?!\d))/g,'.'); return d?`${s},${d}`:s; }
export function calcSubtotal(p) { return (p.lineas || []).reduce((sum,l)=>sum+(parseFloat(l.precio)||0),0); }
export function calcTotal(p) { const sub=calcSubtotal(p); return (p.ivaActivo&&p.ivaPorcentaje)? sub*(1+p.ivaPorcentaje/100):sub; }
export function escapeHtml(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;");}
export function setPath(obj,path,value){const parts=path.split('.');let cur=obj;for(let i=0;i<parts.length-1;i++){if(!cur[parts[i]]||typeof cur[parts[i]]!=="object")cur[parts[i]]={};cur=cur[parts[i]];}cur[parts[parts.length-1]]=value;}
