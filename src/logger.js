/**
 * The library's logging, per call (no module state, so concurrent calls with
 * different settings do not affect each other).
 *
 *   info  progress: the URLs fetched. Silenced by `quiet`.
 *   warn  something the caller should know: a book or supporting resource
 *         that could not be read, GL quotes that could not be worked out.
 *         Always reported; `quiet` does not silence it.
 *
 * `options.logger` replaces the console ({ info, warn }; a missing method falls
 * back to the console's). The CLI passes one that writes to stderr, so its JSON
 * on stdout stays clean.
 *
 * @param {{ quiet?: boolean, logger?: { info?: Function, warn?: Function } }} [options]
 * @returns {{ info: Function, warn: Function }}
 */
export function loggerFor(options = {}) {
  const sink = options.logger || {};
  const info =
    typeof sink.info === 'function'
      ? sink.info.bind(sink)
      : // The one place the library writes progress to the console.
        // eslint-disable-next-line no-console
        console.info.bind(console);
  const warn = typeof sink.warn === 'function' ? sink.warn.bind(sink) : console.warn.bind(console);
  return { info: options.quiet ? () => {} : info, warn };
}
