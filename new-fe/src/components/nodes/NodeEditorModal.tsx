import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Spinner } from "@/components/common/Spinner";
import { useToast } from "@/components/common/Toast/ToastContext";
import { useNodeEditorStore, type EditableNodeType } from "@/stores/nodeEditorStore";
import { useAuditNavigationStore } from "@/stores/auditNavigationStore";
import { usePipelineStore } from "@/stores/pipelineStore";
import { nodesApi } from "@/api/endpoints/nodes";
import { graphApi } from "@/api/endpoints/graph";
import { ApiError } from "@/api/httpClient";
import { ActorEditorForm, type ActorDraft } from "./ActorEditorForm";
import { CapabilityEditorForm, type CapabilityDraft } from "./CapabilityEditorForm";
import { UseCaseEditorForm, type UseCaseDraft } from "./UseCaseEditorForm";
import { UserStoryEditorForm, type UserStoryDraft } from "./UserStoryEditorForm";
import { TaskEditorForm, type TaskDraft } from "./TaskEditorForm";
import { ValidationStatusList } from "./ValidationStatusList";
import { EnrichmentPanel } from "./EnrichmentPanel";
import styles from "./EditorForms.module.css";

type Draft = ActorDraft | CapabilityDraft | UseCaseDraft | UserStoryDraft | TaskDraft;

const TITLES: Record<EditableNodeType, string> = {
  actor: "Actor",
  capability: "Capability",
  use_case: "Use Case",
  user_story: "User Story",
  engineering_task: "Engineering Task",
};

/** Use Case has no Delete button in the wireframe footer (missing-screens §1.1); the others do (§1.2-§1.4). */
const DELETABLE: EditableNodeType[] = ["actor", "capability", "user_story", "engineering_task"];

function emptyDraft(nodeType: EditableNodeType): Draft {
  const base = { name: "", description: "", layer: "frontend", status: "USER_DEFINED" as NodeStatus };
  switch (nodeType) {
    case "actor":
      return { ...base, actor_type: "Primary", goals: [], pain_points: [], technical_proficiency: "Medium", role_name: "", permissions: [], data_access_level: "Own" };
    case "capability":
      return { ...base, priority: "Must Have", in_scope: [], out_of_scope: [], business_value: "", linked_use_case_ids: [] };
    case "use_case":
      return { ...base, primary_actor_id: "", secondary_actor_ids: [], preconditions: [], main_flow: [], alternative_flows: [], postconditions: [], success_criteria: [] };
    case "user_story":
      return { title: "", description: "", layer: base.layer, status: base.status, actor_id: "", story_points: 1, priority: "Must Have", acceptance_criteria: [], technical_notes: "", dependencies: [] };
    case "engineering_task":
      return { ...base, estimated_hours: null, complexity: null, preconditions: [], postconditions: [], file_paths: [], tech_stack_requirements: [], database_schema_changes: "", access_guards: [], parent_story_id: "" };
  }
}

/** The generic `Node` envelope doesn't carry per-type fields in its TS shape, even though the real payload does — narrow once at this boundary. */
function nodeToDraft(node: Node, nodeType: EditableNodeType): Draft {
  const raw = node as unknown as Record<string, unknown>;
  const base = { name: node.name, description: node.description, layer: node.layer, status: node.status };
  switch (nodeType) {
    case "actor":
      return {
        ...base,
        actor_type: (raw.actor_type as Actor["actor_type"]) ?? "Primary",
        icon: raw.icon as string | undefined,
        goals: (raw.goals as string[]) ?? [],
        pain_points: (raw.pain_points as string[]) ?? [],
        technical_proficiency: (raw.technical_proficiency as Actor["technical_proficiency"]) ?? "Medium",
        role_name: (raw.role_name as string) ?? "",
        permissions: (raw.permissions as string[]) ?? [],
        data_access_level: (raw.data_access_level as Actor["data_access_level"]) ?? "Own",
      };
    case "capability":
      return {
        ...base,
        priority: (raw.priority as MoscowPriority) ?? "Must Have",
        in_scope: (raw.in_scope as string[]) ?? [],
        out_of_scope: (raw.out_of_scope as string[]) ?? [],
        business_value: (raw.business_value as string) ?? "",
        linked_use_case_ids: (raw.linked_use_case_ids as string[]) ?? [],
      };
    case "use_case":
      return {
        ...base,
        primary_actor_id: (raw.primary_actor_id as string) ?? "",
        secondary_actor_ids: (raw.secondary_actor_ids as string[]) ?? [],
        preconditions: (raw.preconditions as string[]) ?? [],
        main_flow: (raw.main_flow as UseCaseStep[]) ?? [],
        alternative_flows: (raw.alternative_flows as AlternativeFlow[]) ?? [],
        postconditions: (raw.postconditions as string[]) ?? [],
        success_criteria: (raw.success_criteria as string[]) ?? [],
      };
    case "user_story":
      return {
        title: (raw.title as string) ?? "",
        description: node.description,
        layer: node.layer,
        status: node.status,
        actor_id: (raw.actor_id as string) ?? "",
        story_points: (raw.story_points as number) ?? 1,
        priority: (raw.priority as UserStory["priority"]) ?? "Must Have",
        acceptance_criteria: (raw.acceptance_criteria as AcceptanceCriterion[]) ?? [],
        technical_notes: (raw.technical_notes as string) ?? "",
        dependencies: (raw.dependencies as string[]) ?? [],
      };
    case "engineering_task":
      return {
        ...base,
        estimated_hours: (raw.estimated_hours as number) ?? null,
        complexity: (raw.complexity as EngineeringTask["complexity"]) ?? null,
        preconditions: (raw.preconditions as string[]) ?? [],
        postconditions: (raw.postconditions as string[]) ?? [],
        file_paths: (raw.file_paths as string[]) ?? [],
        tech_stack_requirements: (raw.tech_stack_requirements as string[]) ?? [],
        database_schema_changes: (raw.database_schema_changes as string) ?? "",
        access_guards: (raw.access_guards as AccessGuard[]) ?? [],
        parent_story_id: (raw.parent_story_id as string) ?? "",
      };
  }
}

export function NodeEditorModal() {
  const target = useNodeEditorStore((s) => s.target);
  const close = useNodeEditorStore((s) => s.close);
  const openDelete = useNodeEditorStore((s) => s.openDelete);
  const projectId = usePipelineStore((s) => s.projectId);
  const { pushToast } = useToast();
  const focusLedger = useAuditNavigationStore((s) => s.focusLedger);

  const [node, setNode] = useState<Node | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEnrich, setShowEnrich] = useState(false);

  const active = target && (target.mode === "edit" || target.mode === "add") ? target : null;

  useEffect(() => {
    if (!active || !projectId) return;
    setLoading(true);
    setShowEnrich(false);
    graphApi.getGraph(projectId).then((g) => setGraphNodes(g.nodes)).catch(() => setGraphNodes([]));

    if (active.mode === "edit") {
      Promise.all([nodesApi.get(projectId, active.nodeId), nodesApi.validate(projectId, active.nodeId)])
        .then(([n, v]) => {
          setNode(n);
          setDraft(nodeToDraft(n, active.nodeType));
          setValidation(v);
        })
        .catch((err: unknown) => {
          pushToast({ severity: "error", title: "Could not load node", body: err instanceof ApiError ? err.message : "Unknown error" });
          close();
        })
        .finally(() => setLoading(false));
    } else {
      setNode(null);
      setValidation(null);
      setDraft(emptyDraft(active.nodeType));
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.mode, active && "nodeId" in active ? active.nodeId : null, active?.nodeType, projectId]);

  if (!active || !draft) return null;

  const handleSave = async (thenEnrich: boolean) => {
    if (!projectId) return;
    setSaving(true);
    try {
      if (active.mode === "edit") {
        const updated = await nodesApi.update(projectId, active.nodeId, { data: draft, source: "user_edit" });
        setNode(updated);
        const freshValidation = await nodesApi.validate(projectId, active.nodeId);
        setValidation(freshValidation);
        pushToast({ severity: "success", title: "Saved" });
        if (thenEnrich) setShowEnrich(true);
        else close();
      } else {
        const created = await nodesApi.create(projectId, { node_type: active.nodeType, parent_id: active.parentId, data: draft, source: "user" });
        pushToast({ severity: "success", title: `${TITLES[active.nodeType]} created` });
        if (thenEnrich) {
          setNode(created);
          setShowEnrich(true);
        } else {
          close();
        }
      }
    } catch (err) {
      pushToast({ severity: "error", title: "Save failed", body: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  };

  const nodeId = active.mode === "edit" ? active.nodeId : node?.node_id;

  if (showEnrich && nodeId) {
    return <EnrichmentPanel nodeId={nodeId} nodeType={active.nodeType} onClose={close} />;
  }

  return (
    <Modal title={`Edit ${TITLES[active.nodeType]}${nodeId ? `: ${nodeId}` : ""}`} onClose={close} width={720}>
      {loading ? (
        <Spinner />
      ) : (
        <>
          {active.nodeType === "actor" && <ActorEditorForm value={draft as ActorDraft} onChange={(p) => setDraft({ ...draft, ...p } as Draft)} />}
          {active.nodeType === "capability" && (
            <CapabilityEditorForm
              value={draft as CapabilityDraft}
              onChange={(p) => setDraft({ ...draft, ...p } as Draft)}
              availableUseCases={graphNodes.filter((n) => n.type === "use_case")}
            />
          )}
          {active.nodeType === "use_case" && (
            <UseCaseEditorForm
              value={draft as UseCaseDraft}
              onChange={(p) => setDraft({ ...draft, ...p } as Draft)}
              availableActors={graphNodes.filter((n) => n.type === "actor")}
            />
          )}
          {active.nodeType === "user_story" && (
            <UserStoryEditorForm
              value={draft as UserStoryDraft}
              onChange={(p) => setDraft({ ...draft, ...p } as Draft)}
              availableActors={graphNodes.filter((n) => n.type === "actor")}
              availableDependencies={graphNodes.filter((n) => n.id !== nodeId)}
            />
          )}
          {active.nodeType === "engineering_task" && (
            <TaskEditorForm
              value={draft as TaskDraft}
              onChange={(p) => setDraft({ ...draft, ...p } as Draft)}
              availableStories={graphNodes.filter((n) => n.type === "user_story")}
            />
          )}

          {validation && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Validation Status</h3>
              <ValidationStatusList result={validation} />
            </section>
          )}

          {node && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Provenance & Audit</h3>
              <div className={styles.sectionBody}>
                <div className={styles.readonly}>
                  Generated at Stage {node.provenance.generated_at_stage} · Decision {node.provenance.decision_entry_id}
                </div>
                <div className={styles.readonly}>
                  Last edited: by {node.created_by} at {new Date(node.updated_at).toLocaleString()}
                </div>
                <Button variant="secondary" onClick={() => focusLedger(node.provenance.decision_entry_id)}>
                  View in Decision Ledger
                </Button>
              </div>
            </section>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            {active.mode === "edit" && DELETABLE.includes(active.nodeType) && (
              <Button variant="danger" onClick={() => openDelete(active.nodeId, active.nodeType)}>
                Delete {TITLES[active.nodeType]}
              </Button>
            )}
            <Button variant="secondary" loading={saving} onClick={() => handleSave(false)}>Save Changes</Button>
            <Button loading={saving} onClick={() => handleSave(true)}>Save & Enrich →</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
