import { EVType, ExtensionID } from "./common";

interface TemplatePool {
  readonly id: string;
  readonly type: EVType;
}

export type TemplateTab =
  {
    readonly kind: 'pool';
    readonly id: string;
    readonly name: string;
    readonly pool: string;
  } | {
    readonly kind: 'empty';
    readonly id: string;
    readonly name: string;
  }

export interface Template {
  readonly pools: ReadonlyArray<TemplatePool>;
  readonly tabs: ReadonlyArray<TemplateTab>;
  readonly previewers: {[key: EVType]: ExtensionID};
}
