import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Send,
  Plus,
  Mic,
  Users,
  Zap,
  GitBranch,
  AlertTriangle,
  Check,
  RefreshCw,
  Edit3,
  ChevronRight,
  Sparkles,
  ShoppingCart,
  ClipboardList,
  Globe,
  CheckCircle2,
  Circle,
  CircleDot,
} from 'lucide-react';
import { useStreamingText } from '@/hooks/useStreamingText';
import EmptyStateChat from '@/components/icons/EmptyStateChat';
import { useWebSocketStore } from '@/store/useWebSocketStore';

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type MessageRole = 'user' | 'ai' | 'system';

interface EntityCard {
  type: 'actor' | 'capability';
  name: string;
  description: string;
  count: number;
}

interface SteeringAction {
  label: string;
  variant: 'accept' | 'modify' | 'replace';
}

interface RichContent {
  type: 'steering' | 'entities' | 'progress' | 'impact';
  title?: string;
  question?: string;
  options?: string[];
  entities?: EntityCard[];
  stageName?: string;
  stageNumber?: number;
  totalStages?: number;
  affectedNodes?: string[];
  actions?: SteeringAction[];
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  richContent?: RichContent;
  streaming?: boolean;
}

/* ------------------------------------------------------------------ */
/*  MOCK DATA                                                          */
/* ------------------------------------------------------------------ */

const mockConversation: ChatMessage[] = [
  {
    id: 'sys-1',
    role: 'system',
    content: 'Pipeline started for "E-Commerce Platform"',
    timestamp: 'Just now',
  },
  {
    id: 'ai-1',
    role: 'ai',
    content:
      "Welcome! I'm your Context Agent. I'll help you transform your requirements into a structured blueprint through 8 pipeline stages.\n\nDescribe your project and I'll guide it through the entire process — from intent capture to blueprint assembly.",
    timestamp: 'Just now',
  },
  {
    id: 'user-1',
    role: 'user',
    content:
      'Build an e-commerce platform with product catalog, shopping cart, payment processing, and order management. Users should be able to browse products, add to cart, checkout with Stripe, and track orders.',
    timestamp: '2m ago',
  },
  {
    id: 'ai-2',
    role: 'ai',
    content:
      'Great! I\'ve captured your intent. Let me process this through the pipeline stages.\n\nStarting with **Intent Capture** — I\'ve identified the core domain as an e-commerce platform with these key functional areas:\n\n• Product catalog browsing\n• Shopping cart management\n• Payment processing (Stripe)\n• Order tracking\n\nMoving to **Actor Discovery** now...',
    timestamp: '2m ago',
  },
  {
    id: 'ai-3',
    role: 'ai',
    content:
      'I\'ve identified **5 actors** in your system. Here\'s what I found:',
    timestamp: '3m ago',
    richContent: {
      type: 'entities',
      entities: [
        {
          type: 'actor',
          name: 'Customer',
          description: 'A registered user who browses products, manages their cart, and completes purchases.',
          count: 8,
        },
        {
          type: 'actor',
          name: 'Admin',
          description: 'System administrator who manages products, orders, and user accounts.',
          count: 6,
        },
        {
          type: 'actor',
          name: 'Vendor',
          description: 'Third-party seller who lists products and manages inventory.',
          count: 4,
        },
        {
          type: 'actor',
          name: 'Payment Gateway',
          description: 'External Stripe service for processing payments securely.',
          count: 3,
        },
        {
          type: 'actor',
          name: 'API Client',
          description: 'Mobile app and frontend SPA that consumes the REST API.',
          count: 5,
        },
      ],
    },
  },
  {
    id: 'ai-4',
    role: 'ai',
    content:
      'Does this actor structure look correct? You can add, remove, or modify any actor.',
    timestamp: '3m ago',
    richContent: {
      type: 'steering',
      title: 'Review Actor Structure',
      question: 'How would you like to proceed with these actors?',
      options: ['Looks correct — continue', 'Add another actor', 'Edit an existing actor', 'Remove an actor'],
      actions: [
        { label: 'Accept', variant: 'accept' },
        { label: 'Modify', variant: 'modify' },
        { label: 'Replace', variant: 'replace' },
      ],
    },
  },
  {
    id: 'user-2',
    role: 'user',
    content:
      'Yes, that looks correct. The admin should also have the ability to manage user roles.',
    timestamp: '4m ago',
  },
  {
    id: 'ai-5',
    role: 'ai',
    content:
      'Perfect! I\'ve noted the additional capability for the Admin role: **user role management**.\n\nNow proceeding through the remaining stages...',
    timestamp: '4m ago',
  },
  {
    id: 'ai-6',
    role: 'ai',
    content:
      '**Stage 5 complete!** I\'ve derived 24 user stories from the use cases. Here\'s a summary of the pipeline progress:',
    timestamp: '6m ago',
    richContent: {
      type: 'progress',
      stageNumber: 5,
      totalStages: 8,
      stageName: 'Story Derivation',
    },
  },
  {
    id: 'ai-7',
    role: 'ai',
    content:
      '**Impact Analysis** — The change you requested (adding user role management to Admin) affects the following blueprint nodes:',
    timestamp: '6m ago',
    richContent: {
      type: 'impact',
      affectedNodes: [
        'Admin.actor (capabilities +3)',
        'RBAC.rbac_matrix (roles expanded)',
        'Admin Dashboard.story_12 (acceptance criteria updated)',
        'User Management.use_case_4 (flows modified)',
        'Infrastructure.auth_service (permissions updated)',
      ],
    },
  },
];

const suggestionChips = [
  { icon: Users, label: 'Show all actors' },
  { icon: Zap, label: 'Add capability' },
  { icon: GitBranch, label: "What if I change..." },
];

const welcomeSuggestions = [
  {
    icon: ShoppingCart,
    title: 'Build an e-commerce platform',
    desc: 'With payment integration and order tracking',
  },
  {
    icon: ClipboardList,
    title: 'Create a task management system',
    desc: 'For remote teams with real-time sync',
  },
  {
    icon: Globe,
    title: 'Design a REST API',
    desc: 'For a social network with auth',
  },
];

/* ------------------------------------------------------------------ */
/*  STREAMING CURSOR COMPONENT                                         */
/* ------------------------------------------------------------------ */

function StreamingCursor() {
  return (
    <motion.span
      className="inline-block w-[2px] h-[1.1em] bg-[#00F5FF] ml-0.5 align-middle"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  RICH CONTENT CARDS                                                 */
/* ------------------------------------------------------------------ */

function SteeringCard({ rich }: { rich: RichContent }) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  return (
    <div className="mt-4 glass-bordered rounded-lg p-4 border-l-[3px] border-l-[#FFB800]">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={18} className="text-[#FFB800]" />
        <span className="font-heading-sm text-[#FFB800] text-sm">
          {rich.title || 'Clarification Needed'}
        </span>
      </div>
      {rich.question && (
        <p className="font-body-md text-[#E8F0FE] mb-3">{rich.question}</p>
      )}
      {rich.options && (
        <div className="space-y-2 mb-4">
          {rich.options.map((option, i) => (
            <button
              key={i}
              onClick={() => setSelectedOption(i)}
              className={`w-full flex items-center gap-3 p-3 rounded-md transition-all duration-200 text-left ${
                selectedOption === i
                  ? 'glass-tinted border-[rgba(0,245,255,0.3)]'
                  : 'glass-clear hover:bg-[rgba(10,22,40,0.5)]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                  selectedOption === i
                    ? 'border-[#00F5FF] bg-[rgba(0,245,255,0.2)]'
                    : 'border-[#4A6487]'
                }`}
              >
                {selectedOption === i && (
                  <div className="w-2 h-2 rounded-full bg-[#00F5FF]" />
                )}
              </div>
              <span className="font-body-md text-[#E8F0FE] text-sm">{option}</span>
            </button>
          ))}
        </div>
      )}
      {rich.actions && (
        <div className="flex items-center gap-2 flex-wrap">
          {rich.actions.map((action, i) => (
            <button
              key={i}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-body-sm text-sm transition-all duration-200 ${
                action.variant === 'accept'
                  ? 'bg-gradient-to-br from-[#00F5FF] to-[#00D4E5] text-[#050A14] shadow-[0_0_20px_rgba(0,245,255,0.2)] hover:shadow-[0_0_30px_rgba(0,245,255,0.35)]'
                  : action.variant === 'modify'
                  ? 'bg-transparent border border-[rgba(0,245,255,0.3)] text-[#00F5FF] hover:border-[rgba(0,245,255,0.5)] hover:bg-[rgba(0,245,255,0.05)]'
                  : 'bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.08)] text-[#8BA4C7] hover:bg-[rgba(10,22,40,0.5)] hover:text-[#E8F0FE]'
              }`}
            >
              {action.variant === 'accept' && <Check size={14} />}
              {action.variant === 'modify' && <Edit3 size={14} />}
              {action.variant === 'replace' && <RefreshCw size={14} />}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EntityPreviewCard({ entity }: { entity: EntityCard }) {
  const iconMap = {
    actor: Users,
    capability: Zap,
  };
  const Icon = iconMap[entity.type] || Users;

  return (
    <div className="glass-frosted rounded-lg p-4 min-w-[220px] max-w-[260px] flex-shrink-0 hover:border-[rgba(0,245,255,0.15)] transition-all duration-200">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className="text-[#00F5FF]" />
        <span className="font-heading-sm text-[#E8F0FE] text-sm">{entity.name}</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-body-sm text-[10px] uppercase tracking-wider text-[#4A6487]">
          {entity.type}
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14]" />
        <span className="font-body-sm text-[10px] text-[#39FF14]">Validated</span>
      </div>
      <p className="font-body-md text-[#8BA4C7] text-xs leading-relaxed line-clamp-2 mb-3">
        {entity.description}
      </p>
      <div className="flex items-center gap-3">
        <span className="font-mono-sm text-[10px] text-[#4A6487]">
          Cap: <span className="text-[#00F5FF]">{entity.count}</span>
        </span>
      </div>
    </div>
  );
}

function EntityCardsRow({ rich }: { rich: RichContent }) {
  if (!rich.entities) return null;
  return (
    <div className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {rich.entities.map((entity, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.3, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
        >
          <EntityPreviewCard entity={entity} />
        </motion.div>
      ))}
    </div>
  );
}

function ProgressCard(_props: { rich: RichContent }) {
  const stages = [
    { name: 'Intent Capture', status: 'done' },
    { name: 'Requirements', status: 'done' },
    { name: 'Actor Discovery', status: 'done' },
    { name: 'Capabilities', status: 'done' },
    { name: 'Use Cases', status: 'done' },
    { name: 'Stories', status: 'active' },
    { name: 'Tasks', status: 'pending' },
    { name: 'Blueprint', status: 'pending' },
  ];

  const doneCount = stages.filter((s) => s.status === 'done').length;
  const progressPct = (doneCount / stages.length) * 100;

  return (
    <div className="mt-4 glass-frosted rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-[#00F5FF]" />
        <span className="font-heading-sm text-[#E8F0FE] text-sm">Pipeline Progress</span>
      </div>
      <div className="w-full h-1.5 bg-[rgba(10,22,40,0.6)] rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #39FF14, #00F5FF)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
        />
      </div>
      <div className="space-y-1.5">
        {stages.map((stage, i) => (
          <div key={i} className="flex items-center gap-2">
            {stage.status === 'done' && <CheckCircle2 size={14} className="text-[#39FF14] flex-shrink-0" />}
            {stage.status === 'active' && <CircleDot size={14} className="text-[#00F5FF] flex-shrink-0 animate-pulse" />}
            {stage.status === 'pending' && <Circle size={14} className="text-[#4A6487] flex-shrink-0" />}
            <span
              className={`font-mono-sm text-xs ${
                stage.status === 'done'
                  ? 'text-[#8BA4C7]'
                  : stage.status === 'active'
                  ? 'text-[#00F5FF]'
                  : 'text-[#4A6487]'
              }`}
            >
              {stage.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImpactCard({ rich }: { rich: RichContent }) {
  if (!rich.affectedNodes) return null;
  return (
    <div className="mt-4 glass-frosted rounded-lg p-4 border-t-2 border-t-[#7B2FFF]">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch size={16} className="text-[#7B2FFF]" />
        <span className="font-heading-sm text-[#E8F0FE] text-sm">Impact Analysis</span>
      </div>
      <p className="font-body-md text-[#8BA4C7] text-xs mb-3">
        This change affects <span className="text-[#00F5FF] font-mono-sm">{rich.affectedNodes.length}</span> nodes in the blueprint:
      </p>
      <div className="space-y-1.5">
        {rich.affectedNodes.map((node, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.25 }}
            className="flex items-center gap-2 py-1.5 px-2 rounded-md glass-clear"
          >
            <ChevronRight size={12} className="text-[#7B2FFF] flex-shrink-0" />
            <span className="font-mono-sm text-xs text-[#E8F0FE]">{node}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MESSAGE BUBBLE                                                     */
/* ------------------------------------------------------------------ */

function AIMessageBubble({
  message,
  isStreaming,
  streamedText,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
  streamedText?: string;
}) {
  const displayContent = isStreaming ? streamedText || '' : message.content;
  const hasRichContent = message.richContent && !isStreaming;

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
      className="flex items-start gap-3 max-w-[768px]"
    >
      {/* AI Avatar */}
      <div className="w-8 h-8 rounded-full glass-tinted flex items-center justify-center flex-shrink-0 shadow-glow-cyan">
        <Bot size={16} className="text-[#00F5FF]" />
      </div>

      {/* Bubble */}
      <div className="flex-1 min-w-0">
        <div className="glass-frosted rounded-tl-[4px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[16px] p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="font-body-sm text-[#4A6487] text-xs">Pipeline</span>
          </div>

          {/* Content */}
          <div className="font-body-md text-[#E8F0FE] text-sm leading-relaxed whitespace-pre-wrap">
            {displayContent}
            {isStreaming && <StreamingCursor />}
          </div>

          {/* Rich Content */}
          {hasRichContent && message.richContent!.type === 'steering' && (
            <SteeringCard rich={message.richContent!} />
          )}
          {hasRichContent && message.richContent!.type === 'entities' && (
            <EntityCardsRow rich={message.richContent!} />
          )}
          {hasRichContent && message.richContent!.type === 'progress' && (
            <ProgressCard rich={message.richContent!} />
          )}
          {hasRichContent && message.richContent!.type === 'impact' && (
            <ImpactCard rich={message.richContent!} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 mt-1 px-1">
          <span className="font-body-sm text-[#4A6487] text-[10px]">{message.timestamp}</span>
        </div>
      </div>
    </motion.div>
  );
}

function UserMessageBubble({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="flex justify-end"
    >
      <div className="max-w-[640px]">
        <div className="glass-tinted rounded-tl-[16px] rounded-tr-[4px] rounded-br-[16px] rounded-bl-[16px] p-4">
          <p className="font-body-md text-[#E8F0FE] text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
        <div className="flex justify-end mt-1 px-1">
          <span className="font-body-sm text-[#4A6487] text-[10px]">{message.timestamp}</span>
        </div>
      </div>
    </motion.div>
  );
}

function SystemMessage({ message }: { message: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex justify-center"
    >
      <span className="font-body-sm text-[#FFB800] text-xs italic">{message.content}</span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  WELCOME STATE                                                      */
/* ------------------------------------------------------------------ */

function WelcomeState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
      className="flex flex-col items-center justify-center flex-1 px-4"
    >
      {/* Avatar */}
      <div className="w-16 h-16 rounded-full glass-tinted flex items-center justify-center mb-4 shadow-glow-cyan-strong">
        <Bot size={32} className="text-[#00F5FF]" />
      </div>

      {/* Title */}
      <h2 className="font-heading-lg text-[#E8F0FE] text-xl mb-2 text-center">
        Welcome to the Collaborative Steering Pipeline
      </h2>

      {/* Subtitle */}
      <p className="font-body-lg text-[#8BA4C7] text-sm text-center max-w-md mb-8">
        Describe your project and I'll guide it through 8 stages to produce a machine-executable blueprint.
      </p>

      {/* Suggestion Cards */}
      <p className="font-body-sm text-[#4A6487] text-xs mb-4">Try one of these examples:</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
        {welcomeSuggestions.map((suggestion, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.3 + i * 0.1,
              duration: 0.3,
              ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
            }}
            onClick={() => onSuggestionClick(`${suggestion.title} ${suggestion.desc}`)}
            className="glass-bordered rounded-xl p-4 text-left hover:glass-tinted hover:border-[rgba(0,245,255,0.3)] hover:-translate-y-0.5 transition-all duration-200 group"
          >
            <suggestion.icon size={20} className="text-[#00F5FF] mb-2 group-hover:scale-110 transition-transform duration-200" />
            <p className="font-body-md text-[#E8F0FE] text-sm mb-1">{suggestion.title}</p>
            <p className="font-body-sm text-[#4A6487] text-xs">{suggestion.desc}</p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN CHAT PAGE                                                     */
/* ------------------------------------------------------------------ */

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(mockConversation);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsStatus = useWebSocketStore((s) => s.status);

  const {
    displayText: streamedText,
    isStreaming,
    startStreaming,
  } = useStreamingText({ speed: 18 });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedText, isThinking]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    // Simulate AI response
    setTimeout(() => {
      setIsThinking(false);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content:
          'I\'ve processed your request. The pipeline is updating the blueprint based on your input. Here\'s what changed...',
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Start streaming effect for the response
      setTimeout(() => {
        startStreaming(
          'The system has been updated successfully. Would you like me to show you the full blueprint or continue with any other modifications?'
        );
      }, 300);
    }, 1500);
  }, [inputText, startStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (text: string) => {
    setShowWelcome(false);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: 'Just now',
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    setTimeout(() => {
      setIsThinking(false);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content:
          'Great project! Let me analyze your requirements and guide them through the pipeline stages.',
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1200);
  };

  const handleNewChat = () => {
    setMessages([]);
    setShowWelcome(true);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-56px-40px)] -m-6">
      {/* Chat Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] as [number, number, number, number] }}
        className="flex items-center justify-between px-6 py-3 border-b border-[rgba(138,180,230,0.08)] glass-frosted flex-shrink-0"
      >
        <div className="flex items-center gap-3">
          <h2 className="font-display-md text-[#E8F0FE] text-xl">Chat</h2>
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                wsStatus === 'connected'
                  ? 'bg-[#39FF14]'
                  : wsStatus === 'connecting'
                  ? 'bg-[#FFB800]'
                  : 'bg-[#FF3366]'
              }`}
            />
            <span className="font-body-sm text-[#4A6487] text-xs capitalize">{wsStatus}</span>
          </div>
        </div>
        <button
          onClick={handleNewChat}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-transparent border border-[rgba(0,245,255,0.3)] text-[#00F5FF] text-sm font-body-sm hover:border-[rgba(0,245,255,0.5)] hover:bg-[rgba(0,245,255,0.05)] transition-all duration-200"
        >
          <Plus size={14} />
          New Chat
        </button>
      </motion.div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 space-y-4">
        {messages.length === 0 && !showWelcome ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
            className="flex flex-col items-center justify-center h-full"
          >
            <div className="w-16 h-16 rounded-full glass-tinted flex items-center justify-center mb-4 shadow-glow-cyan-strong">
              <Bot size={32} className="text-[#00F5FF]" />
            </div>
            <EmptyStateChat size={160} className="mb-4 opacity-60" />
            <h3 className="font-heading-lg text-[#E8F0FE] text-xl mb-2">
              Start a conversation
            </h3>
            <p className="font-body-lg text-[#8BA4C7] text-sm text-center max-w-sm mb-6">
              Describe your project and the pipeline will transform it into a structured blueprint.
            </p>
            <button
              onClick={() => setShowWelcome(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-br from-[#00F5FF] to-[#00D4E5] text-[#050A14] font-body-sm text-sm shadow-[0_0_20px_rgba(0,245,255,0.2)] hover:shadow-[0_0_30px_rgba(0,245,255,0.35)] transition-all duration-200"
            >
              <Sparkles size={16} />
              New Chat
            </button>
          </motion.div>
        ) : showWelcome && messages.length === 0 ? (
          <WelcomeState onSuggestionClick={handleSuggestionClick} />
        ) : (
          <>
            {/* Messages */}
            <AnimatePresence mode="popLayout">
              {messages.map((msg, idx) => {
                const isLastAi =
                  msg.role === 'ai' &&
                  idx === messages.length - 1 &&
                  msg.streaming;

                if (msg.role === 'ai') {
                  return (
                    <AIMessageBubble
                      key={msg.id}
                      message={msg}
                      isStreaming={isLastAi}
                      streamedText={isLastAi ? streamedText : undefined}
                    />
                  );
                }
                if (msg.role === 'user') {
                  return <UserMessageBubble key={msg.id} message={msg} />;
                }
                return <SystemMessage key={msg.id} message={msg} />;
              })}
            </AnimatePresence>

            {/* Thinking state */}
            {isThinking && (
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 max-w-[768px]"
              >
                <div className="w-8 h-8 rounded-full glass-tinted flex items-center justify-center flex-shrink-0 shadow-glow-cyan">
                  <Bot size={16} className="text-[#00F5FF]" />
                </div>
                <div className="glass-frosted rounded-tl-[4px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[16px] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-body-md text-[#E8F0FE] text-sm">
                      Pipeline is thinking
                    </span>
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="text-[#00F5FF]"
                    >
                      ...
                    </motion.span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                      className="w-2 h-2 rounded-full bg-[#00F5FF]"
                    />
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                      className="w-2 h-2 rounded-full bg-[#00F5FF]"
                    />
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                      className="w-2 h-2 rounded-full bg-[#00F5FF]"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Streaming message (separate from list) */}
            {isStreaming && messages[messages.length - 1]?.role === 'ai' && (
              <div className="flex items-start gap-3 max-w-[768px]">
                <div className="w-8 h-8 rounded-full glass-tinted flex items-center justify-center flex-shrink-0 shadow-glow-cyan">
                  <Bot size={16} className="text-[#00F5FF]" />
                </div>
                <div className="glass-frosted rounded-tl-[4px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[16px] p-4 flex-1">
                  <span className="font-body-md text-[#E8F0FE] text-sm leading-relaxed">
                    {streamedText}
                    <StreamingCursor />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Suggestion Chips */}
      {messages.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2 flex-shrink-0 overflow-x-auto">
          {suggestionChips.map((chip, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              onClick={() => handleSuggestionClick(chip.label)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-bordered border-[rgba(0,245,255,0.15)] text-[#8BA4C7] text-xs font-body-sm hover:glass-tinted hover:text-[#E8F0FE] transition-all duration-150 flex-shrink-0 whitespace-nowrap"
            >
              <chip.icon size={12} />
              {chip.label}
            </motion.button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
          ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number],
          delay: 0.2,
        }}
        className="glass-elevated border-t border-[rgba(138,180,230,0.08)] px-6 py-3 flex-shrink-0"
      >
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          {/* Mic button */}
          <button
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-md glass-clear text-[#8BA4C7] hover:text-[#E8F0FE] hover:glass-tinted transition-all duration-200 mb-0.5"
            title="Voice input"
          >
            <Mic size={18} />
          </button>

          {/* Textarea */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message or paste requirements..."
              rows={1}
              className="w-full bg-[rgba(10,22,40,0.5)] backdrop-blur-[10px] border border-[rgba(138,180,230,0.1)] rounded-lg text-[#E8F0FE] placeholder:text-[rgba(138,180,230,0.4)] px-4 py-2.5 font-body-md text-sm outline-none focus:border-[rgba(0,245,255,0.5)] focus:shadow-[0_0_20px_rgba(0,245,255,0.1)] transition-all duration-200 resize-none max-h-[120px] scrollbar-thin"
            />
          </div>

          {/* Send button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 mb-0.5 ${
              inputText.trim()
                ? 'bg-gradient-to-br from-[#00F5FF] to-[#00D4E5] text-[#050A14] shadow-[0_0_20px_rgba(0,245,255,0.2)] hover:shadow-[0_0_30px_rgba(0,245,255,0.35)] hover:scale-105'
                : 'bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.08)] text-[#4A6487] opacity-40 cursor-not-allowed'
            }`}
          >
            <Send size={18} className={inputText.trim() ? 'rotate-0' : ''} />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
