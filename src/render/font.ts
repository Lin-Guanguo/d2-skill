import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Font } from 'satori';

export interface LoadedRenderFont {
  name: string;
  path: string;
  fonts: Font[];
}

const FONT_FAMILY = 'D2Render';

let loadedFont: Promise<LoadedRenderFont> | undefined;

function findFontPath() {
  const candidates = [
    process.env.D2_RENDER_FONT_PATH,
    '/Library/Fonts/Arial Unicode.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
  ].filter((path): path is string => Boolean(path));
  const seen = new Set<string>();
  for (const path of candidates) {
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);
    if (existsSync(path)) {
      return path;
    }
  }
  return undefined;
}

export async function loadRenderFont() {
  if (loadedFont) {
    return loadedFont;
  }

  loadedFont = (async () => {
    const path = findFontPath();
    if (!path) {
      throw new Error(
        'No render font was found. Set D2_RENDER_FONT_PATH to a local .ttf, .otf, or .woff font file.',
      );
    }

    const data = await readFile(path);
    return {
      name: FONT_FAMILY,
      path,
      fonts: [
        {
          name: FONT_FAMILY,
          data,
          weight: 400,
          style: 'normal',
        },
        {
          name: FONT_FAMILY,
          data,
          weight: 700,
          style: 'normal',
        },
      ],
    };
  })();

  return loadedFont;
}
