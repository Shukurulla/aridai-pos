import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Features from "./pages/Features.jsx";
import Branches from "./pages/Branches.jsx";
import BranchDetail from "./pages/BranchDetail.jsx";

function Protected({ children }) {
  const { isAuthed } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthed } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthed ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/features" element={<Features />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/branches/:id" element={<BranchDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
