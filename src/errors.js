/**
 * The error the pipeline's stages throw, so a caller can tell a missing
 * resource from a network failure from bad input without parsing messages.
 *
 *   code    'NOT_FOUND'     DCS answered 404, nothing is published, or a file is
 *                           missing from a local checkout
 *           'HTTP'          DCS answered another error status, or a response
 *                           this library cannot use (no data, a search that
 *                           never ends)
 *           'NETWORK'       no answer (unreachable, timed out)
 *           'INVALID_INPUT' the arguments, a catalog entry, or a resource's
 *                           content cannot be used (e.g. USFM that cannot be
 *                           processed)
 *           'UNSUPPORTED'   a subject, metadata type or flavor not handled
 *           'NO_CONTENT'    the resource has none of the requested content
 *   status  the HTTP status, when there was one
 *   url     the URL requested, when there was one
 *   cause   the underlying error, when there was one
 */
export class ResourceError extends Error {
  constructor(message, { code, status, url, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ResourceError';
    this.code = code || (status === 404 ? 'NOT_FOUND' : status ? 'HTTP' : undefined);
    if (status) this.status = status;
    if (url) this.url = url;
  }

  /**
   * Wrap whatever a read of a resource threw, with a code from the table: an
   * inner ResourceError keeps its code, status and URL; a failed request keeps
   * its status (or is NETWORK) and URL; a file missing from a local checkout is
   * NOT_FOUND; anything else (content that cannot be processed) is INVALID_INPUT.
   *
   * @param {string} message - What was being done, e.g. "Failed to read book tit"
   * @param {*} error
   * @returns {ResourceError}
   */
  static wrap(message, error) {
    if (error instanceof ResourceError) {
      return new ResourceError(`${message}: ${error.message}`, {
        code: error.code,
        status: error.status,
        url: error.url,
        cause: error,
      });
    }
    if (error?.isAxiosError || error?.response || error?.request) {
      return ResourceError.fromRequest(message, error, error?.config?.url);
    }
    return new ResourceError(`${message}: ${error?.message || error}`, {
      code: error?.code === 'ENOENT' ? 'NOT_FOUND' : 'INVALID_INPUT',
      cause: error,
    });
  }

  /** Wrap a failed HTTP request (axios), keeping its status and URL. */
  static fromRequest(message, error, url) {
    const status = error?.response?.status;
    return new ResourceError(`${message}: ${error?.message || error}`, {
      code: status ? undefined : 'NETWORK',
      status,
      url,
      cause: error,
    });
  }
}
