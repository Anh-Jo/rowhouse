type TabItem = {
  value: string;
  label: string;
  count?: number;
};

type TabFilterProps = {
  tabs: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
};
