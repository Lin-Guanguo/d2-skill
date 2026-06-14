import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { auditDataDirPath } from '../config/paths.js';

interface AuditState {
  argv: string[];
  command: string;
  fileStem: string;
  cwd: string;
  startedAt: Date;
  stdoutText: string;
  stderrText: string;
  restoreStdout: () => void;
  restoreStderr: () => void;
}

interface AuditStream {
  json?: unknown;
  text?: string;
}

let auditState: AuditState | undefined;

function pad(value: number, width = 2) {
  return String(value).padStart(width, '0');
}

function localDay(date: Date) {
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('');
}

function localTimestamp(date: Date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    pad(date.getMilliseconds(), 3),
  ].join('');
}

function commandFromArgv(argv: readonly string[]) {
  const commandParts: string[] = [];

  for (const arg of argv) {
    if (arg === '--' || arg.startsWith('-')) {
      break;
    }
    commandParts.push(arg);
  }

  return commandParts.join(' ') || 'root';
}

function fileSafeCommand(command: string) {
  return (
    command
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'root'
  );
}

function chunkToString(chunk: unknown) {
  if (typeof chunk === 'string') {
    return chunk;
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk).toString('utf8');
  }
  return String(chunk);
}

function patchWriteStream(
  stream: NodeJS.WriteStream,
  append: (value: string) => void,
) {
  const originalWrite = stream.write.bind(stream);

  stream.write = ((chunk: unknown, ...args: unknown[]) => {
    append(chunkToString(chunk));
    return (originalWrite as (...writeArgs: unknown[]) => boolean)(chunk, ...args);
  }) as typeof stream.write;

  return () => {
    stream.write = originalWrite as typeof stream.write;
  };
}

function parseJsonText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function auditStream(text: string): AuditStream {
  if (text) {
    const parsed = parseJsonText(text);
    return parsed === undefined ? { text } : { json: parsed };
  }

  return {};
}

function auditDayDir(date: Date) {
  const root = auditDataDirPath();
  return join(root, localDay(date));
}

function makeAuditFileStem(startedAt: Date, commandName: string) {
  const dayDir = auditDayDir(startedAt);
  const baseStem = `${localTimestamp(startedAt)}-${commandName}`;

  try {
    mkdirSync(dayDir, { recursive: true, mode: 0o700 });
    const existingNames = new Set(readdirSync(dayDir));
    for (let counter = 0; ; counter += 1) {
      const suffix = counter === 0 ? '' : `-${counter}`;
      const stem = `${baseStem}${suffix}`;
      const existsWithSameStem = [...existingNames].some(
        (name) => name === `${stem}.json` || name.startsWith(`${stem}-`),
      );
      if (!existsWithSameStem) {
        return stem;
      }
    }
  } catch {
    return baseStem;
  }
}

async function writeAuditFile(record: unknown, state: AuditState) {
  const path = commandAuditFilePath(state);
  await mkdir(auditDayDir(state.startedAt), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
}

function commandAuditFilePath(state: AuditState) {
  return join(auditDayDir(state.startedAt), `${state.fileStem}.json`);
}

export function startCommandAudit(argv: string[]) {
  if (auditState) {
    return;
  }

  const startedAt = new Date();
  const command = commandFromArgv(argv);
  const commandName = fileSafeCommand(command);
  auditState = {
    argv,
    command,
    fileStem: makeAuditFileStem(startedAt, commandName),
    cwd: process.cwd(),
    startedAt,
    stdoutText: '',
    stderrText: '',
    restoreStdout: patchWriteStream(process.stdout, (value) => {
      if (auditState) {
        auditState.stdoutText += value;
      }
    }),
    restoreStderr: patchWriteStream(process.stderr, (value) => {
      if (auditState) {
        auditState.stderrText += value;
      }
    }),
  };
}

export function currentCommandAuditFilePath() {
  return auditState ? commandAuditFilePath(auditState) : undefined;
}

export async function createCommandAuditArtifactPath(label: string, extension: string) {
  const state = auditState;
  const now = new Date();
  const dayDir = auditDayDir(state?.startedAt ?? now);
  await mkdir(dayDir, { recursive: true, mode: 0o700 });

  const normalizedLabel = fileSafeCommand(label);
  const normalizedExtension = extension.replace(/^\.+/, '');
  const baseStem = state?.fileStem ?? `${localTimestamp(now)}-${normalizedLabel || 'artifact'}`;

  for (let counter = 0; ; counter += 1) {
    const suffix = counter === 0 ? '' : `-${counter}`;
    const path = join(dayDir, `${baseStem}-${normalizedLabel}${suffix}.${normalizedExtension}`);
    if (!existsSync(path)) {
      return path;
    }
  }
}

export async function finishCommandAudit(exitCode: number) {
  const state = auditState;
  if (!state) {
    return;
  }

  auditState = undefined;
  state.restoreStdout();
  state.restoreStderr();

  const finishedAt = new Date();
  const record = {
    request: {
      argv: state.argv,
      command: state.command,
      cwd: state.cwd,
      startedAt: state.startedAt.toISOString(),
    },
    response: {
      exitCode,
      durationMs: finishedAt.getTime() - state.startedAt.getTime(),
      finishedAt: finishedAt.toISOString(),
      stdout: auditStream(state.stdoutText),
      stderr: auditStream(state.stderrText),
    },
  };

  try {
    await writeAuditFile(record, state);
  } catch {
    // Audit must never change CLI command behavior.
  }
}
