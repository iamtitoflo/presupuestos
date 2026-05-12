import { calcSubtotal, calcTotal, formatDate, formatPrice } from './utils.js';

export async function generatePDF(p, state) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Colors
  const ORANGE = '#DD7B5C';
  const DARK = '#1E1E1E';
  const GRAY = '#6B6B6B';
  const WHITE = '#FFFFFF';
  const OR_RGB = [221, 123, 92];

  // Layout
  const M = 14;           // margin
  const PW = 210 - M * 2; // 182mm
  const DESC_W = 142;     // description column
  const PRICE_W = PW - DESC_W; // 40mm
  const PRICE_X = M + DESC_W;
  const RIGHT_X = M + PW;
  const LH = 5.5;  // line height mm
  const PAD = 4.5; // cell vertical padding

  let y = 14;

  // ── TITLE ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(ORANGE);
  doc.text('PRESUPUESTO', RIGHT_X, 24, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GRAY);
  doc.text(`Nº ${String(p.numero || 0).padStart(3, '0')}`, RIGHT_X, 31, { align: 'right' });

  // ── EMISOR INFO ────────────────────────────────────────────────────────────
  const emisor = state.settings.emisor || {};
  let ey = 18;
  doc.setFontSize(10);

  function infoLine(label, value) {
    doc.setTextColor(ORANGE);
    doc.setFont('helvetica', 'bold');
    doc.text(label + ': ', M, ey);
    doc.setTextColor(DARK);
    doc.setFont('helvetica', 'normal');
    doc.text(value, M + doc.getTextWidth(label + ': '), ey);
    ey += 5.5;
  }

  if (emisor.nombre) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(DARK);
    doc.text(emisor.nombre, M, ey);
    ey += 6;
  }
  doc.setFont('helvetica', 'normal');
  if (emisor.nif) infoLine('NIF', emisor.nif);
  if (emisor.telefono) infoLine('Tel', emisor.telefono);
  if (emisor.email) infoLine('Email', emisor.email);
  if (emisor.direccion) {
    doc.setTextColor(DARK);
    doc.text(emisor.direccion, M, ey);
    ey += 5.5;
  }
  const cpLoc = [emisor.cp, emisor.localidad].filter(Boolean).join('  ');
  if (cpLoc) {
    doc.setTextColor(DARK);
    doc.text(cpLoc, M, ey);
    ey += 5.5;
  }

  // ── SEPARATOR ─────────────────────────────────────────────────────────────
  y = Math.max(ey + 4, 40);
  doc.setDrawColor(...OR_RGB);
  doc.setLineWidth(0.4);
  doc.line(M, y, RIGHT_X, y);
  y += 8;

  // ── CLIENT INFO ───────────────────────────────────────────────────────────
  const cliente = p.cliente || {};
  doc.setFontSize(10);

  function labelValue(label, value, xl, vOffset, yy) {
    doc.setTextColor(ORANGE);
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', xl, yy);
    doc.setTextColor(DARK);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '', xl + vOffset, yy);
  }

  // Row 1: Nombre + Fecha
  labelValue('Nombre', cliente.nombre || '', M, 20, y);
  labelValue('Fecha', formatDate(p.fecha), 130, 13, y);
  y += 7;

  // Row 2: Dirección (full width)
  if (cliente.direccion) {
    labelValue('Dirección', cliente.direccion, M, 24, y);
    y += 7;
  }

  // Row 3: Localidad + DNI
  if (cliente.localidad || cliente.dni) {
    if (cliente.localidad) labelValue('Localidad', cliente.localidad, M, 22, y);
    if (cliente.dni) labelValue('DNI', cliente.dni, 120, 12, y);
    y += 7;
  }

  y += 5;

  // ── TABLE ─────────────────────────────────────────────────────────────────
  function drawHeader(yy) {
    doc.setFillColor(...OR_RGB);
    doc.rect(M, yy, PW, 10, 'F');
    doc.setTextColor(WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DESCRIPCIÓN', M + 4, yy + 6.5);
    doc.text('PRECIO', RIGHT_X - 4, yy + 6.5, { align: 'right' });
    return yy + 10;
  }

  y = drawHeader(y);

  const lineas = (p.lineas || []).filter(l =>
    (l.titulo || '').trim() || (l.descripcion || '').trim()
  );

  lineas.forEach(l => {
    const titulo = (l.titulo || '').trim();
    const desc = (l.descripcion || '').trim();
    const precio = parseFloat(l.precio) || 0;
    const maxW = DESC_W - 8;

    // Build bullet lines from description (each newline → bullet)
    const bulletLines = [];
    if (desc) {
      desc.split('\n').filter(s => s.trim()).forEach(raw => {
        const trimmed = raw.trim();
        const bullet = trimmed.startsWith('•') || trimmed.startsWith('-') ? trimmed : `• ${trimmed}`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.splitTextToSize(bullet, maxW).forEach(line => bulletLines.push(line));
      });
    }

    const rowH = Math.max(
      PAD + (titulo ? LH + 1 : 0) + bulletLines.length * LH + PAD,
      titulo && !bulletLines.length ? 14 : 12
    );

    // Page break check
    if (y + rowH > 282) {
      doc.addPage();
      y = 14;
      y = drawHeader(y);
    }

    // Cell borders
    doc.setDrawColor(...OR_RGB);
    doc.setLineWidth(0.2);
    doc.rect(M, y, PW, rowH);
    doc.line(PRICE_X, y, PRICE_X, y + rowH);

    let cy = y + PAD + LH;

    if (titulo) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(DARK);
      doc.text(titulo, M + 4, cy);
      cy += LH + 1;
    }

    if (bulletLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(DARK);
      doc.text(bulletLines, M + 4, cy);
    }

    // Price right-aligned, centered vertically in price column
    if (precio > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(DARK);
      doc.text(`${formatPrice(precio)}€`, RIGHT_X - 4, y + rowH / 2 + 1.5, { align: 'right' });
    }

    y += rowH;
  });

  // ── TOTAL ROW ─────────────────────────────────────────────────────────────
  if (y + 14 > 282) { doc.addPage(); y = 14; }
  y += 4;

  doc.setDrawColor(...OR_RGB);
  doc.setLineWidth(0.6);
  doc.rect(M, y, PW, 13);
  doc.line(PRICE_X, y, PRICE_X, y + 13);

  doc.setTextColor(ORANGE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL', M + 4, y + 8.5);

  doc.setTextColor(DARK);
  doc.text(`${formatPrice(calcTotal(p))}€`, RIGHT_X - 4, y + 8.5, { align: 'right' });

  if (p.ivaActivo && p.ivaPorcentaje) {
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(GRAY);
    doc.text(
      `Base imponible: ${formatPrice(calcSubtotal(p))}€  +  IVA ${p.ivaPorcentaje}%  =  ${formatPrice(calcTotal(p))}€`,
      RIGHT_X, y, { align: 'right' }
    );
    y += 10;
  } else {
    y += 18;
  }

  // ── NOTAS ─────────────────────────────────────────────────────────────────
  if (p.notas && p.notas.trim()) {
    if (y + 30 > 282) { doc.addPage(); y = 14; }

    doc.setTextColor(ORANGE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('NOTAS', M, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(DARK);

    p.notas.split('\n').forEach(line => {
      if (!line.trim()) { y += 3; return; }
      const wrapped = doc.splitTextToSize(line, PW);
      if (y + wrapped.length * LH > 282) { doc.addPage(); y = 14; }
      doc.text(wrapped, M, y);
      y += wrapped.length * LH + 1.5;
    });
  }

  // ── VALIDEZ ───────────────────────────────────────────────────────────────
  if (p.validez) {
    y += 4;
    if (y + 8 > 282) { doc.addPage(); y = 14; }
    doc.setFontSize(9);
    doc.setTextColor(GRAY);
    doc.setFont('helvetica', 'italic');
    doc.text(`Este presupuesto tiene una validez de ${p.validez} días a partir de la fecha indicada.`, M, y);
    y += 8;
  }

  // ── SHARE / SAVE ──────────────────────────────────────────────────────────
  const clientSlug = (cliente.nombre || '').replace(/[^a-zA-ZÀ-ÿ0-9 ]/g, '').trim().replace(/\s+/g, '_').slice(0, 30);
  const fileName = `Presupuesto_${String(p.numero || 0).padStart(3, '0')}${clientSlug ? '_' + clientSlug : ''}.pdf`;

  if (navigator.share && navigator.canShare) {
    const blob = doc.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
        return;
      } catch (e) {
        if (e && e.name !== 'AbortError') console.error(e);
      }
    }
  }
  doc.save(fileName);
}
