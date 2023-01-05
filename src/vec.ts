export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
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

export function pointInRect(p: Vec2, r: Rect): boolean {
  return ((p.x >= r.left) && (p.x < (r.left+r.width)) && (p.y > r.top) && (p.y < (r.top+r.height)));
}
