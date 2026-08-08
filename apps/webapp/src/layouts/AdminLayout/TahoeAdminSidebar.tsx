import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { Avatar } from '@/components/Avatar/Avatar';
import { signOut, useSession } from '@/api/auth-client';
import './TahoeAdminSidebar.css';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Home', end: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function TahoeAdminSidebar() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const user = session?.user;

  const handleSignOut = async () => {
    await signOut();
    navigate('/sign-in', { replace: true });
  };

  return (
    <aside className="tahoe-sidebar">
      <div className="tahoe-sidebar__header">
        <Avatar name="R" size="md" />
        <span className="tahoe-sidebar__brand">Rowhouse</span>
      </div>

      <nav className="tahoe-sidebar__nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-label={item.label}
            className={({ isActive }) =>
              `tahoe-sidebar__link${isActive ? ' tahoe-sidebar__link--active' : ''}`
            }
          >
            <item.icon size={18} />
            <span className="tahoe-sidebar__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="tahoe-sidebar__bottom">
        {user && (
          <div className="tahoe-sidebar__user">
            <Avatar name={user.name} size="sm" />
            <div className="tahoe-sidebar__user-info">
              <span className="tahoe-sidebar__label">{user.name}</span>
              <span className="tahoe-sidebar__user-email">{user.email}</span>
            </div>
          </div>
        )}
        <button
          type="button"
          className="tahoe-sidebar__logout"
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          <LogOut size={18} />
          <span className="tahoe-sidebar__label">Sign out</span>
        </button>
      </div>
    </aside>
  );
}

export { TahoeAdminSidebar };
