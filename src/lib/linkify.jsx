import React from "react";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const TRAILING_PUNCT = /[.,;:)\]]+$/;

/**
 * Splits text on http(s) URLs and renders matches as anchor tags.
 * Trailing punctuation (. , ; : ) ]) is excluded from the link target
 * and rendered as plain text instead.
 *
 * Safe by default: the matched URL string is used both as link text and href;
 * no dangerouslySetInnerHTML is used.
 */
export function renderTextWithLinks(text) {
  if (!text) return text;
  const parts = String(text).split(URL_REGEX);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // URL match
      const trailingMatch = part.match(TRAILING_PUNCT);
      const trailing = trailingMatch ? trailingMatch[0] : "";
      const url = trailing ? part.slice(0, -trailing.length) : part;
      return (
        <React.Fragment key={i}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80 break-words"
          >
            {url}
          </a>
          {trailing}
        </React.Fragment>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
