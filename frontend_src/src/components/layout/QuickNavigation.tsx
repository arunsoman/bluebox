// =============================================================================
// QuickNavigation — Navigation links to sub-pages
// =============================================================================

import { Link, useParams } from 'react-router';
import { ClipboardList, Scale, ShieldCheck, RotateCcw, FileOutput } from 'lucide-react';

const navItems = [
  { label: 'Audit Trail', icon: ClipboardList, path: 'audit' },
  { label: 'Decisions', icon: Scale, path: 'decisions' },
  { label: 'RBAC', icon: ShieldCheck, path: 'rbac' },
  { label: 'Checkpoints', icon: RotateCcw, path: 'checkpoints' },
  { label: 'Export', icon: FileOutput, path: 'export' },
];

export default function QuickNavigation() {
  const { sessionId } = useParams<{ sessionId: string }>();

  if (!sessionId) return null;

  return (
    <div className="px-3 py-2">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Navigation
      </h3>
      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={`/pipeline/${sessionId}/${item.path}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <item.icon className="h-3.5 w-3.5 text-slate-500" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
