// =============================================================================
// HostingOptionsPanel — 3-6 hosting option cards with cost ranges, compliance
// badges, and selection. Per UI Architecture §6.6.
// =============================================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HostingOption } from '@/types/domain';
import { useSteeringStore } from '@/stores/steeringStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Cloud, DollarSign, Clock, Wrench, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

function HostingOptionCard({
  option,
  index,
  isSelected,
  onSelect,
  budget,
}: {
  option: HostingOption;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  budget: number | null;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const isOverBudget = budget !== null && option.estimated_monthly_cost_usd.mid_usd > budget;

  const opsComplexityColor = {
    low: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
    high: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  };

  const confidenceColor = {
    high: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
    low: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  };

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
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Cloud className="h-5 w-5 text-sky-500" />
                {option.label}
              </CardTitle>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="capitalize">{option.hosting_model.replace('_', ' ')}</span>
                <span>|</span>
                <span>{option.provider}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={confidenceColor[option.confidence]}>
                {option.confidence}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {option.services_required.map((svc) => (
              <Badge key={svc} variant="secondary" className="text-xs">
                {svc}
              </Badge>
            ))}
          </div>

          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <DollarSign className="h-4 w-4 text-green-500" />
              ${option.estimated_monthly_cost_usd.min_usd.toLocaleString()} – $
              {option.estimated_monthly_cost_usd.max_usd.toLocaleString()}/mo
              <span className="text-xs font-normal text-slate-500">
                (mid: ${option.estimated_monthly_cost_usd.mid_usd.toLocaleString()})
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Basis:</span> {option.estimated_monthly_cost_usd.basis}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Assumes:</span> {option.estimated_monthly_cost_usd.assumptions}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Excludes:</span> {option.estimated_monthly_cost_usd.excludes}
            </div>
          </div>

          {isOverBudget && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 rounded-md bg-red-50 p-2 text-xs font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400"
            >
              <AlertTriangle className="h-4 w-4" />
              OVER BUDGET (your budget: ${budget?.toLocaleString()}/mo)
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              <span className="font-medium">Scale ceiling:</span> {option.scale_ceiling}
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              <span className="font-medium">Time to prod:</span> {option.time_to_production}
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Wrench className="h-3.5 w-3.5 text-orange-500" />
              <span className="font-medium">Ops:</span>
              <Badge className={`text-[10px] ${opsComplexityColor[option.ops_complexity]}`}>
                {option.ops_complexity}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {option.compliance_suitability.map((c) => (
              <Badge key={c} variant="outline" className="text-[10px]">
                {c}
              </Badge>
            ))}
          </div>

          <Separator />

          <div className="space-y-1">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            >
              {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 overflow-hidden"
                >
                  <div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Strengths:</span>
                    <ul className="mt-0.5 list-inside list-disc text-xs text-slate-500 dark:text-slate-400">
                      {option.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Limitations:</span>
                    <ul className="mt-0.5 list-inside list-disc text-xs text-slate-500 dark:text-slate-400">
                      {option.limitations.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium">Rationale:</span> {option.rationale}
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
            <Button size="sm" variant="outline">
              Modify Services
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function HostingOptionsPanel() {
  const hostingMatrix = useSteeringStore((s) => s.hostingMatrix);
  const scaleInputs = useSteeringStore((s) => s.scaleInputs);
  const selectedOptionId = useSteeringStore((s) => s.selectedOptionId);
  const selectOption = useSteeringStore((s) => s.selectOption);

  const budget = scaleInputs?.data_volume_gb ?? null;

  if (!hostingMatrix || hostingMatrix.length === 0) {
    return (
      <Card className="border-dashed border-slate-300 dark:border-slate-600">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            <Cloud className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            Waiting for hosting options...
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Hosting Options
        </h3>
        {budget !== null && (
          <Badge variant="outline" className="text-xs">
            Budget: ${budget.toLocaleString()}/mo
          </Badge>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hostingMatrix.map((option, index) => (
          <HostingOptionCard
            key={option.option_id}
            option={option}
            index={index}
            isSelected={selectedOptionId === option.option_id}
            onSelect={() => selectOption(option.option_id)}
            budget={budget}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default HostingOptionsPanel;
