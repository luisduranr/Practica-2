// src/services/courses.service.js
const courses = [
  { id: 1, name: "Arquitectura de Software" },
  { id: 2, name: "DevSecOps" },
];

function getAll() {
  return courses;
}

function getById(id) {
  return courses.find((course) => course.id === id);
}

function create(courseData) {
  const newCourse = {
    id: courses.length + 1,
    name: courseData.name,
  };
  courses.push(newCourse);
  return newCourse;
}

module.exports = {
  getAll,
  getById,
  create,
};
