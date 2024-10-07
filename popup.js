document.addEventListener("DOMContentLoaded", function () {
    // Replace placeholders in HTML
    document.title = chrome.i18n.getMessage("extensionName");
    document.querySelector("h2").textContent =
        chrome.i18n.getMessage("extensionName");

    // Set text content for other elements
    document.getElementById("shortcutInfo").textContent =
        chrome.i18n.getMessage("useShortcut");
    document.getElementById("optionsButton").textContent =
        chrome.i18n.getMessage("openOptions");

    // Add click event listener
    document
        .getElementById("optionsButton")
        .addEventListener("click", function () {
            chrome.runtime.openOptionsPage();
        });
});
