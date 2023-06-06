import { Sprite } from '../types/sprite';
import { Previewer } from '../../extlib/previewer';

function createImage(container: HTMLElement, url: string): void {
  container.innerHTML = `<div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center"><img src="${url}" style="display: block; max-width: 100%; max-height: 100%" /></div>`;
}

async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof(reader.result) !== 'string') {
        throw new Error('blobToDataURL reader result not string');
      }
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const spritePreviewer: Previewer<Sprite> = {
  create: (context) => {
    const updateImage = async (blob: Blob): Promise<void> => {
      const url = await blobToDataURL(blob);
      createImage(context.container, url);
    }

    updateImage(context.ev.value.imageBlob); // don't await

    // TODO: subscribe to ev changes

    return {};
  },
};

export default spritePreviewer;
