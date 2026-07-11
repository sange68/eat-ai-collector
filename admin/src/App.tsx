import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { clearToken, getToken } from "./api";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Review from "./pages/Review";
import Workbench from "./pages/Workbench";

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const logout = () => {
    clearToken();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-900 text-white p-4 flex flex-col gap-2">
        <h1 className="text-lg font-bold mb-4">Eat AI Collector</h1>
        <Link className="hover:text-emerald-300" to="/">
          儀表板
        </Link>
        <Link className="hover:text-emerald-300" to="/workbench">
          URL 工作台
        </Link>
        <Link className="hover:text-emerald-300" to="/review">
          審核佇列
        </Link>
        <button
          onClick={logout}
          className="mt-auto text-left text-sm text-slate-400 hover:text-white"
        >
          登出
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/workbench"
        element={
          <PrivateRoute>
            <Workbench />
          </PrivateRoute>
        }
      />
      <Route
        path="/review"
        element={
          <PrivateRoute>
            <Review />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
