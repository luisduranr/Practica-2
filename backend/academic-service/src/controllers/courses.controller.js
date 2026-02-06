function getCourses(req, res) {
  try {
    const academicFacade = require("../facades/academic.facade");
    const courses = academicFacade.getCourses(req.user);
    res.json(courses);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
}

module.exports = { getCourses };