import test from 'node:test'
import assert from 'node:assert/strict'
import { createInstallController } from '../src/installController.ts'

function environment(standalone = false) {
  const target = new EventTarget()
  const media = Object.assign(new EventTarget(), { matches: standalone })
  Object.assign(target, { navigator: {}, matchMedia: () => media })
  return { target, media, controller: createInstallController(target) }
}
function offer(target, outcome = 'accepted', prompt = async () => {}) {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt, userChoice: Promise.resolve({ outcome, platform: 'web' }),
  })
  target.dispatchEvent(event)
  return event
}
test('captura la oferta sin abrir el diálogo hasta que el usuario lo solicite', async () => {
  const { target, controller } = environment()
  controller.start(); controller.start()
  let count = 0
  const event = offer(target, 'accepted', async () => { count++ })
  assert.equal(event.defaultPrevented, true)
  assert.equal(count, 0)
  assert.equal(controller.getSnapshot().available, true)
  assert.equal(await controller.install(), true)
  assert.equal(count, 1)
  assert.equal(controller.getSnapshot().installed, false)
  assert.match(controller.getSnapshot().message, /solicitada/)
  target.dispatchEvent(new Event('appinstalled'))
  assert.equal(controller.getSnapshot().installed, true)
  assert.equal(controller.getSnapshot().available, false)
})
test('cancelar o fallar no se presenta como instalación completada', async () => {
  const { target, controller } = environment()
  controller.start()
  offer(target, 'dismissed')
  await controller.install()
  assert.equal(controller.getSnapshot().installed, false)
  assert.match(controller.getSnapshot().message, /más adelante/)
  assert.equal(await controller.install(), false)
  offer(target, 'accepted', async () => { throw new Error('not allowed') })
  await controller.install()
  assert.match(controller.getSnapshot().message, /No se pudo/)
  assert.equal(controller.getSnapshot().busy, false)
})
test('doble toque no abre dos diálogos y una nueva oferta permite reintentar', async () => {
  const { target, controller } = environment()
  controller.start()
  let release
  offer(target, 'dismissed', () => new Promise(resolve => { release = resolve }))
  const pending = controller.install()
  assert.equal(controller.getSnapshot().busy, true)
  assert.equal(await controller.install(), false)
  release(); await pending
  offer(target)
  assert.equal(controller.getSnapshot().available, true)
})
test('detecta modo instalado al abrir y al cambiar de presentación', () => {
  const { target, media, controller } = environment(true)
  controller.start()
  assert.equal(controller.getSnapshot().installed, true)
  media.matches = false; media.dispatchEvent(new Event('change'))
  assert.equal(controller.getSnapshot().installed, false)
  target.navigator.standalone = true
  media.dispatchEvent(new Event('change'))
  assert.equal(controller.getSnapshot().installed, true)
})
