let isRecording = false;
let mediaRecorder;
let audioChunks = [];

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "startVoiceInput") {
        toggleRecording();
    }
});

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            mediaRecorder.onstop = sendAudioToWhisper;

            mediaRecorder.start();
            isRecording = true;
            showRecordingUI();

            // Add audio visualization
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            function updateWaveform() {
                if (!isRecording) return;

                analyser.getByteTimeDomainData(dataArray);
                const waveform = document.getElementById("waveform");
                const ctx = waveform.getContext("2d");

                ctx.clearRect(0, 0, waveform.width, waveform.height);
                ctx.beginPath();
                ctx.strokeStyle = "#4CAF50";

                const sliceWidth = waveform.width / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = (v * waveform.height) / 2;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }

                    x += sliceWidth;
                }

                ctx.stroke();
                requestAnimationFrame(updateWaveform);
            }

            updateWaveform();
        })
        .catch((error) => {
            console.error("Error accessing microphone:", error);
            alert("无法访问麦克风，请检查权限设置。");
        });
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        hideRecordingUI();
    }
}

function sendAudioToWhisper() {
    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    audioChunks = [];

    chrome.storage.sync.get("apiKey", function (data) {
        if (!data.apiKey) {
            alert("请在选项页面设置Whisper API Key。");
            return;
        }

        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");
        formData.append("model", "whisper-1");

        fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${data.apiKey}`,
            },
            body: formData,
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.text) {
                    insertTextAtCursor(data.text);
                } else {
                    throw new Error("No transcription received");
                }
            })
            .catch((error) => {
                console.error("Error sending audio to Whisper:", error);
                alert("语音识别失败，请重试。");
            });
    });
}

function insertTextAtCursor(text) {
    const activeElement = document.activeElement;
    if (activeElement.isContentEditable) {
        document.execCommand("insertText", false, text);
    } else if (
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "INPUT"
    ) {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        activeElement.value =
            activeElement.value.substring(0, start) +
            text +
            activeElement.value.substring(end);
        activeElement.selectionStart = activeElement.selectionEnd =
            start + text.length;
    }
}

function showRecordingUI() {
    const activeElement = document.activeElement;
    const uiContainer = document.createElement("div");
    uiContainer.id = "voice-input-ui";
    uiContainer.style.cssText = `
    position: absolute;
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 10px;
    display: flex;
    align-items: center;
    z-index: 9999;
  `;

    // Position the UI near the active element
    const rect = activeElement.getBoundingClientRect();
    uiContainer.style.left = `${rect.left}px`;
    uiContainer.style.top = `${rect.bottom + 5}px`;

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "×";
    cancelButton.onclick = stopRecording;

    const waveform = document.createElement("canvas");
    waveform.id = "waveform";
    waveform.width = 100;
    waveform.height = 20;
    waveform.style.margin = "0 10px";

    const timer = document.createElement("span");
    timer.id = "recording-timer";
    timer.textContent = "00:00";

    const doneButton = document.createElement("button");
    doneButton.textContent = "✔";
    doneButton.onclick = stopRecording;

    uiContainer.appendChild(cancelButton);
    uiContainer.appendChild(waveform);
    uiContainer.appendChild(timer);
    uiContainer.appendChild(doneButton);

    document.body.appendChild(uiContainer);

    startTimer();
    animateWaveform();
}

function hideRecordingUI() {
    const uiContainer = document.getElementById("voice-input-ui");
    if (uiContainer) {
        uiContainer.remove();
    }
}

function startTimer() {
    let seconds = 0;
    const timerElement = document.getElementById("recording-timer");
    const timerInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timerElement.textContent = `${minutes
            .toString()
            .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;

        if (!isRecording) {
            clearInterval(timerInterval);
        }
    }, 1000);
}

function animateWaveform() {
    const waveform = document.getElementById("waveform");
    const ctx = waveform.getContext("2d");
    let animationId;

    function drawWaveform() {
        ctx.clearRect(0, 0, waveform.width, waveform.height);
        ctx.beginPath();
        ctx.moveTo(0, waveform.height / 2);

        for (let i = 0; i < waveform.width; i++) {
            const y =
                waveform.height / 2 +
                Math.sin(i * 0.1 + Date.now() * 0.01) * (waveform.height / 4);
            ctx.lineTo(i, y);
        }

        ctx.strokeStyle = "#4CAF50";
        ctx.stroke();

        if (isRecording) {
            animationId = requestAnimationFrame(drawWaveform);
        }
    }

    animationId = requestAnimationFrame(drawWaveform);

    return () => {
        cancelAnimationFrame(animationId);
    };
}

// 初始化错误处理
window.onerror = function (message, source, lineno, colno, error) {
    console.error("An error occurred:", error);
    alert("发生错误，请刷新页面重试。");
    return true;
};
