import { invariant } from "../../../util";
import { ASTNode, DeclNode, NodeId, ProgramNode, ValueExprNode } from "../../types/code";

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

// is a a subtype of b?
// For types that can "vary" (e.g. Unknown), this is conservative,
// i.e. it will return true only if it will _always_ be a subtype.
function isSubtype(a: Type, b: Type): boolean {
  switch (b.type) {
    case 'Unknown':
      return false; // not sure about this

    case 'Any':
      return true;

    case 'Fn':
      return false;

    case 'Num':
      return (a.type === 'Num');

    case 'Text':
      return (a.type === 'Text');

    case 'Bool':
      return (a.type === 'Bool');

    case 'EV':
      return (a.type === 'EV') && (a.typeId === b.typeId);

    case 'Vec2':
      return (a.type === 'Vec2');

    case 'UnitEvent':
      return (a.type === 'UnitEvent');
  }
}

export interface OuterStaticEnv {
  readonly varType: ReadonlyMap<NodeId, Type>;
  readonly varName: ReadonlyMap<NodeId, string>;
  readonly namedReturns: ReadonlySet<NodeId>; // node ids representing variables that can be "targeted" by returns
}

type AnalysisError = string;

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

  readonly errors: ReadonlyMap<NodeId, ReadonlyArray<AnalysisError>>;

  // inactive nodes are those that will not execute because they depend on
  // nodes that are holes or that are themselves inactive. e.g. a function
  // application is inactive if any of its arguments are inactive.
  readonly inactive: ReadonlySet<NodeId>;
}

interface MutableAnalysis {
  readonly nodeMap: Map<NodeId, ASTNode>;
  readonly varName: Map<NodeId, string>;
  readonly nodeType: Map<NodeId, Type>;
  readonly expectedType: Map<NodeId, Type>;
  readonly errors: Map<NodeId, Array<AnalysisError>>;
  readonly inactive: Set<NodeId>;
}

function initMutableAnalysis(outerEnv: OuterStaticEnv): MutableAnalysis {
  return {
    nodeMap: new Map(),
    varName: new Map(outerEnv.varName),
    nodeType: new Map(outerEnv.varType),
    expectedType: new Map(),
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
      const varType = analysis.nodeType.get(expr.refId);
      if (varType === undefined) {
        addError(analysis, expr.nid, 'unknown variable');
        exprType = {type: 'Unknown'};
      } else {
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
          let anyArgsUnknown = false;
          for (const [pid, argExpr] of expr.args) {
            const param = fnIface.params.find(p => p.pid === pid);
            invariant(param !== undefined);
            analyzeValueExpr(argExpr, param.type, analysis);

            const argType = analysis.nodeType.get(argExpr.nid);
            invariant(argType !== undefined);
            if (argType.type === 'Unknown') {
              anyArgsUnknown = true;
            }
          }

          exprType = anyArgsUnknown ? {type: 'Unknown'} : fnIface.retType;
        }
      }
      break;
    }
  }

  analysis.nodeType.set(expr.nid, exprType);
  analysis.expectedType.set(expr.nid, expectedType);
  if (exprType.type === 'Unknown') {
    analysis.inactive.add(expr.nid);
  } else if (!isSubtype(exprType, expectedType)) {
    addError(analysis, expr.nid, 'type mismatch');
  }
}

function analyzeDeclList(decls: ReadonlyArray<DeclNode>, outerEnv: OuterStaticEnv): Analysis {
  const analysis = initMutableAnalysis(outerEnv);

  const namedReturnStatus: Map<NodeId, 'bound' | 'emitted-to'> = new Map();
  const namedReturnConflicts: Set<NodeId> = new Set();

  for (const decl of decls) {
    switch (decl.type) {
      case 'Eq': {
        switch (decl.lhs.type) {
          case 'VarRef': {
            if (outerEnv.namedReturns.has(decl.lhs.refId)) {
              if (namedReturnStatus.has(decl.lhs.refId)) {
                namedReturnConflicts.add(decl.lhs.refId);
              } else {
                namedReturnStatus.set(decl.lhs.refId, 'bound');
              }
            } else {
              addError(analysis, decl.lhs.nid, 'can only assign to named returns');
            }
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
                  const evtsType = analysis.nodeType.get(evtsId);
                  if (evtsType === undefined) {
                    // should this be in invariant()?
                    addError(analysis, stmt.evts.nid, 'unknown variable');
                  } else {
                    if (evtsType.type !== 'UnitEvent') {
                      addError(analysis, stmt.evts.nid, 'not an event');
                    } else {
                      const status = namedReturnStatus.get(evtsId);
                      if (status === undefined) {
                        namedReturnStatus.set(evtsId, 'emitted-to');
                      } else if (status === 'bound') {
                        addError(analysis, stmt.evts.nid, 'cannot emit to bound variable');
                      } else if (status === 'emitted-to') {
                        // ok
                      } else {
                        throw new Error('unimplemented');
                      }
                    }
                  }
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
              switch (stmt.lhs.type) {
                case 'VarRef': {
                  addError(analysis, stmt.lhs.nid, 'cannot assign to existing variable in when');
                  break;
                }

                case 'VarName': {
                  // TODO: implement
                  break;
                }

                case 'Hole': {
                  break;
                }

                default:
                  throw new Error('unimplemented');
              }
              break;
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

  for (const decl of decls) {
    switch (decl.type) {
      case 'Eq': {
        let expectedType: Type;
        switch (decl.lhs.type) {
          case 'VarRef': {
            if (outerEnv.namedReturns.has(decl.lhs.refId)) {
              if (namedReturnConflicts.has(decl.lhs.refId)) {
                addError(analysis, decl.lhs.nid, 'named return has conflicts');
              }
              const retType = analysis.nodeType.get(decl.lhs.refId);
              invariant(retType !== undefined);
              expectedType = retType;
            } else {
              // LHS is invalid, but we can still analyze RHS
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
        const rhsType = analysis.nodeType.get(decl.rhs.nid);
        invariant(rhsType !== undefined);
        if ((rhsType.type === 'Unknown') || analysis.inactive.has(decl.lhs.nid)) {
          analysis.inactive.add(decl.nid);
        }

        break;
      }

      case 'When': {
        analyzeValueExpr(decl.evts, {type: 'UnitEvent'}, analysis);

        // determine if this is inactive
        const evtsType = analysis.nodeType.get(decl.evts.nid);
        invariant(evtsType !== undefined);
        if (evtsType.type === 'Unknown') {
          analysis.inactive.add(decl.nid);
        }
        break;
      }

      default:
        throw new Error('unimplemented');
    }
  }

  return analysis
}

export function analyzeProgram(prog: ProgramNode, outerEnv: OuterStaticEnv): Analysis {
  return analyzeDeclList(prog.decls, outerEnv);
}

export function analyzePaletteNode(node: ASTNode, outerEnv: OuterStaticEnv): Analysis {
  const analysis = initMutableAnalysis(outerEnv);

  return analysis;
}
