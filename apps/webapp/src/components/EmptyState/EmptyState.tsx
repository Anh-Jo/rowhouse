import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import './EmptyState.css';

type EmptyStateProps = {
  icon?: ReactNode;
  message: string;
  description?: string;
  className?: string;
};

function EmptyState({ icon, message, description, className }: EmptyStateProps) {
  return (
    <div className={`empty-state${className ? ` ${className}` : ''}`}>
      <div className="empty-state__icon">
        {icon ?? <Inbox size={48} />}
      </div>
      <span className="empty-state__message">{message}</span>
      {description && <span className="empty-state__desc">{description}</span>}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
