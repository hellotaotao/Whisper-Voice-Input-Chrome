document.addEventListener("DOMContentLoaded", function () {
    // Replace placeholders in HTML
    document.title =
        chrome.i18n.getMessage("extensionName") +
        " - " +
        chrome.i18n.getMessage("openOptions");
    document.querySelector("h1").textContent =
        chrome.i18n.getMessage("extensionName") +
        " - " +
        chrome.i18n.getMessage("openOptions");

    // Set text content and attributes for form elements
    const apiKeyLabel = document.getElementById("apiKeyLabel");
    apiKeyLabel.textContent = chrome.i18n.getMessage("apiKeyLabel");
    apiKeyLabel.setAttribute("for", "apiKey");

    const languageLabel = document.getElementById("languageLabel");
    languageLabel.textContent = chrome.i18n.getMessage("interfaceLanguage");
    languageLabel.setAttribute("for", "language");

    document.getElementById("save").textContent =
        chrome.i18n.getMessage("save");

    // Load saved settings
    chrome.storage.sync.get(["apiKey", "language"], function (items) {
        document.getElementById("apiKey").value = items.apiKey || "";
        document.getElementById("language").value = items.language || "zh";
    });

    // Save settings
    document.getElementById("save").addEventListener("click", function () {
        var apiKey = document.getElementById("apiKey").value;
        var language = document.getElementById("language").value;

        chrome.storage.sync.set(
            {
                apiKey: apiKey,
                language: language,
            },
            function () {
                alert(chrome.i18n.getMessage("settingsSaved"));
            }
        );
    });
});
