/**
 * The error the pipeline's stages throw, so a caller can tell a missing
 * resource from a network failure from bad input without parsing messages.
 *
 *   code    'NOT_FOUND'     DCS answered 404, or nothing is published
 *           'HTTP'          DCS answered another error status
 *           'NETWORK'       no answer (unreachable, timed out)
 *           'INVALID_INPUT' the arguments or the catalog entry cannot be used
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
