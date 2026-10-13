/**
 * AI jawab ke liye chhota markdown → HTML. Pehle sab kuch escape, phir sirf ye shaklein:
 * #/##/### heading, **bold**, *italic*, `code`, - / 1. list, | table |, [text](/app/...) link (sirf app ke andar), --- line.
 * Angular [innerHTML] dobara sanitize karta hai. Koi raw HTML, script ya bahar ka link nahi banta.
 */
export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // ``` code block
    if (trimmed.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) body.push(lines[i++]!);
      i++;
      out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = Math.min(heading[1]!.length + 2, 6);   // # → h3 (page ke andar chhota)
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (isTableRow(trimmed) && i + 1 < lines.length && isDivider(lines[i + 1]!.trim())) {
      const head = cells(trimmed);
      const align = cells(lines[i + 1]!.trim()).map(c => (c.endsWith(':') && !c.startsWith(':') ? 'end' : ''));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i]!.trim())) rows.push(cells(lines[i++]!.trim()));
      const th = head.map((c, k) => `<th${align[k] ? ' class="end"' : ''}>${inline(c)}</th>`).join('');
      const tb = rows
        .map(r => `<tr>${head.map((_, k) => `<td${align[k] ? ' class="end num"' : ''}>${inline(r[k] ?? '')}</td>`).join('')}</tr>`)
        .join('');
      out.push(`<div class="md-table"><table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`);
      continue;
    }

    const bullet = /^[-*•]\s+/;
    const numbered = /^\d+[.)]\s+/;
    if (bullet.test(trimmed) || numbered.test(trimmed)) {
      const ordered = numbered.test(trimmed);
      const marker = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i]!.trim())) items.push(lines[i++]!.trim().replace(marker, ''));
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map(it => `<li>${inline(it)}</li>`).join('')}</${tag}>`);
      continue;
    }

    // paragraph: agli khaali line / block tak
    const para: string[] = [];
    while (i < lines.length) {
      const t = lines[i]!.trim();
      if (!t || t.startsWith('```') || /^#{1,4}\s/.test(t) || bullet.test(t) || numbered.test(t)
        || (isTableRow(t) && i + 1 < lines.length && isDivider(lines[i + 1]!.trim()))) break;
      para.push(t);
      i++;
    }
    out.push(`<p>${para.map(inline).join('<br>')}</p>`);
  }
  return out.join('');
}

function isTableRow(line: string): boolean {
  return line.startsWith('|') && line.endsWith('|') && line.length > 2;
}

function isDivider(line: string): boolean {
  return isTableRow(line) && /^\|(\s*:?-{2,}:?\s*\|)+$/.test(line);
}

function cells(line: string): string[] {
  return line.slice(1, -1).split('|').map(c => c.trim());
}

function inline(text: string): string {
  const codes: string[] = [];
  let s = escapeHtml(text).replace(/`([^`]+)`/g, (_, c: string) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_(?!\s)(.+?)_(?=$|[\s).,!?:;])/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((\/app\/[^)\s]*)\)/g, (_, label: string, href: string) =>
      href.includes('//') || href.includes(':') ? label : `<a href="${href}">${label}</a>`);
  return s.replace(/\u0000(\d+)\u0000/g, (_, n: string) => codes[Number(n)] ?? '');
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Copy ke liye: markdown ke nishan hata kar saada text. */
export function plainText(source: string): string {
  return source
    .replace(/```[a-z]*\n?/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,4}\s+/gm, '')
    .trim();
}
