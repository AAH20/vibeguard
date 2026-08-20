// `.get(` is ambiguous on its own, but `db` is a database-shaped receiver
// name — this must still be flagged, unlike serviceContainer.get()/api.get().
export async function loadRows(db, ids) {
  const rows = [];
  for (const id of ids) {
    rows.push(await db.get('SELECT * FROM items WHERE id = ?', [id]));
  }
  return rows;
}
