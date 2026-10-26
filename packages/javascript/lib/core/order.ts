/**
 * Two strings by their UTF-16 code units, which is how the Dart package sorts
 * them and how the Python one is made to. `localeCompare` would follow the
 * collation of whatever locale the process runs in, so the same files could be
 * read and reported in a different order on another machine, and in a
 * different order from the other two packages.
 */
export const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
