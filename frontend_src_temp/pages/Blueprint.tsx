import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode,
  Users,
  Zap,
  GitBranch,
  BookOpen,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Download,
  Circle,
  Check,
  Clock,
  Server,
  Lock,
  Database,
  Globe,
  ArrowRight,
} from 'lucide-react';
/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type TabId = 'overview' | 'actors' | 'capabilities' | 'useCases' | 'stories' | 'tasks';

type ValidationStatus = 'validated' | 'warning' | 'error' | 'pending';

interface Actor {
  id: string;
  name: string;
  description: string;
  role: 'Primary' | 'Secondary' | 'System';
  type: 'Human' | 'External' | 'Internal';
  priority: 'High' | 'Medium' | 'Low';
  capabilities: string[];
  storyCount: number;
  taskCount: number;
  status: ValidationStatus;
}

interface Capability {
  id: string;
  name: string;
  description: string;
  actorId: string;
  actorName: string;
  inputs: string[];
  outputs: string[];
  useCaseCount: number;
  status: ValidationStatus;
}

interface UseCase {
  id: string;
  name: string;
  primaryActor: string;
  preconditions: string;
  postconditions: string;
  mainFlow: string[];
  storyCount: number;
  status: ValidationStatus;
}

interface Story {
  id: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  taskCount: number;
  status: ValidationStatus;
}

interface Task {
  id: string;
  name: string;
  type: 'Frontend' | 'Backend' | 'DevOps' | 'Design' | 'Testing';
  status: 'todo' | 'in-progress' | 'done';
  assignedStory: string;
  priority: 'High' | 'Medium' | 'Low';
  description: string;
}

interface DecisionEntry {
  stage: string;
  decision: string;
  timestamp: string;
}

interface ProjectBlueprint {
  name: string;
  description: string;
  version: string;
  generatedAt: string;
  pipelineRun: number;
  stagesCompleted: number;
  totalStages: number;
  validationScore: number;
  status: ValidationStatus;
  actors: Actor[];
  capabilities: Capability[];
  useCases: UseCase[];
  stories: Story[];
  tasks: Task[];
  decisions: DecisionEntry[];
  techStack: string[];
  infrastructure: string[];
  rbac: string[];
}

/* ------------------------------------------------------------------ */
/*  MOCK DATA                                                          */
/* ------------------------------------------------------------------ */

const blueprint: ProjectBlueprint = {
  name: 'E-Commerce Platform',
  description:
    'A full-featured e-commerce platform with product catalog, shopping cart, Stripe payment processing, order management, and user role administration. Supports customers, vendors, and administrators with a REST API for mobile and web clients.',
  version: '1.0.0',
  generatedAt: '2 minutes ago',
  pipelineRun: 42,
  stagesCompleted: 8,
  totalStages: 8,
  validationScore: 96,
  status: 'validated',
  actors: [
    {
      id: 'actor-1',
      name: 'Customer',
      description: 'A registered user who browses products, manages their cart, and completes purchases.',
      role: 'Primary',
      type: 'Human',
      priority: 'High',
      capabilities: ['Browse Products', 'Manage Cart', 'Checkout', 'Track Orders'],
      storyCount: 12,
      taskCount: 24,
      status: 'validated',
    },
    {
      id: 'actor-2',
      name: 'Admin',
      description: 'System administrator who manages products, orders, user accounts, and role assignments.',
      role: 'Primary',
      type: 'Human',
      priority: 'High',
      capabilities: ['Manage Products', 'Manage Orders', 'Manage Users', 'Manage Roles'],
      storyCount: 8,
      taskCount: 16,
      status: 'validated',
    },
    {
      id: 'actor-3',
      name: 'Vendor',
      description: 'Third-party seller who lists products and manages inventory through the platform.',
      role: 'Secondary',
      type: 'Human',
      priority: 'Medium',
      capabilities: ['List Products', 'Manage Inventory', 'View Sales'],
      storyCount: 4,
      taskCount: 8,
      status: 'validated',
    },
    {
      id: 'actor-4',
      name: 'Payment Gateway',
      description: 'External Stripe service for processing payments securely.',
      role: 'System',
      type: 'External',
      priority: 'High',
      capabilities: ['Process Payment', 'Refund', 'Webhook Handling'],
      storyCount: 3,
      taskCount: 6,
      status: 'validated',
    },
    {
      id: 'actor-5',
      name: 'API Client',
      description: 'Mobile app and frontend SPA that consumes the REST API.',
      role: 'System',
      type: 'Internal',
      priority: 'High',
      capabilities: ['API Authentication', 'Data Sync'],
      storyCount: 5,
      taskCount: 10,
      status: 'validated',
    },
  ],
  capabilities: [
    { id: 'cap-1', name: 'Browse Products', description: 'Search, filter, and view product details', actorId: 'actor-1', actorName: 'Customer', inputs: ['searchQuery', 'category', 'filters'], outputs: ['productList'], useCaseCount: 3, status: 'validated' },
    { id: 'cap-2', name: 'Manage Cart', description: 'Add, remove, and update cart items', actorId: 'actor-1', actorName: 'Customer', inputs: ['productId', 'quantity'], outputs: ['cart'], useCaseCount: 2, status: 'validated' },
    { id: 'cap-3', name: 'Checkout', description: 'Complete purchase with Stripe integration', actorId: 'actor-1', actorName: 'Customer', inputs: ['cartId', 'paymentMethod'], outputs: ['order', 'receipt'], useCaseCount: 2, status: 'validated' },
    { id: 'cap-4', name: 'Track Orders', description: 'View order history and shipping status', actorId: 'actor-1', actorName: 'Customer', inputs: ['orderId'], outputs: ['orderStatus'], useCaseCount: 2, status: 'validated' },
    { id: 'cap-5', name: 'Manage Products', description: 'CRUD operations for product catalog', actorId: 'actor-2', actorName: 'Admin', inputs: ['productData'], outputs: ['product'], useCaseCount: 2, status: 'validated' },
    { id: 'cap-6', name: 'Manage Users', description: 'User administration and role management', actorId: 'actor-2', actorName: 'Admin', inputs: ['userData'], outputs: ['user'], useCaseCount: 2, status: 'validated' },
    { id: 'cap-7', name: 'Process Payment', description: 'Handle payment via Stripe API', actorId: 'actor-4', actorName: 'Payment Gateway', inputs: ['amount', 'token'], outputs: ['transactionId'], useCaseCount: 2, status: 'validated' },
    { id: 'cap-8', name: 'API Authentication', description: 'OAuth2/JWT token management', actorId: 'actor-5', actorName: 'API Client', inputs: ['credentials'], outputs: ['accessToken'], useCaseCount: 1, status: 'warning' },
  ],
  useCases: [
    { id: 'uc-1', name: 'Search Products', primaryActor: 'Customer', preconditions: 'User is logged in', postconditions: 'Product list displayed', mainFlow: ['User enters search term', 'System queries catalog', 'Results displayed with pagination'], storyCount: 3, status: 'validated' },
    { id: 'uc-2', name: 'Add to Cart', primaryActor: 'Customer', preconditions: 'Product is available', postconditions: 'Item added to cart', mainFlow: ['User views product', 'User clicks "Add to Cart"', 'System updates cart', 'Confirmation shown'], storyCount: 2, status: 'validated' },
    { id: 'uc-3', name: 'Process Checkout', primaryActor: 'Customer', preconditions: 'Cart has items', postconditions: 'Order created', mainFlow: ['User initiates checkout', 'System validates cart', 'Payment processed via Stripe', 'Order confirmation sent'], storyCount: 3, status: 'validated' },
    { id: 'uc-4', name: 'Manage User Roles', primaryActor: 'Admin', preconditions: 'Admin is authenticated', postconditions: 'Role assignments updated', mainFlow: ['Admin opens user management', 'Selects user', 'Modifies role', 'System saves changes'], storyCount: 2, status: 'warning' },
    { id: 'uc-5', name: 'Process Refund', primaryActor: 'Admin', preconditions: 'Order exists and is paid', postconditions: 'Refund initiated', mainFlow: ['Admin finds order', 'Clicks "Process Refund"', 'System calls Stripe API', 'Refund confirmation'], storyCount: 2, status: 'validated' },
  ],
  stories: [
    { id: 'us-1', asA: 'Customer', iWant: 'to search products by keyword', soThat: 'I can find what I need quickly', acceptanceCriteria: ['Search returns results within 500ms', 'Results are relevance-ranked', 'Empty state shown for no matches'], taskCount: 3, status: 'validated' },
    { id: 'us-2', asA: 'Customer', iWant: 'to filter products by category and price', soThat: 'I can narrow down my options', acceptanceCriteria: ['Multiple filters can be combined', 'Filter state persists in URL', 'Results update without page reload'], taskCount: 3, status: 'validated' },
    { id: 'us-3', asA: 'Customer', iWant: 'to add items to my cart', soThat: 'I can collect items for purchase', acceptanceCriteria: ['Cart persists across sessions', 'Quantity can be updated', 'Stock availability checked'], taskCount: 2, status: 'validated' },
    { id: 'us-4', asA: 'Customer', iWant: 'to pay with my credit card via Stripe', soThat: 'I can complete my purchase securely', acceptanceCriteria: ['Payment form is PCI compliant', '3D Secure supported', 'Receipt emailed after success'], taskCount: 4, status: 'validated' },
    { id: 'us-5', asA: 'Customer', iWant: 'to track my order status', soThat: 'I know when to expect delivery', acceptanceCriteria: ['Real-time status updates', 'Tracking number provided', 'Email notifications at each stage'], taskCount: 3, status: 'validated' },
    { id: 'us-6', asA: 'Admin', iWant: 'to add new products to the catalog', soThat: 'customers can purchase them', acceptanceCriteria: ['Image upload with validation', 'SEO metadata fields', 'Draft/publish workflow'], taskCount: 3, status: 'validated' },
    { id: 'us-7', asA: 'Admin', iWant: 'to assign roles to users', soThat: 'I can control access permissions', acceptanceCriteria: ['Role changes take effect immediately', 'Audit log entry created', 'Cannot remove own admin role'], taskCount: 2, status: 'warning' },
    { id: 'us-8', asA: 'Admin', iWant: 'to process refunds', soThat: 'I can handle customer returns', acceptanceCriteria: ['Refund amount validated against order', 'Stripe API call idempotent', 'Customer notified via email'], taskCount: 3, status: 'validated' },
  ],
  tasks: [
    { id: 't-1', name: 'Setup product search endpoint', type: 'Backend', status: 'done', assignedStory: 'us-1', priority: 'High', description: 'Implement Elasticsearch integration for product search' },
    { id: 't-2', name: 'Build search UI component', type: 'Frontend', status: 'done', assignedStory: 'us-1', priority: 'High', description: 'Create search bar with autocomplete' },
    { id: 't-3', name: 'Implement search filters', type: 'Backend', status: 'done', assignedStory: 'us-2', priority: 'Medium', description: 'Add category and price range filters' },
    { id: 't-4', name: 'Build filter sidebar', type: 'Frontend', status: 'done', assignedStory: 'us-2', priority: 'Medium', description: 'Filter panel with checkboxes and range slider' },
    { id: 't-5', name: 'Cart API endpoints', type: 'Backend', status: 'done', assignedStory: 'us-3', priority: 'High', description: 'REST endpoints for cart CRUD operations' },
    { id: 't-6', name: 'Cart state management', type: 'Frontend', status: 'in-progress', assignedStory: 'us-3', priority: 'High', description: 'Zustand store for cart with persistence' },
    { id: 't-7', name: 'Stripe integration', type: 'Backend', status: 'done', assignedStory: 'us-4', priority: 'High', description: 'Payment intent creation and webhook handling' },
    { id: 't-8', name: 'Checkout form', type: 'Frontend', status: 'in-progress', assignedStory: 'us-4', priority: 'High', description: 'Payment form with Stripe Elements' },
    { id: 't-9', name: 'Order tracking API', type: 'Backend', status: 'done', assignedStory: 'us-5', priority: 'Medium', description: 'Order status endpoint with history' },
    { id: 't-10', name: 'Tracking UI page', type: 'Frontend', status: 'todo', assignedStory: 'us-5', priority: 'Medium', description: 'Order details with timeline view' },
    { id: 't-11', name: 'Product admin CRUD', type: 'Backend', status: 'done', assignedStory: 'us-6', priority: 'High', description: 'Admin endpoints for product management' },
    { id: 't-12', name: 'Admin dashboard UI', type: 'Frontend', status: 'in-progress', assignedStory: 'us-6', priority: 'High', description: 'Product listing with edit modal' },
  ],
  decisions: [
    { stage: 'Stage 0: Intent Capture', decision: 'Domain identified as e-commerce platform', timestamp: '8m ago' },
    { stage: 'Stage 2: Actor Discovery', decision: '5 actors approved with Admin role management addition', timestamp: '5m ago' },
    { stage: 'Stage 3: Capabilities', decision: '8 capabilities mapped across all actors', timestamp: '4m ago' },
    { stage: 'Stage 4: Use Cases', decision: '12 use cases generated with 1 warning on RBAC', timestamp: '3m ago' },
    { stage: 'Stage 7: Blueprint Assembly', decision: 'Blueprint validated with 96/100 score', timestamp: '2m ago' },
  ],
  techStack: ['React 19', 'TypeScript', 'Node.js', 'PostgreSQL', 'Redis', 'Stripe SDK', 'Elasticsearch'],
  infrastructure: ['AWS ECS', 'RDS', 'ElastiCache', 'S3', 'CloudFront', 'Route 53'],
  rbac: ['Customer', 'Admin', 'Vendor', 'Guest'],
};

const validationCategories = [
  { name: 'Actor Completeness', score: 100, status: 'validated' as ValidationStatus },
  { name: 'Capability Coverage', score: 92, status: 'validated' as ValidationStatus },
  { name: 'Use Case Validity', score: 88, status: 'warning' as ValidationStatus },
  { name: 'Story Traceability', score: 95, status: 'validated' as ValidationStatus },
  { name: 'Task Decomposition', score: 100, status: 'validated' as ValidationStatus },
];

/* ------------------------------------------------------------------ */
/*  HELPER COMPONENTS                                                  */
/* ------------------------------------------------------------------ */

function StatusDot({ status, size = 'sm' }: { status: ValidationStatus; size?: 'sm' | 'md' }) {
  const config = {
    validated: { color: '#39FF14', icon: CheckCircle2 },
    warning: { color: '#FFB800', icon: AlertTriangle },
    error: { color: '#FF3366', icon: XCircle },
    pending: { color: '#4A6487', icon: Circle },
  };
  const c = config[status];
  const Icon = c.icon;
  const s = size === 'sm' ? 12 : 16;
  return <Icon size={s} style={{ color: c.color }} className="flex-shrink-0" />;
}

function StatusBadge({ status, label }: { status: ValidationStatus; label?: string }) {
  const config = {
    validated: { bg: 'bg-[rgba(57,255,20,0.1)]', text: 'text-[#39FF14]', border: 'border-[rgba(57,255,20,0.3)]', default: 'Validated' },
    warning: { bg: 'bg-[rgba(255,184,0,0.1)]', text: 'text-[#FFB800]', border: 'border-[rgba(255,184,0,0.3)]', default: 'Deferred' },
    error: { bg: 'bg-[rgba(255,51,102,0.1)]', text: 'text-[#FF3366]', border: 'border-[rgba(255,51,102,0.3)]', default: 'Incomplete' },
    pending: { bg: 'bg-[rgba(74,100,135,0.1)]', text: 'text-[#4A6487]', border: 'border-[rgba(74,100,135,0.3)]', default: 'Pending' },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${c.bg} ${c.text} ${c.border} text-xs font-body-sm`}>
      <StatusDot status={status} size="sm" />
      {label || c.default}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  VALIDATION SCORE RING                                              */
/* ------------------------------------------------------------------ */

function ProgressRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? '#39FF14' : score >= 70 ? '#FFB800' : '#FF3366';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(10,22,40,0.6)"
          strokeWidth={6}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display-lg text-lg" style={{ color, fontSize: score >= 100 ? 16 : 20 }}>
          {score}
        </span>
        <span className="font-body-sm text-[#4A6487] text-[9px]">/ 100</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TABS                                                               */
/* ------------------------------------------------------------------ */

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'actors', label: 'Actors' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'useCases', label: 'Use Cases' },
  { id: 'stories', label: 'Stories' },
  { id: 'tasks', label: 'Tasks' },
];

/* ------------------------------------------------------------------ */
/*  TAB CONTENT: OVERVIEW                                              */
/* ------------------------------------------------------------------ */

function OverviewTab({ blueprint }: { blueprint: ProjectBlueprint }) {
  const totalFields = 48;
  const filledFields = 46;
  const completenessPct = Math.round((filledFields / totalFields) * 100);

  return (
    <div className="space-y-6">
      {/* Blueprint Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
        className="glass-bordered rounded-xl p-6"
      >
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <h3 className="font-heading-lg text-[#E8F0FE] text-xl mb-1">{blueprint.name}</h3>
            <p className="font-body-md text-[#8BA4C7] text-sm">{blueprint.description}</p>
          </div>
          <StatusBadge status={blueprint.status} />
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-body-sm text-[#4A6487] text-xs">
            Generated {blueprint.generatedAt}
          </span>
          <span className="text-[#4A6487]">|</span>
          <span className="font-mono-sm text-[#4A6487] text-xs">
            Pipeline run #{blueprint.pipelineRun}
          </span>
          <span className="text-[#4A6487]">|</span>
          <span className="font-body-sm text-[#4A6487] text-xs">
            v{blueprint.version}
          </span>
        </div>
      </motion.div>

      {/* Validation + Completeness Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Validation Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
          className="glass-frosted rounded-xl p-6"
        >
          <div className="flex items-center gap-4 mb-4">
            <ProgressRing score={blueprint.validationScore} />
            <div>
              <h4 className="font-heading-sm text-[#E8F0FE] text-sm mb-1">Validation Score</h4>
              <p className="font-body-sm text-[#4A6487] text-xs">
                {blueprint.validationScore >= 90
                  ? 'Blueprint is production-ready'
                  : blueprint.validationScore >= 70
                  ? 'Minor issues should be addressed'
                  : 'Significant issues require attention'}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {validationCategories.map((cat, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <StatusDot status={cat.status} size="sm" />
                  <span className="font-body-md text-[#E8F0FE] text-xs">{cat.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-[rgba(10,22,40,0.6)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${cat.score}%`,
                        background:
                          cat.score >= 90
                            ? '#39FF14'
                            : cat.score >= 70
                            ? '#FFB800'
                            : '#FF3366',
                      }}
                    />
                  </div>
                  <span className="font-mono-sm text-xs w-8 text-right" style={{
                    color: cat.score >= 90 ? '#39FF14' : cat.score >= 70 ? '#FFB800' : '#FF3366',
                  }}>
                    {cat.score}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Completeness Report */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
          className="glass-frosted rounded-xl p-6"
        >
          <h4 className="font-heading-sm text-[#E8F0FE] text-sm mb-4">Completeness Report</h4>
          <div className="flex items-center gap-4 mb-4">
            <ProgressRing score={completenessPct} />
            <div>
              <p className="font-mono-lg text-[#00F5FF] text-lg">
                {filledFields}/{totalFields}
              </p>
              <p className="font-body-sm text-[#4A6487] text-xs">fields completed</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Actors', filled: 5, total: 5 },
              { label: 'Capabilities', filled: 8, total: 8 },
              { label: 'Use Cases', filled: 5, total: 5 },
              { label: 'Stories', filled: 8, total: 8 },
              { label: 'Tasks', filled: 12, total: 12 },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="font-body-md text-[#8BA4C7] text-xs">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-[rgba(10,22,40,0.6)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#00F5FF]"
                      style={{ width: `${(item.filled / item.total) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono-sm text-[#4A6487] text-[10px] w-10 text-right">
                    {item.filled}/{item.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Statistics Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          { label: 'Actors', count: blueprint.actors.length, icon: Users, color: '#00F5FF' },
          { label: 'Capabilities', count: blueprint.capabilities.length, icon: Zap, color: '#7B2FFF' },
          { label: 'Use Cases', count: blueprint.useCases.length, icon: GitBranch, color: '#39FF14' },
          { label: 'Tasks', count: blueprint.tasks.length, icon: CheckSquare, color: '#4A6487' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.06, duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
            className="glass-frosted rounded-lg p-4 hover:shadow-glow-cyan transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={22} style={{ color: stat.color }} />
              <span className="font-mono-lg text-xl" style={{ color: stat.color }}>
                {stat.count}
              </span>
            </div>
            <p className="font-body-sm text-[#4A6487] text-xs">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Decision Ledger */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
        className="glass-clear rounded-xl p-6"
      >
        <h4 className="font-heading-sm text-[#E8F0FE] text-sm mb-4">Decision Ledger</h4>
        <div className="space-y-3">
          {blueprint.decisions.map((decision, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.05, duration: 0.25 }}
              className="flex items-start gap-3 py-2 px-3 rounded-md glass-clear"
            >
              <Check size={14} className="text-[#39FF14] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-body-md text-[#E8F0FE] text-xs">{decision.decision}</p>
                <p className="font-body-sm text-[#4A6487] text-[10px] mt-0.5">{decision.stage}</p>
              </div>
              <span className="font-body-sm text-[#4A6487] text-[10px] flex-shrink-0">{decision.timestamp}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Pipeline Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
        className="glass-clear rounded-xl p-6"
      >
        <h4 className="font-heading-sm text-[#E8F0FE] text-sm mb-3">Pipeline Summary</h4>
        <p className="font-body-md text-[#8BA4C7] text-xs mb-3">
          Generated through all 8 stages in sequence
        </p>
        <div className="flex items-center gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  i < blueprint.stagesCompleted
                    ? 'bg-[rgba(57,255,20,0.15)] border border-[rgba(57,255,20,0.3)]'
                    : 'bg-[rgba(10,22,40,0.4)] border border-[rgba(138,180,230,0.08)]'
                }`}
              >
                {i < blueprint.stagesCompleted ? (
                  <Check size={14} className="text-[#39FF14]" />
                ) : (
                  <span className="font-mono-sm text-[10px] text-[#4A6487]">{i}</span>
                )}
              </div>
              {i < 7 && (
                <div
                  className={`w-4 h-[2px] ${
                    i < blueprint.stagesCompleted - 1 ? 'bg-[#39FF14]' : 'bg-[rgba(138,180,230,0.08)]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB CONTENT: ACTORS                                                */
/* ------------------------------------------------------------------ */

function ActorsTab({ actors }: { actors: Actor[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {actors.map((actor, i) => (
        <motion.div
          key={actor.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
          className="glass-frosted rounded-xl p-5 hover:shadow-glow-cyan transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={22} className="text-[#00F5FF]" />
              <h4 className="font-heading-md text-[#E8F0FE] text-base">{actor.name}</h4>
            </div>
            <StatusDot status={actor.status} />
          </div>
          <span className="inline-block px-2 py-0.5 rounded border border-[rgba(0,245,255,0.2)] text-[#00F5FF] font-body-sm text-[10px] mb-3">
            ACTOR
          </span>
          <p className="font-body-md text-[#8BA4C7] text-xs leading-relaxed mb-4 line-clamp-3">
            {actor.description}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="glass-clear rounded-md p-2 text-center">
              <p className="font-body-sm text-[#4A6487] text-[10px] mb-0.5">Role</p>
              <p className="font-body-md text-[#E8F0FE] text-xs">{actor.role}</p>
            </div>
            <div className="glass-clear rounded-md p-2 text-center">
              <p className="font-body-sm text-[#4A6487] text-[10px] mb-0.5">Type</p>
              <p className="font-body-md text-[#E8F0FE] text-xs">{actor.type}</p>
            </div>
            <div className="glass-clear rounded-md p-2 text-center">
              <p className="font-body-sm text-[#4A6487] text-[10px] mb-0.5">Priority</p>
              <p className="font-body-md text-xs" style={{
                color: actor.priority === 'High' ? '#FF3366' : actor.priority === 'Medium' ? '#FFB800' : '#8BA4C7',
              }}>
                {actor.priority}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {actor.capabilities.map((cap, j) => (
              <span key={j} className="px-2 py-1 rounded glass-bordered text-[#8BA4C7] font-body-sm text-[10px]">
                {cap}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[rgba(138,180,230,0.06)]">
            <div className="flex items-center gap-4">
              <span className="font-mono-sm text-[10px] text-[#4A6487]">
                Stories: <span className="text-[#00F5FF]">{actor.storyCount}</span>
              </span>
              <span className="font-mono-sm text-[10px] text-[#4A6487]">
                Tasks: <span className="text-[#00F5FF]">{actor.taskCount}</span>
              </span>
            </div>
            <button className="flex items-center gap-1 text-[#00F5FF] font-body-sm text-[10px] hover:underline">
              View Details <ArrowRight size={10} />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB CONTENT: CAPABILITIES                                          */
/* ------------------------------------------------------------------ */

function CapabilitiesTab({ capabilities }: { capabilities: Capability[] }) {
  const grouped = capabilities.reduce<Record<string, Capability[]>>((acc, cap) => {
    if (!acc[cap.actorName]) acc[cap.actorName] = [];
    acc[cap.actorName].push(cap);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([actorName, caps], groupIdx) => (
        <motion.div
          key={actorName}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: groupIdx * 0.1, duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
          className="glass-clear rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-[#00F5FF]" />
            <h4 className="font-heading-sm text-[#E8F0FE] text-sm">{actorName}</h4>
            <span className="font-mono-sm text-[10px] text-[#4A6487]">({caps.length})</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {caps.map((cap, i) => (
              <motion.div
                key={cap.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIdx * 0.1 + i * 0.05, duration: 0.3 }}
                className="glass-bordered rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-[#7B2FFF]" />
                    <span className="font-heading-sm text-[#E8F0FE] text-xs">{cap.name}</span>
                  </div>
                  <StatusDot status={cap.status} size="sm" />
                </div>
                <p className="font-body-md text-[#8BA4C7] text-xs mb-2">{cap.description}</p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-body-sm text-[#4A6487] text-[10px]">Inputs:</span>
                  {cap.inputs.map((input, j) => (
                    <span key={j} className="font-mono-sm text-[10px] text-[#00F5FF] bg-[rgba(0,245,255,0.08)] px-1.5 py-0.5 rounded">
                      {input}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-body-sm text-[#4A6487] text-[10px]">Outputs:</span>
                  {cap.outputs.map((output, j) => (
                    <span key={j} className="font-mono-sm text-[10px] text-[#39FF14] bg-[rgba(57,255,20,0.08)] px-1.5 py-0.5 rounded">
                      {output}
                    </span>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-[rgba(138,180,230,0.06)]">
                  <span className="font-mono-sm text-[10px] text-[#4A6487]">
                    Use Cases: <span className="text-[#00F5FF]">{cap.useCaseCount}</span>
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB CONTENT: USE CASES                                             */
/* ------------------------------------------------------------------ */

function UseCasesTab({ useCases }: { useCases: UseCase[] }) {
  return (
    <div className="space-y-4">
      {useCases.map((uc, i) => (
        <motion.div
          key={uc.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
          className="glass-frosted rounded-xl p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <GitBranch size={18} className="text-[#39FF14]" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-sm text-[10px] text-[#4A6487]">{uc.id}</span>
                  <h4 className="font-heading-sm text-[#E8F0FE] text-sm">{uc.name}</h4>
                </div>
                <p className="font-body-sm text-[#4A6487] text-[10px] mt-0.5">
                  Primary Actor: <span className="text-[#00F5FF]">{uc.primaryActor}</span>
                </p>
              </div>
            </div>
            <StatusDot status={uc.status} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="glass-clear rounded-md p-3">
              <p className="font-body-sm text-[#4A6487] text-[10px] mb-1">Preconditions</p>
              <p className="font-body-md text-[#E8F0FE] text-xs">{uc.preconditions}</p>
            </div>
            <div className="glass-clear rounded-md p-3">
              <p className="font-body-sm text-[#4A6487] text-[10px] mb-1">Postconditions</p>
              <p className="font-body-md text-[#E8F0FE] text-xs">{uc.postconditions}</p>
            </div>
          </div>
          <div className="glass-clear rounded-md p-3 mb-3">
            <p className="font-body-sm text-[#4A6487] text-[10px] mb-2">Main Flow</p>
            <ol className="space-y-1">
              {uc.mainFlow.map((step, j) => (
                <li key={j} className="flex items-start gap-2">
                  <span className="font-mono-sm text-[10px] text-[#00F5FF] w-4 flex-shrink-0">{j + 1}.</span>
                  <span className="font-body-md text-[#E8F0FE] text-xs">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-[rgba(138,180,230,0.06)]">
            <span className="font-mono-sm text-[10px] text-[#4A6487]">
              Stories: <span className="text-[#00F5FF]">{uc.storyCount}</span>
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB CONTENT: STORIES                                               */
/* ------------------------------------------------------------------ */

function StoriesTab({ stories }: { stories: Story[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {stories.map((story, i) => {
        const isExpanded = expandedId === story.id;
        return (
          <motion.div
            key={story.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className={`rounded-lg transition-all duration-200 ${
              isExpanded ? 'glass-frosted' : 'glass-clear hover:glass-tinted'
            }`}
          >
            <button
              onClick={() => setExpandedId(isExpanded ? null : story.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <StatusDot status={story.status} size="sm" />
              <span className="font-mono-sm text-[10px] text-[#4A6487] w-10 flex-shrink-0">{story.id}</span>
              <span className="font-body-sm text-[#4A6487] text-[10px] w-16 flex-shrink-0">As a</span>
              <span className="font-body-md text-[#E8F0FE] text-xs flex-1 min-w-0 truncate">{story.asA}</span>
              <span className="font-body-sm text-[#4A6487] text-[10px] w-16 flex-shrink-0 text-right">I want</span>
              <span className="font-body-md text-[#E8F0FE] text-xs flex-1 min-w-0 truncate hidden md:block">{story.iWant}</span>
              <ChevronRight
                size={14}
                className={`text-[#4A6487] flex-shrink-0 transition-transform duration-200 ${
                  isExpanded ? 'rotate-90' : ''
                }`}
              />
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-1 border-t border-[rgba(138,180,230,0.06)]">
                    <p className="font-body-md text-[#8BA4C7] text-xs mb-1">
                      <span className="text-[#4A6487]">I want</span> {story.iWant}
                    </p>
                    <p className="font-body-md text-[#8BA4C7] text-xs mb-3">
                      <span className="text-[#4A6487]">So that</span> {story.soThat}
                    </p>
                    <div>
                      <p className="font-body-sm text-[#4A6487] text-[10px] mb-2">Acceptance Criteria</p>
                      <ul className="space-y-1">
                        {story.acceptanceCriteria.map((criteria, j) => (
                          <li key={j} className="flex items-start gap-2">
                            <Check size={12} className="text-[#39FF14] mt-0.5 flex-shrink-0" />
                            <span className="font-body-md text-[#E8F0FE] text-xs">{criteria}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[rgba(138,180,230,0.06)]">
                      <span className="font-mono-sm text-[10px] text-[#4A6487]">
                        Tasks: <span className="text-[#00F5FF]">{story.taskCount}</span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TAB CONTENT: TASKS                                                 */
/* ------------------------------------------------------------------ */

function TasksTab({ tasks }: { tasks: Task[] }) {
  const [sortKey, setSortKey] = useState<keyof Task>('id');
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...tasks].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  const toggleSort = (key: keyof Task) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ colKey }: { colKey: keyof Task }) => (
    <span className={`inline-block ml-1 text-[10px] ${sortKey === colKey ? 'text-[#00F5FF]' : 'text-[#4A6487]'}`}>
      {sortKey === colKey ? (sortAsc ? '▲' : '▼') : '◆'}
    </span>
  );

  const typeColors: Record<string, string> = {
    Frontend: '#00F5FF',
    Backend: '#7B2FFF',
    DevOps: '#39FF14',
    Design: '#FFB800',
    Testing: '#FF3366',
  };

  const statusColors: Record<string, string> = {
    todo: '#4A6487',
    'in-progress': '#00F5FF',
    done: '#39FF14',
  };

  return (
    <div className="glass-frosted rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(138,180,230,0.08)]">
              {[
                { key: 'id' as const, label: 'ID' },
                { key: 'name' as const, label: 'Name' },
                { key: 'type' as const, label: 'Type' },
                { key: 'status' as const, label: 'Status' },
                { key: 'assignedStory' as const, label: 'Story' },
                { key: 'priority' as const, label: 'Priority' },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="text-left px-4 py-3 font-body-sm text-[#4A6487] text-[10px] uppercase tracking-wider cursor-pointer hover:text-[#00F5FF] transition-colors select-none"
                >
                  {col.label}
                  <SortIcon colKey={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((task, i) => (
              <motion.tr
                key={task.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-[rgba(138,180,230,0.04)] hover:bg-[rgba(16,36,65,0.2)] transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 font-mono-sm text-[10px] text-[#4A6487]">{task.id}</td>
                <td className="px-4 py-3">
                  <p className="font-body-md text-[#E8F0FE] text-xs">{task.name}</p>
                  <p className="font-body-sm text-[#4A6487] text-[10px] truncate max-w-[200px]">{task.description}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="font-body-sm text-[10px] px-2 py-0.5 rounded"
                    style={{
                      color: typeColors[task.type] || '#8BA4C7',
                      backgroundColor: `${typeColors[task.type] || '#8BA4C7'}15`,
                    }}
                  >
                    {task.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: statusColors[task.status] }}
                    />
                    <span className="font-body-sm text-[10px] capitalize" style={{ color: statusColors[task.status] }}>
                      {task.status.replace('-', ' ')}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 font-mono-sm text-[10px] text-[#00F5FF]">{task.assignedStory}</td>
                <td className="px-4 py-3">
                  <span
                    className="font-body-sm text-[10px]"
                    style={{
                      color: task.priority === 'High' ? '#FF3366' : task.priority === 'Medium' ? '#FFB800' : '#8BA4C7',
                    }}
                  >
                    {task.priority}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NAVIGATOR TREE                                                     */
/* ------------------------------------------------------------------ */

const entityIcons: Record<string, { icon: typeof Users; color: string }> = {
  project: { icon: FileCode, color: '#00F5FF' },
  actor: { icon: Users, color: '#00F5FF' },
  capability: { icon: Zap, color: '#7B2FFF' },
  useCase: { icon: GitBranch, color: '#39FF14' },
  story: { icon: BookOpen, color: '#FFB800' },
  task: { icon: CheckSquare, color: '#4A6487' },
};

interface TreeNode {
  id: string;
  label: string;
  type: string;
  count?: number;
  children?: TreeNode[];
}

const treeData: TreeNode[] = [
  {
    id: 'project',
    label: blueprint.name,
    type: 'project',
    children: [
      {
        id: 'actors',
        label: 'Actors',
        type: 'actor',
        count: blueprint.actors.length,
        children: blueprint.actors.map((a) => ({ id: a.id, label: a.name, type: 'actor' })),
      },
      {
        id: 'capabilities',
        label: 'Capabilities',
        type: 'capability',
        count: blueprint.capabilities.length,
        children: blueprint.capabilities.map((c) => ({ id: c.id, label: c.name, type: 'capability' })),
      },
      {
        id: 'useCases',
        label: 'Use Cases',
        type: 'useCase',
        count: blueprint.useCases.length,
        children: blueprint.useCases.map((u) => ({ id: u.id, label: u.name, type: 'useCase' })),
      },
      {
        id: 'stories',
        label: 'Stories',
        type: 'story',
        count: blueprint.stories.length,
        children: blueprint.stories.map((s) => ({ id: s.id, label: `${s.id}: ${s.asA}`, type: 'story' })),
      },
      {
        id: 'tasks',
        label: 'Tasks',
        type: 'task',
        count: blueprint.tasks.length,
        children: blueprint.tasks.map((t) => ({ id: t.id, label: `${t.id}: ${t.name}`, type: 'task' })),
      },
      {
        id: 'techStack',
        label: 'Tech Stack',
        type: 'capability',
        count: blueprint.techStack.length,
        children: blueprint.techStack.map((t, i) => ({ id: `tech-${i}`, label: t, type: 'capability' })),
      },
      {
        id: 'infrastructure',
        label: 'Infrastructure',
        type: 'capability',
        count: blueprint.infrastructure.length,
        children: blueprint.infrastructure.map((inf, i) => ({ id: `infra-${i}`, label: inf, type: 'capability' })),
      },
      {
        id: 'rbac',
        label: 'RBAC',
        type: 'actor',
        count: blueprint.rbac.length,
        children: blueprint.rbac.map((r, i) => ({ id: `rbac-${i}`, label: r, type: 'actor' })),
      },
    ],
  },
];

function TreeNodeComponent({
  node,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string;
  onSelect: (id: string) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const iconConf = entityIcons[node.type] || entityIcons.project;
  const Icon = iconConf.icon;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(node.id);
          if (hasChildren) onToggleExpand(node.id);
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 group ${
          isSelected
            ? 'glass-tinted border-l-[3px] border-l-[#00F5FF] text-text-glow'
            : 'hover:glass-clear text-[#8BA4C7] hover:text-[#E8F0FE]'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren && (
          <span onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}>
            {isExpanded ? (
              <ChevronDown size={14} className="text-[#4A6487] flex-shrink-0" />
            ) : (
              <ChevronRight size={14} className="text-[#4A6487] flex-shrink-0" />
            )}
          </span>
        )}
        {!hasChildren && <span className="w-[14px] flex-shrink-0" />}
        <Icon size={14} style={{ color: iconConf.color }} className="flex-shrink-0" />
        <span className={`font-body-md text-xs truncate flex-1 text-left ${isSelected ? 'text-text-glow' : ''}`}>
          {node.label}
        </span>
        {node.count !== undefined && (
          <span className="font-mono-sm text-[10px] text-[#4A6487] glass-bordered px-1.5 py-0.5 rounded-full flex-shrink-0">
            {node.count}
          </span>
        )}
      </button>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN BLUEPRINT PAGE                                                */
/* ------------------------------------------------------------------ */

export default function Blueprint() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedNodeId, setSelectedNodeId] = useState('project');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['project', 'actors', 'capabilities']));
  const [showValidation, setShowValidation] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [validationComplete, setValidationComplete] = useState(false);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleValidate = () => {
    setShowValidation(true);
    setValidationProgress(0);
    setValidationComplete(false);

    const interval = setInterval(() => {
      setValidationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setValidationComplete(true);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(blueprint, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${blueprint.name.replace(/\s+/g, '_').toLowerCase()}_blueprint.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-56px-40px)] -m-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] as [number, number, number, number] }}
        className="flex items-center justify-between px-6 py-3 border-b border-[rgba(138,180,230,0.08)] glass-frosted flex-shrink-0 flex-wrap gap-3"
      >
        <div className="flex items-center gap-3">
          <h2 className="font-display-md text-[#E8F0FE] text-xl">Blueprint Viewer</h2>
          <span className="font-body-sm text-[#4A6487] text-xs">{blueprint.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleValidate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-transparent border border-[rgba(0,245,255,0.3)] text-[#00F5FF] text-sm font-body-sm hover:border-[rgba(0,245,255,0.5)] hover:bg-[rgba(0,245,255,0.05)] transition-all duration-200"
          >
            <ShieldCheck size={14} />
            Validate
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[rgba(10,22,40,0.3)] border border-[rgba(138,180,230,0.08)] text-[#8BA4C7] text-sm font-body-sm hover:bg-[rgba(10,22,40,0.5)] hover:text-[#E8F0FE] transition-all duration-200"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </motion.div>

      {/* Validation Modal */}
      <AnimatePresence>
        {showValidation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(5, 10, 20, 0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => { if (validationComplete) { setShowValidation(false); setValidationComplete(false); } }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
              className="glass-elevated rounded-2xl p-8 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {!validationComplete ? (
                <>
                  <h3 className="font-heading-md text-[#E8F0FE] text-lg mb-4">Validating Blueprint...</h3>
                  <div className="w-full h-2 bg-[rgba(10,22,40,0.6)] rounded-full overflow-hidden mb-4">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #00F5FF, #00D4E5)' }}
                      animate={{ width: `${validationProgress}%` }}
                      transition={{ duration: 0.15 }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {validationCategories.map((cat, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 py-1 transition-opacity duration-200 ${
                          validationProgress > (i + 1) * 16 ? 'opacity-100' : 'opacity-30'
                        }`}
                      >
                        {validationProgress > (i + 1) * 16 ? (
                          <Check size={14} className="text-[#39FF14]" />
                        ) : (
                          <Clock size={14} className="text-[#4A6487]" />
                        )}
                        <span className="font-mono-sm text-xs text-[#E8F0FE]">{cat.name}</span>
                        {validationProgress > (i + 1) * 16 && (
                          <span className="font-mono-sm text-[10px] ml-auto" style={{
                            color: cat.score >= 90 ? '#39FF14' : cat.score >= 70 ? '#FFB800' : '#FF3366',
                          }}>
                            {cat.score}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center mb-6">
                    <CheckCircle2 size={48} className="text-[#39FF14] mb-3" />
                    <h3 className="font-heading-md text-[#E8F0FE] text-lg mb-1">Validation Complete</h3>
                    <p className="font-body-sm text-[#8BA4C7] text-xs">Blueprint passed all checks</p>
                  </div>
                  <div className="flex items-center justify-center mb-6">
                    <ProgressRing score={96} size={100} />
                  </div>
                  <div className="space-y-2 mb-6">
                    {validationCategories.map((cat, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <StatusDot status={cat.status} size="sm" />
                          <span className="font-body-md text-[#E8F0FE] text-xs">{cat.name}</span>
                        </div>
                        <span className="font-mono-sm text-xs" style={{
                          color: cat.score >= 90 ? '#39FF14' : cat.score >= 70 ? '#FFB800' : '#FF3366',
                        }}>
                          {cat.score}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => { setShowValidation(false); setValidationComplete(false); }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-gradient-to-br from-[#00F5FF] to-[#00D4E5] text-[#050A14] font-body-sm text-sm shadow-[0_0_20px_rgba(0,245,255,0.2)] hover:shadow-[0_0_30px_rgba(0,245,255,0.35)] transition-all duration-200"
                  >
                    <Check size={16} />
                    Done
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Navigator Tree */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number] }}
          className="w-[280px] glass-clear border-r border-[rgba(138,180,230,0.08)] overflow-y-auto scrollbar-thin p-4 flex-shrink-0 hidden lg:block"
        >
          <div className="mb-4">
            <p className="font-heading-sm text-[#4A6487] text-[10px] uppercase tracking-wider mb-2">
              Blueprint Navigator
            </p>
          </div>
          {treeData.map((node) => (
            <TreeNodeComponent
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedNodeId}
              onSelect={setSelectedNodeId}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
            />
          ))}

          {/* Metadata */}
          <div className="mt-6 pt-4 border-t border-[rgba(138,180,230,0.08)]">
            <p className="font-heading-sm text-[#4A6487] text-[10px] uppercase tracking-wider mb-3">
              Metadata
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-body-sm text-[#4A6487] text-[10px]">Version</span>
                <span className="font-mono-sm text-[10px] text-[#E8F0FE]">{blueprint.version}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body-sm text-[#4A6487] text-[10px]">Stages</span>
                <span className="font-mono-sm text-[10px] text-[#39FF14]">
                  {blueprint.stagesCompleted}/{blueprint.totalStages}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body-sm text-[#4A6487] text-[10px]">Score</span>
                <span className="font-mono-sm text-[10px] text-[#00F5FF]">{blueprint.validationScore}%</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right: Content Panel */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Background grid pattern for blueprint motif */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(0,245,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.06) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative z-10 p-6">
            {/* Tab Bar */}
            <div className="flex items-center gap-1 mb-6 border-b border-[rgba(138,180,230,0.08)] overflow-x-auto scrollbar-thin">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 font-body-md text-sm whitespace-nowrap transition-all duration-200 relative ${
                    activeTab === tab.id
                      ? 'text-[#E8F0FE]'
                      : 'text-[#4A6487] hover:text-[#8BA4C7]'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="blueprint-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00F5FF]"
                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                {activeTab === 'overview' && <OverviewTab blueprint={blueprint} />}
                {activeTab === 'actors' && <ActorsTab actors={blueprint.actors} />}
                {activeTab === 'capabilities' && <CapabilitiesTab capabilities={blueprint.capabilities} />}
                {activeTab === 'useCases' && <UseCasesTab useCases={blueprint.useCases} />}
                {activeTab === 'stories' && <StoriesTab stories={blueprint.stories} />}
                {activeTab === 'tasks' && <TasksTab tasks={blueprint.tasks} />}
              </motion.div>
            </AnimatePresence>

            {/* Export Section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="mt-8 pt-6 border-t border-[rgba(138,180,230,0.08)]"
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="font-heading-sm text-[#E8F0FE] text-sm mb-1">Export Blueprint</h4>
                  <p className="font-body-sm text-[#4A6487] text-xs">
                    Download the complete blueprint as a JSON file
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-transparent border border-[rgba(0,245,255,0.3)] text-[#00F5FF] font-body-sm text-sm hover:border-[rgba(0,245,255,0.5)] hover:bg-[rgba(0,245,255,0.05)] transition-all duration-200"
                >
                  <Download size={16} />
                  Export as JSON
                </button>
              </div>
            </motion.div>

            {/* Stage 7 Gate Status */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
              className="mt-6 glass-frosted rounded-xl p-5 border-t-2 border-t-[#39FF14]"
            >
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 size={20} className="text-[#39FF14]" />
                <h4 className="font-heading-sm text-[#E8F0FE] text-sm">Stage 7 Gate — Blueprint Assembly</h4>
                <StatusBadge status="validated" />
              </div>
              <p className="font-body-md text-[#8BA4C7] text-xs mb-3">
                All 8 pipeline stages have completed successfully. The blueprint has been validated and is ready for export or deployment.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { icon: Server, label: 'API Server', status: 'Ready' },
                  { icon: Database, label: 'Database Schema', status: 'Defined' },
                  { icon: Lock, label: 'Auth & RBAC', status: 'Configured' },
                  { icon: Globe, label: 'REST API', status: 'Documented' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 glass-clear rounded-md">
                    <item.icon size={12} className="text-[#39FF14]" />
                    <span className="font-body-sm text-[#E8F0FE] text-[10px]">{item.label}</span>
                    <span className="font-mono-sm text-[10px] text-[#39FF14]">{item.status}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
