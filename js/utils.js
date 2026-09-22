export function uuid() { return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9); }
export function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function formatDate(iso) { if (!iso) return ""; const p = iso.split("-"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : iso; }
export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const raw = String(value ?? '').trim().replace(/\s/g, '');
  if (!raw) return null;
  // Inputs are deliberately text fields: Chromium otherwise treats a comma as
  // invalid and silently turns 1250,50 into 125050 in some locales.
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  if (!/^\d+(\.\d*)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export function clampVat(value) { const n = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; }
export function formatPrice(n) { const num = Number(n) || 0; const fixed = (num % 1 === 0 ? num.toFixed(0) : num.toFixed(2)); const [i,d]=fixed.split('.'); const s=i.replace(/\B(?=(\d{3})+(?!\d))/g,'.'); return d?`${s},${d}`:s; }
export function calcLineaTotal(l) { return (l.items || []).reduce((sum,it)=>sum+(parseAmount(it.precio) || 0),0); }
export function calcSubtotal(p) { return (p.lineas || []).reduce((sum,l)=>sum+calcLineaTotal(l),0); }
export function calcTotal(p) { const sub=calcSubtotal(p); const iva=clampVat(p.ivaPorcentaje); return (p.ivaActivo && iva) ? sub*(1+iva/100):sub; }
export function escapeHtml(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;");}
export function setPath(obj,path,value){const parts=path.split('.');let cur=obj;for(let i=0;i<parts.length-1;i++){if(!cur[parts[i]]||typeof cur[parts[i]]!=="object")cur[parts[i]]={};cur=cur[parts[i]];}cur[parts[parts.length-1]]=value;}
