// =============================================================================
// ScaleDialoguePanel — Scale input form with persona selector and conflict
// warnings. Per UI Architecture §6.6.
// =============================================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScalePersona, ScaleInputs } from '@/types/domain';
import { useSteeringStore } from '@/stores/steeringStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { pipelineApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { HelpCircle, Users, TrendingUp, Activity, Database, Shield, DollarSign, AlertTriangle, Send } from 'lucide-react';

const scalePersonas: Array<{
  key: ScalePersona;
  label: string;
  users: string;
  concurrency: string;
  dataVolume: string;
  uptime: string;
}> = [
  { key: 'SMALL', label: 'SMALL', users: '<1K users', concurrency: '<50 concurrent', dataVolume: '<10 GB', uptime: '99% uptime' },
  { key: 'MEDIUM', label: 'MEDIUM', users: '1K-100K', concurrency: '50-5K concurrent', dataVolume: '10GB-1TB', uptime: '99.9% uptime' },
  { key: 'LARGE', label: 'LARGE', users: '>100K', concurrency: '>5K concurrent', dataVolume: '>1 TB', uptime: '99.95% uptime' },
];

const fieldConfig: Array<{ key: keyof ScaleInputs; label: string; type: string; placeholder: string; icon: typeof Users }> = [
  { key: 'launch_users', label: 'How many users do you expect at launch?', type: 'number', placeholder: 'e.g. 1000', icon: Users },
  { key: 'year1_growth', label: 'What is your target user growth in Year 1 (multiplier)?', type: 'number', placeholder: 'e.g. 2', icon: TrendingUp },
  { key: 'peak_concurrent', label: 'Peak concurrent sessions expected?', type: 'number', placeholder: 'e.g. 500', icon: Activity },
  { key: 'uptime_sla', label: 'Target uptime SLA?', type: 'text', placeholder: 'e.g. 99.9%', icon: Shield },
  { key: 'data_volume_gb', label: 'Expected data volume (GB)?', type: 'number', placeholder: 'e.g. 100', icon: Database },
  { key: 'persona', label: 'Scale persona override?', type: 'text', placeholder: 'SMALL, MEDIUM, or LARGE', icon: DollarSign },
];

export function ScaleDialoguePanel() {
  const sessionId = usePipelineStore((s) => s.sessionId);
  const scaleConflict = useSteeringStore((s) => s.scaleConflict);
  const scaleInputs = useSteeringStore((s) => s.scaleInputs);
  const setScaleInputs = useSteeringStore((s) => s.setScaleInputs);

  const [activePersonaField, setActivePersonaField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFieldChange = useCallback(
    (field: keyof ScaleInputs, value: string) => {
      const numericFields: (keyof ScaleInputs)[] = ['launch_users', 'year1_growth', 'peak_concurrent', 'data_volume_gb'];
      const parsed = numericFields.includes(field) ? (value === '' ? null : Number(value)) : value;
      setScaleInputs({
        ...(scaleInputs ?? {}),
        [field]: parsed,
      });
    },
    [scaleInputs, setScaleInputs]
  );

  const handlePersonaSelect = useCallback(
    (persona: ScalePersona) => {
      if (!activePersonaField) return;
      const defaults: Record<ScalePersona, Partial<ScaleInputs>> = {
        SMALL: { launch_users: 500, peak_concurrent: 25, data_volume_gb: 5 },
        MEDIUM: { launch_users: 10000, peak_concurrent: 500, data_volume_gb: 100 },
        LARGE: { launch_users: 500000, peak_concurrent: 10000, data_volume_gb: 2000 },
        CUSTOM: {},
      };
      setScaleInputs({
        ...(scaleInputs ?? {}),
        ...defaults[persona],
        persona,
      });
      setActivePersonaField(null);
    },
    [activePersonaField, scaleInputs, setScaleInputs]
  );

  const handleSubmit = useCallback(async () => {
    if (!sessionId) return;
    setIsSubmitting(true);
    try {
      await pipelineApi.submitScaleInputs(sessionId, (scaleInputs ?? {}) as Record<string, unknown>);
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, scaleInputs]);

  const getFieldValue = (key: keyof ScaleInputs): string => {
    const val = scaleInputs?.[key];
    if (val === null || val === undefined) return '';
    return String(val);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5 text-blue-500" />
            Scale Dialogue
          </CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define your scale expectations so we can recommend the right infrastructure.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {fieldConfig.map(({ key, label, type, placeholder, icon: Icon }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-400" />
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type={type}
                  placeholder={placeholder}
                  value={getFieldValue(key)}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setActivePersonaField(activePersonaField === key ? null : key)
                  }
                  className="shrink-0 text-slate-500 hover:text-slate-700"
                >
                  <HelpCircle className="mr-1 h-4 w-4" />
                  I don&apos;t know
                </Button>
              </div>
              <AnimatePresence>
                {activePersonaField === key && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      {scalePersonas.map((persona) => (
                        <motion.button
                          key={persona.key}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handlePersonaSelect(persona.key)}
                          className="rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
                        >
                          <div className="mb-1 font-semibold text-slate-800 dark:text-slate-200">
                            {persona.label}
                          </div>
                          <div className="space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                            <div>{persona.users}</div>
                            <div>{persona.concurrency}</div>
                            <div>{persona.dataVolume}</div>
                            <div>{persona.uptime}</div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          <AnimatePresence>
            {scaleConflict && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold">Scale Input Conflict Detected</div>
                    <div className="mt-1">{scaleConflict.conflict_description}</div>
                    {scaleConflict.affected_fields.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {scaleConflict.affected_fields.map((f) => (
                          <Badge key={f} variant="outline" className="text-xs">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <Separator className="my-4" />

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !sessionId}
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit Scale Inputs
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default ScaleDialoguePanel;
