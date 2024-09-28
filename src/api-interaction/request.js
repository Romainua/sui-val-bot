export function stakingEventsRequest(type, validatorAddress) {
  const requestData = {
    jsonrpc: '2.0',
    id: 1,
    method: 'suix_subscribeEvent',
    params: [
      {
        And: [
          {
            MoveEventField: {
              path: '/validator_address',
              value: validatorAddress,
            },
          },
          {
            MoveEventType: `0x3::validator::${type === 'undelegate' ? 'UnstakingRequestEvent' : 'StakingRequestEvent'}`,
          },
        ],
      },
    ],
  }

  return requestData
}
export function epochChangeEventRequest(validatorAddress) {
  const requestData = {
    jsonrpc: '2.0',
    id: 1,
    method: 'suix_subscribeEvent',
    params: [
      {
        All: [
          {
            MoveEventField: {
              path: '/validator_address',
              value: validatorAddress,
            },
          },
          {
            MoveEventType: `0x3::validator::StakingRequestEvent`,
          },
          { Sender: '0x0000000000000000000000000000000000000000000000000000000000000000' },
        ],
      },
    ],
  }

  return requestData
}
