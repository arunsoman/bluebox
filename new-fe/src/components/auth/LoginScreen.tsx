import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/common/Button";
import { useToast } from "@/components/common/Toast/ToastContext";
import { ApiError } from "@/api/httpClient";
import styles from "./LoginScreen.module.css";

export function LoginScreen() {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const login = useAuthStore((s) => s.login);
  const status = useAuthStore((s) => s.status);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persona, setPersona] = useState<Persona>("architect");
  const [trustMode] = useState<TrustMode>("PARANOID");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login({ email, password, persona, trust_mode_default: trustMode });
      navigate("/", { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Login failed. Please try again.";
      pushToast({ severity: "error", title: "Sign in failed", body: message });
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Collaborative Steering Pipeline</h1>
        <p className={styles.subtitle}>Sign in to continue</p>

        <label className={styles.label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
        />

        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
        />

        <label className={styles.label} htmlFor="persona">
          Persona
        </label>
        <select
          id="persona"
          value={persona}
          onChange={(e) => setPersona(e.target.value as Persona)}
          className={styles.input}
        >
          <option value="architect">Developer / Architect</option>
          <option value="citizen_developer">Citizen Developer</option>
          <option value="security_engineer">Security Engineer</option>
        </select>
        <p className={styles.personaNote}>
          This build implements the full Power User / Architect interface only. Other personas
          authenticate normally but do not yet get persona-specific panel hiding.
        </p>

        <Button type="submit" loading={status === "loading"} style={{ width: "100%", marginTop: 16 }}>
          Sign in
        </Button>

        <div className={styles.disabledRow}>
          <button type="button" className={styles.disabledButton} disabled title="Coming soon">
            Continue with SSO
          </button>
          <button type="button" className={styles.disabledButton} disabled title="Coming soon">
            Use biometric login
          </button>
        </div>
      </form>
    </div>
  );
}
