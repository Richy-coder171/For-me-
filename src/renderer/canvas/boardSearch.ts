import type { BoardFile, CanvasNode } from '../../shared/schemas/board'

export type BoardSearchType = CanvasNode['type'] | 'all'

export interface BoardSearchResult {
  nodeId: string
  type: CanvasNode['type']
  title: string
  excerpt: string
  tags: string[]
}

function fieldsFor(node: CanvasNode): { title: string; content: string } {
  switch (node.type) {
    case 'note':
      return { title: node.title || 'Note', content: node.content }
    case 'checklist':
      return { title: node.title || 'Checklist', content: node.items.map(({ text }) => text).join(' ') }
    case 'image':
      return { title: node.caption || node.altText || 'Image', content: `${node.altText} ${node.caption}` }
    case 'local-video':
      return { title: node.caption || 'Local video', content: node.caption }
    case 'embedded-video':
      return { title: node.caption || `${node.provider} video`, content: `${node.url} ${node.caption}` }
    case 'timestamp-note':
      return { title: `Timestamp ${Math.floor(node.timestampSeconds / 60)}:${String(Math.floor(node.timestampSeconds % 60)).padStart(2, '0')}`, content: node.content }
    case 'link':
      return { title: node.title || node.domain, content: `${node.description} ${node.domain} ${node.url}` }
    case 'file':
      return { title: node.filename, content: `${node.filename} ${node.extension}` }
    case 'frame':
      return { title: node.title || 'Frame', content: node.title }
  }
}

function excerpt(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length > 140 ? `${compact.slice(0, 137)}…` : compact
}

export function searchBoard(
  board: BoardFile,
  query: string,
  type: BoardSearchType = 'all',
  tag = ''
): BoardSearchResult[] {
  const terms = query
    .normalize('NFKC')
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const normalizedTag = tag.trim().toLocaleLowerCase()
  if (terms.length === 0 && !normalizedTag) return []

  return board.nodes.flatMap((node) => {
    if (type !== 'all' && node.type !== type) return []
    if (
      normalizedTag &&
      !node.tags.some((candidate) => candidate.toLocaleLowerCase().includes(normalizedTag))
    ) {
      return []
    }
    const fields = fieldsFor(node)
    const haystack = `${fields.title} ${fields.content} ${node.tags.join(' ')}`.toLocaleLowerCase()
    if (!terms.every((term) => haystack.includes(term))) return []
    return [
      {
        nodeId: node.id,
        type: node.type,
        title: fields.title,
        excerpt: excerpt(fields.content),
        tags: node.tags
      }
    ]
  })
}
