// Main Application Controller with Dual Gate Camera Support
class App {
  constructor() {
    this.cameraIn = null;
    this.cameraOut = null;
    this.detector = new FaceDetectorEngine();
    
    this.students = [];
    this.attendanceLogs = [];
    
    this.isScanningIn = false;
    this.isScanningOut = false;
    
    // Devices list
    this.videoDevices = [];
    
    // Unknown face detection state
    this.currentUnknownFace = null;
    this.unknownFaceHoldCount = 0;
    this.unknownModalOpen = false;
    this.pendingGateType = 'IN';
    
    // studentId_gateType -> lastScannedTimestamp
    this.scanCooldowns = new Map();

    this.audioCtx = null;
  }

  async init() {
    this.setupUIEvents();
    this.setupAudio();

    try {
      this.updateStatus('Loading AI Models...', 'amber');
      
      // Load face-api models
      await this.detector.loadModels((msg) => {
        this.updateStatus(msg, 'amber');
      });

      // Fetch Initial Data
      await this.refreshData();

      // Initialize Dual Camera Managers
      const videoIn = document.getElementById('webcam-video-in');
      const canvasIn = document.getElementById('overlay-canvas-in');
      this.cameraIn = new CameraManager(videoIn, canvasIn);

      const videoOut = document.getElementById('webcam-video-out');
      const canvasOut = document.getElementById('overlay-canvas-out');
      this.cameraOut = new CameraManager(videoOut, canvasOut);

      // Load Connected Camera Devices
      await this.loadCameraDevices();

      // Start Dual Cameras
      await this.startDualCameras();

      this.updateStatus('Dual Gate System Active & Scanning', 'ready');

    } catch (err) {
      console.error('Initialization error:', err);
      this.updateStatus('Error loading system: ' + err.message, 'error');
    }
  }

  setupAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.log('Web Audio API not supported');
    }
  }

  playChime(type = 'success') {
    const chimeToggle = document.getElementById('toggle-sound-chime');
    if (chimeToggle && !chimeToggle.checked) return;

    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    const now = this.audioCtx.currentTime;

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'alert') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.15);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.35);
    }
  }

  updateStatus(text, state = 'amber') {
    const indicator = document.getElementById('sys-status-indicator');
    const textEl = document.getElementById('sys-status-text');
    
    indicator.className = 'status-indicator ' + (state === 'ready' ? 'ready' : (state === 'error' ? 'error' : ''));
    textEl.innerText = text;
  }

  async refreshData() {
    this.students = await API.getStudents();
    this.attendanceLogs = await API.getAttendance();
    const stats = await API.getStats();

    const threshold = parseFloat(document.getElementById('threshold-slider').value) || 0.50;
    this.detector.updateRegisteredStudents(this.students, threshold);

    document.getElementById('stat-total-students').innerText = stats.totalStudents;
    document.getElementById('stat-present-today').innerText = stats.presentToday;
    
    document.getElementById('badge-students-count').innerText = stats.totalStudents;
    document.getElementById('badge-today-count').innerText = stats.presentToday;

    this.renderStudentsGrid();
    this.renderAttendanceTable();
    this.renderActivityFeed();
  }

  async loadCameraDevices() {
    try {
      // Prompt camera permission if needed
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach(t => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter(d => d.kind === 'videoinput');

      const selectIn = document.getElementById('select-cam-in');
      const selectOut = document.getElementById('select-cam-out');

      selectIn.innerHTML = '';
      selectOut.innerHTML = '';

      if (this.videoDevices.length === 0) {
        selectIn.innerHTML = '<option value="">No Camera Found</option>';
        selectOut.innerHTML = '<option value="">No Camera Found</option>';
        return;
      }

      const savedIn = localStorage.getItem('gate_cam_in');
      const savedOut = localStorage.getItem('gate_cam_out');

      this.videoDevices.forEach((dev, index) => {
        const label = dev.label || `Camera ${index + 1} (${dev.deviceId.substr(0, 8)}...)`;
        
        const optIn = document.createElement('option');
        optIn.value = dev.deviceId;
        optIn.innerText = label;
        if (savedIn ? savedIn === dev.deviceId : index === 0) {
          optIn.selected = true;
        }
        selectIn.appendChild(optIn);

        const optOut = document.createElement('option');
        optOut.value = dev.deviceId;
        optOut.innerText = label;
        // Default second camera to OUT if available, else first camera
        const defaultOutIdx = this.videoDevices.length > 1 ? 1 : 0;
        if (savedOut ? savedOut === dev.deviceId : index === defaultOutIdx) {
          optOut.selected = true;
        }
        selectOut.appendChild(optOut);
      });

    } catch (err) {
      console.error('Error enumerating cameras:', err);
    }
  }

  async startDualCameras() {
    const selectIn = document.getElementById('select-cam-in');
    const selectOut = document.getElementById('select-cam-out');

    const deviceIdIn = selectIn.value || null;
    const deviceIdOut = selectOut.value || null;

    // Start IN Camera
    try {
      document.getElementById('video-placeholder-in').classList.remove('hidden');
      document.getElementById('placeholder-text-in').innerText = 'Starting IN Camera...';
      await this.cameraIn.start(deviceIdIn);
      document.getElementById('video-placeholder-in').classList.add('hidden');
      this.startScanningGate('IN');
    } catch (err) {
      document.getElementById('placeholder-text-in').innerText = err.message;
    }

    // Start OUT Camera
    try {
      document.getElementById('video-placeholder-out').classList.remove('hidden');
      document.getElementById('placeholder-text-out').innerText = 'Starting OUT Camera...';

      if (deviceIdOut && deviceIdIn && deviceIdOut === deviceIdIn && this.cameraIn.stream) {
        // Reuse same stream for OUT preview when using single camera setup
        const videoOut = document.getElementById('webcam-video-out');
        videoOut.srcObject = this.cameraIn.stream;
        await new Promise(r => videoOut.onloadedmetadata = r);
        this.cameraOut.stream = this.cameraIn.stream;
        this.cameraOut.isActive = true;
        this.cameraOut.resizeCanvas();
      } else {
        await this.cameraOut.start(deviceIdOut);
      }

      document.getElementById('video-placeholder-out').classList.add('hidden');
      this.startScanningGate('OUT');
    } catch (err) {
      console.warn('OUT Camera direct start error, trying shared stream fallback:', err);
      if (this.cameraIn && this.cameraIn.stream) {
        try {
          const videoOut = document.getElementById('webcam-video-out');
          videoOut.srcObject = this.cameraIn.stream;
          await new Promise(r => videoOut.onloadedmetadata = r);
          this.cameraOut.stream = this.cameraIn.stream;
          this.cameraOut.isActive = true;
          this.cameraOut.resizeCanvas();
          document.getElementById('video-placeholder-out').classList.add('hidden');
          this.startScanningGate('OUT');
        } catch (e) {
          document.getElementById('placeholder-text-out').innerText = err.message;
        }
      } else {
        document.getElementById('placeholder-text-out').innerText = err.message;
      }
    }
  }

  setupUIEvents() {
    // Tab Switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');
      });
    });

    // Camera Dropdown Changes
    document.getElementById('select-cam-in').addEventListener('change', async (e) => {
      const devId = e.target.value;
      localStorage.setItem('gate_cam_in', devId);
      try {
        document.getElementById('video-placeholder-in').classList.remove('hidden');
        document.getElementById('placeholder-text-in').innerText = 'Switching IN Camera...';
        await this.cameraIn.start(devId);
        document.getElementById('video-placeholder-in').classList.add('hidden');
      } catch (err) {
        document.getElementById('placeholder-text-in').innerText = err.message;
      }
    });

    document.getElementById('select-cam-out').addEventListener('change', async (e) => {
      const devId = e.target.value;
      localStorage.setItem('gate_cam_out', devId);
      try {
        document.getElementById('video-placeholder-out').classList.remove('hidden');
        document.getElementById('placeholder-text-out').innerText = 'Switching OUT Camera...';

        const selectInVal = document.getElementById('select-cam-in').value;
        if (devId && selectInVal && devId === selectInVal && this.cameraIn.stream) {
          const videoOut = document.getElementById('webcam-video-out');
          videoOut.srcObject = this.cameraIn.stream;
          await new Promise(r => videoOut.onloadedmetadata = r);
          this.cameraOut.stream = this.cameraIn.stream;
          this.cameraOut.isActive = true;
          this.cameraOut.resizeCanvas();
        } else {
          await this.cameraOut.start(devId);
        }

        document.getElementById('video-placeholder-out').classList.add('hidden');
        if (!this.isScanningOut) this.startScanningGate('OUT');
      } catch (err) {
        document.getElementById('placeholder-text-out').innerText = err.message;
      }
    });

    // Refresh Devices Button
    document.getElementById('btn-refresh-cams').addEventListener('click', async () => {
      await this.loadCameraDevices();
      await this.startDualCameras();
      this.showToast('Camera devices refreshed', 'info');
    });

    // Camera Toggles
    const toggleInBtn = document.getElementById('btn-toggle-cam-in');
    toggleInBtn.addEventListener('click', async () => {
      if (this.cameraIn && this.cameraIn.isActive) {
        this.cameraIn.stop();
        this.isScanningIn = false;
        toggleInBtn.innerHTML = '<i class="fa-solid fa-video"></i> Start IN';
        document.getElementById('video-placeholder-in').classList.remove('hidden');
        document.getElementById('placeholder-text-in').innerText = 'IN Camera Off';
      } else {
        const devId = document.getElementById('select-cam-in').value;
        await this.cameraIn.start(devId);
        this.startScanningGate('IN');
        toggleInBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i> Stop IN';
        document.getElementById('video-placeholder-in').classList.add('hidden');
      }
    });

    const toggleOutBtn = document.getElementById('btn-toggle-cam-out');
    toggleOutBtn.addEventListener('click', async () => {
      if (this.cameraOut && this.cameraOut.isActive) {
        this.cameraOut.stop();
        this.isScanningOut = false;
        toggleOutBtn.innerHTML = '<i class="fa-solid fa-video"></i> Start OUT';
        document.getElementById('video-placeholder-out').classList.remove('hidden');
        document.getElementById('placeholder-text-out').innerText = 'OUT Camera Off';
      } else {
        const devId = document.getElementById('select-cam-out').value;
        await this.cameraOut.start(devId);
        this.startScanningGate('OUT');
        toggleOutBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i> Stop OUT';
        document.getElementById('video-placeholder-out').classList.add('hidden');
      }
    });

    // Sensitivity Slider
    const slider = document.getElementById('threshold-slider');
    const sliderVal = document.getElementById('threshold-value');
    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value).toFixed(2);
      sliderVal.innerText = val;
      this.detector.updateRegisteredStudents(this.students, parseFloat(val));
    });

    // Student Search Input
    document.getElementById('search-students').addEventListener('input', (e) => {
      this.renderStudentsGrid(e.target.value);
    });

    // Attendance Date & Search Filters
    const dateInput = document.getElementById('filter-date');
    dateInput.value = new Date().toISOString().split('T')[0];
    dateInput.addEventListener('change', async () => {
      this.attendanceLogs = await API.getAttendance(dateInput.value);
      this.renderAttendanceTable();
    });

    document.getElementById('search-attendance').addEventListener('input', () => {
      this.renderAttendanceTable();
    });

    // Manual Register Button
    document.getElementById('btn-manual-register').addEventListener('click', () => {
      this.openRegistrationModal(null, null, 'IN');
    });

    // Modal Close
    document.getElementById('btn-close-modal').addEventListener('click', () => this.closeRegistrationModal());
    document.getElementById('btn-cancel-register').addEventListener('click', () => this.closeRegistrationModal());

    // Register Form Submit
    document.getElementById('form-register-student').addEventListener('submit', (e) => this.handleRegisterSubmit(e));

    // Export CSV
    document.getElementById('btn-export-csv').addEventListener('click', () => this.exportCSV());
  }

  startScanningGate(gateType) {
    if (gateType === 'IN') this.isScanningIn = true;
    if (gateType === 'OUT') this.isScanningOut = true;

    const camera = gateType === 'IN' ? this.cameraIn : this.cameraOut;
    const video = document.getElementById(gateType === 'IN' ? 'webcam-video-in' : 'webcam-video-out');
    const canvas = document.getElementById(gateType === 'IN' ? 'overlay-canvas-in' : 'overlay-canvas-out');

    const scanFrame = async () => {
      const active = gateType === 'IN' ? this.isScanningIn : this.isScanningOut;
      if (!active || !camera || !camera.isActive) return;

      try {
        const detections = await this.detector.detectFaces(video);
        
        if (detections && detections.length > 0) {
          const matches = detections.map(det => this.detector.matchFace(det.descriptor));
          this.detector.drawOverlay(canvas, video, detections, matches);
          
          this.processDetectionResults(detections, matches, camera, gateType);
        } else {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      } catch (err) {
        console.error(`Scan error on Gate ${gateType}:`, err);
      }

      const stillActive = gateType === 'IN' ? this.isScanningIn : this.isScanningOut;
      if (stillActive) {
        setTimeout(scanFrame, 150);
      }
    };

    scanFrame();
  }

  async processDetectionResults(detections, matches, camera, gateType) {
    if (this.unknownModalOpen) return;

    let mainIdx = 0;
    let maxArea = 0;
    detections.forEach((det, i) => {
      const area = det.detection.box.width * det.detection.box.height;
      if (area > maxArea) {
        maxArea = area;
        mainIdx = i;
      }
    });

    const primaryDet = detections[mainIdx];
    const primaryMatch = matches[mainIdx];

    if (primaryMatch && primaryMatch.student) {
      this.unknownFaceHoldCount = 0;
      const student = primaryMatch.student;

      const cooldownKey = `${student.id}_${gateType}`;
      const lastScan = this.scanCooldowns.get(cooldownKey) || 0;
      const now = Date.now();
      
      this.updateDetectionStatusBox(
        'known',
        `Recognized at ${gateType} Gate: ${student.name}`,
        `Student ID: ${student.studentNumber}`
      );

      if (now - lastScan > 10000) { // 10s cooldown per gate
        this.scanCooldowns.set(cooldownKey, now);
        await this.handleKnownStudentAttendance(student, gateType);
      }

    } else {
      this.updateDetectionStatusBox(
        'unknown',
        `Unregistered Face at ${gateType} Gate`,
        'Hold position to register new student...'
      );

      this.unknownFaceHoldCount++;
      
      if (this.unknownFaceHoldCount >= 3) {
        this.unknownFaceHoldCount = 0;
        
        const faceThumb = camera.captureFaceThumbnail(primaryDet.detection.box);
        const descriptorArray = Array.from(primaryDet.descriptor);

        this.playChime('alert');
        this.openRegistrationModal(descriptorArray, faceThumb, gateType);
      }
    }
  }

  updateDetectionStatusBox(type, title, desc) {
    const box = document.getElementById('detection-status-box');
    const icon = document.getElementById('status-box-icon');
    const titleEl = document.getElementById('status-box-title');
    const descEl = document.getElementById('status-box-desc');

    box.className = `status-box ${type}`;
    titleEl.innerText = title;
    descEl.innerText = desc;

    if (type === 'known') {
      icon.className = 'fa-solid fa-circle-check';
    } else if (type === 'unknown') {
      icon.className = 'fa-solid fa-user-plus';
    } else {
      icon.className = 'fa-solid fa-radar';
    }
  }

  async handleKnownStudentAttendance(student, gateType = 'IN') {
    try {
      const res = await API.markAttendance({
        studentId: student.id,
        studentNumber: student.studentNumber,
        name: student.name,
        gateType: gateType
      });

      if (res.alreadyMarked) {
        this.showToast(`Info: ${res.message}`, 'info');
      } else {
        this.playChime('success');
        const icon = gateType === 'IN' ? '🚪 Entry' : '🚪 Exit';
        this.showToast(`✅ Gate ${gateType} (${icon}): ${student.name}`, 'success');
        await this.refreshData();
      }
    } catch (err) {
      console.error('Error marking attendance:', err);
      this.showToast('Error marking attendance: ' + err.message, 'error');
    }
  }

  openRegistrationModal(descriptor, faceThumbnail, gateType = 'IN') {
    this.unknownModalOpen = true;
    this.pendingGateType = gateType;
    this.currentUnknownFace = { descriptor, faceThumbnail };

    const modal = document.getElementById('modal-register');
    const previewImg = document.getElementById('modal-face-preview');
    const alertBox = document.getElementById('modal-form-alert');

    if (faceThumbnail) {
      previewImg.src = faceThumbnail;
      previewImg.style.display = 'block';
    } else {
      previewImg.src = 'https://via.placeholder.com/120?text=No+Photo';
    }

    document.getElementById('reg-student-number').value = '';
    document.getElementById('reg-student-name').value = '';
    alertBox.style.display = 'none';

    modal.classList.add('show');
    document.getElementById('reg-student-number').focus();
  }

  closeRegistrationModal() {
    const modal = document.getElementById('modal-register');
    modal.classList.remove('show');
    this.unknownModalOpen = false;
    this.currentUnknownFace = null;
  }

  async handleRegisterSubmit(e) {
    e.preventDefault();

    const studentNumber = document.getElementById('reg-student-number').value.trim();
    const name = document.getElementById('reg-student-name').value.trim();
    const alertBox = document.getElementById('modal-form-alert');

    if (!studentNumber || !name) {
      alertBox.innerText = 'Please enter both Student Number and Name.';
      alertBox.style.display = 'block';
      return;
    }

    if (!this.currentUnknownFace || !this.currentUnknownFace.descriptor) {
      alertBox.innerText = 'No face vector captured. Please ensure a face is visible in camera.';
      alertBox.style.display = 'block';
      return;
    }

    try {
      const btn = document.getElementById('btn-save-register');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

      // 1. Register student
      const newStudent = await API.registerStudent({
        studentNumber,
        name,
        faceDescriptor: this.currentUnknownFace.descriptor,
        avatarImage: this.currentUnknownFace.faceThumbnail
      });

      // 2. Mark initial gate attendance
      await API.markAttendance({
        studentId: newStudent.id,
        studentNumber: newStudent.studentNumber,
        name: newStudent.name,
        gateType: this.pendingGateType || 'IN'
      });

      this.playChime('success');
      this.showToast(`🎉 Registered & Gate ${this.pendingGateType} Logged for ${newStudent.name}`, 'success');

      this.closeRegistrationModal();
      await this.refreshData();

    } catch (err) {
      console.error('Registration error:', err);
      alertBox.innerText = err.message || 'Registration failed.';
      alertBox.style.display = 'block';
    } finally {
      const btn = document.getElementById('btn-save-register');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Save & Mark Attendance';
    }
  }

  async deleteStudent(id, name) {
    if (!confirm(`Are you sure you want to delete student "${name}"?`)) return;
    try {
      await API.deleteStudent(id);
      this.showToast(`Deleted student ${name}`, 'info');
      await this.refreshData();
    } catch (err) {
      this.showToast('Error deleting student: ' + err.message, 'error');
    }
  }

  renderStudentsGrid(filterQuery = '') {
    const grid = document.getElementById('students-grid');
    grid.innerHTML = '';

    const query = filterQuery.toLowerCase();
    const filtered = this.students.filter(s => 
      s.name.toLowerCase().includes(query) || s.studentNumber.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-feed glass-panel" style="grid-column: 1 / -1;">
          <i class="fa-solid fa-users-slash"></i>
          <p>No students registered yet.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(student => {
      const card = document.createElement('div');
      card.className = 'student-card glass-panel';

      const avatarSrc = student.avatarImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=6366f1&color=fff`;

      const regDate = new Date(student.registeredAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      card.innerHTML = `
        <div class="student-avatar-wrap">
          <img class="student-avatar" src="${avatarSrc}" alt="${student.name}">
        </div>
        <span class="stu-number">${student.studentNumber}</span>
        <h4>${student.name}</h4>
        <span class="reg-date">Registered: ${regDate}</span>
        <div class="student-card-actions">
          <button class="btn-danger-sm" data-id="${student.id}" data-name="${student.name}">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      `;

      card.querySelector('.btn-danger-sm').addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const name = e.currentTarget.getAttribute('data-name');
        this.deleteStudent(id, name);
      });

      grid.appendChild(card);
    });
  }

  renderAttendanceTable() {
    const tbody = document.getElementById('attendance-table-body');
    tbody.innerHTML = '';

    const query = document.getElementById('search-attendance').value.toLowerCase();
    const filtered = this.attendanceLogs.filter(r => 
      r.name.toLowerCase().includes(query) || r.studentNumber.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">
            No attendance records found.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(record => {
      const tr = document.createElement('tr');
      const isOut = record.gateType === 'OUT';
      const gateBadgeClass = isOut ? 'tag-out' : 'tag-in';
      const gateIcon = isOut ? 'fa-door-closed' : 'fa-door-open';
      const statusBadgeClass = isOut ? 'out-gate' : 'present';

      tr.innerHTML = `
        <td><strong>${record.studentNumber}</strong></td>
        <td>${record.name}</td>
        <td><span class="gate-tag ${gateBadgeClass}"><i class="fa-solid ${gateIcon}"></i> ${record.gateType || 'IN'}</span></td>
        <td>${record.date}</td>
        <td>${record.time}</td>
        <td><span class="status-badge ${statusBadgeClass}"><i class="fa-solid ${isOut ? 'fa-person-walking-arrow-right' : 'fa-check'}"></i> ${record.status}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderActivityFeed() {
    const feedList = document.getElementById('feed-list');
    feedList.innerHTML = '';

    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogs = this.attendanceLogs.filter(r => r.date === todayStr).slice(0, 8);

    if (todayLogs.length === 0) {
      feedList.innerHTML = `
        <div class="empty-feed">
          <i class="fa-solid fa-user-clock"></i>
          <p>No scans recorded yet today.</p>
        </div>
      `;
      return;
    }

    todayLogs.forEach(record => {
      const student = this.students.find(s => s.id === record.studentId);
      const avatarSrc = (student && student.avatarImage) 
        ? student.avatarImage 
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(record.name)}&background=6366f1&color=fff`;

      const isOut = record.gateType === 'OUT';
      const gateTagClass = isOut ? 'tag-out' : 'tag-in';

      const item = document.createElement('div');
      item.className = 'feed-item';
      item.innerHTML = `
        <img class="feed-avatar" src="${avatarSrc}" alt="${record.name}">
        <div class="feed-info">
          <div class="name">${record.name}</div>
          <div class="stu-id">${record.studentNumber} • <span class="gate-tag ${gateTagClass}">${record.gateType || 'IN'}</span></div>
        </div>
        <div class="feed-time">${record.time}</div>
      `;
      feedList.appendChild(item);
    });
  }

  exportCSV() {
    if (this.attendanceLogs.length === 0) {
      this.showToast('No attendance logs to export.', 'warning');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Student Number,Student Name,Gate,Date,Time,Status\n';

    this.attendanceLogs.forEach(r => {
      const row = `"${r.studentNumber}","${r.name}","${r.gateType || 'IN'}","${r.date}","${r.time}","${r.status}"`;
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Gate_Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast('📥 CSV Report Downloaded Successfully', 'success');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    if (type === 'error') iconClass = 'fa-circle-xmark';

    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Bootstrap on DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});
