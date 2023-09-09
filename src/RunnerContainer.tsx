import { useEffect, useRef } from 'react';
import { invariant } from './util';
import { TEMPLATE } from './config';
import { RunnerReturn } from './extlib/runner';
import { AppDispatch, AppState } from './state';
import { useConstant } from './utilReact';
import './RunnerContainer.css';
import { EVWrapper } from './extlib/ev';

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

    const runner = runnerConfig.ext;
    invariant(runner);

    const refRoots: Array<EVWrapper<any>> = [];

    const singles: Map<string, EVWrapper<any>> = new Map();
    for (const [key, globalId] of Object.entries(runnerConfig.singleGlobalIds)) {
      const ev = state.singles.get(globalId);
      invariant(ev);
      refRoots.push(ev);
      singles.set(key, ev);
    }

    const pools: Map<string, ReadonlyArray<EVWrapper<any>>> = new Map();
    if (runnerConfig.poolGlobalIds) {
      for (const [key, globalId] of Object.entries(runnerConfig.poolGlobalIds)) {
        const evs = state.pools.get(globalId);
        invariant(evs);
        refRoots.push(...evs);
        pools.set(key, evs);
      }
    }

    invariant(!runnerReturnRef.current);
    runnerReturnRef.current = runner.create({
      container: containerRef.current,
      singles,
      pools,
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
