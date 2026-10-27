'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type InlineToken =
  | { type: 'text'; text: string; key: number }
  | { type: 'code'; text: string; key: number }
  | { type: 'bold'; text: string; key: number }
  | { type: 'italic'; text: string; key: number }
  | { type: 'boldItalic'; text: string; key: number }
  | { type: 'strike'; text: string; key: number }
  | { type: 'link'; text: string; url: string; key: number };

function isSafeUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|\/|#)/i.test(url.trim());
}

function parseInline(text: string): React.ReactNode[] {
  const tokens: InlineToken[] = [];
  let remaining = text;

  const linkRegex = /^\[([^\]]+)\]\(([^)]+)\)/;
  const boldItalicRegex = /^(\*\*\*|___)(.+?)\1/;
  const boldRegex = /^(\*\*|__)(.+?)\1/;
  const italicRegex = /^(\*|_)(.+?)\1/;
  const strikeRegex = /^~~(.+?)~~/;
  const codeRegex = /^`([^`]+)`/;

  let key = 0;
  while (remaining.length > 0) {
    let match: RegExpMatchArray | null;

    if ((match = remaining.match(codeRegex))) {
      tokens.push({ type: 'code', text: match[1], key: key++ });
      remaining = remaining.slice(match[0].length);
    } else if ((match = remaining.match(boldItalicRegex))) {
      tokens.push({ type: 'boldItalic', text: match[2], key: key++ });
      remaining = remaining.slice(match[0].length);
    } else if ((match = remaining.match(boldRegex))) {
      tokens.push({ type: 'bold', text: match[2], key: key++ });
      remaining = remaining.slice(match[0].length);
    } else if ((match = remaining.match(strikeRegex))) {
      tokens.push({ type: 'strike', text: match[1], key: key++ });
      remaining = remaining.slice(match[0].length);
    } else if ((match = remaining.match(italicRegex))) {
      tokens.push({ type: 'italic', text: match[2], key: key++ });
      remaining = remaining.slice(match[0].length);
    } else if ((match = remaining.match(linkRegex))) {
      tokens.push({ type: 'link', text: match[1], url: match[2], key: key++ });
      remaining = remaining.slice(match[0].length);
    } else {
      const nextSpecial = remaining.search(/[`*_~\[]/);
      if (nextSpecial === -1) {
        tokens.push({ type: 'text', text: remaining, key: key++ });
        break;
      } else if (nextSpecial === 0) {
        tokens.push({ type: 'text', text: remaining[0], key: key++ });
        remaining = remaining.slice(1);
      } else {
        tokens.push({ type: 'text', text: remaining.slice(0, nextSpecial), key: key++ });
        remaining = remaining.slice(nextSpecial);
      }
    }
  }

  return tokens.map((token) => {
    switch (token.type) {
      case 'code':
        return (
          <code
            key={token.key}
            className="rounded bg-secondary/80 px-1.5 py-0.5 font-mono text-xs text-primary border border-border/40"
          >
            {token.text}
          </code>
        );
      case 'boldItalic':
        return (
          <strong key={token.key} className="font-semibold">
            <em className="italic">{token.text}</em>
          </strong>
        );
      case 'bold':
        return (
          <strong key={token.key} className="font-semibold text-foreground">
            {token.text}
          </strong>
        );
      case 'italic':
        return (
          <em key={token.key} className="italic">
            {token.text}
          </em>
        );
      case 'strike':
        return (
          <del key={token.key} className="line-through text-muted-foreground">
            {token.text}
          </del>
        );
      case 'link': {
        const safe = isSafeUrl(token.url);
        return (
          <a
            key={token.key}
            href={safe ? token.url : '#'}
            target={safe && !token.url.startsWith('#') ? '_blank' : undefined}
            rel={safe && !token.url.startsWith('#') ? 'noopener noreferrer' : undefined}
            className="text-primary underline font-medium hover:opacity-80 transition-opacity"
          >
            {token.text}
          </a>
        );
      }
      case 'text':
      default:
        return <React.Fragment key={token.key}>{token.text}</React.Fragment>;
    }
  });
}

type Block =
  | { type: 'heading'; level: number; content: string }
  | { type: 'paragraph'; content: string }
  | {
      type: 'list';
      ordered: boolean;
      items: { content: string; checked?: boolean; indent: number }[];
    }
  | { type: 'blockquote'; content: string }
  | { type: 'codeblock'; lang: string; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'hr' };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code blocks
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```
      blocks.push({ type: 'codeblock', lang, content: codeLines.join('\n') });
      continue;
    }

    // 2. Horizontal Rule (---, ***, ___)
    if (/^\s*([*\-_])\s*(\1\s*){2,}$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 3. Headings (# Heading)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 4. Blockquotes (> quote)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', content: quoteLines.join('\n') });
      continue;
    }

    // 5. Tables (| col | col |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      let tempIndex = i;
      while (tempIndex < lines.length && lines[tempIndex].trim().startsWith('|') && lines[tempIndex].trim().endsWith('|')) {
        tableLines.push(lines[tempIndex].trim());
        tempIndex++;
      }
      if (tableLines.length >= 2 && /^\|[\s-:]+\|/.test(tableLines[1])) {
        const parseRow = (row: string) =>
          row
            .slice(1, -1)
            .split('|')
            .map((cell) => cell.trim());
        const headers = parseRow(tableLines[0]);
        const rows = tableLines.slice(2).map(parseRow);
        blocks.push({ type: 'table', headers, rows });
        i = tempIndex;
        continue;
      }
    }

    // 6. Lists (bullet or ordered or task)
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const items: { content: string; checked?: boolean; indent: number }[] = [];
      const ordered = /^\d+\./.test(listMatch[2]);
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (!itemMatch) break;
        const rawContent = itemMatch[3];
        const taskMatch = rawContent.match(/^\[([ xX])\]\s+(.*)$/);
        if (taskMatch) {
          items.push({
            checked: taskMatch[1].toLowerCase() === 'x',
            content: taskMatch[2],
            indent: itemMatch[1].length,
          });
        } else {
          items.push({
            content: rawContent,
            indent: itemMatch[1].length,
          });
        }
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // 7. Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // 8. Paragraphs
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].match(/^(#{1,6})\s+/) &&
      !lines[i].trim().startsWith('>') &&
      !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) &&
      !lines[i].match(/^(\s*)([-*+]|\d+\.)\s+/) &&
      !/^\s*([*\-_])\s*(\1\s*){2,}$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', content: paraLines.join('\n') });
    }
  }

  return blocks;
}

export interface MarkdownViewProps {
  content?: string | null;
  className?: string;
  placeholder?: string;
}

export function MarkdownView({ content, className, placeholder = 'No instructions provided.' }: MarkdownViewProps) {
  if (!content || !content.trim()) {
    return <p className={cn('text-sm text-muted italic', className)}>{placeholder}</p>;
  }

  const blocks = parseBlocks(content);

  return (
    <div className={cn('space-y-2 text-sm text-foreground break-words', className)}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            if (block.level === 1) {
              return (
                <h1 key={idx} className="text-base font-bold text-foreground border-b border-border/40 pb-1 mt-3 mb-1.5">
                  {parseInline(block.content)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2 key={idx} className="text-sm font-bold text-foreground border-b border-border/30 pb-0.5 mt-2.5 mb-1">
                  {parseInline(block.content)}
                </h2>
              );
            }
            if (block.level === 3) {
              return (
                <h3 key={idx} className="text-sm font-semibold text-foreground mt-2 mb-1">
                  {parseInline(block.content)}
                </h3>
              );
            }
            return (
              <h4 key={idx} className="text-xs font-semibold uppercase tracking-wider text-muted mt-2 mb-1">
                {parseInline(block.content)}
              </h4>
            );
          }

          case 'paragraph': {
            // Support soft breaks with whitespace-pre-wrap or newline rendering
            const lines = block.content.split('\n');
            return (
              <p key={idx} className="leading-relaxed my-1.5">
                {lines.map((line, lineIdx) => (
                  <React.Fragment key={lineIdx}>
                    {parseInline(line)}
                    {lineIdx < lines.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            );
          }

          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul';
            const listClass = block.ordered
              ? 'list-decimal pl-5 space-y-1 my-1.5'
              : 'list-disc pl-5 space-y-1 my-1.5';

            return (
              <ListTag key={idx} className={listClass}>
                {block.items.map((item, itemIdx) => {
                  if (item.checked !== undefined) {
                    return (
                      <li key={itemIdx} className="list-none -ml-4 flex items-start gap-2 my-1">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          readOnly
                          className="mt-0.5 pointer-events-none"
                        />
                        <span className={item.checked ? 'line-through text-muted' : ''}>
                          {parseInline(item.content)}
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={itemIdx} className="leading-relaxed">
                      {parseInline(item.content)}
                    </li>
                  );
                })}
              </ListTag>
            );
          }

          case 'blockquote': {
            return (
              <blockquote
                key={idx}
                className="border-l-4 border-primary/50 bg-primary/5 pl-3 py-1.5 my-2 rounded-r italic text-foreground/90"
              >
                {block.content.split('\n').map((line, lineIdx) => (
                  <p key={lineIdx} className="leading-relaxed my-0.5">
                    {parseInline(line)}
                  </p>
                ))}
              </blockquote>
            );
          }

          case 'codeblock': {
            return (
              <div key={idx} className="my-2 rounded-xl border border-border bg-card/80 overflow-hidden shadow-sm">
                {block.lang && (
                  <div className="flex items-center justify-between border-b border-border/50 bg-secondary/40 px-3 py-1 text-[11px] font-mono text-muted uppercase tracking-wider">
                    <span>{block.lang}</span>
                  </div>
                )}
                <pre className="p-3 font-mono text-xs overflow-x-auto text-foreground leading-normal">
                  <code>{block.content}</code>
                </pre>
              </div>
            );
          }

          case 'table': {
            return (
              <div key={idx} className="my-2 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-secondary/60 text-foreground font-semibold">
                    <tr>
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx} className="border-b border-border px-3 py-2">
                          {parseInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className={rowIdx % 2 === 1 ? 'bg-secondary/20' : 'bg-transparent'}
                      >
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="border-b border-border/40 px-3 py-1.5">
                            {parseInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          case 'hr': {
            return <hr key={idx} className="my-3 border-border/60" />;
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
