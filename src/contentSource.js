import axios from 'axios';
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

/**
 * Read from DCS: the contents API for a file (cached per URL), the repository
 * archive (`zipball_url`) for the whole tree.
 *
 * @param {string} [dcs_api_url='https://git.door43.org/api/v1']
 */
export function dcsContentSource(dcs_api_url = 'https://git.door43.org/api/v1') {
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
      const response = await axios.get(entry.zipball_url, { responseType: 'arraybuffer' });
      return JSZip.loadAsync(response.data);
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
 * folder, by `..` or by a symlink, and never reads a dot entry such as `.git`.
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
  const repoDir = async (entry) => {
    const { path } = await load();
    const { repo } = entryCoords(entry);
    if (!repo) throw new Error('Catalog entry does not name its repository.');
    if (repo === '.' || repo === '..' || /[\\/]/.test(repo)) {
      throw new Error(`Repository name ${JSON.stringify(repo)} is not a single folder name.`);
    }
    return path.join(dirPath, repo);
  };
  const isInside = (path, root, target) => {
    const rel = path.relative(root, target);
    if (rel === '') return true;
    return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
  };
  // The file at `relPath` in the repository, refused if it leaves the folder.
  const insideRepo = async (entry, relPath) => {
    const { fs, path } = await load();
    const parts = stripDotSlash(relPath).split(/[\\/]/);
    if (parts.some((part) => part === '..' || (part.startsWith('.') && part !== '.'))) {
      throw new Error(`Path ${JSON.stringify(relPath)} is outside the repository or hidden.`);
    }
    const root = await fs.realpath(await repoDir(entry));
    const lexical = path.resolve(root, ...parts);
    // realpath follows symlinks; it throws ENOENT for a file that is not there.
    const real = await fs.realpath(lexical);
    if (!isInside(path, root, lexical) || !isInside(path, root, real)) {
      throw new Error(`Path ${JSON.stringify(relPath)} leads outside the repository.`);
    }
    // The same rule for where a symlink lands: a clean name that points into
    // .git (or any hidden entry) is refused too.
    if (
      path
        .relative(root, real)
        .split(path.sep)
        .some((part) => part.startsWith('.'))
    ) {
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
          }
        }
      };
      await walk(dir, '');
      return {
        files,
        file(name) {
          const found = files[name];
          if (!found || found.dir) return null;
          const absolute = path.join(dir, name.slice(root.length + 1));
          return {
            name,
            dir: false,
            // Only the text reads the extractors make; refuse the rest rather
            // than hand back a Node Buffer where JSZip would give another type.
            async: (type) =>
              type === 'string' || type === 'text'
                ? fs.readFile(absolute, 'utf8')
                : Promise.reject(new Error(`Unsupported read type ${JSON.stringify(type)}.`)),
          };
        },
      };
    },
  };
}

/** The content source the options name, or DCS at `dcs_api_url`. */
export function contentSourceFor(options = {}) {
  return options.contentSource || dcsContentSource(options.dcs_api_url);
}
