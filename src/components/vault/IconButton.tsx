import type { LucideIcon } from 'lucide-react';

interface IconButtonProps {
  icon: LucideIcon;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  variant?: 'ghost' | 'primary' | 'danger';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function IconButton({
  icon: Icon,
  onClick,
  title,
  variant = 'ghost',
  className = '',
  type = 'button',
}: IconButtonProps): React.ReactElement {
  const baseStyle = 'p-2 rounded-lg transition-all duration-200 active:scale-95';
  const variants = {
    ghost: 'text-fg-muted hover:text-accent hover:bg-accent-soft',
    primary: 'bg-accent text-accent-fg hover:opacity-90 shadow-sm',
    danger: 'text-fg-subtle hover:text-danger hover:bg-danger-soft',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
