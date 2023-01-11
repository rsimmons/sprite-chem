export interface Sprite {
  readonly url: string;
  data:
    {
      readonly type: 'loading',
    } | {
      readonly type: 'loaded',
      readonly bitmap: ImageBitmap,
      // the following are if the image is scaled such that max dim is 1
      readonly scaledWidth: number;
      readonly scaledHeight: number;
    };
}

// returns sprite immediately but underlying bitmap is loaded async
export function spriteFromURL(url: string): Sprite {
  const sprite: Sprite = {
    url,
    data: {type: 'loading'},
  };

  (async () => {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    const invMaxDim = 1/Math.max(bitmap.width, bitmap.height)
    sprite.data = {
      type: 'loaded',
      bitmap,
      scaledWidth: invMaxDim*bitmap.width,
      scaledHeight: invMaxDim*bitmap.height,
    };
  })();

  return sprite;
}

