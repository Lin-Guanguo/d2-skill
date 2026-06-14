import { writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import { createCommandAuditArtifactPath } from '../audit/command-audit.js';
import { loadRenderFont } from './font.js';
import type { RenderArtifact, RenderDocument } from './render-document.js';
import { renderDocumentToSvg } from './satori-renderer.js';

async function writeBinaryFile(path: string, value: Buffer) {
  await writeFile(path, value, { flag: 'wx', mode: 0o600 });
  return path;
}

async function svgToPng(svg: string) {
  const font = await loadRenderFont();
  const image = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: {
      loadSystemFonts: true,
      fontFiles: [font.path],
      defaultFontFamily: font.name,
    },
  }).render();

  return image.asPng();
}

export async function writeRenderImage(document: RenderDocument) {
  const svg = await renderDocumentToSvg(document);
  const path = await createCommandAuditArtifactPath('image', 'png');

  return {
    type: 'image/png',
    path: await writeBinaryFile(path, await svgToPng(svg)),
    preset: document.preset.name,
    width: document.preset.width,
    height: document.preset.height,
  } satisfies RenderArtifact;
}
