const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure files exist
function initFile(filepath, initialData = []) {
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

initFile(STUDENTS_FILE, []);
initFile(ATTENDANCE_FILE, []);

function readJson(filepath) {
  try {
    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filepath}:`, err);
    return [];
  }
}

function writeJson(filepath, data) {
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filepath}:`, err);
    return false;
  }
}

module.exports = {
  // --- Students ---
  getStudents() {
    return readJson(STUDENTS_FILE);
  },

  getStudentById(id) {
    const students = readJson(STUDENTS_FILE);
    return students.find(s => s.id === id) || null;
  },

  getStudentByNumber(studentNumber) {
    const students = readJson(STUDENTS_FILE);
    return students.find(s => s.studentNumber.toLowerCase() === studentNumber.toLowerCase()) || null;
  },

  addStudent({ studentNumber, name, faceDescriptor, avatarImage }) {
    const students = readJson(STUDENTS_FILE);
    
    // Check if student number already exists
    const existing = students.find(s => s.studentNumber.toLowerCase() === studentNumber.toLowerCase());
    if (existing) {
      throw new Error(`Student Number '${studentNumber}' is already registered.`);
    }

    const newStudent = {
      id: 'stu_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      studentNumber: studentNumber.trim(),
      name: name.trim(),
      faceDescriptor: faceDescriptor, // Array of 128 float numbers
      avatarImage: avatarImage || null, // Base64 thumbnail string
      registeredAt: new Date().toISOString()
    };

    students.push(newStudent);
    writeJson(STUDENTS_FILE, students);
    return newStudent;
  },

  deleteStudent(id) {
    let students = readJson(STUDENTS_FILE);
    const initialLen = students.length;
    students = students.filter(s => s.id !== id);
    if (students.length === initialLen) return false;
    writeJson(STUDENTS_FILE, students);
    return true;
  },

  // --- Attendance ---
  getAttendance(filterDate = null) {
    const records = readJson(ATTENDANCE_FILE);
    if (filterDate) {
      return records.filter(r => r.date === filterDate);
    }
    // Return sorted by timestamp descending
    return records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  markAttendance({ studentId, studentNumber, name, gateType = 'IN', status = 'Present' }) {
    const records = readJson(ATTENDANCE_FILE);
    const now = new Date();
    
    // YYYY-MM-DD
    const dateStr = now.toISOString().split('T')[0];
    
    // HH:MM:SS format in local time
    const timeStr = now.toLocaleTimeString('en-GB', { hour12: true });

    const normalizedGate = (gateType || 'IN').toUpperCase();

    // Anti-Spam Cooldown (15 seconds per gate type for same student)
    const COOLDOWN_MS = 15 * 1000;
    const recentScan = records.find(r => 
      r.studentId === studentId && 
      r.gateType === normalizedGate &&
      (now.getTime() - new Date(r.timestamp).getTime()) < COOLDOWN_MS
    );

    if (recentScan) {
      return {
        alreadyMarked: true,
        record: recentScan,
        message: `${name} scanned at ${normalizedGate} gate recently (${recentScan.time})`
      };
    }

    const newRecord = {
      id: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      studentId,
      studentNumber,
      name,
      gateType: normalizedGate, // 'IN' or 'OUT'
      date: dateStr,
      time: timeStr,
      timestamp: now.toISOString(),
      status: normalizedGate === 'IN' ? 'Present' : 'Departed'
    };

    records.unshift(newRecord);
    writeJson(ATTENDANCE_FILE, records);

    return {
      alreadyMarked: false,
      record: newRecord,
      message: `Gate ${normalizedGate} logged successfully for ${name}`
    };
  }
};
