/// <reference types="vite/client" />

import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
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
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
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
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
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
