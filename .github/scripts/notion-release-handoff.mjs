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
      body: {
        page_size: 1
      }
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

const mergeCommitSha = pullRequest.merge_commit_sha

const cleanText = (value, maximumLength = 1900) => {
  const text = String(value ?? '')
    .replaceAll('\u0000', '')
    .trim()

  return text.slice(0, maximumLength)
}

const duplicateCheck = await notionRequest(
  `/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`,
  {
    method: 'POST',
    body: {
      page_size: 1,
      filter: {
        property: 'Merge Commit SHA',
        rich_text: {
          equals: mergeCommitSha
        }
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
const description = cleanText(
  pullRequest.body || 'Merged change. See the pull request for implementation details.'
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
            text: {
              content: cleanText(pullRequest.title)
            }
          }
        ]
      },
      Status: {
        select: {
          name: 'Owner Review'
        }
      },
      Area: {
        select: {
          name: notionArea
        }
      },
      'Effective Date': {
        date: {
          start: pullRequest.merged_at
        }
      },
      'What Changed': {
        rich_text: [
          {
            type: 'text',
            text: {
              content: description
            }
          }
        ]
      },
      'Source / Evidence URL': {
        url: pullRequest.html_url
      },
      'GitHub Repository': {
        rich_text: [
          {
            type: 'text',
            text: {
              content: cleanText(repositoryName)
            }
          }
        ]
      },
      'Pull Request': {
        number: pullRequest.number
      },
      'Merge Commit SHA': {
        rich_text: [
          {
            type: 'text',
            text: {
              content: mergeCommitSha
            }
          }
        ]
      },
      'Merged By': {
        rich_text: [
          {
            type: 'text',
            text: {
              content: cleanText(mergedBy)
            }
          }
        ]
      },
      'Automation Source': {
        select: {
          name: 'GitHub'
        }
      },
      'Ready for Marketing': {
        checkbox: false
      },
      'Source Verified': {
        checkbox: false
      }
    }
  }
})

console.log(`Created Notion intake item: ${createdPage.url}`)
