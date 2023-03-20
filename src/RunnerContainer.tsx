import { useEffect, useRef } from 'react';
import { EVID, ExtensionID } from './extlib/common';
import { invariant } from './util';
import { EXTENSION_MAP, TEMPLATE } from './config';
import { Runner, RunnerReturn } from './extlib/runner';
import { AppDispatch, AppState, getEvTransitiveRefInfos } from './newState';
import { useConstant } from './utilReact';
import './RunnerContainer.css';

const RunnerContainer: React.FC<{
  readonly state: AppState;
  readonly dispatch: AppDispatch;
}> = ({state, dispatch}) => {
  useConstant(dispatch);

  const containerRef = useRef<HTMLDivElement>(null);
  const runnerReturnRef = useRef<RunnerReturn | null>(null);

  useEffect(() => {
    invariant(containerRef.current);

    const runnerConfig = TEMPLATE.outputPanel.runner;

    const runner = EXTENSION_MAP.get(runnerConfig.extId) as Runner;
    invariant(runner);

    const refRoots: Array<EVID> = [];

    const singles: Map<string, EVID> = new Map();
    for (const [key, globalId] of Object.entries(runnerConfig.singleGlobalIds)) {
      const ei = state.singles.get(globalId);
      invariant(ei);
      refRoots.push(ei);
      singles.set(key, ei);
    }

    const pools: Map<string, ReadonlyArray<EVID>> = new Map();
    if (runnerConfig.poolGlobalIds) {
      for (const [key, globalId] of Object.entries(runnerConfig.poolGlobalIds)) {
        const eis = state.pools.get(globalId);
        invariant(eis);
        refRoots.push(...eis);
        pools.set(key, eis);
      }
    }

    const evInfos = getEvTransitiveRefInfos(state, refRoots);

    invariant(!runnerReturnRef.current);
    runnerReturnRef.current = runner.create({
      container: containerRef.current,
      singles,
      pools,
      evInfos,
    });

    return () => {
      invariant(runnerReturnRef.current);
      if (runnerReturnRef.current.cleanup) {
        runnerReturnRef.current.cleanup();
      }
      runnerReturnRef.current = null;
    };

    // eslint-ignore-next-line react-hooks/exhaustive-deps
  }, []);

  return <div
    ref={containerRef}
    className="RunnerContainer"
  />;
}

export default RunnerContainer;
