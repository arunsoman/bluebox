import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { WorkspacePage } from "@/pages/WorkspacePage";
import { ProtectedLayout } from "@/components/shell/ProtectedLayout";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedLayout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/projects/:projectId/onboarding", element: <OnboardingPage /> },
      { path: "/projects/:projectId/workspace", element: <WorkspacePage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
