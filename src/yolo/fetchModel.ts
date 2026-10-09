/**
 * Downloads a model, trying each URL in turn. The first URL is the app's own host; later ones are
 * fallbacks, used only when it fails. Some preview hosts answer a model URL with index.html (status
 * 200) or an HTTP 500 instead of the file, so a response only counts if it plausibly is an ONNX file.
 *
 * A downloaded model is kept in Cache Storage, so it's fetched once per device rather than on every
 * visit (or every engine switch). The entry is keyed by the file's size from the manifest, so a
 * re-exported model under the same name is fetched again.
 */

const CACHE = 'iris-models-v1'

async function download(url: string, onProgress: (fraction: number) => void): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} answered ${[response.status, response.statusText].filter(Boolean).join(' ')}.`)
  const type = response.headers.get('Content-Type') ?? ''
  if (/text\/html/i.test(type)) throw new Error(`${url} returned a web page (Content-Type: ${type}), not an ONNX file.`)

  const total = Number(response.headers.get('Content-Length')) || 0
  let bytes: Uint8Array
  if (!response.body || !total) {
    bytes = new Uint8Array(await response.arrayBuffer())
  } else {
    const buffer = new Uint8Array(total)
    const reader = response.body.getReader()
    let loaded = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer.set(value, loaded)
      loaded += value.length
      onProgress(loaded / total)
    }
    bytes = buffer.subarray(0, loaded)
  }
  // An ONNX file is a protobuf and starts with a field tag; '<' means an HTML page with no HTML header.
  if (bytes.length === 0 || bytes[0] === 0x3c) throw new Error(`${url} did not return an ONNX file.`)
  return bytes
}

function cacheKey(url: string, expectedBytes: number | undefined): URL {
  const key = new URL(url, self.location.href)
  key.search = expectedBytes ? `bytes=${expectedBytes}` : ''
  return key
}

/** Cache Storage is missing on insecure pages and can throw when storage is blocked; then there's no cache. */
async function openCache(): Promise<Cache | null> {
  try {
    return 'caches' in self ? await caches.open(CACHE) : null
  } catch {
    return null
  }
}

async function readCached(cache: Cache, key: URL, expectedBytes: number | undefined): Promise<Uint8Array | null> {
  try {
    const hit = await cache.match(key)
    if (!hit) return null
    const bytes = new Uint8Array(await hit.arrayBuffer())
    if (bytes.length === 0 || bytes[0] === 0x3c || (expectedBytes && bytes.length !== expectedBytes)) {
      await cache.delete(key)
      return null
    }
    return bytes
  } catch {
    return null
  }
}

async function writeCached(cache: Cache, key: URL, bytes: Uint8Array) {
  try {
    // Drop older copies of the same file first, so a re-export doesn't leave the old one behind.
    for (const old of await cache.keys()) {
      if (new URL(old.url).pathname === key.pathname) await cache.delete(old)
    }
    await cache.put(key, new Response(bytes.slice().buffer, { headers: { 'Content-Type': 'application/octet-stream' } }))
  } catch {
    // Out of quota or storage blocked: the model just downloads again next time.
  }
}

export async function fetchModel(
  urls: string[],
  onProgress: (fraction: number) => void,
  expectedBytes?: number,
): Promise<Uint8Array> {
  const cache = await openCache()
  const key = cacheKey(urls[0], expectedBytes)
  const cached = cache && (await readCached(cache, key, expectedBytes))
  if (cached) {
    onProgress(1)
    return cached
  }

  const failures: string[] = []
  for (const url of urls) {
    try {
      const bytes = await download(url, onProgress)
      if (cache) await writeCached(cache, key, bytes)
      return bytes
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err))
    }
  }
  throw new Error(`Couldn't download the model. ${failures.join(' ')}`)
}
