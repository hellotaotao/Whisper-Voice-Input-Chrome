document.addEventListener("DOMContentLoaded", function () {
    // Replace placeholders in HTML
    document.title = chrome.i18n.getMessage("extensionName");
    document.querySelector("h2").textContent =
        chrome.i18n.getMessage("extensionName");

    // Set text content for other elements
    document.getElementById("shortcutInfo").textContent =
        chrome.i18n.getMessage("useShortcut");
    document.getElementById("saveButton").textContent =
        chrome.i18n.getMessage("save");

    // Load saved settings
    chrome.storage.sync.get(
        {
            apiProvider: "openai",
            openaiApiKey: "",
            azureApiKey: "",
            azureEndpoint: "",
            enableAllInputs: false,
            transcriptionModel: "gpt-4o-transcribe",
        },
        function (items) {
            // Set the radio button
            document.querySelector(
                `input[name="apiProvider"][value="${items.apiProvider}"]`
            ).checked = true;

            // Set transcription model
            document.querySelector(
                `input[name="transcriptionModel"][value="${items.transcriptionModel}"]`
            ).checked = true;

            // Set the saved values
            document.getElementById("openaiApiKey").value = items.openaiApiKey;
            document.getElementById("azureApiKey").value = items.azureApiKey;
            document.getElementById("azureEndpoint").value =
                items.azureEndpoint;
            document.getElementById("enableAllInputs").checked =
                items.enableAllInputs;

            // Show the correct settings section
            toggleSettings(items.apiProvider);
        }
    );

    // Add change event listener for radio buttons
    document.querySelectorAll('input[name="apiProvider"]').forEach((radio) => {
        radio.addEventListener("change", (e) => {
            toggleSettings(e.target.value);
        });
    });

    // Save settings
    document
        .getElementById("saveButton")
        .addEventListener("click", function () {
            const apiProvider = document.querySelector(
                'input[name="apiProvider"]:checked'
            ).value;
            const transcriptionModel = document.querySelector(
                'input[name="transcriptionModel"]:checked'
            ).value;
            const openaiApiKey = document.getElementById("openaiApiKey").value;
            const azureApiKey = document.getElementById("azureApiKey").value;
            const azureEndpoint =
                document.getElementById("azureEndpoint").value;
            const enableAllInputs =
                document.getElementById("enableAllInputs").checked;

            chrome.storage.sync.set(
                {
                    apiProvider: apiProvider,
                    transcriptionModel: transcriptionModel,
                    openaiApiKey: openaiApiKey,
                    azureApiKey: azureApiKey,
                    azureEndpoint: azureEndpoint,
                    enableAllInputs: enableAllInputs,
                },
                function () {
                    const status = document.getElementById("status");
                    status.textContent =
                        chrome.i18n.getMessage("settingsSaved");
                    status.className = "success";
                    setTimeout(function () {
                        status.textContent = "";
                        status.className = "";
                    }, 3000);
                }
            );
        });

    // Add keyboard shortcut for save
    document.addEventListener("keydown", function (e) {
        // Check for Ctrl+S or Cmd+S (on Mac)
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault(); // Prevent the browser's default save dialog
            document.getElementById("saveButton").click(); // Trigger the save button click
        }
    });

    // Load existing prompt if available
    chrome.storage.sync.get(["whisperPrompt"], function (result) {
        if (result.whisperPrompt) {
            document.getElementById("whisperPrompt").innerHTML =
                result.whisperPrompt;
        }
    });

    // Save the prompt when it changes
    document
        .getElementById("whisperPrompt")
        .addEventListener("input", function () {
            chrome.storage.sync.set({
                whisperPrompt: this.innerHTML,
            });
        });
});

function toggleSettings(provider) {
    const openaiSettings = document.getElementById("openaiSettings");
    const azureSettings = document.getElementById("azureSettings");

    if (provider === "azure") {
        openaiSettings.style.display = "none";
        azureSettings.style.display = "block";
    } else {
        openaiSettings.style.display = "block";
        azureSettings.style.display = "none";
    }
}
