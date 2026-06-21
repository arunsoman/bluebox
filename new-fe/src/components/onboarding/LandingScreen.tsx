import { useCallback, useEffect, useRef, useState } from "react";
import { TrustModeSelector } from "@/components/common/TrustModeSelector";
import { Button } from "@/components/common/Button";
import styles from "./LandingScreen.module.css";

const TEMPLATES = [
  { label: "saas", prompt: "I want to build a SaaS application with user authentication, subscription billing, an admin dashboard, and REST API. Target 1,000 users at launch." },
  { label: "blog", prompt: "Build a content management blog with markdown editor, categories, tags, SEO meta fields, and comment moderation." },
  { label: "api", prompt: "Design a RESTful API for a resource management system with CRUD operations, pagination, filtering, rate limiting, and OpenAPI documentation." },
  { label: "mobile", prompt: "Create a backend for a mobile app with user registration, push notifications, file upload, and real-time chat over WebSockets." },
];

interface InputClassifier {
  onSubmitText: (text: string, trustMode: TrustMode) => void;
  onUploadFile: (file: File) => void;
  onConnectGit: (url: string) => void;
  submitting: boolean;
  /** Present when rendered as a dismissible popup (e.g. over the workspace screen) rather than a standalone route. */
  onClose?: () => void;
}

export function LandingScreen({
  onSubmitText,
  onUploadFile,
  onConnectGit,
  submitting,
  onClose,
}: InputClassifier) {
  const [text, setText] = useState("");
  const [trustMode, setTrustMode] = useState<TrustMode>("PARANOID");
  const [gitUrl, setGitUrl] = useState("");
  const [showGit, setShowGit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setText("");
    setGitUrl("");
    setShowGit(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  return (
    <div className={styles.page}>

      <main className={styles.main}>
        <div className={styles.window}>
          <div className={styles.winTitle}>
            <span>~/new-project</span>
            <button
              type="button"
              className={styles.winControls}
              onClick={handleClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className={styles.winBody}>
            <div className={styles.prompt}>
              <span className={styles.symbol}>$</span>
              <span>describe your build target</span>
            </div>

            <textarea
              className={styles.editor}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={submitting}
              placeholder="# e.g., I want to build a..."
              rows={6}
            />

            <div className={styles.toolbar}>
              <div className={styles.actions}>
                <button className={styles.tool} onClick={() => fileRef.current?.click()}>[upload]</button>
                <button className={styles.tool} onClick={() => setShowGit((v) => !v)}>[git]</button>
                <button className={styles.tool} disabled>[voice]</button>
              </div>
              <Button
                className={styles.execute}
                disabled={!text.trim() || submitting}
                onClick={() => onSubmitText(text, trustMode)}
              >
                {submitting ? "EXECUTING..." : "[ RUN PIPELINE ]"}
              </Button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".md,.txt,.pdf,.png,.jpg,.jpeg,.webp,.csv,.zip"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadFile(f); e.target.value = ""; }}
            />

            {showGit && (
              <div className={styles.gitRow}>
                <span className={styles.symbol}>~</span>
                <input
                  className={styles.gitInput}
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                />
                <button className={styles.tool} onClick={() => { onConnectGit(gitUrl); setShowGit(false); }}>[connect]</button>
              </div>
            )}

            <div className={styles.templates}>
              <span className={styles.sectionLabel}># templates</span>
              <div className={styles.templateGrid}>
                {TEMPLATES.map((t) => (
                  <button key={t.label} className={styles.template} onClick={() => setText(t.prompt)}>
                    <span>{t.label}</span>
                    <span>→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}