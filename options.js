document.addEventListener('DOMContentLoaded', function() {
    // Load saved settings
    chrome.storage.sync.get({
        'apiProvider': 'openai',
        'openaiApiKey': '',
        'azureApiKey': '',
        'azureEndpoint': ''
    }, function(items) {
        // Set the radio button
        document.querySelector(`input[name="apiProvider"][value="${items.apiProvider}"]`).checked = true;
        
        // Set the saved values
        document.getElementById('openaiApiKey').value = items.openaiApiKey;
        document.getElementById('azureApiKey').value = items.azureApiKey;
        document.getElementById('azureEndpoint').value = items.azureEndpoint;
        
        // Show the correct settings section
        toggleSettings(items.apiProvider);
    });

    // Add change event listener for radio buttons
    document.querySelectorAll('input[name="apiProvider"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            toggleSettings(e.target.value);
        });
    });

    // Save settings
    document.getElementById('save').addEventListener('click', function() {
        const apiProvider = document.querySelector('input[name="apiProvider"]:checked').value;
        const openaiApiKey = document.getElementById('openaiApiKey').value;
        const azureApiKey = document.getElementById('azureApiKey').value;
        const azureEndpoint = document.getElementById('azureEndpoint').value;

        chrome.storage.sync.set({
            apiProvider: apiProvider,
            openaiApiKey: openaiApiKey,
            azureApiKey: azureApiKey,
            azureEndpoint: azureEndpoint
        }, function() {
            const status = document.getElementById('status');
            status.textContent = chrome.i18n.getMessage('settingsSaved');
            status.className = 'success';
            setTimeout(function() {
                status.textContent = '';
                status.className = '';
            }, 3000);
        });
    });
});

function toggleSettings(provider) {
    const openaiSettings = document.getElementById('openaiSettings');
    const azureSettings = document.getElementById('azureSettings');
    
    if (provider === 'azure') {
        openaiSettings.style.display = 'none';
        azureSettings.style.display = 'block';
    } else {
        openaiSettings.style.display = 'block';
        azureSettings.style.display = 'none';
    }
}
