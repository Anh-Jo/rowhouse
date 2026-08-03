import * as Tabs from '@radix-ui/react-tabs';
import './TabFilter.css';

function TabFilter({ tabs, value, onValueChange, className }: TabFilterProps) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <Tabs.List className={`tab-filter${className ? ` ${className}` : ''}`}>
        {tabs.map((tab) => (
          <Tabs.Trigger key={tab.value} value={tab.value} className="tab-filter__tab">
            <span>{tab.label}</span>
            {tab.count != null && <span className="tab-filter__badge">{tab.count}</span>}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}

export { TabFilter };
