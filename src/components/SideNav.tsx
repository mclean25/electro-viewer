import { Link, useNavigate } from "@tanstack/react-router";
import { Globe, Table, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Logo from "@/assets/Logo.svg";
import pkg from "../../package.json";
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
  region: string;
  profile: string;
  width: number;
  onWidthChange: (width: number) => void;
}

export function SideNav({
  currentTable,
  tables,
  entities,
  region,
  profile,
  width,
  onWidthChange,
}: SideNavProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleTableChange = (newTable: string) => {
    navigate({
      to: "/tables/$tableName/entities",
      params: { tableName: newTable },
    });
  };

  const filteredEntities = [...entities]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((entity) => entity.name.toLowerCase().includes(searchQuery.toLowerCase()));

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      const minWidth = 256;
      const maxWidth = 400;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        onWidthChange(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, onWidthChange]);

  return (
    <div
      ref={sidebarRef}
      className="fixed left-0 top-0 h-screen border-r border-border bg-background p-6 overflow-y-auto"
      style={{ width: `${width}px` }}
    >
      <Link to="/" className="flex flex-col items-center mb-6 gap-1">
        <img src={Logo} alt="Electro Viewer" className="h-12 w-auto" />
        <span className="text-xs text-muted-foreground">v{pkg.version}</span>
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
            search={{ tab: "query" }}
            className="flex items-center gap-3 rounded px-3 py-2 text-sm hover:bg-muted [&.active]:bg-muted [&.active]:font-semibold"
            activeOptions={{ exact: false }}
          >
            <Table className="h-5 w-5 flex-shrink-0" />
            <span>{entity.name}</span>
          </Link>
        ))}
      </div>

      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary transition-colors"
        onMouseDown={() => setIsResizing(true)}
      />
    </div>
  );
}
