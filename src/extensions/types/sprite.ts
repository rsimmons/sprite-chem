import { LoaderSaver } from "../../extlib/common";

export interface Sprite {
  readonly imageBlob: Blob;
}

export const loaderSaver: LoaderSaver<Sprite> = {
  load: (state) => { throw new Error('unimplemented'); },
  save: (val) => { throw new Error('unimplemented'); },
}
