import { Outlet } from 'react-router-dom';
import { TahoeAdminSidebar } from './TahoeAdminSidebar';
import { useContentMode } from './route-handle';
import './AdminLayout.css';

function AdminLayout() {
  // Data views opt into full-bleed via their route handle (route-handle.ts):
  // the shell hands them the whole viewport instead of the readable column.
  const contentMode = useContentMode();
  return (
    <div
      className={`admin-layout${
        contentMode === 'full-bleed' ? ' admin-layout--full-bleed' : ''
      }`}
    >
      <TahoeAdminSidebar />
      <div className="admin-layout__main">
        <main className="admin-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export { AdminLayout };
