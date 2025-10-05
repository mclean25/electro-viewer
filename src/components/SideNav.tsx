import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EntitySchema {
  name: string;
  version: string;
  service: string;
  sourceFile: string;
}

interface SideNavProps {
  currentTable: string;
  tables: string[];
  entities: EntitySchema[];
}

export function SideNav({ currentTable, tables, entities }: SideNavProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleTableChange = (newTable: string) => {
    navigate({
      to: "/tables/$tableName/entities",
      params: { tableName: newTable },
    });
  };

  const filteredEntities = [...entities]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((entity) => entity.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed left-0 top-0 h-screen w-64 border-r bg-background p-4 overflow-y-auto">
      <Link to="/" className="block mb-6">
        <h1 className="text-xl font-bold hover:text-primary transition-colors">
          Electro Viewer
        </h1>
      </Link>

      <div className="mb-4">
        <Select value={currentTable} onValueChange={handleTableChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a table" />
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) => (
              <SelectItem key={table} value={table}>
                {table}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search entities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-0.5">
        {filteredEntities.map((entity) => (
          <Link
            key={entity.name}
            to="/tables/$tableName/entity/$entityName"
            params={{ tableName: currentTable, entityName: entity.name }}
            className="block rounded px-2 py-1 text-xs hover:bg-muted [&.active]:bg-muted [&.active]:font-semibold"
            activeOptions={{ exact: false }}
          >
            {entity.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
