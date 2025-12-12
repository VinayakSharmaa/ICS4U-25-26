const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());

const teachers_file = path.join(__dirname, "data/teachers.json");
const courses_file = path.join(__dirname, "data/courses.json");
const students_file = path.join(__dirname, "data/students.json");
const tests_file = path.join(__dirname, "data/tests.json");

function loadJson(filePath) {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

let teachers = loadJson(teachers_file);
let courses = loadJson(courses_file);
let students = loadJson(students_file);
let tests = loadJson(tests_file);

let nextTeachersId = teachers.reduce((max, t) => Math.max(max, t.id), 0) + 1;
let nextCoursesId = courses.reduce((max, c) => Math.max(max, c.id), 0) + 1;
let nextStudentsId = students.reduce((max, s) => Math.max(max, s.id), 0) + 1;
let nextTestsId = tests.reduce((max, i) => Math.max(max, i.id), 0) + 1;





// TEACHERS

// ----------------------

app.get("/teachers", (req, res) => {
  // res.json(teachers);
});

app.get("/teachers/:id", (req, res) => {
  const id = Number(req.params.id);
  const teacher = teachers.find(t => t.id === id);

  if (!teacher) {
    return res.status(404).json({ error: "Teacher not found" });
  }

  // res.json(teacher);
});

app.post("/teachers", (req, res) => {
  const { firstName, lastName, email, department } = req.body;
  if (!firstName || !lastName || !email || !department) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const newTeacher = {
    id: nextTeachersId++,
    firstName,
    lastName,
    email,
    department,
  };
  teachers.push(newTeacher);
  saveJson(teachers_file, teachers);
  res.status(201).json(newTeacher);
});

app.put("/teachers/:id", (req, res) => {
  const id = Number(req.params.id);
  const teacher = teachers.find(t => t.id === id);
  if (!teacher) {
    return res.status(404).json({ error: "Teacher not found" });
  }
  const { firstName, lastName, email, department } = req.body;

  if (!firstName && !lastName && !email && !department) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  if (firstName !== undefined) teacher.firstName = firstName;
  if (lastName !== undefined) teacher.lastName = lastName;
  if (email !== undefined) teacher.email = email;
  if (department !== undefined) teacher.department = department;


  saveJson(teachers_file, teachers);

  res.json(teacher);
});


app.delete("/teachers/:id", (req, res) => {
  const id = Number(req.params.id);

  //TODO: Optional Check (?)

  const index = teachers.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Teacher not found" });
  }

  const deleted = teachers.splice(index, 1)[0];
  saveJson(teachers_file, teachers);

  res.json(deleted);
});



// COURSES

// ----------------------

app.get("/courses", (req, res) => {
  res.json(courses);
});

app.get("/courses/:id", (req, res) => {
  const id = Number(req.params.id);
  const course = courses.find(c => c.id === id);

  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }

  res.json(course);
});

app.post("/courses", (req, res) => {

  const { code, name, teacherId, semester, room } = req.body;

  if (!code || !name || !teacherId || !semester || !room) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const teacher = teachers.find(t => t.id === Number(teacherId));
  if (!teacher) {
    return res.status(400).json({ error: "teacherId is invalid!" });
  }

  const newCourse = {
    id: nextCoursesId++,
    code,
    name,
    teacherId: Number(teacherId),
    semester,
    room
  };

  courses.push(newCourse);
  saveJson(courses_file, courses);

  res.status(201).json(newCourse);
});

app.put("/courses/:id", (req, res) => {
  const id = Number(req.params.id);
  const course = courses.find(c => c.id === id);

  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }

  const { code, name, teacherId, semester, room } = req.body;

  if (!code && !name && !teacherId && !semester && !room) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  // validate teacherid if it is changed
  if (teacherId !== undefined) {
    const teacher = teachers.find(t => t.id === Number(teacherId));
    if (!teacher) {
      return res.status(400).json({ error: "teacherId is invalid!" });
    }
    course.teacherId = Number(teacherId);
  }

  if (code !== undefined) course.code = code;
  if (name !== undefined) course.name = name;
  if (semester !== undefined) course.semester = semester;
  if (room !== undefined) course.room = room;

  saveJson(courses_file, courses);

  res.json(course);
});


app.delete("/courses/:id", (req, res) => {
  const id = Number(req.params.id);

  //TODO: Optional Check (?)

   const index = courses.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Course not found" });
  }

  const deleted = courses.splice(index, 1)[0];
  saveJson(courses_file, courses);

  res.json(deleted);
});


// STUDENTS

// ----------------------

app.get("/students", (req, res) => {
  res.json(students);
});

app.get("/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find(s => s.id === id);

  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  res.json(student);
});

app.post("/students", (req, res) => {
  const { firstName, lastName, grade, studentNumber } = req.body;

  if (!firstName || !lastName || !grade || !studentNumber) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
   const newStudent = {
    id: nextStudentsId++,
    firstName,
    lastName,
    grade,
    studentNumber,
  };

  students.push(newStudent);
  saveJson(students_file, students);

  res.status(201).json(newStudent);
});

app.put("/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find(s => s.id === id);

  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  const { firstName, lastName, grade, studentNumber, homeroom } = req.body;

  if (!firstName && !lastName && !grade && !studentNumber) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  if (firstName !== undefined) student.firstName = firstName;
  if (lastName !== undefined) student.lastName = lastName;
  if (grade !== undefined) student.grade = grade;
  if (studentNumber !== undefined) student.studentNumber = studentNumber;
  if (homeroom !== undefined) student.homeroom = homeroom;


  saveJson(students_file, students);

  res.json(student);
});


app.delete("/students/:id", (req, res) => {
  const id = Number(req.params.id);

  const index = students.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Student not found" });
  }

  const deleted = students.splice(index, 1)[0];
  saveJson(students_file, students);

  res.json(deleted);
});


// TESTS

// ----------------------

app.get("/tests", (req, res) => {
  res.json(tests);
});

app.get("/tests/:id", (req, res) => {
  const id = Number(req.params.id);
  const test = tests.find(t => t.id === id);

  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }

  res.json(test);
});

app.post("/tests", (req, res) => {
  const { studentId, courseId, testName, date, mark, outOf, weight } = req.body;

  if (!studentId || !courseId || !testName || !date || mark === undefined || outOf === undefined || weight === undefined ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const studentExistence = students.some(s => s.id === Number(studentId));
  if (!studentExistence) {
    return res.status(400).json({ error: "studentId is invalid!" });
  }

  const courseExistence = courses.some(c => c.id === Number(courseId));
  if (!courseExistence) {
    return res.status(400).json({ error: "courseId is invalid!" });
  }

  
 const newTest = {
    id: nextTestsId++,
    studentId: Number(studentId),
    courseId: Number(courseId),
    testName,
    date,
    mark: Number(mark),
    outOf: Number(outOf),
    weight: Number(weight)
  };

  tests.push(newTest);
  saveJson(tests_file, tests);

  res.status(201).json(newTest);
});

app.put("/tests/:id", (req, res) => {
  const id = Number(req.params.id);
  const test = tests.find(t => t.id === id);

  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }

  const { studentId, courseId, testName, date, mark, outOf, weight } = req.body;

  if (!studentId && !courseId && !testName && !date && mark === undefined && outOf === undefined && weight === undefined) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

    if (studentId !== undefined) {
    const exists = students.some(s => s.id === Number(studentId));
    if (!exists) {
      return res.status(400).json({ error: "studentId is invalid!" });
    }
    test.studentId = Number(studentId);
  }

    if (courseId !== undefined) {
    const exists = courses.some(c => c.id === Number(courseId));
    if (!exists) {
      return res.status(400).json({ error: "courseId is invalid!" });
    }
    test.courseId = Number(courseId);
  }

  
  if (testName !== undefined) test.testName = testName;
  if (date !== undefined) test.date = date;
  if (mark !== undefined) test.mark = Number(mark);
  if (outOf !== undefined) test.outOf = Number(outOf);
  if (weight !== undefined) test.weight = Number(weight);


  saveJson(tests_file, tests);

  res.json(test);
});


app.delete("/tests/:id", (req, res) => {
  const id = Number(req.params.id);

  const index = tests.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Test not found" });
  }

  const deleted = tests.splice(index, 1)[0];
  saveJson(tests_file, tests);

  res.json(deleted);
});


app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

app.get("/courses/:id/average", (req, res) => {

  const id = Number(req.params.id);
  const course = courses.find(c => c.id === id);
  if(!course){
    return res.status(404).json({ error: "Course not found!" });
  }
  
  const testCourses = tests.filter(t => t.courseId === id);

  

  const percent = testCourses.map(t => (t.mark / t.outOf) * 100);
  const courseavg = percent.reduce((x, y) => x + y, 0) / percent.length;

  res.json({ courseId: id, testCount: testCourses.length, average: courseavg });

});





