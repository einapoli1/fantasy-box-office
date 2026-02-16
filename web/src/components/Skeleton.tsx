interface Props {
  lines?: number;
  height?: string;
  width?: string;
}

export function SkeletonLine({ height = '1rem', width = '100%' }: { height?: string; width?: string }) {
  return <div className="skeleton-line" style={{ height, width }} />;
}

export default function Skeleton({ lines = 3 }: Props) {
  return (
    <div className="skeleton">
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-line" style={{ height: '200px', width: '100%' }} />
      <SkeletonLine width="80%" />
      <SkeletonLine width="50%" />
    </div>
  );
}
