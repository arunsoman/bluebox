import styles from "./CommandPalette.module.css";
import { CHAT_COMMANDS, type ChatCommand } from "./chatCommands";

interface CommandPaletteProps {
  query: string;
  onSelect: (command: ChatCommand) => void;
}

export function CommandPalette({ query, onSelect }: CommandPaletteProps) {
  const filtered = CHAT_COMMANDS.filter((c) => c.command.startsWith(query.split(" ")[0] || "/"));
  if (filtered.length === 0) return null;

  return (
    <div className={styles.palette}>
      {filtered.map((cmd) => (
        <button
          key={cmd.command}
          className={styles.row}
          disabled={!cmd.available}
          title={!cmd.available ? cmd.help : undefined}
          onClick={() => onSelect(cmd)}
        >
          <span className={styles.syntax}>{cmd.syntax}</span>
          <span className={styles.help}>{cmd.help}</span>
        </button>
      ))}
    </div>
  );
}
