import fs from 'node:fs/promises'

const requiredEnvironment = [
  'NOTION_TOKEN',
  'NOTION_DATA_SOURCE_ID',
  'NOTION_AREA'
]

const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name])
if (missingEnvironment.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvironment.join(', ')}`)
}

const event = JSON.parse(
  await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8')
)

const notionToken = process.env.NOTION_TOKEN
const dataSourceId = process.env.NOTION_DATA_SOURCE_ID
const notionArea = process.env.NOTION_AREA

const cleanText = (value, maximumLength = 1900) => {
  const text = String(value ?? '')
    .replaceAll('\u0000', '')
    .trim()

  return text.slice(0, maximumLength)
}

const notionRequest = async (path, options = {}) => {
  const response = await fetch(`https://api.notion.com${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2026-03-11'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(
      `Notion API request failed (${response.status}): ${responseText.slice(0, 600)}`
    )
  }

  return responseText ? JSON.parse(responseText) : null
}

if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
  const connectionCheck = await notionRequest(
    `/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`,
    {
      method: 'POST',
      body: { page_size: 1 }
    }
  )

  console.log(
    `Notion connection verified; query returned ${connectionCheck.results?.length ?? 0} row(s)`
  )
  process.exit(0)
}

const pullRequest = event.pull_request

if (!pullRequest?.merged || !pullRequest.merge_commit_sha) {
  console.log('Pull request was not merged; nothing to send to Notion')
  process.exit(0)
}

const fieldNames = [
  'Update type',
  'User-facing change',
  'Why it matters',
  'Target users',
  'User impact',
  'Suggested content angle',
  'Assets / demo'
]

const allowedUpdateTypes = new Set([
  'New Feature',
  'Improvement',
  'Bug Fix',
  'Launch',
  'Partnership',
  'Validator or Network Update',
  'Delegation or Capacity',
  'Infrastructure or Hardware',
  'Data or Milestone',
  'Announcement or Event',
  'Incident or Recovery',
  'Deprecation'
])

const allowedTargetUsers = new Set([
  'SUI Holders',
  'Stakers',
  'Validators',
  'Developers',
  'Partners or Foundation',
  'Community'
])

const allowedUserImpacts = new Set(['Low', 'Medium', 'High'])

const parseGrowthHandoff = (body) => {
  const withoutComments = String(body ?? '').replace(/<!--[\s\S]*?-->/g, '')
  const lines = withoutComments.replaceAll('\r', '').split('\n')
  const headingIndex = lines.findIndex((line) =>
    /^##\s+Growth handoff\s*$/i.test(line.trim())
  )

  if (headingIndex === -1) return null

  const values = Object.fromEntries(fieldNames.map((name) => [name, []]))
  let activeField = null

  for (const line of lines.slice(headingIndex + 1)) {
    if (/^##\s+/.test(line.trim())) break

    const fieldMatch = line.match(
      /^(Update type|User-facing change|Why it matters|Target users|User impact|Suggested content angle|Assets \/ demo)\s*:\s*(.*)$/i
    )

    if (fieldMatch) {
      activeField = fieldNames.find(
        (name) => name.toLowerCase() === fieldMatch[1].toLowerCase()
      )
      values[activeField].push(fieldMatch[2])
    } else if (activeField) {
      values[activeField].push(line)
    }
  }

  return Object.fromEntries(
    Object.entries(values).map(([name, parts]) => [
      name,
      cleanText(parts.join('\n'))
    ])
  )
}

const handoff = parseGrowthHandoff(pullRequest.body)

if (!handoff) {
  throw new Error('Merged growth-content PR is missing the Growth handoff section')
}

const missingFields = fieldNames.filter((name) => !handoff[name])
if (missingFields.length > 0) {
  throw new Error(
    `Merged growth-content PR has incomplete handoff fields: ${missingFields.join(', ')}`
  )
}

const narrativeMinimumLengths = {
  'User-facing change': 20,
  'Why it matters': 20,
  'Suggested content angle': 20
}

for (const [fieldName, minimumLength] of Object.entries(
  narrativeMinimumLengths
)) {
  const value = handoff[fieldName]
  if (
    /^(n\/?a|none|tbd|todo|not applicable)$/i.test(value) ||
    value.length < minimumLength
  ) {
    throw new Error(`${fieldName} does not contain a usable growth handoff`)
  }
}

if (!allowedUpdateTypes.has(handoff['Update type'])) {
  throw new Error(`Unknown Update type: ${handoff['Update type']}`)
}

if (!allowedUserImpacts.has(handoff['User impact'])) {
  throw new Error(`Unknown User impact: ${handoff['User impact']}`)
}

if (
  handoff['Assets / demo'].toLowerCase() !== 'n/a' &&
  !/https?:\/\/\S+/i.test(handoff['Assets / demo'])
) {
  throw new Error('Assets / demo must contain a URL or exactly N/A')
}

const targetUsers = handoff['Target users']
  .split(/[,;]/)
  .map((value) => value.trim())
  .filter(Boolean)

const invalidTargetUsers = targetUsers.filter(
  (value) => !allowedTargetUsers.has(value)
)

if (targetUsers.length === 0 || invalidTargetUsers.length > 0) {
  throw new Error(
    `Invalid Target users: ${invalidTargetUsers.join(', ') || 'no audience supplied'}`
  )
}

const mergeCommitSha = pullRequest.merge_commit_sha

const duplicateCheck = await notionRequest(
  `/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`,
  {
    method: 'POST',
    body: {
      page_size: 1,
      filter: {
        property: 'Merge Commit SHA',
        rich_text: { equals: mergeCommitSha }
      }
    }
  }
)

if (duplicateCheck.results?.length > 0) {
  console.log(`Notion already contains merge commit ${mergeCommitSha}; skipping`)
  process.exit(0)
}

const repositoryName = event.repository?.full_name ?? process.env.GITHUB_REPOSITORY
const mergedBy = pullRequest.merged_by?.login ?? 'Unknown'
const notes = cleanText(
  `Suggested content angle: ${handoff['Suggested content angle']}\n\nAssets / demo: ${handoff['Assets / demo']}`
)

const createdPage = await notionRequest('/v1/pages', {
  method: 'POST',
  body: {
    parent: {
      type: 'data_source_id',
      data_source_id: dataSourceId
    },
    properties: {
      Update: {
        title: [
          {
            type: 'text',
            text: { content: cleanText(pullRequest.title) }
          }
        ]
      },
      Status: { select: { name: 'Owner Review' } },
      Area: { select: { name: notionArea } },
      'Effective Date': { date: { start: pullRequest.merged_at } },
      'Update Type': { select: { name: handoff['Update type'] } },
      'What Changed': {
        rich_text: [
          {
            type: 'text',
            text: { content: cleanText(handoff['User-facing change']) }
          }
        ]
      },
      'Why It Matters': {
        rich_text: [
          {
            type: 'text',
            text: { content: cleanText(handoff['Why it matters']) }
          }
        ]
      },
      'Target Users': {
        multi_select: targetUsers.map((name) => ({ name }))
      },
      'User Impact': { select: { name: handoff['User impact'] } },
      Notes: {
        rich_text: [
          {
            type: 'text',
            text: { content: notes }
          }
        ]
      },
      'Source / Evidence URL': { url: pullRequest.html_url },
      'GitHub Repository': {
        rich_text: [
          {
            type: 'text',
            text: { content: cleanText(repositoryName) }
          }
        ]
      },
      'Pull Request': { number: pullRequest.number },
      'Merge Commit SHA': {
        rich_text: [
          {
            type: 'text',
            text: { content: mergeCommitSha }
          }
        ]
      },
      'Merged By': {
        rich_text: [
          {
            type: 'text',
            text: { content: cleanText(mergedBy) }
          }
        ]
      },
      'Automation Source': { select: { name: 'GitHub' } },
      'Ready for Marketing': { checkbox: false },
      'Source Verified': { checkbox: false }
    }
  }
})

console.log(`Created growth-ready Notion intake item: ${createdPage.url}`)
