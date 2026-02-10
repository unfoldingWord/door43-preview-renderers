export const renderers = {
  text: (text) =>
    text
      .replace(
        /{/g,
        '<span class="implied-word"><span class="implied-word-start">{</span><span class="implied-word-text">'
      )
      .replace(/}/g, '</span><span class="implied-word-end">}</span></span>'),
  chapter: '0',
  chapter_label(number) {
    this.chapter = number;
    return `<span id="chapter-${this.chapter}" class="marks_chapter_label">${number}</span>`;
  },
  verses_label(number) {
    return `<span id="chapter-${this.chapter}-verse-${number}" class="marks_verses_label">${number}</span>`;
  },
  paragraph: (subType, content, footnoteNo) => {
    const paraClass = subType.split(':')[1];
    const paraTag = ['f', 'x'].includes(paraClass) ? 'span' : 'p';
    return `<${paraTag} ${
      paraClass === 'f' ? `id="footnote-${footnoteNo}" ` : ''
    }class="paras_usfm_${paraClass}">${content.join('')}</${paraTag}>`;
  },
  wrapper: (atts, subType, content) => {
    if (subType === 'cell') {
      if (atts.role === 'body') {
        return `<td colspan=${atts.nCols} style="text-align:${atts.alignment}">${content.join('')}</td>`;
      }
      return `<th colspan=${atts.nCols} style="text-align:${atts.alignment}">${content.join('')}</th>`;
    }

    return `<span class="paras_usfm_${subType.split(':')[1]}">${content.join('')}</span>`;
  },
  wWrapper: (atts, content) => {
    if (Object.keys(atts).length === 0) {
      return content;
    }

    return `<span><div>${content}</div>${Object.entries(atts)
      .map(
        ([key, value]) =>
          `<div style="font-size: xx-small; font-weight: bold;">{${key} = ${value}}</div>`
      )
      .join('')}</span>`;
  },
  mergeParas: (paras) => paras.join('\n'),
  row: (content) => `<tr>${content.join('')}</tr>`,
  table: (content) => `<table border>${content.join(' ')}</table>`,
};
