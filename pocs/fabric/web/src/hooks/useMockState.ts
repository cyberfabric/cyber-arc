import { useEffect, useReducer } from 'react';
import { state, type StateChannel } from '../mock/state';

/** Subscribes to one or more state channels; forces re-render when any emits. */
export function useMockState(channels: StateChannel[]): void {
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const fn = (): void => forceUpdate();
    for (const c of channels) state.on(c, fn);
    // Mock state has no off() API; it's single-app, leak is acceptable for PoC.
    // If needed we could extend state.off() later.
  }, [channels.join('|')]);
}
