import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  uuid, todayISO, formatDate, formatPrice,
  calcLineaTotal, calcSubtotal, calcTotal, escapeHtml, setPath
} from '../../js/utils.js';

describe('formatDate', () => {
  test('convierte ISO (yyyy-mm-dd) a dd-mm-yyyy', () => {
    assert.equal(formatDate('2026-08-17'), '17-08-2026');
  });
  test('cadena vacía o nula devuelve cadena vacía', () => {
    assert.equal(formatDate(''), '');
    assert.equal(formatDate(null), '');
    assert.equal(formatDate(undefined), '');
  });
  test('valor que no tiene 3 partes se devuelve tal cual', () => {
    assert.equal(formatDate('no-es-una-fecha'), 'no-es-una-fecha');
  });
});

describe('formatPrice', () => {
  test('entero sin decimales', () => {
    assert.equal(formatPrice(45), '45');
  });
  test('con céntimos', () => {
    assert.equal(formatPrice(45.5), '45,50');
  });
  test('separador de miles español', () => {
    assert.equal(formatPrice(1234), '1.234');
    assert.equal(formatPrice(1234.5), '1.234,50');
    assert.equal(formatPrice(1234567.89), '1.234.567,89');
  });
  test('valores no numéricos o vacíos se tratan como 0', () => {
    assert.equal(formatPrice(''), '0');
    assert.equal(formatPrice(null), '0');
    assert.equal(formatPrice(undefined), '0');
    assert.equal(formatPrice('no es un número'), '0');
  });
  test('cero', () => {
    assert.equal(formatPrice(0), '0');
  });
});

describe('calcLineaTotal / calcSubtotal / calcTotal', () => {
  test('suma el precio de los items de una línea', () => {
    const linea = { titulo: 'Materiales', items: [{ texto: 'Cemento', precio: 20 }, { texto: 'Ladrillos', precio: 45 }] };
    assert.equal(calcLineaTotal(linea), 65);
  });
  test('línea sin items o con items vacíos da 0', () => {
    assert.equal(calcLineaTotal({ titulo: 'X', items: [] }), 0);
    assert.equal(calcLineaTotal({ titulo: 'X' }), 0);
  });
  test('precios vacíos o no numéricos cuentan como 0, sin romper la suma', () => {
    const linea = { items: [{ texto: 'A', precio: 10 }, { texto: 'B', precio: '' }, { texto: 'C', precio: 'x' }] };
    assert.equal(calcLineaTotal(linea), 10);
  });
  test('calcSubtotal suma el total de todas las líneas', () => {
    const p = {
      lineas: [
        { items: [{ texto: 'A', precio: 20 }] },
        { items: [{ texto: 'B', precio: 30 }, { texto: 'C', precio: 5 }] }
      ]
    };
    assert.equal(calcSubtotal(p), 55);
  });
  test('calcTotal sin IVA activo es igual al subtotal', () => {
    const p = { lineas: [{ items: [{ precio: 100 }] }], ivaActivo: false, ivaPorcentaje: 21 };
    assert.equal(calcTotal(p), 100);
  });
  test('calcTotal con IVA activo aplica el porcentaje', () => {
    const p = { lineas: [{ items: [{ precio: 100 }] }], ivaActivo: true, ivaPorcentaje: 21 };
    assert.equal(calcTotal(p), 121);
  });
  test('presupuesto sin líneas da subtotal y total 0', () => {
    assert.equal(calcSubtotal({ lineas: [] }), 0);
    assert.equal(calcTotal({ lineas: [], ivaActivo: true, ivaPorcentaje: 21 }), 0);
  });
});

describe('escapeHtml', () => {
  test('escapa los caracteres especiales de HTML', () => {
    assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });
  test("escapa comillas simples y &", () => {
    assert.equal(escapeHtml(`Juan & O'Neil`), 'Juan &amp; O&#39;Neil');
  });
  test('null/undefined se convierten en cadena vacía', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
  });
  test('números se convierten a texto sin romper', () => {
    assert.equal(escapeHtml(45), '45');
  });
});

describe('setPath', () => {
  test('escribe en una ruta anidada simple', () => {
    const obj = {};
    setPath(obj, 'cliente.nombre', 'Ana');
    assert.deepEqual(obj, { cliente: { nombre: 'Ana' } });
  });
  test('crea los objetos intermedios que falten', () => {
    const obj = { cliente: {} };
    setPath(obj, 'cliente.direccion.calle', 'Mayor 1');
    assert.equal(obj.cliente.direccion.calle, 'Mayor 1');
  });
  test('sobrescribe una hoja existente', () => {
    const obj = { cliente: { nombre: 'Ana' } };
    setPath(obj, 'cliente.nombre', 'Luis');
    assert.equal(obj.cliente.nombre, 'Luis');
  });
  test('ruta de un solo nivel', () => {
    const obj = {};
    setPath(obj, 'numero', 5);
    assert.equal(obj.numero, 5);
  });
});

describe('uuid / todayISO', () => {
  test('uuid genera cadenas no vacías y distintas entre llamadas', () => {
    const a = uuid();
    const b = uuid();
    assert.ok(typeof a === 'string' && a.length > 0);
    assert.notEqual(a, b);
  });
  test('todayISO devuelve una fecha con formato yyyy-mm-dd', () => {
    assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  });
});
