import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginScreen } from "./LoginScreen";
import { ToastProvider } from "@/components/common/Toast/ToastProvider";
import { useAuthStore } from "@/stores/authStore";
import { authApi } from "@/api/endpoints/auth";

vi.mock("@/api/endpoints/auth", () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
  },
}));

function renderLoginScreen() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <LoginScreen />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, accessToken: null, sessionId: null, status: "idle", error: null });
  });

  it("calls the real login endpoint with the entered credentials and selected persona", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: "tok",
      refresh_token: "refresh",
      session_id: "sess-1",
      user: {
        user_id: "u1",
        email: "dev@example.com",
        name: "Dev",
        persona: "architect",
        permissions: ["pipeline_user"],
        preferences: { theme: "light", language: "en-US", notification_channel: "websocket" },
      },
    });

    renderLoginScreen();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "dev@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith({
      email: "dev@example.com",
      password: "password123",
      persona: "architect",
      trust_mode_default: "PARANOID",
    }));
    await waitFor(() => expect(useAuthStore.getState().status).toBe("authenticated"));
    expect(useAuthStore.getState().accessToken).toBe("tok");
  });

  it("shows a toast and does not authenticate when login fails", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error("Invalid credentials"));

    renderLoginScreen();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "dev@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("Sign in failed")).toBeInTheDocument());
    expect(useAuthStore.getState().status).toBe("error");
  });

  it("renders SSO and biometric as disabled, matching the documented 'coming soon' scope", () => {
    renderLoginScreen();
    expect(screen.getByRole("button", { name: "Continue with SSO" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Use biometric login" })).toBeDisabled();
  });
});
