import { DashboardPage } from "@/features/dashboard";
import { OverviewPage } from "@/features/dashboard/overview-page";
import { SearchPage } from "@/features/dashboard/search-page";
import { SessionPage } from "@/features/dashboard/session-page";
import { TimelinePage } from "@/features/dashboard/timeline-page";
import { HomePage } from "@/pages/home";
import { Navigate, createBrowserRouter } from "react-router-dom";
import type { RouteObject } from "react-router-dom";

export const routes: RouteObject[] = [
  {
    element: <HomePage />,
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
        element: <SessionPage />,
        path: "sessions/:slug",
      },
      {
        element: <Navigate replace to="/dashboard" />,
        path: "*",
      },
    ],
    element: <DashboardPage />,
    path: "/dashboard",
  },
  {
    element: <Navigate replace to="/" />,
    path: "*",
  },
];

export const router = createBrowserRouter(routes);
