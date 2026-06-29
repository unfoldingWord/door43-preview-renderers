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
import { getAllCatalogEntries } from './getAllCatalogEntries.js';
import { getResourceData } from './getResourceData.js';
import { renderHtmlData } from './renderHtmlData.js';
import { assemblePrintDocument, PAGE_SIZES } from './renderers/printDocumentAssembler.js';
import { generatePdf } from './pdf/generatePdf.js';

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
  getAllCatalogEntries    Get all catalog entries for rendering
  getResourceData        Get resource data for a specific book
  renderHtml             Fetch resource data and render to HTML sections (JSON)
  assemblePrint          Fetch, render, and assemble a print-ready HTML document
  generatePdf            Fetch, render, assemble, and render a PDF via WeasyPrint (requires the weasyprint binary)

Options:
  --owner <owner>         Repository owner (required)
  --repo <repo>           Repository name (required)
  --ref <ref>             Git reference (branch/tag/commit)
  --book <bookId>         Book ID (e.g., gen, exo, mat, 1ti)
  --dcs-api-url <url>     Custom DCS API URL (optional)
  --output <file>         Output file path (optional, defaults to stdout)
  --quiet, -q             Suppress logging output (no API URLs or progress messages)
  --page-size <size>      Page size for assemblePrint (A4, A5, USL, TRADE, CQ; default A4)
  --columns <n>           Number of columns for assemblePrint (default 1)

Examples:
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

  // Validate required parameters
  if (!params.owner || !params.repo) {
    console.error('Error: --owner and --repo are required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  try {
    let result;

    switch (command) {
      case 'getAllCatalogEntries': {
        if (!quiet) {
          console.error(`Fetching catalog entries for ${params.owner}/${params.repo}...`);
        }
        const books = params.bookId ? [params.bookId] : [];
        result = await getAllCatalogEntries(
          { owner: params.owner, repo: params.repo, ref: params.ref, books },
          { dcs_api_url: params.dcsApiUrl || 'https://git.door43.org/api/v1', quiet }
        );
        break;
      }

      case 'getResourceData': {
        if (!quiet) {
          console.error(`Fetching resource data for ${params.owner}/${params.repo}...`);
        }
        const resourceBooks = params.bookId ? [params.bookId] : [];
        const resourceOptions = {
          dcs_api_url: params.dcsApiUrl || 'https://git.door43.org/api/v1',
          quiet: quiet,
        };
        result = await getResourceData(
          params.owner,
          params.repo,
          params.ref,
          resourceBooks,
          resourceOptions
        );
        break;
      }

      case 'renderHtml': {
        if (!quiet) {
          console.error(`Rendering HTML for ${params.owner}/${params.repo}...`);
        }
        const renderBooks = params.bookId ? [params.bookId] : [];
        const renderOpts = {
          dcs_api_url: params.dcsApiUrl || 'https://git.door43.org/api/v1',
          quiet: quiet,
        };
        const rendered = await renderHtmlData(
          params.owner,
          params.repo,
          params.ref,
          renderBooks,
          renderOpts
        );
        // Remove resourceData from JSON output (too large), keep sections
        const { resourceData: _rd, ...outputData } = rendered;
        result = outputData;
        break;
      }

      case 'assemblePrint': {
        if (!quiet) {
          console.error(`Assembling print document for ${params.owner}/${params.repo}...`);
        }
        const printBooks = params.bookId ? [params.bookId] : [];
        const printOpts = {
          dcs_api_url: params.dcsApiUrl || 'https://git.door43.org/api/v1',
          quiet: quiet,
        };
        const printRendered = await renderHtmlData(
          params.owner,
          params.repo,
          params.ref,
          printBooks,
          printOpts
        );

        // Resolve page size
        const pageSizeKey = (params.pageSize || 'A4').toUpperCase();
        const pageSizeMap = {
          A4: PAGE_SIZES.A4_PORTRAIT,
          A5: PAGE_SIZES.A5_PORTRAIT,
          USL: PAGE_SIZES.US_LETTER_PORTRAIT,
          TRADE: PAGE_SIZES.TRADE,
          CQ: PAGE_SIZES.CROWN_QUARTO,
        };
        const pageSize = pageSizeMap[pageSizeKey] || PAGE_SIZES.A4_PORTRAIT;

        const printDoc = assemblePrintDocument(printRendered.sections || printRendered, {
          title: printRendered.title || 'Document',
          version: params.ref || '',
          abbreviation: printRendered.resourceData?.catalogEntry?.abbreviation || '',
          pageWidth: pageSize.width,
          pageHeight: pageSize.height,
          columns: params.columns || 1,
          direction: printRendered.resourceData?.catalogEntry?.language_direction || 'ltr',
        });

        // For assemblePrint, output the raw HTML, not JSON
        if (output) {
          const outputPath = path.resolve(output);
          fs.writeFileSync(outputPath, printDoc.html);
          console.error(`✓ Print-ready HTML written to ${outputPath}`);
          process.exit(0);
        } else {
          process.stdout.write(printDoc.html + '\n', () => {
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
        const pdfBooks = params.bookId ? [params.bookId] : [];
        const pdfRendered = await renderHtmlData(params.owner, params.repo, params.ref, pdfBooks, {
          dcs_api_url: params.dcsApiUrl || 'https://git.door43.org/api/v1',
          quiet: quiet,
        });

        const pdfPageSizeKey = (params.pageSize || 'A4').toUpperCase();
        const pdfPageSizeMap = {
          A4: PAGE_SIZES.A4_PORTRAIT,
          A5: PAGE_SIZES.A5_PORTRAIT,
          USL: PAGE_SIZES.US_LETTER_PORTRAIT,
          TRADE: PAGE_SIZES.TRADE,
          CQ: PAGE_SIZES.CROWN_QUARTO,
        };
        const pdfPageSize = pdfPageSizeMap[pdfPageSizeKey] || PAGE_SIZES.A4_PORTRAIT;

        const pdfDoc = assemblePrintDocument(pdfRendered.sections || pdfRendered, {
          title: pdfRendered.title || 'Document',
          version: params.ref || '',
          abbreviation: pdfRendered.resourceData?.catalogEntry?.abbreviation || '',
          pageWidth: pdfPageSize.width,
          pageHeight: pdfPageSize.height,
          columns: params.columns || 1,
          direction: pdfRendered.resourceData?.catalogEntry?.language_direction || 'ltr',
          engine: 'weasyprint',
        });

        const pdfOutputPath = path.resolve(output);
        await generatePdf(pdfDoc.html, { outputPath: pdfOutputPath, quiet });
        console.error(`✓ PDF written to ${pdfOutputPath}`);
        process.exit(0);
        return;
      }

      default:
        console.error(`Error: Unknown command "${command}"`);
        console.error(
          'Valid commands: getAllCatalogEntries, getResourceData, renderHtml, assemblePrint, generatePdf'
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
