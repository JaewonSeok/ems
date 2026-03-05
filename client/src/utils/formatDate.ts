export function formatDate(input: Date | string) {
  const date = input instanceof Date ? input : new Date(input);
  return date.toISOString().slice(0, 10);
}
