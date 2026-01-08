const express = require("express");
require("dotenv").config();
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ----------------------
// MongoDB Connection
// ----------------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// ----------------------
// Counter (for numeric IDs)
// Collection: counters
// ----------------------
const CounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // "teachers", "courses", "students", "tests"
    seq: { type: Number, default: 0 }
  },
  { collection: "counters" }
);

const Counter = mongoose.model("Counter", CounterSchema);

async function getNextId(sequenceName) {
  const counter = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

// ----------------------
// Schemas / Models
// ----------------------
const TeacherSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    department: { type: String, required: true }
  },
  { collection: "teachers" }
);
const Teacher = mongoose.model("Teacher", TeacherSchema);

const CourseSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    teacherId: { type: Number, required: true },
    semester: { type: String, required: true },
    room: { type: String, required: true },
    schedule: { type: String } // optional
  },
  { collection: "courses" }
);
const Course = mongoose.model("Course", CourseSchema);

const StudentSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    grade: { type: Number, required: true },
    studentNumber: { type: String, required: true },
    homeroom: { type: String } // optional
  },
  { collection: "students" }
);
const Student = mongoose.model("Student", StudentSchema);

const TestSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    studentId: { type: Number, required: true },
    courseId: { type: Number, required: true },
    testName: { type: String, required: true },
    date: { type: String, required: true },
    mark: { type: Number, required: true },
    outOf: { type: Number, required: true },
    weight: { type: Number, required: true }
  },
  { collection: "tests" }
);
const Test = mongoose.model("Test", TestSchema);

// ----------------------
// TEACHERS CRUD
// ----------------------
app.get("/teachers", async (req, res) => {
  const teachers = await Teacher.find().sort({ id: 1 });
  res.json(teachers);
});

app.get("/teachers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const teacher = await Teacher.findOne({ id });
  if (!teacher) return res.status(404).json({ error: "Teacher not found" });
  res.json(teacher);
});

app.post("/teachers", async (req, res) => {
  try {
    const { firstName, lastName, email, department } = req.body;
    if (!firstName || !lastName || !email || !department) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newTeacher = await Teacher.create({
      id: await getNextId("teachers"),
      firstName,
      lastName,
      email,
      department
    });

    res.status(201).json(newTeacher);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.put("/teachers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { firstName, lastName, email, department } = req.body;

  if (
    firstName === undefined &&
    lastName === undefined &&
    email === undefined &&
    department === undefined
  ) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const teacher = await Teacher.findOne({ id });
  if (!teacher) return res.status(404).json({ error: "Teacher not found" });

  if (firstName !== undefined) teacher.firstName = firstName;
  if (lastName !== undefined) teacher.lastName = lastName;
  if (email !== undefined) teacher.email = email;
  if (department !== undefined) teacher.department = department;

  await teacher.save();
  res.json(teacher);
});

app.delete("/teachers/:id", async (req, res) => {
  const id = Number(req.params.id);

  // Optional: block delete if teacher is referenced by a course
  const used = await Course.exists({ teacherId: id });
  if (used) {
    return res.status(400).json({
      error: "Cannot delete teacher who is assigned to courses. Update/delete courses first."
    });
  }

  const deleted = await Teacher.findOneAndDelete({ id });
  if (!deleted) return res.status(404).json({ error: "Teacher not found" });

  res.json(deleted);
});

// ----------------------
// COURSES CRUD
// ----------------------
app.get("/courses", async (req, res) => {
  const courses = await Course.find().sort({ id: 1 });
  res.json(courses);
});

app.get("/courses/:id", async (req, res) => {
  const id = Number(req.params.id);
  const course = await Course.findOne({ id });
  if (!course) return res.status(404).json({ error: "Course not found" });
  res.json(course);
});

app.post("/courses", async (req, res) => {
  const { code, name, teacherId, semester, room, schedule } = req.body;

  if (!code || !name || teacherId === undefined || !semester || !room) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const teacher = await Teacher.findOne({ id: Number(teacherId) });
  if (!teacher) {
    return res.status(400).json({ error: "teacherId is invalid!" });
  }

  const newCourse = await Course.create({
    id: await getNextId("courses"),
    code,
    name,
    teacherId: Number(teacherId),
    semester,
    room,
    schedule: schedule || ""
  });

  res.status(201).json(newCourse);
});

app.put("/courses/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { code, name, teacherId, semester, room, schedule } = req.body;

  if (
    code === undefined &&
    name === undefined &&
    teacherId === undefined &&
    semester === undefined &&
    room === undefined &&
    schedule === undefined
  ) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const course = await Course.findOne({ id });
  if (!course) return res.status(404).json({ error: "Course not found" });

  if (teacherId !== undefined) {
    const teacher = await Teacher.findOne({ id: Number(teacherId) });
    if (!teacher) return res.status(400).json({ error: "teacherId is invalid!" });
    course.teacherId = Number(teacherId);
  }

  if (code !== undefined) course.code = code;
  if (name !== undefined) course.name = name;
  if (semester !== undefined) course.semester = semester;
  if (room !== undefined) course.room = room;
  if (schedule !== undefined) course.schedule = schedule;

  await course.save();
  res.json(course);
});

app.delete("/courses/:id", async (req, res) => {
  const id = Number(req.params.id);

  // Optional: block delete if tests exist for this course
  const used = await Test.exists({ courseId: id });
  if (used) {
    return res.status(400).json({
      error: "Cannot delete course that has tests. Delete/update tests first."
    });
  }

  const deleted = await Course.findOneAndDelete({ id });
  if (!deleted) return res.status(404).json({ error: "Course not found" });
  res.json(deleted);
});

// ----------------------
// STUDENTS CRUD
// ----------------------
app.get("/students", async (req, res) => {
  const students = await Student.find().sort({ id: 1 });
  res.json(students);
});

app.get("/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  const student = await Student.findOne({ id });
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

app.post("/students", async (req, res) => {
  const { firstName, lastName, grade, studentNumber, homeroom } = req.body;

  if (!firstName || !lastName || grade === undefined || !studentNumber) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const newStudent = await Student.create({
    id: await getNextId("students"),
    firstName,
    lastName,
    grade: Number(grade),
    studentNumber,
    homeroom: homeroom || ""
  });

  res.status(201).json(newStudent);
});

app.put("/students/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { firstName, lastName, grade, studentNumber, homeroom } = req.body;

  if (
    firstName === undefined &&
    lastName === undefined &&
    grade === undefined &&
    studentNumber === undefined &&
    homeroom === undefined
  ) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const student = await Student.findOne({ id });
  if (!student) return res.status(404).json({ error: "Student not found" });

  if (firstName !== undefined) student.firstName = firstName;
  if (lastName !== undefined) student.lastName = lastName;
  if (grade !== undefined) student.grade = Number(grade);
  if (studentNumber !== undefined) student.studentNumber = studentNumber;
  if (homeroom !== undefined) student.homeroom = homeroom;

  await student.save();
  res.json(student);
});

app.delete("/students/:id", async (req, res) => {
  const id = Number(req.params.id);

  // Optional: block delete if tests exist for this student
  const used = await Test.exists({ studentId: id });
  if (used) {
    return res.status(400).json({
      error: "Cannot delete student that has tests. Delete/update tests first."
    });
  }

  const deleted = await Student.findOneAndDelete({ id });
  if (!deleted) return res.status(404).json({ error: "Student not found" });
  res.json(deleted);
});

// ----------------------
// TESTS CRUD
// ----------------------
app.get("/tests", async (req, res) => {
  const tests = await Test.find().sort({ id: 1 });
  res.json(tests);
});

app.get("/tests/:id", async (req, res) => {
  const id = Number(req.params.id);
  const test = await Test.findOne({ id });
  if (!test) return res.status(404).json({ error: "Test not found" });
  res.json(test);
});

app.post("/tests", async (req, res) => {
  const { studentId, courseId, testName, date, mark, outOf, weight } = req.body;

  if (
    studentId === undefined ||
    courseId === undefined ||
    !testName ||
    !date ||
    mark === undefined ||
    outOf === undefined ||
    weight === undefined
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const studentExists = await Student.exists({ id: Number(studentId) });
  if (!studentExists) return res.status(400).json({ error: "studentId is invalid!" });

  const courseExists = await Course.exists({ id: Number(courseId) });
  if (!courseExists) return res.status(400).json({ error: "courseId is invalid!" });

  const newTest = await Test.create({
    id: await getNextId("tests"),
    studentId: Number(studentId),
    courseId: Number(courseId),
    testName,
    date,
    mark: Number(mark),
    outOf: Number(outOf),
    weight: Number(weight)
  });

  res.status(201).json(newTest);
});

app.put("/tests/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { studentId, courseId, testName, date, mark, outOf, weight } = req.body;

  if (
    studentId === undefined &&
    courseId === undefined &&
    testName === undefined &&
    date === undefined &&
    mark === undefined &&
    outOf === undefined &&
    weight === undefined
  ) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const test = await Test.findOne({ id });
  if (!test) return res.status(404).json({ error: "Test not found" });

  if (studentId !== undefined) {
    const exists = await Student.exists({ id: Number(studentId) });
    if (!exists) return res.status(400).json({ error: "studentId is invalid!" });
    test.studentId = Number(studentId);
  }

  if (courseId !== undefined) {
    const exists = await Course.exists({ id: Number(courseId) });
    if (!exists) return res.status(400).json({ error: "courseId is invalid!" });
    test.courseId = Number(courseId);
  }

  if (testName !== undefined) test.testName = testName;
  if (date !== undefined) test.date = date;
  if (mark !== undefined) test.mark = Number(mark);
  if (outOf !== undefined) test.outOf = Number(outOf);
  if (weight !== undefined) test.weight = Number(weight);

  await test.save();
  res.json(test);
});

app.delete("/tests/:id", async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await Test.findOneAndDelete({ id });
  if (!deleted) return res.status(404).json({ error: "Test not found" });
  res.json(deleted);
});

// ----------------------
// BONUS / EXTRA ROUTES
// ----------------------

// All tests for a student
app.get("/students/:id/tests", async (req, res) => {
  const studentId = Number(req.params.id);
  const student = await Student.findOne({ id: studentId });
  if (!student) return res.status(404).json({ error: "Student not found" });

  const studentTests = await Test.find({ studentId }).sort({ id: 1 });
  res.json(studentTests);
});

// All tests for a course
app.get("/courses/:id/tests", async (req, res) => {
  const courseId = Number(req.params.id);
  const course = await Course.findOne({ id: courseId });
  if (!course) return res.status(404).json({ error: "Course not found" });

  const courseTests = await Test.find({ courseId }).sort({ id: 1 });
  res.json(courseTests);
});

// Student average
app.get("/students/:id/average", async (req, res) => {
  const studentId = Number(req.params.id);
  const student = await Student.findOne({ id: studentId });
  if (!student) return res.status(404).json({ error: "Student not found" });

  const studentTests = await Test.find({ studentId });

  if (studentTests.length === 0) {
    return res.json({ studentId, testCount: 0, average: null });
  }

  const percentages = studentTests.map(t => (t.mark / t.outOf) * 100);
  const avg = percentages.reduce((a, b) => a + b, 0) / percentages.length;

  res.json({ studentId, testCount: studentTests.length, average: avg });
});

// Course average
app.get("/courses/:id/average", async (req, res) => {
  const courseId = Number(req.params.id);
  const course = await Course.findOne({ id: courseId });
  if (!course) return res.status(404).json({ error: "Course not found" });

  const courseTests = await Test.find({ courseId });

  if (courseTests.length === 0) {
    return res.json({ courseId, testCount: 0, average: null });
  }

  const percentages = courseTests.map(t => (t.mark / t.outOf) * 100);
  const avg = percentages.reduce((a, b) => a + b, 0) / percentages.length;

  res.json({ courseId, testCount: courseTests.length, average: avg });
});

// ----------------------
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
