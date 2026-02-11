import { jest } from '@jest/globals';

const axiosGetMock = jest.fn();
const extractRcAlignedBibleDataMock = jest.fn();
const extractRcTaDataMock = jest.fn();
const extractRcTwDataMock = jest.fn();
const extractRcTsvDataMock = jest.fn();
const getAllCatalogEntriesForRenderingMock = jest.fn();
const extractRcSbObsDataMock = jest.fn();
const extractTsObsDataMock = jest.fn();
const formatObsDataMock = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    get: axiosGetMock,
  },
}));

jest.unstable_mockModule('../rcAlignedBibleHelpers.js', () => ({
  extractRcAlignedBibleData: extractRcAlignedBibleDataMock,
}));

jest.unstable_mockModule('../taHelpers.js', () => ({
  extractRcTaData: extractRcTaDataMock,
}));

jest.unstable_mockModule('../twHelpers.js', () => ({
  extractRcTwData: extractRcTwDataMock,
}));

jest.unstable_mockModule('../tsvHelpers.js', () => ({
  extractRcTsvData: extractRcTsvDataMock,
}));

jest.unstable_mockModule('../getAllCatalogEntriesForRendering.js', () => ({
  getAllCatalogEntriesForRendering: getAllCatalogEntriesForRenderingMock,
}));

jest.unstable_mockModule('../obsHelpers.js', () => ({
  extractRcSbObsData: extractRcSbObsDataMock,
  extractTsObsData: extractTsObsDataMock,
  formatObsData: formatObsDataMock,
}));

const { getCatalogEntry, getResourceData, getExtraResources } = await import('../getResourceData.js');

describe('getCatalogEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requests catalog entry from the configured API URL', async () => {
    const catalog = { subject: 'Aligned Bible' };
    axiosGetMock.mockResolvedValueOnce({ data: catalog });

    const result = await getCatalogEntry('unfoldingWord', 'en_ult', 'v88', 'https://git.door43.org/api/v1', true);

    expect(axiosGetMock).toHaveBeenCalledWith(
      'https://git.door43.org/api/v1/catalog/entry/unfoldingWord/en_ult/v88'
    );
    expect(result).toEqual(catalog);
  });

  test('wraps axios failures in a getCatalogEntry-specific error', async () => {
    axiosGetMock.mockRejectedValueOnce(new Error('network down'));

    await expect(getCatalogEntry('u', 'r', 'ref', undefined, true)).rejects.toThrow(
      'Failed to get catalog entry: network down'
    );
  });
});

describe('getResourceData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns { error } when catalog entry fetch fails', async () => {
    axiosGetMock.mockRejectedValueOnce(new Error('network down'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getResourceData('u', 'r', 'ref', [], { quiet: true });

    expect(result).toEqual({ error: 'Failed to get catalog entry: network down' });
    consoleErrorSpy.mockRestore();
  });

  test('routes Aligned Bible resources to extractRcAlignedBibleData', async () => {
    const catalogEntry = {
      title: 'unfoldingWord Literal Text',
      subject: 'Aligned Bible',
      ingredients: [{ identifier: 'tit' }],
      metadata_type: 'rc',
    };
    const renderedData = { type: 'usfm', subject: 'Aligned Bible', books: {} };

    axiosGetMock.mockResolvedValueOnce({ data: catalogEntry });
    extractRcAlignedBibleDataMock.mockResolvedValueOnce(renderedData);

    const result = await getResourceData('unfoldingWord', 'en_ult', 'v88', ['tit'], {
      quiet: true,
      dcs_api_url: 'https://git.door43.org/api/v1',
    });

    expect(extractRcAlignedBibleDataMock).toHaveBeenCalledWith(
      catalogEntry,
      ['tit'],
      expect.objectContaining({ quiet: true, dcs_api_url: 'https://git.door43.org/api/v1' })
    );
    expect(result).toEqual(renderedData);
  });

  test('uses catalogEntry.repo fallback fields when top-level fields are missing', async () => {
    const catalogEntry = {
      repo: {
        title: 'Fallback ULT',
        subject: 'Aligned Bible',
        ingredients: [{ identifier: 'tit' }],
        metadata_type: 'rc',
        flavor_type: 'scripture',
        flavor: 'textTranslation',
      },
    };

    axiosGetMock.mockResolvedValueOnce({ data: catalogEntry });
    extractRcAlignedBibleDataMock.mockResolvedValueOnce({ ok: true });

    await getResourceData('unfoldingWord', 'en_ult', 'v88', ['tit'], { quiet: true });

    expect(extractRcAlignedBibleDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Fallback ULT',
        subject: 'Aligned Bible',
        metadata_type: 'rc',
      }),
      ['tit'],
      expect.any(Object)
    );
  });

  test('routes Translation Academy resources to extractRcTaData', async () => {
    const catalogEntry = {
      title: 'Translation Academy',
      subject: 'Translation Academy',
      ingredients: [{ identifier: 'translate' }],
      metadata_type: 'rc',
    };
    const data = { type: 'ta', subject: 'Translation Academy' };

    axiosGetMock.mockResolvedValueOnce({ data: catalogEntry });
    extractRcTaDataMock.mockResolvedValueOnce(data);

    const result = await getResourceData('unfoldingWord', 'en_ta', 'v87', [], { quiet: true });

    expect(extractRcTaDataMock).toHaveBeenCalledWith(catalogEntry, expect.objectContaining({ quiet: true }));
    expect(result).toEqual(data);
  });

  test('routes Translation Words resources to extractRcTwData', async () => {
    const catalogEntry = {
      title: 'Translation Words',
      subject: 'Translation Words',
      ingredients: [{ identifier: 'bible' }],
      metadata_type: 'rc',
    };
    const data = { type: 'tw', subject: 'Translation Words' };

    axiosGetMock.mockResolvedValueOnce({ data: catalogEntry });
    extractRcTwDataMock.mockResolvedValueOnce(data);

    const result = await getResourceData('unfoldingWord', 'en_tw', 'v87', [], { quiet: true });

    expect(extractRcTwDataMock).toHaveBeenCalledWith(catalogEntry, expect.objectContaining({ quiet: true }));
    expect(result).toEqual(data);
  });

  test('routes TSV Translation Notes through dependency resolution before extraction', async () => {
    const catalogEntry = {
      title: 'Translation Notes',
      subject: 'TSV Translation Notes',
      ingredients: [{ identifier: 'tit' }],
      metadata_type: 'rc',
    };

    axiosGetMock.mockResolvedValueOnce({ data: catalogEntry });
    getAllCatalogEntriesForRenderingMock.mockResolvedValueOnce({
      catalogEntries: [{ owner: 'unfoldingWord', name: 'en_tn' }],
    });
    extractRcTsvDataMock.mockResolvedValueOnce({ type: 'tsv' });

    const result = await getResourceData('unfoldingWord', 'en_tn', 'v80', ['tit'], { quiet: true });

    expect(getAllCatalogEntriesForRenderingMock).toHaveBeenCalledWith(
      catalogEntry,
      ['tit'],
      expect.objectContaining({ quiet: true })
    );
    expect(extractRcTsvDataMock).toHaveBeenCalledWith(
      catalogEntry,
      ['tit'],
      expect.objectContaining({ quiet: true }),
      [{ owner: 'unfoldingWord', name: 'en_tn' }]
    );
    expect(result).toEqual({ type: 'tsv' });
  });

  test('routes RC OBS resources through extractRcSbObsData + formatObsData', async () => {
    const catalogEntry = {
      title: 'OBS',
      subject: 'Open Bible Stories',
      ingredients: [{ identifier: 'obs', path: './content' }],
      metadata_type: 'rc',
    };
    const obsData = { stories: {} };
    const formatted = { type: 'obs' };

    axiosGetMock.mockResolvedValueOnce({ data: catalogEntry });
    extractRcSbObsDataMock.mockResolvedValueOnce(obsData);
    formatObsDataMock.mockReturnValueOnce(formatted);

    const result = await getResourceData('unfoldingWord', 'en_obs', 'v1', [], { quiet: true });

    expect(extractRcSbObsDataMock).toHaveBeenCalledWith(catalogEntry, catalogEntry.ingredients[0]);
    expect(formatObsDataMock).toHaveBeenCalledWith(obsData, catalogEntry);
    expect(result).toEqual(formatted);
  });

  test('throws for RC OBS resource without ingredients', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        title: 'OBS',
        subject: 'Open Bible Stories',
        ingredients: [],
        metadata_type: 'rc',
      },
    });

    await expect(getResourceData('u', 'r', 'ref', [], { quiet: true })).rejects.toThrow(
      'No ingredients found in catalog entry'
    );
  });

  test('returns SB Bible payload for scripture/textTranslation flavor', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        title: 'SB Bible',
        subject: 'Bible',
        ingredients: [{ identifier: 'tit' }],
        metadata_type: 'sb',
        flavor_type: 'scripture',
        flavor: 'textTranslation',
      },
    });

    const result = await getResourceData('u', 'r', 'ref', ['tit'], { quiet: true });

    expect(result).toEqual(
      expect.objectContaining({
        subject: 'Bible',
        books: ['tit'],
      })
    );
  });

  test('throws for unsupported SB scripture flavor', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        title: 'SB Bible',
        subject: 'Bible',
        ingredients: [{ identifier: 'tit' }],
        metadata_type: 'sb',
        flavor_type: 'scripture',
        flavor: 'unknownFlavor',
      },
    });

    await expect(getResourceData('u', 'r', 'ref', ['tit'], { quiet: true })).rejects.toThrow(
      'Conversion of SB flavor `unknownFlavor` is not currently supported.'
    );
  });

  test('routes SB gloss/textStories through OBS extraction', async () => {
    const catalogEntry = {
      title: 'SB OBS',
      subject: 'Open Bible Stories',
      ingredients: [{ identifier: 'obs', path: './content' }],
      metadata_type: 'sb',
      flavor_type: 'gloss',
      flavor: 'textStories',
    };
    const obsData = { stories: {} };
    const formatted = { type: 'obs' };

    axiosGetMock.mockResolvedValueOnce({ data: catalogEntry });
    extractRcSbObsDataMock.mockResolvedValueOnce(obsData);
    formatObsDataMock.mockReturnValueOnce(formatted);

    const result = await getResourceData('u', 'r', 'ref', [], { quiet: true });

    expect(extractRcSbObsDataMock).toHaveBeenCalledWith(catalogEntry, catalogEntry.ingredients[0]);
    expect(result).toEqual(formatted);
  });

  test('throws for unsupported SB gloss flavor', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        title: 'SB OBS',
        subject: 'Open Bible Stories',
        ingredients: [{ identifier: 'obs', path: './content' }],
        metadata_type: 'sb',
        flavor_type: 'gloss',
        flavor: 'other',
      },
    });

    await expect(getResourceData('u', 'r', 'ref', [], { quiet: true })).rejects.toThrow(
      'Conversion of SB gloss flavor `other` is not currently supported.'
    );
  });

  test('routes TS OBS resources through extractTsObsData + formatObsData', async () => {
    const catalogEntry = {
      title: 'TS OBS',
      subject: 'Open Bible Stories',
      ingredients: [{ identifier: 'obs', path: './content' }],
      metadata_type: 'ts',
    };
    const obsData = { stories: {} };
    const formatted = { type: 'obs' };

    axiosGetMock.mockResolvedValueOnce({ data: catalogEntry });
    extractTsObsDataMock.mockResolvedValueOnce(obsData);
    formatObsDataMock.mockReturnValueOnce(formatted);

    const result = await getResourceData('u', 'r', 'ref', [], { quiet: true });

    expect(extractTsObsDataMock).toHaveBeenCalledWith(catalogEntry, catalogEntry.ingredients[0]);
    expect(result).toEqual(formatted);
  });

  test('returns TS Bible payload', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        title: 'TS Bible',
        subject: 'Bible',
        ingredients: [{ identifier: 'tit' }],
        metadata_type: 'ts',
      },
    });

    const result = await getResourceData('u', 'r', 'ref', ['tit'], { quiet: true });

    expect(result).toEqual(
      expect.objectContaining({
        subject: 'Bible',
        books: ['tit'],
      })
    );
  });

  test('throws for unsupported TS subject', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        title: 'TS Resource',
        subject: 'Translation Notes',
        ingredients: [{ identifier: 'tit' }],
        metadata_type: 'ts',
      },
    });

    await expect(getResourceData('u', 'r', 'ref', [], { quiet: true })).rejects.toThrow(
      'Conversion of translationStudio repositories is currently not supported.'
    );
  });

  test('returns TC Bible payload', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        title: 'TC Bible',
        subject: 'Bible',
        ingredients: [{ identifier: 'tit' }],
        metadata_type: 'tc',
      },
    });

    const result = await getResourceData('u', 'r', 'ref', ['tit'], { quiet: true });

    expect(result).toEqual(
      expect.objectContaining({
        subject: 'Bible',
        books: ['tit'],
      })
    );
  });

  test('throws for unsupported TC subject', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        title: 'TC Resource',
        subject: 'Translation Questions',
        ingredients: [{ identifier: 'tit' }],
        metadata_type: 'tc',
      },
    });

    await expect(getResourceData('u', 'r', 'ref', [], { quiet: true })).rejects.toThrow(
      'Conversion of translationCore `Translation Questions` repositories is currently not supported.'
    );
  });

  test('throws for unsupported RC subject', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        title: 'RC Resource',
        subject: 'Random Subject',
        ingredients: [{ identifier: 'x' }],
        metadata_type: 'rc',
      },
    });

    await expect(getResourceData('u', 'r', 'ref', [], { quiet: true })).rejects.toThrow(
      'Conversion of `Random Subject` resources is currently not supported.'
    );
  });

  test('throws for unsupported metadata types', async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        title: 'Bad Repo',
        subject: 'Aligned Bible',
        ingredients: [],
        metadata_type: 'unsupported',
      },
    });

    await expect(getResourceData('x', 'y', 'z', [], { quiet: true })).rejects.toThrow(
      'Not a valid repository that can be convert.'
    );
  });

  test('throws when metadata cannot be inferred from top-level or repo fields', async () => {
    axiosGetMock.mockResolvedValueOnce({ data: {} });

    await expect(getResourceData('x', 'y', 'z', [], { quiet: true })).rejects.toThrow(
      'Unable to determine its type and/or ingredients.'
    );
  });
});

describe('getExtraResources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches extras across identifier styles (array, owner/repo, and lang suffix)', async () => {
    const baseCatalogEntry = {
      owner: 'unfoldingWord',
      language: 'en',
      branch_or_tag_name: 'v1',
    };

    const catalogByRepo = {
      en_ult: {
        title: 'ULT',
        subject: 'Aligned Bible',
        ingredients: [{ identifier: 'tit', path: './content/tit.usfm' }],
        metadata_type: 'rc',
      },
      en_ust: {
        title: 'UST',
        subject: 'Aligned Bible',
        ingredients: [{ identifier: 'tit', path: './content/tit.usfm' }],
        metadata_type: 'rc',
      },
      hbo_uhb: {
        title: 'UHB',
        subject: 'Hebrew Old Testament',
        ingredients: [{ identifier: 'gen', path: './content/gen.usfm' }],
        metadata_type: 'rc',
      },
      en_ta: {
        title: 'TA',
        subject: 'Translation Academy',
        ingredients: [{ identifier: 'translate', path: './translate' }],
        metadata_type: 'rc',
      },
    };

    axiosGetMock.mockImplementation(async (url) => {
      const parts = url.split('/');
      const repo = parts[parts.length - 2];
      const data = catalogByRepo[repo];
      if (!data) {
        throw new Error(`unexpected repo lookup for ${repo}`);
      }
      return { data };
    });

    extractRcAlignedBibleDataMock.mockResolvedValue({ type: 'usfm', books: { tit: 'USFM' } });
    extractRcTaDataMock.mockResolvedValue({ type: 'ta', manuals: {} });

    const extras = await getExtraResources(
      baseCatalogEntry,
      ['tit'],
      'https://git.door43.org/api/v1',
      ['Aligned Bible', 'Hebrew Old Testament', 'Translation Academy'],
      true
    );

    expect(Object.keys(extras)).toEqual(expect.arrayContaining(['ult', 'ust', 'hbo_uhb', 'ta']));
    expect(extras.ult).toEqual(expect.objectContaining({ type: 'usfm' }));
    expect(extras.ta).toEqual(expect.objectContaining({ type: 'ta' }));
  });
});
