export const STAKING_REQUEST = {
  jsonrpc: '2.0',
  id: 1,
  method: 'suix_subscribeEvent',
  params: [
    {
      Any: [{ MoveEventType: '0x3::validator::StakingRequestEvent' }, { MoveEventType: '0x3::validator::UnstakingRequestEvent' }],
    },
  ],
}
