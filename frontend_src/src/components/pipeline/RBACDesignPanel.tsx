// =============================================================================
// RBACDesignPanel — Inline panel for the pipeline page (NOT the full RBACPage).
// Steps 1-4: Role list, Permission Matrix, Data Access Matrix, Role Hierarchy.
// Per UI Architecture §6.8.
// =============================================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  Role,
  RolePermissionEntry,
  DataAccessEntry,
  RoleInheritance,
  AuditPolicy,
} from '@/types/domain';
import { useSteeringStore } from '@/stores/steeringStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Shield, Users, Key, Database, GitBranch, AlertTriangle, AlertCircle,
  CheckCircle, XCircle, ChevronRight, ChevronDown, ChevronUp, Plus, Trash2, Merge
} from 'lucide-react';
import { MatrixTable } from '@/components/shared/MatrixTable';

// ── Step 1: Role List ────────────────────────────────────────────────────────

function RoleList({
  roles,
  onRename,
  onRemove,
}: {
  roles: Role[];
  onRename: (roleId: string, newName: string) => void;
  onRemove: (roleId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (role: Role) => {
    setEditingId(role.role_id);
    setEditValue(role.name);
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Roles ({roles.length})
        </h4>
        <Button size="sm" variant="outline">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Custom Role
        </Button>
      </div>
      <div className="space-y-1">
        {roles.map((role) => (
          <motion.div
            key={role.role_id}
            layout
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex-1">
              {editingId === role.role_id ? (
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                  className="h-7 text-sm"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span
                    className="cursor-pointer text-sm font-medium hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
                    onClick={() => startEdit(role)}
                  >
                    {role.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({role.actor_ids.length} actor{role.actor_ids.length !== 1 ? 's' : ''})
                  </span>
                </div>
              )}
              <div className="ml-6 text-xs text-slate-500 dark:text-slate-400">
                {role.description}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => startEdit(role)}
              >
                Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={roles.length <= 1}
              >
                <Merge className="mr-1 h-3 w-3" />
                Merge
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-red-500 hover:text-red-700"
                onClick={() => onRemove(role.role_id)}
                disabled={roles.length <= 1}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Permission Matrix ────────────────────────────────────────────────

function PermissionMatrixView({
  roles,
  permissions,
  matrix,
}: {
  roles: Role[];
  permissions: Array<{ permission_id: string; resource: string; action: string }>;
  matrix: RolePermissionEntry[];
}) {
  const [showRationale, setShowRationale] = useState(false);

  const rows = roles.map((r) => ({ key: r.role_id, label: r.name }));
  const columns = permissions.map((p) => ({
    key: p.permission_id,
    label: `${p.resource}:${p.action}`,
  }));

  const getEntry = (roleId: string, permId: string): RolePermissionEntry | undefined =>
    matrix.find((m) => m.role_id === roleId && m.permission_id === permId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Key className="inline mr-1 h-4 w-4" />
          Permission Matrix
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowRationale(!showRationale)}
        >
          {showRationale ? 'Hide' : 'Show'} rationale
        </Button>
      </div>
      <MatrixTable
        rows={rows}
        columns={columns}
        cornerLabel="Role \\ Permission"
        compact
        renderCell={(row, col) => {
          const entry = getEntry(row.key, col.key);
          if (!entry) return <span className="text-slate-300">—</span>;
          return (
            <div className="flex flex-col items-center gap-0.5">
              <Checkbox checked={entry.granted} disabled className="h-4 w-4" />
              {showRationale && entry.rationale && (
                <span className="max-w-[120px] truncate text-[10px] text-slate-400" title={entry.rationale}>
                  {entry.rationale}
                </span>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}

// ── Step 3: Data Access Matrix ───────────────────────────────────────────────

function DataAccessMatrixView({
  roles,
  dataEntities,
  matrix,
}: {
  roles: Role[];
  dataEntities: string[];
  matrix: DataAccessEntry[];
}) {
  const [showRationale, setShowRationale] = useState(false);

  const rows = roles.map((r) => ({ key: r.role_id, label: r.name }));
  const columns = dataEntities.map((e) => ({ key: e, label: e }));

  const getEntry = (roleId: string, entity: string): DataAccessEntry | undefined =>
    matrix.find((m) => m.role_id === roleId && m.data_entity === entity);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Database className="inline mr-1 h-4 w-4" />
          Data Access Matrix
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowRationale(!showRationale)}
        >
          {showRationale ? 'Hide' : 'Show'} rationale
        </Button>
      </div>
      <MatrixTable
        rows={rows}
        columns={columns}
        cornerLabel="Role \\ Entity"
        compact
        renderCell={(row, col) => {
          const entry = getEntry(row.key, col.key);
          if (!entry) return <span className="text-slate-300">—</span>;
          return (
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex gap-1">
                <AccessCell letter="R" granted={entry.read} />
                <AccessCell letter="W" granted={entry.write} />
                <AccessCell letter="D" granted={entry.delete} />
                <AccessCell letter="E" granted={entry.export} />
              </div>
              <span className="text-[10px] text-slate-400">{entry.scope}</span>
              {showRationale && entry.rationale && (
                <span className="max-w-[100px] truncate text-[10px] text-slate-400" title={entry.rationale}>
                  {entry.rationale}
                </span>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}

function AccessCell({ letter, granted }: { letter: string; granted: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
        granted
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
      }`}
    >
      {letter}
    </span>
  );
}

// ── Step 4: Role Hierarchy ───────────────────────────────────────────────────

function RoleHierarchyView({
  hierarchy,
  maxDepth,
  roles,
}: {
  hierarchy: RoleInheritance[];
  maxDepth: number;
  roles: Role[];
}) {
  const getRoleName = (id: string) => roles.find((r) => r.role_id === id)?.name ?? id;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        <GitBranch className="inline mr-1 h-4 w-4" />
        Role Hierarchy
      </h4>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          Max depth: <span className="font-semibold">{maxDepth}</span> (limit: 5)
        </span>
        <Badge
          variant={maxDepth <= 5 ? 'default' : 'destructive'}
          className="text-[10px]"
        >
          {maxDepth <= 5 ? (
            <><CheckCircle className="mr-1 h-3 w-3" /> PASS</>
          ) : (
            <><XCircle className="mr-1 h-3 w-3" /> FAIL</>
          )}
        </Badge>
      </div>
      {hierarchy.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No inheritance rules defined.</p>
      ) : (
        <div className="space-y-1">
          {hierarchy.map((h, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-1.5 text-xs dark:bg-slate-800/50"
            >
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {getRoleName(h.from_role_id)}
              </span>
              <ChevronRight className="h-3 w-3 text-slate-400" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {getRoleName(h.to_role_id)}
              </span>
              <Badge variant="outline" className="ml-2 text-[10px]">
                depth {h.depth}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Audit Policy Display ─────────────────────────────────────────────────────

function AuditPolicyView({ policy }: { policy: AuditPolicy }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        <Shield className="inline mr-1 h-4 w-4" />
        Audit Policy
      </h4>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <PolicyItem label="Retention" value={`${policy.retention_days} days`} />
        <PolicyItem label="Audit writes" value={policy.audit_all_writes ? 'Yes' : 'No'} yesNo />
        <PolicyItem label="Alert on escalation" value={policy.alert_on_privilege_escalation ? 'Yes' : 'No'} yesNo />
        <PolicyItem label="Alert on bulk export" value={policy.alert_on_bulk_export ? 'Yes' : 'No'} yesNo />
        <PolicyItem label="Immutable logs" value={policy.audit_log_immutable ? 'Yes' : 'No'} yesNo />
        <PolicyItem label="Storage" value={policy.storage_strategy} />
      </div>
    </div>
  );
}

function PolicyItem({
  label,
  value,
  yesNo,
}: {
  label: string;
  value: string;
  yesNo?: boolean;
}) {
  const isYes = yesNo && value === 'Yes';
  const isNo = yesNo && value === 'No';
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1 dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={`font-medium ${
          isYes
            ? 'text-green-600 dark:text-green-400'
            : isNo
              ? 'text-red-500 dark:text-red-400'
              : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export function RBACDesignPanel() {
  const rbacModel = useSteeringStore((s) => s.rbacModel);
  const rbacConflict = useSteeringStore((s) => s.rbacConflict);
  const escalationFlag = useSteeringStore((s) => s.escalationFlag);
  const inheritanceCycle = useSteeringStore((s) => s.inheritanceCycle);

  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1, 2, 3, 4]));

  const toggleStep = (step: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const handleRename = useCallback((_roleId: string, _newName: string) => {
    // Placeholder: actual rename would call steering action via API
  }, []);

  const handleRemove = useCallback((_roleId: string) => {
    // Placeholder: actual remove would call steering action via API
  }, []);

  if (!rbacModel) {
    return (
      <Card className="border-dashed border-slate-300 dark:border-slate-600">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            <Shield className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            Waiting for RBAC model...
          </div>
        </CardContent>
      </Card>
    );
  }

  const roles = rbacModel.roles;
  const permissions = rbacModel.permissions;
  const permMatrix = rbacModel.permission_matrix;
  const dataMatrix = rbacModel.data_access_matrix;
  const hierarchy = rbacModel.role_hierarchy;
  const maxDepth = rbacModel.max_inheritance_depth;
  const auditPolicy = rbacModel.audit_policy;

  const dataEntities = [...new Set(dataMatrix.map((d) => d.data_entity))];

  const steps = [
    {
      num: 1,
      title: 'Review Roles',
      icon: Users,
      content: <RoleList roles={roles} onRename={handleRename} onRemove={handleRemove} />,
    },
    {
      num: 2,
      title: 'Permission Matrix',
      icon: Key,
      content: (
        <PermissionMatrixView
          roles={roles}
          permissions={permissions}
          matrix={permMatrix}
        />
      ),
    },
    {
      num: 3,
      title: 'Data Access Matrix',
      icon: Database,
      content: (
        <DataAccessMatrixView
          roles={roles}
          dataEntities={dataEntities}
          matrix={dataMatrix}
        />
      ),
    },
    {
      num: 4,
      title: 'Role Hierarchy & Validation',
      icon: GitBranch,
      content: <RoleHierarchyView hierarchy={hierarchy} maxDepth={maxDepth} roles={roles} />,
    },
    {
      num: 5,
      title: 'Audit Policy',
      icon: Shield,
      content: <AuditPolicyView policy={auditPolicy} />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="space-y-4"
    >
      {/* Alerts */}
      <AnimatePresence>
        {rbacConflict && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-semibold">RBAC Conflict Detected:</span>{' '}
                Roles &quot;{rbacConflict.roles.join('", "')}&quot; both granted{' '}
                <code className="rounded bg-red-100 px-1 py-0.5 text-xs dark:bg-red-900/30">
                  {rbacConflict.permission}
                </code>
                <div className="mt-1 text-xs">ID: {rbacConflict.conflict_id}</div>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {escalationFlag && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Alert variant="destructive" className="border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-semibold">Privilege Escalation Flagged</span>
                <div className="mt-1 space-y-1 text-xs">
                  <div><strong>Path:</strong> {escalationFlag.path}</div>
                  <div><strong>Resulting access:</strong> {escalationFlag.resulting_access}</div>
                  <div><strong>Algorithm:</strong> {escalationFlag.algorithm}</div>
                  <div><strong>Depth limit:</strong> {escalationFlag.depth_limit}</div>
                  <div><strong>Conditions evaluated:</strong> {escalationFlag.conditions_evaluated ? 'Yes' : 'No'}</div>
                </div>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {inheritanceCycle && !inheritanceCycle.cycle_check_passed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-semibold">Inheritance Cycle Detected</span>
                {inheritanceCycle.cycle_path && (
                  <div className="mt-1 text-xs">
                    Cycle: {inheritanceCycle.cycle_path.join(' → ')}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Steps */}
      {steps.map((step) => {
        const isOpen = expandedSteps.has(step.num);
        const Icon = step.icon;
        return (
          <Card key={step.num} className="overflow-hidden">
            <button
              onClick={() => toggleStep(step.num)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {step.num}
                </span>
                <Icon className="h-4 w-4 text-slate-500" />
                {step.title}
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardContent className="pb-4 pt-0">
                    {step.content}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        );
      })}
    </motion.div>
  );
}

export default RBACDesignPanel;
