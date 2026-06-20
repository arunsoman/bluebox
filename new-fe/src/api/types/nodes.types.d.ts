// ============================================================
// Hybrid Node Domain Model — Best of File 2 + File 3
// ============================================================
// Design goals:
//   1. Single source of truth for hierarchy (File 2)
//   2. Compile-time + runtime enforcement (File 2 + File 3)
//   3. Zero `any` in public API (File 2)
//   4. Rich tree operations & builder pattern (File 3)
//   5. Fully encapsulated validation with conditional helpers (File 2 + File 1)
//   6. Observable nodes, graph manager, serialization (File 3)

/* ═══════════════════════════════════════════════════════════
   1. HIERARCHY — Single Source of Truth
   ═══════════════════════════════════════════════════════════ */

export enum NodeState {
  EXTRACTED = "extracted",
  SYSTEM_GENERATED = "system_generated",
  USER_ENRICHED = "user_enriched",
  USER_DEFINED = "user_defined",
  SUPERSEDED = "superseded",
  INFERRED = "inferred",
  DEFERRED = "deferred",
  ORPHANED = "orphaned",
}



export const HIERARCHY_RULES = {
  root:             { accepts: ["actor", "capability", "custom_annotation"] as const },
  actor:            { accepts: ["custom_annotation"] as const },
  capability:       { accepts: ["use_case", "custom_annotation"] as const },
  use_case:         { accepts: ["user_story", "custom_annotation"] as const },
  user_story:       { accepts: ["engineering_task", "custom_annotation"] as const },
  engineering_task: { accepts: ["custom_annotation"] as const },
  custom_annotation:{ accepts: [] as const },
} as const;

/** Derived automatically from the keys above — one edit propagates everywhere. */
export type NodeType = keyof typeof HIERARCHY_RULES;

type HR = typeof HIERARCHY_RULES;

/** Compile-time child-type lookup.
 *  Example: ChildrenOf<"use_case"> = "user_story" | "custom_annotation" */
export type ChildrenOf<T extends NodeType> = HR[T]["accepts"][number];

/** Inverse lookup — which parent nodes may hold T?
 *  Example: ParentsOf<"user_story"> = "use_case" */
export type ParentsOf<T extends NodeType> = {
  [K in NodeType]: T extends ChildrenOf<K> ? K : never
}[NodeType];

/* ── Runtime helpers (zero `any`) ── */

export function isValidChild(parentType: NodeType, childType: NodeType): boolean {
  return (HIERARCHY_RULES[parentType].accepts as readonly NodeType[]).includes(childType);
}

export function getAllowedChildren<T extends NodeType>(type: T): readonly NodeType[] {
  return HIERARCHY_RULES[type].accepts as readonly NodeType[];
}

export function getAllowedParents(childType: NodeType): NodeType[] {
  return (Object.keys(HIERARCHY_RULES) as NodeType[]).filter((parent) =>
    (HIERARCHY_RULES[parent].accepts as readonly NodeType[]).includes(childType)
  );
}

/* ═══════════════════════════════════════════════════════════
   2. VALIDATION FRAMEWORK — DRY + Conditional Helpers
   ═══════════════════════════════════════════════════════════ */

export type NodeStatus = "draft" | "active" | "archived" | "deprecated";
export type ISO8601 = string;
export type MoscowPriority = "Must Have" | "Should Have" | "Could Have" | "Won't Have";

export interface NodeProvenance {
  generated_at_stage: number;
  decision_entry_id: string;
  checkpoint_id: string;
  llm_call_id?: string;
}

export interface ValidationField {
  field_path: string;
  field_name: string;
  present: boolean;
  value: unknown;
  required: boolean;
  rule: string;
}

export interface ValidationError {
  field_path: string;
  error_code: string;
  message: string;
  severity: "blocking" | "critical";
  suggested_fix?: string;
}

export interface ValidationWarning {
  field_path: string;
  warning_code: string;
  message: string;
  severity: "warning" | "info";
}

export interface PRDComplianceCheck {
  acceptance_criterion_id: string;
  criterion: string;
  passed: boolean;
  prd_reference: string;
}

export interface ValidationResult {
  valid: boolean;
  completeness_score: number;
  required_fields: ValidationField[];
  prd_compliance: PRDComplianceCheck[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export class HierarchyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HierarchyViolationError";
  }
}

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Fully encapsulated validator with both imperative and conditional APIs. */
export class Validator {
  private fields: ValidationField[] = [];
  private _errors: ValidationError[] = [];
  private _warnings: ValidationWarning[] = [];

  constructor(private modelName: string) {}

  /** Assert a field is present; auto-records in `required_fields` + `errors`. */
  require(field: string, value: unknown): this {
    const present = isPresent(value);
    this.fields.push({
      field_path: field,
      field_name: field,
      present,
      value,
      required: true,
      rule: "required",
    });
    if (!present) {
      this._errors.push({
        field_path: field,
        error_code: "MISSING_REQUIRED_FIELD",
        message: `${field} is required for ${this.modelName}`,
        severity: "blocking",
        suggested_fix: `Provide a value for ${field}`,
      });
    }
    return this;
  }

  /** Conditionally push an error. */
  errorIf(cond: boolean, error: ValidationError): this {
    if (cond) this._errors.push(error);
    return this;
  }

  /** Conditionally push a warning. */
  warnIf(cond: boolean, warning: ValidationWarning): this {
    if (cond) this._warnings.push(warning);
    return this;
  }

  /** Directly push an error (for complex logic). */
  addError(error: ValidationError): this {
    this._errors.push(error);
    return this;
  }

  /** Directly push a warning. */
  addWarning(warning: ValidationWarning): this {
    this._warnings.push(warning);
    return this;
  }

  /** Build the final result. */
  result(): ValidationResult {
    const total = this.fields.length;
    const present = this.fields.filter((f) => f.present).length;
    return {
      valid: this._errors.length === 0,
      completeness_score: total === 0 ? 1 : present / total,
      required_fields: this.fields,
      prd_compliance: [],
      errors: this._errors,
      warnings: this._warnings,
    };
  }
}

/* ═══════════════════════════════════════════════════════════
   3. GENERIC NODE BASE CLASS
   ═══════════════════════════════════════════════════════════ */

export interface NodeInit {
  node_id: string;
  name?: string;
  description?: string;
  layer?: string;
  status?: NodeStatus;
  provenance?: NodeProvenance;
  created_at?: ISO8601;
  updated_at?: ISO8601;
  created_by?: string;
  version?: number;
}

export abstract class Node<T extends NodeType> {
  readonly node_id: string;
  abstract readonly node_type: T;
    id: string;
  name: string;
  description: string;
  layer: string;
  state: NodeState;
  status: NodeStatus;
  provenance: NodeProvenance;
  created_at: ISO8601;
  updated_at: ISO8601;
  created_by: string;
  version: number;

  protected _parent?: Node<NodeType>;
  protected _children: Map<string, Node<ChildrenOf<T>>> = new Map();

  constructor(init: NodeInit) {
    this.node_id = init.node_id;
    this.name = init.name ?? "";
    this.description = init.description ?? "";
    this.layer = init.layer ?? "";
    this.status = init.status ?? "draft";
    this.provenance = init.provenance ?? {
      generated_at_stage: 0,
      decision_entry_id: "",
      checkpoint_id: "",
      llm_call_id: "",
    };
    this.created_at = init.created_at ?? new Date().toISOString();
    this.updated_at = init.updated_at ?? new Date().toISOString();
    this.created_by = init.created_by ?? "system";
    this.version = init.version ?? 1;
  }

  /* ── Type-Safe Tree Operations ── */

  /** Attach a child. Compile-time enforced via generic constraint C. */
  addChild<C extends ChildrenOf<T>>(child: Node<C>): void {
    if (child.node_id === this.node_id) {
      throw new HierarchyViolationError("A node cannot be its own child");
    }
    if (!isValidChild(this.node_type, child.node_type)) {
      throw new HierarchyViolationError(
        `${this.node_type} cannot accept child of type ${child.node_type}. ` +
          `Allowed: [${getAllowedChildren(this.node_type).join(", ")}]`
      );
    }
    if (child._parent && child._parent.node_id !== this.node_id) {
      throw new HierarchyViolationError(
        `Node ${child.node_id} is already attached to ${child._parent.node_id}`
      );
    }
    if (this._children.has(child.node_id)) {
      throw new HierarchyViolationError(
        `Child ${child.node_id} already attached to ${this.node_id}`
      );
    }

    child._parent = this;
    this._children.set(child.node_id, child as Node<ChildrenOf<T>>);
    this.touch();
  }

  /** Detach a child by ID. Returns the removed node. */
  removeChild(nodeId: string): Node<ChildrenOf<T>> | undefined {
    const child = this._children.get(nodeId);
    if (!child) return undefined;
    child._parent = undefined;
    this._children.delete(nodeId);
    this.touch();
    return child;
  }

  /** Move child from its current parent to this node. */
  adopt<C extends ChildrenOf<T>>(child: Node<C>): void {
    if (child._parent && child._parent !== this) {
      child._parent._children.delete(child.node_id);
      child._parent = undefined;
    }
    this.addChild(child);
  }

  /** Remove this node from its current parent. */
  detach(): void {
    if (this._parent) {
      this._parent._children.delete(this.node_id);
      this._parent = undefined;
    }
  }

  getChildren(): Node<ChildrenOf<T>>[] {
    return Array.from(this._children.values());
  }

  getParent(): Node<NodeType> | undefined {
    return this._parent;
  }

  hasChildren(): boolean {
    return this._children.size > 0;
  }

  getChildCount(): number {
    return this._children.size;
  }

  /** Depth in tree (0 for root). */
  getDepth(): number {
    let depth = 0;
    let current: Node<NodeType> | undefined = this;
    while (current._parent) {
      depth++;
      current = current._parent;
    }
    return depth;
  }

  /** Path from root to this node. */
  getPath(): Node<NodeType>[] {
    const path: Node<NodeType>[] = [this];
    let current: Node<NodeType> | undefined = this;
    while (current._parent) {
      current = current._parent;
      path.unshift(current);
    }
    return path;
  }

  /** Walk subtree depth-first. */
  walk(callback: (node: Node<NodeType>) => void): void {
    callback(this);
    for (const child of this._children.values()) child.walk(callback);
  }

  /** Find first match in subtree. */
  find(predicate: (node: Node<NodeType>) => boolean): Node<NodeType> | undefined {
    if (predicate(this)) return this;
    for (const child of this._children.values()) {
      const found = child.find(predicate);
      if (found) return found;
    }
    return undefined;
  }

  /** Find all matches in subtree. */
  findAll(predicate: (node: Node<NodeType>) => boolean): Node<NodeType>[] {
    const results: Node<NodeType>[] = [];
    this.walk((node) => {
      if (predicate(node)) results.push(node);
    });
    return results;
  }

  /** Patch whitelisted scalar fields. */
  edit(data: Record<string, unknown>): void {
    const allowed = ["name", "description", "layer", "status"];
    for (const key of allowed) {
      if (key in data) (this as Record<string, unknown>)[key] = data[key];
    }
    this.touch();
  }

  /** Create a clone with updated fields (immutable update pattern). */
  with(changes: Partial<this>): this {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this, changes);
    clone._children = new Map(this._children);
    clone._parent = undefined;
    clone.version = 1;
    return clone;
  }

  /** Deep clone the entire subtree. */
  clone(): Node<T> {
    const cloned = Object.create(Object.getPrototypeOf(this));
    Object.assign(cloned, this, {
      _parent: undefined,
      _children: new Map(),
      version: 1,
    });
    for (const child of this._children.values()) {
      const childClone = child.clone();
      childClone._parent = cloned;
      cloned._children.set(childClone.node_id, childClone);
    }
    return cloned;
  }

  protected touch(): void {
    this.updated_at = new Date().toISOString();
    this.version += 1;
  }

  /* ── Abstract Contract ── */
  abstract validate(): ValidationResult;

  /* ── Serialization ── */
  toJSON(): Record<string, unknown> {
    return {
      node_id: this.node_id,
      node_type: this.node_type,
      name: this.name,
      description: this.description,
      layer: this.layer,
      status: this.status,
      parent_id: this._parent?.node_id,
      children_ids: Array.from(this._children.keys()),
      provenance: this.provenance,
      created_at: this.created_at,
      updated_at: this.updated_at,
      created_by: this.created_by,
      version: this.version,
    };
  }

  /** Deep serialization including children. */
  serialize(): SerializedNode {
    return {
      node_id: this.node_id,
      node_type: this.node_type,
      version: this.version,
      data: this.toJSON(),
      children: this.getChildren().map((c) => c.serialize()),
    };
  }
}

export interface SerializedNode {
  node_id: string;
  node_type: NodeType;
  version: number;
  data: Record<string, unknown>;
  children: SerializedNode[];
}

/* ═══════════════════════════════════════════════════════════
   4. CONCRETE IMPLEMENTATIONS
   ═══════════════════════════════════════════════════════════ */

export interface UseCaseStep {
  step_number: number;
  description: string;
  actor_performing: string;
  system_response?: string;
}

export interface AlternativeFlow {
  flow_id: string;
  flow_name: string;
  trigger_condition: string;
  steps: UseCaseStep[];
}

export class UseCase extends Node<"use_case"> {
  readonly node_type = "use_case" as const;

  primary_actor_id = "";
  secondary_actor_ids: string[] = [];
  preconditions: string[] = [];
  main_flow: UseCaseStep[] = [];
  alternative_flows: AlternativeFlow[] = [];
  postconditions: string[] = [];
  success_criteria: string[] = [];

  constructor(init: Partial<UseCase> & { node_id: string }) {
    super(init);
    Object.assign(this, init);
  }

  validate(): ValidationResult {
    const v = new Validator("UseCase");
    v.require("primary_actor_id", this.primary_actor_id)
      .require("main_flow", this.main_flow)
      .require("preconditions", this.preconditions)
      .require("postconditions", this.postconditions);

    v.errorIf(
      this.main_flow.length > 0 &&
        !this.main_flow.every((s) => s.description && s.actor_performing),
      {
        field_path: "main_flow",
        error_code: "INCOMPLETE_STEPS",
        message: "All main flow steps must have description and actor_performing",
        severity: "critical",
      }
    );

    return v.result();
  }
}

export interface AcceptanceCriterion {
  ac_id: string;
  given: string;
  when: string;
  then: string;
  complete: boolean;
}

export class UserStory extends Node<"user_story"> {
  readonly node_type = "user_story" as const;

  title = "";
  actor_id = "";
  story_points = 0;
  priority: MoscowPriority = "Must Have";
  acceptance_criteria: AcceptanceCriterion[] = [];
  technical_notes = "";
  dependencies: string[] = [];

  constructor(init: Partial<UserStory> & { node_id: string }) {
    super(init);
    Object.assign(this, init);
  }

  validate(): ValidationResult {
    const v = new Validator("UserStory");
    v.require("title", this.title)
      .require("actor_id", this.actor_id)
      .require("acceptance_criteria", this.acceptance_criteria);

    const fib = new Set([1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
    v.warnIf(!fib.has(this.story_points), {
      field_path: "story_points",
      warning_code: "NON_FIBONACCI_POINTS",
      message: `Story points ${this.story_points} is not a standard Fibonacci value`,
      severity: "warning",
    });

    const incomplete = this.acceptance_criteria.filter((ac) => !ac.complete);
    v.warnIf(incomplete.length > 0, {
      field_path: "acceptance_criteria",
      warning_code: "INCOMPLETE_AC",
      message: `${incomplete.length} acceptance criteria are missing G/W/T clauses`,
      severity: "warning",
    });

    return v.result();
  }
}

export interface AccessGuard {
  guard_type: "authorization" | "authentication" | "input_validation" | "rate_limiting";
  description: string;
  implementation_hint?: string;
}

export class EngineeringTask extends Node<"engineering_task"> {
  readonly node_type = "engineering_task" as const;

  estimated_hours = 0;
  complexity: "Low" | "Medium" | "High" | "Critical" = "Low";
  preconditions: string[] = [];
  postconditions: string[] = [];
  file_paths: string[] = [];
  tech_stack_requirements: string[] = [];
  database_schema_changes?: string;
  access_guards: AccessGuard[] = [];
  parent_story_id = "";

  constructor(init: Partial<EngineeringTask> & { node_id: string }) {
    super(init);
    Object.assign(this, init);
  }

  validate(): ValidationResult {
    const v = new Validator("EngineeringTask");
    v.require("estimated_hours", this.estimated_hours)
      .require("complexity", this.complexity)
      .require("parent_story_id", this.parent_story_id)
      .require("file_paths", this.file_paths);

    v.errorIf(this.estimated_hours <= 0, {
      field_path: "estimated_hours",
      error_code: "INVALID_HOURS",
      message: "Estimated hours must be greater than 0",
      severity: "blocking",
    });

    return v.result();
  }
}

export class Actor extends Node<"actor"> {
  readonly node_type = "actor" as const;

  actor_type: "Primary" | "Secondary" | "System" | "External" = "Primary";
  icon?: string;
  goals: string[] = [];
  pain_points: string[] = [];
  technical_proficiency: "Low" | "Medium" | "High" = "Medium";
  role_name = "";
  permissions: string[] = [];
  data_access_level: "None" | "Own" | "Department" | "All" = "None";

  constructor(init: Partial<Actor> & { node_id: string }) {
    super(init);
    Object.assign(this, init);
  }

  validate(): ValidationResult {
    const v = new Validator("Actor");
    v.require("actor_type", this.actor_type)
      .require("role_name", this.role_name)
      .require("goals", this.goals);
    return v.result();
  }
}

export class Capability extends Node<"capability"> {
  readonly node_type = "capability" as const;

  priority: MoscowPriority = "Must Have";
  in_scope: string[] = [];
  out_of_scope: string[] = [];
  business_value = "";
  linked_use_case_ids: string[] = [];

  constructor(init: Partial<Capability> & { node_id: string }) {
    super(init);
    Object.assign(this, init);
  }

  validate(): ValidationResult {
    const v = new Validator("Capability");
    v.require("priority", this.priority)
      .require("business_value", this.business_value)
      .require("in_scope", this.in_scope);
    return v.result();
  }
}

export class CustomAnnotation extends Node<"custom_annotation"> {
  readonly node_type = "custom_annotation" as const;

  annotation_type = "note";
  color = "#ffff00";

  constructor(init: Partial<CustomAnnotation> & { node_id: string }) {
    super(init);
    Object.assign(this, init);
  }

  validate(): ValidationResult {
    return {
      valid: true,
      completeness_score: 1,
      required_fields: [],
      prd_compliance: [],
      errors: [],
      warnings: [],
    };
  }
}

/* ═══════════════════════════════════════════════════════════
   5. GRAPH MANAGER
   ═══════════════════════════════════════════════════════════ */

export interface GraphStats {
  totalNodes: number;
  nodesByType: Partial<Record<NodeType, number>>;
  maxDepth: number;
  leafNodes: number;
}

export class GraphManager {
  private _nodes = new Map<string, Node<NodeType>>();

  register<N extends NodeType>(node: Node<N>): void {
    this._nodes.set(node.node_id, node);
  }

  get<N extends NodeType>(id: string): Node<N> | undefined {
    return this._nodes.get(id) as Node<N> | undefined;
  }

  has(id: string): boolean {
    return this._nodes.has(id);
  }

  remove(id: string): boolean {
    const node = this._nodes.get(id);
    if (node) {
      node.detach();
      return this._nodes.delete(id);
    }
    return false;
  }

  getAll(): Node<NodeType>[] {
    return Array.from(this._nodes.values());
  }

  /** Type-safe attachment when you hold typed references. */
  link<P extends NodeType, C extends ChildrenOf<P>>(
    parent: Node<P>,
    child: Node<C>
  ): void {
    parent.addChild(child);
    this.register(parent);
    this.register(child);
  }

  /** String-based attachment (types erased at runtime). */
  attach(parentId: string, childId: string): void {
    const parent = this._nodes.get(parentId);
    const child = this._nodes.get(childId);
    if (!parent || !child) throw new Error("Node not found");
    parent.addChild(child as never); // runtime guard inside addChild
  }

  detach(parentId: string, childId: string): Node<NodeType> | undefined {
    const parent = this._nodes.get(parentId);
    return parent?.removeChild(childId);
  }

  /** Validate an entire subtree. */
  validateSubtree(rootId: string): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();
    const root = this._nodes.get(rootId);
    if (!root) return results;
    root.walk((node) => results.set(node.node_id, node.validate()));
    return results;
  }

  /** Find path between two nodes by ID. */
  findPath(fromId: string, toId: string): string[] | null {
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [
      { id: fromId, path: [fromId] },
    ];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (id === toId) return path;
      if (visited.has(id)) continue;
      visited.add(id);

      const node = this._nodes.get(id);
      if (node) {
        for (const child of node.getChildren()) {
          queue.push({ id: child.node_id, path: [...path, child.node_id] });
        }
      }
    }
    return null;
  }

  /** Get all root nodes (nodes without parents). */
  getRoots(): Node<NodeType>[] {
    return this.getAll().filter((node) => !node.getParent());
  }

  /** Batch operations atomically with rollback on failure. */
  transaction(operations: () => void): void {
    const snapshot = new Map(this._nodes);
    try {
      operations();
    } catch (error) {
      this._nodes = snapshot;
      throw error;
    }
  }

  /** Serialize entire graph (all root trees). */
  serialize(): SerializedNode[] {
    return this.getRoots().map((root) => root.serialize());
  }

  /** Deserialize and register all nodes. */
  deserialize(data: SerializedNode[]): void {
    for (const nodeData of data) {
      const node = this._deserializeNode(nodeData);
      this.register(node);
    }
  }

  private _deserializeNode(data: SerializedNode): Node<NodeType> {
    const node = NodeFactory.create(data.node_type, data.data as NodeInit);
    for (const childData of data.children) {
      const child = this._deserializeNode(childData);
      node.addChild(child);
      this.register(child);
    }
    return node;
  }

  /** Get statistics about the graph. */
  getStats(): GraphStats {
    const stats: GraphStats = {
      totalNodes: this._nodes.size,
      nodesByType: {},
      maxDepth: 0,
      leafNodes: 0,
    };

    for (const node of this._nodes.values()) {
      stats.nodesByType[node.node_type] = (stats.nodesByType[node.node_type] || 0) + 1;
      if (!node.hasChildren()) stats.leafNodes++;
      stats.maxDepth = Math.max(stats.maxDepth, node.getDepth());
    }

    return stats;
  }
}

/* ═══════════════════════════════════════════════════════════
   6. NODE BUILDER
   ═══════════════════════════════════════════════════════════ */

export class NodeBuilder<T extends NodeType> {
  private data: Partial<Record<string, unknown>> = {};

  constructor(private type: T, private id: string) {
    this.data.node_id = id;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withDescription(desc: string): this {
    this.data.description = desc;
    return this;
  }

  withStatus(status: NodeStatus): this {
    this.data.status = status;
    return this;
  }

  withLayer(layer: string): this {
    this.data.layer = layer;
    return this;
  }

  withField<K extends string>(key: K, value: unknown): this {
    this.data[key] = value;
    return this;
  }

  withData(data: Partial<Record<string, unknown>>): this {
    Object.assign(this.data, data);
    return this;
  }

  build(): Node<T> {
    return NodeFactory.create(this.type, this.data as NodeInit);
  }
}

/* ═══════════════════════════════════════════════════════════
   7. FACTORY & GUARDS
   ═══════════════════════════════════════════════════════════ */

export class NodeFactory {
  static create(type: "use_case", data: NodeInit): UseCase;
  static create(type: "user_story", data: NodeInit): UserStory;
  static create(type: "engineering_task", data: NodeInit): EngineeringTask;
  static create(type: "actor", data: NodeInit): Actor;
  static create(type: "capability", data: NodeInit): Capability;
  static create(type: "custom_annotation", data: NodeInit): CustomAnnotation;
  static create(type: NodeType, data: NodeInit): Node<NodeType> {
    switch (type) {
      case "use_case":
        return new UseCase(data as Partial<UseCase> & { node_id: string });
      case "user_story":
        return new UserStory(data as Partial<UserStory> & { node_id: string });
      case "engineering_task":
        return new EngineeringTask(data as Partial<EngineeringTask> & { node_id: string });
      case "actor":
        return new Actor(data as Partial<Actor> & { node_id: string });
      case "capability":
        return new Capability(data as Partial<Capability> & { node_id: string });
      case "custom_annotation":
        return new CustomAnnotation(data as Partial<CustomAnnotation> & { node_id: string });
      case "root":
        throw new Error("Root is managed by the system");
      default:
        throw new Error(`Unknown node type: ${type}`);
    }
  }

  static builder<T extends NodeType>(type: T, id: string): NodeBuilder<T> {
    return new NodeBuilder(type, id);
  }
}

export function isUseCase(node: Node<NodeType>): node is UseCase {
  return node.node_type === "use_case";
}
export function isUserStory(node: Node<NodeType>): node is UserStory {
  return node.node_type === "user_story";
}
export function isEngineeringTask(node: Node<NodeType>): node is EngineeringTask {
  return node.node_type === "engineering_task";
}
export function isActor(node: Node<NodeType>): node is Actor {
  return node.node_type === "actor";
}
export function isCapability(node: Node<NodeType>): node is Capability {
  return node.node_type === "capability";
}
export function isCustomAnnotation(node: Node<NodeType>): node is CustomAnnotation {
  return node.node_type === "custom_annotation";
}

/** Discriminated union for exhaustive switch/case. */
export type ConcreteNode =
  | UseCase
  | UserStory
  | EngineeringTask
  | Actor
  | Capability
  | CustomAnnotation;

/** Get display name based on node type semantics. */
export function getNodeDisplayName(node: ConcreteNode): string {
  switch (node.node_type) {
    case "use_case":
      return node.name;
    case "user_story":
      return node.title || node.name;
    case "engineering_task":
      return node.name;
    case "actor":
      return node.role_name || node.name;
    case "capability":
      return node.name;
    case "custom_annotation":
      return node.name;
  }
}

/* ═══════════════════════════════════════════════════════════
   8. OBSERVABLE NODE (Event Emitter Pattern)
   ═══════════════════════════════════════════════════════════ */

export type NodeEvent = "child-added" | "child-removed" | "updated";

export class ObservableNode<T extends NodeType> extends Node<T> {
  private listeners: Map<NodeEvent, Set<(node: Node<T>) => void>> = new Map();

  on(event: NodeEvent, callback: (node: Node<T>) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: NodeEvent): void {
    this.listeners.get(event)?.forEach((cb) => cb(this));
  }

  addChild<C extends ChildrenOf<T>>(child: Node<C>): void {
    super.addChild(child);
    this.emit("child-added");
  }

  removeChild(nodeId: string): Node<ChildrenOf<T>> | undefined {
    const result = super.removeChild(nodeId);
    if (result) this.emit("child-removed");
    return result;
  }

  protected touch(): void {
    super.touch();
    this.emit("updated");
  }
}

/* ═══════════════════════════════════════════════════════════
   9. DEMO
   ═══════════════════════════════════════════════════════════ */

export function demo() {
  console.log("═══ Hybrid Node Domain Model Demo ═══\\n");

  const gm = new GraphManager();

  // ── Factory construction
  const cap = NodeFactory.create("capability", {
    node_id: "cap-1",
    name: "Authentication",
    business_value: "Critical for security",
    in_scope: ["Login", "Logout", "Password Reset"],
    priority: "Must Have",
  });

  // ── Builder construction (fluent)
  const uc = NodeFactory.builder("use_case", "uc-1")
    .withName("User Login")
    .withDescription("Authenticate user into the system")
    .withData({
      primary_actor_id: "actor-1",
      preconditions: ["User has valid account"],
      postconditions: ["User is authenticated"],
      main_flow: [
        {
          step_number: 1,
          description: "User enters credentials",
          actor_performing: "End User",
        },
        {
          step_number: 2,
          description: "System validates credentials",
          actor_performing: "System",
          system_response: "Credentials validated",
        },
      ],
    })
    .build();

  const story = NodeFactory.create("user_story", {
    node_id: "us-1",
    name: "Login Story",
    title: "As a user, I want to login to access my dashboard",
    actor_id: "actor-1",
    story_points: 3,
    priority: "Must Have",
    acceptance_criteria: [
      {
        ac_id: "ac-1",
        given: "valid credentials",
        when: "user submits login form",
        then: "redirect to dashboard",
        complete: true,
      },
    ],
  });

  const task = NodeFactory.create("engineering_task", {
    node_id: "et-1",
    name: "Implement JWT Authentication",
    estimated_hours: 4,
    complexity: "Medium",
    parent_story_id: "us-1",
    file_paths: ["src/auth/jwt.ts", "src/middleware/auth.ts"],
    tech_stack_requirements: ["jsonwebtoken", "bcrypt"],
  });

  const actor = NodeFactory.create("actor", {
    node_id: "actor-1",
    name: "End User",
    role_name: "end_user",
    actor_type: "Primary",
    goals: ["Access personal dashboard", "Manage account settings"],
    technical_proficiency: "Low",
  });

  const annotation = NodeFactory.create("custom_annotation", {
    node_id: "ann-1",
    name: "Security Note",
    annotation_type: "warning",
    color: "#ff0000",
    description: "Ensure OWASP compliance for all auth flows",
  });

  // ── Build tree with compile-time type safety
  cap.addChild(uc);
  uc.addChild(story);
  uc.addChild(annotation); // custom_annotation allowed everywhere
  story.addChild(task);

  // Uncomment to see compile-time errors:
  // story.addChild(uc);     // TS Error: "use_case" not in ChildrenOf<"user_story">
  // task.addChild(story);   // TS Error: "user_story" not in ChildrenOf<"engineering_task">

  // ── GraphManager operations
  gm.link(cap, uc);
  gm.link(uc, story);
  gm.link(story, task);
  gm.register(actor);
  gm.register(annotation);

  // ── Tree walk
  console.log("Tree Structure:");
  cap.walk((node) => {
    const indent = "  ".repeat(node.getDepth());
    console.log(`${indent}[${node.node_type}] ${getNodeDisplayName(node as ConcreteNode)}`);
  });

  // ── Validation
  console.log("\\nValidation Results:");
  const results = gm.validateSubtree("cap-1");
  for (const [id, result] of results) {
    console.log(
      `  ${id}: valid=${result.valid}, score=${result.completeness_score.toFixed(2)}`
    );
  }

  // ── Graph stats
  console.log("\\nGraph Stats:", gm.getStats());

  // ── Path finding
  console.log("\\nPath from cap-1 to et-1:", gm.findPath("cap-1", "et-1"));

  // ── Clone and modify
  const clonedCap = cap.clone();
  clonedCap.name = "Cloned Authentication";
  console.log("\\nCloned:", clonedCap.name, "Children:", clonedCap.getChildCount());

  // ── Serialization round-trip
  const serialized = gm.serialize();
  console.log("\\nSerialized graph root count:", serialized.length);

  // ── Observable node demo
  const obsCap = new ObservableNode<"capability">({
    node_id: "obs-cap-1",
    name: "Observable Capability",
    business_value: "Test",
    in_scope: ["Test"],
  });

  const unsub = obsCap.on("child-added", (n) => {
    console.log(`\\n[Event] child-added to ${n.node_id}`);
  });

  obsCap.addChild(
    NodeFactory.create("use_case", {
      node_id: "obs-uc-1",
      name: "Observable UC",
      primary_actor_id: "actor-1",
      preconditions: [],
      postconditions: [],
      main_flow: [],
    })
  );

  unsub();
}