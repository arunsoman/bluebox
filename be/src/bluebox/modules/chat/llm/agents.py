"""pydantic-ai Agents for the Chat & Context Agent module."""

from bluebox.modules.chat.llm.requests import (
    ChatIntentParseRequest,
    ChatResponseRequest,
    ContextQuestionRequest,
    InlineSteeringCommentRequest,
    PreviewFeedbackInterpretationRequest,
)
from bluebox.modules.chat.llm.responses import (
    ChatIntentParseResult,
    ChatResponseResult,
    ContextAnswer,
    MidSteerSignal,
    PreviewFeedbackInterpretationResult,
)
from bluebox.shared_kernel.llm.connector import build_agent, run_structured

_CONTEXT_QUESTION_PROMPT = """\
You answer a user's "why" question about pipeline state using only the
retrieved_context supplied (Decision Ledger entries, audit events, nodes) -
never answer from general knowledge about what the system "probably" did.
Every claim in your answer must be traceable to at least one item in
retrieved_context, and every such item used must appear in sources. If
retrieved_context doesn't actually answer the question, say so rather than
guessing."""

context_question_agent = build_agent(ContextAnswer, _CONTEXT_QUESTION_PROMPT)


async def answer_context_question(request: ContextQuestionRequest) -> ContextAnswer:
    return await run_structured(context_question_agent, request.model_dump_json(indent=2))


_CHAT_INTENT_PARSE_PROMPT = """\
You parse a chat message into intent_matched/action_taken plus, when the
message maps cleanly to a concrete action, a structured_action (either a
node manipulation - add/edit/remove/deactivate/restore - or a steering
action - accept/modify/replace/authorize). Leave structured_action null for
pure questions or anything too ambiguous to act on safely - guessing wrong
here would trigger an unintended mutation, so prefer null over a low-
confidence guess. confidence reflects your certainty in the whole parse."""

chat_intent_parse_agent = build_agent(ChatIntentParseResult, _CHAT_INTENT_PARSE_PROMPT)


async def parse_chat_intent(request: ChatIntentParseRequest) -> ChatIntentParseResult:
    return await run_structured(chat_intent_parse_agent, request.model_dump_json(indent=2))


_CHAT_RESPONSE_PROMPT = """\
You write the system's reply in an ongoing chat conversation, given the
prior conversation_history and any already-parsed_intent. Keep tone
collaborative, not robotic. Only attach a rich_card when the reply is best
shown as a structured card (e.g. summarizing a steering panel or impact
report you are referencing) rather than plain text."""

chat_response_agent = build_agent(ChatResponseResult, _CHAT_RESPONSE_PROMPT)


async def generate_chat_response(request: ChatResponseRequest) -> ChatResponseResult:
    return await run_structured(chat_response_agent, request.model_dump_json(indent=2))


_PREVIEW_FEEDBACK_INTERPRETATION_PROMPT = """\
You turn free-text feedback on the Live Preview (optionally scoped to a
clicked element_selector/component_path) into a structured proposed_change
a revision can act on. target_node_id should reference the node the
component_path most plausibly belongs to when given; leave it null if the
feedback is too vague to localize. rationale explains your interpretation in
one or two sentences so the user can confirm or correct it before any
change is applied - never apply silently."""

preview_feedback_interpretation_agent = build_agent(
    PreviewFeedbackInterpretationResult, _PREVIEW_FEEDBACK_INTERPRETATION_PROMPT
)


async def interpret_preview_feedback(
    request: PreviewFeedbackInterpretationRequest,
) -> PreviewFeedbackInterpretationResult:
    return await run_structured(
        preview_feedback_interpretation_agent, request.model_dump_json(indent=2)
    )


_INLINE_STEERING_COMMENT_PROMPT = """\
You parse a `// @steering: ...` inline editor comment (given with its
surrounding_code for context) into a MidSteerSignal: a plain-language
instruction and an action_type describing what kind of change it requests
(e.g. "add_validation", "swap_dependency", "refactor"). The instruction
should restate the user's intent precisely, not paraphrase away specifics
like named libraries or fields."""

inline_steering_comment_agent = build_agent(MidSteerSignal, _INLINE_STEERING_COMMENT_PROMPT)


async def parse_inline_steering_comment(
    request: InlineSteeringCommentRequest,
) -> MidSteerSignal:
    return await run_structured(inline_steering_comment_agent, request.model_dump_json(indent=2))
