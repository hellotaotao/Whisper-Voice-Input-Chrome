chrome.runtime.onInstalled.addListener(function () {
    chrome.contextMenus.create({
        id: "voiceInput",
        title: "语音输入",
        contexts: ["editable"],
    });
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === "voiceInput") {
        chrome.tabs.sendMessage(tab.id, { action: "startVoiceInput" });
    }
});

chrome.commands.onCommand.addListener(function (command) {
    if (command === "_execute_action") {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "startVoiceInput",
                });
            }
        );
    } else if (command === "cancel_recording") {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "cancelRecording",
                });
            }
        );
    }
});
