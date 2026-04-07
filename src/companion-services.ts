/**
 * Companion Services Manager
 *
 * Manages long-running child processes that NanoClaw depends on.
 * Services start when NanoClaw starts and are stopped on shutdown.
 *
 * Auto-restart behaviour:
 *   - Max 3 retries per service
 *   - Exponential backoff: 2s, 4s, 8s
 *   - After 3 failures the service is marked permanently failed (no more retries)
 *
 * To add a new companion service, push an entry to the COMPANIONS array.
 */
import { spawn, ChildProcess } from 'child_process';

import { logger } from './logger.js';

interface CompanionConfig {
  /** Human-readable name used in log messages */
  name: string;
  /** Log prefix for stdout/stderr lines */
  logPrefix: string;
  /** Executable to spawn */
  command: string;
  /** CLI arguments */
  args: string[];
  /** Optional environment variables merged into process.env */
  env?: Record<string, string>;
}

const MAX_RETRIES = 3;
const BACKOFF_MS = [2_000, 4_000, 8_000];

/** Registry of companion services to manage */
const COMPANIONS: CompanionConfig[] = [
  {
    name: 'LinkedIn MCP',
    logPrefix: '[linkedin-mcp]',
    command: 'uvx',
    args: ['linkedin-scraper-mcp', '--transport', 'streamable-http', '--port', '8080'],
  },
];

interface ServiceState {
  config: CompanionConfig;
  process: ChildProcess | null;
  retries: number;
  stopped: boolean;
}

const services: ServiceState[] = [];

function spawnService(state: ServiceState): void {
  const { config } = state;
  const child = spawn(config.command, config.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: config.env ? { ...process.env, ...config.env } : process.env,
  });

  state.process = child;
  logger.info({ service: config.name, pid: child.pid }, `Companion service started`);

  child.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().trimEnd().split('\n');
    for (const line of lines) {
      if (line) logger.info(`${config.logPrefix} ${line}`);
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().trimEnd().split('\n');
    for (const line of lines) {
      if (line) logger.warn(`${config.logPrefix} ${line}`);
    }
  });

  child.on('error', (err) => {
    logger.error({ service: config.name, err }, 'Companion service spawn error');
    state.process = null;
    scheduleRestart(state);
  });

  child.on('close', (code, signal) => {
    if (state.stopped) {
      logger.info(
        { service: config.name, code, signal },
        'Companion service stopped cleanly',
      );
      return;
    }
    logger.warn(
      { service: config.name, code, signal },
      'Companion service exited unexpectedly',
    );
    state.process = null;
    scheduleRestart(state);
  });
}

function scheduleRestart(state: ServiceState): void {
  if (state.stopped) return;

  if (state.retries >= MAX_RETRIES) {
    logger.error(
      { service: state.config.name, retries: state.retries },
      'Companion service exceeded max retries — not restarting',
    );
    return;
  }

  const delayMs = BACKOFF_MS[state.retries] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
  state.retries += 1;

  logger.info(
    { service: state.config.name, retry: state.retries, delayMs },
    'Scheduling companion service restart',
  );

  setTimeout(() => {
    if (!state.stopped) {
      spawnService(state);
    }
  }, delayMs);
}

/**
 * Start all companion services.
 * Call early in the NanoClaw startup sequence.
 */
export function startCompanionServices(): void {
  for (const config of COMPANIONS) {
    const state: ServiceState = {
      config,
      process: null,
      retries: 0,
      stopped: false,
    };
    services.push(state);
    spawnService(state);
  }
}

/**
 * Stop all companion services gracefully.
 * Sends SIGTERM and waits up to 5 seconds, then SIGKILL.
 * Call in the NanoClaw shutdown handler.
 */
export async function stopCompanionServices(): Promise<void> {
  const GRACEFUL_TIMEOUT_MS = 5_000;

  await Promise.all(
    services.map((state) => {
      state.stopped = true;
      const child = state.process;
      if (!child || child.exitCode !== null) return Promise.resolve();

      return new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          logger.warn(
            { service: state.config.name },
            'Companion service did not exit after SIGTERM, sending SIGKILL',
          );
          try {
            child.kill('SIGKILL');
          } catch {
            // already gone
          }
          resolve();
        }, GRACEFUL_TIMEOUT_MS);

        child.once('close', () => {
          clearTimeout(timer);
          resolve();
        });

        try {
          child.kill('SIGTERM');
        } catch {
          clearTimeout(timer);
          resolve();
        }
      });
    }),
  );

  logger.info('All companion services stopped');
}
