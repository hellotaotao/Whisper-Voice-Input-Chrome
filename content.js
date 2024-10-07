let isRecording = false;
let isCanceled = false;
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let dataArray;
let waveformCanvas;
let waveformCtx;
let animationId;
let activeElement;
let cursorPosition;

let escKeyListener = null;
let isUIVisible = false;

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "startVoiceInput") {
        toggleRecording();
    } else if (request.action === "cancelRecording") {
        if (isRecording) {
            cancelRecording();
        }
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
    // 保存当前活动元素和光标位置
    activeElement = document.activeElement;
    if (
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "INPUT"
    ) {
        cursorPosition = activeElement.selectionStart;
    } else if (activeElement.isContentEditable) {
        const selection = window.getSelection();
        cursorPosition = selection.getRangeAt(0).startOffset;
    }

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

            // Set up audio analysis
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);

            // Start visualizing audio
            visualizeAudio();
        })
        .catch((error) => {
            console.error("Error accessing microphone:", error);
            alert(chrome.i18n.getMessage("microphoneError"));
        });
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        showProcessingUI();
    }
}

function cancelRecording() {
    console.log("Canceling recording");
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        isCanceled = true; // Set the canceled flag
        audioChunks = []; // Clear the recorded audio
    }
    hideRecordingUI();
    restoreFocus();
}

function restoreFocus() {
    if (activeElement) {
        activeElement.focus();
        if (
            activeElement.tagName === "TEXTAREA" ||
            activeElement.tagName === "INPUT"
        ) {
            activeElement.selectionStart = activeElement.selectionEnd =
                cursorPosition;
        } else if (activeElement.isContentEditable) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.setStart(activeElement.firstChild, cursorPosition);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

function sendAudioToWhisper() {
    if (isCanceled) {
        // Check if the recording was canceled
        isCanceled = false; // Reset the flag
        return; // Exit the function without processing
    }

    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    audioChunks = [];

    chrome.storage.sync.get("apiKey", function (data) {
        if (!data.apiKey) {
            alert(chrome.i18n.getMessage("apiKeyMissing"));
            hideRecordingUI();
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
                alert(chrome.i18n.getMessage("transcriptionError"));
            })
            .finally(() => {
                hideRecordingUI();
            });
    });
}

function insertTextAtCursor(text) {
    // 恢复焦点到原来的元素
    activeElement.focus();

    if (activeElement.isContentEditable) {
        // 对于可编辑的div等元素
        const selection = window.getSelection();
        const range = document.createRange();
        range.setStart(activeElement.firstChild, cursorPosition);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand("insertText", false, text);
    } else if (
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "INPUT"
    ) {
        // 对于textarea和input元素
        const start = cursorPosition;
        const end = cursorPosition;
        activeElement.value =
            activeElement.value.substring(0, start) +
            text +
            activeElement.value.substring(end);
        activeElement.selectionStart = activeElement.selectionEnd =
            start + text.length;
    }
}

function showRecordingUI() {
    const uiContainer = document.createElement("div");
    uiContainer.id = "voice-input-ui";
    uiContainer.style.cssText = `
    position: fixed;
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 15px;
    padding: 5px 12px;
    display: flex;
    align-items: center;
    z-index: 9999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  `;

    // Position the UI near the active element
    const rect = activeElement.getBoundingClientRect();
    uiContainer.style.left = `${rect.left}px`;
    uiContainer.style.top = `${rect.bottom + 5}px`;

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "×";
    cancelButton.style.cssText = `
    background-color: #ff4d4d;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    font-size: 16px;
    cursor: pointer;
    margin-right: 10px;
  `;
    cancelButton.onclick = cancelRecording;

    waveformCanvas = document.createElement("canvas");
    waveformCanvas.id = "waveform";
    waveformCanvas.width = 200;
    waveformCanvas.height = 40;
    waveformCanvas.style.margin = "0 10px";
    waveformCtx = waveformCanvas.getContext("2d");

    const timer = document.createElement("span");
    timer.id = "recording-timer";
    timer.textContent = "00:00";
    timer.style.cssText = `
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #333;
    margin-right: 10px;
    min-width: 40px;
    text-align: center;
  `;

    const doneButton = document.createElement("button");
    doneButton.id = "done-button";
    doneButton.textContent = "✔";
    doneButton.style.cssText = `
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    font-size: 16px;
    cursor: pointer;
  `;
    doneButton.onclick = stopRecording;

    uiContainer.appendChild(cancelButton);
    uiContainer.appendChild(waveformCanvas);
    uiContainer.appendChild(timer);
    uiContainer.appendChild(doneButton);

    document.body.appendChild(uiContainer);

    // Set focus to the UI container
    uiContainer.tabIndex = -1;
    uiContainer.focus();

    startTimer();
    isUIVisible = true;

    // Add global event listener for 'Esc' and 'Enter' keys
    document.addEventListener("keydown", handleGlobalKeydown);
    console.log("Global event listener for Esc and Enter keys added");
}

function handleGlobalKeydown(event) {
    if (isRecording) {
        if (event.key === "Escape") {
            console.log("Esc key pressed, canceling recording");
            cancelRecording();
            event.preventDefault(); // Prevent the default Esc key behavior
        } else if (event.key === "Enter") {
            console.log("Enter key pressed, stopping recording");
            stopRecording();
            event.preventDefault(); // Prevent the default Enter key behavior
        }
    }
}

function showProcessingUI() {
    const doneButton = document.getElementById("done-button");
    if (doneButton) {
        doneButton.innerHTML = `
        <div style="width: 16px; height: 16px; border: 2px solid #ffffff; border-top: 2px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        `;
        doneButton.style.cursor = "default";
        doneButton.onclick = null;
    }

    const style = document.createElement("style");
    style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
    document.head.appendChild(style);
}

function hideRecordingUI() {
    const uiContainer = document.getElementById("voice-input-ui");
    if (uiContainer) {
        uiContainer.remove();
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    isUIVisible = false;
    // Remove the global 'Esc' and 'Enter' key event listener
    document.removeEventListener("keydown", handleGlobalKeydown);
    console.log("Global event listener for Esc and Enter keys removed");
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

function visualizeAudio() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    waveformCtx.fillStyle = "rgb(240, 240, 240)";
    waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

    function draw() {
        animationId = requestAnimationFrame(draw);

        analyser.getByteTimeDomainData(dataArray);

        // 移动现有的波形
        const imageData = waveformCtx.getImageData(
            2,
            0,
            waveformCanvas.width - 2,
            waveformCanvas.height
        );
        waveformCtx.putImageData(imageData, 0, 0);

        // 绘制新的波形数据
        waveformCtx.lineWidth = 2;
        waveformCtx.strokeStyle = "rgb(0, 0, 0)";
        waveformCtx.beginPath();

        const sliceWidth = (waveformCanvas.width * 1.0) / bufferLength;
        let x = waveformCanvas.width - 2; // 从右侧开始绘制

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * waveformCanvas.height) / 2;

            if (i === 0) {
                waveformCtx.moveTo(x, y);
            } else {
                waveformCtx.lineTo(x, y);
            }

            x -= sliceWidth;
        }

        waveformCtx.stroke();
    }

    draw();
}

// 初始化错误处理
window.onerror = function (message, source, lineno, colno, error) {
    console.error("An error occurred:", error);
    alert(chrome.i18n.getMessage("generalError"));
    return true;
};
