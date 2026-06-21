import { useState, type FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { useAuthStore } from "@/stores/authStore";
import styles from "./NewProjectModal.module.css";

interface NewProjectModalProps {
  onClose: () => void;
  onCreate: (req: CreateProjectRequest) => Promise<void>;
}

const TEMPLATES: { id: CreateProjectRequest["template_id"]; label: string }[] = [
  { id: undefined, label: "Blank project" },
  { id: "saas", label: "SaaS app" },
  { id: "blog", label: "Blog / CMS" },
  { id: "api", label: "API" },
  { id: "mobile_backend", label: "Mobile app backend" },
];

export function NewProjectModal({ onClose, onCreate }: NewProjectModalProps) {
  const persona = useAuthStore((s) => s.user?.persona ?? "architect");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState<CreateProjectRequest["template_id"]>(undefined);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({ project_name: projectName, description, template_id: templateId, persona });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="new-project" onClose={onClose} width={440}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.label} htmlFor="project_name">project_name</label>
        <div className={styles.inputWrap}>
          <input
            id="project_name"
            required
            maxLength={100}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className={styles.input}
            placeholder="my-awesome-project"
          />
        </div>

        <label className={styles.label} htmlFor="description">description</label>
        <div className={styles.inputWrap}>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={styles.textarea}
            placeholder="# optional description"
          />
        </div>

        <label className={styles.label} htmlFor="template">template</label>
        <div className={styles.inputWrap}>
          <select
            id="template"
            value={templateId ?? ""}
            onChange={(e) => setTemplateId((e.target.value || undefined) as CreateProjectRequest["template_id"])}
            className={styles.input}
          >
            {TEMPLATES.map((t) => (
              <option key={t.label} value={t.id ?? ""}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onClose} className={styles.cancel}>
            [ CANCEL ]
          </Button>
          <Button type="submit" loading={submitting} className={styles.create}>
            [ CREATE ]
          </Button>
        </div>
      </form>
    </Modal>
  );
}