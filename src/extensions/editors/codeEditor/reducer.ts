import { invariant } from "../../../util";
import { ASTNode, NodeId, ProgramNode } from "../../types/code";
import { Analysis, OuterStaticEnv, analyzeProgram } from "./analysis";
import { progInsertListNode, progRemoveNode, progReplaceNode, progReplaceNodeId } from "./tree";

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

interface PotentialDrop {
  readonly potentialNode: ASTNode;
  readonly dropLoc: DropLoc;
  readonly valid: boolean;
}

export interface CodeEditorState {
  readonly program: ProgramNode;
  readonly potentialDrops: ReadonlyMap<string, PotentialDrop>; // key is dragId
  readonly outerEnv: OuterStaticEnv;
  readonly analysis: Analysis; // without UDFs there is only one static environment for now
}

function updateAnalysis(state: CodeEditorState): CodeEditorState {
  const analysis = analyzeProgram(state.program, state.outerEnv);
  invariant(analysis.errors.size === 0, 'program should be valid');
  return {
    ...state,
    analysis,
  };
}

function applyPotentialDrop(node: ASTNode, dropLoc: DropLoc, program: ProgramNode): ProgramNode {
  switch (dropLoc.type) {
    case 'ontoNode':
      return progReplaceNodeId(program, dropLoc.nodeId, node);

    case 'intoList':
      return progInsertListNode(program, dropLoc.nodeId, dropLoc.idx, node);
  }
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
      return updateAnalysis({
        ...state,
        program: progRemoveNode(state.program, action.node),
      });
    }

    case 'setPotentialDrop': {
      const testProgram = applyPotentialDrop(action.potentialNode, action.dropLoc, state.program);
      const valid = (analyzeProgram(testProgram, state.outerEnv).errors.size === 0);

      const newPotentialDrops = new Map(state.potentialDrops);
      newPotentialDrops.set(action.dragId, {
        potentialNode: action.potentialNode,
        dropLoc: action.dropLoc,
        valid,
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

        if (pd.valid) {
          const newProgram = applyPotentialDrop(pd.potentialNode, pd.dropLoc, state.program);

          return updateAnalysis({
            ...state,
            program: newProgram,
            potentialDrops: newPotentialDrops,
          });
        } else {
          return {
            ...state,
            potentialDrops: newPotentialDrops,
          };
        }
      } else {
        return state;
      }
    }
  }
}

