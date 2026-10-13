/**
 * TipTap ke apne nodes — letter template ki zubaan:
 *  field     <span data-field="employee.fullName" data-format="upper" data-label="Full name">«Full name»</span>
 *  ifBlock   <section data-if="employee.gender" data-op="eq" data-value="Female" data-label="…">…</section>
 *  repeat    <tr data-repeat="pay.earnings"> (TableRow par ek attribute)
 *  pageBreak <div data-type="page-break"></div>
 * Yahi HTML server par save hota hai (LetterHtml.Clean in data-* ko rehne deta hai) aur letter-render.ts isi ko bharta hai.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { TableRow } from '@tiptap/extension-table';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    rbField: { insertField: (attrs: { field: string; format?: string | null; label: string }) => ReturnType };
    rbIf: { wrapInIf: (attrs: { field: string; op: string; value: string | null; label: string }) => ReturnType; unwrapIf: () => ReturnType };
    rbBreak: { insertPageBreak: () => ReturnType };
  }
}

export const FieldNode = Node.create({
  name: 'field',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      field: { default: '', parseHTML: el => el.getAttribute('data-field'), renderHTML: a => ({ 'data-field': a['field'] }) },
      format: {
        default: null,
        parseHTML: el => el.getAttribute('data-format') || null,
        renderHTML: a => (a['format'] ? { 'data-format': a['format'] } : {})
      },
      label: {
        default: null,
        parseHTML: el => el.getAttribute('data-label') || el.textContent?.replace(/[«»]/g, '').split(' | ')[0] || null,
        renderHTML: a => (a['label'] ? { 'data-label': a['label'] } : {})
      }
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-field]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const a = node.attrs;
    return ['span', mergeAttributes(HTMLAttributes, { class: 'rb-field' }), `«${a['label'] || a['field']}${a['format'] ? ' | ' + a['format'] : ''}»`];
  },

  renderText({ node }) {
    return `«${node.attrs['label'] || node.attrs['field']}»`;
  },

  addCommands() {
    return {
      insertField: attrs => ({ commands }) => commands.insertContent({ type: this.name, attrs })
    };
  }
});

export const IfBlock = Node.create({
  name: 'ifBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      field: { default: '', parseHTML: el => el.getAttribute('data-if'), renderHTML: a => ({ 'data-if': a['field'] }) },
      op: { default: 'notempty', parseHTML: el => el.getAttribute('data-op') || 'notempty', renderHTML: a => ({ 'data-op': a['op'] }) },
      value: {
        default: null,
        parseHTML: el => el.getAttribute('data-value'),
        renderHTML: a => (a['value'] ? { 'data-value': a['value'] } : {})
      },
      label: { default: '', parseHTML: el => el.getAttribute('data-label') ?? '', renderHTML: a => ({ 'data-label': a['label'] }) }
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-if]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { class: 'rb-if' }), 0];
  },

  addCommands() {
    return {
      wrapInIf: attrs => ({ commands }) => commands.wrapIn(this.name, attrs),
      unwrapIf: () => ({ commands }) => commands.lift(this.name)
    };
  }
});

/** Table row + "har item ke liye dohrao". */
export const RepeatRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      repeat: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-repeat'),
        renderHTML: (a: Record<string, unknown>) => (a['repeat'] ? { 'data-repeat': a['repeat'], class: 'rb-repeat' } : {})
      },
      repeatLabel: {
        default: null,
        parseHTML: (el: HTMLElement) => (el.getAttribute('data-repeat') ? el.getAttribute('data-label') : null),
        renderHTML: (a: Record<string, unknown>) => (a['repeat'] && a['repeatLabel'] ? { 'data-label': a['repeatLabel'] } : {})
      }
    };
  }
});

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }];
  },

  renderHTML() {
    return ['div', { 'data-type': 'page-break', class: 'rb-break' }];
  },

  addCommands() {
    return {
      insertPageBreak: () => ({ commands }) => commands.insertContent({ type: this.name })
    };
  }
});
