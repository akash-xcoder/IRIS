/**
 * Downloads a model, trying each URL in turn. The first URL is the app's own host; later ones are
 * fallbacks, used only when it fails. Some preview hosts answer a model URL with index.html (status
 * 200) or an HTTP 500 instead of the file, so a response only counts if it plausibly is an ONNX file.
 */

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

export async function fetchModel(urls: string[], onProgress: (fraction: number) => void): Promise<Uint8Array> {
  const failures: string[] = []
  for (const url of urls) {
    try {
      return await download(url, onProgress)
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err))
    }
  }
  throw new Error(`Couldn't download the model. ${failures.join(' ')}`)
}
