import { genUidRandom, invariant } from "../../../util";
import { ASTNode, NodeId, ProgramNode, isBindExprNode, isDeclNode, isValueExprNode } from "../../types/code";
import { Analysis, OuterStaticEnv, analyzeProgram } from "./analysis";
import { progInsertListNode, progRemoveListNode, progReplaceNode, progReplaceNodeId } from "./tree";

export type CodeEditorAction =
  {
    readonly type: 'replaceNode';
    readonly oldNode: ASTNode;
    readonly newNode: ASTNode;
  } | {
    readonly type: 'removeNodeForDrag';
    readonly node: ASTNode;
  } | {
    readonly type: 'setPotentialDrop';
    readonly dragId: string;
    readonly potentialNode: ASTNode;
    readonly dropLoc: DropLoc;
  } | {
    readonly type: 'removePotentialDrop';
    readonly dragId: string;
  } | {
    readonly type: 'endDrag';
    readonly dragId: string;
  };

export type CodeEditorDispatch = React.Dispatch<CodeEditorAction>;

export type DropLoc =
  {
    readonly type: 'ontoNode';
    readonly nodeId: NodeId;
  } | {
    readonly type: 'intoList';
    readonly nodeId: NodeId; // node which has a child list. we assume nodes can only have one child list
    readonly idx: number; // may equal list length to go after last
  };

export interface CodeEditorState {
  readonly program: ProgramNode;
  readonly potentialDrops: ReadonlyMap<string, { // key is dragId
    readonly potentialNode: ASTNode;
    readonly dropLoc: DropLoc;
  }>;
  readonly outerEnv: OuterStaticEnv;
  readonly analysis: Analysis; // without UDFs there is only one static environment for now
}

export function updateAnalysis(state: CodeEditorState): CodeEditorState {
  const analysis = analyzeProgram(state.program, state.outerEnv);
  console.log('analysis', analysis);
  return {
    ...state,
    analysis,
  };
}

export function reducer(state: CodeEditorState, action: CodeEditorAction): CodeEditorState {
  switch (action.type) {
    case 'replaceNode': {
      const {oldNode, newNode} = action;

      return updateAnalysis({
        ...state,
        program: progReplaceNode(state.program, oldNode, newNode),
      });
    }

    case 'removeNodeForDrag': {
      if (isDeclNode(action.node)) {
        return updateAnalysis({
          ...state,
          program: progRemoveListNode(state.program, action.node.nid),
        });
      } else if (isValueExprNode(action.node) || isBindExprNode(action.node)) {
        return updateAnalysis({
          ...state,
          program: progReplaceNodeId(state.program, action.node.nid, {
            type: 'Hole',
            nid: genUidRandom(),
          }),
        });
      } else {
        throw new Error('unimplemented');
      }
    }

    case 'setPotentialDrop': {
      const newPotentialDrops = new Map(state.potentialDrops);
      newPotentialDrops.set(action.dragId, {
        potentialNode: action.potentialNode,
        dropLoc: action.dropLoc,
      });
      return {
        ...state,
        potentialDrops: newPotentialDrops,
      };
    }

    case 'removePotentialDrop': {
      if (state.potentialDrops.has(action.dragId)) {
        const newPotentialDrops = new Map(state.potentialDrops);
        newPotentialDrops.delete(action.dragId);
        return {
          ...state,
          potentialDrops: newPotentialDrops,
        };
      } else {
        return state;
      }
    }

    case 'endDrag': {
      if (state.potentialDrops.has(action.dragId)) {
        const pd = state.potentialDrops.get(action.dragId);
        invariant(pd);

        const newPotentialDrops = new Map(state.potentialDrops);
        newPotentialDrops.delete(action.dragId);

        switch (pd.dropLoc.type) {
          case 'ontoNode': {
            return updateAnalysis({
              ...state,
              program: progReplaceNodeId(state.program, pd.dropLoc.nodeId, pd.potentialNode),
              potentialDrops: newPotentialDrops,
            });
          }

          case 'intoList': {
            return updateAnalysis({
              ...state,
              program: progInsertListNode(state.program, pd.dropLoc.nodeId, pd.dropLoc.idx, pd.potentialNode),
              potentialDrops: newPotentialDrops,
            });
          }
        }
      } else {
        return state;
      }
    }
  }
}

