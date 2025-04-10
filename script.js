let mediaRecorder;
let recordedBlobs;
let stream;
let timerInterval;
let startTime;
let audioStream; // separate audio stream
let isRecording = false;
let recordedBlobUrl = null; // Store the current blob URL

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const recordedVideo = document.getElementById('recordedVideo');
const downloadLink = document.getElementById('downloadLink');
const recordingStatus = document.getElementById('recordingStatus');
const recorderContainer = document.getElementById('recorder-container');
const recordingTimer = document.getElementById('recordingTimer');
const recordAudioCheckbox = document.getElementById('recordAudio');

// Load audio preference from localStorage
const savedAudioPreference = localStorage.getItem('recordAudio');
if (savedAudioPreference === 'true') {
	recordAudioCheckbox.checked = true;
}

// Save audio preference to localStorage on change
recordAudioCheckbox.addEventListener('change', () => {
	localStorage.setItem('recordAudio', recordAudioCheckbox.checked);
});

startBtn.addEventListener('click', async () => {
	startBtn.disabled = true;
	recordingStatus.textContent = 'Requesting screen and audio permissions...';
	recordingStatus.style.display = 'block';
	const displayMediaOptions = { video: true, audio: recordAudioCheckbox.checked };
	try {
		stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
		recordingStatus.textContent = 'Permissions granted. Starting recording...';
		
		if (recordAudioCheckbox.checked) {
			try {
				audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
				const tracks = [...stream.getVideoTracks(), ...audioStream.getAudioTracks()];
				const combinedStream = new MediaStream(tracks);
				startRecording(combinedStream);
			} catch (error) {
				console.error('Error accessing microphone:', error);
				alert('Failed to access microphone. Recording will proceed without audio.');
				startRecording(stream);
			}
		} else {
			startRecording(stream);
		}
		
	} catch (error) {
		console.error('Error accessing display media:', error);
		alert('Failed to start screen recording. Please ensure you have granted the necessary permissions.');
		recordingStatus.textContent = 'Failed to start recording.';
		startBtn.disabled = false;
		stopBtn.disabled = true;
		if (stream) {
			stream.getTracks().forEach(track => track.stop());
		}
		if (audioStream) {
			audioStream.getTracks().forEach(track => track.stop());
		}
	}
});

stopBtn.addEventListener('click', () => {
	if (mediaRecorder && mediaRecorder.state === 'recording') {
		recordingStatus.textContent = 'Stopping recording...';
		mediaRecorder.stop();
		stream.getTracks().forEach(track => track.stop());
		if (audioStream) {
			audioStream.getTracks().forEach(track => track.stop());
		}
		isRecording = false;
		stopBtn.classList.remove('recording-active');
	}
});

function startRecording(currentStream) {
	recordedBlobs = [];
	
	// MIME type detection for better compatibility
	let mimeType = '';
	if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
		mimeType = 'video/webm;codecs=vp9';
	} else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
		mimeType = 'video/webm;codecs=vp8';
	} else {
		mimeType = 'video/webm';
	}
	const selectedMimeType = mimeType;
	
	try {
		mediaRecorder = new MediaRecorder(currentStream, { mimeType: selectedMimeType });
	} catch (error) {
		console.error('Error creating MediaRecorder:', error);
		alert(`Your browser does not support the video format (${selectedMimeType}) for recording.`);
		recordingStatus.textContent = 'Error creating recorder.';
		startBtn.disabled = false;
		stopBtn.disabled = true;
		currentStream.getTracks().forEach(track => track.stop());
		if (audioStream) {
			audioStream.getTracks().forEach(track => track.stop());
		}
		return;
	}
	
	mediaRecorder.onstop = (event) => {
		const superBuffer = new Blob(recordedBlobs, { type: selectedMimeType });
		// If there's an existing URL, revoke it before creating a new one.
		if (recordedBlobUrl) {
			window.URL.revokeObjectURL(recordedBlobUrl);
		}
		recordedBlobUrl = window.URL.createObjectURL(superBuffer);
		recordedVideo.src = recordedBlobUrl;
		downloadLink.href = recordedBlobUrl;
		downloadLink.download = 'recording.webm';
		downloadLink.style.display = 'block';
		startBtn.disabled = false;
		stopBtn.disabled = true;
		recorderContainer.classList.remove('recording');
		recordingStatus.textContent = 'Recording saved. Ready to download.';
		recordingStatus.classList.remove('recording');
		clearInterval(timerInterval);
		recordingTimer.textContent = '';
		// Remove the onloadeddata handler to avoid revoking the URL unexpectedly.
		recordedVideo.onloadeddata = null;
		stream = null;
		audioStream = null;
	};
	
	mediaRecorder.ondataavailable = handleDataAvailable;
	mediaRecorder.start();
	stopBtn.disabled = false;
	stopBtn.classList.add('recording-active');
	recorderContainer.classList.add('recording');
	recordingStatus.textContent = 'Recording in progress...';
	recordingStatus.classList.add('recording');
	isRecording = true;
	
	startTime = Date.now();
	timerInterval = setInterval(() => {
		const elapsedTime = Date.now() - startTime;
		const minutes = Math.floor(elapsedTime / (1000 * 60));
		const seconds = Math.floor((elapsedTime % (1000 * 60)) / 1000);
		const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
		recordingTimer.textContent = formattedTime;
	}, 1000);
	
	// Bind onended to stop recording if the user stops screen sharing unexpectedly.
	currentStream.getVideoTracks()[0].onended = () => {
		if (mediaRecorder && mediaRecorder.state === 'recording') {
			mediaRecorder.stop();
		}
		startBtn.disabled = false;
		stopBtn.disabled = true;
		stopBtn.classList.remove('recording-active');
		recorderContainer.classList.remove('recording');
		recordingStatus.textContent = 'Recording stopped (screen sharing ended).';
		recordingStatus.classList.remove('recording');
		clearInterval(timerInterval);
		recordingTimer.textContent = '';
		stream = null;
		audioStream = null;
		isRecording = false;
	};
}

function handleDataAvailable(event) {
	if (event.data && event.data.size > 0) {
		recordedBlobs.push(event.data);
	}
}

window.addEventListener('beforeunload', (event) => {
	if (isRecording) {
		event.preventDefault();
		event.returnValue = '';
		return 'A screen recording is in progress. Are you sure you want to leave?';
	}
});