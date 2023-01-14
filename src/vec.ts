export interface Vec2 {
  x: number;
  y: number;
}

export function vec2add(a: Vec2, b: Vec2): Vec2 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

export function vec2sub(a: Vec2, b: Vec2): Vec2 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

export function vec2dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx*dx + dy*dy);
}

export function vec2scale(v: Vec2, s: number): Vec2 {
  return {
    x: s*v.x,
    y: s*v.y,
  };
}

export function vec2lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: a.x + t*(b.x - a.x),
    y: a.y + t*(b.y - a.y),
  };
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function pointInRect(p: Vec2, r: Rect): boolean {
  return ((p.x >= r.left) && (p.x < (r.left+r.width)) && (p.y > r.top) && (p.y < (r.top+r.height)));
}

// scale before translate
export interface STXform {
  s: number;
  tx: number;
  ty: number;
}

export function applySTXform(xform: STXform, p: Vec2): Vec2 {
  return {
    x: xform.s*p.x + xform.tx,
    y: xform.s*p.y + xform.ty,
  };
}

export function applyInvSTXform(xform: STXform, p: Vec2): Vec2 {
  return {
    x: (p.x - xform.tx)/xform.s,
    y: (p.y - xform.ty)/xform.s,
  };
}

// compose such that when applied to a vector, its the equivalent of
// a being applied and then b
export function composeSTXforms(a: STXform, b: STXform): STXform {
  return {
    s: a.s*b.s,
    tx: b.s*a.tx + b.tx,
    ty: b.s*a.ty + b.ty,
  };
}
