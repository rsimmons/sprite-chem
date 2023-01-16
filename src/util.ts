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
