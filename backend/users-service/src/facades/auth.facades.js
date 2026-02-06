const jwt = require("jsonwebtoken");
const authService = require("../services/auth.services");

class AuthFacade {
  async login(email, password) {
    if (!email || !password) {
      throw new Error("Datos inválidos");
    }
    const user = await authService.validateCredentials(email, password);
    if (!user) {
      throw new Error("Credenciales incorrectas");
    }
    return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "1h" });
  }
}

module.exports = new AuthFacade();
