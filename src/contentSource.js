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
 * @param {string} dirPath
 */
export function directoryContentSource(dirPath) {
  let modules;
  const load = async () => {
    if (!modules) {
      const [fs, path] = await Promise.all([import('node:fs/promises'), import('node:path')]);
      modules = { fs, path };
    }
    return modules;
  };
  const repoDir = async (entry) => {
    const { path } = await load();
    const { repo } = entryCoords(entry);
    if (!repo) throw new Error('Catalog entry does not name its repository.');
    return path.join(dirPath, repo);
  };

  return {
    async readFile(entry, filePath) {
      const { fs, path } = await load();
      return fs.readFile(path.join(await repoDir(entry), stripDotSlash(filePath)), 'utf8');
    },
    async readLicense(entry) {
      const { fs, path } = await load();
      const dir = await repoDir(entry);
      for (const name of LICENSE_FILES) {
        try {
          const text = await fs.readFile(path.join(dir, name), 'utf8');
          if (text) return text.trim();
        } catch {
          // Not this name; try the next.
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
            async: (type) =>
              fs.readFile(absolute, type === 'string' || type === 'text' ? 'utf8' : undefined),
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
