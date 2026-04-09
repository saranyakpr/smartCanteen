import { buildCsv } from '@/lib/exports/csv';

describe('csv exports', () => {
  test('buildCsv escapes commas, quotes, and newlines', () => {
    const csv = buildCsv(
      [
        { key: 'name', label: 'Name' },
        { key: 'note', label: 'Note' },
      ],
      [
        { name: 'A, B', note: 'He said "hi".' },
        { name: 'Line break', note: 'Row 1\nRow 2' },
      ],
    );

    expect(csv).toContain('Name,Note');
    expect(csv).toContain('"A, B","He said ""hi""."');
    expect(csv).toContain('Line break,"Row 1\nRow 2"');
  });
});
