chrome.runtime.onInstalled.addListener(() => {
    // Load existing settings
    chrome.storage.sync.get(["apiKey", "apiEndpoint", "useAzure"], (items) => {
        // Prepare default settings
        const defaultSettings = {
            apiKey: items.apiKey || "",
            apiEndpoint: items.apiEndpoint || "",
            useAzure: items.useAzure || false,
        };

        // Save settings, preserving existing values
        chrome.storage.sync.set(defaultSettings, () => {
            console.log("Settings initialized or updated");
        });
    });
    
    // Create context menu item only once during installation
    chrome.contextMenus.create({
        id: "voiceInput",
        title: chrome.i18n.getMessage("voiceInput"),
        contexts: ["editable"],
    });
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === "voiceInput") {
        chrome.tabs.sendMessage(tab.id, { action: "startVoiceInput" });
    }
});

chrome.commands.onCommand.addListener(function (command) {
    if (command === "start_recording") {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "startVoiceInput",
                });
            }
        );
    }
});
