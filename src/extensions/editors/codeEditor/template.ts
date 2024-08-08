/**
 * This contains code related to the "template", which is currently hard-coded
 * to be the "sprite world" template. Eventually that should be factored out
 * and made configurable.
 */

import { ASTNode, NodeId } from "../../types/code";
import { Analysis, FnExtIface, OuterStaticEnv, Type, analyzePaletteNode } from "./analysis";

function makeFnApp(nid: NodeId, fnNid: NodeId, fnIface: FnExtIface): ASTNode {
  return {
    type: 'FnApp',
    nid,
    fn: fnNid,
    args: new Map(fnIface.params.map((p, idx) =>
      [p.pid, {
        type: 'Hole',
        nid: `arg${idx}`,
      }],
    )),
  };
}

const fnIfaces: ReadonlyArray<[NodeId, FnExtIface]> = [
  /*
  ['gt', {
    tmpl: '{a|A} is greater than {b|B}',
    params: [
      {pid: 'a', type: {type: 'Num'}},
      {pid: 'b', type: {type: 'Num'}},
    ],
    retType: {type: 'Bool'},
  }],
  ['lt', {
    tmpl: '{a|A} is less than {b|B}',
    params: [
      {pid: 'a', type: {type: 'Num'}},
      {pid: 'b', type: {type: 'Num'}},
    ],
    retType: {type: 'Bool'},
  }],
  */
  ['nearestInstPos', {
    tmpl: 'position of nearest {sprite|Sprite}',
    params: [
      {pid: 'sprite', type: {type: 'EV', typeId: 'sprite'}},
    ],
    retType: {type: 'Vec2'},
  }],
  ['instTouched', {
    tmpl: 'this was touched',
    params: [],
    retType: {type: 'UnitEvent'},
  }],
];

// the "named returns" of the implicit top-level function,
// as [nodeId, name, type]
const namedReturns: ReadonlyArray<[NodeId, string, Type]> = [
  ['moveTarget', 'move target', {type: 'Vec2'}],
  ['moveSpeed', 'move speed', {type: 'Num'}],
  ['removeInst', 'remove this', {type: 'UnitEvent'}]
];

const varType: Map<NodeId, Type> = new Map();

fnIfaces.forEach(([nid, iface]) => {
  varType.set(nid, {type: 'Fn', iface})
});

const varName: Map<NodeId, string> = new Map();

namedReturns.forEach(([nodeId, name, type]) => {
  varName.set(nodeId, name);
  varType.set(nodeId, type);
});

varName.set('origin', 'origin');
varType.set('origin', {type: 'Vec2'});

export const outerEnv: OuterStaticEnv = {
  varType,
  varName,
  namedReturns: new Set(namedReturns.map(([nodeId, ,]) => nodeId)),
};

const paletteNodes: ReadonlyArray<ASTNode> = [
  ...fnIfaces.map(([nid, iface]) => makeFnApp('palette-'+nid, nid, iface)),
  {
    type: 'Eq',
    nid: 'palette-eq',
    lhs: {type: 'Hole', nid: 'eq_lhs'},
    rhs: {type: 'Hole', nid: 'eq_rhs'},
  },
  {
    type: 'Eq',
    nid: 'palette-return-move-target',
    lhs: {type: 'VarRef', nid: 'eq_lhs', refId: 'moveTarget'},
    rhs: {type: 'Hole', nid: 'eq_rhs'},
  },
  {
    type: 'Eq',
    nid: 'palette-return-move-speed',
    lhs: {type: 'VarRef', nid: 'eq_lhs', refId: 'moveSpeed'},
    rhs: {type: 'Hole', nid: 'eq_rhs'},
  },
  {
    type: 'Literal',
    nid: 'palette-number-0',
    sub: {type: 'number', value: 0},
  },
  {
    type: 'Eq',
    nid: 'palette-return-move-speed-num',
    lhs: {type: 'VarRef', nid: 'eq_lhs', refId: 'moveSpeed'},
    rhs: {type: 'Literal', nid: 'eq_rhs', sub: {type: 'number', value: 1}},
  },
  {
    type: 'VarRef',
    nid: 'palette-origin',
    refId: 'origin',
  },
  {
    type: 'When',
    nid: 'palette-when',
    evts: {type: 'Hole', nid: 'when_evts'},
    stmts: [],
  },
  {
    type: 'VarRef',
    nid: 'palette-return-remove-inst',
    refId: 'removeInst',
  },
  {
    type: 'EmitUnit',
    nid: 'palette-emit-unit',
    evts: {type: 'Hole', nid: 'emit_evts'},
  },
  {
    type: 'EmitValue',
    nid: 'palette-emit-value',
    evts: {type: 'Hole', nid: 'emit_evts'},
    expr: {type: 'Hole', nid: 'emit_expr'},
  },
];

export const analyzedPaletteNodes: ReadonlyArray<[ASTNode, Analysis]> = paletteNodes.map(node => [node, analyzePaletteNode(node, outerEnv)]);
