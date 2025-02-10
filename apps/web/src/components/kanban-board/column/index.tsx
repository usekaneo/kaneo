import type { Column as ColumnType } from '@/types/project';
import { ColumnDropzone } from './column-dropzone';
import { ColumnHeader } from './column-header';

interface ColumnProps {
  readonly column: ColumnType;
}

const Column = ({ column }: ColumnProps) => {
  return (
    <div className="flex flex-col flex-1 min-w-80 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xs rounded-lg border border-zinc-200 dark:border-zinc-800/50 snap-center h-full shadow-xs overflow-hidden">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800/50">
        <ColumnHeader column={column} />
      </div>
      <div className="p-3 overflow-y-auto flex-1">
        <ColumnDropzone column={column} />
      </div>
    </div>
  );
};

export default Column;
