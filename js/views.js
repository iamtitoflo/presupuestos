import { calcSubtotal, calcTotal, escapeHtml, formatDate, formatPrice } from './utils.js';

const SVG_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const SVG_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
const SVG_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>';

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
        <span>Partida ${i + 1}</span>
        <span class="spacer"></span>
        ${draft.lineas.length > 1 ? `<button class="line-remove" title="Eliminar partida" data-remove-line="${i}">${SVG_TRASH}</button>` : ''}
      </div>
      <div class="field">
        <label>Título <span class="label-optional">(opcional — aparece en negrita en el PDF)</span></label>
        <input class="input" type="text" data-line-field="titulo" data-idx="${i}"
          placeholder="Ej: PROMOTOR, MANO DE OBRA, MATERIALES…"
          value="${escapeHtml(l.titulo || '')}"/>
      </div>
      <div class="field">
        <label>Descripción del trabajo</label>
        <textarea class="textarea" data-line-field="descripcion" data-idx="${i}"
          placeholder="Describe el trabajo. Cada línea será un punto (•) en el PDF.">${escapeHtml(l.descripcion || '')}</textarea>
      </div>
      <div class="field">
        <label>Precio de esta partida</label>
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
    </header>
    <main class="content">
      <section class="section">
        <div class="section-header">Datos del cliente</div>
        <div class="section-body">
          <div class="row">
            <div class="field">
              <label>Nombre del cliente</label>
              <input class="input" data-field="cliente.nombre" placeholder="Nombre completo"
                value="${escapeHtml((draft.cliente && draft.cliente.nombre) || '')}"/>
            </div>
            <div class="field field-date">
              <label>Fecha</label>
              <input class="input" type="date" data-field="fecha" value="${escapeHtml(draft.fecha || '')}"/>
            </div>
          </div>
          <div class="row">
            <div class="field">
              <label>Dirección</label>
              <input class="input" data-field="cliente.direccion" placeholder="Calle, número…"
                value="${escapeHtml((draft.cliente && draft.cliente.direccion) || '')}"/>
            </div>
            <div class="field field-loc">
              <label>Localidad</label>
              <input class="input" data-field="cliente.localidad" placeholder="Pueblo / Ciudad"
                value="${escapeHtml((draft.cliente && draft.cliente.localidad) || '')}"/>
            </div>
          </div>
          <div class="field">
            <label>DNI del cliente</label>
            <input class="input" data-field="cliente.dni" placeholder="12345678A"
              value="${escapeHtml((draft.cliente && draft.cliente.dni) || '')}"/>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">Partidas del presupuesto</div>
        <div class="section-body">
          ${lineas}
          <button class="add-line-btn" data-action="add-line">
            <span style="font-size:18px;line-height:1">+</span> Añadir partida
          </button>
        </div>
      </section>

      <section class="section">
        <div class="section-header">Notas y condiciones de pago</div>
        <div class="section-body">
          <textarea class="textarea" data-field="notas" style="min-height:100px"
            placeholder="Forma de pago, observaciones…">${escapeHtml(draft.notas || '')}</textarea>
        </div>
      </section>

      <div class="total-card">
        <div>
          <div class="label">TOTAL</div>
          ${draft.ivaActivo ? `<div style="font-size:12px;opacity:0.85">Base ${formatPrice(subtotal)}€ + IVA ${draft.ivaPorcentaje}%</div>` : ''}
        </div>
        <div class="amount">${formatPrice(total)}€</div>
      </div>
    </main>
    <footer class="bottom-bar">
      <button class="btn btn-secondary" data-action="save">💾 Guardar</button>
      <button class="btn btn-primary" data-action="pdf">📄 Generar PDF</button>
    </footer>`;
}

export function renderSettings(state) {
  const s = state.settings;
  const e = s.emisor || {};
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
          <div class="field">
            <label>Teléfono</label>
            <input class="input" type="tel" inputmode="tel" data-setting="emisor.telefono"
              value="${escapeHtml(e.telefono || '')}"/>
          </div>
          <div class="row">
            <div class="field">
              <label>Dirección</label>
              <input class="input" data-setting="emisor.direccion"
                value="${escapeHtml(e.direccion || '')}"/>
            </div>
            <div class="field field-cp">
              <label>CP</label>
              <input class="input" inputmode="numeric" data-setting="emisor.cp"
                value="${escapeHtml(e.cp || '')}"/>
            </div>
          </div>
          <div class="field">
            <label>Localidad</label>
            <input class="input" data-setting="emisor.localidad"
              value="${escapeHtml(e.localidad || '')}"/>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">IVA</div>
        <div class="section-body">
          <div class="field">
            <label>¿Aplicar IVA a los presupuestos?</label>
            <select class="input" data-setting="ivaActivo">
              <option value="false" ${!s.ivaActivo ? 'selected' : ''}>No aplicar IVA</option>
              <option value="true" ${s.ivaActivo ? 'selected' : ''}>Sí, aplicar IVA</option>
            </select>
          </div>
          <div class="field">
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
