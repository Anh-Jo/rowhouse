import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar/Avatar';
import './TahoeAdminSidebar.css';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Home', end: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function TahoeAdminSidebar() {
  return (
    <aside className="tahoe-sidebar">
      <div className="tahoe-sidebar__header">
        <Avatar name="S" size="md" />
        <span className="tahoe-sidebar__brand">Rowhouse</span>
      </div>

      <nav className="tahoe-sidebar__nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `tahoe-sidebar__link${isActive ? ' tahoe-sidebar__link--active' : ''}`
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export { TahoeAdminSidebar };
