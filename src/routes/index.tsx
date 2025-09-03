// src/routes/index.tsx
import * as fs from "node:fs";
import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const filePath = "count.txt";

async function readCount() {
  return Number.parseInt(
    await fs.promises.readFile(filePath, "utf-8").catch(() => "0"),
  );
}

const getCount = createServerFn({
  method: "GET",
}).handler(() => {
  return readCount();
});

const updateCount = createServerFn({ method: "POST" })
  .validator((d: number) => d)
  .handler(async ({ data }) => {
    const count = await readCount();
    await fs.promises.writeFile(filePath, `${count + data}`);
  });

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => await getCount(),
});

function Home() {
  const router = useRouter();
  const state = Route.useLoaderData();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Electro Viewer</h1>
      
      <div style={{ marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => {
            updateCount({ data: 1 }).then(() => {
              router.invalidate();
            });
          }}
        >
          Add 1 to {state}?
        </button>
      </div>
      
      <nav>
        <Link to="/entities" style={{ color: "#0066cc", textDecoration: "underline" }}>
          View ElectroDB Entity Definitions
        </Link>
      </nav>
    </div>
  );
}
