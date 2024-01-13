export default function requestData(type, validatorAddress) {
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
            MoveEventType: `0x3::validator::${type === 'delegate' ? 'StakingRequestEvent' : 'UnstakingRequestEvent'}`,
          },
        ],
      },
    ],
  }

  return requestData
}
