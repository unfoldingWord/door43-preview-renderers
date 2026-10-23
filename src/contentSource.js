import JSZip from 'jszip';
import { fetchJson, fetchText } from './dcsApi.js';
import { ResourceError } from './errors.js';
import { dcsApiUrlOf } from './options.js';
import { burritoRevision, licenseIngredientPath } from './burrito.js';

/**
 * Where the extractors read a resource's files from.
 *
 * Every resource is read as a Scripture Burrito. Stage 2 reads from DCS, which
 * converts rc, ts and tc repositories to SB on the fly; getResourceDataFromDirectory()
 * reads burritos unpacked on disk. The extractors ask a content source for what
 * they need and do not know which one they have:
 *
 *   readMetadata(entry)    the burrito's metadata.json, parsed
 *   readFile(entry, path)  one file, by its path in the burrito (an ingredient
 *                          path such as `ingredients/TIT.tsv`)
 *   readArchive(entry)     the whole burrito, as a JSZip (or the same shape:
 *                          `files` keyed `<root folder>/<path>`, and `file(name)`
 *                          whose `async('string')` reads it)
 *
 * The entry is the resource's catalog entry, which names the repository.
 */

/** owner, repo and ref of a catalog entry (a blueprint row or a full entry). */
export function entryCoords(entry) {
  return {
    owner: entry.repo?.owner?.username || entry.repo?.owner?.login || entry.owner,
    repo: entry.repo?.name || entry.name,
    ref: entry.branch_or_tag_name || entry.ref,
  };
}

const stripDotSlash = (path) => String(path || '').replace(/^\.\//, '');

/** Defaults for a repository archive download: generous (the largest archive the
 * extractors read today, en_tw, is about 1 MB) but bounded. */
export const ARCHIVE_LIMITS = { maxBytes: 100 * 1024 * 1024, timeoutMs: 120000 };

/**
 * GET a URL as bytes with `fetch`, the same way in Node (18+) and the browser:
 *
 *  - `redirect: 'error'`: a redirect fails the request, so it cannot carry the
 *    download off the DCS host. (axios's `maxRedirects` is honored by its Node
 *    adapter only; browsers followed redirects.) DCS serves SB archives
 *    directly: a tag, a branch or a commit answers 200.
 *  - `maxBytes`: a declared Content-Length over the cap is refused before
 *    reading, and the body is read as a stream and cancelled as soon as it
 *    passes the cap, so no more than the cap (plus one chunk) is held.
 *  - `timeoutMs`: the request and the read are aborted after that long.
 *
 * @param {string} url
 * A failure is a ResourceError: the HTTP status (404 is NOT_FOUND), NETWORK when
 * there was no answer, INVALID_INPUT over the size cap.
 *
 * @param {{ maxBytes: number, timeoutMs: number }} limits
 * @returns {Promise<Uint8Array>}
 */
export async function downloadCapped(url, { maxBytes, timeoutMs }) {
  const tooLarge = () =>
    new ResourceError(`Archive ${url} is larger than ${maxBytes} bytes.`, {
      code: 'INVALID_INPUT',
      url,
    });
  const failed = (error) =>
    new ResourceError(
      `Could not download ${url}: ${error?.cause?.message || error?.message || error}`,
      { code: 'NETWORK', url, cause: error }
    );
  let response;
  try {
    response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw failed(error);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new ResourceError(`Could not download ${url}: HTTP ${response.status}`, {
      status: response.status,
      url,
    });
  }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw tooLarge();
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ResourceError) throw error;
    throw failed(error);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const enc = encodeURIComponent;
// A path or revision from metadata.json, as URL path segments. `.` and `..`
// would still walk the URL after encoding, so they are refused.
const encPath = (path) => {
  const parts = stripDotSlash(path).split('/');
  if (parts.some((part) => part === '.' || part === '..')) {
    throw new ResourceError(`Path ${JSON.stringify(path)} has a "." or ".." segment.`, {
      code: 'INVALID_INPUT',
    });
  }
  return parts.map(enc).join('/');
};
// `?ref=` for a ref; none reads the default branch.
const refQuery = (ref) => (ref ? `?ref=${enc(ref)}` : '');

/**
 * Read from DCS, as the burrito DCS converts the repository to:
 *
 *   metadata.json and single files  GET /repos/{owner}/{repo}/sb/raw/{path}?ref=
 *   the whole burrito                GET /repos/{owner}/{repo}/sb/{revision}.zip
 *
 * metadata.json is read at the catalog entry's ref once per entry object for
 * the life of this source (not just the request cache's TTL), and every later
 * read is pinned to the commit it names, so a branch that moves during a
 * render cannot mix two commits. Single files go through the request cache in dcsApi.js. The archive
 * URL is built from `dcsApiUrl`, so it is on the DCS host by construction; no
 * redirect is followed, and the download is limited in time and size (see
 * downloadCapped). Failures are ResourceErrors (a 404 is NOT_FOUND).
 *
 * @param {string} [dcsApiUrl='https://git.door43.org/api/v1']
 * @param {Object} [limits]
 * @param {number} [limits.maxBytes=ARCHIVE_LIMITS.maxBytes] - Largest archive accepted
 * @param {number} [limits.timeoutMs=ARCHIVE_LIMITS.timeoutMs] - Download time limit
 */
export function dcsContentSource(dcsApiUrl = 'https://git.door43.org/api/v1', limits = {}) {
  const limit = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);
  const maxBytes = limit(limits.maxBytes, ARCHIVE_LIMITS.maxBytes);
  const timeoutMs = limit(limits.timeoutMs, ARCHIVE_LIMITS.timeoutMs);
  const repoUrl = (entry) => {
    const { owner, repo } = entryCoords(entry);
    return `${dcsApiUrl}/repos/${enc(owner)}/${enc(repo)}`;
  };
  // entry -> its metadata.json. Kept for the source's life (one extraction, as
  // contentSourceFor makes one per call) so that a read after the request
  // cache's TTL still resolves the commit the extractor's metadata named. A
  // failure is forgotten so the next read retries.
  const pinned = new WeakMap();
  const readMetadata = (entry) => {
    if (pinned.has(entry)) return pinned.get(entry);
    const { owner, repo, ref } = entryCoords(entry);
    const url = `${repoUrl(entry)}/sb/raw/metadata.json${refQuery(ref)}`;
    const read = fetchJson(url).catch((error) => {
      pinned.delete(entry);
      throw ResourceError.wrap(`Failed to read the burrito of ${owner}/${repo}@${ref}`, error);
    });
    pinned.set(entry, read);
    return read;
  };
  // The commit to read at: the one metadata.json was converted from.
  const revision = async (entry) => {
    const { owner, repo, ref } = entryCoords(entry);
    return burritoRevision(await readMetadata(entry), owner, repo) || entry.commit_sha || ref;
  };
  return {
    readMetadata,
    async readFile(entry, path) {
      const url = `${repoUrl(entry)}/sb/raw/${encPath(path)}${refQuery(await revision(entry))}`;
      try {
        return await fetchText(url);
      } catch (error) {
        throw ResourceError.wrap(`Failed to read ${stripDotSlash(path)}`, error);
      }
    },
    async readArchive(entry) {
      const { owner, repo } = entryCoords(entry);
      const rev = await revision(entry);
      if (!rev) {
        throw new ResourceError(`No ref or commit to download ${owner}/${repo} at.`, {
          code: 'INVALID_INPUT',
        });
      }
      const url = `${repoUrl(entry)}/sb/${encPath(rev)}.zip`;
      return JSZip.loadAsync(await downloadCapped(url, { maxBytes, timeoutMs }));
    },
  };
}

/**
 * Read from burritos unpacked under one directory, one folder per repository
 * named as the catalog entry names it, each holding its metadata.json and
 * ingredients (`<dirPath>/en_tn/metadata.json`, `<dirPath>/en_tn/ingredients/TIT.tsv`):
 * a DCS SB archive (`/sb/{ref}.zip`) unzipped. Node only; `fs` is loaded on first use.
 *
 * Catalog entries and metadata.json files are not trusted, so neither are their
 * repository names and ingredient paths: a read never leaves the repository's
 * folder, by `..` or by a symlink, and never reads a dot entry such as `.git`,
 * whether as a file in the repository or as the repository itself. A
 * repository folder may be a symlink to a clone elsewhere (a "symlink farm"),
 * but not to a hidden folder inside the checkout directory.
 *
 * @param {string} dirPath
 */
export function directoryContentSource(dirPath) {
  let modules;
  const load = async () => {
    if (!modules) {
      // webpackIgnore: keep these Node modules out of browser bundles of
      // getResourceData (the demos); only this source, in Node, loads them.
      const [fs, path] = await Promise.all([
        import(/* webpackIgnore: true */ 'node:fs/promises'),
        import(/* webpackIgnore: true */ 'node:path'),
      ]);
      modules = { fs, path };
    }
    return modules;
  };
  const isInside = (path, root, target) => {
    const rel = path.relative(root, target);
    if (rel === '') return true;
    return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
  };
  const hasHiddenPart = (path, rel) => rel.split(path.sep).some((part) => part.startsWith('.'));
  // The repository's folder, resolved. Its name is one visible folder name, and
  // if it is a symlink to somewhere inside the checkout directory, that place
  // must not be hidden either (`en_tn` -> `.git`).
  const repoDir = async (entry) => {
    const { fs, path } = await load();
    const { repo } = entryCoords(entry);
    if (!repo) throw new Error('Catalog entry does not name its repository.');
    if (repo.startsWith('.') || /[\\/]/.test(repo)) {
      throw new Error(
        `Repository name ${JSON.stringify(repo)} is not a single, visible folder name.`
      );
    }
    const checkout = await fs.realpath(dirPath);
    const real = await fs.realpath(path.join(checkout, repo));
    if (isInside(path, checkout, real) && hasHiddenPart(path, path.relative(checkout, real))) {
      throw new Error(`Repository ${JSON.stringify(repo)} resolves to a hidden folder.`);
    }
    return real;
  };
  // The file at `relPath` in the repository, refused if it leaves the folder.
  const insideRepo = async (entry, relPath) => {
    const { fs, path } = await load();
    const parts = stripDotSlash(relPath).split(/[\\/]/);
    if (parts.some((part) => part === '..' || (part.startsWith('.') && part !== '.'))) {
      throw new Error(`Path ${JSON.stringify(relPath)} is outside the repository or hidden.`);
    }
    const root = await repoDir(entry);
    const lexical = path.resolve(root, ...parts);
    // realpath follows symlinks; it throws ENOENT for a file that is not there.
    const real = await fs.realpath(lexical);
    if (!isInside(path, root, lexical) || !isInside(path, root, real)) {
      throw new Error(`Path ${JSON.stringify(relPath)} leads outside the repository.`);
    }
    // The same rule for where a symlink lands: a clean name that points into
    // .git (or any hidden entry) is refused too.
    if (hasHiddenPart(path, path.relative(root, real))) {
      throw new Error(`Path ${JSON.stringify(relPath)} leads to a hidden file.`);
    }
    return real;
  };

  return {
    async readMetadata(entry) {
      const { fs } = await load();
      try {
        return JSON.parse(await fs.readFile(await insideRepo(entry, 'metadata.json'), 'utf8'));
      } catch (error) {
        throw ResourceError.wrap(`Failed to read the burrito of ${entryCoords(entry).repo}`, error);
      }
    },
    async readFile(entry, filePath) {
      const { fs } = await load();
      return fs.readFile(await insideRepo(entry, filePath), 'utf8');
    },
    async readArchive(entry) {
      const { fs, path } = await load();
      const dir = await repoDir(entry);
      const root = entryCoords(entry).repo;
      // The shape the extractors use from JSZip: every entry under the root
      // folder (folders end in '/'), and file(name) to read one.
      const files = { [`${root}/`]: { name: `${root}/`, dir: true } };
      // In the order DCS's SB archive lists them: each folder's entries by name,
      // in bytes, depth first (so `a/` comes before `a-b/`). Extractors that walk
      // the entries then build the same key order offline as online.
      const walk = async (absolute, relative) => {
        const items = (await fs.readdir(absolute, { withFileTypes: true })).sort((a, b) =>
          Buffer.compare(Buffer.from(a.name), Buffer.from(b.name))
        );
        for (const item of items) {
          if (item.name.startsWith('.')) continue; // .git and the like
          const name = `${root}/${relative}${item.name}`;
          if (item.isDirectory()) {
            files[`${name}/`] = { name: `${name}/`, dir: true };
            await walk(path.join(absolute, item.name), `${relative}${item.name}/`);
          } else if (item.isFile()) {
            files[name] = { name, dir: false };
          } else {
            // A symlink (or a filesystem that does not report the type): listed
            // when it is a file readFile would read, inside the repository and
            // not hidden. Symlinked folders are not followed.
            try {
              const target = await insideRepo(entry, `${relative}${item.name}`);
              if ((await fs.stat(target)).isFile()) files[name] = { name, dir: false };
            } catch {
              // Outside, hidden or dangling: not part of the repository.
            }
          }
        }
      };
      await walk(dir, '');
      return {
        files,
        file(name) {
          const found = files[name];
          if (!found || found.dir) return null;
          return {
            name,
            dir: false,
            // Only the text reads the extractors make; refuse the rest rather
            // than hand back a Node Buffer where JSZip would give another type.
            async: (type) =>
              type === 'string' || type === 'text'
                ? // Read through the same guard as readFile, resolved at read time.
                  insideRepo(entry, name.slice(root.length + 1)).then((target) =>
                    fs.readFile(target, 'utf8')
                  )
                : Promise.reject(new Error(`Unsupported read type ${JSON.stringify(type)}.`)),
          };
        },
      };
    },
  };
}

/**
 * A burrito's license (its license ingredient, e.g. `ingredients/LICENSE.md`),
 * trimmed; '' when it lists none or the file cannot be read. A missing license
 * never fails a render.
 *
 * @param {Object} source - A content source
 * @param {Object} entry - The resource's catalog entry
 * @returns {Promise<string>}
 */
export async function readLicense(source, entry) {
  const path = licenseIngredientPath(await source.readMetadata(entry));
  if (!path) return '';
  try {
    return (await source.readFile(entry, path)).trim();
  } catch {
    return '';
  }
}

/**
 * The content source the options name, or DCS at `dcsApiUrl` with the
 * archive limits `archiveMaxBytes` / `archiveTimeoutMs`.
 */
export function contentSourceFor(options = {}) {
  return (
    options.contentSource ||
    dcsContentSource(dcsApiUrlOf(options), {
      maxBytes: options.archiveMaxBytes,
      timeoutMs: options.archiveTimeoutMs,
    })
  );
}
