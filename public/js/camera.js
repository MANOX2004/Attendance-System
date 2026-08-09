// Camera Module
class CameraManager {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.stream = null;
    this.isActive = false;
  }

  async start(deviceId = null) {
    try {
      this.stop(); // Ensure any existing stream is stopped first

      const videoConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      if (deviceId) {
        videoConstraints.deviceId = { exact: deviceId };
      } else {
        videoConstraints.facingMode = 'user';
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });
      
      this.video.srcObject = this.stream;
      
      return new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.isActive = true;
          this.resizeCanvas();
          resolve(true);
        };
      });
    } catch (err) {
      console.error('Camera access error:', err);
      throw new Error('Unable to access selected camera device: ' + (err.message || 'Permission denied'));
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.isActive = false;
  }

  resizeCanvas() {
    if (!this.video || !this.canvas) return;
    const width = this.video.videoWidth || this.video.clientWidth;
    const height = this.video.videoHeight || this.video.clientHeight;
    
    if (width && height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  // Capture face crop thumbnail image base64
  captureFaceThumbnail(box) {
    if (!this.video || !this.isActive) return null;
    
    const cropCanvas = document.createElement('canvas');
    const ctx = cropCanvas.getContext('2d');
    
    // Add margin around face box
    const margin = 0.25;
    const padX = box.width * margin;
    const padY = box.height * margin;

    let sx = Math.max(0, box.x - padX);
    let sy = Math.max(0, box.y - padY);
    let sw = Math.min(this.video.videoWidth - sx, box.width + padX * 2);
    let sh = Math.min(this.video.videoHeight - sy, box.height + padY * 2);

    cropCanvas.width = 200;
    cropCanvas.height = 200;

    // Canvas is mirrored, flip context to render unmirrored face thumbnail
    ctx.translate(200, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(
      this.video,
      sx, sy, sw, sh,
      0, 0, 200, 200
    );

    return cropCanvas.toDataURL('image/jpeg', 0.85);
  }
}

window.CameraManager = CameraManager;
