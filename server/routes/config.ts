import { Router } from "express";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const configRouter = Router();

interface ElectroViewerConfig {
  entities: string;
  tableName: string;
  region: string;
  service: string;
}

configRouter.get("/", async (req: any, res: any) => {
  try {
    const configPath = join(process.cwd(), "electroviewer.config.json");
    const configData = await readFile(configPath, "utf-8");
    const config: ElectroViewerConfig = JSON.parse(configData);

    // Validate required fields
    if (!config.entities || !config.tableName) {
      return res.status(400).json({
        error: 'Config must include "entities" and "tableName" fields',
      });
    }

    res.json(config);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      res.status(404).json({
        error: "electroviewer.config.json not found in current directory",
      });
    } else {
      console.error("Error reading config:", error);
      res.status(500).json({
        error: "Failed to read configuration file",
      });
    }
  }
});
