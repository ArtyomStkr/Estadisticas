import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function buildServiceWorker(outDir) {
  const root = resolve(outDir)
  const files = []
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await collect(path)
      else {
        const name = relative(root, path).replaceAll('\\', '/')
        if (name === 'index.html' || name === 'manifest.webmanifest' || /^(assets|branding)\//.test(name)) files.push(name)
      }
    }
  }
  await collect(root)
  files.sort()
  if (!files.includes('index.html') || !files.includes('manifest.webmanifest')) throw new Error('Faltan la entrada o el manifest de la PWA.')
  const digest = createHash('sha256')
  for (const name of files) { digest.update(name); digest.update(await readFile(join(root, name))) }
  const version = digest.digest('hex').slice(0, 20)
  const template = await readFile(new URL('./service-worker.template.js', import.meta.url), 'utf8')
  const source = template.replace('/* VERSION */', JSON.stringify(version)).replace('/* PRECACHE */', JSON.stringify(files))
  await writeFile(join(root, 'sw.js'), source)
  return { version, files }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { resolveConfig } = await import('vite')
  const config = await resolveConfig({}, 'build')
  const result = await buildServiceWorker(resolve(config.root, config.build.outDir))
  console.log(`PWA: ${result.files.length} archivos preparados para uso sin conexión (${result.version}).`)
}
