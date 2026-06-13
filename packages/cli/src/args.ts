export function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function optionValues(args: string[], name: string): string[] {
  const index = args.indexOf(name);
  if (index === -1) return [];
  return args.slice(index + 1).filter((arg) => !arg.startsWith("--"));
}
