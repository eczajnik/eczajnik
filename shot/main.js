const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const ctx = canvasElement.getContext('2d', { willReadFrequently: true });

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            video: { width: 320, height: 240, facingMode: { exact: "environment" } }
        });
        videoElement.srcObject = stream;
    } catch (err) {
        console.error('Error accessing the camera:', err);
    }
}

// Ensure the canvas dimensions match the video dimensions
videoElement.addEventListener('loadedmetadata', () => {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
});

startCamera();



let videoStarted = false;

// Load OpenCV.js
cv.onRuntimeInitialized = () => {
    const videoWidth = 320; // New width for the video feed
    const videoHeight = 240; // New height for the video feed

    // Set the width and height of the video element and canvas
    videoElement.width = videoWidth;
    videoElement.height = videoHeight;
    canvasElement.width = videoWidth;
    canvasElement.height = videoHeight;

    videoElement.addEventListener('play', () => {
        if (!videoStarted) {
            videoStarted = true;

            const circles = new cv.Mat();
            let lastFrameTime = performance.now();
            let frameCount = 0;
            let circleTrail = []; // Array to store circle center trail

            const processVideo = () => {
                if (!videoElement.paused && !videoElement.ended) {
                    // Create a cv.Mat from the video frame
                    const frame = new cv.Mat(videoHeight, videoWidth, cv.CV_8UC4);
                    ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
                    const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
                    frame.data.set(imageData.data);

                    // Convert the frame to grayscale
                    const gray = new cv.Mat();
                    cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);


                    // Detect circles using HoughCircles
                    cv.HoughCircles(
                        gray,
                        circles,
                        cv.HOUGH_GRADIENT,
                        1,          // dp (inverse ratio of the accumulator resolution to the image resolution)
                        20,         // minDist (minimum distance between the centers of the detected circles)
                        100,        // param1 (higher threshold for the edge detection)
                        50,         // param2 (accumulator threshold for circle detection, higher value means stricter detection)
                        10,         // minRadius (minimum radius of the circles to be detected)
                        50          // maxRadius (maximum radius of the circles to be detected)
                    );

                    // Calculate the time elapsed since the last frame
                    const currentTime = performance.now();
                    const elapsedTime = currentTime - lastFrameTime;
                    lastFrameTime = currentTime;

                    // Update the frame count and calculate FPS
                    frameCount++;
                    const fps = Math.round(1000 / elapsedTime); // Calculate FPS based on milliseconds per frame

                    // Find the largest circle among the detected circles
                    let largestCircle = null;
                    if (circles.cols > 0) {
                        const circleData = circles.data32F;
                        let maxRadius = -1;
                        for (let i = 0; i < circles.cols; i++) {
                            const x = circleData[i * 3];
                            const y = circleData[i * 3 + 1];
                            const radius = circleData[i * 3 + 2];
                            if (radius > maxRadius) {
                                maxRadius = radius;
                                largestCircle = { x, y, radius };
                            }
                        }
                    }

                    // Add the circle center to the trail
                    if (largestCircle) {
                        circleTrail.push({ x: largestCircle.x, y: largestCircle.y, timestamp: currentTime });
                    }

                    // Clear the canvas
                    ctx.clearRect(0, 0, videoWidth, videoHeight);

                    // Draw the video frame on the canvas
                    ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

                    // Draw the largest circle on the canvas
                    if (largestCircle) {
                        const { x, y, radius } = largestCircle;

                        // Draw the circle
                        ctx.beginPath();
                        ctx.arc(x, y, radius, 0, 2 * Math.PI);
                        ctx.strokeStyle = 'red'; // Circle color (red)
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        // Draw the crosshair in the center of the circle
                        const crosshairSize = 10;
                        ctx.beginPath();
                        ctx.moveTo(x - crosshairSize, y);
                        ctx.lineTo(x + crosshairSize, y);
                        ctx.moveTo(x, y - crosshairSize);
                        ctx.lineTo(x, y + crosshairSize);
                        ctx.strokeStyle = 'red'; // Crosshair color (red)
                        ctx.stroke();
                    }

                    // Draw the circle trail
                    const trailDuration = 500; // 0.5 second
                    const currentTimeMs = currentTime;
                    for (let i = circleTrail.length - 1; i >= 0; i--) {
                        const trailPoint = circleTrail[i];
                        const timeDifference = currentTimeMs - trailPoint.timestamp;
                        if (timeDifference <= trailDuration) {
                            const alpha = 1 - timeDifference / trailDuration;
                            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`; // Yellow with alpha
                            ctx.beginPath();
                            ctx.arc(trailPoint.x, trailPoint.y, 3, 0, 2 * Math.PI);
                            ctx.fill();
                        } else {
                            // Remove points that have faded out
                            circleTrail.splice(i, 1);
                        }
                    }

                    // Draw the FPS counter on the canvas
                    ctx.font = '16px Arial';
                    ctx.fillStyle = 'blue'; // FPS counter color (blue)
                    ctx.fillText(`FPS: ${fps}`, 10, 30);

                    frame.delete(); // Release the frame Mat
                    gray.delete();  // Release the grayscale Mat

                    // Request the next frame
                    requestAnimationFrame(processVideo);
                }
            };

            processVideo();
        }
    });
};


