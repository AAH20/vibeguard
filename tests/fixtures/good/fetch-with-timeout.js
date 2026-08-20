export async function getUser(id) {
  const res = await fetch(`https://api.example.com/users/${id}`, {
    signal: AbortSignal.timeout(5000),
  });
  return res.json();
}
