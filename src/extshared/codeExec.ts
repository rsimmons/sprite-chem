import { DeclNode, NodeId, ProgramNode, StmtNode, ValueExprNode } from "../extensions/types/code";

export type EventStream<T> = ReadonlyArray<T> | undefined;

/**
 * Activated (running) stream functions may have state and a cleanup function.
 * The `state` field is only accessed by the stream function itself.
 * The `cleanup` function is invoked by the caller when the activation needs
 * to be cleaned up.
 * Both fields are initialized to `undefined`, and can be written to by the
 * stream function.
 */
export interface StateFrame {
  state: any;
  cleanup: undefined | (() => void);
}

// used by stream functions to access their current state frame. set by "caller"
export let currentStateFrame: StateFrame | undefined = undefined;

export interface ProgramContext {
  prog: ProgramNode;
  readonly rootFrame: StateFrame;
}

export interface VarContext {
  readonly nidVal: Map<NodeId, any>;
}

// The state for the activation of a function defined via nodes (not JS)
// For each "child" function activation, we have a state frame.
type NodeFnActState = Map<NodeId, StateFrame>;

function getNodeFnChildFrame(state: NodeFnActState, nid: NodeId): StateFrame {
  if (!state.has(nid)) {
    state.set(nid, {
      state: undefined,
      cleanup: undefined,
    });
  }
  return state.get(nid) as StateFrame;
}

// the context for evaluating expressions, applying declarations, etc.
export interface InterpContext {
  readonly varCtx: VarContext;
  readonly state: NodeFnActState;
}

function evalValueExpr(expr: ValueExprNode, ctx: InterpContext): any {
  switch (expr.type) {
    case 'Hole':
      throw new Error('hole');

    case 'Literal':
      return expr.sub.value;

    case 'VarRef':
      return ctx.varCtx.nidVal.get(expr.refId);

    case 'FnApp': {
      const fnVal = ctx.varCtx.nidVal.get(expr.fn);
      const argVals = [...expr.args.values()].map(argExpr => evalValueExpr(argExpr, ctx));

      // get/init state frame for this function activation, and set as current
      const prevStateFrame = currentStateFrame;
      currentStateFrame = getNodeFnChildFrame(ctx.state, expr.nid);

      // update child activation
      const retVal = fnVal(...argVals);

      // restore previous state frame as current
      currentStateFrame = prevStateFrame;

      return retVal;
    }
  }
}

function applyDecl(decl: DeclNode, ctx: InterpContext): void {
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
      const rhsVal = evalValueExpr(decl.rhs, ctx);
      ctx.varCtx.nidVal.set(targetNid, rhsVal);
      break;
    }

    case 'When': {
      const evtsVal = evalValueExpr(decl.evts, ctx);
      if (evtsVal !== undefined) {
        if (evtsVal.length === 0) {
          throw new Error('unexpected');
        }
        for (const stmt of decl.stmts) {
          applyStmt(stmt, ctx);
        }
      }
      break;
    }

    default:
      throw new Error('unimplemented');
  }
}

function applyStmt(stmt: StmtNode, ctx: InterpContext): void {
  switch (stmt.type) {
    case 'Emit': {
      // TODO: evaluate expression. for now we just emit "unit" events
      if (stmt.evts.type !== 'VarRef') {
        throw new Error('unimplemented');
      }

      const evtStream = ctx.varCtx.nidVal.get(stmt.evts.refId);
      if (evtStream === undefined) {
        ctx.varCtx.nidVal.set(stmt.evts.refId, [undefined]);
      } else {
        ctx.varCtx.nidVal.set(stmt.evts.refId, [...evtStream, undefined]);
      }
      break;
    }

    default:
      throw new Error('unimplemented');
  }
}

// Note that `prog` cannot be mutated after starting, rather `modifyProgram` should be used.
// `nativeGlobalContext` is the global context that is accessible to native (JS) functions.
// `nativeGlobalContext` can be mutated after starting, and there is no need to "nofity"
// this code of that mutation.
export function startProgram(prog: ProgramNode): ProgramContext {
  return {
    prog,
    rootFrame: {
      state: undefined,
      cleanup: undefined,
    },
  };
}

export function stepProgram(progCtx: ProgramContext, varCtx: VarContext): void {
  currentStateFrame = progCtx.rootFrame;

  if (currentStateFrame.state === undefined) {
    currentStateFrame.state = new Map<NodeId, StateFrame>();
  }
  const st = currentStateFrame.state as NodeFnActState;

  const interpCtx: InterpContext = {
    varCtx,
    state: st,
  };

  for (const decl of progCtx.prog.decls) {
    applyDecl(decl, interpCtx);
  }
}

export function modifyProgram(ctx: ProgramContext, newProg: ProgramNode): void {
  ctx.prog = newProg;

  // TODO: migrate state tree
  throw new Error('unimplemented');
}

export function stopProgram(ctx: ProgramContext): void {
  // TODO: cleanup
}
