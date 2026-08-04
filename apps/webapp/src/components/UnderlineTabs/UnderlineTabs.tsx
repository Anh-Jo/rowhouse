import * as Tabs from '@radix-ui/react-tabs';
import './UnderlineTabs.css';

/**
 * Section switcher of a data story (map / chart / table). Underline rather than
 * pills: it sits on a rule, so it reads as a printed section index.
 */
function UnderlineTabs({ tabs, value, onValueChange, label, className }: UnderlineTabsProps) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <Tabs.List className={`underline-tabs${className ? ` ${className}` : ''}`} aria-label={label}>
        {tabs.map((tab) => (
          <Tabs.Trigger key={tab.value} value={tab.value} className="underline-tabs__tab">
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}

export { UnderlineTabs };
