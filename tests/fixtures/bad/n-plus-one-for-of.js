export async function getOrdersWithItems(orderIds, db) {
  const orders = [];
  for (const id of orderIds) {
    const order = await db.order.findOne({ where: { id } });
    orders.push(order);
  }
  return orders;
}
