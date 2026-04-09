type CsvCellValue = string | number | boolean | null | undefined;

export type CsvColumn<Row extends Record<string, CsvCellValue>> = {
  key: keyof Row & string;
  label: string;
};

function escapeCsv(value: CsvCellValue): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  const needsQuotes = /[",\n\r]/.test(text);
  const escaped = text.replaceAll('"', '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function buildCsv<Row extends Record<string, CsvCellValue>>(columns: Array<CsvColumn<Row>>, rows: Row[]): string {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsv(row[c.key])).join(','));
  return [header, ...lines].join('\n');
}

export function downloadCsv(params: { filename: string; csv: string }): void {
  const { filename, csv } = params;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

