#!/usr/bin/env node

/**
 * CLI tool for door43-preview-renderers
 *
 * Usage:
 *   cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen [--output file.json] [--dcs-api-url URL]
 *   cli.js getResourceData --owner unfoldingWord --repo en_tn --ref v80 --book gen [--output file.json] [--dcs-api-url URL]
 */

import fs from 'fs';
import path from 'path';
// Import from the built package entry: only dist/index.esm.js and this file
// are published, so the installed `door43-renderers` bin resolves against
// dist. A checkout without a build (CI's test job, a fresh clone) falls back
// to the source entry so the CLI still runs. Only a missing build falls back;
// a build that fails to load reports its own error.
const distEntry = new URL('../dist/index.esm.js', import.meta.url);
const {
  getAllCatalogEntries,
  getResourceData,
  renderHtmlData,
  renderHTML,
  renderPdf,
  findResources,
  resolveRef,
} = await import(fs.existsSync(distEntry) ? distEntry.href : './index.js');

// Map the CLI's short page-size keys to PAGE_SIZES keys understood by renderHTML/renderPdf.
function resolveCliPageSize(shortKey) {
  const map = {
    A4: 'A4_PORTRAIT',
    A5: 'A5_PORTRAIT',
    USL: 'US_LETTER_PORTRAIT',
    TRADE: 'TRADE',
    CQ: 'CROWN_QUARTO',
  };
  return map[(shortKey || 'A4').toUpperCase()] || 'A4_PORTRAIT';
}

// Parse command line arguments
function parseArgs(args) {
  const parsed = {
    command: args[0],
    params: {},
    quiet: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    // Handle flags without values
    if (arg === '--quiet' || arg === '-q') {
      parsed.quiet = true;
      continue;
    }

    // Handle key-value pairs
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '').replace(/-/g, '_');
      const value = args[i + 1];

      if (key === 'book') {
        parsed.params.bookId = value;
      } else if (key === 'dcs_api_url') {
        parsed.params.dcsApiUrl = value;
      } else if (key === 'output') {
        parsed.output = value;
      } else if (key === 'page_size') {
        parsed.params.pageSize = value;
      } else if (key === 'columns') {
        parsed.params.columns = parseInt(value, 10) || 1;
      } else if (key === 'stage') {
        parsed.params.stage = value;
      } else {
        parsed.params[key] = value;
      }
      i++; // Skip the value in next iteration
    }
  }

  return parsed;
}

// Display help message
function showHelp() {
  process.stdout.write(`
door43-preview-renderers CLI

Usage:
  cli.js <command> [options]

Commands:
  findResources           List what is published for a language (optionally one subject/owner)
  getAllCatalogEntries    Get all catalog entries for rendering
  getResourceData        Get resource data for a specific book
  renderHtml             Fetch resource data and render to HTML sections (JSON)
  assemblePrint          Fetch, render, and assemble a print-ready HTML document
  generatePdf            Fetch, render, assemble, and render a PDF via WeasyPrint (requires the weasyprint binary)

Options:
  --owner <owner>         Repository owner (required unless --lang/--subject are given)
  --repo <repo>           Repository name (required unless --lang/--subject are given)
  --lang <code>           Language code, e.g. en, es-419 (with --subject: find the publisher)
  --subject <subject>     Catalog subject, e.g. "TSV Translation Notes"
  --stage <stage>         Catalog stage for --lang lookups: prod (default), preprod, latest, branch
  --ref <ref>             Branch, tag or commit; omitted = the latest release
  --book <bookId>         Book ID (e.g., gen, exo, mat, 1ti)
  --dcs-api-url <url>     Custom DCS API URL (optional)
  --output <file>         Output file path (optional, defaults to stdout)
  --quiet, -q             Suppress logging output (no API URLs or progress messages)
  --page-size <size>      Page size for assemblePrint (A4, A5, USL, TRADE, CQ; default A4)
  --columns <n>           Number of columns for assemblePrint (default 1)
  --pdf-service-url <url> generatePdf: use a hosted weasyprint-pdf service instead of the local binary

Examples:
  # What is published for a language?
  node src/cli.js findResources --lang es-419
  node src/cli.js findResources --lang es-419 --subject "TSV Translation Notes" --quiet

  # Render by language + subject: the publisher and release are found for you
  node src/cli.js renderHtml --lang es-419 --subject "TSV Translation Notes" --book tit --quiet

  # Omit --ref to use the latest release
  node src/cli.js getResourceData --owner unfoldingWord --repo en_tn --book tit --quiet

  # Get catalog entries and output to stdout
  node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

  # Get catalog entries with quiet mode (no logging, just JSON)
  node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen --quiet

  # Get catalog entries and save to file
  node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen --output result.json

  # Quiet mode for piping to jq
  node src/cli.js getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --quiet | jq '.catalogEntries[] | {owner, repo: .name, subject}'

  # Get resource data
  node src/cli.js getResourceData --owner unfoldingWord --repo en_tn --ref v80 --book gen

  # Render HTML sections (JSON output with body, toc, css, etc.)
  node src/cli.js renderHtml --owner unfoldingWord --repo en_tn --ref v88 --book tit --quiet

  # Assemble print-ready HTML document (outputs complete HTML)
  node src/cli.js assemblePrint --owner unfoldingWord --repo en_tn --ref v88 --book tit --output tit_tn.html

  # Assemble with page size options
  node src/cli.js assemblePrint --owner unfoldingWord --repo en_obs --ref v9 --page-size TRADE --output obs.html

  # Generate a PDF directly (no browser; requires weasyprint installed)
  node src/cli.js generatePdf --owner unfoldingWord --repo en_tn --ref v88 --book tit --output tit_tn.pdf

  # Use custom DCS API URL
  node src/cli.js getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn --dcs-api-url https://git.door43.org/api/v1

Test Cases:
  # Valid case
  node src/cli.js getAllCatalogEntries --owner unfoldingWord --repo en_tn --ref v80 --book gen

  # Invalid book ID (should fail)
  node src/cli.js getAllCatalogEntries --owner fr_gl --repo fr_tn --ref v2 --book 1th

  # Valid case
  node src/cli.js getAllCatalogEntries --owner fr_gl --repo gr_tn --ref v2 --book 1ti

  # Aligned Bible case (currently fails, needs fix)
  node src/cli.js getAllCatalogEntries --owner BSOJ --repo ar_twl --ref v5 --book 1jn
`);
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const { command, params, output, quiet } = parseArgs(args);

  const dcsApiUrl = params.dcsApiUrl || 'https://git.door43.org/api/v1';
  const byLanguage = !!(params.lang && params.subject);

  if (command === 'findResources') {
    if (!params.lang) {
      console.error(
        'Error: findResources needs --lang (and optionally --subject, --owner, --stage)'
      );
      process.exit(1);
    }
  } else if (!byLanguage && (!params.owner || !params.repo)) {
    console.error('Error: --owner and --repo are required (or --lang with --subject)');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  try {
    let result;

    // Stages 0-1, once: the CatalogSet every command starts from. A language
    // + subject names the publisher (a --ref given with them is kept); a
    // missing --ref on an owner/repo means the latest release. The set is
    // handed on as-is, so the selected resource stays first and the version
    // is the one resolved.
    let set;
    if (command !== 'findResources') {
      const books = params.bookId ? [params.bookId] : [];
      let descriptor;
      if (byLanguage) {
        if (!quiet) console.error(`Finding ${params.subject} for ${params.lang}...`);
        descriptor = {
          lang: params.lang,
          subject: params.subject,
          books,
          owner: params.owner,
          stage: params.stage,
          ref: params.ref,
        };
      } else {
        const ref =
          params.ref ||
          (await resolveRef({ owner: params.owner, repo: params.repo }, { dcs_api_url: dcsApiUrl }))
            .ref;
        descriptor = { owner: params.owner, repo: params.repo, ref, books };
      }
      set = await getAllCatalogEntries(descriptor, { dcs_api_url: dcsApiUrl, quiet });
      // A requested owner is a preference: when its package was incomplete the
      // next publisher is used, and that substitution is said even when quiet.
      if (byLanguage && params.owner && params.owner !== set.source.owner) {
        console.error(
          `Note: ${params.owner} has no complete ${params.subject} package for ${params.lang}; using ${set.source.owner}/${set.source.repo}@${set.source.ref}`
        );
      }
      params.owner = set.source.owner;
      params.repo = set.source.repo;
      params.ref = set.source.ref;
      if (!quiet) console.error(`Using ${params.owner}/${params.repo}@${params.ref}`);
    }

    switch (command) {
      case 'findResources': {
        if (!quiet) console.error(`Searching the catalog for ${params.lang}...`);
        const entries = await findResources(
          { lang: params.lang, subject: params.subject, owner: params.owner, stage: params.stage },
          { dcs_api_url: dcsApiUrl, quiet }
        );
        result = entries.map((e) => ({
          owner: e.owner,
          repo: e.name,
          ref: e.branch_or_tag_name,
          subject: e.subject,
          title: e.title,
          released: e.released,
          language_is_gl: e.language_is_gl,
          language_direction: e.language_direction,
        }));
        break;
      }

      case 'getAllCatalogEntries': {
        result = set;
        break;
      }

      case 'getResourceData': {
        if (!quiet) {
          console.error(`Fetching resource data for ${params.owner}/${params.repo}...`);
        }
        result = await getResourceData(set, { dcs_api_url: dcsApiUrl, quiet });
        break;
      }

      case 'renderHtml': {
        if (!quiet) {
          console.error(`Rendering HTML for ${params.owner}/${params.repo}...`);
        }
        const resourceData = await getResourceData(set, { dcs_api_url: dcsApiUrl, quiet });
        // HtmlData package (identity + sections); the body can be large.
        result = renderHtmlData(resourceData, { books: set.source.books });
        break;
      }

      case 'assemblePrint': {
        if (!quiet) {
          console.error(`Assembling print document for ${params.owner}/${params.repo}...`);
        }
        const resourceData = await getResourceData(set, { dcs_api_url: dcsApiUrl, quiet });
        const htmlData = renderHtmlData(resourceData, { books: set.source.books });
        const html = renderHTML(htmlData, {
          media: 'print',
          columns: params.columns || 1,
          print: { pageSize: resolveCliPageSize(params.pageSize) },
        });

        // For assemblePrint, output the raw HTML, not JSON
        if (output) {
          const outputPath = path.resolve(output);
          fs.writeFileSync(outputPath, html);
          console.error(`✓ Print-ready HTML written to ${outputPath}`);
          process.exit(0);
        } else {
          process.stdout.write(html + '\n', () => {
            process.exit(0);
          });
        }
        return; // Skip JSON formatting below
      }

      case 'generatePdf': {
        if (!output) {
          console.error('Error: generatePdf requires --output <file.pdf>');
          process.exit(1);
        }
        if (!quiet) {
          console.error(`Generating PDF for ${params.owner}/${params.repo}...`);
        }
        const resourceData = await getResourceData(set, { dcs_api_url: dcsApiUrl, quiet });
        const htmlData = renderHtmlData(resourceData, { books: set.source.books });
        const pdfOutputPath = path.resolve(output);
        await renderPdf(htmlData, {
          pageSize: resolveCliPageSize(params.pageSize),
          columns: params.columns || 1,
          outputPath: pdfOutputPath,
          // Offload to a hosted weasyprint-pdf service instead of the local binary.
          pdfServiceUrl: params.pdf_service_url,
          quiet,
        });
        console.error(`✓ PDF written to ${pdfOutputPath}`);
        process.exit(0);
        return;
      }

      default:
        console.error(`Error: Unknown command "${command}"`);
        console.error(
          'Valid commands: findResources, getAllCatalogEntries, getResourceData, renderHtml, assemblePrint, generatePdf'
        );
        process.exit(1);
    }

    // Format output
    const jsonOutput = JSON.stringify(result, null, 2);

    // Write to file or stdout
    if (output) {
      const outputPath = path.resolve(output);
      fs.writeFileSync(outputPath, jsonOutput);
      console.error(`✓ Output written to ${outputPath}`);
      process.exit(0);
    } else {
      // Write to stdout and wait for it to flush before exiting
      process.stdout.write(jsonOutput + '\n', () => {
        process.exit(0);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.status, error.response.statusText);
      if (error.response.data) {
        console.error('Details:', error.response.data);
      }
    }
    process.exit(1);
  }
}

// Run main function
main();
