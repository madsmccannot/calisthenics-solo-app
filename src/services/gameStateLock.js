// Serializes read-modify-write access to the single `gameState` record.
//
// `gameState` is a one-key blob in AsyncStorage mutated by many independent
// async callers (XP, coins, missions, medals, shop, feed, seasons) AND
// overwritten wholesale by a cloud pull. Each caller does read -> modify ->
// write with awaits in between, so without serialization two overlapping
// operations read the same snapshot and the slower write silently discards the
// other's change (last-write-wins data loss). A cloud pull landing mid-write is
// the worst case: it can clobber freshly earned progress.
//
// `withGameLock` runs tasks one at a time, in call order, so every task sees the
// result of the previous one. The queue survives a failing task (it is kept
// alive by swallowing the error on the chain) so one rejection can't wedge it.
let chain = Promise.resolve();

export function withGameLock(task) {
  // run `task` regardless of whether the previous task fulfilled or rejected
  const run = chain.then(task, task);
  // keep the queue alive; the chain itself must never reject
  chain = run.then(noop, noop);
  return run;
}

function noop() {}
