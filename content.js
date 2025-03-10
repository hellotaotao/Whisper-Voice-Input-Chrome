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

// Add voice input button to editable elements
function addVoiceInputButton(element) {
    // Check if the element already has a voice input button
    if (element.getAttribute('data-has-voice-input') === 'true') {
        return;
    }

    // Create a container for the element with appropriate CSS class
    const container = document.createElement('div');
    container.className = element.tagName === 'DIV' ? 'voice-input-container voice-input-container-div' : 'voice-input-container';

    // Wrap the original element in the container
    const parent = element.parentNode;
    if (parent) {
        parent.insertBefore(container, element);
        container.appendChild(element);
    }

    const button = document.createElement('button');
    button.innerHTML = '🎤';
    button.className = 'voice-input-button';

    // Hover effects are now handled by CSS
    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeElement = element;
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            cursorPosition = element.selectionStart;
        } else if (element.isContentEditable) {
            const selection = window.getSelection();
            cursorPosition = selection.getRangeAt(0).startOffset;
        }
        startRecording();
    });

    container.appendChild(button);

    // Mark the element as having a voice input button
    element.setAttribute('data-has-voice-input', 'true');

    // Ensure the button is visible
    setTimeout(() => {
        if (button && button.parentNode) {
            // Force redraw to ensure visibility
            button.style.display = 'none';
            button.offsetHeight; // Trigger redraw
            button.style.display = '';
        }
    }, 100);
}

// Initialize voice input buttons
function initVoiceInputButtons() {
    chrome.storage.sync.get(['enableAllInputs'], function(result) {
        // First clean up existing buttons and observers
        document.querySelectorAll('[data-has-voice-input="true"]').forEach(element => {
            const container = element.parentElement;
            if (container && container.parentElement) {
                container.parentElement.replaceChild(element, container);
            }
            element.removeAttribute('data-has-voice-input');
        });

        if (result.enableAllInputs) {
            // Add voice input buttons to all multi-line input boxes
            document.querySelectorAll('textarea').forEach(addVoiceInputButton);
            
            // Add voice input buttons to all text input boxes
            document.querySelectorAll('input[type="text"], input:not([type])').forEach(addVoiceInputButton);

            // Add voice input buttons to all editable divs
            document.querySelectorAll('div[contenteditable="true"]').forEach(addVoiceInputButton);

            // Create a MutationObserver to monitor newly added elements
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            if (node.tagName === 'TEXTAREA' || 
                                (node.tagName === 'DIV' && node.contentEditable === 'true') ||
                                (node.tagName === 'INPUT' && (node.type === 'text' || !node.type))) {
                                addVoiceInputButton(node);
                            }
                            // Check child elements of the newly added node
                            node.querySelectorAll('textarea, div[contenteditable="true"], input[type="text"], input:not([type])')
                                .forEach(addVoiceInputButton);
                        }
                    });
                });
            });

            // Start observing document changes
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            // Save observer instance for later disconnection
            window.voiceInputObserver = observer;
        } else {
            // Disconnect observer when disabled
            if (window.voiceInputObserver) {
                window.voiceInputObserver.disconnect();
            }
        }
    });
}

// Initialize voice input buttons after the page has loaded
document.addEventListener('DOMContentLoaded', initVoiceInputButtons);

// Ensure initialization is also performed once the page is fully loaded, to handle delayed loaded elements
window.addEventListener('load', function() {
    setTimeout(initVoiceInputButtons, 500);
});

// Add periodic checks to ensure buttons are displayed correctly
setInterval(function() {
    document.querySelectorAll('[data-has-voice-input="true"]').forEach(element => {
        const container = element.parentElement;
        if (container) {
            const button = container.querySelector('button');
            if (button && !button.classList.contains('voice-input-button')) {
                button.className = 'voice-input-button';
            }
        }
    });
}, 2000);

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

function checkApiKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['apiProvider', 'openaiApiKey', 'azureApiKey', 'azureEndpoint'], function(result) {
            if (result.apiProvider === 'azure') {
                if (!result.azureApiKey || !result.azureEndpoint) {
                    alert(chrome.i18n.getMessage("azureEndpointMissing"));
                    return resolve(false);
                }
            } else {
                if (!result.openaiApiKey) {
                    alert(chrome.i18n.getMessage("apiKeyMissing"));
                    return resolve(false);
                }
            }
            resolve(true);
        });
    });
}

async function startRecording() {
    const hasApiKey = await checkApiKey();
    if (!hasApiKey) {
        return; // Exit if no API key
    }
    // Save the current active element and cursor position
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
            audioStream = stream;
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

    // Stop all audio tracks
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    // Stop the waveform animation
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

function cancelRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        isCanceled = true; // Set the canceled flag
        audioChunks = []; // Clear the recorded audio
    }

    // Stop all audio tracks
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    // Stop the waveform animation
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
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
        isCanceled = false;
        return;
    }

    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    audioChunks = [];

    chrome.storage.sync.get(
        ['apiProvider', 'openaiApiKey', 'azureApiKey', 'azureEndpoint'],
        function (data) {
            const formData = new FormData();
            formData.append("file", audioBlob, "audio.webm");
            formData.append("model", "whisper-1");

            let apiUrl;
            let headers = {};

            if (data.apiProvider === 'azure') {
                if (!data.azureApiKey || !data.azureEndpoint) {
                    alert(chrome.i18n.getMessage("azureEndpointMissing"));
                    hideRecordingUI();
                    return;
                }
                apiUrl = `${data.azureEndpoint}`;
                headers["api-key"] = data.azureApiKey;
            } else {
                // OpenAI
                if (!data.openaiApiKey) {
                    alert(chrome.i18n.getMessage("apiKeyMissing"));
                    hideRecordingUI();
                    return;
                }
                apiUrl = "https://api.openai.com/v1/audio/transcriptions";
                headers["Authorization"] = `Bearer ${data.openaiApiKey}`;
            }

            fetch(apiUrl, {
                method: "POST",
                headers: headers,
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
        }
    );
}

function insertTextAtCursor(text) {
    // Restore focus to the original element
    activeElement.focus();

    if (activeElement.isContentEditable) {
        // For editable div elements
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
        // For textarea and input elements
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

    // Position the UI near the active element
    const rect = activeElement.getBoundingClientRect();
    uiContainer.style.left = `${rect.left}px`;
    uiContainer.style.top = `${rect.bottom + 5}px`;

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "×";
    cancelButton.className = "cancel-button";
    cancelButton.onclick = cancelRecording;

    waveformCanvas = document.createElement("canvas");
    waveformCanvas.id = "waveform";
    waveformCanvas.width = 200;
    waveformCanvas.height = 40;
    waveformCtx = waveformCanvas.getContext("2d", { willReadFrequently: true });

    const timer = document.createElement("span");
    timer.id = "recording-timer";
    timer.textContent = "00:00";

    const doneButton = document.createElement("button");
    doneButton.id = "done-button";
    doneButton.textContent = "✔";
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
}

function handleGlobalKeydown(event) {
    if (isRecording) {
        if (event.key === "Escape") {
            cancelRecording();
            event.preventDefault(); // Prevent the default Esc key behavior
        } else if (event.key === "Enter") {
            stopRecording();
            event.preventDefault(); // Prevent the default Enter key behavior
        }
    }
}

function showProcessingUI() {
    const doneButton = document.getElementById("done-button");
    if (doneButton) {
        doneButton.innerHTML = '<div class="loading-spinner"></div>';
        doneButton.style.cursor = "default";
        doneButton.onclick = null;
    }
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

        // Move existing waveform
        const imageData = waveformCtx.getImageData(
            2,
            0,
            waveformCanvas.width - 2,
            waveformCanvas.height,
            { willReadFrequently: true }
        );
        waveformCtx.putImageData(imageData, 0, 0);

        // Draw new waveform data
        waveformCtx.lineWidth = 2;
        waveformCtx.strokeStyle = "rgb(0, 0, 0)";
        waveformCtx.beginPath();

        const sliceWidth = (waveformCanvas.width * 1.0) / bufferLength;
        let x = waveformCanvas.width - 2; // Start drawing from the right side

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

// Initialize error handling
window.onerror = function (message, source, lineno, colno, error) {
    console.error("An error occurred:", error);
    alert(chrome.i18n.getMessage("generalError"));
    return true;
};
