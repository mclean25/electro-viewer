import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Globe, User, Table } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Logo from "@/assets/Logo.svg";

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
  region: string;
  profile: string;
}

export function SideNav({
  currentTable,
  tables,
  entities,
  region,
  profile,
}: SideNavProps) {
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
    <div className="fixed left-0 top-0 h-screen w-64 border-r border-border bg-background p-6 overflow-y-auto">
      <Link to="/" className="block mb-6">
        <img src={Logo} alt="Electro Viewer" className="w-full h-auto" />
      </Link>

      <div className="border-t border-border -mx-6 mb-6" />

      <div className="mb-6">
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

      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Globe className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{region}</span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <User className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{profile}</span>
        </div>
      </div>

      <div className="border-t border-border -mx-6 mb-6" />

      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search Entities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-card"
        />
      </div>

      <div className="space-y-1">
        {filteredEntities.map((entity) => (
          <Link
            key={entity.name}
            to="/tables/$tableName/entity/$entityName"
            params={{ tableName: currentTable, entityName: entity.name }}
            className="flex items-center gap-3 rounded px-3 py-2 text-sm hover:bg-muted [&.active]:bg-muted [&.active]:font-semibold"
            activeOptions={{ exact: false }}
          >
            <Table className="h-5 w-5 flex-shrink-0" />
            <span>{entity.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
