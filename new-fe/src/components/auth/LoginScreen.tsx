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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login({ email, password, persona, trust_mode_default: "PARANOID" });
      navigate("/workspace", { replace: true });
    } catch (err) {
      pushToast({
        severity: "error",
        title: "ACCESS DENIED",
        body: err instanceof ApiError ? err.message : "Auth failure",
      });
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.gridOverlay} />
      <div className={styles.ambientGlow} />
      
      <div className={styles.terminal}>
        <div className={styles.terminalHeader}>
          <span className={styles.dotRed} />
          <span className={styles.dotYellow} />
          <span className={styles.dotGreen} />
          <span className={styles.title}>bluebox — login</span>
        </div>
        
        <div className={styles.body}>
          <pre className={styles.ascii}>
{`   ____  __               __   _____            
  / __ )/ /___  ________/_/  / ___/____  __  __
 / __  / / __ \\/ ___/ _ \\/    \\__ \\/ __ \\/ / / /
/ /_/ / / /_/ / /  /  __/    ___/ / /_/ / /_/ / 
/_____/_/\\____/_/   \\___/____/____/\\____/\\__, /  
                      /_____/           /____/   `}
          </pre>
          
          <div className={styles.prompt}>
            <span className={styles.promptSymbol}>$</span>
            <span>authenticate --protocol=secure</span>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>email</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputPrompt}>~</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="user@domain.net"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>password</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputPrompt}>#</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>persona</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputPrompt}>&gt;</span>
                <select
                  value={persona}
                  onChange={(e) => setPersona(e.target.value as Persona)}
                  className={styles.input}
                >
                  <option value="architect">architect</option>
                  <option value="citizen_developer">citizen_dev</option>
                  <option value="security_engineer">sec_eng</option>
                </select>
              </div>
            </div>

            <Button type="submit" loading={status === "loading"} className={styles.execute}>
              [ EXECUTE ]
            </Button>
          </form>

          <div className={styles.note}>
            <span className={styles.comment}># biometric and SSO modules disabled in this build</span>
          </div>
        </div>
      </div>
    </div>
  );
}