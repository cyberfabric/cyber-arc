import { useState } from 'react';
import fabric from '../../fabricLib';
import { useMockState } from '../../hooks/useMockState';
import CliInstallDialog from './CliInstallDialog';

export default function CliStatus(): JSX.Element {
  useMockState(['cli']);
  const det = fabric.system.detectCli();
  const [showInstall, setShowInstall] = useState(false);

  if (det.found) {
    return (
      <span className="cli-status cli-status--ok" title={`Path: ${det.path ?? 'unknown'}`}>
        ✓ CLI {det.version}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className="cli-status cli-status--missing"
        onClick={() => setShowInstall(true)}
      >
        ⚠ Install CLI
      </button>
      {showInstall && <CliInstallDialog onClose={() => setShowInstall(false)} />}
    </>
  );
}
