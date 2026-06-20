import { useRef, useState } from "react";
import { TrustModeSelector } from "@/components/common/TrustModeSelector";
import { Button } from "@/components/common/Button";
import styles from "./LandingScreen.module.css";

const TEMPLATES = [
  {
    label: "Build a SaaS app",
    prompt:
      "I want to build a SaaS application with user authentication, subscription billing, an admin dashboard, and REST API. Target 1,000 users at launch.",
  },
  {
    label: "Create a blog",
    prompt:
      "Build a content management blog with markdown editor, categories, tags, SEO meta fields, and comment moderation.",
  },
  {
    label: "Design an API",
    prompt:
      "Design a RESTful API for a resource management system with CRUD operations, pagination, filtering, rate limiting, and OpenAPI documentation.",
  },
  {
    label: "Mobile app backend",
    prompt:
      "Create a backend for a mobile app with user registration, push notifications, file upload, and real-time chat over WebSockets.",
  },
];

interface LandingScreenProps {
  onSubmitText: (text: string, trustMode: TrustMode) => void;
  onUploadFile: (file: File) => void;
  onConnectGit: (url: string) => void;
  submitting: boolean;
}

export function LandingScreen({
  onSubmitText,
  onUploadFile,
  onConnectGit,
  submitting,
}: LandingScreenProps) {
  const [text, setText] = useState("");
  const [trustMode, setTrustMode] = useState<TrustMode>("PARANOID");
  const [gitUrl, setGitUrl] = useState("");
  const [showGitInput, setShowGitInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSubmitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTemplateClick(prompt: string) {
    setText(prompt);
    if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current);
    autoSubmitTimer.current = setTimeout(() => onSubmitText(prompt, trustMode), 600);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUploadFile(file);
    e.target.value = "";
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.headline}>Describe what you want to build...</h1>
        <p className={styles.subline}>
          Paste a PRD, type an idea, upload a file, or paste a Git URL — the pipeline adapts to
          your input.
        </p>

        <textarea
          className={styles.textInput}
          placeholder="I want to build…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={submitting}
        />

        <div className={styles.submitRow}>
          <Button
            disabled={text.trim().length === 0}
            loading={submitting}
            onClick={() => onSubmitText(text, trustMode)}
          >
            Submit
          </Button>
        </div>

        <div className={styles.divider} />

        <div className={styles.uploadRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.pdf,.png,.jpg,.jpeg,.webp,.csv,.zip"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button className={styles.chip} onClick={() => fileInputRef.current?.click()}>
            Upload PRD
          </button>
          <button className={styles.chip} onClick={() => fileInputRef.current?.click()}>
            Add Image
          </button>
          <button className={styles.chip} onClick={() => fileInputRef.current?.click()}>
            Upload CSV
          </button>
          <button className={styles.chip} onClick={() => fileInputRef.current?.click()}>
            Upload ZIP
          </button>
          <button className={styles.chip} onClick={() => setShowGitInput((v) => !v)}>
            Git URL
          </button>
          <button className={styles.chipDisabled} disabled title="Coming soon">
            Voice
          </button>
        </div>

        {showGitInput && (
          <div className={styles.gitRow}>
            <input
              className={styles.gitInput}
              placeholder="https://github.com/org/repo"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
            />
            <Button
              disabled={gitUrl.trim().length === 0}
              onClick={() => {
                onConnectGit(gitUrl);
                setShowGitInput(false);
              }}
            >
              Connect
            </Button>
          </div>
        )}

        <p className={styles.templateHeading}>Or start with a template</p>
        <div className={styles.templateRow}>
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              className={styles.templateCard}
              onClick={() => handleTemplateClick(t.prompt)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.trustModeBar}>
        <TrustModeSelector value={trustMode} onChange={setTrustMode} />
      </div>
    </div>
  );
}
