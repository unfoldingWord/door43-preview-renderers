import { EXAMPLE_GROUPS, ALL_EXAMPLES, exampleKey } from './demoExamples';

/**
 * The shared example picker for the styleguide demos. Dev-only.
 *
 * `variant: 'buttons'` (default) lays the groups out as rows of buttons —
 * for the demos whose whole point is "try every subject". `variant: 'select'`
 * is one compact dropdown for the demos where the live source is a side
 * input next to a fixture picker.
 *
 * `onPick(example)` receives the DemoExample ({ owner, repo, ref, books,
 * renderOptions? }); the demo decides what to do with it.
 */
export default function ExamplePicker({ onPick, variant = 'buttons', title }) {
  if (variant === 'select') {
    return (
      <select
        defaultValue=""
        onChange={(e) => {
          const example = ALL_EXAMPLES.find((ex) => exampleKey(ex) === e.target.value);
          if (example) onPick(example);
        }}
        style={{ padding: 8, maxWidth: 360 }}
        title="Fill the fields from an example"
      >
        <option value="" disabled>
          Pick an example…
        </option>
        {EXAMPLE_GROUPS.map(({ group, examples }) => (
          <optgroup key={group} label={group}>
            {examples.map((example) => (
              <option key={exampleKey(example)} value={exampleKey(example)}>
                {example.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  return (
    <div style={{ marginBottom: 20, padding: 15, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
      <strong>{title || 'Quick examples (every supported subject & metadata type):'}</strong>
      <div style={{ marginTop: 10 }}>
        {EXAMPLE_GROUPS.map(({ group, examples }) => (
          <div key={group} style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>{group}</strong>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {examples.map((example) => (
                <button
                  key={exampleKey(example)}
                  type="button"
                  onClick={() => onPick(example)}
                  title={`${example.owner}/${example.repo}/${example.ref}${
                    example.books ? ` (${example.books})` : ''
                  }${example.renderOptions ? ` ${JSON.stringify(example.renderOptions)}` : ''}${
                    example.options ? ` ${JSON.stringify(example.options)}` : ''
                  }`}
                  style={{ padding: '6px 10px', cursor: 'pointer' }}
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
