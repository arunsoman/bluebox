/**
 * FR-IDE-09 — `// @steering: <instruction>` comments are parsed as
 * MidSteerSignals and stripped from the file before execution/save.
 */
const STEERING_COMMENT = /^\s*(\/\/|#)\s*@steering:\s*(.+)$/;

export interface ParsedSteering {
  instructions: string[];
  strippedContent: string;
}

export function parseInlineSteering(content: string): ParsedSteering {
  const instructions: string[] = [];
  const lines = content.split("\n").filter((line) => {
    const match = STEERING_COMMENT.exec(line);
    if (match?.[2]) {
      instructions.push(match[2].trim());
      return false;
    }
    return true;
  });
  return { instructions, strippedContent: lines.join("\n") };
}
