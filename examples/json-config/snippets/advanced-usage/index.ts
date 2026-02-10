/**
 * Advanced usage example
 */
export async function* paginate<T>(
  fetcher: (page: number) => Promise<T[]>
): AsyncGenerator<T> {
  let page = 0;
  while (true) {
    const items = await fetcher(page++);
    if (items.length === 0) break;
    yield* items;
  }
}
