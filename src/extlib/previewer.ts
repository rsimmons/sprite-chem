import { EVWrapper } from "./ev";

export interface PreviewerContext<T> {
  readonly container: HTMLElement;
  readonly ev: EVWrapper<T>;
}

export interface PreviewerReturn<T> {
  readonly cleanup?: () => void;
}

export interface Previewer<T> {
  /**
   * The container element is expected to be a block container and to have
   * a definite size, i.e. the container determines the size of the preview.
   */
  readonly create: (context: PreviewerContext<T>) => PreviewerReturn<T>;
}
