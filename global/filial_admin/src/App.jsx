import { useAuth } from "./auth";
import Login from "./pages/Login";
import Shell from "./pages/Shell";

export default function App() {
  const { isAuthed } = useAuth();
  return isAuthed ? <Shell /> : <Login />;
}
