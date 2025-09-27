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
		<div className="p-5">
			<h1 className="text-3xl font-bold mb-6">Electro Viewer</h1>

			<div className="mb-5">
				<button
					type="button"
					className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
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
				<Link
					to="/entities"
					className="text-blue-600 underline hover:text-blue-800"
				>
					View ElectroDB Entity Definitions
				</Link>
			</nav>
		</div>
	);
}
