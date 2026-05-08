/** Estado por defecto de la app. */
export const DEFAULT_STATE = {
  version: 1,
  settings: {
    emisor: { telefono: "654317796", direccion: "Villar del Arzobispo", cp: "46170", localidad: "Higueruelas" },
    notasDefecto: "--- FORMA DE PAGO: deberá abonarse el 40% al comienzo de los trabajos.\n• A mitad de los trabajos realizados debe estar pagado el 80% del presupuesto.\n• Al terminar se deberá abonar el 20% restante del total del presupuesto.",
    ivaActivo: false,
    ivaPorcentaje: 21,
    siguienteNumero: 1
  },
  presupuestos: []
};

export const STORAGE_KEY = "presupuestos_app_v1";

/** @returns {any} estado completo */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const s = JSON.parse(raw);
    s.settings = Object.assign({}, DEFAULT_STATE.settings, s.settings || {});
    s.settings.emisor = Object.assign({}, DEFAULT_STATE.settings.emisor, s.settings.emisor || {});
    s.presupuestos = s.presupuestos || [];
    return s;
  } catch (e) {
    console.error("Error loading state", e);
    return structuredClone(DEFAULT_STATE);
  }
}

/** Guarda el estado en localStorage. @param {any} state */
export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
