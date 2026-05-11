import { calcSubtotal, calcTotal, formatDate, formatPrice } from './utils.js';
/** Genera y descarga un PDF para un presupuesto. @param {any} p @param {any} state */
export async function generatePDF(p, state) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const orange = '#DD7B5C';
  const m = 14;
  const full = 210 - m * 2;
  const rightX = m + full;
  doc.setTextColor(orange);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(17);
  doc.text('PRESUPUESTO', rightX, 22, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(30);
  const emisor = state.settings.emisor || {};
  doc.text(`Teléfono: ${emisor.telefono || ''}`, m, 40);
  doc.text(`Dirección: ${emisor.direccion || ''}`, m, 48);
  doc.text(`CP: ${emisor.cp || ''}`, m, 56);
  doc.text(`Nombre: ${(p.cliente && p.cliente.nombre) || ''}`, m, 72);
  doc.text(`Fecha: ${formatDate(p.fecha)}`, 120, 72);
  doc.text(`Dirección: ${(p.cliente && p.cliente.direccion) || ''}`, m, 80);
  doc.text(`${(p.cliente && p.cliente.localidad) || ''}`, 120, 80);

  let y = 95;
  doc.setFillColor(221, 123, 92);
  doc.rect(m, y, full, 9, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPCIÓN', m + 3, y + 6);
  doc.text('PRECIO', rightX - 8, y + 6, { align: 'right' });
  y += 9;
  doc.setDrawColor(221, 123, 92);
  doc.rect(m, y, full, 62);
  doc.line(rightX - 30, y, rightX - 30, y + 62);
  doc.setTextColor(20);
  doc.setFont('helvetica', 'normal');

  let ly = y + 8;
  (p.lineas || []).forEach((l) => {
    const desc = (l.descripcion || '').trim();
    if (!desc) return;
    const lines = doc.splitTextToSize(`• ${desc}`, full - 40);
    doc.text(lines, m + 5, ly);
    ly += lines.length * 6;
  });
  doc.setFontSize(12);
  doc.text(`${formatPrice(calcTotal(p))}€`, rightX - 6, y + 55, { align: 'right' });

  y += 78;
  doc.rect(110, y, full - 96, 12);
  doc.setTextColor(orange);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 122, y + 8);
  doc.setTextColor(20);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatPrice(calcTotal(p))}€`, rightX - 6, y + 8, { align: 'right' });

  if (p.notas) {
    const notes = doc.splitTextToSize(p.notas, full - 6);
    const needed = 18 + notes.length * 6;
    const remaining = 297 - (y + 18);
    if (needed > remaining) doc.addPage(), y = 16;
    else y += 26;
    doc.setTextColor(orange);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('NOTAS', m, y);
    doc.setTextColor(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(notes, m, y + 10);
  }
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
