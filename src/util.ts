export class InvariantError extends Error {
  constructor(m?: string) {
    super(m);
    Object.setPrototypeOf(this, InvariantError.prototype);
  }
}

export function invariant(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new InvariantError(msg);
  }
}

function gen32Random(): string {
  return Math.random().toString(16).substring(2, 10);
}

export function genUidRandom(): string {
  return gen32Random() + gen32Random();
}

let seqNum = 1;
export function nextSeqNum(): number {
  const result = seqNum;
  seqNum++;
  return result;
}

// is a an ancestor of b?
export function nodeIsAncestor(a: Node, b: Node): boolean {
  let n: Node | null = b;
  while (n) {
    if (a === b) {
      return true;
    }
    n = n.parentNode;
  }
  return false;
}

export interface ClientXY {
  readonly clientX: number;
  readonly clientY: number;
}

export function getElemByPosData(p: ClientXY, prop: string): HTMLElement | undefined {
  const elem = document.elementFromPoint(p.clientX, p.clientY);

  if (elem) {
    let n: Node | null = elem;
    while (n) {
      if ((n instanceof HTMLElement) && (n.dataset[prop])) {
        return n as HTMLElement;
      }
      n = n.parentNode;
    }
  }

  return undefined;
}

export function arrRemoveElemByValue<T>(arr: ReadonlyArray<T>, v: T): Array<T> {
  const idx = arr.indexOf(v);
  if (idx < 0) {
    throw new Error('did not find value in array');
  }

  return arr.slice(0, idx).concat(arr.slice(idx+1));
}

export function arrReplaceElemByValue<T>(arr: ReadonlyArray<T>, v: T, newV: T): Array<T> {
  const idx = arr.indexOf(v);
  if (idx < 0) {
    throw new Error('did not find value in array');
  }

  return arr.slice(0, idx).concat([newV], arr.slice(idx+1));
}
