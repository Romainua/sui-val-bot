export const STAKING_EVENT_TYPE = '0x3::validator::StakingRequestEvent'
export const UNSTAKING_EVENT_TYPE = '0x3::validator::UnstakingRequestEvent'

export const EPOCH_REWARD_SENDER = '0x0000000000000000000000000000000000000000000000000000000000000000'

export const EVENTS_QUERY = `
  query ($cursor: String, $eventType: String!) {
    events(first: 50, after: $cursor, filter: { type: $eventType }) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        contents {
          type { repr }
          json
        }
        sender { address }
        timestamp
        transaction { digest }
      }
    }
  }
`

export const INIT_CURSOR_QUERY = `
  query ($eventType: String!) {
    events(last: 1, filter: { type: $eventType }) {
      pageInfo {
        endCursor
      }
    }
  }
`
