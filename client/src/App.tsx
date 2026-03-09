import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Login from "./pages/Login";
import GoogleCallback from "./pages/GoogleCallback";
import Dashboard from "./pages/Dashboard";
import ExternalTraining from "./pages/ExternalTraining";
import InternalTraining from "./pages/InternalTraining";
import InternalLecture from "./pages/InternalLecture";
import Certification from "./pages/Certification";
import Statistics from "./pages/Statistics";
import AllRecords from "./pages/AllRecords";
import UserManagement from "./pages/UserManagement";
import BulkUpload from "./pages/BulkUpload";
import TeamRecords from "./pages/TeamRecords";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/google/callback" element={<GoogleCallback />} />
      <Route path="/change-password" element={<Navigate to="/" replace />} />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute adminOnly>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/external-training" element={<ExternalTraining />} />
        <Route path="/internal-training" element={<InternalTraining />} />
        <Route path="/internal-lecture" element={<InternalLecture />} />
        <Route path="/certification" element={<Certification />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route
          path="/all-records"
          element={
            <ProtectedRoute adminOnly>
              <AllRecords />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-management"
          element={
            <ProtectedRoute adminOnly>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bulk-upload"
          element={
            <ProtectedRoute adminOnly>
              <BulkUpload />
            </ProtectedRoute>
          }
        />
        <Route path="/team-records" element={<TeamRecords />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
