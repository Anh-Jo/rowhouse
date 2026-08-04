export function Placeholder({ name }: { name: string }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h2>{name}</h2>
      <p style={{ color: 'var(--color-text-secondary)' }}>Under construction</p>
    </div>
  );
}
