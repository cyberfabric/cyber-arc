import { state } from './state';
import type { CliDetection } from '../types';

export const MIN_CLI_VERSION = '0.2.0';

function detectCli(): CliDetection {
  if (!state.cliDetected) {
    return { found: false };
  }
  return {
    found: true,
    version: state.cliVersion,
    path: state.cliPath,
    compatible: state.cliVersion === MIN_CLI_VERSION,
  };
}

function toggleCli(): void {
  state.cliDetected = !state.cliDetected;
  state.emit('cli');
}

function setCliDetected(detected: boolean, version?: string): void {
  state.cliDetected = detected;
  if (version !== undefined) state.cliVersion = version;
  state.emit('cli');
}

export const system = { detectCli, toggleCli, setCliDetected, MIN_CLI_VERSION };
