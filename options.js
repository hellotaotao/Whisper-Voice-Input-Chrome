document.addEventListener("DOMContentLoaded", function () {
    // Load saved settings
    chrome.storage.sync.get(
        ["apiKey", "apiEndpoint", "useAzure"],
        function (items) {
            document.getElementById("apiKey").value = items.apiKey || "";
            document.getElementById("apiEndpoint").value =
                items.apiEndpoint || "";
            document.getElementById("apiProvider").value = items.useAzure
                ? "azure"
                : "openai";
            toggleAzureSettings();
        }
    );

    // Save settings
    document.getElementById("save").addEventListener("click", function () {
        var apiKey = document.getElementById("apiKey").value;
        var apiEndpoint = document.getElementById("apiEndpoint").value;
        var useAzure = document.getElementById("apiProvider").value === "azure";

        chrome.storage.sync.set(
            {
                apiKey: apiKey,
                apiEndpoint: apiEndpoint,
                useAzure: useAzure,
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
