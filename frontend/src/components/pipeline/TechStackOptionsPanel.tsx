// =============================================================================
// TechStackOptionsPanel — 3-5 tech stack option cards with component details,
// actor compatibility, scale fit, and component editor. Per UI Architecture §6.7.
// =============================================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TechStackOption } from '@/types/domain';
import type { ScaleFit, LearningCurve, Confidence } from '@/types/domain';
import { useSteeringStore } from '@/stores/steeringStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Layers, Users, BookOpen, GitCommit, ChevronDown, ChevronUp, Pencil, Bookmark
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const componentLabels: Array<{ key: keyof TechStackOption; label: string }> = [
  { key: 'frontend', label: 'Frontend' },
  { key: 'backend', label: 'Backend' },
  { key: 'database', label: 'Database' },
  { key: 'cache', label: 'Cache' },
  { key: 'message_queue', label: 'Message Queue' },
  { key: 'auth', label: 'Auth' },
  { key: 'hosting', label: 'Hosting' },
  { key: 'ci_cd', label: 'CI/CD' },
  { key: 'monitoring', label: 'Monitoring' },
];

const componentOptions: Record<string, string[]> = {
  frontend: ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'Remix'],
  backend: ['Node.js/Express', 'Python/FastAPI', 'Go', 'Java/Spring', 'Ruby on Rails', 'PHP/Laravel', 'Rust/Actix'],
  database: ['PostgreSQL', 'MongoDB', 'MySQL', 'SQLite', 'DynamoDB', 'Firestore', 'Redis'],
  cache: ['Redis', 'Memcached', 'Valkey', 'None'],
  message_queue: ['RabbitMQ', 'Apache Kafka', 'AWS SQS', 'Google Pub/Sub', 'Redis Streams', 'None'],
  auth: ['Auth0', 'Firebase Auth', 'AWS Cognito', 'Keycloak', 'Clerk', 'Custom JWT', 'None'],
  hosting: ['AWS', 'GCP', 'Azure', 'Vercel', 'Netlify', 'Heroku', 'DigitalOcean', 'Self-hosted'],
  ci_cd: ['GitHub Actions', 'GitLab CI', 'CircleCI', 'Jenkins', 'Travis CI', 'Drone CI'],
  monitoring: ['Datadog', 'New Relic', 'Grafana + Prometheus', 'Honeycomb', 'Sentry', 'CloudWatch', 'None'],
};

function ScaleFitBadge({ fit }: { fit: ScaleFit }) {
  const colors = {
    under: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    fit: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
    over: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  };
  const labels = { under: 'UNDER', fit: 'FIT', over: 'OVER' };
  return (
    <Badge className={`${colors[fit]} uppercase`}>{labels[fit]}</Badge>
  );
}

function LearningCurveBadge({ curve }: { curve: LearningCurve }) {
  const colors = {
    low: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
    high: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  };
  return <Badge className={`${colors[curve]}`}>{curve}</Badge>;
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const colors = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
    low: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  };
  return <Badge variant="outline" className={`${colors[confidence]}`}>{confidence}</Badge>;
}

function TechStackOptionCard({
  option,
  index,
  isSelected,
  isBookmarked,
  onSelect,
  onBookmark,
}: {
  option: TechStackOption;
  index: number;
  isSelected: boolean;
  isBookmarked: boolean;
  onSelect: () => void;
  onBookmark: () => void;
}) {
  const [showEditor, setShowEditor] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [customConfig, setCustomConfig] = useState<Partial<TechStackOption>>({});

  const handleConfigChange = useCallback((key: keyof TechStackOption, value: string) => {
    setCustomConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.08,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      }}
    >
      <Card
        className={`transition-all ${
          isSelected
            ? 'border-blue-400 shadow-md dark:border-blue-500'
            : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Layers className="h-5 w-5 text-violet-500" />
              {option.label}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onBookmark}
              >
                <Bookmark
                  className={`h-4 w-4 ${isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`}
                />
              </Button>
              <ConfidenceBadge confidence={option.confidence} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {componentLabels.map(({ key, label }) => {
              const val = option[key];
              if (val === null || val === undefined) return null;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-500 dark:text-slate-400">{label}:</span>
                  <span className="text-slate-700 dark:text-slate-300">{String(val)}</span>
                </div>
              );
            })}
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {option.actor_compatibility.join(', ') || '—'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400">Scale fit:</span>
              <ScaleFitBadge fit={option.scale_fit} />
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400">Learning:</span>
              <LearningCurveBadge curve={option.learning_curve} />
            </div>
            <div className="flex items-center gap-1">
              <GitCommit className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400">Community:</span>
              <ConfidenceBadge confidence={option.community_maturity} />
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Rationale:</span> {option.rationale}
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            >
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showDetails ? 'Hide component breakdown' : 'Show component breakdown'}
            </button>
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-50 p-2 dark:bg-slate-800/50">
                    {componentLabels.map(({ key, label }) => {
                      const val = option[key];
                      if (val === null || val === undefined) return null;
                      return (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">{label}</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{String(val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant={isSelected ? 'secondary' : 'default'}
              onClick={onSelect}
              className="flex-1"
            >
              {isSelected ? 'Selected' : 'Select'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEditor(!showEditor)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Modify
            </Button>
          </div>

          <AnimatePresence>
            {showEditor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Component Editor
                  </div>
                  {componentLabels.map(({ key, label }) => {
                    const options = componentOptions[key] ?? [];
                    const currentVal = customConfig[key] ?? option[key] ?? 'None';
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                          {label}
                        </span>
                        <Select
                          value={String(currentVal)}
                          onValueChange={(v) => handleConfigChange(key, v)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((opt) => (
                              <SelectItem key={opt} value={opt} className="text-xs">
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                  <Button
                    size="sm"
                    variant="default"
                    className="mt-2 w-full"
                    onClick={() => setShowEditor(false)}
                  >
                    Save Custom Configuration
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function TechStackOptionsPanel() {
  const techStackMatrix = useSteeringStore((s) => s.techStackMatrix);
  const selectedOptionId = useSteeringStore((s) => s.selectedOptionId);
  const bookmarkedOptionIds = useSteeringStore((s) => s.bookmarkedOptionIds);
  const selectOption = useSteeringStore((s) => s.selectOption);
  const toggleBookmark = useSteeringStore((s) => s.toggleBookmark);

  if (!techStackMatrix || techStackMatrix.length === 0) {
    return (
      <Card className="border-dashed border-slate-300 dark:border-slate-600">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            <Layers className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            Waiting for tech stack options...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
        Tech Stack Options
      </h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {techStackMatrix.map((option, index) => (
          <TechStackOptionCard
            key={option.option_id}
            option={option}
            index={index}
            isSelected={selectedOptionId === option.option_id}
            isBookmarked={bookmarkedOptionIds.includes(option.option_id)}
            onSelect={() => selectOption(option.option_id)}
            onBookmark={() => toggleBookmark(option.option_id)}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default TechStackOptionsPanel;
