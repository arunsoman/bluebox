import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Upload,
  Sparkles,
  Zap,
  ClipboardPaste,
  X,
  Check,
  ArrowRight,
  Loader2,
  FileUp,
} from 'lucide-react';
import GlassCard from './GlassCard';
import GlassButton from './GlassButton';
import { FEATURES } from '@/lib/config';
import { createSession } from '@/lib/api';
import type { PRDClassification } from '@/store/usePipelineStore';

/* ─── ease token ─── */
const easeSpring = [0.175, 0.885, 0.32, 1.275] as [number, number, number, number];

/* ─── classification colours ─── */
const CLASSIFICATION_CONFIG = {
  WELL_FORMED: {
    color: '#39FF14',
    bg: 'rgba(57,255,20,0.1)',
    border: 'rgba(57,255,20,0.3)',
    label: 'Well Formed',
    icon: FileText,
    description: 'Complete PRD with sections, structure, and detail',
  },
  MINIMALIST: {
    color: '#FFB800',
    bg: 'rgba(255,184,0,0.1)',
    border: 'rgba(255,184,0,0.3)',
    label: 'Minimalist',
    icon: Zap,
    description: 'Concise input with core requirements defined',
  },
  SEED_ONLY: {
    color: '#00F5FF',
    bg: 'rgba(0,245,255,0.1)',
    border: 'rgba(0,245,255,0.3)',
    label: 'Seed Only',
    icon: Sparkles,
    description: 'Idea seed — the pipeline will guide clarification',
  },
};

/* ─── props ─── */
interface PRDInputProps {
  onSubmit: (text: string) => void;
  classifyPRD: (text: string) => PRDClassification;
}

/* ─── component ─── */
export default function PRDInput({ onSubmit, classifyPRD }: PRDInputProps) {
  const [text, setText] = useState('');
  const [classification, setClassification] = useState<PRDClassification | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const classifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── real-time classification (debounced) ── */
  const debouncedClassify = useCallback(
    (value: string) => {
      if (classifyTimer.current) {
        clearTimeout(classifyTimer.current);
        classifyTimer.current = null;
      }
      if (value.trim().length < 5) {
        setClassification(null);
        return;
      }
      classifyTimer.current = setTimeout(() => {
        setClassification(classifyPRD(value));
        classifyTimer.current = null;
      }, 400);
    },
    [classifyPRD]
  );

  const handleTextChange = (value: string) => {
    setText(value);
    debouncedClassify(value);
  };

  /* ── drag & drop ── */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        handleTextChange(content);
      };
      reader.readAsText(file);
    }
  };

  /* ── file upload ── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        handleTextChange(content);
      };
      reader.readAsText(file);
    }
  };

  /* ── paste from clipboard ── */
  const handlePaste = async () => {
    try {
      const clipboard = await navigator.clipboard.readText();
      handleTextChange(clipboard);
    } catch {
      /* permission denied */
    }
  };

  /* ── submit ── */
  const handleSubmit = async () => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // If live API is enabled, create a real backend session
      if (FEATURES.liveApi) {
        await createSession(text);
      }
      // Always update the local store (triggers the Dashboard view)
      onSubmit(text);
    } catch (err) {
      console.error('Failed to submit PRD:', err);
      // Still show the dashboard even if backend call fails
      onSubmit(text);
    }
    // Component will unmount after store update — no need to reset isSubmitting
  };

  /* ── sample PRDs ── */
  const samplePRDs = [
    {
      label: 'E-Commerce Platform',
      category: 'WELL_FORMED' as const,
      text: `# E-Commerce Platform PRD\n\n## Overview\nBuild a full-stack e-commerce platform supporting product catalog, shopping cart, checkout flow, and order management.\n\n## Actors\n- Customer: browses products, adds to cart, checks out\n- Admin: manages inventory, processes refunds\n- Payment Gateway: processes transactions\n\n## Features\n1. Product search with filters (category, price, rating)\n2. Guest checkout without registration\n3. Multi-currency support (USD, EUR, GBP)\n4. Real-time inventory tracking\n5. Email notifications for order updates\n\n## Architecture\n- Frontend: React with TypeScript\n- Backend: Node.js with Express\n- Database: PostgreSQL with Redis cache\n- Search: Elasticsearch\n\n## Security\n- PCI-DSS compliance for payment data\n- JWT authentication with refresh tokens\n- Rate limiting on all API endpoints\n\n## Performance\n- Page load < 2s\n- Support 10,000 concurrent users\n- 99.9% uptime SLA`,
    },
    {
      label: 'Task Management App',
      category: 'MINIMALIST' as const,
      text: `A task management app for teams. Users create tasks, assign them to team members, set due dates, and track progress with Kanban boards. Needs real-time collaboration, Slack integration, and email reminders. Mobile responsive. Uses React frontend and Python FastAPI backend with PostgreSQL.`,
    },
    {
      label: 'Weather App Idea',
      category: 'SEED_ONLY' as const,
      text: `A weather prediction app that uses AI to provide hyper-local forecasts for farmers.`,
    },
  ];

  /* ── cleanup timer on unmount ── */
  useEffect(() => {
    return () => {
      if (classifyTimer.current) {
        clearTimeout(classifyTimer.current);
        classifyTimer.current = null;
      }
    };
  }, []);

  const currentConfig = classification ? CLASSIFICATION_CONFIG[classification.category] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeSpring }}
      className="w-full max-w-4xl mx-auto"
    >
      {/* ── Header ── */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: easeSpring, delay: 0.1 }}
          className="inline-flex items-center gap-3 mb-4"
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(0,245,255,0.1)',
              border: '1px solid rgba(0,245,255,0.3)',
            }}
          >
            <FileText size={24} style={{ color: '#00F5FF' }} />
          </div>
          <h1
            className="font-display-md text-text-primary"
            style={{ fontSize: '28px', letterSpacing: '0.04em' }}
          >
            Start a New Pipeline
          </h1>
        </motion.div>
        <p className="font-body-lg text-text-secondary max-w-xl mx-auto">
          Paste your Product Requirements Document, upload a text file, or type your idea directly.
          The pipeline will transform it into a structured blueprint.
        </p>
      </div>

      {/* ── Input Area ── */}
      <GlassCard variant="elevated" padding="lg" radius="xl" glow="subtle">
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-heading-sm text-text-secondary" style={{ fontSize: '14px' }}>
                Input your requirements
              </span>
              {classification && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="font-body-sm px-2 py-0.5 rounded-full"
                  style={{
                    background: currentConfig?.bg,
                    color: currentConfig?.color,
                    border: `1px solid ${currentConfig?.border}`,
                  }}
                >
                  {classification.wordCount} words
                </motion.span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePaste}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body-sm transition-all duration-200 hover:bg-white/5"
                style={{
                  color: '#8BA4C7',
                  border: '1px solid rgba(138,180,230,0.1)',
                }}
              >
                <ClipboardPaste size={14} />
                Paste
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body-sm transition-all duration-200 hover:bg-white/5"
                style={{
                  color: '#8BA4C7',
                  border: '1px solid rgba(138,180,230,0.1)',
                }}
              >
                <Upload size={14} />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.prd"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* Textarea with drag overlay */}
          <div
            className="relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Paste your PRD here, or type your project idea...&#10;&#10;Examples:&#10;- 'A mobile app for tracking daily water intake with reminders'&#10;- Full PRD with sections (Overview, Features, Architecture, etc.)&#10;- Link to a product spec document"
              className="w-full min-h-[280px] max-h-[500px] resize-y font-body-lg p-4 rounded-xl outline-none transition-all duration-200 placeholder:text-text-tertiary/40"
              style={{
                background: 'rgba(10,22,40,0.5)',
                border: isDragging
                  ? '2px dashed rgba(0,245,255,0.5)'
                  : '1px solid rgba(138,180,230,0.1)',
                color: '#E8F0FE',
                fontSize: '15px',
                lineHeight: '1.7',
                backdropFilter: 'blur(10px)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0,245,255,0.4)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(0,245,255,0.08)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(138,180,230,0.1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />

            {/* Drag overlay */}
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 rounded-xl flex flex-col items-center justify-center pointer-events-none"
                  style={{
                    background: 'rgba(5,10,20,0.85)',
                    backdropFilter: 'blur(8px)',
                    border: '2px dashed rgba(0,245,255,0.4)',
                  }}
                >
                  <FileUp size={40} style={{ color: '#00F5FF' }} />
                  <p className="font-heading-md text-text-primary mt-3">Drop your file here</p>
                  <p className="font-body-sm text-text-tertiary">.txt, .md, or .prd files</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Clear button */}
            <AnimatePresence>
              {text.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => {
                    setText('');
                    setClassification(null);
                    textareaRef.current?.focus();
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-md transition-colors hover:bg-white/10"
                  style={{ color: '#4A6487' }}
                >
                  <X size={16} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* ── Classification Panel ── */}
          <AnimatePresence>
            {classification && currentConfig && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: easeSpring }}
              >
                <GlassCard
                  variant="bordered"
                  padding="md"
                  radius="lg"
                  glow="subtle"
                  className="border-l-4"
                  style={{ borderLeftColor: currentConfig.color }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: currentConfig.bg, border: `1px solid ${currentConfig.border}` }}
                    >
                      <currentConfig.icon size={20} style={{ color: currentConfig.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-heading-md text-text-primary" style={{ fontSize: '16px' }}>
                          {currentConfig.label}
                        </h3>
                        <span
                          className="font-body-sm px-2 py-0.5 rounded-full"
                          style={{
                            background: `${currentConfig.color}18`,
                            color: currentConfig.color,
                            fontSize: '12px',
                          }}
                        >
                          {(classification.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      <p className="font-body-md text-text-secondary" style={{ fontSize: '13px' }}>
                        {currentConfig.description}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {classification.basis.map((item, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 font-body-sm px-2 py-0.5 rounded"
                            style={{
                              background: 'rgba(10,22,40,0.6)',
                              color: '#8BA4C7',
                              fontSize: '11px',
                              border: '1px solid rgba(138,180,230,0.08)',
                            }}
                          >
                            <Check size={10} style={{ color: currentConfig.color }} />
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Action Bar ── */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              {/* Sample PRDs toggle */}
              <button
                onClick={() => setShowSamples(!showSamples)}
                className="font-body-sm transition-colors hover:text-[#00F5FF]"
                style={{ color: '#4A6487', fontSize: '13px' }}
              >
                {showSamples ? 'Hide' : 'Try a'} sample
              </button>
            </div>

            <div className="flex items-center gap-3">
              {text.length > 0 && (
                <span className="font-body-sm text-text-tertiary" style={{ fontSize: '12px' }}>
                  {text.length} chars
                </span>
              )}
              <GlassButton
                variant="primary"
                onClick={handleSubmit}
                disabled={!text.trim() || isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span className="font-heading-sm">Initializing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <span className="font-heading-sm">Start Pipeline</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </GlassButton>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ── Sample PRDs Panel ── */}
      <AnimatePresence>
        {showSamples && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.3, ease: easeSpring }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {samplePRDs.map((sample, i) => {
                const cfg = CLASSIFICATION_CONFIG[sample.category];
                return (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.35, ease: easeSpring }}
                    onClick={() => handleTextChange(sample.text)}
                    className="text-left p-4 rounded-xl transition-all duration-200 hover:translate-y-[-2px]"
                    style={{
                      background: 'rgba(10,22,40,0.4)',
                      backdropFilter: 'blur(20px) saturate(120%)',
                      border: '1px solid rgba(138,180,230,0.08)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = cfg.border;
                      e.currentTarget.style.boxShadow = `0 0 20px ${cfg.color}10`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(138,180,230,0.08)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <cfg.icon size={14} style={{ color: cfg.color }} />
                      <span
                        className="font-heading-sm px-1.5 py-0.5 rounded"
                        style={{
                          background: cfg.bg,
                          color: cfg.color,
                          fontSize: '10px',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <h4 className="font-heading-md text-text-primary mb-1" style={{ fontSize: '14px' }}>
                      {sample.label}
                    </h4>
                    <p className="font-body-sm text-text-tertiary line-clamp-2" style={{ fontSize: '12px' }}>
                      {sample.text.slice(0, 120)}...
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Info Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        {[
          {
            icon: FileText,
            title: 'Paste a Full PRD',
            desc: 'Copy your existing PRD document. The richer the input, the better the blueprint.',
            color: '#39FF14',
          },
          {
            icon: Zap,
            title: 'Describe Your Idea',
            desc: 'A few sentences about what you want to build. The pipeline will ask clarifying questions.',
            color: '#FFB800',
          },
          {
            icon: Sparkles,
            title: 'Just a Seed',
            desc: 'Even a single sentence is enough. The system will guide you through the rest.',
            color: '#00F5FF',
          },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1, duration: 0.4, ease: easeSpring }}
            className="p-4 rounded-xl"
            style={{
              background: 'rgba(10,22,40,0.3)',
              border: '1px solid rgba(138,180,230,0.06)',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${item.color}15` }}
              >
                <item.icon size={16} style={{ color: item.color }} />
              </div>
              <h4 className="font-heading-sm text-text-primary" style={{ fontSize: '14px' }}>
                {item.title}
              </h4>
            </div>
            <p className="font-body-sm text-text-tertiary" style={{ fontSize: '12px', lineHeight: '1.6' }}>
              {item.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
