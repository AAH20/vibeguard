export async function getOrdersWithItems(orderIds, db) {
  // Single batched query, not one per id — the correct pattern.
  return db.order.findMany({ where: { id: { in: orderIds } } });
}

export function plainLoopNoAwait(items) {
  // A loop with no await inside at all must not be flagged.
  const total = [];
  for (const item of items) {
    total.push(item.price);
  }
  return total;
}
