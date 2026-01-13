// index.js (Mongo _id version: NO counters, NO numeric id fields)
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

// Helper: validate ObjectId param
function requireObjectId(id, res, label = "id") {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: `Invalid ${label}` });
    return false;
  }
  return true;
}

/**
 * Query helper:
 * By default we return just the raw ObjectId fields (teacherId/studentId/courseId),
 * and only populate if the client explicitly asks for it.
 *
 * Examples:
 *   GET /courses?populate=teacher
 *   GET /tests?populate=student,course
 */
function parsePopulateParam(populateStr) {
  if (!populateStr) return new Set();
  return new Set(
    String(populateStr)
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
  );
}

// ----------------------
// Schemas / Models (using MongoDB _id)
// ----------------------
const TeacherSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    department: { type: String, required: true }
  },
  { collection: "teachers", timestamps: true }
);
const Teacher = mongoose.model("Teacher", TeacherSchema);

const CourseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    semester: { type: String, required: true },
    room: { type: String, required: true },
    schedule: { type: String, default: "" } // optional
  },
  { collection: "courses", timestamps: true }
);
const Course = mongoose.model("Course", CourseSchema);

const StudentSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    grade: { type: Number, required: true },
    studentNumber: { type: String, required: true },
    homeroom: { type: String, default: "" } // optional
  },
  { collection: "students", timestamps: true }
);
const Student = mongoose.model("Student", StudentSchema);

const TestSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    testName: { type: String, required: true },
    date: { type: String, required: true },
    mark: { type: Number, required: true },
    outOf: { type: Number, required: true },
    weight: { type: Number, required: true }
  },
  { collection: "tests", timestamps: true }
);
const Test = mongoose.model("Test", TestSchema);

// ----------------------
// Health / Debug
// ----------------------
app.get("/", (req, res) => {
  res.json({ ok: true, message: "School API running" });
});

app.get("/debug", async (req, res) => {
  const dbName = mongoose.connection?.name;
  const teachersCount = await Teacher.countDocuments();
  res.json({ dbName, teachersCount });
});

// ======================
// TEACHERS CRUD  (/teachers)
// ======================
app.get("/teachers", async (req, res) => {
  const teachers = await Teacher.find().sort({ lastName: 1, firstName: 1 }).lean();
  res.json(teachers);
});

app.get("/teachers/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "teacher _id")) return;

  const teacher = await Teacher.findById(id).lean();
  if (!teacher) return res.status(404).json({ error: "Teacher not found" });

  res.json(teacher);
});

app.post("/teachers", async (req, res) => {
  try {
    const { firstName, lastName, email, department } = req.body;
    if (!firstName || !lastName || !email || !department) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const created = await Teacher.create({ firstName, lastName, email, department });
    res.status(201).json(created.toObject());
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.put("/teachers/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "teacher _id")) return;

  const { firstName, lastName, email, department } = req.body;

  if (
    firstName === undefined &&
    lastName === undefined &&
    email === undefined &&
    department === undefined
  ) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const teacher = await Teacher.findById(id);
  if (!teacher) return res.status(404).json({ error: "Teacher not found" });

  if (firstName !== undefined) teacher.firstName = firstName;
  if (lastName !== undefined) teacher.lastName = lastName;
  if (email !== undefined) teacher.email = email;
  if (department !== undefined) teacher.department = department;

  await teacher.save();
  res.json(teacher.toObject());
});

app.delete("/teachers/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "teacher _id")) return;

  const used = await Course.exists({ teacherId: id });
  if (used) {
    return res.status(400).json({
      error: "Cannot delete teacher who is assigned to courses. Update/delete courses first."
    });
  }

  const deleted = await Teacher.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ error: "Teacher not found" });

  res.json(deleted.toObject());
});

// ======================
// COURSES CRUD (/courses)
// ======================
// Default: returns ONLY teacherId (ObjectId). Populate only if ?populate=teacher
app.get("/courses", async (req, res) => {
  const pop = parsePopulateParam(req.query.populate);
  const query = Course.find().sort({ code: 1 });

  if (pop.has("teacher")) {
    query.populate({
      path: "teacherId",
      select: "firstName lastName email department"
    });
  }

  const courses = await query.lean();
  res.json(courses);
});

// Default: returns ONLY teacherId (ObjectId). Populate only if ?populate=teacher
app.get("/courses/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "course _id")) return;

  const pop = parsePopulateParam(req.query.populate);
  const query = Course.findById(id);

  if (pop.has("teacher")) {
    query.populate({
      path: "teacherId",
      select: "firstName lastName email department"
    });
  }

  const course = await query.lean();
  if (!course) return res.status(404).json({ error: "Course not found" });

  res.json(course);
});

app.post("/courses", async (req, res) => {
  const { code, name, teacherId, semester, room, schedule } = req.body;

  if (!code || !name || !teacherId || !semester || !room) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!mongoose.isValidObjectId(teacherId)) {
    return res.status(400).json({ error: "Invalid teacherId" });
  }

  const teacherExists = await Teacher.exists({ _id: teacherId });
  if (!teacherExists) {
    return res.status(400).json({ error: "teacherId does not exist" });
  }

  const created = await Course.create({
    code,
    name,
    teacherId,
    semester,
    room,
    schedule: schedule || ""
  });

  res.status(201).json(created.toObject());
});

app.put("/courses/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "course _id")) return;

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

  const course = await Course.findById(id);
  if (!course) return res.status(404).json({ error: "Course not found" });

  if (teacherId !== undefined) {
    if (!mongoose.isValidObjectId(teacherId)) {
      return res.status(400).json({ error: "Invalid teacherId" });
    }
    const teacherExists = await Teacher.exists({ _id: teacherId });
    if (!teacherExists) return res.status(400).json({ error: "teacherId does not exist" });
    course.teacherId = teacherId;
  }

  if (code !== undefined) course.code = code;
  if (name !== undefined) course.name = name;
  if (semester !== undefined) course.semester = semester;
  if (room !== undefined) course.room = room;
  if (schedule !== undefined) course.schedule = schedule;

  await course.save();
  res.json(course.toObject());
});

app.delete("/courses/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "course _id")) return;

  const used = await Test.exists({ courseId: id });
  if (used) {
    return res.status(400).json({
      error: "Cannot delete course that has tests. Delete/update tests first."
    });
  }

  const deleted = await Course.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ error: "Course not found" });

  res.json(deleted.toObject());
});

// ======================
// STUDENTS CRUD (/students)
// ======================
app.get("/students", async (req, res) => {
  const students = await Student.find().sort({ lastName: 1, firstName: 1 }).lean();
  res.json(students);
});

app.get("/students/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "student _id")) return;

  const student = await Student.findById(id).lean();
  if (!student) return res.status(404).json({ error: "Student not found" });

  res.json(student);
});

app.post("/students", async (req, res) => {
  const { firstName, lastName, grade, studentNumber, homeroom } = req.body;

  if (!firstName || !lastName || grade === undefined || !studentNumber) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const created = await Student.create({
    firstName,
    lastName,
    grade: Number(grade),
    studentNumber,
    homeroom: homeroom || ""
  });

  res.status(201).json(created.toObject());
});

app.put("/students/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "student _id")) return;

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

  const student = await Student.findById(id);
  if (!student) return res.status(404).json({ error: "Student not found" });

  if (firstName !== undefined) student.firstName = firstName;
  if (lastName !== undefined) student.lastName = lastName;
  if (grade !== undefined) student.grade = Number(grade);
  if (studentNumber !== undefined) student.studentNumber = studentNumber;
  if (homeroom !== undefined) student.homeroom = homeroom;

  await student.save();
  res.json(student.toObject());
});

app.delete("/students/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "student _id")) return;

  const used = await Test.exists({ studentId: id });
  if (used) {
    return res.status(400).json({
      error: "Cannot delete student that has tests. Delete/update tests first."
    });
  }

  const deleted = await Student.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ error: "Student not found" });

  res.json(deleted.toObject());
});

// ======================
// TESTS CRUD (/tests)
// ======================
// Default: returns ONLY studentId/courseId (ObjectId). Populate only if asked:
//   ?populate=student
//   ?populate=course
//   ?populate=student,course
app.get("/tests", async (req, res) => {
  const pop = parsePopulateParam(req.query.populate);
  const query = Test.find().sort({ createdAt: -1 });

  if (pop.has("student")) {
    query.populate({
      path: "studentId",
      select: "firstName lastName grade studentNumber homeroom"
    });
  }
  if (pop.has("course")) {
    query.populate({
      path: "courseId",
      select: "code name teacherId semester room schedule"
    });
  }

  const tests = await query.lean();
  res.json(tests);
});

app.get("/tests/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "test _id")) return;

  const pop = parsePopulateParam(req.query.populate);
  const query = Test.findById(id);

  if (pop.has("student")) {
    query.populate({
      path: "studentId",
      select: "firstName lastName grade studentNumber homeroom"
    });
  }
  if (pop.has("course")) {
    query.populate({
      path: "courseId",
      select: "code name teacherId semester room schedule"
    });
  }

  const test = await query.lean();
  if (!test) return res.status(404).json({ error: "Test not found" });

  res.json(test);
});

app.post("/tests", async (req, res) => {
  const { studentId, courseId, testName, date, mark, outOf, weight } = req.body;

  if (
    !studentId ||
    !courseId ||
    !testName ||
    !date ||
    mark === undefined ||
    outOf === undefined ||
    weight === undefined
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!mongoose.isValidObjectId(studentId) || !mongoose.isValidObjectId(courseId)) {
    return res.status(400).json({ error: "Invalid studentId or courseId" });
  }

  const [studentExists, courseExists] = await Promise.all([
    Student.exists({ _id: studentId }),
    Course.exists({ _id: courseId })
  ]);

  if (!studentExists) return res.status(400).json({ error: "studentId does not exist" });
  if (!courseExists) return res.status(400).json({ error: "courseId does not exist" });

  const created = await Test.create({
    studentId,
    courseId,
    testName,
    date,
    mark: Number(mark),
    outOf: Number(outOf),
    weight: Number(weight)
  });

  res.status(201).json(created.toObject());
});

app.put("/tests/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "test _id")) return;

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

  const test = await Test.findById(id);
  if (!test) return res.status(404).json({ error: "Test not found" });

  if (studentId !== undefined) {
    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ error: "Invalid studentId" });
    }
    const exists = await Student.exists({ _id: studentId });
    if (!exists) return res.status(400).json({ error: "studentId does not exist" });
    test.studentId = studentId;
  }

  if (courseId !== undefined) {
    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ error: "Invalid courseId" });
    }
    const exists = await Course.exists({ _id: courseId });
    if (!exists) return res.status(400).json({ error: "courseId does not exist" });
    test.courseId = courseId;
  }

  if (testName !== undefined) test.testName = testName;
  if (date !== undefined) test.date = date;
  if (mark !== undefined) test.mark = Number(mark);
  if (outOf !== undefined) test.outOf = Number(outOf);
  if (weight !== undefined) test.weight = Number(weight);

  await test.save();
  res.json(test.toObject());
});

app.delete("/tests/:id", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "test _id")) return;

  const deleted = await Test.findByIdAndDelete(id);
  if (!deleted) return res.status(404).json({ error: "Test not found" });

  res.json(deleted.toObject());
});

// ======================
// BONUS / EXTRA ROUTES
// ======================

// All tests for a student
// Default: populate nothing. Optional: ?populate=course to include course docs
app.get("/students/:id/tests", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "student _id")) return;

  const student = await Student.findById(id).lean();
  if (!student) return res.status(404).json({ error: "Student not found" });

  const pop = parsePopulateParam(req.query.populate);
  const query = Test.find({ studentId: id }).sort({ createdAt: -1 });

  if (pop.has("course")) {
    query.populate({
      path: "courseId",
      select: "code name teacherId semester room schedule"
    });
  }

  const studentTests = await query.lean();
  res.json(studentTests);
});

// All tests for a course
// Default: populate nothing. Optional: ?populate=student to include student docs
app.get("/courses/:id/tests", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "course _id")) return;

  const course = await Course.findById(id).lean();
  if (!course) return res.status(404).json({ error: "Course not found" });

  const pop = parsePopulateParam(req.query.populate);
  const query = Test.find({ courseId: id }).sort({ createdAt: -1 });

  if (pop.has("student")) {
    query.populate({
      path: "studentId",
      select: "firstName lastName grade studentNumber homeroom"
    });
  }

  const courseTests = await query.lean();
  res.json(courseTests);
});

// Student average
app.get("/students/:id/average", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "student _id")) return;

  const student = await Student.findById(id).lean();
  if (!student) return res.status(404).json({ error: "Student not found" });

  const studentTests = await Test.find({ studentId: id }).lean();

  if (studentTests.length === 0) {
    return res.json({ studentId: id, testCount: 0, average: null });
  }

  const avg =
    studentTests
      .map(t => (t.mark / t.outOf) * 100)
      .reduce((a, b) => a + b, 0) / studentTests.length;

  res.json({ studentId: id, testCount: studentTests.length, average: avg });
});

// Course average
app.get("/courses/:id/average", async (req, res) => {
  const { id } = req.params;
  if (!requireObjectId(id, res, "course _id")) return;

  const course = await Course.findById(id).lean();
  if (!course) return res.status(404).json({ error: "Course not found" });

  const courseTests = await Test.find({ courseId: id }).lean();

  if (courseTests.length === 0) {
    return res.json({ courseId: id, testCount: 0, average: null });
  }

  const avg =
    courseTests
      .map(t => (t.mark / t.outOf) * 100)
      .reduce((a, b) => a + b, 0) / courseTests.length;

  res.json({ courseId: id, testCount: courseTests.length, average: avg });
});

app.get("/__version", (req, res) => {
  res.json({
    ok: true,
    deployedAt: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || null
  });
});

// ----------------------
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
