import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

async function generateEntities() {
  try {
    // Read the config to get the entities path
    const configPath = join(process.cwd(), "electroviewer.config.json");
    const configData = await readFile(configPath, "utf-8");
    const config = JSON.parse(configData);

    // Resolve the entities file path
    let entitiesPath = config.entities;
    if (entitiesPath.startsWith("~")) {
      entitiesPath = entitiesPath.replace(
        "~",
        process.env.HOME || process.env.USERPROFILE,
      );
    }
    entitiesPath = resolve(process.cwd(), entitiesPath);

    // Read the service file as text
    const serviceContent = await readFile(entitiesPath, "utf-8");

    // Parse the entities using regex patterns
    const parsedEntities = [];

    // Find all entity exports
    const entityExportRegex = /export const (\w+) = new Entity\(/g;
    const entityMatches = [...serviceContent.matchAll(entityExportRegex)];

    for (const match of entityMatches) {
      const entityName = match[1];

      // Find the entity definition block
      const entityStart = serviceContent.indexOf(match[0]);
      const entityEnd = findClosingBrace(serviceContent, entityStart);
      const entityBlock = serviceContent.substring(entityStart, entityEnd);

      console.log(`Processing entity: ${entityName}`);
      console.log(`Entity block length: ${entityBlock.length}`);

      // Debug: Show the indexes section of the entity block
      const indexesMatch = entityBlock.match(/indexes:\s*{([^}]+)}/s);
      if (indexesMatch) {
        console.log(`  Indexes section: ${indexesMatch[1].substring(0, 200)}...`);
      } else {
        console.log("  No indexes section found");
      }

      // Extract indexes
      const indexes = [];
      // Updated regex to match empty composite arrays
      const indexRegex =
        /(\w+):\s*{\s*(?:index:\s*['"`](\w+)['"`],\s*)?pk:\s*{[^}]*composite:\s*\[([^\]]*)\][^}]*}(?:\s*,\s*sk:\s*{[^}]*composite:\s*\[([^\]]*)\][^}]*})?/gms;
      const indexMatches = [...entityBlock.matchAll(indexRegex)];

      for (const indexMatch of indexMatches) {
        const indexName = indexMatch[1];
        const pkFieldsStr = indexMatch[3];
        const skFieldsStr = indexMatch[4];

        // Handle empty arrays and parse fields
        let pkFields =
          pkFieldsStr.trim() === ""
            ? []
            : pkFieldsStr.split(",").map((f) => f.trim().replace(/['"`]/g, ""));
        let skFields = skFieldsStr
          ? skFieldsStr.trim() === ""
            ? []
            : skFieldsStr.split(",").map((f) => f.trim().replace(/['"`]/g, ""))
          : undefined;

        // If PK is empty and SK is present, treat SK as the only key (for Company entity edge case)
        if (pkFields.length === 0 && skFields && skFields.length > 0) {
          pkFields = skFields;
          skFields = undefined;
        }

        indexes.push({
          name: indexName,
          pk: pkFields,
          sk: skFields,
        });
      }

      parsedEntities.push({
        name: entityName,
        service: config.service || "unknown",
        indexes,
      });
    }

    // Write the parsed entities to a JSON file
    const outputPath = join(process.cwd(), "public", "entities.json");
    await writeFile(outputPath, JSON.stringify(parsedEntities, null, 2));

    console.log(`✅ Generated entities.json with ${parsedEntities.length} entities`);
    console.log("Entities found:", parsedEntities.map((e) => e.name).join(", "));
  } catch (error) {
    console.error("❌ Error generating entities:", error);
    process.exit(1);
  }
}

function findClosingBrace(content, startIndex) {
  let braceCount = 0;
  let inString = false;
  let stringChar = null;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];

    if (!inString && char === "{") {
      braceCount++;
    } else if (!inString && char === "}") {
      braceCount--;
      if (braceCount === 0) {
        return i + 1;
      }
    } else if (!inString && (char === '"' || char === "'" || char === "`")) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar) {
      inString = false;
    }
  }

  return content.length;
}

generateEntities();
