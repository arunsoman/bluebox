import styles from "./ProjectCard.module.css";

interface ProjectCardProps {
  project: ProjectSummary;
  onOpen: (projectId: string) => void;
}

const STATUS_LABEL: Record<ProjectSummary["status"], string> = {
  initialized: "Not started",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  error: "Error",
};

export function ProjectCard({ project, onOpen }: ProjectCardProps) {
  return (
    <button className={styles.card} onClick={() => onOpen(project.project_id)}>
      <div className={styles.headerRow}>
        <span className={styles.name}>{project.project_name}</span>
        {project.has_errors && <span className={styles.errorDot} title="Has errors" />}
      </div>
      <div className={styles.meta}>
        Stage {project.current_stage}: {project.stage_name}
      </div>
      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{ width: `${project.completeness_percentage}%` }}
        />
      </div>
      <div className={styles.footerRow}>
        <span className={`${styles.statusBadge} ${styles[project.status]}`}>
          {STATUS_LABEL[project.status]}
        </span>
        {project.is_stale && <span className={styles.staleBadge}>Stale</span>}
      </div>
    </button>
  );
}
