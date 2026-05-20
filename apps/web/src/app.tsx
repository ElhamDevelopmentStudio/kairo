import { DashboardPage } from "@/features/dashboard";
import { HomePage } from "@/pages/home";

export function App() {
  if (window.location.pathname.startsWith("/dashboard")) {
    return <DashboardPage />;
  }

  return <HomePage />;
}
