import { useState } from "react";
import Login from "./pages/Login";
import Courses from "./pages/Courses";

export default function App() {
  // Revisar si ya existe token
  const [token, setToken] = useState(
    sessionStorage.getItem("token")
  );

  // Si no hay token → mostrar Login
  if (!token) {
    return <Login onLogin={setToken} />;
  }

  // Si hay token → mostrar app protegida
  return (
    <div>
      <button onClick={() => {
        sessionStorage.removeItem("token");
        setToken(null);
      }}>
        Logout
      </button>

      <Courses />
    </div>
  );
}
