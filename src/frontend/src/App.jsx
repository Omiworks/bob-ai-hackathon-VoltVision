import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import AssetsPage from "./pages/AssetsPage";
import AssetDetailPage from "./pages/AssetDetailPage";
import SimulationPage from "./pages/SimulationPage";
import PriorityPage from "./pages/PriorityPage";
import AlertsPage from "./pages/AlertsPage";
import BriefPage from "./pages/BriefPage";
import ModelPage from "./pages/ModelPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="assets/:id" element={<AssetDetailPage />} />
        <Route path="simulate" element={<SimulationPage />} />
        <Route path="priority" element={<PriorityPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="brief" element={<BriefPage />} />
        <Route path="model" element={<ModelPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}