/** Merge a fixed-size wave, buffering at most one result per branch. */
export async function* mergeWave<T>(branches: readonly AsyncGenerator<T>[], cancelPeers: () => void = () => {}): AsyncGenerator<T> {
  let completed = false;
  const pending = new Map<number, Promise<{ index: number; result: IteratorResult<T> } | { index: number; error: unknown }>>();
  const schedule = (index: number, branch: AsyncGenerator<T>) => pending.set(index,
    branch.next().then(result => ({ index, result }), (error: unknown) => ({ index, error })));
  try {
    branches.forEach((branch, index) => schedule(index, branch));
    while (pending.size) {
      const next = await Promise.race(pending.values());
      pending.delete(next.index);
      if ("error" in next) throw next.error;
      if (next.result.done) continue;
      yield next.result.value;
      const branch = branches[next.index];
      if (branch) schedule(next.index, branch);
    }
    completed = true;
  } finally {
    if (!completed) cancelPeers();
    // Preserve the original failure while closing siblings cancelled during a pending next().
    await Promise.allSettled(branches.map(branch => branch.return(undefined)));
  }
}
