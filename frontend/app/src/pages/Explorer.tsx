import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Users,
  Zap,
  GitBranch,
  BookOpen,
  CheckSquare,
  X,
  Plus,
  Filter,
  ChevronRight,
  Clock,
  Tag,
  Layers,
  User,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  FileCode,
} from 'lucide-react';
import type { Entity, EntityType, Actor, Capability, UseCase, UserStory, Task } from '@/data/mockEntities';
import { allEntities } from '@/data/mockEntities';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';

/* ─── entity config ─── */
const ENTITY_CONFIG: Record<EntityType, { label: string; icon: typeof Users; color: string; bgTint: string; borderColor: string; glowClass: string }> = {
  actor:       { label: 'Actor',       icon: Users,      color: '#00F5FF', bgTint: 'rgba(0,245,255,0.08)',   borderColor: 'rgba(0,245,255,0.3)',   glowClass: 'shadow-[0_0_20px_rgba(0,245,255,0.15)]' },
  capability:  { label: 'Capability',  icon: Zap,        color: '#7B2FFF', bgTint: 'rgba(123,47,255,0.08)',  borderColor: 'rgba(123,47,255,0.3)',  glowClass: 'shadow-[0_0_20px_rgba(123,47,255,0.15)]' },
  'use-case':  { label: 'Use Case',    icon: GitBranch,  color: '#39FF14', bgTint: 'rgba(57,255,20,0.06)',   borderColor: 'rgba(57,255,20,0.3)',   glowClass: 'shadow-[0_0_20px_rgba(57,255,20,0.15)]' },
  story:       { label: 'Story',       icon: BookOpen,   color: '#FFB800', bgTint: 'rgba(255,184,0,0.08)',   borderColor: 'rgba(255,184,0,0.3)',   glowClass: 'shadow-[0_0_20px_rgba(255,184,0,0.15)]' },
  task:        { label: 'Task',        icon: CheckSquare, color: '#8BA4C7', bgTint: 'rgba(138,180,230,0.05)', borderColor: 'rgba(138,180,230,0.2)', glowClass: 'shadow-[0_0_12px_rgba(138,180,230,0.1)]' },
};

const TABS: { key: 'all' | EntityType; label: string; icon: typeof Users; count: number }[] = [
  { key: 'all',       label: 'All',       icon: Layers,      count: allEntities.length },
  { key: 'actor',     label: 'Actors',    icon: Users,       count: allEntities.filter((e) => e.type === 'actor').length },
  { key: 'capability', label: 'Capabilities', icon: Zap,     count: allEntities.filter((e) => e.type === 'capability').length },
  { key: 'use-case',  label: 'Use Cases', icon: GitBranch,   count: allEntities.filter((e) => e.type === 'use-case').length },
  { key: 'story',     label: 'Stories',   icon: BookOpen,    count: allEntities.filter((e) => e.type === 'story').length },
  { key: 'task',      label: 'Tasks',     icon: CheckSquare, count: allEntities.filter((e) => e.type === 'task').length },
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  generated:  { color: '#00F5FF', label: 'Generated' },
  validated:  { color: '#39FF14', label: 'Validated' },
  modified:   { color: '#FFB800', label: 'Modified' },
  rejected:   { color: '#FF3366', label: 'Rejected' },
};

/* ─── card components per type ─── */
function ActorCardContent({ entity }: { entity: Actor }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-mono px-2 py-0.5 rounded-full border"
          style={{ color: entity.actorType === 'human' ? '#FFB800' : entity.actorType === 'system' ? '#00F5FF' : '#39FF14', borderColor: entity.actorType === 'human' ? 'rgba(255,184,0,0.3)' : entity.actorType === 'system' ? 'rgba(0,245,255,0.3)' : 'rgba(57,255,20,0.3)', backgroundColor: entity.actorType === 'human' ? 'rgba(255,184,0,0.08)' : entity.actorType === 'system' ? 'rgba(0,245,255,0.08)' : 'rgba(57,255,20,0.06)' }}
        >
          {entity.actorType}
        </span>
        <span className="text-xs font-mono text-[#4A6487]">{entity.role}</span>
      </div>
      <p className="font-body-sm text-[#8BA4C7] line-clamp-3 leading-relaxed">{entity.description}</p>
      <div className="flex items-center gap-1.5 pt-1">
        <User size={12} className="text-[#4A6487]" />
        <span className="font-body-sm text-[#4A6487]">{entity.responsibilities.length} responsibilities</span>
      </div>
    </div>
  );
}

function CapabilityCardContent({ entity }: { entity: Capability }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-[#4A6487]">{entity.linkedActors.length} actors</span>
        <span className="text-xs text-[#4A6487]">|</span>
        <span className="text-xs font-mono text-[#4A6487]">{entity.features.length} features</span>
      </div>
      <p className="font-body-sm text-[#8BA4C7] line-clamp-3 leading-relaxed">{entity.description}</p>
      <div className="flex flex-wrap gap-1 pt-1">
        {entity.features.slice(0, 3).map((f) => (
          <span key={f} className="text-xs px-2 py-0.5 rounded-full border border-[rgba(138,180,230,0.12)] text-[#8BA4C7] bg-[rgba(10,22,40,0.3)]">
            {f}
          </span>
        ))}
        {entity.features.length > 3 && (
          <span className="text-xs px-2 py-0.5 text-[#4A6487]">+{entity.features.length - 3}</span>
        )}
      </div>
    </div>
  );
}

function UseCaseCardContent({ entity }: { entity: UseCase }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-[#4A6487]">{entity.linkedCapabilities.length} capabilities</span>
      </div>
      <p className="font-body-sm text-[#8BA4C7] line-clamp-3 leading-relaxed">{entity.description}</p>
      <div className="flex items-center gap-1.5 pt-1">
        <CheckCircle2 size={12} className="text-[#39FF14]" />
        <span className="font-body-sm text-[#4A6487]">{entity.postconditions.length} postconditions</span>
      </div>
    </div>
  );
}

function StoryCardContent({ entity }: { entity: UserStory }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-[#4A6487]">{entity.acceptanceCriteria.length} criteria</span>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,184,0,0.12)', color: '#FFB800' }}>
          {entity.storyPoints} SP
        </span>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: entity.priority === 'critical' ? 'rgba(255,51,102,0.12)' : entity.priority === 'high' ? 'rgba(255,184,0,0.12)' : 'rgba(0,245,255,0.08)', color: entity.priority === 'critical' ? '#FF3366' : entity.priority === 'high' ? '#FFB800' : '#00F5FF' }}>
          {entity.priority}
        </span>
      </div>
      <p className="font-body-sm text-[#8BA4C7] line-clamp-3 leading-relaxed">{entity.description}</p>
    </div>
  );
}

function TaskCardContent({ entity }: { entity: Task }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-xs font-mono text-[#4A6487]">
          <Clock size={12} />
          {entity.estimatedHours}h
        </span>
        <span className="text-xs font-mono text-[#4A6487]">{entity.dependencies.length} deps</span>
        <span className="text-xs font-mono text-[#4A6487]">{entity.assignee}</span>
      </div>
      <p className="font-body-sm text-[#8BA4C7] line-clamp-3 leading-relaxed">{entity.description}</p>
    </div>
  );
}

/* ─── entity card ─── */
function EntityCard({ entity, onClick, isSelected }: { entity: Entity; onClick: () => void; isSelected: boolean }) {
  const config = ENTITY_CONFIG[entity.type];
  const StatusIcon = config.icon;
  const statusCfg = STATUS_CONFIG[entity.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      transition={{ duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <GlassCard
        variant={isSelected ? 'tinted' : 'frosted'}
        padding="md"
        radius="lg"
        glow="none"
        hover={false}
        animated={false}
        className="h-full transition-all duration-200 hover:border-opacity-50"
        style={{ borderColor: isSelected ? config.borderColor : undefined }}
      >
        <div className="flex flex-col h-full gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <StatusIcon size={18} style={{ color: config.color }} className="flex-shrink-0 mt-0.5" />
              <h3 className="font-heading-sm text-[#E8F0FE] truncate leading-tight">{entity.name}</h3>
            </div>
          </div>

          {/* Type badge + status */}
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border"
              style={{ color: config.color, borderColor: config.borderColor, backgroundColor: config.bgTint }}
            >
              {config.label.toUpperCase()}
            </span>
            <span className="relative flex">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: statusCfg.color }} />
            </span>
            <span className="font-body-sm" style={{ color: statusCfg.color }}>{statusCfg.label}</span>
          </div>

          {/* Divider */}
          <div className="h-px bg-[rgba(138,180,230,0.08)]" />

          {/* Type-specific content */}
          <div className="flex-1">
            {entity.type === 'actor' && <ActorCardContent entity={entity as Actor} />}
            {entity.type === 'capability' && <CapabilityCardContent entity={entity as Capability} />}
            {entity.type === 'use-case' && <UseCaseCardContent entity={entity as UseCase} />}
            {entity.type === 'story' && <StoryCardContent entity={entity as UserStory} />}
            {entity.type === 'task' && <TaskCardContent entity={entity as Task} />}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 pt-1">
            {entity.tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-[rgba(138,180,230,0.1)] text-[#4A6487] bg-[rgba(10,22,40,0.3)]">
                <Tag size={9} />
                {tag}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-1 pt-1" style={{ color: config.color }}>
            <span className="font-body-sm">View Details</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/* ─── detail drawer ─── */
function DetailDrawer({ entity, onClose }: { entity: Entity; onClose: () => void }) {
  const config = ENTITY_CONFIG[entity.type];
  const StatusIcon = config.icon;
  const statusCfg = STATUS_CONFIG[entity.status];
  const [isEditing, setIsEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(entity.description);

  const handleSave = useCallback(() => {
    entity.description = editDesc;
    entity.status = 'modified' as never;
    setIsEditing(false);
  }, [editDesc, entity]);

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-[rgba(5,10,20,0.5)] backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.4, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-[480px] z-50 overflow-y-auto"
        style={{ background: 'rgba(20, 45, 75, 0.55)', backdropFilter: 'blur(40px) saturate(140%)', borderLeft: '1px solid rgba(138, 180, 230, 0.12)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 p-6 border-b border-[rgba(138,180,230,0.08)]" style={{ background: 'rgba(20, 45, 75, 0.7)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <StatusIcon size={32} style={{ color: config.color }} />
              <div>
                <h2 className="font-heading-lg text-[#E8F0FE] leading-tight">{entity.name}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border" style={{ color: config.color, borderColor: config.borderColor, backgroundColor: config.bgTint }}>
                    {config.label.toUpperCase()}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: statusCfg.color }} />
                  <span className="font-body-sm" style={{ color: statusCfg.color }}>{statusCfg.label}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg glass-clear hover:glass-tinted transition-all flex-shrink-0"
              aria-label="Close drawer"
            >
              <X size={18} className="text-[#8BA4C7]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-heading-sm text-[#8BA4C7]">Description</h3>
              {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="p-1.5 rounded-md hover:bg-[rgba(0,245,255,0.08)] transition-colors" aria-label="Edit description">
                  <Edit3 size={14} className="text-[#4A6487]" />
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-[rgba(10,22,40,0.5)] border border-[rgba(138,180,230,0.15)] rounded-lg p-3 text-[#E8F0FE] font-body-md focus:outline-none focus:border-[rgba(0,245,255,0.5)] focus:shadow-[0_0_12px_rgba(0,245,255,0.1)] transition-all resize-none"
                  rows={4}
                />
                <div className="flex gap-2">
                  <GlassButton variant="primary" size="sm" onClick={handleSave}>Save</GlassButton>
                  <GlassButton variant="ghost" size="sm" onClick={() => { setIsEditing(false); setEditDesc(entity.description); }}>Cancel</GlassButton>
                </div>
              </div>
            ) : (
              <p className="font-body-md text-[#E8F0FE] leading-relaxed">{entity.description}</p>
            )}
          </motion.div>

          {/* Properties */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h3 className="font-heading-sm text-[#8BA4C7] mb-3">Properties</h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                <span className="font-body-sm text-[#4A6487]">ID</span>
                <span className="font-mono text-sm text-[#E8F0FE]">{entity.id}</span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                <span className="font-body-sm text-[#4A6487]">Created</span>
                <span className="font-mono text-sm text-[#E8F0FE]">{new Date(entity.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                <span className="font-body-sm text-[#4A6487]">Updated</span>
                <span className="font-mono text-sm text-[#E8F0FE]">{new Date(entity.updatedAt).toLocaleDateString()}</span>
              </div>

              {/* Type-specific properties */}
              {entity.type === 'actor' && (
                <>
                  <div className="flex items-center justify-between py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                    <span className="font-body-sm text-[#4A6487]">Actor Type</span>
                    <span className="font-mono text-sm text-[#E8F0FE]">{(entity as Actor).actorType}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                    <span className="font-body-sm text-[#4A6487]">Role</span>
                    <span className="font-mono text-sm text-[#E8F0FE]">{(entity as Actor).role}</span>
                  </div>
                </>
              )}
              {entity.type === 'story' && (
                <>
                  <div className="flex items-center justify-between py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                    <span className="font-body-sm text-[#4A6487]">Story Points</span>
                    <span className="font-mono text-sm text-[#E8F0FE]">{(entity as UserStory).storyPoints}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                    <span className="font-body-sm text-[#4A6487]">Priority</span>
                    <span className="font-mono text-sm text-[#E8F0FE]">{(entity as UserStory).priority}</span>
                  </div>
                </>
              )}
              {entity.type === 'task' && (
                <>
                  <div className="flex items-center justify-between py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                    <span className="font-body-sm text-[#4A6487]">Estimated Hours</span>
                    <span className="font-mono text-sm text-[#E8F0FE]">{(entity as Task).estimatedHours}h</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                    <span className="font-body-sm text-[#4A6487]">Assignee</span>
                    <span className="font-mono text-sm text-[#E8F0FE]">{(entity as Task).assignee}</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* Type-specific detail sections */}
          {entity.type === 'actor' && (entity as Actor).responsibilities.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="font-heading-sm text-[#8BA4C7] mb-3">Responsibilities</h3>
              <div className="space-y-2">
                {(entity as Actor).responsibilities.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                    <CheckCircle2 size={14} className="text-[#39FF14] mt-0.5 flex-shrink-0" />
                    <span className="font-body-sm text-[#E8F0FE]">{r}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {entity.type === 'capability' && (entity as Capability).features.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="font-heading-sm text-[#8BA4C7] mb-3">Features</h3>
              <div className="space-y-2">
                {(entity as Capability).features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                    <Zap size={14} className="text-[#7B2FFF] mt-0.5 flex-shrink-0" />
                    <span className="font-body-sm text-[#E8F0FE]">{f}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {entity.type === 'story' && (entity as UserStory).acceptanceCriteria.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="font-heading-sm text-[#8BA4C7] mb-3">Acceptance Criteria</h3>
              <div className="space-y-2">
                {(entity as UserStory).acceptanceCriteria.map((ac, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                    <CheckSquare size={14} className="text-[#FFB800] mt-0.5 flex-shrink-0" />
                    <span className="font-body-sm text-[#E8F0FE]">{ac}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {entity.type === 'task' && (entity as Task).dependencies.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="font-heading-sm text-[#8BA4C7] mb-3">Dependencies</h3>
              <div className="space-y-2">
                {(entity as Task).dependencies.map((dep, i) => (
                  <div key={i} className="flex items-center gap-2 py-2 px-3 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.06)]">
                    <AlertCircle size={14} className="text-[#FF3366] flex-shrink-0" />
                    <span className="font-mono text-sm text-[#E8F0FE]">{dep}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tags */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <h3 className="font-heading-sm text-[#8BA4C7] mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {entity.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border border-[rgba(138,180,230,0.12)] text-[#8BA4C7] bg-[rgba(10,22,40,0.3)]">
                  <Tag size={12} />
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Actions Footer */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="sticky bottom-0 pt-4 pb-2 border-t border-[rgba(138,180,230,0.08)] flex flex-wrap gap-2"
            style={{ background: 'rgba(20, 45, 75, 0.8)' }}
          >
            <GlassButton variant="secondary" icon={<Edit3 size={14} />} onClick={() => setIsEditing(true)}>Edit Entity</GlassButton>
            <GlassButton variant="ghost" icon={<FileCode size={14} />}>View in Blueprint</GlassButton>
            <GlassButton variant="ghost" icon={<Trash2 size={14} />} className="text-[#FF3366] hover:text-[#FF3366]">Delete</GlassButton>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

/* ─── main explorer page ─── */
export default function Explorer() {
  const [activeTab, setActiveTab] = useState<'all' | EntityType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const filteredEntities = useMemo(() => {
    let result = allEntities;
    if (activeTab !== 'all') {
      result = result.filter((e) => e.type === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [activeTab, searchQuery]);

  const handleCardClick = useCallback((entity: Entity) => {
    setSelectedEntity(entity);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Background pattern */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,245,255,0.04) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Page Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3"
        >
          <h1 className="font-display-md text-[#E8F0FE]">Node Explorer</h1>
          <span className="text-xs font-mono px-3 py-1 rounded-full border border-[rgba(0,245,255,0.2)] text-[#4A6487] bg-[rgba(10,22,40,0.35)]">
            {filteredEntities.length} entities
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="flex items-center gap-3"
        >
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6487] pointer-events-none" />
            <input
              type="text"
              placeholder="Search actors, capabilities, use cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[280px] sm:w-[320px] focus:w-[320px] sm:focus:w-[400px] bg-[rgba(10,22,40,0.5)] backdrop-blur-lg border border-[rgba(138,180,230,0.1)] rounded-lg text-[#E8F0FE] font-body-md pl-10 pr-4 py-2.5 placeholder:text-[rgba(138,180,230,0.4)] focus:outline-none focus:border-[rgba(0,245,255,0.5)] focus:shadow-[0_0_20px_rgba(0,245,255,0.1)] transition-all duration-250"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A6487] hover:text-[#E8F0FE]">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden p-2.5 rounded-lg glass-clear hover:glass-tinted transition-all"
            aria-label="Toggle filters"
          >
            <Filter size={16} className="text-[#8BA4C7]" />
          </button>
        </motion.div>
      </div>

      {/* Category Filter Tabs */}
      <div className="relative z-10 px-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="flex flex-wrap gap-2"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-heading-sm text-sm transition-all duration-200 border ${
                  isActive
                    ? 'bg-[rgba(16,36,65,0.5)] border-[rgba(0,245,255,0.3)] text-[#00F5FF] shadow-[0_0_12px_rgba(0,245,255,0.08)]'
                    : 'bg-[rgba(10,22,40,0.3)] border-[rgba(138,180,230,0.08)] text-[#8BA4C7] hover:bg-[rgba(10,22,40,0.5)] hover:text-[#E8F0FE] hover:border-[rgba(138,180,230,0.15)]'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                <span className={`text-xs font-mono ml-1 px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[rgba(0,245,255,0.12)] text-[#00F5FF]' : 'bg-[rgba(138,180,230,0.08)] text-[#4A6487]'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </motion.div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Mobile filters overlay */}
        <AnimatePresence>
          {showMobileFilters && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[rgba(5,10,20,0.7)] backdrop-blur-sm z-30 lg:hidden"
              onClick={() => setShowMobileFilters(false)}
            />
          )}
        </AnimatePresence>

        {/* Filters Sidebar */}
        <AnimatePresence>
          {(showMobileFilters || true) && (
            <motion.aside
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
              className={`
                ${showMobileFilters ? 'fixed left-0 top-0 bottom-0 z-40 w-[260px]' : 'hidden lg:block'}
                w-[260px] flex-shrink-0 border-r border-[rgba(138,180,230,0.08)] overflow-y-auto
              `}
              style={{ background: 'rgba(10, 22, 40, 0.4)', backdropFilter: 'blur(20px) saturate(120%)' }}
            >
              <div className="p-4 space-y-6">
                {/* Close button for mobile */}
                {showMobileFilters && (
                  <div className="flex items-center justify-between lg:hidden">
                    <span className="font-heading-sm text-[#E8F0FE]">Filters</span>
                    <button onClick={() => setShowMobileFilters(false)} className="p-1.5 rounded-md hover:bg-[rgba(0,245,255,0.08)]">
                      <X size={16} className="text-[#8BA4C7]" />
                    </button>
                  </div>
                )}

                {/* Status Filter */}
                <div>
                  <h3 className="font-heading-sm text-[#8BA4C7] mb-3">Status</h3>
                  <div className="space-y-2">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <div key={key} className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-[rgba(0,245,255,0.04)] transition-colors cursor-pointer">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                        <span className="font-body-sm text-[#E8F0FE] flex-1">{cfg.label}</span>
                        <span className="text-xs font-mono text-[#4A6487]">
                          {allEntities.filter((e) => e.status === key).length}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h3 className="font-heading-sm text-[#8BA4C7] mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(allEntities.flatMap((e) => e.tags))).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2.5 py-1 rounded-full border border-[rgba(138,180,230,0.1)] text-[#8BA4C7] bg-[rgba(10,22,40,0.3)] hover:border-[rgba(0,245,255,0.3)] hover:text-[#00F5FF] transition-all cursor-pointer"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pipeline Run */}
                <div>
                  <h3 className="font-heading-sm text-[#8BA4C7] mb-3">Pipeline Run</h3>
                  <select className="w-full bg-[rgba(10,22,40,0.5)] border border-[rgba(138,180,230,0.1)] rounded-lg text-[#E8F0FE] font-body-sm px-3 py-2 focus:outline-none focus:border-[rgba(0,245,255,0.5)]">
                    <option>Current Run</option>
                    <option>Run #42</option>
                    <option>Run #41</option>
                    <option>Run #40</option>
                  </select>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Entity Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <AnimatePresence mode="popLayout">
            {filteredEntities.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center min-h-[40vh]"
              >
                <GlassCard variant="tinted" padding="lg" radius="xl" className="max-w-[400px] text-center">
                  <Search size={48} className="mx-auto mb-4 text-[#4A6487]" />
                  <h3 className="font-heading-md text-[#E8F0FE] mb-2">No matching entities</h3>
                  <p className="font-body-md text-[#8BA4C7] mb-6">
                    {searchQuery ? 'Try adjusting your search terms or filters.' : 'Start a pipeline to generate actors, capabilities, and more.'}
                  </p>
                  {searchQuery ? (
                    <GlassButton variant="secondary" onClick={() => { setSearchQuery(''); setActiveTab('all'); }}>Clear Filters</GlassButton>
                  ) : (
                    <GlassButton variant="primary">Start Pipeline</GlassButton>
                  )}
                </GlassCard>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
              >
                {filteredEntities.map((entity, index) => (
                  <motion.div
                    key={entity.id}
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.97 }}
                    transition={{
                      duration: 0.35,
                      delay: Math.min(index * 0.04, 0.4),
                      ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number],
                    }}
                  >
                    <EntityCard
                      entity={entity}
                      onClick={() => handleCardClick(entity)}
                      isSelected={selectedEntity?.id === entity.id}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* FAB */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-8 right-8 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_40px_rgba(0,245,255,0.1)] transition-all duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_50px_rgba(0,245,255,0.2)]"
        style={{ background: 'linear-gradient(135deg, #00F5FF 0%, #00D4E5 100%)' }}
        aria-label="Add entity"
      >
        <Plus size={24} className="text-[#050A14]" />
      </motion.button>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedEntity && (
          <DetailDrawer
            key={selectedEntity.id}
            entity={selectedEntity}
            onClose={() => setSelectedEntity(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
