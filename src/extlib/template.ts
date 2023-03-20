import { EVType, ExtensionID } from "./common";

interface TemplatePool {
  readonly globalId: string;
  readonly type: EVType;
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

  readonly creators: {[key: EVType]: ReadonlyArray<ExtensionID>}; // first one is default creator
  readonly previewers: {[key: EVType]: ExtensionID};
  readonly editors: {[key: EVType]: ExtensionID};

  readonly outputPanel: {
    readonly runner: {
      readonly extId: ExtensionID;
      readonly singleGlobalIds: {[key: string]: string};
      readonly poolGlobalIds?: {[key: string]: string};
    },
    readonly stoppedEditor: { // editor extension to show in output panel when program is stopped
      readonly type: EVType;
      // readonly extId: ExtensionID;
      readonly globalId: string;
    };
  };
}
