import { z } from 'zod'

import { boardFileSchema, createEmptyBoard, type BoardFile } from './schemas/board'

export const TEMPLATE_IDS = [
  'video-research',
  'study-board',
  'moodboard',
  'project-planning',
  'content-planning',
  'learning-roadmap'
] as const

export const templateIdSchema = z.enum(TEMPLATE_IDS)
export type TemplateId = z.infer<typeof templateIdSchema>

export interface BoardTemplate {
  id: TemplateId
  name: string
  description: string
}

export const BOARD_TEMPLATES: readonly BoardTemplate[] = [
  {
    id: 'video-research',
    name: 'Video research',
    description: 'Capture questions, observations, and timestamped findings.'
  },
  {
    id: 'study-board',
    name: 'Study board',
    description: 'Organize a topic, key ideas, and a practical study checklist.'
  },
  {
    id: 'moodboard',
    name: 'Moodboard',
    description: 'Collect visual direction, references, palette notes, and themes.'
  },
  {
    id: 'project-planning',
    name: 'Project planning',
    description: 'Lay out goals, milestones, risks, and next actions.'
  },
  {
    id: 'content-planning',
    name: 'Content planning',
    description: 'Move ideas from backlog through drafting and publication.'
  },
  {
    id: 'learning-roadmap',
    name: 'Learning roadmap',
    description: 'Connect foundations, practice projects, and future topics.'
  }
] as const

interface TemplateContent {
  nodes: unknown[]
  connections?: unknown[]
}

const textStyle = {
  background: 'paper',
  textColor: '#202124',
  fontSize: 16,
  textAlign: 'left'
} as const

type NoteBackground = 'paper' | 'amber' | 'rose' | 'mint' | 'sky' | 'slate'

function base(id: string, x: number, y: number, width: number, height: number, now: string) {
  return {
    id,
    x,
    y,
    width,
    height,
    rotation: 0,
    locked: false,
    tags: [],
    createdAt: now,
    updatedAt: now
  }
}

function note(
  id: string,
  x: number,
  y: number,
  title: string,
  content: string,
  now: string,
  background: NoteBackground = 'paper'
) {
  return {
    ...base(id, x, y, 300, 190, now),
    ...textStyle,
    background,
    type: 'note',
    title,
    content
  }
}

function checklist(id: string, x: number, y: number, title: string, items: string[], now: string) {
  return {
    ...base(id, x, y, 320, 230, now),
    ...textStyle,
    background: 'mint',
    type: 'checklist',
    title,
    items: items.map((text, index) => ({ id: `${id}:item:${index + 1}`, text, checked: false }))
  }
}

function frame(id: string, x: number, y: number, title: string, now: string) {
  return {
    ...base(id, x, y, 370, 560, now),
    type: 'frame',
    title,
    background: '#f7f7f5',
    border: '#d7d8dc'
  }
}

function connection(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  now: string,
  label = ''
) {
  return {
    id,
    type: 'arrow',
    sourceNodeId,
    targetNodeId,
    label,
    style: 'solid',
    createdAt: now,
    updatedAt: now
  }
}

function contentFor(templateId: TemplateId, now: string): TemplateContent {
  switch (templateId) {
    case 'video-research':
      return {
        nodes: [
          note('research-question', 0, 0, 'Research question', 'What do I want to learn?', now),
          checklist(
            'watch-list',
            370,
            0,
            'Before watching',
            ['Add the source video', 'Write the key questions', 'Capture timestamp notes'],
            now
          ),
          note(
            'key-finding',
            0,
            270,
            'Key finding',
            'Summarize the strongest evidence here.',
            now,
            'amber'
          ),
          note('follow-up', 370, 300, 'Follow-up', 'What should be verified next?', now, 'sky')
        ],
        connections: [
          connection('research-to-finding', 'research-question', 'key-finding', now),
          connection('finding-to-follow-up', 'key-finding', 'follow-up', now)
        ]
      }
    case 'study-board':
      return {
        nodes: [
          note('topic', 280, 0, 'Study topic', 'State the topic in one sentence.', now, 'sky'),
          note('concept-one', 0, 270, 'Core concept', 'Explain it in your own words.', now),
          note('concept-two', 350, 270, 'Example', 'Add a concrete worked example.', now, 'amber'),
          checklist(
            'study-checklist',
            700,
            270,
            'Study checklist',
            ['Review notes', 'Practice recall', 'Complete an exercise'],
            now
          )
        ],
        connections: [
          connection('topic-to-concept', 'topic', 'concept-one', now),
          connection('topic-to-example', 'topic', 'concept-two', now)
        ]
      }
    case 'moodboard':
      return {
        nodes: [
          note(
            'direction',
            300,
            0,
            'Creative direction',
            'Describe the feeling and audience.',
            now
          ),
          note(
            'palette',
            0,
            270,
            'Colour palette',
            'Add colours or import reference images.',
            now,
            'rose'
          ),
          note(
            'type',
            350,
            270,
            'Typography',
            'Collect type references and hierarchy ideas.',
            now,
            'sky'
          ),
          note(
            'texture',
            700,
            270,
            'Texture & imagery',
            'Drop images here and annotate what works.',
            now,
            'mint'
          )
        ],
        connections: [
          connection('direction-to-palette', 'direction', 'palette', now),
          connection('direction-to-type', 'direction', 'type', now),
          connection('direction-to-texture', 'direction', 'texture', now)
        ]
      }
    case 'project-planning':
      return {
        nodes: [
          note('project-goal', 0, 0, 'Project goal', 'Define the outcome and why it matters.', now),
          checklist(
            'next-actions',
            370,
            0,
            'Next actions',
            ['Confirm scope', 'Assign the first milestone', 'Review progress'],
            now
          ),
          note(
            'milestones',
            0,
            300,
            'Milestones',
            'List the meaningful delivery points.',
            now,
            'sky'
          ),
          note('risks', 370, 300, 'Risks & assumptions', 'What could change the plan?', now, 'rose')
        ],
        connections: [
          connection('goal-to-actions', 'project-goal', 'next-actions', now),
          connection('goal-to-milestones', 'project-goal', 'milestones', now)
        ]
      }
    case 'content-planning': {
      const columns = [
        ['ideas', 'Ideas'],
        ['drafting', 'Drafting'],
        ['review', 'Review'],
        ['published', 'Published']
      ] as const
      return {
        nodes: columns.flatMap(([id, title], index) => [
          frame(id, index * 410, 0, title, now),
          {
            ...note(`${id}-card`, 24, 70, `${title} item`, 'Edit this card to plan a piece.', now),
            parentFrameId: id
          }
        ])
      }
    }
    case 'learning-roadmap':
      return {
        nodes: [
          note(
            'foundation',
            0,
            160,
            '1. Foundations',
            'What must I understand first?',
            now,
            'mint'
          ),
          note(
            'practice',
            390,
            160,
            '2. Guided practice',
            'Choose exercises that build fluency.',
            now,
            'sky'
          ),
          note(
            'project',
            780,
            160,
            '3. Build a project',
            'Apply the skill to a useful outcome.',
            now,
            'amber'
          ),
          checklist(
            'next-topics',
            1170,
            140,
            '4. Go deeper',
            ['Review gaps', 'Choose an advanced topic', 'Teach what you learned'],
            now
          )
        ],
        connections: [
          connection('foundation-to-practice', 'foundation', 'practice', now),
          connection('practice-to-project', 'practice', 'project', now),
          connection('project-to-next', 'project', 'next-topics', now)
        ]
      }
  }
}

export function createBoardFromTemplate(
  id: string,
  templateId: TemplateId,
  now = new Date()
): BoardFile {
  const template = BOARD_TEMPLATES.find(({ id: candidate }) => candidate === templateId)
  if (!template) throw new Error('Unknown board template.')
  const board = createEmptyBoard(id, template.name, now)
  const content = contentFor(templateId, now.toISOString())
  return boardFileSchema.parse({
    ...board,
    nodes: content.nodes,
    connections: content.connections ?? []
  })
}
