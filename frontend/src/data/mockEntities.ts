export type EntityType = 'actor' | 'capability' | 'use-case' | 'story' | 'task';

export type ActorType = 'human' | 'system' | 'external';
export type EntityStatus = 'generated' | 'validated' | 'modified' | 'rejected';

export interface BaseEntity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  tags: string[];
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Actor extends BaseEntity {
  type: 'actor';
  actorType: ActorType;
  role: string;
  responsibilities: string[];
}

export interface Capability extends BaseEntity {
  type: 'capability';
  linkedActors: string[];
  features: string[];
}

export interface UseCase extends BaseEntity {
  type: 'use-case';
  linkedCapabilities: string[];
  preconditions: string[];
  postconditions: string[];
}

export interface UserStory extends BaseEntity {
  type: 'story';
  linkedUseCase: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface Task extends BaseEntity {
  type: 'task';
  linkedStory: string;
  estimatedHours: number;
  dependencies: string[];
  assignee: string;
}

export type Entity = Actor | Capability | UseCase | UserStory | Task;

/* ─── actors ─── */
const actors: Actor[] = [
  {
    id: 'actor-1', name: 'System Administrator', type: 'actor', actorType: 'human',
    description: 'Responsible for system configuration, user management, monitoring infrastructure health and ensuring security compliance across all environments.',
    role: 'Infrastructure Guardian', status: 'validated', tags: ['admin', 'security', 'infrastructure'],
    responsibilities: ['Manage users and roles', 'Monitor system health', 'Configure security policies'],
    createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-06-20T14:30:00Z',
  },
  {
    id: 'actor-2', name: 'Payment Gateway API', type: 'actor', actorType: 'external',
    description: 'External payment processing service that handles credit card transactions, refunds, and payment method verification.',
    role: 'Payment Processor', status: 'validated', tags: ['payment', 'external', 'api'],
    responsibilities: ['Process payments', 'Handle refunds', 'Verify payment methods'],
    createdAt: '2024-01-16T09:00:00Z', updatedAt: '2024-05-10T11:00:00Z',
  },
  {
    id: 'actor-3', name: 'Authentication Service', type: 'actor', actorType: 'system',
    description: 'Core identity and access management system handling user authentication, token generation, session management, and SSO integration.',
    role: 'Identity Provider', status: 'modified', tags: ['auth', 'system', 'security', 'sso'],
    responsibilities: ['Authenticate users', 'Generate tokens', 'Manage sessions', 'SSO integration'],
    createdAt: '2024-02-01T08:00:00Z', updatedAt: '2024-07-01T09:00:00Z',
  },
  {
    id: 'actor-4', name: 'End Customer', type: 'actor', actorType: 'human',
    description: 'The primary user of the platform who browses products, manages their profile, places orders, and tracks deliveries.',
    role: 'Platform User', status: 'validated', tags: ['customer', 'frontend', 'mobile'],
    responsibilities: ['Browse catalog', 'Manage profile', 'Place orders', 'Track deliveries'],
    createdAt: '2024-01-10T12:00:00Z', updatedAt: '2024-04-15T16:00:00Z',
  },
  {
    id: 'actor-5', name: 'Inventory Bot', type: 'actor', actorType: 'system',
    description: 'Automated system agent that monitors stock levels, triggers reorder alerts, and synchronizes inventory across warehouses.',
    role: 'Stock Monitor', status: 'generated', tags: ['inventory', 'automation', 'system'],
    responsibilities: ['Monitor stock levels', 'Trigger reorder alerts', 'Sync across warehouses'],
    createdAt: '2024-03-01T10:00:00Z', updatedAt: '2024-03-01T10:00:00Z',
  },
];

/* ─── capabilities ─── */
const capabilities: Capability[] = [
  {
    id: 'cap-1', name: 'User Authentication', type: 'capability',
    description: 'Complete authentication framework supporting multiple methods including password-based, OTP, biometric, and third-party OAuth providers.',
    linkedActors: ['actor-3', 'actor-4'], features: ['Login/Logout', 'Multi-factor auth', 'Password reset', 'OAuth 2.0', 'Session management'],
    status: 'validated', tags: ['auth', 'security', 'core'],
    createdAt: '2024-01-20T10:00:00Z', updatedAt: '2024-06-25T14:00:00Z',
  },
  {
    id: 'cap-2', name: 'Payment Processing', type: 'capability',
    description: 'End-to-end payment handling system supporting multiple payment methods, currencies, and compliance with PCI-DSS standards.',
    linkedActors: ['actor-2', 'actor-4'], features: ['Credit card processing', 'Digital wallets', 'Recurring billing', 'Refund handling', 'Invoice generation'],
    status: 'validated', tags: ['payment', 'financial', 'pci-dss'],
    createdAt: '2024-01-22T09:00:00Z', updatedAt: '2024-05-20T11:00:00Z',
  },
  {
    id: 'cap-3', name: 'Product Catalog', type: 'capability',
    description: 'Centralized product information management with support for categories, variants, pricing tiers, and rich media assets.',
    linkedActors: ['actor-4', 'actor-5'], features: ['Category management', 'Product variants', 'Dynamic pricing', 'Asset management', 'Search indexing'],
    status: 'modified', tags: ['catalog', 'products', 'search'],
    createdAt: '2024-02-05T08:30:00Z', updatedAt: '2024-07-02T10:00:00Z',
  },
  {
    id: 'cap-4', name: 'Order Management', type: 'capability',
    description: 'Full lifecycle order handling from cart through checkout, fulfillment, shipping, and delivery confirmation.',
    linkedActors: ['actor-4', 'actor-1'], features: ['Cart management', 'Checkout flow', 'Fulfillment', 'Shipping integration', 'Order tracking'],
    status: 'generated', tags: ['orders', 'fulfillment', 'core'],
    createdAt: '2024-02-10T11:00:00Z', updatedAt: '2024-02-10T11:00:00Z',
  },
  {
    id: 'cap-5', name: 'Notification Engine', type: 'capability',
    description: 'Multi-channel notification system delivering messages via email, SMS, push, and in-app with template management and scheduling.',
    linkedActors: ['actor-1', 'actor-3'], features: ['Email templates', 'SMS gateway', 'Push notifications', 'In-app alerts', 'Scheduling'],
    status: 'generated', tags: ['notifications', 'messaging', 'core'],
    createdAt: '2024-03-10T09:00:00Z', updatedAt: '2024-03-10T09:00:00Z',
  },
];

/* ─── use cases ─── */
const useCases: UseCase[] = [
  {
    id: 'uc-1', name: 'User Login Flow', type: 'use-case',
    description: 'End-to-end user authentication flow including credential validation, MFA challenge, session establishment, and redirect to requested resource.',
    linkedCapabilities: ['cap-1'], preconditions: ['User has registered account'], postconditions: ['User session is active', 'Activity log entry created'],
    status: 'validated', tags: ['auth', 'login', 'flow'],
    createdAt: '2024-02-01T10:00:00Z', updatedAt: '2024-06-15T12:00:00Z',
  },
  {
    id: 'uc-2', name: 'Guest Checkout', type: 'use-case',
    description: 'Allow unregistered users to complete purchases by providing minimal information, with optional account creation post-purchase.',
    linkedCapabilities: ['cap-2', 'cap-4'], preconditions: ['Products in cart', 'Shipping address provided'], postconditions: ['Order confirmed', 'Payment processed'],
    status: 'validated', tags: ['checkout', 'payment', 'guest'],
    createdAt: '2024-02-15T09:00:00Z', updatedAt: '2024-05-25T14:00:00Z',
  },
  {
    id: 'uc-3', name: 'Product Search & Filter', type: 'use-case',
    description: 'Users search the product catalog using keywords, apply filters for price range, category, brand, and ratings, then sort results.',
    linkedCapabilities: ['cap-3'], preconditions: ['Catalog is indexed'], postconditions: ['Search results displayed'],
    status: 'modified', tags: ['search', 'catalog', 'ux'],
    createdAt: '2024-03-01T11:00:00Z', updatedAt: '2024-07-03T09:00:00Z',
  },
  {
    id: 'uc-4', name: 'Order Tracking', type: 'use-case',
    description: 'Authenticated users view their order history, track shipment status in real-time, and receive automated delivery notifications.',
    linkedCapabilities: ['cap-4', 'cap-5'], preconditions: ['Order has been placed'], postconditions: ['Tracking info displayed', 'Notifications sent'],
    status: 'generated', tags: ['orders', 'tracking', 'notifications'],
    createdAt: '2024-03-15T10:00:00Z', updatedAt: '2024-03-15T10:00:00Z',
  },
];

/* ─── stories ─── */
const stories: UserStory[] = [
  {
    id: 'story-1', name: 'Login with email and password', type: 'story',
    description: 'As a registered user, I want to log in with my email and password so that I can access my account and personal dashboard.',
    linkedUseCase: 'uc-1', acceptanceCriteria: ['Valid credentials grant access', 'Invalid credentials show error', 'Session persists for 24h', 'Redirect to original URL post-login'],
    storyPoints: 5, priority: 'high', status: 'validated', tags: ['auth', 'login', 'frontend'],
    createdAt: '2024-02-10T10:00:00Z', updatedAt: '2024-06-10T12:00:00Z',
  },
  {
    id: 'story-2', name: 'Multi-factor authentication', type: 'story',
    description: 'As a security-conscious user, I want to enable MFA on my account so that my account is protected even if my password is compromised.',
    linkedUseCase: 'uc-1', acceptanceCriteria: ['User can enable/disable MFA', 'TOTP and SMS options available', 'Backup codes generated on setup', 'MFA challenge on every login when enabled'],
    storyPoints: 8, priority: 'critical', status: 'modified', tags: ['auth', 'mfa', 'security'],
    createdAt: '2024-02-12T09:00:00Z', updatedAt: '2024-07-04T10:00:00Z',
  },
  {
    id: 'story-3', name: 'Password reset via email', type: 'story',
    description: 'As a user who forgot their password, I want to reset it via email so that I can regain access to my account without contacting support.',
    linkedUseCase: 'uc-1', acceptanceCriteria: ['Reset link sent to registered email', 'Link expires after 1 hour', 'New password must meet strength requirements', 'Old password invalidated after reset'],
    storyPoints: 3, priority: 'high', status: 'validated', tags: ['auth', 'password', 'email'],
    createdAt: '2024-02-15T11:00:00Z', updatedAt: '2024-05-15T14:00:00Z',
  },
  {
    id: 'story-4', name: 'Credit card payment', type: 'story',
    description: 'As a customer, I want to pay with my credit card so that I can complete my purchase quickly and securely.',
    linkedUseCase: 'uc-2', acceptanceCriteria: ['Card number validated (Luhn)', 'CVV and expiry required', '3DS redirect handled', 'Success/failure toast shown'],
    storyPoints: 8, priority: 'critical', status: 'validated', tags: ['payment', 'checkout', 'frontend'],
    createdAt: '2024-03-01T10:00:00Z', updatedAt: '2024-05-30T12:00:00Z',
  },
  {
    id: 'story-5', name: 'Full-text product search', type: 'story',
    description: 'As a shopper, I want to search products by keyword so that I can quickly find items I am interested in purchasing.',
    linkedUseCase: 'uc-3', acceptanceCriteria: ['Search across name, description, tags', 'Results within 200ms', 'Auto-suggestions on type', 'No-results state shown'],
    storyPoints: 5, priority: 'high', status: 'generated', tags: ['search', 'catalog', 'performance'],
    createdAt: '2024-03-20T09:00:00Z', updatedAt: '2024-03-20T09:00:00Z',
  },
  {
    id: 'story-6', name: 'Real-time shipment tracking', type: 'story',
    description: 'As a customer, I want to see real-time updates on my shipment status so that I know when to expect delivery.',
    linkedUseCase: 'uc-4', acceptanceCriteria: ['Tracking map displayed', 'Status updates every 15 min', 'Push notification on status change', 'Delivery confirmation with photo'],
    storyPoints: 8, priority: 'medium', status: 'generated', tags: ['tracking', 'maps', 'real-time'],
    createdAt: '2024-04-01T10:00:00Z', updatedAt: '2024-04-01T10:00:00Z',
  },
];

/* ─── tasks ─── */
const tasks: Task[] = [
  {
    id: 'task-1', name: 'Implement login form UI', type: 'task',
    description: 'Build the login form component with email/password fields, validation, loading states, and error handling using the design system.',
    linkedStory: 'story-1', estimatedHours: 8, dependencies: [], assignee: 'Alex Chen',
    status: 'validated', tags: ['frontend', 'auth', 'ui'],
    createdAt: '2024-02-20T10:00:00Z', updatedAt: '2024-06-12T12:00:00Z',
  },
  {
    id: 'task-2', name: 'Integrate auth API endpoints', type: 'task',
    description: 'Connect frontend login flow to backend authentication API, handle JWT tokens, refresh logic, and session persistence.',
    linkedStory: 'story-1', estimatedHours: 12, dependencies: ['task-1'], assignee: 'Jordan Lee',
    status: 'validated', tags: ['frontend', 'api', 'auth'],
    createdAt: '2024-02-22T09:00:00Z', updatedAt: '2024-06-14T14:00:00Z',
  },
  {
    id: 'task-3', name: 'Set up MFA with TOTP', type: 'task',
    description: 'Implement time-based one-time password generation, QR code display for setup, and verification on login when MFA is enabled.',
    linkedStory: 'story-2', estimatedHours: 16, dependencies: ['task-2'], assignee: 'Sam Park',
    status: 'modified', tags: ['auth', 'security', 'mfa'],
    createdAt: '2024-02-25T10:00:00Z', updatedAt: '2024-07-05T09:00:00Z',
  },
  {
    id: 'task-4', name: 'Build password reset flow', type: 'task',
    description: 'Create forgot password form, email template for reset link, token validation page, and new password submission form.',
    linkedStory: 'story-3', estimatedHours: 10, dependencies: [], assignee: 'Alex Chen',
    status: 'validated', tags: ['auth', 'email', 'frontend'],
    createdAt: '2024-03-01T11:00:00Z', updatedAt: '2024-05-18T12:00:00Z',
  },
  {
    id: 'task-5', name: 'Integrate Stripe payment elements', type: 'task',
    description: 'Set up Stripe Elements for secure card input, handle payment intent creation, and implement 3D Secure authentication flow.',
    linkedStory: 'story-4', estimatedHours: 14, dependencies: [], assignee: 'Jordan Lee',
    status: 'validated', tags: ['payment', 'stripe', 'frontend'],
    createdAt: '2024-03-10T09:00:00Z', updatedAt: '2024-06-01T11:00:00Z',
  },
  {
    id: 'task-6', name: 'Implement Elasticsearch indexing', type: 'task',
    description: 'Configure Elasticsearch index mappings, implement document indexing pipeline, and set up search query builders with filters.',
    linkedStory: 'story-5', estimatedHours: 20, dependencies: [], assignee: 'Riley Kim',
    status: 'generated', tags: ['search', 'backend', 'elasticsearch'],
    createdAt: '2024-03-25T10:00:00Z', updatedAt: '2024-03-25T10:00:00Z',
  },
  {
    id: 'task-7', name: 'Create search UI with filters', type: 'task',
    description: 'Build the search results page with faceted filters, sorting options, pagination, and responsive grid layout for product cards.',
    linkedStory: 'story-5', estimatedHours: 16, dependencies: ['task-6'], assignee: 'Alex Chen',
    status: 'generated', tags: ['search', 'frontend', 'ui'],
    createdAt: '2024-03-28T09:00:00Z', updatedAt: '2024-03-28T09:00:00Z',
  },
  {
    id: 'task-8', name: 'Integrate shipping carrier API', type: 'task',
    description: 'Connect to FedEx/UPS APIs for real-time tracking data, normalize response formats, and implement webhook handlers for status updates.',
    linkedStory: 'story-6', estimatedHours: 18, dependencies: [], assignee: 'Sam Park',
    status: 'generated', tags: ['tracking', 'api', 'integration'],
    createdAt: '2024-04-05T10:00:00Z', updatedAt: '2024-04-05T10:00:00Z',
  },
];

export const allEntities: Entity[] = [...actors, ...capabilities, ...useCases, ...stories, ...tasks];

export function getEntitiesByType(type: EntityType): Entity[] {
  return allEntities.filter((e) => e.type === type);
}

export function getEntityById(id: string): Entity | undefined {
  return allEntities.find((e) => e.id === id);
}

export function searchEntities(query: string): Entity[] {
  const q = query.toLowerCase();
  return allEntities.filter((e) =>
    e.name.toLowerCase().includes(q) ||
    e.description.toLowerCase().includes(q) ||
    e.tags.some((t) => t.toLowerCase().includes(q))
  );
}

/* ─── Graph data for Visualizer ─── */

export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  data: Entity;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: 'depends_on' | 'triggers' | 'includes';
}

export const graphNodes: GraphNode[] = allEntities.map((e) => ({
  id: e.id,
  type: e.type,
  label: e.name,
  data: e,
}));

export const graphEdges: GraphEdge[] = [
  /* Actor → Capability relationships */
  { id: 'e-1', source: 'actor-3', target: 'cap-1', label: 'authenticates via', type: 'depends_on' },
  { id: 'e-2', source: 'actor-4', target: 'cap-1', label: 'uses', type: 'depends_on' },
  { id: 'e-3', source: 'actor-2', target: 'cap-2', label: 'processes', type: 'triggers' },
  { id: 'e-4', source: 'actor-4', target: 'cap-2', label: 'pays via', type: 'depends_on' },
  { id: 'e-5', source: 'actor-4', target: 'cap-3', label: 'browses', type: 'depends_on' },
  { id: 'e-6', source: 'actor-5', target: 'cap-3', label: 'manages', type: 'triggers' },
  { id: 'e-7', source: 'actor-4', target: 'cap-4', label: 'creates', type: 'depends_on' },
  { id: 'e-8', source: 'actor-1', target: 'cap-4', label: 'administers', type: 'depends_on' },
  { id: 'e-9', source: 'actor-3', target: 'cap-5', label: 'triggers', type: 'triggers' },
  { id: 'e-10', source: 'actor-1', target: 'cap-5', label: 'configures', type: 'depends_on' },

  /* Capability → Use Case relationships */
  { id: 'e-11', source: 'cap-1', target: 'uc-1', label: 'enables', type: 'enables' as never },
  { id: 'e-12', source: 'cap-2', target: 'uc-2', label: 'enables', type: 'enables' as never },
  { id: 'e-13', source: 'cap-4', target: 'uc-2', label: 'includes', type: 'includes' },
  { id: 'e-14', source: 'cap-3', target: 'uc-3', label: 'enables', type: 'enables' as never },
  { id: 'e-15', source: 'cap-4', target: 'uc-4', label: 'enables', type: 'enables' as never },
  { id: 'e-16', source: 'cap-5', target: 'uc-4', label: 'notifies', type: 'triggers' },

  /* Use Case → Story relationships */
  { id: 'e-17', source: 'uc-1', target: 'story-1', label: 'decomposes to', type: 'includes' },
  { id: 'e-18', source: 'uc-1', target: 'story-2', label: 'decomposes to', type: 'includes' },
  { id: 'e-19', source: 'uc-1', target: 'story-3', label: 'decomposes to', type: 'includes' },
  { id: 'e-20', source: 'uc-2', target: 'story-4', label: 'decomposes to', type: 'includes' },
  { id: 'e-21', source: 'uc-3', target: 'story-5', label: 'decomposes to', type: 'includes' },
  { id: 'e-22', source: 'uc-4', target: 'story-6', label: 'decomposes to', type: 'includes' },

  /* Story → Task relationships */
  { id: 'e-23', source: 'story-1', target: 'task-1', label: 'requires', type: 'depends_on' },
  { id: 'e-24', source: 'story-1', target: 'task-2', label: 'requires', type: 'depends_on' },
  { id: 'e-25', source: 'story-2', target: 'task-3', label: 'requires', type: 'depends_on' },
  { id: 'e-26', source: 'story-3', target: 'task-4', label: 'requires', type: 'depends_on' },
  { id: 'e-27', source: 'story-4', target: 'task-5', label: 'requires', type: 'depends_on' },
  { id: 'e-28', source: 'story-5', target: 'task-6', label: 'requires', type: 'depends_on' },
  { id: 'e-29', source: 'story-5', target: 'task-7', label: 'requires', type: 'depends_on' },
  { id: 'e-30', source: 'story-6', target: 'task-8', label: 'requires', type: 'depends_on' },

  /* Task dependencies */
  { id: 'e-31', source: 'task-1', target: 'task-2', label: 'blocks', type: 'depends_on' },
  { id: 'e-32', source: 'task-2', target: 'task-3', label: 'blocks', type: 'depends_on' },
  { id: 'e-33', source: 'task-6', target: 'task-7', label: 'blocks', type: 'depends_on' },
];
