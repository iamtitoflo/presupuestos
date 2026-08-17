import './localStorage-shim.js';
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE, STORAGE_KEY, normalizeLinea, loadState, saveState } from '../../js/state.js';

describe('normalizeLinea', () => {
  test('formato actual (items) se conserva, rellenando texto/precio que falten', () => {
    const l = { titulo: 'Materiales', items: [{ texto: 'Cemento', precio: 20 }, {}] };
    const out = normalizeLinea(l);
    assert.deepEqual(out, {
      titulo: 'Materiales',
      items: [{ texto: 'Cemento', precio: 20 }, { texto: '', precio: '' }]
    });
  });

  test('formato antiguo (precio simple) migra a un único item, conservando el total', () => {
    const l = { titulo: 'Mano de obra', descripcion: 'Trabajo completo\nDos días', precio: 250 };
    const out = normalizeLinea(l);
    assert.equal(out.titulo, 'Mano de obra');
    assert.equal(out.items.length, 1);
    assert.equal(out.items[0].precio, 250);
    assert.equal(out.items[0].texto, 'Trabajo completo · Dos días');
    assert.equal(out.precio, undefined, 'el campo precio antiguo no debe sobrevivir a la migración');
  });

  test('formato intermedio (cantidad × precioUnitario) migra conservando el total exacto', () => {
    const l = { titulo: 'Baldosas', cantidad: 3, precioUnitario: 15 };
    const out = normalizeLinea(l);
    assert.equal(out.items.length, 1);
    assert.equal(out.items[0].precio, 45);
  });

  test('cantidad ausente en el formato intermedio se trata como 1', () => {
    const l = { titulo: 'X', precioUnitario: 20 };
    const out = normalizeLinea(l);
    assert.equal(out.items[0].precio, 20);
  });

  test('línea completamente vacía (sin precio ni descripción) da un item en blanco', () => {
    const out = normalizeLinea({ titulo: 'Vacía' });
    assert.deepEqual(out.items, [{ texto: '', precio: '' }]);
  });

  test('título ausente se normaliza a cadena vacía', () => {
    const out = normalizeLinea({ precio: 10 });
    assert.equal(out.titulo, '');
  });
});

describe('loadState / saveState', () => {
  beforeEach(() => localStorage.clear());

  test('sin datos guardados devuelve una copia de DEFAULT_STATE', () => {
    const s = loadState();
    assert.deepEqual(s, DEFAULT_STATE);
    assert.notEqual(s, DEFAULT_STATE, 'debe ser una copia, no la misma referencia');
  });

  test('guardar y cargar conserva un presupuesto', () => {
    const state = structuredClone(DEFAULT_STATE);
    state.presupuestos.push({
      id: 'p1', numero: 1, fecha: '2026-01-01',
      cliente: { nombre: 'Ana' },
      lineas: [{ titulo: 'X', items: [{ texto: 'Y', precio: 10 }] }]
    });
    saveState(state);
    const loaded = loadState();
    assert.equal(loaded.presupuestos.length, 1);
    assert.equal(loaded.presupuestos[0].cliente.nombre, 'Ana');
    assert.equal(loaded.presupuestos[0].lineas[0].items[0].precio, 10);
  });

  test('las líneas con formato antiguo se migran automáticamente al cargar', () => {
    const raw = {
      version: 1,
      settings: DEFAULT_STATE.settings,
      presupuestos: [{ id: 'old', numero: 1, lineas: [{ titulo: 'Vieja', precio: 100 }] }]
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    const loaded = loadState();
    assert.equal(loaded.presupuestos[0].lineas[0].items[0].precio, 100);
  });

  test('los ajustes guardados se combinan con los valores por defecto (settings parciales)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: { ivaPorcentaje: 10 }, presupuestos: [] }));
    const loaded = loadState();
    assert.equal(loaded.settings.ivaPorcentaje, 10, 'el valor guardado se respeta');
    assert.equal(loaded.settings.validezDefecto, DEFAULT_STATE.settings.validezDefecto, 'lo que falta viene del default');
    assert.equal(loaded.settings.emisor.localidad, DEFAULT_STATE.settings.emisor.localidad);
  });

  test('JSON corrupto no lanza excepción y devuelve el estado por defecto', () => {
    localStorage.setItem(STORAGE_KEY, '{ esto no es json válido');
    assert.doesNotThrow(() => loadState());
    assert.deepEqual(loadState(), DEFAULT_STATE);
  });
});
