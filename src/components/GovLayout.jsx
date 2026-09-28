import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileStack,
  Inbox,
  ClipboardCheck,
  LogOut,
  Sun,
  Moon,
  PlusCircle,
  Activity,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

function GovLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initial = (user?.displayName || user?.orgName || user?.email || "G")
    .charAt(0)
    .toUpperCase();

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="logo-row">
          <div className="logo">Startup2Gov</div>
          <button
            className="theme-toggle"
            onClick={toggle}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
        <div className="gov-badge" title={user?.designation || "Government account"}>
          GOVT · {user?.orgName || user?.department || "Department"}
        </div>
        <nav>
          <NavLink
            to="/gov/dashboard"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>
          <NavLink
            to="/gov/challenges"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <FileStack size={20} />
            My Challenges
          </NavLink>
          <NavLink
            to="/gov/challenges/new"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <PlusCircle size={20} />
            New Challenge
          </NavLink>
          <NavLink
            to="/gov/applications"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Inbox size={20} />
            Applications
            </NavLink>
          <NavLink
            to="/evaluation"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <ClipboardCheck size={20} />
            Evaluation
          </NavLink>
          <NavLink
            to="/gov/pilots"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Activity size={20} />
            Pilots & KPIs
          </NavLink>
        </nav>
        <div className="side-footer">
          <div className="side-user">
            <div className="avatar side-avatar">{initial}</div>
            <span className="side-user-name">
              {user?.displayName || user?.email || "Government"}
            </span>
          </div>
          <button onClick={handleLogout} className="side-btn">
            <LogOut size={16} />
            Logout
          </button>
          <p className="demo-label" style={{ marginTop: 10 }}>
            Mock auth · data stays in this browser
          </p>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default GovLayout;
