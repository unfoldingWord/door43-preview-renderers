# Constants

This library exports several useful constants for working with Bible books and Door43 resources.

**Source:** `src/constants.js`

## BibleBookData

A comprehensive mapping of all 66 canonical Bible books with their metadata.

### Structure

Each book entry contains:
- **id**: Three-letter book identifier (lowercase)
- **title**: Full English book name
- **usfm**: USFM book code (with number prefix)
- **testament**: Testament classification ('old' or 'new')

### Example

```js static
import { BibleBookData } from 'door43-preview-renderers';

// Get information about a specific book
const genesis = BibleBookData['gen'];
console.log(genesis);
// {
//   id: 'gen',
//   title: 'Genesis',
//   usfm: '01-GEN',
//   testament: 'old'
// }

// Check testament
const matthew = BibleBookData['mat'];
console.log(matthew.testament); // 'new'

// Filter Old Testament books
const otBooks = Object.values(BibleBookData).filter(
  book => book.testament === 'old'
);
console.log(otBooks.length); // 39

// Filter New Testament books
const ntBooks = Object.values(BibleBookData).filter(
  book => book.testament === 'new'
);
console.log(ntBooks.length); // 27
```

### All Books

**Old Testament (39 books):**
- Pentateuch: gen, exo, lev, num, deu
- Historical: jos, jdg, rut, 1sa, 2sa, 1ki, 2ki, 1ch, 2ch, ezr, neh, est
- Wisdom: job, psa, pro, ecc, sng
- Major Prophets: isa, jer, lam, ezk, dan
- Minor Prophets: hos, jol, amo, oba, jon, mic, nam, hab, zep, hag, zec, mal

**New Testament (27 books):**
- Gospels: mat, mrk, luk, jhn
- History: act
- Pauline Epistles: rom, 1co, 2co, gal, eph, php, col, 1th, 2th, 1ti, 2ti, tit, phm
- General Epistles: heb, jas, 1pe, 2pe, 1jn, 2jn, 3jn, jud
- Apocalyptic: rev

## requiredSubjectsMap

Maps catalog entry subjects to their required supplementary subjects. This is used by `getAllCatalogEntriesForRendering()` to determine which dependencies need to be fetched.

### Structure

```js static
{
  [subject: string]: string[]
}
```

### Mappings

```js static
import { requiredSubjectsMap } from 'door43-preview-renderers';

// TSV Translation Notes requires:
requiredSubjectsMap['TSV Translation Notes']
// [
//   'Aligned Bible',
//   'Translation Academy',
//   'Translation Words',
//   'TSV Translation Words Links',
//   'Hebrew Old Testament',
//   'Greek New Testament'
// ]

// TSV Study Notes requires:
requiredSubjectsMap['TSV Study Notes']
// ['Aligned Bible', 'Hebrew Old Testament', 'Greek New Testament']

// TSV Study Questions requires:
requiredSubjectsMap['TSV Study Questions']
// ['Aligned Bible', 'Hebrew Old Testament', 'Greek New Testament']

// TSV Translation Questions requires:
requiredSubjectsMap['TSV Translation Questions']
// ['Aligned Bible', 'Hebrew Old Testament', 'Greek New Testament']

// TSV Translation Words Links requires:
requiredSubjectsMap['TSV Translation Words Links']
// [
//   'Aligned Bible',
//   'Hebrew Old Testament',
//   'Greek New Testament',
//   'Translation Words'
// ]

// OBS resources
requiredSubjectsMap['TSV OBS Study Notes']
// ['Open Bible Stories']

requiredSubjectsMap['TSV OBS Study Questions']
// ['Open Bible Stories']

requiredSubjectsMap['TSV OBS Translation Notes']
// [
//   'Open Bible Stories',
//   'TSV OBS Translation Words Links',
//   'Translation Academy',
//   'Translation Words'
// ]

requiredSubjectsMap['TSV OBS Translation Questions']
// ['Open Bible Stories']
```

### Example Usage

```js static
import { requiredSubjectsMap } from 'door43-preview-renderers';

function getRequirements(subject) {
  const requirements = requiredSubjectsMap[subject];
  if (!requirements) {
    return 'No requirements';
  }
  return requirements;
}

console.log(getRequirements('TSV Translation Notes'));
// ['Aligned Bible', 'Translation Academy', ...]
```

## subjectIdentifierMap

Maps subject names to their repository identifier abbreviations. Used for catalog searches and relation mapping.

### Structure

```js static
{
  [subject: string]: string | string[]
}
```

### Mappings

```js static
import { subjectIdentifierMap } from 'door43-preview-renderers';

// Bible translations
subjectIdentifierMap['Aligned Bible']
// ['ult', 'ust', 'glt', 'gst']

subjectIdentifierMap['Hebrew Old Testament']
// 'unfoldingWord/hbo_uhb'

subjectIdentifierMap['Greek New Testament']
// 'unfoldingWord/el-x-koine_ugnt'

// Training resources
subjectIdentifierMap['Translation Academy']
// 'ta'

subjectIdentifierMap['Translation Words']
// 'tw'

// TSV resources
subjectIdentifierMap['TSV Translation Words Links']
// 'twl'

// Open Bible Stories
subjectIdentifierMap['Open Bible Stories']
// 'obs'

subjectIdentifierMap['TSV OBS Study Questions']
// 'obs-sq'

subjectIdentifierMap['TSV OBS Study Notes']
// 'obs-sn'

subjectIdentifierMap['TSV OBS Translation Notes']
// 'obs-tn'

subjectIdentifierMap['TSV OBS Translation Words Links']
// 'obs-twl'
```

### Example Usage

```js static
import { subjectIdentifierMap } from 'door43-preview-renderers';

// Build a repository name for catalog search
function buildRepoName(lang, subject) {
  const identifier = subjectIdentifierMap[subject];
  
  if (Array.isArray(identifier)) {
    // Multiple possible identifiers
    return identifier.map(id => `${lang}_${id}`);
  } else if (identifier.includes('/')) {
    // Full owner/repo format
    const [owner, repo] = identifier.split('/');
    return { owner, repo };
  } else {
    // Single identifier
    return `${lang}_${identifier}`;
  }
}

console.log(buildRepoName('en', 'Translation Academy'));
// 'en_ta'

console.log(buildRepoName('en', 'Aligned Bible'));
// ['en_ult', 'en_ust', 'en_glt', 'en_gst']
```

## See Also

- [getAllCatalogEntriesForRendering](get-all-catalog-entries-for-rendering.md) - Uses these constants to determine dependencies
- [getResourceData](get-resource-data.md) - Main function for fetching resource data
