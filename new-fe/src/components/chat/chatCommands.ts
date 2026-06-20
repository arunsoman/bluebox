export interface ChatCommand {
  command: string;
  syntax: string;
  help: string;
  available: boolean;
}

export const CHAT_COMMANDS: ChatCommand[] = [
  { command: "/steer", syntax: "/steer [instruction]", help: "Modify a node mid-stream", available: true },
  { command: "/why", syntax: "/why [question]", help: "Ask why — queries ContextAgent", available: true },
  {
    command: "/revert",
    syntax: "/revert [decision_id]",
    help: "Revert to previous decision — Audit Panel not implemented in this pass",
    available: false,
  },
  {
    command: "/checkpoint",
    syntax: "/checkpoint [label]",
    help: "Create a named checkpoint now",
    available: true,
  },
];
