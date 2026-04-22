(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    global.EmlParser = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function decodeBase64(str) {
    try {
      const binary = atob(str.replace(/\s+/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    } catch (e) {
      return null;
    }
  }

  function decodeQuotedPrintable(str, charset) {
    // Remove soft line breaks
    let decoded = str.replace(/=(?:\r\n|\n|\r)/g, '');
    const bytes = [];
    for (let i = 0; i < decoded.length; i++) {
      if (decoded[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(decoded.substr(i + 1, 2))) {
        bytes.push(parseInt(decoded.substr(i + 1, 2), 16));
        i += 2;
      } else {
        bytes.push(decoded.charCodeAt(i) & 0xFF);
      }
    }
    return new Uint8Array(bytes);
  }

  function bytesToString(bytes, charset) {
    charset = (charset || 'utf-8').toLowerCase().replace(/_/g, '-');
    if (charset === 'us-ascii') charset = 'utf-8';
    try {
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder(charset, { fatal: false }).decode(bytes);
      }
    } catch (e) {}
    // Fallback for iso-8859-1
    if (charset === 'iso-8859-1') {
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return s;
    }
    // Fallback: try UTF-8 decode manually
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
  }

  function decodeTransferEncoding(body, encoding, charset) {
    encoding = (encoding || '7bit').toLowerCase().trim();
    if (encoding === 'base64') {
      const bytes = decodeBase64(body);
      return bytes ? bytesToString(bytes, charset) : body;
    }
    if (encoding === 'quoted-printable') {
      const bytes = decodeQuotedPrintable(body, charset);
      return bytesToString(bytes, charset);
    }
    // 7bit, 8bit, binary
    const bytes = new Uint8Array(body.length);
    for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xFF;
    return bytesToString(bytes, charset);
  }

  function decodeRfc2047Word(word) {
    // =?charset?Q?...?= or =?charset?B?...?=
    const m = word.match(/^=\?([^?]+)\?(Q|B)\?([^?]+)\?=/i);
    if (!m) return word;
    const charset = m[1];
    const type = m[2].toUpperCase();
    let data = m[3];
    if (type === 'Q') {
      // Quoted-printable but with _ as space
      data = data.replace(/_/g, ' ');
      const bytes = decodeQuotedPrintable(data, charset);
      return bytesToString(bytes, charset);
    } else {
      const bytes = decodeBase64(data);
      return bytes ? bytesToString(bytes, charset) : data;
    }
  }

  function decodeHeaderValue(value) {
    if (!value) return value;
    // Handle multiple encoded words and plain text mixed
    // Pattern: =?charset?Q?...?= or spaces between encoded words
    return value.replace(/=\?[^?]+\?[QB]\?[^?]+\?=/gi, function (match) {
      return decodeRfc2047Word(match);
    }).replace(/\s+/g, ' ').trim();
  }

  function parseHeaderParams(value) {
    const params = {};
    let inQuote = false;
    let key = '';
    let val = '';
    let state = 'key'; // key, before-val, val, qval
    let i = 0;
    while (i < value.length) {
      const ch = value[i];
      if (state === 'key') {
        if (ch === '=') {
          key = key.trim().toLowerCase();
          state = 'before-val';
        } else if (ch === ';') {
          key = key.trim().toLowerCase();
          if (key) params[key] = '';
          key = '';
        } else {
          key += ch;
        }
      } else if (state === 'before-val') {
        if (ch === '"') {
          state = 'qval';
          val = '';
        } else if (ch === ';') {
          params[key] = val.trim();
          key = ''; val = '';
          state = 'key';
        } else {
          state = 'val';
          val = ch;
        }
      } else if (state === 'val') {
        if (ch === ';') {
          params[key] = val.trim();
          key = ''; val = '';
          state = 'key';
        } else {
          val += ch;
        }
      } else if (state === 'qval') {
        if (ch === '"' && value[i - 1] !== '\\') {
          params[key] = val;
          key = ''; val = '';
          state = 'key';
        } else {
          val += ch;
        }
      }
      i++;
    }
    if (state === 'val' || state === 'qval') {
      params[key] = val.trim();
    }
    return params;
  }

  function parseContentType(value) {
    if (!value) return { type: 'text/plain', params: {} };
    const semi = value.indexOf(';');
    const type = (semi >= 0 ? value.substring(0, semi) : value).trim().toLowerCase();
    const params = semi >= 0 ? parseHeaderParams(value.substring(semi + 1)) : {};
    return { type, params };
  }

  function unfoldHeaders(text) {
    // Replace CRLF + WSP or LF + WSP with a single space
    return text.replace(/\r\n([ \t])/g, '$1').replace(/\n([ \t])/g, '$1').replace(/\r([ \t])/g, '$1');
  }

  function parseHeaders(text) {
    const headers = {};
    const lines = unfoldHeaders(text).split(/\r\n|\n|\r/);
    for (const line of lines) {
      const colon = line.indexOf(':');
      if (colon > 0) {
        const name = line.substring(0, colon).trim();
        const value = line.substring(colon + 1).trim();
        const lower = name.toLowerCase();
        if (!headers[lower]) headers[lower] = [];
        headers[lower].push({ name, value: decodeHeaderValue(value) });
      }
    }
    return headers;
  }

  function getHeader(headers, name) {
    const arr = headers[name.toLowerCase()];
    return arr ? arr[0].value : '';
  }

  function getHeaderAll(headers, name) {
    const arr = headers[name.toLowerCase()];
    return arr ? arr.map(h => h.value) : [];
  }

  function splitBody(raw) {
    // Find first blank line (CRLF CRLF or LF LF)
    let idx = raw.indexOf('\r\n\r\n');
    let headerLen = 4;
    if (idx === -1) {
      idx = raw.indexOf('\n\n');
      headerLen = 2;
    }
    if (idx === -1) {
      idx = raw.indexOf('\r\r');
      headerLen = 2;
    }
    if (idx === -1) {
      return { headers: raw, body: '' };
    }
    return { headers: raw.substring(0, idx), body: raw.substring(idx + headerLen) };
  }

  function extractBoundary(contentType) {
    const m = contentType.match(/boundary=([^;]+)/i);
    if (!m) return null;
    let b = m[1].trim();
    if (b[0] === '"' && b[b.length - 1] === '"') b = b.slice(1, -1);
    return b;
  }

  function parseAddresses(str) {
    if (!str) return [];
    // Simple address parser: split by commas not inside < > or quotes
    const addrs = [];
    let depth = 0;
    let inQuote = false;
    let current = '';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"' && str[i - 1] !== '\\') inQuote = !inQuote;
      else if (!inQuote && ch === '<') depth++;
      else if (!inQuote && ch === '>') depth--;
      else if (!inQuote && depth === 0 && ch === ',') {
        addrs.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) addrs.push(current.trim());
    return addrs;
  }

  function parseSinglePart(rawBody, headers) {
    const ct = getHeader(headers, 'Content-Type') || 'text/plain';
    const cte = getHeader(headers, 'Content-Transfer-Encoding') || '7bit';
    const cd = getHeader(headers, 'Content-Disposition') || '';
    const contentType = parseContentType(ct);
    const dispParams = parseHeaderParams(cd.indexOf(';') >= 0 ? cd.substring(cd.indexOf(';') + 1) : '');
    const disposition = (cd.split(';')[0] || '').trim().toLowerCase();
    const filename = dispParams.filename || contentType.params.name || '';
    const charset = contentType.params.charset || 'utf-8';

    const bodyText = decodeTransferEncoding(rawBody, cte, charset);

    return {
      headers,
      contentType,
      transferEncoding: cte,
      disposition,
      filename: decodeHeaderValue(filename),
      charset,
      body: bodyText,
      rawBody,
      isAttachment: disposition === 'attachment' || !!filename
    };
  }

  function parseMimeParts(body, boundary) {
    const parts = [];
    if (!boundary) return parts;
    const delim = '--' + boundary;
    const closeDelim = '--' + boundary + '--';

    // Normalize line endings to \n for reliable line-by-line boundary matching
    const normalized = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');

    let inPart = false;
    let partLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === delim || line === closeDelim) {
        if (inPart && partLines.length > 0) {
          const partText = partLines.join('\n');
          const split = splitBody(partText);
          const partHeaders = parseHeaders(split.headers);
          const part = parseSinglePart(split.body, partHeaders);

          // Recurse for nested multiparts
          const nestedBoundary = extractBoundary(getHeader(partHeaders, 'Content-Type') || '');
          if (nestedBoundary) {
            part.parts = parseMimeParts(split.body, nestedBoundary);
          }
          // message/rfc822
          if (part.contentType.type === 'message/rfc822') {
            try {
              part.message = parseEml(split.body);
            } catch (e) { /* ignore */ }
          }

          parts.push(part);
          partLines = [];
        }
        inPart = true;
        if (line === closeDelim) break;
      } else if (inPart) {
        partLines.push(line);
      }
    }
    return parts;
  }

  function collectBodies(parts, result) {
    result = result || { textBody: '', htmlBody: '', attachments: [] };
    for (const part of parts) {
      if (part.parts) {
        collectBodies(part.parts, result);
      } else if (part.contentType.type === 'message/rfc822' && part.message) {
        if (part.message.textBody) result.textBody = result.textBody || part.message.textBody;
        if (part.message.htmlBody) result.htmlBody = result.htmlBody || part.message.htmlBody;
        result.attachments.push(...part.message.attachments);
      } else if (part.isAttachment) {
        result.attachments.push(part);
      } else if (part.contentType.type === 'text/plain') {
        result.textBody = result.textBody || part.body;
      } else if (part.contentType.type === 'text/html') {
        result.htmlBody = result.htmlBody || part.body;
      }
    }
    return result;
  }

  function parseEml(input) {
    let raw = '';
    if (typeof input === 'string') {
      raw = input;
    } else if (input instanceof ArrayBuffer) {
      raw = bytesToString(new Uint8Array(input), 'utf-8');
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
      raw = input.toString('utf-8');
    } else if (input && typeof input.length !== 'undefined') {
      raw = bytesToString(new Uint8Array(input), 'utf-8');
    }

    // Strip optional "From " mbox line
    if (raw.substring(0, 5) === 'From ') {
      const nl = raw.indexOf('\n');
      if (nl > 0) raw = raw.substring(nl + 1);
    }

    const split = splitBody(raw);
    const headers = parseHeaders(split.headers);

    const ct = getHeader(headers, 'Content-Type') || 'text/plain';
    const contentType = parseContentType(ct);
    const boundary = extractBoundary(ct);

    let parts = [];
    let textBody = '';
    let htmlBody = '';
    let attachments = [];

    if (boundary) {
      parts = parseMimeParts(split.body, boundary);
      const collected = collectBodies(parts, { textBody: '', htmlBody: '', attachments: [] });
      textBody = collected.textBody;
      htmlBody = collected.htmlBody;
      attachments = collected.attachments;
    } else {
      const cte = getHeader(headers, 'Content-Transfer-Encoding') || '7bit';
      const charset = contentType.params.charset || 'utf-8';
      textBody = decodeTransferEncoding(split.body, cte, charset);
      if (contentType.type === 'text/html') {
        htmlBody = textBody;
        textBody = '';
      }
    }

    return {
      headers,
      from: getHeader(headers, 'From'),
      to: parseAddresses(getHeader(headers, 'To')),
      cc: parseAddresses(getHeader(headers, 'Cc')),
      bcc: parseAddresses(getHeader(headers, 'Bcc')),
      subject: getHeader(headers, 'Subject'),
      date: getHeader(headers, 'Date'),
      messageId: getHeader(headers, 'Message-ID'),
      contentType,
      parts,
      textBody,
      htmlBody,
      attachments,
      rawHeaders: split.headers,
      rawBody: split.body
    };
  }

  return { parseEml, decodeHeaderValue, decodeTransferEncoding, parseContentType };
}));
