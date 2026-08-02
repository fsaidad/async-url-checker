const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

export function formatDate(value: string): string {
  return formatter.format(new Date(value));
}
