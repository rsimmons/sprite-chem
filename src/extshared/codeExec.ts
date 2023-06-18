import { DeclNode, NodeId, ProgramNode, ValueExprNode } from "../extensions/types/code";
import { invariant } from "../util";

export interface DynamicContext {
  readonly nidVal: Map<NodeId, any>;
}

function evalValueExpr(expr: ValueExprNode, dynCtx: DynamicContext): any {
  switch (expr.type) {
    case 'Hole':
      throw new Error('hole');

    case 'Literal':
      return expr.sub.value;

    case 'VarRef':
      return dynCtx.nidVal.get(expr.refId);

    case 'FnApp': {
      const fnVal = dynCtx.nidVal.get(expr.fn);
      const argVals = [...expr.args.values()].map(argExpr => evalValueExpr(argExpr, dynCtx));
      const retVal = fnVal(...argVals);
      return retVal;
    }
  }
}

function applyDecl(decl: DeclNode, dynCtx: DynamicContext): void {
  switch (decl.type) {
    case 'Eq': {
      let targetNid: NodeId;
      switch (decl.lhs.type) {
        case 'VarRef':
          targetNid = decl.lhs.refId;
          break;

        case 'VarName':
          targetNid = decl.lhs.nid;
          break;

        default:
          throw new Error('unimplemented');
      }
      const rhsVal = evalValueExpr(decl.rhs, dynCtx);
      dynCtx.nidVal.set(targetNid, rhsVal);
      break;
    }

    default:
      throw new Error('unimplemented');
  }
}

export function interpretProg(prog: ProgramNode, dynCtx: DynamicContext): void {
  for (const decl of prog.decls) {
    applyDecl(decl, dynCtx);
  }
}
