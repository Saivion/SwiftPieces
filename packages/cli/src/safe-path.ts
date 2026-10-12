import { closeSync, constants, lstatSync, mkdirSync, openSync, realpathSync, writeSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

/** A registry path would leave the directory the command was told to write into. */
export class PathEscapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathEscapeError";
  }
}

function isLexicalEscape(fromRoot: string): boolean {
  return fromRoot === "" || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot);
}

/**
 * Resolves `rel` against `root` and refuses absolute paths, `..`, and empty paths.
 * The result is lexical: symlinks are checked separately so a link cannot move the write.
 */
export function resolveInside(root: string, rel: string): string {
  if (typeof rel !== "string" || rel.length === 0 || rel.includes("\0")) {
    throw new PathEscapeError("Refusing to write an empty path.");
  }
  if (isAbsolute(rel) || /^[a-zA-Z]:[\\/]/.test(rel) || rel.startsWith("\\\\")) {
    throw new PathEscapeError(`Refusing an absolute path: ${rel}`);
  }
  const segments = rel.split(/[\\/]+/);
  if (segments.some((segment) => segment === "..")) {
    throw new PathEscapeError(`Refusing a path that leaves the destination: ${rel}`);
  }
  const cleaned = segments.filter((segment) => segment.length > 0 && segment !== ".");
  if (cleaned.length === 0) {
    throw new PathEscapeError("Refusing to write an empty path.");
  }
  const rootResolved = resolve(root);
  const dest = resolve(rootResolved, ...cleaned);
  if (isLexicalEscape(relative(rootResolved, dest))) {
    throw new PathEscapeError(`Refusing a path that leaves the destination: ${rel}`);
  }
  return dest;
}

function assertNoSymlink(path: string): void {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return;
  }
  if (stat.isSymbolicLink()) {
    throw new PathEscapeError(`Refusing to follow a symlink: ${path}`);
  }
}

/** Creates the destination root when it is missing. An existing symlink is refused. */
function ensureRoot(root: string): void {
  const rootResolved = resolve(root);
  try {
    const stat = lstatSync(rootResolved);
    if (stat.isSymbolicLink()) throw new PathEscapeError(`Refusing to follow a symlink: ${rootResolved}`);
    if (!stat.isDirectory()) throw new PathEscapeError(`Destination is not a directory: ${rootResolved}`);
  } catch (error) {
    if (error instanceof PathEscapeError) throw error;
    mkdirSync(rootResolved, { recursive: true, mode: 0o755 });
    const created = lstatSync(rootResolved);
    if (created.isSymbolicLink() || !created.isDirectory()) {
      throw new PathEscapeError(`Refusing to follow a symlink: ${rootResolved}`);
    }
  }
}

/**
 * Walks from `root` toward `dest`. An existing symlink on that walk is refused, and the real
 * path of the deepest existing directory must still be inside the real destination root.
 */
function assertNoSymlinkEscape(root: string, dest: string): void {
  const rootResolved = resolve(root);
  const rootReal = realpathSync(rootResolved);
  assertNoSymlink(rootResolved);

  let current = rootResolved;
  const rest = relative(rootResolved, dest);
  const parts = rest === "" ? [] : rest.split(sep);
  let deepestExisting = rootResolved;
  for (const part of parts) {
    current = resolve(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      break;
    }
    if (stat.isSymbolicLink()) {
      throw new PathEscapeError(`Refusing to follow a symlink: ${current}`);
    }
    deepestExisting = current;
  }

  const deepestReal = realpathSync(deepestExisting);
  const fromRoot = relative(rootReal, deepestReal);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new PathEscapeError("Refusing to follow a symlink out of the destination.");
  }
}

/** Creates `dir` (which must already be inside `root`) one segment at a time, never following a symlink. */
export function mkdirInside(root: string, dir: string): void {
  const dest = dir === resolve(root) ? resolve(root) : resolveInside(root, relative(resolve(root), dir));
  assertNoSymlinkEscape(root, dest);
  const rootResolved = resolve(root);
  const rest = relative(rootResolved, dest);
  if (rest === "") return;
  let current = rootResolved;
  for (const part of rest.split(sep)) {
    current = resolve(current, part);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) throw new PathEscapeError(`Refusing to follow a symlink: ${current}`);
      if (!stat.isDirectory()) throw new PathEscapeError(`Refusing to write through a file: ${current}`);
    } catch (error) {
      if (error instanceof PathEscapeError) throw error;
      mkdirSync(current, { mode: 0o755 });
      const created = lstatSync(current);
      if (created.isSymbolicLink() || !created.isDirectory()) {
        throw new PathEscapeError(`Refusing to follow a symlink: ${current}`);
      }
    }
  }
  assertNoSymlinkEscape(root, dest);
}

/** True when `dest` is an existing regular file inside `root`. A symlink is refused rather than treated as the file. */
export function existingRegularFile(root: string, rel: string): boolean {
  const dest = resolveInside(root, rel);
  try {
    lstatSync(resolve(root));
  } catch {
    return false;
  }
  assertNoSymlinkEscape(root, dest);
  try {
    const stat = lstatSync(dest);
    if (stat.isSymbolicLink()) throw new PathEscapeError(`Refusing to follow a symlink: ${dest}`);
    return stat.isFile();
  } catch (error) {
    if (error instanceof PathEscapeError) throw error;
    return false;
  }
}

/** Writes `content` at `rel` inside `root`. Creates parent directories. Does not follow symlinks. */
export function writeInside(root: string, rel: string, content: string): string {
  const dest = resolveInside(root, rel);
  ensureRoot(root);
  mkdirInside(root, dirname(dest));
  assertNoSymlinkEscape(root, dest);
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW;
  let fd: number;
  try {
    fd = openSync(dest, flags, 0o644);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ELOOP" || code === "EEXIST") throw new PathEscapeError(`Refusing to follow a symlink: ${dest}`);
    throw error;
  }
  try {
    writeSync(fd, Buffer.from(content, "utf8"));
  } finally {
    closeSync(fd);
  }
  return dest;
}
