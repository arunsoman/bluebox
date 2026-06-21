import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { WorkspacePage } from "@/pages/WorkspacePage";
import { ProtectedLayout } from "@/components/shell/ProtectedLayout";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedLayout />,
    children: [
      { path: "/", element: <Navigate to="/workspace" replace /> },
      { path: "/workspace", element: <WorkspacePage /> },
      { path: "/workspace/:projectId", element: <WorkspacePage /> },
    ],
  },
  { path: "*", element: <Navigate to="/workspace" replace /> },
]);
