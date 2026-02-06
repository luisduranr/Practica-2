import { useEffect, useState } from "react";
import api from "../services/api";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/courses")
      .then((res) => {
        setCourses(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError("No se pudieron cargar los cursos");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p>Cargando cursos...</p>;
  }

  return (
    <div>
      <h2>Cursos</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <ul>
        {courses.map((course) => (
          <li key={course.id}>
            {course.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
