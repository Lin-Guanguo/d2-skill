const imageDataUrlCache = new Map<string, Promise<string | undefined>>();
const IMAGE_FETCH_TIMEOUT_MS = 8000;

function contentTypeFromUrl(url: string) {
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

export async function imageUrlToDataUrl(url: string | null | undefined) {
  if (!url) {
    return undefined;
  }

  const cached = imageDataUrlCache.get(url);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        return undefined;
      }

      const contentType = response.headers.get('content-type')?.split(';')[0] || contentTypeFromUrl(url);
      const data = Buffer.from(await response.arrayBuffer()).toString('base64');
      return `data:${contentType};base64,${data}`;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  })();

  imageDataUrlCache.set(url, promise);
  return promise;
}
