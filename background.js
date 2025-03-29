chrome.runtime.onInstalled.addListener(() => {
    // First remove any existing rules, then add new ones
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1], // Remove rule with ID 1 if it exists
        addRules: [
            {
                id: 1,
                priority: 1,
                action: {
                    type: "modifyHeaders",
                    responseHeaders: [
                        { header: "Permissions-Policy", operation: "remove" },
                    ],
                },
                condition: {
                    urlFilter: "*",
                    resourceTypes: ["main_frame"],
                },
            },
        ],
    });
    // Load existing settings
    chrome.storage.sync.get(
        [
            "apiProvider",
            "openaiApiKey",
            "azureApiKey",
            "azureEndpoint",
            "enableAllInputs",
            "transcriptionModel",
        ],
        (items) => {
            // Prepare default settings
            const defaultSettings = {
                apiProvider: items.apiProvider || "openai",
                openaiApiKey: items.openaiApiKey || "",
                azureApiKey: items.azureApiKey || "",
                azureEndpoint: items.azureEndpoint || "",
                enableAllInputs: items.enableAllInputs || false,
                transcriptionModel:
                    items.transcriptionModel || "gpt-4o-transcribe",
            };

            // Save settings, preserving existing values
            chrome.storage.sync.set(defaultSettings, () => {
                console.log("Settings initialized or updated");
            });
        }
    );

    // Create context menu item only once during installation
    chrome.contextMenus.create({
        id: "voiceInput",
        title: chrome.i18n.getMessage("voiceInput"),
        contexts: ["editable"],
    });

    // Migrate old settings to new format if needed
    chrome.storage.sync.get(
        ["apiKey", "apiEndpoint", "useAzure"],
        (oldItems) => {
            if (
                oldItems.apiKey ||
                oldItems.apiEndpoint ||
                oldItems.useAzure !== undefined
            ) {
                const migratedSettings = {
                    apiProvider: oldItems.useAzure ? "azure" : "openai",
                    openaiApiKey: !oldItems.useAzure
                        ? oldItems.apiKey || ""
                        : "",
                    azureApiKey: oldItems.useAzure ? oldItems.apiKey || "" : "",
                    azureEndpoint: oldItems.useAzure
                        ? oldItems.apiEndpoint || ""
                        : "",
                    transcriptionModel: "gpt-4o-transcribe",
                };

                chrome.storage.sync.set(migratedSettings, () => {
                    console.log("Old settings migrated to new format");
                    // Clear old settings
                    chrome.storage.sync.remove([
                        "apiKey",
                        "apiEndpoint",
                        "useAzure",
                    ]);
                });
            }
        }
    );
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
