document.addEventListener("DOMContentLoaded", function () {
    // Load saved settings
    chrome.storage.sync.get(
        ["apiKey", "apiEndpoint", "useAzure", "useOpenAISession"],
        function (items) {
            document.getElementById("apiKey").value = items.apiKey || "";
            document.getElementById("apiEndpoint").value =
                items.apiEndpoint || "";
            document.getElementById("apiProvider").value = items.useAzure
                ? "azure"
                : "openai";
            document.getElementById("useOpenAISession").checked =
                items.useOpenAISession || false;
            toggleAzureSettings();
        }
    );

    // Save settings
    document.getElementById("save").addEventListener("click", function () {
        var apiKey = document.getElementById("apiKey").value;
        var apiEndpoint = document.getElementById("apiEndpoint").value;
        var useAzure = document.getElementById("apiProvider").value === "azure";
        var useOpenAISession =
            document.getElementById("useOpenAISession").checked;

        chrome.storage.sync.set(
            {
                apiKey: apiKey,
                apiEndpoint: apiEndpoint,
                useAzure: useAzure,
                useOpenAISession: useOpenAISession,
            },
            function () {
                var status = document.getElementById("status");
                status.textContent = "Settings saved.";
                status.className = "success";
                setTimeout(function () {
                    status.textContent = "";
                    status.className = "";
                }, 3000);
            }
        );
    });

    // Toggle Azure settings visibility
    document
        .getElementById("apiProvider")
        .addEventListener("change", toggleAzureSettings);
});

function toggleAzureSettings() {
    var apiProvider = document.getElementById("apiProvider").value;
    var azureSettings = document.getElementById("azureSettings");
    azureSettings.style.display = apiProvider === "azure" ? "block" : "none";
}
