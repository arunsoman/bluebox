import { useState } from "react";
import { Button } from "@/components/common/Button";
import styles from "./MinimalistDialogueView.module.css";

interface MinimalistDialogueViewProps {
  dialogue: MinimalistDialogue;
  onSubmit: (answers: MinimalistAnswer[]) => void;
  submitting: boolean;
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: MinimalistQuestion;
  value: string | string[] | number;
  onChange: (v: string | string[] | number) => void;
}) {
  if (question.input_type === "free_text") {
    return (
      <textarea
        className={styles.textarea}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (question.input_type === "numeric") {
    return (
      <input
        type="number"
        className={styles.numberInput}
        value={typeof value === "number" ? value : ""}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }
  if (question.input_type === "single_select") {
    return (
      <div className={styles.optionGroup}>
        {(question.options ?? []).map((opt) => (
          <label
            key={opt}
            className={`${styles.optionRow} ${value === opt ? styles.optionSelected : ""}`}
          >
            <input
              type="radio"
              name={question.question_id}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }
  // multi_select
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className={styles.optionGroup}>
      {(question.options ?? []).map((opt) => (
        <label
          key={opt}
          className={`${styles.optionRow} ${selected.includes(opt) ? styles.optionSelected : ""}`}
        >
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={(e) =>
              onChange(e.target.checked ? [...selected, opt] : selected.filter((o) => o !== opt))
            }
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

export function MinimalistDialogueView({ dialogue, onSubmit, submitting }: MinimalistDialogueViewProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, MinimalistAnswer>>({});
  const [shake, setShake] = useState(false);

  const maybeQuestion = dialogue.questions[index];
  if (!maybeQuestion) return null;
  // Re-bound so nested closures below see a definitely-defined value —
  // TS does not carry the `if (!maybeQuestion) return null` narrowing
  // into function declarations defined later in this scope.
  const question: MinimalistQuestion = maybeQuestion;
  const current = answers[question.question_id];

  function setAnswer(value: string | string[] | number, skipped = false) {
    setAnswers((prev) => ({
      ...prev,
      [question.question_id]: {
        question_id: question.question_id,
        answer: value,
        skipped,
        override_suggested: false,
      },
    }));
  }

  function validate(): boolean {
    const rules = question.validation_rules;
    if (!rules?.required) return true;
    const value = current?.answer;
    if (current?.skipped) return true;
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      return false;
    }
    return true;
  }

  function handleNext() {
    if (!validate()) {
      setShake(true);
      setTimeout(() => setShake(false), 300);
      return;
    }
    if (index === dialogue.questions.length - 1) {
      onSubmit(Object.values(answers));
    } else {
      setIndex(index + 1);
    }
  }

  function handleSkip() {
    setAnswer("", true);
    if (index === dialogue.questions.length - 1) {
      onSubmit(Object.values({ ...answers, [question.question_id]: { question_id: question.question_id, answer: "", skipped: true, override_suggested: false } }));
    } else {
      setIndex(index + 1);
    }
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.card} ${shake ? styles.shake : ""}`}>
        <div className={styles.questionNumber}>
          QUESTION {question.question_number} OF {question.total_questions}
        </div>
        <p className={styles.questionText}>{question.question_text}</p>
        <QuestionInput
          question={question}
          value={current?.answer ?? (question.input_type === "multi_select" ? [] : "")}
          onChange={(v) => setAnswer(v)}
        />
        <div className={styles.footer}>
          <button className={styles.skipLink} onClick={handleSkip}>
            Skip
          </button>
          <Button loading={submitting} onClick={handleNext}>
            {index === dialogue.questions.length - 1 ? "Submit" : "Next →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
