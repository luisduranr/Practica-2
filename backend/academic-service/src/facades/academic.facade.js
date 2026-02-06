const coursesService = require("../services/courses.service");

class AcademicFacade {
  getCourses(user) {
    if (!user) {
      throw new Error("No autorizado");
    }
    return coursesService.getAll();
  }
}

module.exports = new AcademicFacade();