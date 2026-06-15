import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { resultEnvelope } from '../result.js';

export const DEFAULT_BUNGIE_API_MODULES = [
  'app',
  'communitycontent',
  'destiny2',
  'fireteam',
  'forum',
  'groupv2',
  'social',
  'tokens',
  'trending',
  'user',
];

interface SourceFile {
  path: string;
  text: string;
}

interface SourceImport {
  module: string;
  importedName: string;
  localName: string;
  file: string;
}

interface ModuleEndpointDefinitions {
  module: string;
  endpoints: string[];
  error?: string;
}

interface ApiCoverageOptions {
  modules?: string[];
  sourceRoot?: string;
  now?: () => Date;
}

const IMPORT_PATTERN =
  /import\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+['"]bungie-api-ts\/([^'"]+)['"];?/g;

function operationKind(name: string) {
  return /^(get|search)/.test(name) ? 'read' : 'write-or-action';
}

function parseImportSpec(spec: string) {
  const trimmed = spec.trim();
  if (!trimmed || trimmed.startsWith('type ')) {
    return undefined;
  }

  const [importedName, localName] = trimmed.split(/\s+as\s+/);
  return {
    importedName: importedName.trim(),
    localName: (localName ?? importedName).trim(),
  };
}

export function parseBungieSdkImports(file: SourceFile) {
  const imports: SourceImport[] = [];
  for (const match of file.text.matchAll(IMPORT_PATTERN)) {
    const [, typeOnly, specList, module] = match;
    if (typeOnly) {
      continue;
    }

    for (const rawSpec of specList.split(',')) {
      const parsed = parseImportSpec(rawSpec);
      if (!parsed) {
        continue;
      }

      imports.push({
        module,
        importedName: parsed.importedName,
        localName: parsed.localName,
        file: file.path,
      });
    }
  }
  return imports;
}

async function sourceFiles(root: string, current = root): Promise<SourceFile[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(current, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(root, path);
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts')) {
      return [];
    }
    return [{
      path: relative(root, path),
      text: await readFile(path, 'utf8'),
    }];
  }));
  return files.flat();
}

async function loadModuleEndpoints(module: string): Promise<ModuleEndpointDefinitions> {
  try {
    const sdkModule = await import(`bungie-api-ts/${module}`) as Record<string, unknown>;
    return {
      module,
      endpoints: Object.keys(sdkModule)
        .filter((name) => typeof sdkModule[name] === 'function')
        .sort(),
    };
  } catch (error) {
    return {
      module,
      endpoints: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function buildApiCoverage(
  definitions: ModuleEndpointDefinitions[],
  imports: SourceImport[],
  options: Required<Pick<ApiCoverageOptions, 'modules' | 'sourceRoot' | 'now'>>,
) {
  const modules = definitions.map((definition) => {
    const endpointNames = new Set(definition.endpoints);
    const endpointImports = imports
      .filter((item) => item.module === definition.module && endpointNames.has(item.importedName));
    const importsByEndpoint = new Map<string, SourceImport[]>();
    for (const item of endpointImports) {
      importsByEndpoint.set(item.importedName, [
        ...(importsByEndpoint.get(item.importedName) ?? []),
        item,
      ]);
    }

    const usedSdkEndpoints = [...importsByEndpoint.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, rows]) => ({
        name,
        operationKind: operationKind(name),
        files: rows
          .map((row) => ({
            path: row.file,
            ...(row.localName === row.importedName ? {} : { localName: row.localName }),
          }))
          .sort((left, right) => left.path.localeCompare(right.path)),
      }));
    const unusedSdkEndpoints = definition.endpoints
      .filter((name) => !importsByEndpoint.has(name))
      .map((name) => ({
        name,
        operationKind: operationKind(name),
      }));

    return {
      module: definition.module,
      sdkEndpointCount: definition.endpoints.length,
      usedEndpointCount: usedSdkEndpoints.length,
      unusedEndpointCount: unusedSdkEndpoints.length,
      ...(definition.error ? { error: definition.error } : {}),
      usedSdkEndpoints,
      unusedSdkEndpoints,
    };
  });
  const summary = modules.reduce(
    (acc, module) => ({
      modules: acc.modules + 1,
      sdkEndpoints: acc.sdkEndpoints + module.sdkEndpointCount,
      usedSdkEndpoints: acc.usedSdkEndpoints + module.usedEndpointCount,
      unusedSdkEndpoints: acc.unusedSdkEndpoints + module.unusedEndpointCount,
      modulesWithErrors: acc.modulesWithErrors + (module.error ? 1 : 0),
    }),
    {
      modules: 0,
      sdkEndpoints: 0,
      usedSdkEndpoints: 0,
      unusedSdkEndpoints: 0,
      modulesWithErrors: 0,
    },
  );

  return {
    ok: summary.modulesWithErrors === 0,
    ...resultEnvelope('api-coverage', {
      query: {
        modules: options.modules,
        sourceRoot: options.sourceRoot,
      },
      source: {
        sdkPackage: 'bungie-api-ts',
        sourceRoot: options.sourceRoot,
        staticSourceScan: true,
      },
    }),
    checkedAt: options.now().toISOString(),
    summary,
    fallback: {
      command: 'api request',
      readOnlyGet: true,
      note: 'Fallback can query official /Platform/... GET endpoints but is not a stable domain wrapper.',
    },
    modules,
  };
}

export async function getApiCoverage(options: ApiCoverageOptions = {}) {
  const modules = options.modules?.length ? options.modules : DEFAULT_BUNGIE_API_MODULES;
  const sourceRoot = options.sourceRoot ?? 'src';
  const [definitions, files] = await Promise.all([
    Promise.all(modules.map((module) => loadModuleEndpoints(module))),
    sourceFiles(sourceRoot),
  ]);
  const imports = files.flatMap(parseBungieSdkImports);

  return buildApiCoverage(definitions, imports, {
    modules,
    sourceRoot,
    now: options.now ?? (() => new Date()),
  });
}
