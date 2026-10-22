import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import vm from 'node:vm'
import { buildServiceWorker } from '../scripts/build-sw.mjs'

const scope = 'https://example.test/Estadisticas/'
async function fixture(t) {
  const parent = resolve(tmpdir())
  const directory = await mkdtemp(join(parent, 'ab-control-pwa-'))
  t.after(async () => {
    const target = resolve(directory)
    if (!target.startsWith(parent + sep + 'ab-control-pwa-')) throw new Error('Ruta temporal inesperada')
    await rm(target, { recursive: true, force: true })
  })
  await mkdir(join(directory, 'assets'))
  await writeFile(join(directory, 'index.html'), '<html>control</html>')
  await writeFile(join(directory, 'manifest.webmanifest'), '{}')
  await writeFile(join(directory, 'assets', 'app-a.js'), 'console.log(1)')
  return directory
}
function worker(source) {
  const events = new Map()
  const stores = new Map()
  const network = []
  let offline = false
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async key => stores.delete(key),
    open: async key => {
      if (!stores.has(key)) stores.set(key, new Map())
      const store = stores.get(key)
      return {
        addAll: async requests => { for (const request of requests) store.set(typeof request === 'string' ? request : request.url, new Response('cached')) },
        match: async request => store.get(typeof request === 'string' ? request : request.url)?.clone(),
      }
    },
  }
  vm.runInNewContext(source, {
    self: { registration: { scope }, clients: { claim: async () => {} }, addEventListener: (name, callback) => events.set(name, callback) },
    caches, URL, Request, Response,
    fetch: async request => { network.push(request); if (offline) throw new Error('offline'); return new Response('network') },
  })
  return {
    caches, stores, network,
    offline: () => { offline = true },
    async lifecycle(name) { let pending; events.get(name)({ waitUntil: promise => { pending = promise } }); await pending },
    fetch(url, mode = 'cors', method = 'GET') {
      let response
      events.get('fetch')({ request: { url, mode, method }, respondWith: promise => { response = promise } })
      return response
    },
  }
}

test('manifest: identidad de control, alcance relativo e iconos reales de la app', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
  assert.equal(manifest.start_url, './'); assert.equal(manifest.scope, './'); assert.equal(manifest.id, './')
  assert.equal(new URL(manifest.start_url, scope).href, scope)
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.prefer_related_applications, false)
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512'])
  for (const icon of manifest.icons) assert.ok((await readFile(new URL('../public/' + icon.src, import.meta.url))).length)
  const png = await readFile(new URL('../public/branding/icon-192.png', import.meta.url))
  assert.equal(png.readUInt32BE(16), 192); assert.equal(png.readUInt32BE(20), 192)
  assert.equal(await readFile(new URL('../index.html', import.meta.url), 'utf8'), await readFile(new URL('../index.template.html', import.meta.url), 'utf8'))
})
test('build: cambia la versión al cambiar recursos y no precachea su propio worker', async t => {
  const directory = await fixture(t)
  const first = await buildServiceWorker(directory)
  assert.ok(first.files.includes('assets/app-a.js'))
  assert.ok(!first.files.includes('sw.js'))
  assert.equal((await buildServiceWorker(directory)).version, first.version)
  await writeFile(join(directory, 'assets', 'app-a.js'), 'console.log(2)')
  assert.notEqual((await buildServiceWorker(directory)).version, first.version)
})
test('worker: abre la interfaz sin conexión y deja pasar Firebase y escrituras', async t => {
  const directory = await fixture(t)
  await buildServiceWorker(directory)
  const app = worker(await readFile(join(directory, 'sw.js'), 'utf8'))
  await app.lifecycle('install')
  assert.equal(await (await app.fetch(scope, 'navigate')).text(), 'network')
  app.offline()
  assert.equal(await (await app.fetch(scope, 'navigate')).text(), 'cached')
  assert.equal(await (await app.fetch(scope + 'assets/app-a.js')).text(), 'cached')
  assert.equal(app.fetch('https://firestore.googleapis.com/v1/test'), undefined)
  assert.equal(app.fetch('https://identitytoolkit.googleapis.com/v1/test'), undefined)
  assert.equal(app.fetch(scope + 'api/private'), undefined)
  assert.equal(app.fetch(scope + 'assets/app-a.js', 'cors', 'POST'), undefined)
  assert.equal(app.fetch('https://example.test/otra-web/', 'navigate'), undefined)
})
test('activación: elimina solo versiones anteriores de este panel', async t => {
  const directory = await fixture(t)
  await buildServiceWorker(directory)
  const app = worker(await readFile(join(directory, 'sw.js'), 'utf8'))
  await app.lifecycle('install')
  await app.caches.open('ab-control:/Estadisticas/:anterior')
  await app.caches.open('ab-control:/otra-app/:anterior')
  await app.caches.open('otra-cache')
  await app.lifecycle('activate')
  assert.equal(app.stores.has('ab-control:/Estadisticas/:anterior'), false)
  assert.equal(app.stores.has('ab-control:/otra-app/:anterior'), true)
  assert.equal(app.stores.has('otra-cache'), true)
})
