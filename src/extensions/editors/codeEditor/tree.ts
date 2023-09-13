import { genUidRandom, insertIntoArray, invariant } from '../../../util';
import { ASTNode, HoleNode, NodeId, ProgramNode, isBindExprNode, isDeclNode, isMutTargetNode, isProgramNode, isStmtNode, isValueExprNode, isWhenNode } from '../../types/code';

export type DropLoc =
  {
    readonly type: 'ontoNode';
    readonly nodeId: NodeId;
  } | {
    readonly type: 'intoList';
    readonly nodeId: NodeId; // node which has a child list. we assume nodes can only have one child list
    readonly idx: number; // may equal list length to go after last
  };

export function transformChildren<N extends ASTNode, X>(node: N, transform: (node: ASTNode, ctx: X) => ASTNode, ctx: X): N {
  // this could be factored out like transformNodeArr above
  const xChild = <C extends ASTNode>(n: C, pred: (n: ASTNode) => n is C): C => {
    const tn = transform(n, ctx);
    if (!pred(tn)) {
      throw new Error();
    }
    return tn;
  };

  const xChildArr = <C extends ASTNode>(arr: ReadonlyArray<C>, pred: (n: ASTNode) => n is C): ReadonlyArray<C> => {
    let changed = false;
    const newArr = arr.map(el => {
      const nel = transform(el, ctx);
      if (!pred(nel)) {
        throw new Error();
      }
      if (nel !== el) {
        changed = true;
      }
      return nel;
    });
    return changed ? newArr : arr;
  };

  // this could be factored out like transformNodeArr above
  const xChildMap = <C extends ASTNode>(map: ReadonlyMap<string, C>, pred: (n: ASTNode) => n is C): ReadonlyMap<string, C> => {
    let changed = false;
    const newMap = new Map<string, C>();
    for (const [k, v] of map.entries()) {
      const nv = transform(v, ctx);
      if (!pred(nv)) {
        throw new Error();
      }
      if (nv !== v) {
        changed = true;
      }
      newMap.set(k, nv);
    }
    return changed ? newMap : map;
  };

  switch (node.type) {
    case 'Hole':
    case 'Literal':
    case 'VarRef':
    case 'VarName':
      // no children
      return node;

    case 'FnApp': {
      const newArgs = xChildMap(node.args, isValueExprNode);

      if (newArgs === node.args) {
        return node;
      } else {
        return {
          ...node,
          args: newArgs,
        };
      }
    }

    case 'When': {
      const newEvts = xChild(node.evts, isValueExprNode);
      const newStmts = xChildArr(node.stmts, isStmtNode);

      if ((newEvts === node.evts) && (newStmts === node.stmts)) {
        return node;
      } else {
        return {
          ...node,
          evts: newEvts,
          stmts: newStmts,
        };
      }
    }

    case 'Eq': {
      const newLHS = xChild(node.lhs, isBindExprNode);
      const newRHS = xChild(node.rhs, isValueExprNode);

      if ((newLHS === node.lhs) && (newRHS === node.rhs)) {
        return node;
      } else {
        return {
          ...node,
          lhs: newLHS,
          rhs: newRHS,
        };
      }
    }

    case 'EmitUnit': {
      const newEvts = xChild(node.evts, isMutTargetNode);

      if (newEvts === node.evts) {
        return node;
      } else {
        return {
          ...node,
          evts: newEvts,
        };
      }
    }

    case 'EmitValue': {
      const newEvts = xChild(node.evts, isMutTargetNode);
      const newExpr = xChild(node.expr, isValueExprNode);

      if ((newEvts === node.evts) && (newExpr === node.expr)) {
        return node;
      } else {
        return {
          ...node,
          evts: newEvts,
          expr: newExpr,
        };
      }
    }

    case 'Program': {
      const newDecls = xChildArr(node.decls, isDeclNode);

      if (newDecls === node.decls) {
        return node;
      } else {
        return {
          ...node,
          decls: newDecls,
        };
      }
    }
  }
}

function progReplaceNodeHelper(program: ProgramNode, oldPred: (node: ASTNode) => boolean, newNode: ASTNode): ProgramNode {
  let replaceCount = 0;

  const transform = (node: ASTNode): ASTNode => {
    if (oldPred(node)) {
      replaceCount++;
      return newNode;
    } else {
      return transformChildren(node, transform, undefined);
    }
  }

  const newProgram = transform(program);
  invariant(isProgramNode(newProgram));

  invariant(replaceCount === 1, 'expected exactly one node to be replaced');

  return newProgram;
}

export function progReplaceNode(program: ProgramNode, oldNode: ASTNode, newNode: ASTNode): ProgramNode {
  return progReplaceNodeHelper(program, node => (node === oldNode), newNode);
}

export function progReplaceNodeId(program: ProgramNode, oldNodeId: NodeId, newNode: ASTNode): ProgramNode {
  return progReplaceNodeHelper(program, node => (node.nid === oldNodeId), newNode);
}

export function progInsertListNode(program: ProgramNode, parentNodeId: NodeId, idx: number, newNode: ASTNode): ProgramNode {
  let insertCount = 0;

  const transform = (node: ASTNode): ASTNode => {
    if (node.nid === parentNodeId) {
      insertCount++;

      switch (node.type) {
        case 'Program': {
          invariant(isDeclNode(newNode));
          return {
            ...node,
            decls: insertIntoArray(node.decls, idx, newNode),
          };
        }

        case 'When': {
          invariant(isStmtNode(newNode));
          return {
            ...node,
            stmts: insertIntoArray(node.stmts, idx, newNode),
          };
        }

        default:
          throw new Error('unimplemented');
      }
    } else {
      return transformChildren(node, transform, undefined);
    }
  }

  const newProgram = transform(program);
  invariant(isProgramNode(newProgram));

  invariant(insertCount === 1, 'expected exactly one insertion site');

  return newProgram;
}

export function progRemoveNode(program: ProgramNode, removeNode: ASTNode): [ProgramNode, DropLoc] {
  let removedDropLoc: DropLoc | undefined = undefined;

  const transform = (node: ASTNode): ASTNode => {
    if (node === removeNode) {
      invariant(removedDropLoc === undefined, 'expected only one node to be removed');
      const newNode: HoleNode = {
        type: 'Hole',
        nid: genUidRandom(),
      };
      removedDropLoc = {
        type: 'ontoNode',
        nodeId: newNode.nid,
      };
      return newNode;
    } else {
      let newNode = node;
      if (isProgramNode(node)) {
        const idx = node.decls.findIndex(decl => (decl === removeNode));
        if (idx !== -1) {
          const newDecls = [...node.decls];
          newDecls.splice(idx, 1);
          newNode = {
            ...node,
            decls: newDecls,
          };
          invariant(removedDropLoc === undefined, 'expected only one node to be removed');
          removedDropLoc = {
            type: 'intoList',
            nodeId: node.nid,
            idx,
          };
        }
      } else if (isWhenNode(node)) {
        const idx = node.stmts.findIndex(stmt => (stmt === removeNode));
        if (idx !== -1) {
          const newStmts = [...node.stmts];
          newStmts.splice(idx, 1);
          newNode = {
            ...node,
            stmts: newStmts,
          };
          invariant(removedDropLoc === undefined, 'expected only one node to be removed');
          removedDropLoc = {
            type: 'intoList',
            nodeId: node.nid,
            idx,
          };
        }
      }
      return transformChildren(newNode, transform, undefined);
    }
  }

  const newProgram = transform(program);
  invariant(isProgramNode(newProgram));

  invariant(removedDropLoc !== undefined, 'found no node to remove');

  return [newProgram, removedDropLoc];
}

export function treeRandomizeNodeIds(root: ASTNode, nodePred: (node: ASTNode) => boolean): ASTNode {
  const transform = (node: ASTNode): ASTNode => {
    const newNode = nodePred(node) ? {
      ...node,
      nid: genUidRandom(),
    } : node;

    return transformChildren(newNode, transform, undefined);
  }

  const newRoot = transform(root);

  return newRoot;
}
