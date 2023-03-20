import { EVID, EVInfo, EVType } from "./common";

export interface RunnerContext {
  /**
   * The container element that the runner is to install itself into.
   * The container is expected to be a block container and to have
   * a definite size, i.e. the container determines the size of the runner.
   */
  readonly container: HTMLElement;

  readonly singles: ReadonlyMap<string, EVID>;
  readonly pools: ReadonlyMap<string, ReadonlyArray<EVID>>;
  readonly evInfos: ReadonlyMap<EVID, EVInfo>;
}

export interface RunnerReturn {
  /**
   * A function to tell the runner to clean up before it is removed from
   * the document. The runner need not remove its HTML from the container.
   */
  readonly cleanup?: () => void;
}

export interface Runner {
  readonly create: (context: RunnerContext) => RunnerReturn;
}
