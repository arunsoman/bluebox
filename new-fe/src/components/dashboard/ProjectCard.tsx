import styles from "./ProjectCard.module.css";

interface ProjectCardProps {
  project: ProjectSummary;
  onOpen: (projectId: string) => void;
  index?: number;
}

const STATUS_LABEL: Record<ProjectSummary["status"], string> = {
  initialized: "IDLE",
  running: "RUNNING",
  paused: "PAUSED",
  completed: "DONE",
  error: "ERROR",
};

const STATUS_COLOR: Record<ProjectSummary["status"], string> = {
  initialized: "var(--term-fg-dim)",
  running: "var(--color-primary)",
  paused: "var(--color-warning)",
  completed: "var(--color-secondary)",
  error: "var(--color-error)",
};

export function ProjectCard({ project, onOpen, index = 0 }: ProjectCardProps) {
  return (
    <button
      className={styles.card}
      onClick={() => onOpen(project.project_id)}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className={styles.rimBar} style={{ background: STATUS_COLOR[project.status] }} />
      <div className={styles.content}>
        <div className={styles.titleBar}>
          <span className={styles.statusDot} style={{ background: STATUS_COLOR[project.status] }} />
          <span className={styles.name}>{project.project_name}</span>
          <span className={styles.ext}>.prj</span>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.metaKey}>stage</span>
          <span className={styles.metaValue}>{project.current_stage}:{project.stage_name}</span>
        </div>

        <div className={styles.progressRow}>
          <div className={styles.track}>
            <div
              className={styles.fill}
              style={{ width: `${project.completeness_percentage}%`, background: STATUS_COLOR[project.status] }}
            />
          </div>
          <span className={styles.percent}>{project.completeness_percentage}%</span>
        </div>

        <div className={styles.footer}>
          <span className={styles.status} style={{ color: STATUS_COLOR[project.status] }}>
            [{STATUS_LABEL[project.status]}]
          </span>
          {project.is_stale && <span className={styles.flag}>STALE</span>}
          {project.has_errors && <span className={styles.errFlag}>ERR</span>}
        </div>
      </div>
    </button>
  );
}