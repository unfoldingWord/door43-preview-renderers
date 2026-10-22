import JSZip from 'jszip';
import { fetchContent, fetchLicense } from './dcsApi.js';

/**
 * Where the extractors read a resource's files from.
 *
 * Stage 2 reads from DCS; getResourceDataFromDirectory() reads the same files
 * from repositories checked out on disk. The extractors ask a content source
 * for what they need and do not know which one they have:
 *
 *   readFile(entry, path)  one file, by its path in the repository (an ingredient path)
 *   readLicense(entry)     LICENSE.md, LICENSE or LICENSE.txt, trimmed; '' when none
 *   readArchive(entry)     the whole repository, as a JSZip (or the same shape:
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

const LICENSE_FILES = ['LICENSE.md', 'LICENSE', 'LICENSE.txt'];
const stripDotSlash = (path) => String(path || '').replace(/^\.\//, '');

/** Defaults for a repository archive download: generous (the largest archive the
 * extractors read today, en_tw, is about 1 MB) but bounded. */
export const ARCHIVE_LIMITS = { maxBytes: 100 * 1024 * 1024, timeoutMs: 120000 };

/**
 * GET a URL as bytes with `fetch`, the same way in Node (18+) and the browser:
 *
 *  - `redirect: 'error'`: a redirect fails the request, so it cannot carry the
 *    download off the host the caller checked. (axios's `maxRedirects` is honored
 *    by its Node adapter only; browsers followed redirects.) DCS serves archives
 *    directly: a tag, a branch or a commit answers 200, and the only redirect
 *    seen is http -> https, which the origin check already refuses.
 *  - `maxBytes`: a declared Content-Length over the cap is refused before
 *    reading, and the body is read as a stream and cancelled as soon as it
 *    passes the cap, so no more than the cap (plus one chunk) is held.
 *  - `timeoutMs`: the request and the read are aborted after that long.
 *
 * @param {string} url
 * @param {{ maxBytes: number, timeoutMs: number }} limits
 * @returns {Promise<Uint8Array>}
 */
export async function downloadCapped(url, { maxBytes, timeoutMs }) {
  const tooLarge = () => new Error(`Archive ${url} is larger than ${maxBytes} bytes.`);
  let response;
  try {
    response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const reason = error?.cause?.message || error?.message || String(error);
    throw new Error(`Could not download ${url}: ${reason}`);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Could not download ${url}: HTTP ${response.status}`);
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
    if (error?.message?.includes('is larger than')) throw error;
    throw new Error(`Could not download ${url}: ${error?.message || error}`);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Read from DCS: the contents API for a file (cached per URL), the repository
 * archive (`zipball_url`) for the whole tree.
 *
 * The archive URL comes from the catalog entry, so it is held to the DCS host
 * the caller configured: it must be on the origin of `dcs_api_url`, no redirect
 * is followed, and the download is limited in time and size (see downloadCapped).
 *
 * @param {string} [dcs_api_url='https://git.door43.org/api/v1']
 * @param {Object} [limits]
 * @param {number} [limits.maxBytes=ARCHIVE_LIMITS.maxBytes] - Largest archive accepted
 * @param {number} [limits.timeoutMs=ARCHIVE_LIMITS.timeoutMs] - Download time limit
 */
export function dcsContentSource(dcs_api_url = 'https://git.door43.org/api/v1', limits = {}) {
  const limit = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);
  const maxBytes = limit(limits.maxBytes, ARCHIVE_LIMITS.maxBytes);
  const timeoutMs = limit(limits.timeoutMs, ARCHIVE_LIMITS.timeoutMs);
  return {
    readFile(entry, path) {
      const { owner, repo, ref } = entryCoords(entry);
      return fetchContent(owner, repo, ref, stripDotSlash(path), dcs_api_url);
    },
    readLicense(entry) {
      const { owner, repo, ref } = entryCoords(entry);
      return fetchLicense(owner, repo, ref, dcs_api_url);
    },
    async readArchive(entry) {
      if (!entry.zipball_url) {
        throw new Error(`Catalog entry ${entryCoords(entry).repo} has no zipball_url.`);
      }
      let url;
      try {
        url = new URL(entry.zipball_url);
      } catch {
        throw new Error(`Archive URL ${JSON.stringify(entry.zipball_url)} is not a URL.`);
      }
      const host = new URL(dcs_api_url).origin;
      if (url.origin !== host) {
        throw new Error(`Archive URL ${url.href} is not on the DCS host ${host}.`);
      }
      return JSZip.loadAsync(await downloadCapped(url.href, { maxBytes, timeoutMs }));
    },
  };
}

/**
 * Read from repositories checked out under one directory, one folder per
 * repository named as the catalog entry names it (`<dirPath>/en_tn/tn_TIT.tsv`).
 * Node only; `fs` is loaded on first use.
 *
 * Catalog entries come from DCS or a saved file, so their repository names and
 * ingredient paths are not trusted: a read never leaves the repository's
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
    async readFile(entry, filePath) {
      const { fs } = await load();
      return fs.readFile(await insideRepo(entry, filePath), 'utf8');
    },
    async readLicense(entry) {
      const { fs } = await load();
      for (const name of LICENSE_FILES) {
        try {
          const text = await fs.readFile(await insideRepo(entry, name), 'utf8');
          if (text) return text.trim();
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error; // only a missing file means "try the next"
        }
      }
      return '';
    },
    async readArchive(entry) {
      const { fs, path } = await load();
      const dir = await repoDir(entry);
      const root = entryCoords(entry).repo;
      // The shape the extractors use from JSZip: every entry under the root
      // folder (folders end in '/'), and file(name) to read one.
      const files = { [`${root}/`]: { name: `${root}/`, dir: true } };
      // In git's tree order, as the DCS archive lists them: by bytes, a folder
      // compared as its name plus '/' (so `a-b/` comes before `a/`). Extractors
      // that walk the entries then build the same key order offline as online.
      const treeKey = (item) => Buffer.from(item.name + (item.isDirectory() ? '/' : ''));
      const walk = async (absolute, relative) => {
        const items = (await fs.readdir(absolute, { withFileTypes: true })).sort((a, b) =>
          Buffer.compare(treeKey(a), treeKey(b))
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
 * The content source the options name, or DCS at `dcs_api_url` with the
 * archive limits `archiveMaxBytes` / `archiveTimeoutMs`.
 */
export function contentSourceFor(options = {}) {
  return (
    options.contentSource ||
    dcsContentSource(options.dcs_api_url, {
      maxBytes: options.archiveMaxBytes,
      timeoutMs: options.archiveTimeoutMs,
    })
  );
}
