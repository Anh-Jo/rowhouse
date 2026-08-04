import './KeyValue.css';

/** Label/value pairs — record details, connection targets, metadata. */
function KeyValue({ items, className }: KeyValueProps) {
  return (
    <dl className={`key-value${className ? ` ${className}` : ''}`}>
      {items.map((item) => (
        <div className="key-value__row" key={item.label}>
          <dt className="key-value__label">{item.label}</dt>
          <dd className={`key-value__value${(item.mono ?? true) ? ' key-value__value--mono' : ''}`}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export { KeyValue };
