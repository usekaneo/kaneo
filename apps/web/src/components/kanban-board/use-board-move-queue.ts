import { useCallback, useEffect, useRef, useState } from "react";

export type BoardMove = {
  activeId: string;
  overId: string;
  insertAfterTarget?: boolean;
};

export function useBoardMoveQueue({
  projectId,
  waiting,
  disabled,
  onMove,
  onCancel,
}: {
  projectId: string;
  waiting: boolean;
  disabled: boolean;
  onMove: (move: BoardMove, onSettled: () => void) => void;
  onCancel: () => void;
}) {
  const [queue, setQueue] = useState<Array<BoardMove & { projectId: string }>>(
    [],
  );
  const processing = useRef(false);

  const processMove = useCallback(
    (move: BoardMove) => {
      // Mutation pending state can lag the next queued drop.
      processing.current = true;
      onMove(move, () => {
        processing.current = false;
        setQueue((queue) => [...queue]);
      });
    },
    [onMove],
  );

  useEffect(() => {
    if (!queue.length) return;
    if (disabled || queue[0].projectId !== projectId) {
      setQueue([]);
      onCancel();
      return;
    }
    if (waiting || processing.current) return;
    const [move, ...remaining] = queue;
    setQueue(remaining);
    processMove(move);
  }, [queue, projectId, waiting, disabled, processMove, onCancel]);

  const queueMove = (move: BoardMove) => {
    if (!disabled) {
      if (!waiting && !processing.current && !queue.length) {
        processMove(move);
      } else {
        setQueue((queue) => [...queue, { ...move, projectId }]);
      }
    }
  };

  return { queueMove, pendingMoves: queue };
}
