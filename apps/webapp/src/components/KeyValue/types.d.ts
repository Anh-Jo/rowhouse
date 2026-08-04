type KeyValueItem = {
  label: string;
  value: React.ReactNode;
  /** Data voice (mono, tabular) — on by default; disable for prose values. */
  mono?: boolean;
};

type KeyValueProps = {
  items: KeyValueItem[];
  className?: string;
};
