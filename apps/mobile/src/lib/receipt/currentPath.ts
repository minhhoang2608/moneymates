let current: string | null = null;

/** Pathname of the screen the user is on, recorded by the root layout. Null before the first render. */
export function setCurrentPath(path: string | null): void {
  current = path;
}

export function getCurrentPath(): string | null {
  return current;
}
