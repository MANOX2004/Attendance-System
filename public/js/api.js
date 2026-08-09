// API Helper Module
const API = {
  async getStudents() {
    const res = await fetch('/api/students');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  },

  async registerStudent(studentData) {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  },

  async deleteStudent(id) {
    const res = await fetch(`/api/students/${id}`, {
      method: 'DELETE'
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json;
  },

  async getAttendance(date = null) {
    let url = '/api/attendance';
    if (date) url += `?date=${encodeURIComponent(date)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  },

  async markAttendance(data) {
    const res = await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json;
  },

  async getStats() {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }
};
