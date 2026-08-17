import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { renderHome, renderEditor, renderSettings } from '../../js/views.js';
import { DEFAULT_STATE } from '../../js/state.js';

function baseState(overrides = {}) {
  return structuredClone({ ...DEFAULT_STATE, ...overrides });
}

describe('renderHome', () => {
  test('sin presupuestos muestra el estado vacío', () => {
    const html = renderHome(baseState(), '');
    assert.match(html, /Aún no hay presupuestos/);
  });

  test('escapa el nombre del cliente (sin XSS) y muestra el total formateado', () => {
    const state = baseState({
      presupuestos: [{
        id: 'p1', numero: 1, fecha: '2026-01-01',
        cliente: { nombre: '<img src=x onerror=alert(1)>' },
        lineas: [{ titulo: 'X', items: [{ texto: 'Y', precio: 1234.5 }] }]
      }]
    });
    const html = renderHome(state, '');
    assert.ok(!html.includes('<img src=x onerror=alert(1)>'), 'el HTML crudo del nombre no debe aparecer sin escapar');
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, /1\.234,50€/);
  });

  test('el buscador filtra por nombre de cliente', () => {
    const state = baseState({
      presupuestos: [
        { id: 'p1', numero: 1, fecha: '2026-01-01', cliente: { nombre: 'Ana García' }, lineas: [] },
        { id: 'p2', numero: 2, fecha: '2026-01-02', cliente: { nombre: 'Luis Pérez' }, lineas: [] }
      ]
    });
    const html = renderHome(state, 'ana');
    assert.match(html, /Ana García/);
    assert.ok(!html.includes('Luis Pérez'));
  });

  test('el buscador filtra por número de presupuesto', () => {
    const state = baseState({
      presupuestos: [
        { id: 'p1', numero: 7, fecha: '2026-01-01', cliente: { nombre: 'Ana' }, lineas: [] },
        { id: 'p2', numero: 8, fecha: '2026-01-02', cliente: { nombre: 'Luis' }, lineas: [] }
      ]
    });
    const html = renderHome(state, '7');
    assert.match(html, /Ana/);
    assert.ok(!html.includes('Luis'));
  });

  test('sin resultados de búsqueda muestra el mensaje correspondiente', () => {
    const state = baseState({
      presupuestos: [{ id: 'p1', numero: 1, fecha: '2026-01-01', cliente: { nombre: 'Ana' }, lineas: [] }]
    });
    const html = renderHome(state, 'no-existe');
    assert.match(html, /Sin resultados para/);
  });
});

describe('renderEditor', () => {
  function draftWith(items) {
    return {
      id: 'd1', numero: 1, fecha: '2026-01-01',
      cliente: { dni: '', nombre: '', direccion: '', localidad: '' },
      lineas: [{ titulo: 'Materiales', items }],
      notas: '', ivaActivo: false, ivaPorcentaje: 21, validez: 30
    };
  }

  test('renderiza un item por línea y ninguno tiene botón de eliminar si sólo hay uno', () => {
    const html = renderEditor(baseState(), draftWith([{ texto: 'Cemento', precio: 20 }]));
    assert.match(html, /Cemento/);
    assert.ok(!html.includes('data-remove-item='));
  });

  test('con más de un item aparece el botón de eliminar en cada uno', () => {
    const html = renderEditor(baseState(), draftWith([{ texto: 'A', precio: 1 }, { texto: 'B', precio: 2 }]));
    assert.match(html, /data-remove-item="0,0"/);
    assert.match(html, /data-remove-item="0,1"/);
  });

  test('una línea sin items (array vacío) igualmente muestra un item en blanco editable', () => {
    const html = renderEditor(baseState(), draftWith([]));
    assert.match(html, /data-item-field="texto" data-line-idx="0" data-item-idx="0"/);
  });

  test('el subtotal de la línea es la suma de sus items', () => {
    const html = renderEditor(baseState(), draftWith([{ texto: 'A', precio: 20 }, { texto: 'B', precio: 45 }]));
    assert.match(html, /<span class="line-subtotal" data-line-subtotal="0">65€<\/span>/);
  });

  test('el precio de un item se escapa (sin XSS incluso si el dato viene corrupto)', () => {
    const html = renderEditor(baseState(), draftWith([{ texto: 'A', precio: '"><script>alert(1)</script>' }]));
    assert.ok(!html.includes('<script>alert(1)</script>'));
  });

  test('el toggle de IVA muestra la clase "on" cuando ivaActivo es true', () => {
    const draft = draftWith([{ texto: 'A', precio: 10 }]);
    draft.ivaActivo = true;
    const html = renderEditor(baseState(), draft);
    assert.match(html, /class="toggle on" data-toggle="iva"/);
  });
});

describe('renderSettings', () => {
  test('sin presupuestos guardados muestra el mensaje singular correcto', () => {
    const html = renderSettings(baseState());
    assert.match(html, /No hay presupuestos guardados\./);
  });

  test('con 1 presupuesto usa singular', () => {
    const state = baseState({ presupuestos: [{ id: 'a', numero: 1, lineas: [] }] });
    const html = renderSettings(state);
    assert.match(html, /1 presupuesto guardado\./);
  });

  test('con varios presupuestos usa plural', () => {
    const state = baseState({ presupuestos: [{ id: 'a', numero: 1, lineas: [] }, { id: 'b', numero: 2, lineas: [] }] });
    const html = renderSettings(state);
    assert.match(html, /2 presupuestos guardados\./);
  });

  test('los datos del emisor se muestran escapados', () => {
    const state = baseState();
    state.settings.emisor.nombre = 'Fontanería "El Rápido" & Cía';
    const html = renderSettings(state);
    assert.match(html, /Fontanería &quot;El Rápido&quot; &amp; Cía/);
  });
});
