import { Outlet } from 'react-router-dom';
import { TahoeAdminSidebar } from './TahoeAdminSidebar';
import './AdminLayout.css';

function AdminLayout() {
  return (
    <div className="admin-layout">
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
