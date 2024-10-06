document.addEventListener("DOMContentLoaded", function () {
    // 加载保存的设置
    chrome.storage.sync.get(["apiKey", "language"], function (items) {
        document.getElementById("apiKey").value = items.apiKey || "";
        document.getElementById("language").value = items.language || "zh";
    });

    // 保存设置
    document.getElementById("save").addEventListener("click", function () {
        var apiKey = document.getElementById("apiKey").value;
        var language = document.getElementById("language").value;

        chrome.storage.sync.set(
            {
                apiKey: apiKey,
                language: language,
            },
            function () {
                alert("设置已保存");
            }
        );
    });
});
