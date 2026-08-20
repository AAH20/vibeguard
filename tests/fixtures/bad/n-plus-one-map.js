export async function getUsersById(userIds, User) {
  return Promise.all(userIds.map(async (id) => await User.findById(id)));
}
