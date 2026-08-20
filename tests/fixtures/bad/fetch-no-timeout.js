export async function getUser(id) {
  const res = await fetch(`https://api.example.com/users/${id}`);
  return res.json();
}
