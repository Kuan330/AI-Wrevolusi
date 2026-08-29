import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockPreparation } from "@/data/preparation";

const PriorityTable = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Priority</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Effort</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mockPreparation.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="capitalize">{item.priority}</TableCell>
            <TableCell>{item.title}</TableCell>
            <TableCell>{item.effortLevel}/5</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default PriorityTable;
