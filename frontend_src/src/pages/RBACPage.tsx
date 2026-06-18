// =============================================================================
// RBACPage — Full RBAC matrix view page (replaces stub)
// URL: /pipeline/:sessionId/rbac
// Steps: 1.Role Mgmt  2.Permission Matrix  3.Data Access  4.Hierarchy+Validation
// Data from: steeringStore.rbacModel + pipelineApi.getRbac(sessionId)
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router';
import {
  Shield, Users, Check, X, ChevronDown, ChevronUp,
  AlertTriangle, Download, Plus, Trash2,
  Pencil, CheckCircle2, XCircle, AlertCircle,
  Lock, GitBranch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { pipelineApi } from '@/lib/api';
import { useSteeringStore } from '@/stores/steeringStore';
import type {
  RBACModel, Role, RolePermissionEntry,
  DataAccessEntry, AuditPolicy,
} from '@/types/domain';

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBadge({ step, label, active }: { step: number; label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
        {step}
      </span>
      {label}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 py-12">
      <Shield className="mb-2 h-8 w-8 text-slate-600" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1 — Role Management
// ═══════════════════════════════════════════════════════════════════════════════
interface RoleManagementProps {
  rbac: RBACModel;
  onRbacChange: (rbac: RBACModel) => void;
}

function RoleManagement({ rbac, onRbacChange }: RoleManagementProps) {
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const handleRename = (roleId: string) => {
    const role = rbac.roles.find((r) => r.role_id === roleId);
    if (role) {
      setEditingRoleId(roleId);
      setEditName(role.name);
      setEditDesc(role.description);
    }
  };

  const handleSaveRename = () => {
    if (!editingRoleId) return;
    const updated = {
      ...rbac,
      roles: rbac.roles.map((r) =>
        r.role_id === editingRoleId ? { ...r, name: editName, description: editDesc } : r
      ),
    };
    onRbacChange(updated);
    setEditingRoleId(null);
  };

  const handleRemove = (roleId: string) => {
    const updated = {
      ...rbac,
      roles: rbac.roles.filter((r) => r.role_id !== roleId),
      permission_matrix: rbac.permission_matrix.filter((p) => p.role_id !== roleId),
      data_access_matrix: rbac.data_access_matrix.filter((d) => d.role_id !== roleId),
      role_hierarchy: rbac.role_hierarchy.filter((h) => h.from_role_id !== roleId && h.to_role_id !== roleId),
    };
    onRbacChange(updated);
  };

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    const newRole: Role = {
      role_id: `role_${Date.now()}`,
      name: newRoleName.trim(),
      description: newRoleDesc.trim(),
      actor_ids: [],
      inherited_role_ids: [],
    };
    const updated = {
      ...rbac,
      roles: [...rbac.roles, newRole],
    };
    onRbacChange(updated);
    setNewRoleName('');
    setNewRoleDesc('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          Roles ({rbac.roles.length})
        </h3>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-3.5 w-3.5" />
          Add Custom Role
        </Button>
      </div>

      {showAddForm && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-400">New Role</p>
          <div className="space-y-2">
            <Input
              placeholder="Role name"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Description"
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={handleAddRole}>Add</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rbac.roles.map((role) => (
          <div
            key={role.role_id}
            className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 transition-colors hover:border-slate-600"
          >
            {editingRoleId === role.role_id ? (
              <div className="space-y-2">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-xs" />
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-7 text-xs" />
                <div className="flex gap-2">
                  <Button size="sm" className="h-6 text-xs" onClick={handleSaveRename}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingRoleId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <p className="text-sm font-medium text-white">{role.name}</p>
                    {role.actor_ids.length > 0 && (
                      <Badge variant="outline" className="h-5 text-[10px] text-slate-400">
                        {role.actor_ids.length} actor{role.actor_ids.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{role.description}</p>
                  {role.actor_ids.length > 0 && (
                    <p className="mt-1 text-[10px] text-slate-600">
                      From: {role.actor_ids.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-slate-500 hover:text-blue-400"
                    onClick={() => handleRename(role.role_id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-slate-500 hover:text-red-400"
                    onClick={() => handleRemove(role.role_id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {rbac.roles.length === 0 && <EmptyState message="No roles defined yet" />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 — Permission Matrix
// ═══════════════════════════════════════════════════════════════════════════════
interface PermissionMatrixProps {
  rbac: RBACModel;
  onRbacChange: (rbac: RBACModel) => void;
}

function PermissionMatrix({ rbac, onRbacChange }: PermissionMatrixProps) {
  // Get unique permission labels from the matrix
  const permissionLabels = useMemo(() => {
    const labels = new Map<string, string>();
    rbac.permission_matrix.forEach((p) => labels.set(p.permission_id, p.permission_label));
    return labels;
  }, [rbac.permission_matrix]);

  const permissionIds = useMemo(() => Array.from(permissionLabels.keys()), [permissionLabels]);

  const handleTogglePermission = (roleId: string, permId: string) => {
    const existing = rbac.permission_matrix.find(
      (p) => p.role_id === roleId && p.permission_id === permId
    );
    let updatedMatrix: RolePermissionEntry[];
    if (existing) {
      updatedMatrix = rbac.permission_matrix.map((p) =>
        p.role_id === roleId && p.permission_id === permId
          ? { ...p, granted: !p.granted, decision_maker: 'user' as const }
          : p
      );
    } else {
      updatedMatrix = [
        ...rbac.permission_matrix,
        {
          role_id: roleId,
          permission_id: permId,
          permission_label: permissionLabels.get(permId) ?? permId,
          granted: true,
          rationale: 'Manually granted by user',
          decision_maker: 'user',
        },
      ];
    }
    onRbacChange({ ...rbac, permission_matrix: updatedMatrix });
  };

  // Conflict detection: two roles both granted the same destructive permission
  const conflicts = useMemo(() => {
    const destructivePerms = ['delete', 'execute', 'approve', 'export'];
    const c: Array<{ permissionId: string; permissionLabel: string; roles: string[] }> = [];
    destructivePerms.forEach((action) => {
      const permsForAction = rbac.permission_matrix.filter(
        (p) => p.granted && p.permission_label.toLowerCase().includes(action)
      );
      if (permsForAction.length > 1) {
        const roleNames = permsForAction.map((p) => {
          const r = rbac.roles.find((role) => role.role_id === p.role_id);
          return r?.name ?? p.role_id;
        });
        c.push({
          permissionId: action,
          permissionLabel: action,
          roles: roleNames,
        });
      }
    });
    return c;
  }, [rbac.permission_matrix, rbac.roles]);

  const getCellEntry = (roleId: string, permId: string) =>
    rbac.permission_matrix.find((p) => p.role_id === roleId && p.permission_id === permId);

  return (
    <div className="space-y-4">
      {/* Conflict warnings */}
      {conflicts.length > 0 && (
        <div className="rounded-lg border border-red-800/50 bg-red-900/20 p-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <p className="text-xs font-semibold text-red-400">Conflicts Detected</p>
          </div>
          {conflicts.map((c, i) => (
            <p key={i} className="text-xs text-red-300">
              {c.roles.join(', ')} all granted {c.permissionLabel}
            </p>
          ))}
        </div>
      )}

      {/* Permission matrix table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-xs text-slate-400">Role</TableHead>
              {permissionIds.map((pid) => (
                <TableHead key={pid} className="min-w-[100px] text-center text-xs text-slate-400">
                  {permissionLabels.get(pid) ?? pid}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rbac.roles.map((role) => (
              <TableRow key={role.role_id} className="border-slate-700/50 hover:bg-slate-800/30">
                <TableCell className="text-xs font-medium text-white">{role.name}</TableCell>
                {permissionIds.map((pid) => {
                  const entry = getCellEntry(role.role_id, pid);
                  const granted = entry?.granted ?? false;
                  return (
                    <TableCell key={pid} className="text-center">
                      <button
                        onClick={() => handleTogglePermission(role.role_id, pid)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded border transition-colors ${
                          granted
                            ? 'border-green-700 bg-green-900/30 text-green-400 hover:bg-green-900/50'
                            : 'border-slate-700 bg-slate-800/30 text-slate-600 hover:bg-slate-700/50'
                        }`}
                      >
                        {granted ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                      {entry?.rationale && (
                        <p className="mt-0.5 max-w-[80px] truncate text-[9px] text-slate-600" title={entry.rationale}>
                          {entry.rationale}
                        </p>
                      )}
                      {entry && (
                        <Badge
                          variant={entry.decision_maker === 'user' ? 'outline' : 'secondary'}
                          className="mt-0.5 h-4 text-[8px]"
                        >
                          {entry.decision_maker}
                        </Badge>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {permissionIds.length === 0 && <EmptyState message="No permissions defined yet" />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3 — Data Access Matrix
// ═══════════════════════════════════════════════════════════════════════════════
interface DataAccessMatrixProps {
  rbac: RBACModel;
  onRbacChange: (rbac: RBACModel) => void;
}

function DataAccessMatrix({ rbac, onRbacChange }: DataAccessMatrixProps) {
  // Get unique data entities
  const dataEntities = useMemo(() => {
    const entities = new Set<string>();
    rbac.data_access_matrix.forEach((d) => entities.add(d.data_entity));
    return Array.from(entities);
  }, [rbac.data_access_matrix]);

  const handleToggleAccess = (
    roleId: string,
    entity: string,
    field: 'read' | 'write' | 'delete' | 'export'
  ) => {
    const existing = rbac.data_access_matrix.find(
      (d) => d.role_id === roleId && d.data_entity === entity
    );
    let updated: DataAccessEntry[];
    if (existing) {
      updated = rbac.data_access_matrix.map((d) =>
        d.role_id === roleId && d.data_entity === entity
          ? { ...d, [field]: !d[field] }
          : d
      );
    } else {
      updated = [
        ...rbac.data_access_matrix,
        {
          role_id: roleId,
          data_entity: entity,
          read: field === 'read',
          write: field === 'write',
          delete: field === 'delete',
          export: field === 'export',
          scope: 'own' as const,
          rationale: '',
        },
      ];
    }
    onRbacChange({ ...rbac, data_access_matrix: updated });
  };

  const handleScopeChange = (roleId: string, entity: string, scope: 'own' | 'team' | 'all') => {
    const existing = rbac.data_access_matrix.find(
      (d) => d.role_id === roleId && d.data_entity === entity
    );
    let updated: DataAccessEntry[];
    if (existing) {
      updated = rbac.data_access_matrix.map((d) =>
        d.role_id === roleId && d.data_entity === entity ? { ...d, scope } : d
      );
    } else {
      updated = [
        ...rbac.data_access_matrix,
        {
          role_id: roleId,
          data_entity: entity,
          read: false,
          write: false,
          delete: false,
          export: false,
          scope,
          rationale: '',
        },
      ];
    }
    onRbacChange({ ...rbac, data_access_matrix: updated });
  };

  const getEntry = (roleId: string, entity: string) =>
    rbac.data_access_matrix.find((d) => d.role_id === roleId && d.data_entity === entity);

  const accessLabel = (val: boolean) => (val ? 'Y' : '-');
  const accessClass = (val: boolean) =>
    val ? 'text-green-400 font-medium' : 'text-slate-600';

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-xs text-slate-400">Role \ Entity</TableHead>
              {dataEntities.map((entity) => (
                <TableHead key={entity} className="min-w-[120px] text-center text-xs text-slate-400">
                  {entity}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rbac.roles.map((role) => (
              <TableRow key={role.role_id} className="border-slate-700/50 hover:bg-slate-800/30">
                <TableCell className="text-xs font-medium text-white">{role.name}</TableCell>
                {dataEntities.map((entity) => {
                  const entry = getEntry(role.role_id, entity);
                  return (
                    <TableCell key={entity} className="text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px]">
                        <button
                          onClick={() => handleToggleAccess(role.role_id, entity, 'read')}
                          className={`rounded px-1 py-0.5 ${accessClass(entry?.read ?? false)}`}
                          title="Read"
                        >
                          R:{accessLabel(entry?.read ?? false)}
                        </button>
                        <button
                          onClick={() => handleToggleAccess(role.role_id, entity, 'write')}
                          className={`rounded px-1 py-0.5 ${accessClass(entry?.write ?? false)}`}
                          title="Write"
                        >
                          W:{accessLabel(entry?.write ?? false)}
                        </button>
                        <button
                          onClick={() => handleToggleAccess(role.role_id, entity, 'delete')}
                          className={`rounded px-1 py-0.5 ${accessClass(entry?.delete ?? false)}`}
                          title="Delete"
                        >
                          D:{accessLabel(entry?.delete ?? false)}
                        </button>
                        <button
                          onClick={() => handleToggleAccess(role.role_id, entity, 'export')}
                          className={`rounded px-1 py-0.5 ${accessClass(entry?.export ?? false)}`}
                          title="Export"
                        >
                          E:{accessLabel(entry?.export ?? false)}
                        </button>
                      </div>
                      <div className="mt-1">
                        <Select
                          value={entry?.scope ?? 'own'}
                          onValueChange={(v) => handleScopeChange(role.role_id, entity, v as 'own' | 'team' | 'all')}
                        >
                          <SelectTrigger className="mx-auto h-5 w-[60px] text-[9px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="own" className="text-[10px]">own</SelectItem>
                            <SelectItem value="team" className="text-[10px]">team</SelectItem>
                            <SelectItem value="all" className="text-[10px]">all</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {dataEntities.length === 0 && <EmptyState message="No data entities defined yet" />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4 — Hierarchy & Validation
// ═══════════════════════════════════════════════════════════════════════════════
interface HierarchyValidationProps {
  rbac: RBACModel;
  conflicts: Array<{ roles: string[]; permission: string }> | null;
  cycleCheck: { cycle_check_passed: boolean; cycle_path?: string[] } | null;
  escalationFlag: {
    path: string; resulting_access: string; algorithm: string;
    depth_limit: number; conditions_evaluated: boolean;
  } | null;
}

function HierarchyValidation({
  rbac,
  conflicts,
  cycleCheck,
  escalationFlag,
}: HierarchyValidationProps) {
  const cyclePassed = cycleCheck?.cycle_check_passed ?? true;
  const depth = rbac.max_inheritance_depth;

  // Build hierarchy tree display
  const rootRoles = useMemo(() => {
    const childIds = new Set(rbac.role_hierarchy.map((h) => h.to_role_id));
    return rbac.roles.filter((r) => !childIds.has(r.role_id));
  }, [rbac.roles, rbac.role_hierarchy]);

  const getChildren = (roleId: string) =>
    rbac.role_hierarchy
      .filter((h) => h.from_role_id === roleId)
      .map((h) => {
        const role = rbac.roles.find((r) => r.role_id === h.to_role_id);
        return { ...h, roleName: role?.name ?? h.to_role_id };
      });

  return (
    <div className="space-y-4">
      {/* Hierarchy tree */}
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
          <GitBranch className="h-3.5 w-3.5 text-slate-500" />
          Role Hierarchy
        </h4>
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          {rootRoles.length === 0 ? (
            <p className="text-xs text-slate-500">No hierarchy defined</p>
          ) : (
            rootRoles.map((role) => (
              <HierarchyNode
                key={role.role_id}
                roleId={role.role_id}
                roleName={role.name}
                depth={0}
                getChildren={getChildren}
              />
            ))
          )}
        </div>
      </div>

      {/* Validation checks */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-white">Validation Results</h4>

        {/* Depth check */}
        <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/30 px-3 py-2">
          {depth <= 5 ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400" />
          )}
          <span className="text-xs text-slate-300">
            Depth: {depth} / max 5 — {depth <= 5 ? 'PASSED' : 'FAILED'}
          </span>
        </div>

        {/* Cycle check */}
        <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/30 px-3 py-2">
          {cyclePassed ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400" />
          )}
          <span className="text-xs text-slate-300">
            Cycle Check: {cyclePassed ? 'PASSED' : 'FAILED'}
            {!cyclePassed && cycleCheck?.cycle_path && (
              <span className="ml-1 text-red-400">
                Path: {cycleCheck.cycle_path.join(' -> ')}
              </span>
            )}
          </span>
        </div>

        {/* Conflict check */}
        <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/30 px-3 py-2">
          {(!conflicts || conflicts.length === 0) ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
          )}
          <span className="text-xs text-slate-300">
            Conflicts: {conflicts?.length ?? 0} detected
          </span>
        </div>
      </div>

      {/* Privilege escalation */}
      {escalationFlag && (
        <div className="rounded-lg border border-yellow-800/50 bg-yellow-900/20 p-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <p className="text-xs font-semibold text-yellow-400">Privilege Escalation</p>
          </div>
          <p className="text-xs text-yellow-200">{escalationFlag.resulting_access}</p>
          <div className="mt-1 text-[10px] text-yellow-300/70">
            Algorithm: {escalationFlag.algorithm} | Depth limit: {escalationFlag.depth_limit}
          </div>
          <p className="mt-1 text-[10px] text-yellow-300/70">
            Path: {escalationFlag.path}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Recursive hierarchy node ─────────────────────────────────────────────────
function HierarchyNode({
  roleName,
  depth,
  getChildren,
  roleId,
}: {
  roleName: string;
  depth: number;
  getChildren: (id: string) => Array<{ roleName: string; to_role_id: string }>;
  roleId: string;
}) {
  const children = getChildren(roleId);
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="select-none">
      <button
        onClick={() => children.length > 0 && setExpanded(!expanded)}
        className="flex items-center gap-1.5 py-1 text-xs text-slate-300 hover:text-white"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {children.length > 0 ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-slate-500" />
          ) : (
            <ChevronUp className="h-3 w-3 text-slate-500" />
          )
        ) : (
          <span className="w-3" />
        )}
        <Shield className="h-3 w-3 text-slate-500" />
        {roleName}
        {children.length > 0 && (
          <span className="text-[10px] text-slate-600">({children.length})</span>
        )}
      </button>
      {expanded &&
        children.map((child) => (
          <HierarchyNode
            key={child.to_role_id}
            roleId={child.to_role_id}
            roleName={child.roleName}
            depth={depth + 1}
            getChildren={getChildren}
          />
        ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audit Policy Section
// ═══════════════════════════════════════════════════════════════════════════════
interface AuditPolicySectionProps {
  policy: AuditPolicy;
  onPolicyChange: (policy: AuditPolicy) => void;
}

function AuditPolicySection({ policy, onPolicyChange }: AuditPolicySectionProps) {
  const handleToggle = (field: keyof AuditPolicy) => {
    onPolicyChange({
      ...policy,
      [field]: !policy[field],
    });
  };

  const handleRetentionChange = (days: number) => {
    onPolicyChange({ ...policy, retention_days: days });
  };

  const handleStorageChange = (strategy: 'diff' | 'full' | 'reference') => {
    onPolicyChange({ ...policy, storage_strategy: strategy });
  };

  return (
    <div className="space-y-4">
      <h4 className="flex items-center gap-2 text-xs font-semibold text-white">
        <Lock className="h-3.5 w-3.5 text-slate-500" />
        Audit Policy
      </h4>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Retention */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <Label className="text-xs text-slate-400">Retention Days</Label>
          <div className="mt-2 flex items-center gap-3">
            <Slider
              value={[policy.retention_days]}
              onValueChange={([v]) => handleRetentionChange(v)}
              min={30}
              max={3650}
              step={30}
              className="flex-1"
            />
            <span className="min-w-[50px] text-right text-xs font-mono text-white">
              {policy.retention_days}d
            </span>
          </div>
        </div>

        {/* Storage strategy */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <Label className="text-xs text-slate-400">Storage Strategy</Label>
          <Select value={policy.storage_strategy} onValueChange={(v) => handleStorageChange(v as 'diff' | 'full' | 'reference')}>
            <SelectTrigger className="mt-2 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diff" className="text-xs">diff</SelectItem>
              <SelectItem value="full" className="text-xs">full</SelectItem>
              <SelectItem value="reference" className="text-xs">reference</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <Checkbox
            id="audit-writes"
            checked={policy.audit_all_writes}
            onCheckedChange={() => handleToggle('audit_all_writes')}
          />
          <Label htmlFor="audit-writes" className="cursor-pointer text-xs text-slate-300">
            Audit all writes
          </Label>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <Checkbox
            id="alert-escalation"
            checked={policy.alert_on_privilege_escalation}
            onCheckedChange={() => handleToggle('alert_on_privilege_escalation')}
          />
          <Label htmlFor="alert-escalation" className="cursor-pointer text-xs text-slate-300">
            Alert on privilege escalation
          </Label>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <Checkbox
            id="alert-export"
            checked={policy.alert_on_bulk_export}
            onCheckedChange={() => handleToggle('alert_on_bulk_export')}
          />
          <Label htmlFor="alert-export" className="cursor-pointer text-xs text-slate-300">
            Alert on bulk export
          </Label>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <Checkbox
            id="log-immutable"
            checked={policy.audit_log_immutable}
            onCheckedChange={() => handleToggle('audit_log_immutable')}
          />
          <Label htmlFor="log-immutable" className="cursor-pointer text-xs text-slate-300">
            Audit log immutable
          </Label>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN RBACPage
// ═══════════════════════════════════════════════════════════════════════════════
export default function RBACPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const rbacFromStore = useSteeringStore((s) => s.rbacModel);
  const rbacConflict = useSteeringStore((s) => s.rbacConflict);
  const escalationFlag = useSteeringStore((s) => s.escalationFlag);
  const inheritanceCycle = useSteeringStore((s) => s.inheritanceCycle);

  const [rbac, setRbac] = useState<RBACModel | null>(null);
  const [activeTab, setActiveTab] = useState('roles');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch from API + store
  useEffect(() => {
    if (rbacFromStore) {
      setRbac(rbacFromStore);
      setLoading(false);
    } else if (sessionId) {
      setLoading(true);
      pipelineApi
        .getRbac(sessionId)
        .then((data) => {
          setRbac(data);
          useSteeringStore.getState().setRbacModel(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load RBAC');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [sessionId, rbacFromStore]);

  const handleRbacChange = useCallback((updated: RBACModel) => {
    setRbac(updated);
  }, []);

  const handleExport = useCallback(() => {
    if (!rbac) return;
    const blob = new Blob([JSON.stringify(rbac, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rbac-model-${sessionId ?? 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rbac, sessionId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto mb-2 h-8 w-8 animate-pulse text-slate-600" />
          <p className="text-sm text-slate-500">Loading RBAC model...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!rbac) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState message="No RBAC model available for this session" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-blue-400" />
          <div>
            <h1 className="text-lg font-semibold text-white">RBAC Design</h1>
            <p className="text-xs text-slate-500">
              Version {rbac.version} | {rbac.roles.length} roles | {rbac.permissions.length} permissions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rbacConflict && (
            <Badge variant="destructive" className="h-6 gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" />
              Conflict
            </Badge>
          )}
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 px-4 py-2">
        <StepBadge step={1} label="Roles" active={activeTab === 'roles'} />
        <StepBadge step={2} label="Permissions" active={activeTab === 'permissions'} />
        <StepBadge step={3} label="Data Access" active={activeTab === 'dataaccess'} />
        <StepBadge step={4} label="Hierarchy" active={activeTab === 'hierarchy'} />
        <StepBadge step={5} label="Audit Policy" active={activeTab === 'auditpolicy'} />
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="sr-only">
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="dataaccess">Data Access</TabsTrigger>
            <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
            <TabsTrigger value="auditpolicy">Audit Policy</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="mt-0">
            <RoleManagement rbac={rbac} onRbacChange={handleRbacChange} />
          </TabsContent>

          <TabsContent value="permissions" className="mt-0">
            <PermissionMatrix rbac={rbac} onRbacChange={handleRbacChange} />
          </TabsContent>

          <TabsContent value="dataaccess" className="mt-0">
            <DataAccessMatrix rbac={rbac} onRbacChange={handleRbacChange} />
          </TabsContent>

          <TabsContent value="hierarchy" className="mt-0">
            <HierarchyValidation
              rbac={rbac}
              conflicts={rbacConflict ? [rbacConflict] : null}
              cycleCheck={inheritanceCycle}
              escalationFlag={escalationFlag}
            />
          </TabsContent>

          <TabsContent value="auditpolicy" className="mt-0">
            <AuditPolicySection
              policy={rbac.audit_policy}
              onPolicyChange={(policy) => handleRbacChange({ ...rbac, audit_policy: policy })}
            />
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}
