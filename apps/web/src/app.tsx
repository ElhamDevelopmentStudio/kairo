import { DashboardPage } from "@/features/dashboard";
import { HomePage } from "@/pages/home";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<HomePage />} path="/" />
        <Route element={<DashboardPage />} path="/dashboard/*" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
