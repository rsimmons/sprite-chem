import { EVTypeId } from "./type";
import { Creator } from "./creator";
import { Editor } from "./editor";
import { Previewer } from "./previewer";
import { Runner } from "./runner";
import { EVWrapper } from "./ev";

interface TemplatePool {
  readonly globalId: string;
  readonly typeId: EVTypeId;
}

export type TemplateTab =
  {
    readonly kind: 'pool';
    readonly tabId: string;
    readonly name: string;
    readonly globalId: string;
  } | {
    readonly kind: 'empty';
    readonly tabId: string;
    readonly name: string;
  }

export interface Template {
  readonly pools: ReadonlyArray<TemplatePool>;
  readonly tabs: ReadonlyArray<TemplateTab>;

  readonly creators: {[key: EVTypeId]: ReadonlyArray<Creator<any, any>>}; // first one is default creator
  readonly previewers: {[key: EVTypeId]: Previewer<any>};
  readonly editors: {[key: EVTypeId]: {
    readonly ext: Editor<any, any>;
    readonly config?: any;
  }};

  readonly outputPanel: {
    readonly runner: {
      readonly ext: Runner;
      readonly singleGlobalIds: {[key: string]: string};
      readonly poolGlobalIds?: {[key: string]: string};
    },
    readonly stoppedEditor: { // editor extension to show in output panel when program is stopped
      readonly typeId: EVTypeId;
      readonly globalId: string;
    };
  };

  readonly initEVs: () => Promise<{
    readonly singles: ReadonlyMap<string, EVWrapper<any>>;
    readonly pools: ReadonlyMap<string, ReadonlyArray<EVWrapper<any>>>;
  }>;
}
