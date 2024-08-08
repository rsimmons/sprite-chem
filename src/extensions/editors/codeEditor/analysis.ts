import { invariant } from "../../../util";
import { ASTNode, DeclNode, EmitNode, EqNode, NodeId, ProgramNode, ValueExprNode, WhenNode, isDeclNode, isValueExprNode } from "../../types/code";

// the externally-visible (caller-visible) interface to a function. similar to a function-type
export interface FnExtIface {
  readonly tmpl: string;
  readonly params: ReadonlyArray<{
    readonly pid: string;
    readonly type: Type;
  }>;
  readonly retType: Type; // no named returns for now
}

export type Type =
  | {type: 'Unknown'}
  | {type: 'Any'}
  | {type: 'Num'}
  | {type: 'Text'}
  | {type: 'Bool'}
  | {type: 'Fn', iface: FnExtIface}
  | {type: 'Vec2'}
  | {type: 'EV', typeId: string}
  | {type: 'UnitEvent'} // for now
  ;

// might `a` be a subtype of `b`?
// For types that can "vary" (e.g. Unknown or Any), this is optimisitc,
// i.e. it will return false only if there is no way that `a` could
// be a subtype of `b`.
function mightBeSubtype(a: Type, b: Type): boolean {
  invariant(a.type !== 'Any'); // I feel like this shouldn't happen
  if (a.type === 'Unknown') {
    return true;
  }

  switch (b.type) {
    case 'Unknown':
      return true;

    case 'Any':
      return true;

    case 'Fn':
      return false;

    case 'EV':
      return (a.type === 'EV') && (a.typeId === b.typeId);

    case 'Num':
    case 'Text':
    case 'Bool':
    case 'Vec2':
    case 'UnitEvent':
      return (a.type === b.type);
  }
}

export interface OuterStaticEnv {
  readonly varType: ReadonlyMap<NodeId, Type>;
  readonly varName: ReadonlyMap<NodeId, string>;
  readonly namedReturns: ReadonlySet<NodeId>; // node ids representing variables that can be "targeted" by returns
}

type AnalysisError = string;

// note that a var def may be inconsistent, e.g. if a variable is eq-bound twice,
interface VarDef {
  valid: boolean;
  readonly eqBinds: Array<EqNode>;
  readonly whenEmits: Array<{when: WhenNode, emit: EmitNode}>;
  // readonly whenSets: Array<WhenNode>;
  // TODO: include explicit "mutable" declarations once we have them
}

// the result of analyzing an environment (i.e. the body of a function, or the top-level program)
// or disconnected subtree (e.g. in the palette)
export interface Analysis {
  // should be set for all local nodes
  readonly nodeMap: ReadonlyMap<NodeId, ASTNode>;

  // set for all local and outer (cumulative) nodes. this should be used instead of
  // nodeMap to find variable names, built-in var names do not have nodes
  readonly varName: ReadonlyMap<NodeId, string>;

  // set for all local and outer (cumulative) value expr nodes and bind expr nodes,
  // as well as built-in variables. may be Unknown if can't be inferred.
  readonly nodeType: ReadonlyMap<NodeId, Type>;

  // represents the type expected at the position occupied by the node
  // should be present for all local value expr nodes, though may be Unknown
  readonly expectedType: ReadonlyMap<NodeId, Type>;

  // set for all locally-created var ids and named-return var ids.
  // a var definition is basically the set of declarations and mutations that define its value.
  // this could also be thought of as a var's direct "dependencies" in terms of evaluation.
  readonly varDef: ReadonlyMap<NodeId, VarDef>;

  readonly errors: ReadonlyMap<NodeId, ReadonlyArray<AnalysisError>>;

  // inactive nodes are those that cannot "execute" at runtime because they depend on
  // nodes that are holes or that are themselves inactive. e.g. a function
  // application is inactive if any of its arguments are inactive.
  // bind expressions are inactive if they could not "receive" a value at runtime.
  readonly inactive: ReadonlySet<NodeId>;
}

interface MutableAnalysis {
  readonly nodeMap: Map<NodeId, ASTNode>;
  readonly varName: Map<NodeId, string>;
  readonly nodeType: Map<NodeId, Type>;
  readonly expectedType: Map<NodeId, Type>;
  readonly varDef: Map<NodeId, VarDef>;
  readonly errors: Map<NodeId, Array<AnalysisError>>;
  readonly inactive: Set<NodeId>;
}

function initMutableAnalysis(outerEnv: OuterStaticEnv): MutableAnalysis {
  return {
    nodeMap: new Map(),
    varName: new Map(outerEnv.varName),
    nodeType: new Map(outerEnv.varType),
    expectedType: new Map(),
    varDef: new Map(),
    errors: new Map(),
    inactive: new Set(),
  };
}

function addError(analysis: MutableAnalysis, nid: NodeId, error: AnalysisError): void {
  if (!analysis.errors.has(nid)) {
    analysis.errors.set(nid, []);
  }
  analysis.errors.get(nid)!.push(error);
}

function analyzeValueExpr(expr: ValueExprNode, expectedType: Type, analysis: MutableAnalysis): void {
  let exprType: Type;
  switch (expr.type) {
    case 'Hole': {
      exprType = {type: 'Unknown'};
      analysis.inactive.add(expr.nid);
      break;
    }

    case 'Literal': {
      switch (expr.sub.type) {
        case 'number': {
          exprType = {type: 'Num'};
          break;
        }

        case 'text': {
          exprType = {type: 'Text'};
          break;
        }

        case 'boolean': {
          exprType = {type: 'Bool'};
          break;
        }

        case 'ev': {
          exprType = {type: 'EV', typeId: expr.sub.value.typeId};
          break;
        }
      }
      break;
    }

    case 'VarRef': {
      // TODO: need to traverse here

      const varType = analysis.nodeType.get(expr.refId);
      if (varType === undefined) {
        // TODO: I think this should be an exception
        addError(analysis, expr.nid, 'unknown variable');
        exprType = {type: 'Unknown'};
        analysis.inactive.add(expr.nid);
      } else {
        if (analysis.inactive.has(expr.refId)) {
          analysis.inactive.add(expr.nid);
        }
        exprType = varType;
      }
      break;
    }

    case 'FnApp': {
      const fnType = analysis.nodeType.get(expr.fn);
      if (fnType === undefined) {
        addError(analysis, expr.nid, 'unknown function');
        exprType = {type: 'Unknown'};
      } else {
        if (fnType.type !== 'Fn') {
          addError(analysis, expr.nid, 'not a function');
          exprType = {type: 'Unknown'};
        } else {
          const fnIface = fnType.iface;
          let anyArgsInactive = false;
          for (const [pid, argExpr] of expr.args) {
            const param = fnIface.params.find(p => p.pid === pid);
            invariant(param !== undefined);
            analyzeValueExpr(argExpr, param.type, analysis);
            if (analysis.inactive.has(argExpr.nid)) {
              anyArgsInactive = true;
            }
          }

          exprType = fnIface.retType;
          if (anyArgsInactive) {
            analysis.inactive.add(expr.nid);
          }
        }
      }
      break;
    }
  }

  analysis.nodeType.set(expr.nid, exprType);
  analysis.expectedType.set(expr.nid, expectedType);
  if (!mightBeSubtype(exprType, expectedType)) {
    addError(analysis, expr.nid, 'type mismatch');
  }
}

function analyzeDecl(decl: DeclNode, outerEnv: OuterStaticEnv, analysis: MutableAnalysis): void {
  switch (decl.type) {
    case 'Eq': {
      let expectedType: Type;
      switch (decl.lhs.type) {
        case 'VarRef': {
          if (outerEnv.namedReturns.has(decl.lhs.refId)) {
            const vd = analysis.varDef.get(decl.lhs.refId);
            invariant(vd !== undefined);
            if (vd.valid) {
              const varType = analysis.nodeType.get(decl.lhs.refId);
              invariant(varType !== undefined);
              expectedType = varType;
            } else {
              // LHS is invalid, but we can still analyze RHS
              expectedType = {type: 'Any'};
            }
          } else {
            // LHS is invalid, but we can still analyze RHS
            addError(analysis, decl.lhs.nid, 'cannot bind to existing variable unless it is a named return');
            expectedType = {type: 'Any'};
          }
          break;
        }

        case 'VarName': {
          expectedType = {type: 'Any'};
          break;
        }

        case 'Hole': {
          expectedType = {type: 'Any'};
          analysis.inactive.add(decl.lhs.nid);
          break;
        }
      }

      analyzeValueExpr(decl.rhs, expectedType, analysis);

      // determine if this is inactive
      if (analysis.inactive.has(decl.rhs.nid) || analysis.inactive.has(decl.lhs.nid)) {
        analysis.inactive.add(decl.nid);
        analysis.inactive.add(decl.lhs.nid);
      }

      break;
    }

    case 'When': {
      analyzeValueExpr(decl.evts, {type: 'UnitEvent'}, analysis);

      // determine if when decl is inactive
      if (analysis.inactive.has(decl.evts.nid)) {
        analysis.inactive.add(decl.nid);
      }

      for (const stmt of decl.stmts) {
        switch (stmt.type) {
          case 'EmitUnit': {
            analyzeValueExpr(stmt.evts, {type: 'UnitEvent'}, analysis);
            if (analysis.inactive.has(stmt.evts.nid)) {
              analysis.inactive.add(stmt.nid);
            }
            break;
          }

          case 'Eq': {
            throw new Error('unimplemented');
          }

          default:
            throw new Error('unimplemented');
        }
      }
      break;
    }

    default:
      throw new Error('unimplemented');
  }
}

function getVarDef(analysis: MutableAnalysis, nid: NodeId): VarDef {
  const vd = analysis.varDef.get(nid);
  if (vd === undefined) {
    const nvd: VarDef = {
      valid: true,
      eqBinds: [],
      whenEmits: [],
    };
    analysis.varDef.set(nid, nvd);
    return nvd;
  } else {
    return vd;
  }
}

function validateVarDefs(analysis: MutableAnalysis): void {
  for (const [, vd] of analysis.varDef) {
    if (vd.eqBinds.length > 1) {
      for (const eq of vd.eqBinds) {
        addError(analysis, eq.nid, 'variable is bound more than once');
      }
      vd.valid = false;
    }
    if ((vd.eqBinds.length > 0) && (vd.whenEmits.length > 0)) {
      for (const eq of vd.eqBinds) {
        addError(analysis, eq.nid, 'variable cannot be emitted to and also bound');
      }
      for (const {emit} of vd.whenEmits) {
        addError(analysis, emit.nid, 'variable cannot be emitted to and also bound');
      }
      vd.valid = false;
    }
  }
}

function analyzeDeclVarDefs(decl: DeclNode, outerEnv: OuterStaticEnv, analysis: MutableAnalysis): void {
  switch (decl.type) {
    case 'Eq': {
      switch (decl.lhs.type) {
        case 'VarRef': {
          const vd = getVarDef(analysis, decl.lhs.refId);
          vd.eqBinds.push(decl);
          break;
        }

        case 'VarName': {
          throw new Error('unimplemented');
        }

        case 'Hole': {
          break;
        }
      }
      break;
    }

    case 'When': {
      for (const stmt of decl.stmts) {
        switch (stmt.type) {
          case 'EmitUnit':
          case 'EmitValue': {
            switch (stmt.evts.type) {
              case 'VarRef': {
                const evtsId = stmt.evts.refId;
                const vd = getVarDef(analysis, evtsId);
                vd.whenEmits.push({when: decl, emit: stmt});
                break;
              }

              case 'Hole':
                break;

              default:
                throw new Error('unimplemented');
            }

            invariant(stmt.type === 'EmitUnit'); // TODO: implement EmitValue

            break;
          }

          case 'Eq': {
            throw new Error('unimplemented');
          }

          default:
            throw new Error('unimplemented');
        }
      }
      break;
    }

    default:
      throw new Error('unimplemented');
  }
}

function analyzeDeclList(decls: ReadonlyArray<DeclNode>, outerEnv: OuterStaticEnv): Analysis {
  const analysis = initMutableAnalysis(outerEnv);

  // note that in this first pass, we ignore many kinds of potential errors,
  // and are only concerned with building up the varDef map
  for (const decl of decls) {
    analyzeDeclVarDefs(decl, outerEnv, analysis);
  }

  validateVarDefs(analysis);

  for (const decl of decls) {
    analyzeDecl(decl, outerEnv, analysis);
  }

  return analysis
}

export function analyzeProgram(prog: ProgramNode, outerEnv: OuterStaticEnv): Analysis {
  return analyzeDeclList(prog.decls, outerEnv);
}

export function analyzePaletteNode(node: ASTNode, outerEnv: OuterStaticEnv): Analysis {
  const analysis = initMutableAnalysis(outerEnv);

  if (isValueExprNode(node)) {
    analyzeValueExpr(node, {type: 'Any'}, analysis);
  } else if (isDeclNode(node)) {
    analyzeDeclVarDefs(node, outerEnv, analysis);
    validateVarDefs(analysis);
    analyzeDecl(node, outerEnv, analysis);
  } // TODO: analyze statements

  return analysis;
}
