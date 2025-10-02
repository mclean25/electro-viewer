import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tables/$tableName")({
	component: TableLayout,
});

function TableLayout() {
	const { tableName } = Route.useParams();

	return (
		<div className="container mx-auto py-8 font-mono">
			<div className="mb-4">
				<Link to="/" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
					← Back to Tables
				</Link>
			</div>

			<h1 className="mb-2 text-xl font-bold">Table: {tableName}</h1>

			<Outlet />
		</div>
	)
}