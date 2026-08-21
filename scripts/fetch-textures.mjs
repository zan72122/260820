/**
 * Fetch CC0 PBR textures from Poly Haven, downscale, convert to WebP and
 * write them under public/textures/ together with CREDITS.md and a
 * manifest.json the TextureRegistry uses to upgrade from procedural
 * synthesis at runtime.
 *
 * Run this on a machine with open network access:
 *   npm run fetch:textures
 * The game works fully without it (procedural fallback), so this script is
 * never on any test's critical path.
 *
 * If `sharp` fails to install on your platform, re-run with SKIP_RESIZE=1 to
 * commit the 1K JPGs as-is (slightly larger, still under the size gate).
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = path.join(ROOT, 'public', 'textures')
const manifest = JSON.parse(
  await readFile(path.join(ROOT, 'scripts', 'texture-manifest.json'), 'utf8'),
)

const API = 'https://api.polyhaven.com'
const RETRIES = 2

async function fetchWithRetry(url, asJson) {
  let lastErr
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
      return asJson ? await res.json() : Buffer.from(await res.arrayBuffer())
    } catch (err) {
      lastErr = err
      if (i < RETRIES) await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
    }
  }
  throw lastErr
}

const MAP_FILE = { diff: 'albedo.webp', rough: 'rough.webp', nor_gl: 'normal.webp' }

let sharp = null
if (!process.env.SKIP_RESIZE) {
  try {
    sharp = (await import('sharp')).default
  } catch {
    console.warn('sharp unavailable — falling back to SKIP_RESIZE behaviour')
  }
}

const credits = [
  '# Texture credits',
  '',
  'All scanned textures below are CC0 from [Poly Haven](https://polyhaven.com/).',
  `Fetched ${new Date().toISOString().slice(0, 10)} via scripts/fetch-textures.mjs.`,
  '',
]
const done = []
let totalBytes = 0

for (const [family, spec] of Object.entries(manifest.families)) {
  try {
    const files = await fetchWithRetry(`${API}/files/${spec.slug}`, true)
    const info = await fetchWithRetry(`${API}/info/${spec.slug}`, true)
    const dir = path.join(OUT, family)
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    let familyBytes = 0
    for (const mapKey of spec.maps) {
      const entry = files[mapKey]?.['1k']
      const src = entry?.jpg ?? entry?.png
      if (!src) throw new Error(`no 1k ${mapKey} for ${spec.slug}`)
      const raw = await fetchWithRetry(src.url, false)
      const outFile = path.join(dir, MAP_FILE[mapKey] ?? `${mapKey}.webp`)
      let outBuf
      if (sharp) {
        const px = mapKey === 'diff' ? manifest.targetPx.color : manifest.targetPx.data
        const q = mapKey === 'nor_gl' ? 95 : 78
        outBuf = await sharp(raw).resize(px, px).webp({ quality: q }).toBuffer()
      } else {
        outBuf = raw
      }
      await writeFile(outFile, outBuf)
      familyBytes += outBuf.length
    }
    totalBytes += familyBytes
    const kb = Math.round(familyBytes / 1024)
    if (kb > manifest.sizeGate.perFamilyKB) {
      throw new Error(`${family}: ${kb} KB exceeds the ${manifest.sizeGate.perFamilyKB} KB gate`)
    }
    console.log(`${family.padEnd(14)} ${spec.slug.padEnd(22)} ${kb} KB`)
    credits.push(
      `- **${family}** — [${spec.slug}](https://polyhaven.com/a/${spec.slug})` +
        ` by ${(info.authors && Object.keys(info.authors).join(', ')) || 'Poly Haven'} (CC0)`,
    )
    done.push(family)
  } catch (err) {
    console.warn(`SKIP ${family}: ${err.message ?? err} (procedural fallback stays active)`)
  }
}

if (totalBytes / (1024 * 1024) > manifest.sizeGate.totalMB) {
  console.error(`Total ${(totalBytes / 1048576).toFixed(1)} MB exceeds the ${manifest.sizeGate.totalMB} MB gate — aborting without manifest.`)
  process.exit(1)
}

await mkdir(OUT, { recursive: true })
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(done, null, 2))
await writeFile(path.join(OUT, 'CREDITS.md'), credits.join('\n') + '\n')
console.log(`\n${done.length}/${Object.keys(manifest.families).length} families, total ${(totalBytes / 1048576).toFixed(1)} MB`)
