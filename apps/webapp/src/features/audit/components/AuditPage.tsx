import { useInfiniteQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { FormError } from '@/components/FormError/FormError';
import { listAuditEvents, type AuditEventDto } from '@/api/audit';
import { auditKeys } from '@/api/query-keys';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import './AuditPage.css';

const ACTION_LABELS: Record<AuditEventDto['action'], string> = {
  CONNECTION_TEST: 'Connection test',
  INTROSPECT: 'Introspection',
  READ: 'Read',
};

/**
 * The visible face of the append-only audit log (transverse decision 3):
 * every statement executed against a connected database, newest first,
 * cursor-paginated.
 */
function AuditPage() {
  const { workspaceId } = useWorkspaceId();

  const query = useInfiniteQuery({
    queryKey: auditKeys.list(workspaceId ?? ''),
    queryFn: ({ pageParam }) =>
      listAuditEvents(workspaceId ?? '', {
        cursor: pageParam === '' ? undefined : pageParam,
      }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: workspaceId !== null,
  });

  if (workspaceId === null || query.isPending) {
    return null;
  }
  if (query.error) {
    return <FormError message={query.error.message} />;
  }

  const events = query.data.pages.flatMap((page) => page.items);

  return (
    <div className="audit-page">
      <header>
        <h1 className="audit-page__title">Audit log</h1>
        <p className="audit-page__subtitle">
          Every statement executed against your databases — append-only, no
          exceptions.
        </p>
      </header>

      {events.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={48} />}
          message="No activity yet"
          description="Connection tests and schema syncs will appear here as soon as they run."
        />
      ) : (
        <>
          <ul className="audit-page__events">
            {events.map((event) => (
              <li key={event.id} className="audit-page__event">
                <span className="audit-page__event-action">
                  {ACTION_LABELS[event.action]}
                </span>
                <span className="audit-page__event-badges">
                  {event.role && (
                    <Badge
                      label={event.role === 'READ_ONLY' ? 'read-only' : 'read-write'}
                      variant={event.role === 'READ_ONLY' ? 'muted' : 'warning'}
                    />
                  )}
                  <Badge
                    label={event.status}
                    variant={event.status === 'OK' ? 'success' : 'danger'}
                  />
                </span>
                <span className="audit-page__event-duration">
                  {event.durationMs} ms
                </span>
                <time
                  className="audit-page__event-date"
                  dateTime={event.createdAt}
                >
                  {new Date(event.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
          {query.hasNextPage && (
            <Button
              variant="secondary"
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export { AuditPage };
