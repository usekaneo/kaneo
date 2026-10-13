import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GuideTable as GuideTableData } from "@/lib/guides";

export function GuideTable({ data }: { data: GuideTableData }) {
  const [label, ...columns] = data.columns;

  return (
    <div className="mt-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{label}</TableHead>
            {columns.map((column) => (
              <TableHead key={column} scope="col">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map(([name, ...cells]) => (
            <TableRow key={name}>
              <TableHead
                scope="row"
                className="h-auto whitespace-nowrap py-3 align-top text-foreground leading-relaxed"
              >
                {name}
              </TableHead>
              {cells.map((cell, index) => (
                <TableCell
                  key={columns[index]}
                  className="min-w-32 whitespace-normal py-3 align-top text-muted-foreground leading-relaxed"
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
