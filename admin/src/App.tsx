import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { clearToken, getToken } from "./api";
import Dashboard from "./pages/Dashboard";
import GoogleExplorer from "./pages/GoogleExplorer";
import Login from "./pages/Login";
import Review from "./pages/Review";
import Workbench from "./pages/Workbench";

const nav = [
  { to: "/", label: "總覽" },
  { to: "/workbench", label: "① 網址/連鎖收集" },
  { to: "/google", label: "② Google 餐廳" },
  { to: "/review", label: "③ 審核入庫" },
];

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = () => {
    clearToken();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-slate-900 text-white p-4 flex flex-col gap-1">
        <h1 className="text-lg font-bold mb-1">Eat AI Collector</h1>
        <p className="text-xs text-slate-400 mb-4">飲食資料收集後台</p>
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`rounded px-2 py-2 text-sm ${
              location.pathname === item.to
                ? "bg-emerald-600 text-white"
                : "hover:bg-slate-800 text-slate-200"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <button
          onClick={logout}
          className="mt-auto text-left text-sm text-slate-400 hover:text-white"
        >
          登出
        </button>
      </aside>
      <main className="flex-1 p-6 md:p-8 overflow-auto">{children}</main>
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
        path="/google"
        element={
          <PrivateRoute>
            <GoogleExplorer />
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
