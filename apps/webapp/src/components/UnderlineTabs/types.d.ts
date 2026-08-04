type UnderlineTabItem = {
  value: string;
  label: string;
};

type UnderlineTabsProps = {
  tabs: UnderlineTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name of the tab list, e.g. "Mode de lecture". */
  label?: string;
  className?: string;
};
