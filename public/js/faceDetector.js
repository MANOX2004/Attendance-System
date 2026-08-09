// Face Detection & Recognition Engine
class FaceDetectorEngine {
  constructor() {
    this.modelsLoaded = false;
    this.faceMatcher = null;
    this.registeredStudents = [];
    this.distanceThreshold = 0.50;
  }

  async loadModels(onProgress) {
    const MODEL_URL = '/models';
    try {
      if (onProgress) onProgress('Loading Face Detection Model...');
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

      if (onProgress) onProgress('Loading Landmark Model...');
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);

      if (onProgress) onProgress('Loading Recognition Model...');
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

      this.modelsLoaded = true;
      if (onProgress) onProgress('AI Models Loaded Successfully!');
    } catch (err) {
      console.error('Error loading face-api models:', err);
      throw err;
    }
  }

  updateRegisteredStudents(students, distanceThreshold = 0.50) {
    this.registeredStudents = students;
    this.distanceThreshold = distanceThreshold;

    if (!students || students.length === 0) {
      this.faceMatcher = null;
      return;
    }

    const labeledDescriptors = students
      .filter(s => Array.isArray(s.faceDescriptor) && s.faceDescriptor.length === 128)
      .map(student => {
        const floatArray = new Float32Array(student.faceDescriptor);
        return new faceapi.LabeledFaceDescriptors(student.id, [floatArray]);
      });

    if (labeledDescriptors.length > 0) {
      this.faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, this.distanceThreshold);
    } else {
      this.faceMatcher = null;
    }
  }

  async detectFaces(videoElement) {
    if (!this.modelsLoaded || !videoElement) return [];

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.5
    });

    const detections = await faceapi
      .detectAllFaces(videoElement, options)
      .withFaceLandmarks()
      .withFaceDescriptors();

    return detections;
  }

  matchFace(descriptor) {
    if (!this.faceMatcher) return { label: 'unknown', distance: 1.0, student: null };
    const match = this.faceMatcher.findBestMatch(descriptor);
    
    if (match.label !== 'unknown') {
      const student = this.registeredStudents.find(s => s.id === match.label);
      return {
        label: match.label,
        distance: match.distance,
        student: student || null
      };
    }

    return { label: 'unknown', distance: match.distance, student: null };
  }

  drawOverlay(canvas, videoElement, detections, matches) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detections || detections.length === 0) return;

    const resizedDetections = faceapi.resizeResults(detections, {
      width: canvas.width,
      height: canvas.height
    });

    resizedDetections.forEach((detection, i) => {
      const match = matches[i];
      const box = detection.detection.box;
      const isKnown = match && match.student;

      // Box Styling
      const color = isKnown ? '#10b981' : '#f59e0b';
      const labelText = isKnown 
        ? `${match.student.name} (${Math.round((1 - match.distance) * 100)}%)`
        : `Unknown Face`;

      // Draw custom bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      // Rounded rectangle
      const radius = 10;
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.width, box.height, radius);
      ctx.stroke();

      // Reset shadow for text
      ctx.shadowBlur = 0;

      // Text Label Background
      ctx.font = 'bold 14px "Outfit", sans-serif';
      const textWidth = ctx.measureText(labelText).width;
      const padX = 10;
      const padY = 6;
      const labelHeight = 24;

      // Notice canvas is flipped horizontally via CSS, flip context locally to render readable text
      ctx.save();
      ctx.translate(box.x + box.width / 2, box.y - 12);
      ctx.scale(-1, 1); // Un-mirror label text

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(- (textWidth / 2 + padX), -labelHeight / 2, textWidth + padX * 2, labelHeight, 6);
      ctx.fill();

      // Text string
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 0, 0);

      ctx.restore();
    });
  }
}

window.FaceDetectorEngine = FaceDetectorEngine;
