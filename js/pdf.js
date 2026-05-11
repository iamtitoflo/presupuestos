import { calcSubtotal, calcTotal, formatDate, formatPrice } from './utils.js';
/** Genera y descarga un PDF para un presupuesto. @param {any} p @param {any} state */
export async function generatePDF(p, state) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFontSize(20); doc.text('PRESUPUESTO', 20, 20);
  doc.setFontSize(11); doc.text(`Nº ${String(p.numero||0).padStart(3,'0')} · ${formatDate(p.fecha)}`,20,30);
  doc.text(`DNI: ${(p.cliente&&p.cliente.dni)||''}`,20,38);
  doc.text(`Cliente: ${(p.cliente&&p.cliente.nombre)||''}`,20,46);
  doc.text('Precio',190,54,{align:'right'});
  let y=62; (p.lineas||[]).forEach((l,i)=>{ doc.text(`${i+1}. ${(l.descripcion||'')}`,20,y); doc.text(`${formatPrice(l.precio||0)}€`,190,y,{align:'right'}); y+=8; });
  const sub=calcSubtotal(p), total=calcTotal(p); doc.text(`Subtotal: ${formatPrice(sub)}€`,190,y+10,{align:'right'}); doc.text(`Total: ${formatPrice(total)}€`,190,y+18,{align:'right'});
  if (p.notas) { doc.addPage(); doc.text('NOTAS',20,20); doc.text(doc.splitTextToSize(p.notas,170),20,30); }
  const fileName = `Presupuesto_${String(p.numero||0).padStart(3,'0')}.pdf`;
  if(navigator.share && navigator.canShare){
    const blob = doc.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if(navigator.canShare({ files:[file] })){
      try{ await navigator.share({ files:[file], title:fileName }); return; }
      catch(e){ if(e && e.name!=='AbortError') console.error(e); }
    }
  }
  doc.save(fileName);
}
