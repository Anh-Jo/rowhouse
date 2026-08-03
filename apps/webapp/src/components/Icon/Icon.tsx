import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  GitBranchPlus,
  Inbox,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Percent,
  Phone,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  Upload,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  GitBranchPlus,
  Inbox,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Percent,
  Phone,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  Upload,
  User,
  Users,
  Wallet,
  X,
};

type IconProps = {
  name: keyof typeof iconMap;
  size?: number;
  className?: string;
  color?: string;
};

function Icon({ name, size = 20, className, color }: IconProps) {
  const LucideIconComponent = iconMap[name];
  if (!LucideIconComponent) return null;
  return <LucideIconComponent size={size} className={className} color={color} />;
}

export { Icon };
export type { IconProps };
