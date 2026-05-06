import { Navigate, Route, Routes } from "react-router-dom";
import WorkflowsPage from "./pages/WorkflowsPage";
import AutomationPage from "./pages/AutomationPage";
import CrmPage from "./pages/CrmPage";
import AnalyticsPage from "./pages/AnalyticsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/workflows" replace />} />
      <Route path="/workflows" element={<WorkflowsPage />} />
      <Route path="/automation" element={<AutomationPage />} />
      <Route path="/crm" element={<CrmPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="*" element={<Navigate to="/workflows" replace />} />
    </Routes>
  );
}
