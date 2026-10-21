import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeFeedback, normalizeStat, toDate, inPeriod, matchesBoolean, newestFirst, csv } from '../src/data.ts'

test('contrato actual: log con UUID, Premium y versión con build', () => {
  const item = normalizeFeedback('log-123', { tipo: 'logs', alias: 'instalacion-123', premium: true,
    comentario: '[2026-10-21] Estadísticas: sin-conexion\nStack trace', estado: 'pendiente',
    versionApp: '2.0.0+19', sdkAndroid: 35, fecha: { toDate: () => new Date('2026-10-21T10:00:00Z') }, nuevoCampo: 'se conserva' })
  assert.equal(item.categoria, 'log')
  assert.equal(item.alias, 'instalacion-123')
  assert.equal(item.premium, true)
  assert.equal(item.versionApp, '2.0.0+19')
  assert.equal(item.raw.nuevoCampo, 'se conserva')
  assert.match(item.comentario, /\nStack trace/)
})

test('formularios actuales sin perfilEtiqueta resuelven la etiqueta por código', () => {
  const item = normalizeStat('instalacion', { uuid: 'instalacion', perfil: 'operador', conoceTerminos: false,
    premium: false, edad16Cumplida: true, versionApp: '2.0.0+19' })
  assert.equal(item.perfilEtiqueta, 'Operador de aduanas')
  assert.equal(item.conoceTerminos, false)
  assert.equal(item.premium, false)
  assert.equal(item.edad16Cumplida, true)
})

test('ausente o nulo no se transforma en una respuesta negativa', () => {
  const old = normalizeStat('anterior', { perfilEtiqueta: 'Perfil histórico', conoceTerminos: true, edad16Cumplida: null })
  assert.equal(old.perfilEtiqueta, 'Perfil histórico')
  assert.equal(old.premium, null)
  assert.equal(old.edad16Cumplida, null)
  assert.equal(old.fecha, null)
  assert.equal(matchesBoolean(old.edad16Cumplida, 'no'), false)
  assert.equal(matchesBoolean(old.edad16Cumplida, 'sin-dato'), true)
  assert.equal(matchesBoolean(false, 'no'), true)
  assert.equal(normalizeStat('x', { conoceTerminos: 'false' }).conoceTerminos, null)
  assert.equal(normalizeStat('x', { perfil: '__proto__' }).perfilEtiqueta, '__proto__')
})

test('tipos heredados de feedback y dispositivos sin metadatos', () => {
  assert.equal(normalizeFeedback('a', { tipo: 'Error (Bugs)' }).categoria, 'error')
  assert.equal(normalizeFeedback('b', { tipo: 'Sugerencia' }).categoria, 'sugerencia')
  assert.equal(normalizeFeedback('c', { tipo: 'Otros', sdkAndroid: 0 }).sdkAndroid, null)
  assert.equal(normalizeFeedback('d', { estado: 'desconocido' }).estado, 'pendiente')
})

test('fechas inválidas no se presentan como envíos de hoy', () => {
  assert.equal(toDate(undefined), null)
  assert.equal(toDate('fecha inválida'), null)
  assert.equal(toDate({ toDate: () => { throw new Error('invalid') } }), null)
  assert.equal(toDate({ seconds: 0 }).getTime(), 0)
  assert.equal(toDate(0).getTime(), 0)
  const now = Date.parse('2026-10-21T12:00:00Z')
  assert.equal(inPeriod(null, 'todos', now), true)
  assert.equal(inPeriod(null, '7', now), false)
  assert.equal(inPeriod(new Date(now - 6 * 86400000), '7', now), true)
  assert.equal(inPeriod(new Date(now - 8 * 86400000), '7', now), false)
  assert.equal(inPeriod(new Date(now + 86400000), '7', now), false)
  const dates = [{ fecha: null }, { fecha: new Date(now) }, { fecha: new Date(now - 1000) }].sort(newestFirst)
  assert.equal(dates[2].fecha, null)
})

test('CSV conserva Unicode, saltos y comillas y neutraliza fórmulas', () => {
  const result = csv([['Alias', 'Comentario'], ['José', 'Dice "hola"\notra línea'], ['=HYPERLINK("x")', null], ['  +1', false]])
  assert.ok(result.startsWith('\uFEFF'))
  assert.ok(result.includes('"José","Dice ""hola""\notra línea"'))
  assert.ok(result.includes('"\'=HYPERLINK(""x"")",""'))
  assert.ok(result.includes('"\'  +1","false"'))
})
