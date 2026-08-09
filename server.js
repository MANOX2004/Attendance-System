const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Get all students
app.get('/api/students', (req, res) => {
  try {
    const students = db.getStudents();
    res.json({ success: true, count: students.length, data: students });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add new student
app.post('/api/students', (req, res) => {
  try {
    const { studentNumber, name, faceDescriptor, avatarImage } = req.body;
    
    if (!studentNumber || !name || !faceDescriptor) {
      return res.status(400).json({ 
        success: false, 
        error: 'Student Number, Name, and Face Descriptor are required.' 
      });
    }

    if (!Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid face descriptor data format.'
      });
    }

    const student = db.addStudent({
      studentNumber,
      name,
      faceDescriptor,
      avatarImage
    });

    res.status(201).json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Delete student
app.delete('/api/students/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteStudent(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }
    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get attendance log
app.get('/api/attendance', (req, res) => {
  try {
    const { date } = req.query;
    const records = db.getAttendance(date);
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark attendance
app.post('/api/attendance/mark', (req, res) => {
  try {
    const { studentId, studentNumber, name, gateType, status } = req.body;
    
    if (!studentId || !studentNumber || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Student ID, Student Number, and Name are required.' 
      });
    }

    const result = db.markAttendance({
      studentId,
      studentNumber,
      name,
      gateType: gateType || 'IN',
      status: status
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get stats summary
app.get('/api/stats', (req, res) => {
  try {
    const students = db.getStudents();
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = db.getAttendance(today);
    
    const uniqueStudentsToday = new Set(todayAttendance.map(r => r.studentId));

    res.json({
      success: true,
      data: {
        totalStudents: students.length,
        presentToday: uniqueStudentsToday.size,
        totalScansToday: todayAttendance.length,
        date: today
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve frontend SPA for any unhandled routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Face Recognition Attendance System running on:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`==================================================`);
});
