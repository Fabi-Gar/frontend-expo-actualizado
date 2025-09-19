export type EmptyStateProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};
export default function EmptyState(_props: EmptyStateProps) { return null; }
