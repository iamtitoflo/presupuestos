export const DEFAULT_STATE = {
  version: 1,
  settings: {
    emisor: {
      nombre: '',
      nif: '',
      email: '',
      telefono: '654317796',
      direccion: 'Villar del Arzobispo',
      cp: '46170',
      localidad: 'Higueruelas'
    },
    notasDefecto: '--- FORMA DE PAGO: deberá abonarse el 40% al comienzo de los trabajos.\n• A mitad de los trabajos realizados debe estar pagado el 80% del presupuesto.\n• Al terminar se deberá abonar el 20% restante del total del presupuesto.',
    ivaActivo: false,
    ivaPorcentaje: 21,
    validezDefecto: 30,
    siguienteNumero: 1
  },
  presupuestos: []
};

export const STORAGE_KEY = 'presupuestos_app_v1';

// Older saved data has a single `precio` per línea. Map it onto
// cantidad × precioUnitario (cantidad 1) so existing totals are preserved.
export function normalizeLinea(l) {
  const out = { titulo: '', descripcion: '', cantidad: 1, precioUnitario: '', ...l };
  if ((out.precioUnitario === '' || out.precioUnitario == null) && l.precio != null && l.precio !== '') {
    out.precioUnitario = l.precio;
    out.cantidad = l.cantidad ?? 1;
  }
  delete out.precio;
  return out;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const s = JSON.parse(raw);
    s.settings = Object.assign({}, DEFAULT_STATE.settings, s.settings || {});
    s.settings.emisor = Object.assign({}, DEFAULT_STATE.settings.emisor, s.settings.emisor || {});
    s.presupuestos = (s.presupuestos || []).map(p => ({
      ...p,
      lineas: (p.lineas || []).map(normalizeLinea)
    }));
    return s;
  } catch (e) {
    console.error('Error loading state', e);
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
