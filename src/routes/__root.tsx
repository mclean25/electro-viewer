/// <reference types="vite/client" />
import type { ReactNode } from "react";
import {
	Outlet,
	createRootRoute,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import "../index.css";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Electro Viewer",
			},
		],
	}),
	component: RootComponent,
	notFoundComponent: () => (
		<div className="container mx-auto py-8">
			<h1 className="text-2xl font-bold mb-4">404 - Page Not Found</h1>
			<p className="text-muted-foreground">
				The page you're looking for doesn't exist.
			</p>
		</div>
	),
});

function RootComponent() {
	return (
		<RootDocument>
			<div className="fixed right-4 top-4 z-50">
				<ThemeToggle />
			</div>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
