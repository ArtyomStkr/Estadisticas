export type Estado = 'pendiente' | 'en proceso' | 'completado'
export type Categoria = 'log' | 'error' | 'sugerencia' | 'otro'
export type Raw = Record<string, unknown>
export type Feedback = {
  id: string; alias: string; comentario: string; estado: Estado; tipo: string;
  categoria: Categoria; marca: string; modelo: string; sdkAndroid: number | null;
  versionAndroid: string; versionApp: string; premium: boolean | null; fecha: Date | null; raw: Raw;
}
export type Stat = {
  id: string; uuid: string; perfil: string; perfilEtiqueta: string; conoceTerminos: boolean | null;
  edad16Cumplida: boolean | null; premium: boolean | null; versionApp: string; fecha: Date | null; raw: Raw;
}
export const estados: Estado[] = ['pendiente', 'en proceso', 'completado']
export const perfiles: Record<string, string> = { estudiante: 'Estudiante', operador: 'Operador de aduanas', importador: 'Importador', otro: 'Otro' }
export const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
export const bool = (value: unknown): boolean | null => typeof value === 'boolean' ? value : null
export function toDate(value: unknown): Date | null {
  try {
    let date: Date | null = null
    if (value instanceof Date) date = value
    else if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') date = value.toDate()
    else if (typeof value === 'string' || typeof value === 'number') date = new Date(value)
    else if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') date = new Date(value.seconds * 1000)
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null
  } catch { return null }
}
export function category(tipo: unknown): Categoria {
  const value = text(tipo).toLowerCase()
  if (value.includes('log')) return 'log'
  if (value.includes('bug') || value.includes('error')) return 'error'
  if (value.includes('sugeren') || value.includes('mejora')) return 'sugerencia'
  return 'otro'
}
export const categoryLabels: Record<Categoria, string> = { log: 'Log', error: 'Error', sugerencia: 'Sugerencia', otro: 'Otro' }
export function normalizeFeedback(id: string, raw: Raw): Feedback {
  return {
    id, raw, alias: text(raw.alias), comentario: text(raw.comentario), tipo: text(raw.tipo), categoria: category(raw.tipo),
    estado: estados.includes(raw.estado as Estado) ? raw.estado as Estado : 'pendiente',
    marca: text(raw.marca), modelo: text(raw.modelo), versionAndroid: text(raw.versionAndroid),
    sdkAndroid: typeof raw.sdkAndroid === 'number' && raw.sdkAndroid > 0 ? raw.sdkAndroid : null,
    versionApp: text(raw.versionApp), premium: bool(raw.premium), fecha: toDate(raw.fecha),
  }
}
export function normalizeStat(id: string, raw: Raw): Stat {
  const perfil = text(raw.perfil)
  return { id, raw, uuid: text(raw.uuid), perfil, perfilEtiqueta: (Object.hasOwn(perfiles, perfil) ? perfiles[perfil] : '') || text(raw.perfilEtiqueta) || perfil || 'Sin perfil',
    conoceTerminos: bool(raw.conoceTerminos), edad16Cumplida: bool(raw.edad16Cumplida), premium: bool(raw.premium),
    versionApp: text(raw.versionApp), fecha: toDate(raw.fecha) }
}
export function inPeriod(date: Date | null, days: string, now = Date.now()) {
  return days === 'todos' || (date !== null && date.getTime() >= now - Number(days) * 86400000 && date.getTime() <= now)
}
export function matchesBoolean(value: boolean | null, filter: string) {
  return filter === 'todos' || (filter === 'sin-dato' ? value === null : value === (filter === 'si'))
}
export const newestFirst = (a: { fecha: Date | null }, b: { fecha: Date | null }) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0)
export function csv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let cell = value == null ? '' : String(value)
    // Los comentarios y alias proceden de usuarios: evitar fórmulas al abrir CSV.
    if (/^[\s]*[=+@-]/.test(cell)) cell = "'" + cell
    return '"' + cell.replaceAll('"', '""') + '"'
  }).join(',')).join('\r\n')
}
