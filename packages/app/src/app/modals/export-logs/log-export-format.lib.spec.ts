import type { LogEntry } from '@bitbutler/shared';
import { renderLogFormatTemplate } from './log-export-format.lib';

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 7,
    timestamp: 1700000000,
    process: 'main',
    level: 'error',
    message: 'boom',
    context: 'ctx',
    filename: 'main.ts',
    line: 42,
    ...overrides,
  };
}

describe('renderLogFormatTemplate', () => {
  const dateFormatter = { format: vi.fn().mockReturnValue('2026-09-06 10:00') };

  beforeEach(() => {
    dateFormatter.format.mockClear();
  });

  it('substitutes every known token', () => {
    const result = renderLogFormatTemplate(
      '[{{date}}] [{{process}}] [{{level}}] ({{filename}}:{{line}}) - {{message}}',
      makeLog(),
      dateFormatter,
    );
    expect(result).toBe('[2026-09-06 10:00] [main] [error] (main.ts:42) - boom');
  });

  it('calls the date formatter with the entry timestamp', () => {
    renderLogFormatTemplate('{{date}}', makeLog({ timestamp: 123 }), dateFormatter);
    expect(dateFormatter.format).toHaveBeenCalledWith(123);
  });

  it('renders null filename, line and context as empty strings', () => {
    const result = renderLogFormatTemplate(
      '({{filename}}:{{line}}) {{context}}',
      makeLog({ filename: null, line: null, context: null }),
      dateFormatter,
    );
    expect(result).toBe('(:) ');
  });

  it('substitutes the id token', () => {
    const result = renderLogFormatTemplate('{{id}}', makeLog({ id: 99 }), dateFormatter);
    expect(result).toBe('99');
  });

  it('leaves an unrecognized token as-is', () => {
    const result = renderLogFormatTemplate('{{unknown}}', makeLog(), dateFormatter);
    expect(result).toBe('{{unknown}}');
  });

  it('tolerates extra whitespace inside the braces', () => {
    const result = renderLogFormatTemplate(
      '{{  message  }}',
      makeLog({ message: 'hi' }),
      dateFormatter,
    );
    expect(result).toBe('hi');
  });

  it('leaves a template with no placeholders unchanged', () => {
    const result = renderLogFormatTemplate('plain text', makeLog(), dateFormatter);
    expect(result).toBe('plain text');
  });
});
