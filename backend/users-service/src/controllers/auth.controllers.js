const authFacade = require("../facades/auth.facades");

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const token = await authFacade.login(email, password);
    res.json({ token });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
}

module.exports = { login };