import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer, serverUrl, chromiumLaunchOptions } from './helpers.js';

let server, browser, baseUrl;

before(async () => {
  server = await startServer();
  baseUrl = serverUrl(server);
  browser = await chromium.launch(chromiumLaunchOptions());
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

// Fresh page + fresh localStorage for every test, so tests never leak state
// into each other.
async function freshPage() {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(new Error(msg.text())); });
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  page.errors = errors;
  return page;
}

function assertNoPageErrors(page) {
  assert.deepEqual(page.errors, [], `no debe haber errores de JS en la página: ${page.errors.map(e => e.message).join('; ')}`);
}

describe('Crear y editar un presupuesto', () => {
  test('crea un concepto con varias líneas y calcula el subtotal y el total en vivo', async () => {
    const page = await freshPage();
    await page.click('[data-action="new"]');
    await page.fill('[data-line-field="titulo"][data-idx="0"]', 'Materiales');
    await page.fill('[data-item-field="texto"][data-line-idx="0"][data-item-idx="0"]', 'Cemento');
    await page.fill('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]', '20');
    await page.click('[data-add-item="0"]');
    await page.fill('[data-item-field="texto"][data-line-idx="0"][data-item-idx="1"]', 'Ladrillos');
    await page.fill('[data-item-field="precio"][data-line-idx="0"][data-item-idx="1"]', '45');

    assert.equal(await page.textContent('[data-line-subtotal="0"]'), '65€');
    assert.equal(await page.textContent('.total-card .amount'), '65€');
    assertNoPageErrors(page);
    await page.close();
  });

  test('eliminar una línea dentro de un concepto recalcula el subtotal', async () => {
    const page = await freshPage();
    await page.click('[data-action="new"]');
    await page.fill('[data-item-field="texto"][data-line-idx="0"][data-item-idx="0"]', 'Cemento');
    await page.fill('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]', '20');
    await page.click('[data-add-item="0"]');
    await page.fill('[data-item-field="texto"][data-line-idx="0"][data-item-idx="1"]', 'Ladrillos');
    await page.fill('[data-item-field="precio"][data-line-idx="0"][data-item-idx="1"]', '45');
    await page.click('[data-remove-item="0,1"]');

    assert.equal(await page.textContent('[data-line-subtotal="0"]'), '20€');
    assert.equal(await page.textContent('.total-card .amount'), '20€');
    await page.close();
  });

  test('añadir un segundo concepto suma su propio subtotal al total', async () => {
    const page = await freshPage();
    await page.click('[data-action="new"]');
    await page.fill('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]', '20');
    await page.click('[data-action="add-line"]');
    await page.fill('[data-item-field="precio"][data-line-idx="1"][data-item-idx="0"]', '30');

    assert.equal(await page.textContent('.total-card .amount'), '50€');
    await page.close();
  });

  test('eliminar un concepto entero resta su importe del total', async () => {
    const page = await freshPage();
    await page.click('[data-action="new"]');
    await page.fill('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]', '20');
    await page.click('[data-action="add-line"]');
    await page.fill('[data-item-field="precio"][data-line-idx="1"][data-item-idx="0"]', '30');
    await page.click('[data-remove-line="1"]');

    assert.equal(await page.textContent('.total-card .amount'), '20€');
    await page.close();
  });

  test('activar IVA recalcula el total aplicando el porcentaje', async () => {
    const page = await freshPage();
    await page.click('[data-action="new"]');
    await page.fill('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]', '100');
    await page.click('[data-toggle="iva"]');
    await page.fill('[data-field="ivaPorcentaje"]', '21');

    assert.equal(await page.textContent('.total-card .amount'), '121€');
    await page.close();
  });
});

describe('Persistencia', () => {
  test('guardar → volver → reabrir conserva las líneas y sus precios', async () => {
    const page = await freshPage();
    await page.click('[data-action="new"]');
    await page.fill('[data-field="cliente.nombre"]', 'María López');
    await page.fill('[data-item-field="texto"][data-line-idx="0"][data-item-idx="0"]', 'Cemento');
    await page.fill('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]', '20');
    await page.click('[data-action="save"]');
    await page.click('[data-action="back"]');
    await page.click('.card');

    assert.equal(await page.inputValue('[data-item-field="texto"][data-line-idx="0"][data-item-idx="0"]'), 'Cemento');
    assert.equal(await page.inputValue('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]'), '20');
    await page.close();
  });

  test('duplicar un presupuesto crea uno nuevo con el mismo contenido', async () => {
    const page = await freshPage();
    await page.click('[data-action="new"]');
    await page.fill('[data-field="cliente.nombre"]', 'Cliente Original');
    await page.fill('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]', '50');
    await page.click('[data-action="save"]');
    await page.click('[data-action="duplicate"]');

    const count = await page.locator('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]').count();
    assert.equal(count, 1);
    assert.equal(await page.inputValue('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]'), '50');
    await page.click('[data-action="back"]');
    const cards = await page.locator('.card').count();
    assert.equal(cards, 2, 'debe haber dos presupuestos: el original y el duplicado');
    await page.close();
  });

  test('eliminar un presupuesto lo quita de la lista', async () => {
    const page = await freshPage();
    page.on('dialog', (d) => d.accept());
    await page.click('[data-action="new"]');
    await page.fill('[data-field="cliente.nombre"]', 'A borrar');
    await page.click('[data-action="save"]');
    await page.click('[data-action="delete"]');

    assert.match(await page.content(), /Aún no hay presupuestos/);
    await page.close();
  });

  test('el buscador de la pantalla principal filtra por cliente', async () => {
    const page = await freshPage();
    await page.click('[data-action="new"]');
    await page.fill('[data-field="cliente.nombre"]', 'Ana García');
    await page.click('[data-action="save"]');
    await page.click('[data-action="back"]');
    await page.click('[data-action="new"]');
    await page.fill('[data-field="cliente.nombre"]', 'Luis Pérez');
    await page.click('[data-action="save"]');
    await page.click('[data-action="back"]');

    await page.fill('[data-search]', 'ana');
    const cardText = await page.textContent('.card-list');
    assert.match(cardText, /Ana García/);
    assert.ok(!cardText.includes('Luis Pérez'));
    await page.close();
  });
});

describe('Migración de formatos antiguos', () => {
  async function seedAndOpen(page, lineas) {
    await page.evaluate((ls) => {
      const state = {
        version: 1,
        settings: {
          emisor: { nombre: 'Test', nif: '', email: '', telefono: '', direccion: '', cp: '', localidad: '' },
          notasDefecto: '', ivaActivo: false, ivaPorcentaje: 21, validezDefecto: 30, siguienteNumero: 2
        },
        presupuestos: [{
          id: 'legacy-1', numero: 1, fecha: '2026-01-01',
          cliente: { dni: '', nombre: 'Cliente Antiguo', direccion: '', localidad: '' },
          lineas: ls, notas: '', ivaActivo: false, ivaPorcentaje: 21, validez: 30
        }]
      };
      localStorage.setItem('presupuestos_app_v1', JSON.stringify(state));
    }, lineas);
    await page.reload({ waitUntil: 'networkidle' });
  }

  test('el formato antiguo de precio único se migra conservando el total', async () => {
    const page = await freshPage();
    await seedAndOpen(page, [{ titulo: 'Mano de obra', descripcion: 'Trabajo completo', precio: 250 }]);
    assert.equal(await page.textContent('.card-amount'), '250€');
    await page.click('.card');
    assert.equal(await page.textContent('[data-line-subtotal="0"]'), '250€');
    await page.close();
  });

  test('el formato intermedio cantidad/precioUnitario se migra conservando el total', async () => {
    const page = await freshPage();
    await seedAndOpen(page, [{ titulo: 'Baldosas', cantidad: 3, precioUnitario: 15 }]);
    assert.equal(await page.textContent('.card-amount'), '45€');
    await page.close();
  });
});

describe('Ajustes', () => {
  test('guardar ajustes persiste los datos del emisor', async () => {
    const page = await freshPage();
    await page.click('[data-action="settings"]');
    await page.fill('[data-setting="emisor.nombre"]', 'Fontanería Pérez');
    await page.fill('[data-setting="emisor.telefono"]', '600111222');
    await page.click('[data-action="save-settings"]');
    await page.click('[data-action="settings"]');

    assert.equal(await page.inputValue('[data-setting="emisor.nombre"]'), 'Fontanería Pérez');
    assert.equal(await page.inputValue('[data-setting="emisor.telefono"]'), '600111222');
    await page.close();
  });

  test('borrar todos los presupuestos vacía la lista', async () => {
    const page = await freshPage();
    page.on('dialog', (d) => d.accept());
    await page.click('[data-action="new"]');
    await page.click('[data-action="save"]');
    await page.click('[data-action="back"]');
    await page.click('[data-action="settings"]');
    await page.click('[data-action="reset"]');
    await page.click('[data-action="back"]');

    assert.match(await page.content(), /Aún no hay presupuestos/);
    await page.close();
  });
});

describe('Exportar / importar copia de seguridad', () => {
  test('exportar genera un JSON válido con el estado actual', async () => {
    const page = await freshPage();
    await page.click('[data-action="new"]');
    await page.fill('[data-field="cliente.nombre"]', 'Cliente Backup');
    await page.click('[data-action="save"]');
    await page.click('[data-action="back"]');
    await page.click('[data-action="settings"]');

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-action="export"]');
    const download = await downloadPromise;
    const streamPath = await download.path();
    const fs = await import('node:fs');
    const content = JSON.parse(fs.readFileSync(streamPath, 'utf8'));

    assert.equal(content.type, 'presupuestos-backup');
    assert.equal(content.state.presupuestos[0].cliente.nombre, 'Cliente Backup');
    await page.close();
  });
});

describe('Generación de PDF', () => {
  test('jsPDF se carga desde el vendor local, no desde un CDN', async () => {
    const page = await freshPage();
    const scriptSrc = await page.evaluate(() => document.querySelector('script[src*="jspdf"]').getAttribute('src'));
    assert.equal(scriptSrc, 'vendor/jspdf.umd.min.js');
    const jspdfType = await page.evaluate(() => typeof window.jspdf?.jsPDF);
    assert.equal(jspdfType, 'function');
    await page.close();
  });

  test('genera un PDF descargable sin errores de JS', async () => {
    const page = await freshPage();
    await page.addInitScript(() => { delete navigator.share; });
    await page.click('[data-action="new"]');
    await page.fill('[data-field="cliente.nombre"]', 'Cliente PDF');
    await page.fill('[data-line-field="titulo"][data-idx="0"]', 'Materiales');
    await page.fill('[data-item-field="texto"][data-line-idx="0"][data-item-idx="0"]', 'Cemento');
    await page.fill('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]', '20');

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-action="pdf"]');
    const download = await downloadPromise;
    const streamPath = await download.path();
    const fs = await import('node:fs');
    const stat = fs.statSync(streamPath);
    assert.ok(stat.size > 1000, 'el PDF generado no debe estar vacío');
    assertNoPageErrors(page);
    await page.close();
  });
});

describe('Seguridad: sin XSS a través de campos de usuario', () => {
  test('un nombre de cliente con HTML no se ejecuta ni se inyecta sin escapar', async () => {
    const page = await freshPage();
    let dialogFired = false;
    page.on('dialog', (d) => { dialogFired = true; d.dismiss(); });
    await page.click('[data-action="new"]');
    await page.fill('[data-field="cliente.nombre"]', '<img src=x onerror="window.__xss=true">');
    await page.click('[data-action="save"]');
    await page.click('[data-action="back"]');

    assert.equal(dialogFired, false, 'no debe dispararse ningún diálogo/alert');
    const xssFlag = await page.evaluate(() => window.__xss);
    assert.equal(xssFlag, undefined);
    const cardHtml = await page.innerHTML('.card-list');
    assert.ok(!cardHtml.includes('<img src=x'), 'el HTML crudo no debe aparecer sin escapar');
    await page.close();
  });

  test('un backup importado con datos corruptos en item.precio no inyecta HTML al reabrir', async () => {
    const page = await freshPage();
    await page.evaluate(() => {
      const state = {
        version: 1,
        settings: { emisor: {}, notasDefecto: '', ivaActivo: false, ivaPorcentaje: 21, validezDefecto: 30, siguienteNumero: 2 },
        presupuestos: [{
          id: 'evil-1', numero: 1, fecha: '2026-01-01',
          cliente: { nombre: 'Cliente' },
          lineas: [{ titulo: 'X', items: [{ texto: 'Y', precio: '"><img src=x onerror="window.__xss2=true">' }] }]
        }]
      };
      localStorage.setItem('presupuestos_app_v1', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('.card');

    const xssFlag = await page.evaluate(() => window.__xss2);
    assert.equal(xssFlag, undefined);
    await page.close();
  });
});

describe('Responsive', () => {
  const viewports = [
    { name: '320px (móvil pequeño)', width: 320, height: 800 },
    { name: '390px (móvil)', width: 390, height: 844 },
    { name: '768px (tablet)', width: 768, height: 1024 },
    { name: '1440px (escritorio)', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`sin overflow horizontal en ${vp.name}`, async () => {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'networkidle' });
      await page.click('[data-action="new"]');
      await page.fill('[data-field="cliente.nombre"]', 'Constructora Reformas Integrales García y Hermanos del Mediterráneo S.L.');
      await page.fill('[data-line-field="titulo"][data-idx="0"]', 'MANO DE OBRA Y MATERIALES PARA LA REFORMA COMPLETA DEL CUARTO DE BAÑO');
      await page.fill('[data-item-field="texto"][data-line-idx="0"][data-item-idx="0"]', 'Desmontaje de sanitarios antiguos y alicatado completo');
      await page.fill('[data-item-field="precio"][data-line-idx="0"][data-item-idx="0"]', '2450');

      const { clientWidth, scrollWidth } = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      assert.ok(scrollWidth <= clientWidth, `scrollWidth (${scrollWidth}) no debe superar clientWidth (${clientWidth})`);
      await page.close();
    });
  }
});
