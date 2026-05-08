# Presupuestos

App web (PWA) para crear presupuestos de obras de forma rápida desde el móvil y generar el PDF.

## Características

- Formulario sencillo pensado para móvil (Android, iOS).
- Datos del emisor pre-rellenados (configurables en Ajustes).
- Líneas de tareas con descripción y precio. El total se calcula solo.
- Notas / forma de pago con texto por defecto editable.
- IVA opcional (desactivado por defecto).
- Histórico de presupuestos en el propio dispositivo (`localStorage`).
- Duplicar presupuestos antiguos para clientes recurrentes.
- Numeración automática.
- Generación de PDF con jsPDF (el diseño replica el original naranja).
- Copia de seguridad: exportar/importar todos los datos en JSON.
- Funciona offline una vez instalada (service worker).
- Instalable como app en Android desde Chrome (Añadir a pantalla de inicio).

## Tecnología

Sitio estático: HTML + CSS + JavaScript (vanilla), sin framework. Una sola página, un único `index.html` con todo el código embebido. PDF generado con [jsPDF](https://github.com/parallax/jsPDF) (CDN).

## Estructura

```
presupuestos-app/
├── index.html              ← App completa (HTML + CSS + JS)
├── manifest.webmanifest    ← Manifiesto PWA
├── sw.js                   ← Service worker (offline)
├── icon.svg                ← Icono fuente
├── icon-192.png            ← Icono PWA 192px
├── icon-512.png            ← Icono PWA 512px
├── icon-maskable-512.png   ← Icono maskable Android
└── vercel.json             ← Cabeceras para Vercel
```

## Despliegue en Vercel

1. Sube este directorio a un repositorio de GitHub.
2. Entra en [vercel.com/new](https://vercel.com/new) e importa el repo.
3. Framework Preset: **Other** (es un sitio estático). No hace falta build command.
4. Pulsa **Deploy**.

Cada push a la rama principal redeploya automáticamente.

## Uso

Una vez deployada, abre la URL en el móvil. En Chrome (Android): menú → "Añadir a pantalla de inicio". Ya tienes la app como si fuera nativa.

Los datos se guardan **solo en el dispositivo**. Conviene hacer una copia de seguridad de vez en cuando desde Ajustes → Exportar copia de seguridad.

## Licencia

Uso personal.
# presupuestos
