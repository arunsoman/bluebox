// =============================================================================
// PrdAnalysisScreen — Per UI architecture section 6.3 (Mode A: WELL_FORMED Input)
// Explicit sections list with count
// Thin sections with "Strengthen" buttons
// Missing sections with action buttons (Trigger Scaling Advisor, etc.)
// Conflicting statements with "Resolve" buttons
// Unmapped sections with Map to Stage / Create Annotation / Out of Scope buttons
// Compliance detected section with Review/Dismiss buttons
// "Accept Report & Proceed to Stage 1" button -> sends ACCEPT action
// ALL data from steeringStore.prdAnalysis — NO mock data
// =============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, AlertTriangle, XCircle, HelpCircle, BookmarkX, Shield,
  CheckCircle, ArrowRight, ChevronDown, ChevronUp, Sparkles, Server
} from 'lucide-react';
import { useSteeringStore } from '@/stores/steeringStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ConflictFlag, UnmappedSection } from '@/types/domain';

const sectionIcons = {
  explicit: <FileText className="h-4 w-4 text-emerald-400" />,
  thin: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  missing: <XCircle className="h-4 w-4 text-red-400" />,
  conflict: <HelpCircle className="h-4 w-4 text-orange-400" />,
  unmapped: <BookmarkX className="h-4 w-4 text-slate-400" />,
  compliance: <Shield className="h-4 w-4 text-blue-400" />,
};

export default function PrdAnalysisScreen() {
  const prdAnalysis = useSteeringStore((s) => s.prdAnalysis);
  const complianceDetected = useSteeringStore((s) => s.complianceDetected);
  const sessionId = usePipelineStore((s) => s.sessionId);
  const currentStage = usePipelineStore((s) => s.currentStage);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    explicit: true,
    thin: true,
    missing: true,
    conflict: true,
    unmapped: true,
    compliance: true,
  });

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const sendAction = async (actionType: string, payload: Record<string, unknown> = {}) => {
    if (!sessionId) return;
    await pipelineApi.steer(sessionId, {
      session_id: sessionId,
      action_type: actionType,
      stage: currentStage ?? 'prd_analysis',
      payload,
      timestamp: new Date().toISOString(),
    });
  };

  if (!prdAnalysis) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Waiting for PRD analysis...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      >
        <h2 className="text-xl font-bold text-white">PRD Analysis Report</h2>
        <p className="mt-1 text-sm text-slate-400">
          Review the analysis of your input document. Address any issues before proceeding.
        </p>
      </motion.div>

      {/* Explicit Sections */}
      <AnalysisSection
        title={`Explicit Sections (${prdAnalysis.explicit_sections.length})`}
        icon={sectionIcons.explicit}
        expanded={expandedSections.explicit}
        onToggle={() => toggleSection('explicit')}
      >
        {prdAnalysis.explicit_sections.length === 0 ? (
          <p className="text-xs text-slate-500">No explicit sections found.</p>
        ) : (
          <ul className="space-y-2">
            {prdAnalysis.explicit_sections.map((section, i) => (
              <li key={i} className="rounded-md border border-emerald-800/40 bg-emerald-900/20 px-3 py-2">
                <span className="text-sm font-medium text-emerald-300">{section.title}</span>
                <p className="text-xs text-slate-400">{section.content_summary}</p>
              </li>
            ))}
          </ul>
        )}
      </AnalysisSection>

      {/* Thin Sections */}
      <AnalysisSection
        title={`Thin Sections (${prdAnalysis.thin_sections.length}) — Needs Strengthening`}
        icon={sectionIcons.thin}
        expanded={expandedSections.thin}
        onToggle={() => toggleSection('thin')}
      >
        {prdAnalysis.thin_sections.length === 0 ? (
          <p className="text-xs text-slate-500">No thin sections found.</p>
        ) : (
          <ul className="space-y-2">
            {prdAnalysis.thin_sections.map((section, i) => (
              <li key={i} className="rounded-md border border-amber-800/40 bg-amber-900/20 px-3 py-2">
                <span className="text-sm font-medium text-amber-300">{section.title}</span>
                <p className="text-xs text-slate-400">{section.content_summary}</p>
                <p className="mt-1 text-xs text-amber-400/80">
                  <span className="font-medium">Suggestion:</span> {section.suggestion}
                </p>
                <button
                  onClick={() => sendAction('ASK_ME', { section_title: section.title, context: 'strengthen' })}
                  className="mt-2 flex items-center gap-1 rounded-md border border-amber-700 bg-amber-900/40 px-2 py-1 text-xs text-amber-300 hover:bg-amber-900/60"
                >
                  <Sparkles className="h-3 w-3" />
                  Strengthen
                </button>
              </li>
            ))}
          </ul>
        )}
      </AnalysisSection>

      {/* Missing Sections */}
      <AnalysisSection
        title={`Missing Sections (${prdAnalysis.missing_sections.length})`}
        icon={sectionIcons.missing}
        expanded={expandedSections.missing}
        onToggle={() => toggleSection('missing')}
      >
        {prdAnalysis.missing_sections.length === 0 ? (
          <p className="text-xs text-slate-500">No missing sections found.</p>
        ) : (
          <ul className="space-y-2">
            {prdAnalysis.missing_sections.map((section, i) => (
              <li key={i} className="rounded-md border border-red-800/40 bg-red-900/20 px-3 py-2">
                <span className="text-sm font-medium text-red-300">{section.name}</span>
                <p className="text-xs text-slate-400">{section.suggested_action}</p>
                <div className="mt-2 flex gap-2">
                  {section.name.toLowerCase().includes('scale') && (
                    <button
                      onClick={() => sendAction('ASK_ME', { context: 'scale_advisor' })}
                      className="flex items-center gap-1 rounded-md border border-red-700 bg-red-900/40 px-2 py-1 text-xs text-red-300 hover:bg-red-900/60"
                    >
                      <Server className="h-3 w-3" />
                      Trigger Scaling Advisor
                    </button>
                  )}
                  {section.name.toLowerCase().includes('tech') && (
                    <button
                      onClick={() => sendAction('ASK_ME', { context: 'tech_stack_advisor' })}
                      className="flex items-center gap-1 rounded-md border border-red-700 bg-red-900/40 px-2 py-1 text-xs text-red-300 hover:bg-red-900/60"
                    >
                      <Sparkles className="h-3 w-3" />
                      Trigger Tech Stack Advisor
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AnalysisSection>

      {/* Conflicting Statements */}
      <AnalysisSection
        title={`Conflicting Statements (${prdAnalysis.conflicts.length})`}
        icon={sectionIcons.conflict}
        expanded={expandedSections.conflict}
        onToggle={() => toggleSection('conflict')}
      >
        {prdAnalysis.conflicts.length === 0 ? (
          <p className="text-xs text-slate-500">No conflicts found.</p>
        ) : (
          <ul className="space-y-2">
            {prdAnalysis.conflicts.map((conflict: ConflictFlag) => (
              <li
                key={conflict.conflict_id}
                className={cn(
                  'rounded-md border px-3 py-2',
                  conflict.severity === 'error'
                    ? 'border-red-800/40 bg-red-900/20'
                    : 'border-orange-800/40 bg-orange-900/20'
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                      conflict.severity === 'error'
                        ? 'bg-red-900/60 text-red-300'
                        : 'bg-orange-900/60 text-orange-300'
                    )}
                  >
                    {conflict.severity}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-slate-900/60 px-2 py-1.5">
                    <span className="text-slate-500">A:</span>{' '}
                    <span className="text-slate-300">{conflict.statement_a}</span>
                  </div>
                  <div className="rounded bg-slate-900/60 px-2 py-1.5">
                    <span className="text-slate-500">B:</span>{' '}
                    <span className="text-slate-300">{conflict.statement_b}</span>
                  </div>
                </div>
                <button
                  onClick={() =>
                    sendAction('ASK_ME', {
                      conflict_id: conflict.conflict_id,
                      context: 'resolve_conflict',
                    })
                  }
                  className="mt-2 flex items-center gap-1 rounded-md border border-orange-700 bg-orange-900/40 px-2 py-1 text-xs text-orange-300 hover:bg-orange-900/60"
                >
                  <HelpCircle className="h-3 w-3" />
                  Resolve Conflict
                </button>
              </li>
            ))}
          </ul>
        )}
      </AnalysisSection>

      {/* Unmapped Sections */}
      <AnalysisSection
        title={`Unmapped Sections (${prdAnalysis.unmapped_input.length})`}
        icon={sectionIcons.unmapped}
        expanded={expandedSections.unmapped}
        onToggle={() => toggleSection('unmapped')}
      >
        {prdAnalysis.unmapped_input.length === 0 ? (
          <p className="text-xs text-slate-500">No unmapped sections found.</p>
        ) : (
          <ul className="space-y-2">
            {prdAnalysis.unmapped_input.map((section: UnmappedSection) => (
              <li
                key={section.section_id}
                className="rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2"
              >
                <span className="text-sm font-medium text-slate-300">{section.title}</span>
                <p className="text-xs text-slate-500 line-clamp-2">{section.content_preview}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() =>
                      sendAction('MAP_TO_STAGE', {
                        section_id: section.section_id,
                      })
                    }
                    className="rounded-md border border-blue-700 bg-blue-900/40 px-2 py-1 text-xs text-blue-300 hover:bg-blue-900/60"
                  >
                    Map to Stage
                  </button>
                  <button
                    onClick={() =>
                      sendAction('CREATE_ANNOTATION', {
                        section_id: section.section_id,
                      })
                    }
                    className="rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                  >
                    Create Annotation
                  </button>
                  <button
                    onClick={() =>
                      sendAction('OUT_OF_SCOPE', {
                        section_id: section.section_id,
                      })
                    }
                    className="rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                  >
                    Out of Scope
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AnalysisSection>

      {/* Compliance Detected */}
      {(prdAnalysis.detected_compliance_frameworks.length > 0 || complianceDetected) && (
        <AnalysisSection
          title={`Compliance Detected (${prdAnalysis.detected_compliance_frameworks.length})`}
          icon={sectionIcons.compliance}
          expanded={expandedSections.compliance}
          onToggle={() => toggleSection('compliance')}
        >
          <ul className="space-y-2">
            {prdAnalysis.detected_compliance_frameworks.map((framework, i) => (
              <li key={i} className="rounded-md border border-blue-800/40 bg-blue-900/20 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-300">{framework}</span>
                </div>
                {complianceDetected?.defaults && (
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-900/60 p-2 text-[10px] text-slate-400">
                    {JSON.stringify(complianceDetected.defaults, null, 2)}
                  </pre>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => sendAction('ACCEPT', { compliance_framework: framework })}
                    className="flex items-center gap-1 rounded-md border border-blue-700 bg-blue-900/40 px-2 py-1 text-xs text-blue-300 hover:bg-blue-900/60"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Review &amp; Confirm
                  </button>
                  <button
                    onClick={() => sendAction('DISMISS_COMPLIANCE', { framework })}
                    className="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                  >
                    <XCircle className="h-3 w-3" />
                    Dismiss as False Positive
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </AnalysisSection>
      )}

      {/* Assumptions */}
      {prdAnalysis.assumptions.length > 0 && (
        <AnalysisSection
          title={`Assumptions (${prdAnalysis.assumptions.length})`}
          icon={<HelpCircle className="h-4 w-4 text-purple-400" />}
          expanded={expandedSections.assumptions ?? true}
          onToggle={() => toggleSection('assumptions')}
        >
          <ul className="space-y-2">
            {prdAnalysis.assumptions.map((assumption) => (
              <li
                key={assumption.assumption_id}
                className="rounded-md border border-purple-800/40 bg-purple-900/20 px-3 py-2"
              >
                <span className="text-sm text-purple-300">
                  {assumption.field}: <span className="font-medium">{assumption.assumed_value}</span>
                </span>
                <span className="ml-2 rounded bg-purple-900/60 px-1.5 py-0.5 text-[10px] text-purple-300">
                  {assumption.confidence}
                </span>
              </li>
            ))}
          </ul>
        </AnalysisSection>
      )}

      {/* Proceed button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex justify-end pt-4"
      >
        <button
          onClick={() => sendAction('ACCEPT')}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-500"
        >
          Accept Report &amp; Proceed to Stage 1
          <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </div>
  );
}

// ── Sub-component: collapsible analysis section ─────────────────────────────

function AnalysisSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-slate-700 bg-slate-800/30"
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
      >
        {icon}
        <span className="flex-1 text-sm font-semibold text-slate-200">{title}</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-700 px-4 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
