const bcrypt = require("bcrypt");

// Usuario mock (práctica)
const user = {
  id: 1,
  email: "admin@test.cl",
  passwordHash: bcrypt.hashSync("123456", 10),
};

async function validateCredentials(email, password) {
  if (email !== user.email) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? { id: user.id, email: user.email, role: "admin" } : null;
}

module.exports = { validateCredentials };
