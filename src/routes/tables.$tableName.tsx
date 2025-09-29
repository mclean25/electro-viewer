import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tables/$tableName")({
	component: TableLayout,
});

function TableLayout() {
	const { tableName } = Route.useParams();

	return (
		<div className="p-5 font-mono">
			<div className="mb-4">
				<Link to="/" className="text-blue-600 hover:text-blue-700 text-sm">
					← Back to Tables
				</Link>
			</div>
			
			<h1 className="text-2xl mb-2">Table: {tableName}</h1>

			<Outlet />
		</div>
	)
}