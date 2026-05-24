import { DashboardPage } from "@/features/dashboard";
import { ArchitecturePage } from "@/features/dashboard/pages/architecture-page";
import { OverviewPage } from "@/features/dashboard/pages/overview-page";
import { RouteErrorPage } from "@/features/dashboard/pages/route-error-page";
import { SearchPage } from "@/features/dashboard/pages/search-page";
import { SessionPage } from "@/features/dashboard/pages/session-page";
import { SessionsPage } from "@/features/dashboard/pages/sessions-page";
import { TimelinePage } from "@/features/dashboard/pages/timeline-page";
import { HomePage } from "@/pages/home";
import { Navigate, createBrowserRouter } from "react-router-dom";
import type { RouteObject } from "react-router-dom";

export const routes: RouteObject[] = [
  {
    element: <HomePage />,
    errorElement: <RouteErrorPage />,
    path: "/",
  },
  {
    children: [
      {
        element: <OverviewPage />,
        index: true,
      },
      {
        element: <TimelinePage />,
        path: "timeline",
      },
      {
        element: <SearchPage />,
        path: "search",
      },
      {
        element: <SessionsPage />,
        path: "sessions",
      },
      {
        element: <SessionPage />,
        path: "sessions/:slug",
      },
      {
        element: <ArchitecturePage />,
        path: "architecture",
      },
      {
        element: <Navigate replace to="/dashboard" />,
        path: "*",
      },
    ],
    element: <DashboardPage />,
    errorElement: <RouteErrorPage />,
    path: "/dashboard",
  },
  {
    element: <Navigate replace to="/" />,
    path: "*",
  },
];

export const router = createBrowserRouter(routes);
