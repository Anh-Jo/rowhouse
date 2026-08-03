import './Avatar.css';

type AvatarProps = {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const initials = getInitials(name);
  const classes = ['avatar', `avatar--${size}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes} title={name}>
      {src ? (
        <img className="avatar__image" src={src} alt={name} />
      ) : (
        <span className="avatar__initials">{initials}</span>
      )}
    </div>
  );
}

export { Avatar };
