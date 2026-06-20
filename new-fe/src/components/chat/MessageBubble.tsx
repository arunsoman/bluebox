import { SteeringPanelCard } from "./RichCards/SteeringPanelCard";
import { ImpactReportCard } from "./RichCards/ImpactReportCard";
import { CodeStreamCard } from "./RichCards/CodeStreamCard";
import styles from "./MessageBubble.module.css";

const TYPE_CLASS: Record<ChatMessage["message_type"], string> = {
  user_intent: styles.userIntent,
  user_command: styles.userCommand,
  user_feedback: styles.userFeedback,
  system_response: styles.systemResponse,
  rich_card: styles.richCard,
};

function renderRichCard(message: ChatMessage) {
  const card = message.rich_card;
  if (!card) return null;
  switch (card.card_type) {
    case "steering_panel":
      return <SteeringPanelCard panel={card.payload as SteeringPanel} />;
    case "impact_report":
      return <ImpactReportCard report={card.payload as Parameters<typeof ImpactReportCard>[0]["report"]} />;
    case "code_stream":
      return <CodeStreamCard chunk={card.payload as Parameters<typeof CodeStreamCard>[0]["chunk"]} />;
    default:
      return <p className={styles.unsupportedCard}>Unsupported card type: {card.card_type}</p>;
  }
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === "user";
  return (
    <div className={`${styles.row} ${isUser ? styles.rowRight : styles.rowLeft}`}>
      <div className={`${styles.bubble} ${TYPE_CLASS[message.message_type]}`}>
        {message.rich_card ? renderRichCard(message) : <span>{message.content}</span>}
      </div>
    </div>
  );
}
