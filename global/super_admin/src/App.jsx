import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import Login from "./pages/Login.jsx";
import Restaurants from "./pages/Restaurants.jsx";

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
        element={isAuthed ? <Navigate to="/restaurants" replace /> : <Login />}
      />
      <Route
        path="/restaurants"
        element={
          <Protected>
            <Restaurants />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/restaurants" replace />} />
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
