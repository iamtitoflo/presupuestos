import { calcSubtotal, calcTotal, escapeHtml, formatDate, formatPrice } from './utils.js';

const SVG_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const SVG_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
const SVG_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>';
const SVG_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

export function renderHome(state, search = '') {
  const list = state.presupuestos.slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const q = search.toLowerCase().trim();
  const filtered = !q ? list : list.filter(p =>
    ((p.cliente && p.cliente.nombre) || '').toLowerCase().includes(q) ||
    String(p.numero || '').includes(q)
  );

  const cards = filtered.length
    ? `<div class="card-list">${filtered.map(p => `
        <div class="card" data-open="${p.id}">
          <div class="card-num">Nº ${String(p.numero).padStart(3, '0')}</div>
          <div class="card-main">
            <div class="card-title">${escapeHtml((p.cliente && p.cliente.nombre) || '(Sin nombre)')}</div>
            <div class="card-meta">${escapeHtml(formatDate(p.fecha))}${(p.cliente && p.cliente.localidad) ? ' · ' + escapeHtml(p.cliente.localidad) : ''}</div>
          </div>
          <div class="card-amount">${formatPrice(calcTotal(p))}€</div>
        </div>`).join('')}
      </div>`
    : q
      ? `<div class="empty-state"><div class="icon">🔍</div><p>Sin resultados para "<strong>${escapeHtml(q)}</strong>"</p></div>`
      : `<div class="empty-state"><div class="icon">📋</div><p><strong>Aún no hay presupuestos</strong></p><p>Pulsa el botón para crear el primero</p></div>`;

  return `
    <header class="header">
      <h1>Presupuestos</h1>
      <button class="icon-btn" data-action="settings" title="Ajustes">⚙️</button>
    </header>
    <main class="content">
      ${list.length ? `<div class="search-box">${SVG_SEARCH}<input type="search" data-search value="${escapeHtml(search)}" placeholder="Buscar cliente o número..."/></div>` : ''}
      ${cards}
    </main>
    <footer class="bottom-bar">
      <button class="btn btn-primary" data-action="new">
        <span style="font-size:20px;line-height:1;margin-right:2px">+</span> Nuevo presupuesto
      </button>
    </footer>`;
}

export function renderEditor(state, draft) {
  const subtotal = calcSubtotal(draft);
  const total = calcTotal(draft);
  const isNew = !state.presupuestos.find(x => x.id === draft.id);

  const lineas = (draft.lineas || []).map((l, i) => `
    <div class="line-item">
      <div class="line-item-header">
        <span class="num">${i + 1}</span>
        <span style="color:var(--text-muted);font-size:13px">Concepto ${i + 1}</span>
        <span class="spacer"></span>
        ${draft.lineas.length > 1 ? `<button class="line-remove" title="Eliminar" data-remove-line="${i}">${SVG_TRASH}</button>` : ''}
      </div>
      <div class="field">
        <label>Título <span class="label-optional">(opcional, negrita en el PDF)</span></label>
        <input class="input" type="text" data-line-field="titulo" data-idx="${i}"
          placeholder="Ej: MANO DE OBRA, MATERIALES…"
          value="${escapeHtml(l.titulo || '')}"/>
      </div>
      <div class="field">
        <label>Descripción</label>
        <textarea class="textarea" data-line-field="descripcion" data-idx="${i}"
          placeholder="Cada línea aparecerá como un punto (•) en el PDF.">${escapeHtml(l.descripcion || '')}</textarea>
      </div>
      <div class="field">
        <label>Precio</label>
        <div class="price-input">
          <input class="input" type="number" inputmode="decimal" data-line-field="precio" data-idx="${i}"
            value="${l.precio ?? ''}" placeholder="0"/>
        </div>
      </div>
    </div>`).join('');

  return `
    <header class="header">
      <button class="icon-btn" data-action="back">${SVG_BACK}</button>
      <h1>${isNew ? 'Nuevo presupuesto' : 'Presupuesto Nº ' + String(draft.numero).padStart(3, '0')}</h1>
      ${!isNew ? `
        <button class="icon-btn" data-action="duplicate" title="Duplicar presupuesto">${SVG_COPY}</button>
        <button class="icon-btn" data-action="delete" title="Eliminar presupuesto" style="color:#B33">${SVG_TRASH}</button>
      ` : ''}
    </header>
    <main class="content">

      <section class="section">
        <div class="section-header">Datos del presupuesto</div>
        <div class="section-body">
          <div class="row">
            <div class="field field-num">
              <label>Número</label>
              <input class="input" type="number" inputmode="numeric" data-field="numero"
                value="${escapeHtml(String(draft.numero || ''))}"/>
            </div>
            <div class="field">
              <label>Fecha</label>
              <input class="input" type="date" data-field="fecha" value="${escapeHtml(draft.fecha || '')}"/>
            </div>
            <div class="field field-validez">
              <label>Validez (días)</label>
              <input class="input" type="number" inputmode="numeric" data-field="validez"
                value="${escapeHtml(String(draft.validez ?? 30))}" min="1"/>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">Datos del cliente</div>
        <div class="section-body">
          <div class="field">
            <label>Nombre</label>
            <input class="input" data-field="cliente.nombre" placeholder="Nombre completo"
              value="${escapeHtml((draft.cliente && draft.cliente.nombre) || '')}"/>
          </div>
          <div class="field">
            <label>Dirección</label>
            <input class="input" data-field="cliente.direccion" placeholder="Calle, número…"
              value="${escapeHtml((draft.cliente && draft.cliente.direccion) || '')}"/>
          </div>
          <div class="row">
            <div class="field">
              <label>Localidad</label>
              <input class="input" data-field="cliente.localidad" placeholder="Pueblo / Ciudad"
                value="${escapeHtml((draft.cliente && draft.cliente.localidad) || '')}"/>
            </div>
            <div class="field field-dni">
              <label>DNI</label>
              <input class="input" data-field="cliente.dni" placeholder="12345678A"
                value="${escapeHtml((draft.cliente && draft.cliente.dni) || '')}"/>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">Conceptos</div>
        <div class="section-body">
          ${lineas}
          <button class="add-line-btn" data-action="add-line">
            <span style="font-size:18px;line-height:1">+</span> Añadir concepto
          </button>
        </div>
      </section>

      <div class="total-card">
        <div>
          <div class="label">TOTAL</div>
          ${draft.ivaActivo ? `<div style="font-size:12px;opacity:0.85">Base ${formatPrice(subtotal)}€ + IVA ${draft.ivaPorcentaje}%</div>` : ''}
        </div>
        <div class="amount">${formatPrice(total)}€</div>
      </div>

      <section class="section">
        <div class="section-header">Notas y condiciones de pago</div>
        <div class="section-body">
          <textarea class="textarea" data-field="notas" style="min-height:160px"
            placeholder="Forma de pago, observaciones…">${escapeHtml(draft.notas || '')}</textarea>
          <div class="toggle-row" style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
            <div class="label-text">
              IVA
              <small>¿Añadir IVA a este presupuesto?</small>
            </div>
            <div class="toggle${draft.ivaActivo ? ' on' : ''}" data-toggle="iva"></div>
          </div>
          <div id="iva-pct-row" class="field${draft.ivaActivo ? '' : ' hidden'}" style="margin-top:8px">
            <label>Porcentaje de IVA (%)</label>
            <input class="input" type="number" inputmode="decimal" data-field="ivaPorcentaje"
              value="${draft.ivaPorcentaje || 21}" min="0" max="100"/>
          </div>
        </div>
      </section>

    </main>
    <footer class="bottom-bar">
      <button class="btn btn-secondary" data-action="save">💾 Guardar</button>
      <button class="btn btn-primary" data-action="pdf">📄 PDF</button>
    </footer>`;
}

export function renderSettings(state) {
  const s = state.settings;
  const e = s.emisor || {};
  const count = state.presupuestos.length;
  return `
    <header class="header">
      <button class="icon-btn" data-action="back">${SVG_BACK}</button>
      <h1>Ajustes</h1>
    </header>
    <main class="content">
      <section class="section">
        <div class="section-header">Tu empresa / Tus datos</div>
        <div class="section-body">
          <div class="field">
            <label>Nombre o empresa <span class="label-optional">(aparece en el PDF)</span></label>
            <input class="input" data-setting="emisor.nombre" placeholder="Tu nombre o empresa"
              value="${escapeHtml(e.nombre || '')}"/>
          </div>
          <div class="row">
            <div class="field">
              <label>NIF / CIF</label>
              <input class="input" data-setting="emisor.nif" placeholder="12345678A"
                value="${escapeHtml(e.nif || '')}"/>
            </div>
            <div class="field">
              <label>Teléfono</label>
              <input class="input" type="tel" inputmode="tel" data-setting="emisor.telefono"
                value="${escapeHtml(e.telefono || '')}"/>
            </div>
          </div>
          <div class="field">
            <label>Email <span class="label-optional">(opcional)</span></label>
            <input class="input" type="email" inputmode="email" data-setting="emisor.email"
              placeholder="correo@ejemplo.com"
              value="${escapeHtml(e.email || '')}"/>
          </div>
          <div class="field">
            <label>Dirección</label>
            <input class="input" data-setting="emisor.direccion"
              value="${escapeHtml(e.direccion || '')}"/>
          </div>
          <div class="row">
            <div class="field field-cp">
              <label>CP</label>
              <input class="input" inputmode="numeric" data-setting="emisor.cp"
                value="${escapeHtml(e.cp || '')}"/>
            </div>
            <div class="field">
              <label>Localidad</label>
              <input class="input" data-setting="emisor.localidad"
                value="${escapeHtml(e.localidad || '')}"/>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">IVA por defecto</div>
        <div class="section-body">
          <div class="field">
            <label>Validez por defecto (días)</label>
            <input class="input" type="number" inputmode="numeric" data-setting="validezDefecto"
              value="${s.validezDefecto || 30}" min="1"/>
          </div>
          <div class="toggle-row">
            <div class="label-text">
              Aplicar IVA
              <small>Los nuevos presupuestos tendrán IVA activado</small>
            </div>
            <div class="toggle${s.ivaActivo ? ' on' : ''}" data-toggle="iva-setting"></div>
          </div>
          <input type="hidden" id="ivaActivoHidden" data-setting="ivaActivo" value="${s.ivaActivo ? 'true' : 'false'}">
          <div id="settings-iva-pct" class="field${s.ivaActivo ? '' : ' hidden'}" style="margin-top:8px">
            <label>Porcentaje de IVA (%)</label>
            <input class="input" type="number" inputmode="decimal" data-setting="ivaPorcentaje"
              value="${s.ivaPorcentaje || 21}" min="0" max="100"/>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">Notas por defecto</div>
        <div class="section-body">
          <p class="settings-hint">Se añaden automáticamente a cada nuevo presupuesto.</p>
          <textarea class="textarea" data-setting="notasDefecto" style="min-height:130px">${escapeHtml(s.notasDefecto || '')}</textarea>
        </div>
      </section>

      <section class="section">
        <div class="section-header">Datos guardados</div>
        <div class="section-body">
          <p class="settings-hint">${count === 0
            ? 'No hay presupuestos guardados.'
            : `${count} presupuesto${count !== 1 ? 's' : ''} guardado${count !== 1 ? 's' : ''}.`}</p>
        </div>
      </section>

      <section class="section">
        <div class="section-header">Copia de seguridad</div>
        <div class="section-body">
          <button class="btn btn-secondary" data-action="export" style="margin-bottom:8px">📤 Exportar datos</button>
          <button class="btn btn-secondary" data-action="import">📥 Importar datos</button>
        </div>
      </section>

      <div class="danger-zone">
        <button class="btn btn-danger" data-action="reset">🗑️ Borrar TODOS los presupuestos</button>
      </div>
    </main>
    <footer class="bottom-bar">
      <button class="btn btn-primary" data-action="save-settings">✅ Guardar ajustes</button>
    </footer>`;
}
