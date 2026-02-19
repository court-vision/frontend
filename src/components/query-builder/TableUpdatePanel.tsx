import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  TableUpdateAttribute,
  TableUpdateConstraint,
} from "@/types/sqlmate";

interface TableUpdatePanelProps {
  columns: { name: string; type: string }[];
  onSubmit: (
    updates: TableUpdateAttribute[],
    constraints: TableUpdateConstraint[]
  ) => void;
  isSubmitting: boolean;
}

type UpdateRow = {
  id: string;
  attribute: string;
  value: string;
};

type ConstraintRow = {
  id: string;
  attribute: string;
  operator: string;
  value: string;
};

export function TableUpdatePanel({
  columns,
  onSubmit,
  isSubmitting,
}: TableUpdatePanelProps) {
  const [updates, setUpdates] = useState<UpdateRow[]>([
    { id: crypto.randomUUID(), attribute: "", value: "" },
  ]);

  const [constraints, setConstraints] = useState<ConstraintRow[]>([
    { id: crypto.randomUUID(), attribute: "", operator: "", value: "" },
  ]);

  const addUpdateRow = () => {
    setUpdates((current) => [
      ...current,
      { id: crypto.randomUUID(), attribute: "", value: "" },
    ]);
  };

  const addConstraintRow = () => {
    setConstraints((current) => [
      ...current,
      { id: crypto.randomUUID(), attribute: "", operator: "", value: "" },
    ]);
  };

  const removeUpdateRow = (id: string) => {
    setUpdates((current) =>
      current.length > 1
        ? current.filter((update) => update.id !== id)
        : current
    );
  };

  const removeConstraintRow = (id: string) => {
    setConstraints((current) =>
      current.length > 1
        ? current.filter((constraint) => constraint.id !== id)
        : current
    );
  };

  const handleSubmit = () => {
    const validUpdates: TableUpdateAttribute[] = updates
      .filter((update) => update.attribute && update.value !== "")
      .map((update) => ({
        attribute: update.attribute,
        value: update.value,
      }));

    const validConstraints: TableUpdateConstraint[] = constraints
      .filter((constraint) => constraint.attribute && constraint.operator)
      .map((constraint) => ({
        attribute: constraint.attribute,
        operator: constraint.operator,
        value: constraint.value,
      }));

    onSubmit(validUpdates, validConstraints);
  };

  const canSubmit =
    updates.some((update) => update.attribute && update.value !== "") &&
    constraints.some((constraint) => constraint.attribute && constraint.operator);

  return (
    <Card className="p-4 mb-4">
      <h2 className="text-base font-medium mb-3">Update Table</h2>

      <div className="mb-4">
        <h3 className="text-sm font-medium mb-2">Set New Values</h3>
        <div className="space-y-2 mb-2">
          {updates.map((update) => (
            <div key={update.id} className="flex items-center gap-2">
              <select
                className="bg-background border border-input rounded px-2 py-1 flex-1"
                value={update.attribute}
                onChange={(event) => {
                  const next = event.target.value;
                  setUpdates((current) =>
                    current.map((row) =>
                      row.id === update.id ? { ...row, attribute: next } : row
                    )
                  );
                }}
              >
                <option value="">Select attribute</option>
                {columns.map((column, index) => (
                  <option key={`update-col-${index}`} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">=</span>
              <input
                type="text"
                className="bg-background border border-input rounded px-2 py-1 flex-1"
                placeholder="New value"
                value={update.value}
                onChange={(event) => {
                  const next = event.target.value;
                  setUpdates((current) =>
                    current.map((row) =>
                      row.id === update.id ? { ...row, value: next } : row
                    )
                  );
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeUpdateRow(update.id)}
                disabled={updates.length <= 1}
                className="h-8 w-8 p-0"
              >
                <Trash2Icon size={14} />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={addUpdateRow}>
          <PlusIcon size={12} className="mr-1" /> Add Field
        </Button>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-medium mb-2">Where (Constraints)</h3>
        <div className="space-y-2 mb-2">
          {constraints.map((constraint) => (
            <div key={constraint.id} className="flex items-center gap-2">
              <select
                className="bg-background border border-input rounded px-2 py-1 flex-1"
                value={constraint.attribute}
                onChange={(event) => {
                  const next = event.target.value;
                  setConstraints((current) =>
                    current.map((row) =>
                      row.id === constraint.id ? { ...row, attribute: next } : row
                    )
                  );
                }}
              >
                <option value="">Select attribute</option>
                {columns.map((column, index) => (
                  <option key={`constraint-col-${index}`} value={column.name}>
                    {column.name}
                  </option>
                ))}
              </select>
              <select
                className="bg-background border border-input rounded px-2 py-1"
                value={constraint.operator}
                onChange={(event) => {
                  const next = event.target.value;
                  setConstraints((current) =>
                    current.map((row) =>
                      row.id === constraint.id ? { ...row, operator: next } : row
                    )
                  );
                }}
              >
                <option value="">Operator</option>
                <option value="=">=</option>
                <option value="<">{"<"}</option>
                <option value=">">{">"}</option>
                <option value="<=">{"<="}</option>
                <option value=">=">{">="}</option>
                <option value="!=">{"!="}</option>
                <option value="PREFIX">PREFIX</option>
                <option value="SUFFIX">SUFFIX</option>
                <option value="SUBSTRING">SUBSTRING</option>
              </select>
              <input
                type="text"
                className="bg-background border border-input rounded px-2 py-1 flex-1"
                placeholder="Value"
                value={constraint.value}
                onChange={(event) => {
                  const next = event.target.value;
                  setConstraints((current) =>
                    current.map((row) =>
                      row.id === constraint.id ? { ...row, value: next } : row
                    )
                  );
                }}
                disabled={!constraint.operator}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeConstraintRow(constraint.id)}
                disabled={constraints.length <= 1}
                className="h-8 w-8 p-0"
              >
                <Trash2Icon size={14} />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={addConstraintRow}>
          <PlusIcon size={12} className="mr-1" /> Add Constraint
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="w-full md:w-auto">
          {isSubmitting ? "Updating..." : "Update Table"}
        </Button>
      </div>
    </Card>
  );
}
