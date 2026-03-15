import logger from '../utils/handle-logs/logger.js'
import messageHandler from '../lib/msg-handlers/staking-msg-handler.js'
import {
  STAKING_EVENT_TYPE,
  UNSTAKING_EVENT_TYPE,
  EPOCH_REWARD_SENDER,
  EVENTS_QUERY,
  INIT_CURSOR_QUERY,
} from './requests.js'

const GRAPHQL_URL = process.env.SUI_GRAPHQL_URL || 'https://graphql.mainnet.sui.io/graphql'
const POLL_INTERVAL_MS = parseInt(process.env.GRAPHQL_POLL_INTERVAL_MS || '5000', 10)

async function graphqlRequest(query, variables) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`)
  }

  return result.data
}

function transformToLegacyFormat(node) {
  return JSON.stringify({
    params: {
      result: {
        type: node.contents.type.repr,
        sender: node.sender?.address,
        id: { txDigest: node.transaction?.digest },
        parsedJson: node.contents.json,
      },
    },
  })
}

function processEvents(nodes, eventType, bot, usersSubscriptions) {
  for (const node of nodes) {
    const parsedJson = node.contents.json
    const validatorAddress = parsedJson.validator_address
    const sender = node.sender?.address

    const isStakingEvent = eventType === STAKING_EVENT_TYPE
    const mappedEventType = isStakingEvent ? 'delegate' : 'undelegate'
    const isEpochReward = isStakingEvent && sender === EPOCH_REWARD_SENDER

    const legacyData = transformToLegacyFormat(node)

    for (const [chatId, subscriptions] of usersSubscriptions) {
      const matchedSubscription = subscriptions.filter(
        (sub) => sub.address === validatorAddress && sub.type === mappedEventType,
      )
      if (matchedSubscription.length > 0) {
        matchedSubscription.forEach((sub) => {
          messageHandler(bot, chatId, sub, legacyData)
        })
      }

      if (isEpochReward) {
        const epochMatched = subscriptions.filter(
          (sub) => sub.address === validatorAddress && sub.type === 'epoch_reward',
        )
        if (epochMatched.length > 0) {
          epochMatched.forEach((sub) => {
            messageHandler(bot, chatId, sub, legacyData)
          })
        }
      }
    }
  }
}

async function initializeCursors() {
  const results = await Promise.allSettled([
    graphqlRequest(INIT_CURSOR_QUERY, { eventType: STAKING_EVENT_TYPE }),
    graphqlRequest(INIT_CURSOR_QUERY, { eventType: UNSTAKING_EVENT_TYPE }),
  ])

  const stakingCursor =
    results[0].status === 'fulfilled' ? results[0].value.events.pageInfo.endCursor : null
  const unstakingCursor =
    results[1].status === 'fulfilled' ? results[1].value.events.pageInfo.endCursor : null

  if (results[0].status === 'rejected') {
    logger.error(`Failed to init staking cursor: ${results[0].reason.message}`)
  }
  if (results[1].status === 'rejected') {
    logger.error(`Failed to init unstaking cursor: ${results[1].reason.message}`)
  }

  return { stakingCursor, unstakingCursor }
}

async function pollEvents(eventType, cursor, bot, usersSubscriptions) {
  try {
    const data = await graphqlRequest(EVENTS_QUERY, { cursor, eventType })
    const events = data.events

    if (events.nodes.length > 0) {
      processEvents(events.nodes, eventType, bot, usersSubscriptions)
      logger.info(`Processed ${events.nodes.length} ${eventType} events`)
    }

    if (events.pageInfo.hasNextPage) {
      return await pollEvents(eventType, events.pageInfo.endCursor, bot, usersSubscriptions)
    }

    return events.pageInfo.endCursor || cursor
  } catch (error) {
    logger.error(`Error polling ${eventType}: ${error.message}`)
    return cursor
  }
}

export default async function handleGraphQLSubscriptions(bot, usersSubscriptions) {
  logger.info('Initializing GraphQL event subscriptions...')
  logger.info(`GraphQL endpoint: ${GRAPHQL_URL}`)
  logger.info(`Poll interval: ${POLL_INTERVAL_MS}ms`)

  let { stakingCursor, unstakingCursor } = await initializeCursors()

  logger.info(
    `GraphQL cursors initialized. Staking: ${stakingCursor ? 'ready' : 'null'}, Unstaking: ${unstakingCursor ? 'ready' : 'null'}`,
  )

  const poll = async () => {
    try {
      const [newStakingCursor, newUnstakingCursor] = await Promise.all([
        pollEvents(STAKING_EVENT_TYPE, stakingCursor, bot, usersSubscriptions),
        pollEvents(UNSTAKING_EVENT_TYPE, unstakingCursor, bot, usersSubscriptions),
      ])

      stakingCursor = newStakingCursor
      unstakingCursor = newUnstakingCursor
    } catch (error) {
      logger.error(`Error in GraphQL polling cycle: ${error.message}`)
    }

    setTimeout(poll, POLL_INTERVAL_MS)
  }

  poll()
}
