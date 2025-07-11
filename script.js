// Global variables to store detailed breakdown
let hostDetails = [];
let audienceDetails = {};
let totalBreakdown = {};

// Global variables for advanced discount controls
let advancedDiscountsEnabled = false;
let advancedRecordingDiscountsEnabled = false;
let tierDiscounts = {
    audio: 0,
    hd: 0,
    fullhd: 0,
    '2k': 0,
    '2kplus': 0,
    ains: 0,
    bsAudio: 0,
    bsHd: 0,
    bsFullhd: 0,
    bs2k: 0,
    bs2kplus: 0,
    cloudRecording: 0,
    webRecording: 0,
    transcription: 0,
    translation: 0
};

// --- Tiered Discount Structure Logic ---
const DEFAULT_TIERS = [
    { from: 0, to: 20 },
    { from: 20, to: '' }
];
const RESOLUTIONS = [
    { key: 'audio', label: 'Audio Only' },
    { key: 'hd', label: 'HD Video' },
    { key: 'fullhd', label: 'Full HD Video' },
    { key: '2k', label: '2K Video' },
    { key: '2kplus', label: '2K+ Video' }
];

function getSavedTieredDiscounts() {
    try {
        return JSON.parse(localStorage.getItem('tieredDiscounts')) || null;
    } catch (e) { return null; }
}
function saveTieredDiscounts(data) {
    localStorage.setItem('tieredDiscounts', JSON.stringify(data));
}

function getTieredDiscountState() {
    let state = getSavedTieredDiscounts();
    if (!state) {
        // Default: 2 tiers, all discounts 0
        state = {
            sessionsPerMonth: 1,
            tiers: JSON.parse(JSON.stringify(DEFAULT_TIERS)),
            discounts: {}
        };
        RESOLUTIONS.forEach(res => {
            state.discounts[res.key] = [0, 0];
        });
    }
    return state;
}

function renderTieredDiscountUI() {
    const state = getTieredDiscountState();
    // Sessions per month
    document.getElementById('sessions-per-month').value = state.sessionsPerMonth;
    // Tier table
    const tbody = document.getElementById('tier-table-body');
    tbody.innerHTML = '';
    state.tiers.forEach((tier, i) => {
        let showRemove = false;
        if (state.tiers.length > 2) {
            // Only show remove on tiers 3+ (index 2 and above)
            showRemove = (i >= 2);
        }
        const tr = document.createElement('tr');
        tr.innerHTML =
            `<td>${i + 1}</td>` +
            `<td><input type="number" min="0" value="${tier.from}" style="width:90px" disabled /></td>` +
            `<td><input type="number" min="0" value="${tier.to !== '' ? tier.to : ''}" style="width:90px" ${i === state.tiers.length - 1 ? 'disabled placeholder="∞"' : ''} onchange="updateTierTo(${i}, this.value)" /></td>` +
            `<td>${showRemove ? `<button type='button' onclick='removeTier(${i})' style='background:#e53e3e;color:white;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;'>×</button>` : ''}</td>`;
        tbody.appendChild(tr);
    });
    // Resolution discount table
    const thead = document.querySelector('#resolution-discount-table thead tr');
    // Remove old tier headers
    while (thead.children.length > 1) thead.removeChild(thead.lastChild);
    state.tiers.forEach((tier, i) => {
        const th = document.createElement('th');
        th.textContent = `Tier ${i + 1} (%)`;
        thead.appendChild(th);
    });
    // Rows
    RESOLUTIONS.forEach(res => {
        const tr = document.querySelector(`#resolution-discount-table tr[data-res='${res.key}']`);
        if (!tr) return;
        // Remove old inputs
        while (tr.children.length > 1) tr.removeChild(tr.lastChild);
        for (let i = 0; i < state.tiers.length; i++) {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'number';
            input.min = 0;
            input.max = 100;
            input.className = 'text-input';
            input.style.width = '70px';
            input.value = (state.discounts[res.key] && typeof state.discounts[res.key][i] !== 'undefined') ? state.discounts[res.key][i] : 0;
            input.onchange = function() { updateResolutionDiscount(res.key, i, this.value); };
            td.appendChild(input);
            tr.appendChild(td);
        }
    });
}

function updateTierTo(index, value) {
    let state = getTieredDiscountState();
    value = value === '' ? '' : parseInt(value, 10) || 0;
    state.tiers[index].to = value;
    // Next tier's from = this to
    if (state.tiers[index + 1]) {
        state.tiers[index + 1].from = value;
    }
    saveTieredDiscounts(state);
    renderTieredDiscountUI();
}
function removeTier(index) {
    let state = getTieredDiscountState();
    if (state.tiers.length <= 2) return;
    state.tiers.splice(index, 1);
    // Fix from/to
    for (let i = 1; i < state.tiers.length; i++) {
        state.tiers[i].from = state.tiers[i - 1].to;
    }
    // If we just removed the last tier, set the new last tier's 'to' to blank (infinity)
    if (state.tiers.length > 0) {
        state.tiers[state.tiers.length - 1].to = '';
    }
    // Remove discounts for removed tier
    RESOLUTIONS.forEach(res => {
        if (state.discounts[res.key]) state.discounts[res.key].splice(index, 1);
    });
    saveTieredDiscounts(state);
    renderTieredDiscountUI();
}
function updateResolutionDiscount(resKey, tierIdx, value) {
    let state = getTieredDiscountState();
    if (!state.discounts[resKey]) state.discounts[resKey] = [];
    state.discounts[resKey][tierIdx] = parseFloat(value) || 0;
    saveTieredDiscounts(state);
}
document.getElementById('add-tier-btn').onclick = function() {
    let state = getTieredDiscountState();
    const last = state.tiers[state.tiers.length - 1];
    let newFrom;
    // If last.to is a number, increment by 10, else use last.from + 10
    if (last.to !== '' && !isNaN(Number(last.to))) {
        newFrom = Number(last.to) + 10;
        state.tiers[state.tiers.length - 1].to = Number(last.to) + 10;
    } else {
        newFrom = Number(last.from) + 10;
        state.tiers[state.tiers.length - 1].to = newFrom;
    }
    state.tiers.push({ from: newFrom, to: '' });
    // Add default discounts for new tier using master discount
    const masterDiscount = parseFloat(document.getElementById("master-discount")?.value) || 0;
    RESOLUTIONS.forEach(res => {
        if (!state.discounts[res.key]) state.discounts[res.key] = [];
        state.discounts[res.key].push(masterDiscount);
    });
    saveTieredDiscounts(state);
    renderTieredDiscountUI();
};
document.getElementById('sessions-per-month').onchange = function() {
    let state = getTieredDiscountState();
    state.sessionsPerMonth = parseInt(this.value, 10) || 1;
    saveTieredDiscounts(state);
};
// Render on modal open
const origOpenAdvancedDiscounts = window.openAdvancedDiscounts;
window.openAdvancedDiscounts = function() {
    origOpenAdvancedDiscounts();
    renderTieredDiscountUI();
};

function updateHostLabels() {
    const hostEntries = document.querySelectorAll(".host-entry");
    hostEntries.forEach((entry, index) => {
        const label = entry.querySelector("label");
        label.textContent = "Host " + (index + 1);
    });
}

function addHost() {
    const hostEntry = document.createElement("div");
    hostEntry.className = "host-entry";

    const label = document.createElement("label");

    const select = document.createElement("select");
    select.innerHTML = `
      <option value="120p">120p</option>
      <option value="360p">360p</option>
      <option value="480p">480p</option>
      <option value="540p">540p</option>
      <option value="720p">720p</option>
      <option value="1080p">1080p</option>
      <option value="4k">4K</option>
    `;

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-host-btn";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = function () {
        hostEntry.remove();
        updateHostLabels();
    };

    hostEntry.appendChild(label);
    hostEntry.appendChild(select);
    hostEntry.appendChild(removeBtn);

    document
        .getElementById("hosts-container")
        .appendChild(hostEntry);
    updateHostLabels();
}

function toggleParticipantResolution() {
    const screenshareChecked =
        document.getElementById("screenshare").checked;
    document.getElementById(
        "participant-resolution",
    ).style.display = screenshareChecked ? "block" : "none";
}

function toggleWebResolution() {
    const webRecordingChecked =
        document.getElementById("webrecording").checked;
    document.getElementById("web-resolution").style.display =
        webRecordingChecked ? "block" : "none";
}

// --- Utility: Map resolution to pixel count and tier ---
function getResolutionPixels(resolution) {
    switch (resolution) {
        case "120p": return 160 * 120;
        case "360p": return 640 * 360;
        case "480p": return 640 * 480;
        case "540p": return 960 * 540;
        case "720p": return 1280 * 720;
        case "1080p": return 1920 * 1080;
        case "4k": return 3840 * 2160;
        default: return 0;
    }
}
function getTierFromPixels(pixels) {
    if (pixels <= 0) return { tier: "Audio", key: "audio" };
    if (pixels <= 921600) return { tier: "HD Video", key: "hd" };
    if (pixels <= 2073600) return { tier: "Full HD Video", key: "fullhd" };
    if (pixels <= 3686400) return { tier: "2K Video", key: "2k" };
    return { tier: "2K+ Video", key: "2kplus" };
}

function calculatePricing() {
    let audience =
        parseInt(document.getElementById("audience").value) || 0;
    const duration =
        parseInt(document.getElementById("duration").value) || 0;
    const rtcDiscount =
        parseFloat(document.getElementById("rtc-discount").value) || 0;
    const recordingDiscount =
        parseFloat(document.getElementById("recording-discount").value) || 0;
    const ainsEnabled = document.getElementById("ains").checked;
    const screenshareEnabled =
        document.getElementById("screenshare").checked;
    const participantResolution = document.getElementById(
        "participant-resolution",
    ).value;
    const cloudRecordingEnabled =
        document.getElementById("cloudrecording").checked;
    const webRecordingEnabled =
        document.getElementById("webrecording").checked;
    const webResolution =
        document.getElementById("web-resolution").value;
    const bsAudience = document.getElementById("bs-audience").checked;
    const transcriptionEnabled = document.getElementById("transcription").checked;
    const translationEnabled = document.getElementById("translation").checked && transcriptionEnabled;

    // New: Get number of transcription and translation languages
    let transcriptionLanguages = 1;
    let translationLanguages = 1;
    if (transcriptionEnabled) {
        transcriptionLanguages = parseInt(document.getElementById("transcription-languages")?.value) || 1;
    }
    if (translationEnabled) {
        translationLanguages = parseInt(document.getElementById("translation-languages")?.value) || 1;
    }

    const rates = {
        "120p": 0.05,
        "360p": 0.07,
        "480p": 0.08,
        "720p": 0.2,
        "1080p": 0.4,
        "4k": 0.8,
    };

    let aggregatedResolution = 0;
    let audienceAggregatedResolution = 0;

    // Recompute hostDetails and audienceDetails from scratch
    hostDetails = [];
    audienceDetails = {};
    // --- Recompute host details ---
    const hostEntries = document.querySelectorAll(".host-entry");
    hostEntries.forEach((entry, idx) => {
        const select = entry.querySelector("select");
        const resolution = select.value;
        const pixels = getResolutionPixels(resolution);
        aggregatedResolution += pixels;
        audienceAggregatedResolution += pixels;
        // Compute tier for this host
        const tierInfo = getTierFromPixels(pixels);
        hostDetails.push({
            name: `Host ${idx + 1}`,
            resolution,
            aggregatePixels: pixels,
            tierName: tierInfo.tier,
            tierKey: tierInfo.key,
            pricingTier: {
                audio: 0.99, hd: 3.99, fullhd: 8.99, '2k': 15.99, '2kplus': 35.99
            }[tierInfo.key],
            cost: 0, // will be filled below
            subscriptions: [] // will be filled below
        });
    });
    // For audience, use total audienceAggregatedResolution
    const audienceTierInfo = getTierFromPixels(audienceAggregatedResolution);
    audienceDetails = {
        count: parseInt(document.getElementById("audience").value) || 0,
        aggregatePixels: audienceAggregatedResolution,
        tierName: audienceTierInfo.tier,
        tierKey: audienceTierInfo.key,
        pricingTier: {
            audio: 0.99, hd: 3.99, fullhd: 8.99, '2k': 15.99, '2kplus': 35.99
        }[audienceTierInfo.key],
        cost: 0, // will be filled below
        pricingMode: document.getElementById("bs-audience").checked ? "Broadcast Streaming" : "Interactive Live Streaming"
    };

    if (screenshareEnabled) {
        let screensharePixels = 0;
        switch (participantResolution) {
            case "120p":
                screensharePixels = 160 * 120;
                break;
            case "360p":
                screensharePixels = 640 * 360;
                break;
            case "480p":
                screensharePixels = 640 * 480;
                break;
            case "540p":
                screensharePixels = 960 * 540;
                break;
            case "720p":
                screensharePixels = 1280 * 720;
                break;
            case "1080p":
                screensharePixels = 1920 * 1080;
                break;
            case "4k":
                screensharePixels = 3840 * 2160;
                break;
        }
        aggregatedResolution += screensharePixels;
        audienceAggregatedResolution += screensharePixels;
    }

    // For hosts: each host subscribes to (number of hosts - 1) other hosts
    // So we need to calculate the resolution per host subscription
    const hostSubscriptionCount = Math.max(0, hostEntries.length - 1);
    // Each host subscription is the resolution of one other host
    const resolutionPerHost = aggregatedResolution / hostEntries.length;
    const hostAggregatedResolution = resolutionPerHost * hostSubscriptionCount;

    // Broadcast Streaming audience pricing table
    const bsAudiencePricing = {
        audio: 0.59,
        hd: 1.99,
        fullHd: 4.59,
        twoK: 7.99,
        twoKPlus: 17.99
    };

    // Determine pricing tier based on aggregate resolution
    let labelTier = "Audio";
    let pricingTier = 0.99;
    let crPricingTier = 1.49;
    let audiencePricingTier = pricingTier;
    let audiencePricingMode = "Interactive Live Streaming";

    // Determine host pricing tier
    if (hostAggregatedResolution > 3686400) {
        labelTier = "2K+ Video";
        pricingTier = 35.99;
        crPricingTier = 53.99;
    } else if (hostAggregatedResolution > 2073600) {
        labelTier = "2K Video";
        pricingTier = 15.99;
        crPricingTier = 23.99;
    } else if (hostAggregatedResolution > 921600) {
        labelTier = "Full HD Video";
        pricingTier = 8.99;
        crPricingTier = 13.49;
    } else if (hostAggregatedResolution > 0) {
        labelTier = "HD Video";
        pricingTier = 3.99;
        crPricingTier = 5.99;
    }

    // Determine audience pricing tier
    if (audienceAggregatedResolution > 3686400) {
        audiencePricingTier = bsAudience ? bsAudiencePricing.twoKPlus : 35.99;
    } else if (audienceAggregatedResolution > 2073600) {
        audiencePricingTier = bsAudience ? bsAudiencePricing.twoK : 15.99;
    } else if (audienceAggregatedResolution > 921600) {
        audiencePricingTier = bsAudience ? bsAudiencePricing.fullHd : 8.99;
    } else if (audienceAggregatedResolution > 0) {
        audiencePricingTier = bsAudience ? bsAudiencePricing.hd : 3.99;
    } else {
        audiencePricingTier = bsAudience ? bsAudiencePricing.audio : 0.99;
    }
    
    if (bsAudience) audiencePricingMode = "Broadcast Streaming";

    // Audience cost uses selected pricing mode
    const audienceCost =
        ((audience * duration) / 1000) * audiencePricingTier;

    // Store audience details
    const finalAudienceTierInfo = getTierFromPixels(audienceAggregatedResolution);
    audienceDetails = {
        count: audience,
        aggregatePixels: audienceAggregatedResolution,
        tierName: finalAudienceTierInfo.tier,
        tierKey: finalAudienceTierInfo.key,
        pricingTier: audiencePricingTier,
        cost: audienceCost,
        pricingMode: audiencePricingMode
    };

    let totalHostCalculation = 0;

    if (hostEntries.length === 1) {
        totalHostCalculation = (duration / 1000) * 0.99;
        hostDetails = [{
            name: "Host 1",
            resolution: hostEntries[0].querySelector("select").value,
            aggregatePixels: 0,
            pricingTier: 0.99,
            cost: (duration / 1000) * 0.99
        }];
    } else if (hostEntries.length > 1) {
        // Calculate each host's cost separately based on what they subscribe to
        hostDetails = [];
        hostEntries.forEach((entry, hostIndex) => {
            const select = entry.querySelector("select");
            const hostResolution = select.value;
            let hostResolutionPixels = 0;
            
            // Get the resolution pixels for this host
            switch (hostResolution) {
                case "120p":
                    hostResolutionPixels = 160 * 120;
                    break;
                case "360p":
                    hostResolutionPixels = 640 * 360;
                    break;
                case "480p":
                    hostResolutionPixels = 640 * 480;
                    break;
                case "540p":
                    hostResolutionPixels = 960 * 540;
                    break;
                case "720p":
                    hostResolutionPixels = 1280 * 720;
                    break;
                case "1080p":
                    hostResolutionPixels = 1920 * 1080;
                    break;
                case "4k":
                    hostResolutionPixels = 3840 * 2160;
                    break;
            }
            
            // Calculate what this host subscribes to (all other hosts)
            let hostAggregatedPixels = 0;
            let subscriptions = [];
            hostEntries.forEach((otherEntry, otherIndex) => {
                if (otherIndex !== hostIndex) {
                    const otherSelect = otherEntry.querySelector("select");
                    const otherResolution = otherSelect.value;
                    let otherResolutionPixels = 0;
                    
                    switch (otherResolution) {
                        case "120p":
                            otherResolutionPixels = 160 * 120;
                            break;
                        case "360p":
                            otherResolutionPixels = 640 * 360;
                            break;
                        case "480p":
                            otherResolutionPixels = 640 * 480;
                            break;
                        case "540p":
                            otherResolutionPixels = 960 * 540;
                            break;
                        case "720p":
                            otherResolutionPixels = 1280 * 720;
                            break;
                        case "1080p":
                            otherResolutionPixels = 1920 * 1080;
                            break;
                        case "4k":
                            otherResolutionPixels = 3840 * 2160;
                            break;
                    }
                    hostAggregatedPixels += otherResolutionPixels;
                    subscriptions.push(`Host ${otherIndex + 1} (${otherResolution})`);
                }
            });
            
            // Add screenshare if enabled, but NOT for the first host (the sharer)
            if (screenshareEnabled && hostIndex !== 0) {
                let screensharePixels = 0;
                switch (participantResolution) {
                    case "120p":
                        screensharePixels = 160 * 120;
                        break;
                    case "360p":
                        screensharePixels = 640 * 360;
                        break;
                    case "480p":
                        screensharePixels = 640 * 480;
                        break;
                    case "540p":
                        screensharePixels = 960 * 540;
                        break;
                    case "720p":
                        screensharePixels = 1280 * 720;
                        break;
                    case "1080p":
                        screensharePixels = 1920 * 1080;
                        break;
                    case "4k":
                        screensharePixels = 3840 * 2160;
                        break;
                }
                hostAggregatedPixels += screensharePixels;
                subscriptions.push(`Screenshare (${participantResolution})`);
            }
            
            // Determine pricing tier for this host
            const hostTierInfo = getTierFromPixels(hostAggregatedPixels);
            let hostPricingTier = { audio: 0.99, hd: 3.99, fullhd: 8.99, '2k': 15.99, '2kplus': 35.99 }[hostTierInfo.key];
            let tierName = hostTierInfo.tier;
            
            const hostCost = (duration / 1000) * hostPricingTier;
            totalHostCalculation += hostCost;
            
            // Store host details
            hostDetails.push({
                name: `Host ${hostIndex + 1}`,
                resolution: hostResolution,
                aggregatePixels: hostAggregatedPixels,
                tierName: tierName,
                pricingTier: hostPricingTier,
                cost: hostCost,
                subscriptions: subscriptions
            });
        });
    }

    // Calculate audience aggregate (all hosts + screenshare if enabled)
    // REMOVE the second hostEntries loop and screenshare addition for audienceAggregatedResolution
    // Only count each host and screenshare once (already done above)

    const totalCost = totalHostCalculation + audienceCost;
    
    // Cloud recording cost based on aggregate resolution of all participants
    let cloudRecordingCost = 0;
    if (cloudRecordingEnabled) {
        // Use only audienceAggregatedResolution for cloud recording
        const totalAggregateResolution = audienceAggregatedResolution;
        console.log('DEBUG: Cloud Recording aggregate for tier check:', totalAggregateResolution);
        let crPricingTier = 0;
        
        if (totalAggregateResolution > 3686400) {
            crPricingTier = 53.99; // 2K+
        } else if (totalAggregateResolution > 2073600) {
            crPricingTier = 23.99; // 2K
        } else if (totalAggregateResolution > 921600) {
            crPricingTier = 13.49; // Full HD
        } else if (totalAggregateResolution > 0) {
            crPricingTier = 5.99; // HD
        } else {
            crPricingTier = 0; // Audio only
        }
        
        cloudRecordingCost = (duration / 1000) * crPricingTier;
    }

    // Web Recording cost based on resolution
    let webRecordingCost = 0;
    let webRecordingTierName = '';
    if (webRecordingEnabled) {
        if (webResolution === "720p") {
            webRecordingCost = (duration / 1000) * 14;
            webRecordingTierName = 'HD Video';
        } else if (webResolution === "1080p") {
            webRecordingCost = (duration / 1000) * 28;
            webRecordingTierName = 'Full HD Video';
        } else {
            // fallback, treat as HD
            webRecordingCost = (duration / 1000) * 14;
            webRecordingTierName = 'HD Video';
        }
    }

    const ainsCost = ainsEnabled
        ? (0.59 * (hostEntries.length * duration)) / 1000
        : 0;

    // Calculate transcription and translation costs
    let transcriptionCost = 0;
    let translationCost = 0;
    let lidCost = 0;
    if (transcriptionEnabled) {
        transcriptionCost = (16.99 * hostEntries.length * duration) / 1000;
        // LID fee if 2+ languages
        if (transcriptionLanguages >= 2) {
            lidCost = (5.00 * hostEntries.length * duration) / 1000;
        }
    }
    if (translationEnabled) {
        translationCost = (8.99 * hostEntries.length * duration * translationLanguages) / 1000;
    }
    // Apply discounts
    let transcriptionDiscount = 0;
    let translationDiscount = 0;
    if (advancedDiscountsEnabled) {
        transcriptionDiscount = tierDiscounts.transcription || 0;
        translationDiscount = tierDiscounts.translation || 0;
    } else {
        transcriptionDiscount = parseFloat(document.getElementById("transcription-discount")?.value) || 0;
        translationDiscount = parseFloat(document.getElementById("translation-discount")?.value) || 0;
    }
    let discountedTranscriptionCost = transcriptionCost * (1 - transcriptionDiscount / 100);
    let discountedTranslationCost = translationCost * (1 - translationDiscount / 100);
    // LID cost is not discounted

    // Calculate discounted totals for hosts (including screenshare audio)
    let discountedHostTotal = 0;
    hostDetails.forEach(host => {
        let discountedHostCost;
        if (shouldUseTieredDiscounts(false)) {
            // Use advanced tiered discount structure
            const state = getTieredDiscountState();
            const sessionsPerMonth = state.sessionsPerMonth || 1;
            const tiers = state.tiers;
            
            // Map tier name to resolution key
            const tierToResKey = {
                'audio': 'audio',
                'hdvideo': 'hd', 
                'fullhdvideo': 'fullhd',
                '2kvideo': '2k',
                '2kplusvideo': '2kplus'
            };
            const currentTierKey = (host.tierName || 'Audio').toLowerCase().replace(/[^a-z0-9+]/g, "");
            const resKey = tierToResKey[currentTierKey] || 'audio';
            const tierDiscounts = state.discounts[resKey] || [];
            
            // Calculate total minutes for this host for the month
            const totalMinutes = duration * sessionsPerMonth;
            
            // Calculate tiered breakdown
            const breakdown = calculateTieredRTCDiscountBreakdown(totalMinutes, sessionsPerMonth, tiers, tierDiscounts);
            
            // Calculate total cost across all tiers
            const baseRates = { audio: 0.99, hd: 3.99, fullhd: 8.99, '2k': 15.99, '2kplus': 35.99 };
            const baseRate = baseRates[resKey] || 0.99;
            
            discountedHostCost = 0;
            breakdown.forEach(row => {
                const tierCost = (row.minutes / 1000) * baseRate * (1 - row.discount / 100);
                discountedHostCost += tierCost;
            });
        } else {
            // Use simple discount
            const tierDiscount = getDiscountForTier(host.tierName || 'Audio');
            discountedHostCost = host.cost * (1 - tierDiscount / 100);
        }
        
        discountedHostTotal += discountedHostCost;
        host.discountedCost = discountedHostCost;
        host.discountApplied = shouldUseTieredDiscounts(false) ? 
            (host.cost > 0 ? ((host.cost - discountedHostCost) / host.cost) * 100 : 0) : 
            getDiscountForTier(host.tierName || 'Audio');
    });
    
    // Add discounted screenshare audio if enabled
    let discountedScreenshareAudio = 0;
    if (screenshareEnabled) {
        if (shouldUseTieredDiscounts(false)) {
            // Use advanced tiered discount structure for screenshare audio
            const state = getTieredDiscountState();
            const sessionsPerMonth = state.sessionsPerMonth || 1;
            const tiers = state.tiers;
            const tierDiscounts = state.discounts.audio || [];
            
            // Calculate total minutes for screenshare audio for the month
            const totalMinutes = duration * sessionsPerMonth;
            
            // Calculate tiered breakdown
            const breakdown = calculateTieredRTCDiscountBreakdown(totalMinutes, sessionsPerMonth, tiers, tierDiscounts);
            
            // Calculate total cost across all tiers
            const baseRate = 0.99; // Audio rate
            discountedScreenshareAudio = 0;
            breakdown.forEach(row => {
                const tierCost = (row.minutes / 1000) * baseRate * (1 - row.discount / 100);
                discountedScreenshareAudio += tierCost;
            });
        } else {
            // Use simple discount
            const screenshareDiscount = getDiscountForTier('Audio');
            discountedScreenshareAudio = ((duration / 1000) * 0.99) * (1 - screenshareDiscount / 100);
        }
        discountedHostTotal += discountedScreenshareAudio;
    }

    // Apply advanced tiered discount to audience
    let discountedAudienceCost;
    if (shouldUseTieredDiscounts(bsAudience)) {
        let useBS = bsAudience;
        let state, sessionsPerMonth, tiers, discounts, baseRates;
        if (useBS) {
            state = getBSTieredDiscountState();
            sessionsPerMonth = state.sessionsPerMonth || 1;
            tiers = state.tiers;
            discounts = state.discounts;
            baseRates = { audio: 0.59, hd: 1.99, fullhd: 4.59, '2k': 7.99, '2kplus': 17.99 };
        } else {
            state = getTieredDiscountState();
            sessionsPerMonth = state.sessionsPerMonth || 1;
            tiers = state.tiers;
            discounts = state.discounts;
            baseRates = { audio: 0.99, hd: 3.99, fullhd: 8.99, '2k': 15.99, '2kplus': 35.99 };
        }
        // Map tier name to resolution key
        const tierToResKey = {
            'audio': 'audio',
            'hdvideo': 'hd', 
            'fullhdvideo': 'fullhd',
            '2kvideo': '2k',
            '2kplusvideo': '2kplus'
        };
        const currentTierKey = (audienceDetails.tierName || 'Audio').toLowerCase().replace(/[^a-z0-9+]/g, "");
        const resKey = tierToResKey[currentTierKey] || 'audio';
        const tierDiscounts = discounts[resKey] || [];
        // Calculate total minutes for audience for the month
        const totalMinutes = audience * duration * sessionsPerMonth;
        // Calculate tiered breakdown
        const breakdown = calculateTieredRTCDiscountBreakdown(totalMinutes, sessionsPerMonth, tiers, tierDiscounts);
        // Calculate total cost across all tiers
        const baseRate = baseRates[resKey] || 0.99;
        discountedAudienceCost = 0;
        breakdown.forEach(row => {
            const tierCost = (row.minutes / 1000) * baseRate * (1 - row.discount / 100);
            discountedAudienceCost += tierCost;
        });
    } else {
        // Use simple discount
        const audienceTierDiscount = getDiscountForTier(audienceDetails.tierName || 'Audio', bsAudience);
        discountedAudienceCost = audienceCost * (1 - audienceTierDiscount / 100);
    }
    audienceDetails.discountedCost = discountedAudienceCost;
    audienceDetails.discountApplied = shouldUseTieredDiscounts(bsAudience) ? 
        (audienceCost > 0 ? ((audienceCost - discountedAudienceCost) / audienceCost) * 100 : 0) : 
        getDiscountForTier(audienceDetails.tierName || 'Audio', bsAudience);

    // Apply AINS discount
    let discountedAinsCost = 0;
    if (ainsEnabled) {
        const ainsTierDiscount = advancedDiscountsEnabled ? tierDiscounts.ains : rtcDiscount;
        discountedAinsCost = ainsCost * (1 - ainsTierDiscount / 100);
    }

    // Apply recording discount
    let discountedCloudRecordingCost = cloudRecordingCost;
    let discountedWebRecordingCost = webRecordingCost;
    const cloudRecordingDiscount = getRecordingDiscount('cloud', audienceDetails.tierName);
    const webRecordingDiscount = getRecordingDiscount('web', webRecordingTierName);
    if (cloudRecordingDiscount >= 0 && cloudRecordingDiscount <= 100) {
        discountedCloudRecordingCost = cloudRecordingCost * (1 - cloudRecordingDiscount / 100);
    }
    if (webRecordingDiscount >= 0 && webRecordingDiscount <= 100) {
        discountedWebRecordingCost = webRecordingCost * (1 - webRecordingDiscount / 100);
    }

    // Calculate finalCost to match summary logic
    let finalCost = discountedHostTotal
        + discountedAudienceCost
        + discountedCloudRecordingCost
        + discountedWebRecordingCost
        + discountedAinsCost
        + discountedTranscriptionCost
        + lidCost
        + discountedTranslationCost;
    finalCost = ceil2(finalCost);

    // Logging costs and stuff
    console.log("Host Aggregate Resolution: " + hostAggregatedResolution);
    console.log("Audience Aggregate Resolution: " + audienceAggregatedResolution);
    console.log("Host Pricing Tier: " + pricingTier);
    console.log("Audience Pricing Tier: " + audiencePricingTier);
    console.log("Final Cost: " + finalCost);
    console.log("Total Host Calculation: " + totalHostCalculation);
    console.log("Total Cost: " + totalCost);
    console.log("Discounted Total Cost: " + discountedHostTotal);
    console.log(
        "Audience Cost: " +
            audienceCost +
            " Cloud Recording Cost: " +
            cloudRecordingCost +
            " Webpage Recording Cost " +
            webRecordingCost +
            " AINS Cost " +
            ainsCost,
    );
    console.log("RTC/AINS Discount: " + rtcDiscount + "%");
    console.log("Recording Discount: " + recordingDiscount + "%");

    // In calculatePricing, set resultHTML and totalBreakdown.finalCost to the single-session total
    let singleSessionTotal = 0;
    // --- FIX: Always use sessionsPerMonth = 1 for single-session summary ---
    // Hosts
    for (let host of hostDetails) {
        let minutes = duration;
        let aggTierInfo = getTierFromPixels(host.aggregatePixels);
        let baseRates = { audio: 0.99, hd: 3.99, fullhd: 8.99, '2k': 15.99, '2kplus': 35.99 };
        let baseRate = baseRates[aggTierInfo.key] || 0.99;
        let discount = 0;
        if (shouldUseTieredDiscounts(false)) {
            let advDiscounts = getTieredDiscountState().discounts[aggTierInfo.key] || [];
            discount = advDiscounts[0] || 0;
        } else {
            discount = getDiscountForTier(host.tierName) || 0;
        }
        let singleSessionHostCost = (minutes / 1000) * baseRate * (1 - discount / 100);
        singleSessionTotal += singleSessionHostCost;
        host.singleSessionCost = (minutes / 1000) * baseRate;
        host.singleSessionDiscountedCost = singleSessionHostCost;
    }
    // Audience
    let ssAudBaseRates = { audio: 0.99, hd: 3.99, fullhd: 8.99, '2k': 15.99, '2kplus': 35.99 };
    if (document.getElementById("bs-audience").checked) ssAudBaseRates = { audio: 0.59, hd: 1.99, fullhd: 4.59, '2k': 7.99, '2kplus': 17.99 };
    let ssAudBaseRate = ssAudBaseRates[audienceDetails.tierKey] || 0.99;
    let ssAudDiscount = 0;
    if (shouldUseTieredDiscounts(document.getElementById("bs-audience").checked)) {
        let advDiscounts = document.getElementById("bs-audience").checked ? (getBSTieredDiscountState().discounts[audienceDetails.tierKey] || []) : (getTieredDiscountState().discounts[audienceDetails.tierKey] || []);
        ssAudDiscount = advDiscounts[0] || 0;
    } else {
        ssAudDiscount = getDiscountForTier(audienceDetails.tierName, document.getElementById("bs-audience").checked) || 0;
    }
    let ssAudMinutes = audienceDetails.count * duration;
    let ssSingleSessionAudienceCost = (ssAudMinutes / 1000) * ssAudBaseRate * (1 - ssAudDiscount / 100);
    singleSessionTotal += ssSingleSessionAudienceCost;
    audienceDetails.singleSessionCost = (ssAudMinutes / 1000) * ssAudBaseRate;
    audienceDetails.singleSessionDiscountedCost = ssSingleSessionAudienceCost;
    // Screenshare audio
    if (screenshareEnabled) {
        let screenshareDiscount = 0;
        if (shouldUseTieredDiscounts(false)) {
            let advDiscounts = getTieredDiscountState().discounts['audio'] || [];
            screenshareDiscount = advDiscounts[0] || 0;
        } else {
            screenshareDiscount = getDiscountForTier('Audio') || 0;
        }
        let screenshareCost = (duration / 1000) * 0.99 * (1 - screenshareDiscount / 100);
        singleSessionTotal += screenshareCost;
    }
    // Transcription/translation
    if (transcriptionEnabled) {
        let transcriptionDiscount = advancedDiscountsEnabled ? (tierDiscounts.transcription || 0) : (parseFloat(document.getElementById("transcription-discount")?.value) || 0);
        let transcriptionCost = (16.99 * hostDetails.length * duration) / 1000;
        let discountedTranscriptionCost = transcriptionCost * (1 - transcriptionDiscount / 100);
        singleSessionTotal += discountedTranscriptionCost;
        if (transcriptionLanguages >= 2) {
            let lidCost = (5.00 * hostDetails.length * duration) / 1000;
            singleSessionTotal += lidCost;
        }
    }
    if (translationEnabled) {
        let translationDiscount = advancedDiscountsEnabled ? (tierDiscounts.translation || 0) : (parseFloat(document.getElementById("translation-discount")?.value) || 0);
        let translationCost = (8.99 * hostDetails.length * duration * translationLanguages) / 1000;
        let discountedTranslationCost = translationCost * (1 - translationDiscount / 100);
        singleSessionTotal += discountedTranslationCost;
    }
    // Cloud recording
    if (cloudRecordingEnabled) {
        let crPricingTier = 0;
        if (audienceAggregatedResolution > 3686400) {
            crPricingTier = 53.99;
        } else if (audienceAggregatedResolution > 2073600) {
            crPricingTier = 23.99;
        } else if (audienceAggregatedResolution > 921600) {
            crPricingTier = 13.49;
        } else if (audienceAggregatedResolution > 0) {
            crPricingTier = 5.99;
        }
        let cloudRecordingCost = (duration / 1000) * crPricingTier;
        let cloudRecordingDiscount = getRecordingDiscount('cloud', audienceDetails.tierName);
        let discountedCloudRecordingCost = cloudRecordingCost * (1 - cloudRecordingDiscount / 100);
        singleSessionTotal += discountedCloudRecordingCost;
    }
    // Web recording
    if (webRecordingEnabled) {
        let webRecordingCost = 0;
        if (webResolution === "720p") {
            webRecordingCost = (duration / 1000) * 14;
        } else if (webResolution === "1080p") {
            webRecordingCost = (duration / 1000) * 28;
        } else {
            webRecordingCost = (duration / 1000) * 14;
        }
        let webRecordingDiscount = getRecordingDiscount('web', webResolution === "1080p" ? 'Full HD Video' : 'HD Video');
        let discountedWebRecordingCost = webRecordingCost * (1 - webRecordingDiscount / 100);
        singleSessionTotal += discountedWebRecordingCost;
    }
    // AINS
    if (ainsEnabled) {
        let ainsCost = (0.59 * (hostEntries.length * duration)) / 1000;
        let ainsTierDiscount = advancedDiscountsEnabled ? (tierDiscounts.ains || 0) : rtcDiscount;
        let discountedAinsCost = ainsCost * (1 - ainsTierDiscount / 100);
        singleSessionTotal += discountedAinsCost;
    }
    singleSessionTotal = Math.max(0, singleSessionTotal); // Prevent negative/NaN
    singleSessionTotal = ceil2(singleSessionTotal);
    resultHTML = `<p>Aggregate Resolution Tier: ${audienceDetails.tierName}</p>`;
    resultHTML += `<p>Audience Pricing Mode: ${audiencePricingMode}</p>`;
    resultHTML += `<p>Estimated Cost: $${singleSessionTotal.toFixed(2)}</p>`;
    totalBreakdown.finalCost = singleSessionTotal;
    document.getElementById("result").innerHTML = resultHTML;

    // Store total breakdown
    console.log('DEBUG: Storing totalAggregateResolution in totalBreakdown:', audienceAggregatedResolution);
    totalBreakdown = {
        totalHostCost: totalHostCalculation,
        totalAudienceCost: audienceCost,
        cloudRecordingCost: cloudRecordingCost,
        webRecordingCost: webRecordingCost,
        ainsCost: ainsCost,
        transcriptionCost: transcriptionCost,
        translationCost: translationCost,
        discountedTranscriptionCost: discountedTranscriptionCost,
        discountedTranslationCost: discountedTranslationCost,
        lidCost: lidCost,
        transcriptionLanguages: transcriptionLanguages,
        translationLanguages: translationLanguages,
        totalCost: totalCost,
        finalCost: singleSessionTotal, // FIX: always use single-session value
        duration: duration,
        rtcDiscount: rtcDiscount,
        recordingDiscount: recordingDiscount,
        transcriptionDiscount: transcriptionDiscount,
        translationDiscount: translationDiscount,
        screenshareEnabled: screenshareEnabled,
        screenshareResolution: participantResolution,
        totalAggregateResolution: audienceAggregatedResolution, // FIXED: only audience, not host+audience
        webRecordingTierName: webRecordingTierName
    };

    // In calculatePricing, after hostDetails and audienceDetails are created:
    // (Removed redeclaration of single-session audience variables here; already set above)
}

function showDetails() {
    if (hostDetails.length === 0 && !audienceDetails.count) {
        alert("Please calculate pricing first to see details.");
        return;
    }
    // Fix: get bsAudience state from checkbox
    var bsAudience = false;
    var bsCheckbox = document.getElementById('bs-audience');
    if (bsCheckbox) bsAudience = bsCheckbox.checked;

    let content = '<div class="detail-section">';
    content += '<h4>Host Breakdown</h4>';
    
    hostDetails.forEach((host, index) => {
        const originalCost = host.singleSessionCost;
        const discountedCost = host.singleSessionDiscountedCost;
        const discountApplied = originalCost > 0 ? ((originalCost - discountedCost) / originalCost) * 100 : 0;
        
        content += `<div class="detail-item">
            <span class="detail-label">${host.name} (${host.resolution})</span>
            <span class="detail-value">$${discountedCost.toFixed(2)}</span>
        </div>`;
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
            <span class="detail-label">Aggregate: ${host.aggregatePixels.toLocaleString()} px (${host.tierName})</span>
            <span class="detail-value">$${host.pricingTier}/1,000 min</span>
        </div>`;
        if (discountApplied > 0.01) {
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
                <span class="detail-label">Pre-Discount</span><span class="detail-value">$${originalCost.toFixed(2)}</span>
            </div>`;
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
                <span class="detail-label">Discount</span><span class="detail-value">-$${(originalCost - discountedCost).toFixed(2)} (${discountApplied.toFixed(2)}%)</span>
            </div>`;
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #333;">
                <span class="detail-label">Final</span><span class="detail-value">$${discountedCost.toFixed(2)}</span>
            </div>`;
        }
        if (host.subscriptions && host.subscriptions.length > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
                <span class="detail-label">Subscribes to: ${host.subscriptions.join(', ')}</span>
                <span class="detail-value"></span>
            </div>`;
        }
    });
    
    content += `<div class="detail-item">
        <span class="detail-label">Total Host Cost</span>
        <span class="detail-value">$${totalBreakdown.totalHostCost.toFixed(2)}</span>
    </div>`;
    
    // Add screenshare audio cost if enabled
    if (totalBreakdown.screenshareEnabled) {
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
            <span class="detail-label">Screenshare Audio Cost: $0.99/1,000 min</span>
            <span class="detail-value">$${(totalBreakdown.duration / 1000 * 0.99).toFixed(2)}</span>
        </div>`;
    }
    content += '</div>';

    content += '<div class="detail-section">';
    content += '<h4>Audience Breakdown</h4>';
    // Use single-session values for breakdown
    const originalAudienceCost = audienceDetails.singleSessionCost;
    const discountedAudienceCost = audienceDetails.singleSessionDiscountedCost || originalAudienceCost;
    const audienceDiscountApplied = originalAudienceCost > 0 ? ((originalAudienceCost - discountedAudienceCost) / originalAudienceCost) * 100 : 0;
    
    content += `<div class="detail-item">
        <span class="detail-label">Audience Members (${audienceDetails.count})</span>
        <span class="detail-value">$${discountedAudienceCost.toFixed(2)}</span>
    </div>`;
    if (audienceDiscountApplied > 0.01) {
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
            <span class="detail-label">Pre-Discount</span><span class="detail-value">$${originalAudienceCost.toFixed(2)}</span>
        </div>`;
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
            <span class="detail-label">Discount</span><span class="detail-value">-$${(originalAudienceCost - discountedAudienceCost).toFixed(2)} (${audienceDiscountApplied.toFixed(2)}%)</span>
        </div>`;
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #333;">
            <span class="detail-label">Final</span><span class="detail-value">$${discountedAudienceCost.toFixed(2)}</span>
        </div>`;
    }
    // Aggregate and tier info in a single row
    content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
        <span class="detail-label">Aggregate: ${audienceDetails.aggregatePixels.toLocaleString()} px (${audienceDetails.tierName})</span>
        <span class="detail-value">$${audienceDetails.pricingTier}/1,000 min (${audienceDetails.pricingMode})</span>
    </div>`;
    // Add screenshare information if enabled
    if (totalBreakdown.screenshareEnabled) {
        content += `<div class="detail-item" style="padding-left: 0; font-size: 13px; color: #666; background: #f8f9fa; border-radius: 6px; margin-top: 6px;">
            <span class="detail-label">Includes Screenshare: ${totalBreakdown.screenshareResolution}</span>
            <span class="detail-value"></span>
        </div>`;
    }
    content += '</div>';

    // Add additional services section
    content += '<div class="detail-section">';
    content += '<h4>Additional Services</h4>';
    
    if (totalBreakdown.cloudRecordingCost > 0) {
        const originalCloudCost = totalBreakdown.cloudRecordingCost;
        const cloudDiscount = getRecordingDiscount('cloud', audienceDetails.tierName);
        const discountedCloudCost = originalCloudCost * (1 - cloudDiscount / 100);
        
        content += `<div class="detail-item">
            <span class="detail-label">Cloud Recording</span>
            <span class="detail-value">$${discountedCloudCost.toFixed(2)}</span>
        </div>`;
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
            <span class="detail-label">Aggregate Resolution: ${totalBreakdown.totalAggregateResolution.toLocaleString()} px</span>
            <span class="detail-value"></span>
        </div>`;
        if (cloudDiscount > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
                <span class="detail-label">Discount Applied: ${cloudDiscount}%</span>
                <span class="detail-value">-$${(originalCloudCost - discountedCloudCost).toFixed(2)}</span>
            </div>`;
        }
    }
    
    if (totalBreakdown.webRecordingCost > 0) {
        const originalWebCost = totalBreakdown.webRecordingCost;
        const webDiscount = getRecordingDiscount('web', totalBreakdown.webRecordingTierName);
        const discountedWebCost = originalWebCost * (1 - webDiscount / 100);
        
        content += `<div class="detail-item">
            <span class="detail-label">Web Page Recording</span>
            <span class="detail-value">$${discountedWebCost.toFixed(2)}</span>
        </div>`;
        if (webDiscount > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
                <span class="detail-label">Discount Applied: ${webDiscount}%</span>
                <span class="detail-value">-$${(originalWebCost - discountedWebCost).toFixed(2)}</span>
            </div>`;
        }
    }
    
    if (totalBreakdown.ainsCost > 0) {
        const originalAinsCost = totalBreakdown.ainsCost;
        const discountedAinsCost = advancedDiscountsEnabled ? 
            (originalAinsCost * (1 - tierDiscounts.ains / 100)) : 
            (originalAinsCost * (1 - totalBreakdown.rtcDiscount / 100));
        const ainsDiscountApplied = advancedDiscountsEnabled ? tierDiscounts.ains : totalBreakdown.rtcDiscount;
        
        content += `<div class="detail-item">
            <span class="detail-label">AINS (AI Noise Suppression)</span>
            <span class="detail-value">$${discountedAinsCost.toFixed(2)}</span>
        </div>`;
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666; background: none; font-weight: normal;">
            <span class="detail-label">Applied to: ${hostDetails.length} hosts</span>
            <span style="margin-left: 12px; background: #f3f4f6; color: #555; font-size: 12px; font-weight: 500; border-radius: 12px; padding: 2px 10px; border-left: 3px solid #667eea;">$0.59/1,000 min per host</span>
        </div>`;
        if (ainsDiscountApplied > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
                <span class="detail-label">Discount Applied: ${ainsDiscountApplied}%</span>
                <span class="detail-value">-$${(originalAinsCost - discountedAinsCost).toFixed(2)}</span>
            </div>`;
        }
    }
    
    if (totalBreakdown.discountedTranscriptionCost > 0) {
        content += `<div class="detail-item">
            <span class="detail-label">Real-Time Speech-To-Text (Transcription)</span>
            <span class="detail-value">$${totalBreakdown.discountedTranscriptionCost.toFixed(2)}</span>
        </div>`;
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666; background: none; font-weight: normal;">
            <span class="detail-label">Applied to: ${hostDetails.length} hosts, ${totalBreakdown.transcriptionLanguages} language${totalBreakdown.transcriptionLanguages > 1 ? 's' : ''}</span>
            <span style="margin-left: 12px; background: #f3f4f6; color: #555; font-size: 12px; font-weight: 500; border-radius: 12px; padding: 2px 10px; border-left: 3px solid #667eea;">$16.99/1,000 min per host</span>
        </div>`;
        if (totalBreakdown.transcriptionLanguages >= 2 && totalBreakdown.lidCost > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #b83232; background: none; font-weight: normal;">
                <span class="detail-label">LID Fee (Language Identification, 2+ languages):</span>
                <span class="detail-value">$${totalBreakdown.lidCost.toFixed(2)}</span>
            </div>`;
            content += `<div class="detail-item" style="padding-left: 40px; font-size: 12px; color: #666; background: none; font-weight: normal;">
                <span class="detail-label">$5.00/1,000 min per host (not discounted)</span>
            </div>`;
        }
        if (totalBreakdown.transcriptionDiscount > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
                <span class="detail-label">Discount Applied: ${totalBreakdown.transcriptionDiscount}%</span>
                <span class="detail-value">-$${(totalBreakdown.transcriptionCost - totalBreakdown.discountedTranscriptionCost).toFixed(2)}</span>
            </div>`;
        }
    }
    if (totalBreakdown.discountedTranslationCost > 0) {
        content += `<div class="detail-item">
            <span class="detail-label">Translation</span>
            <span class="detail-value">$${totalBreakdown.discountedTranslationCost.toFixed(2)}</span>
        </div>`;
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666; background: none; font-weight: normal;">
            <span class="detail-label">Applied to: ${hostDetails.length} hosts, ${totalBreakdown.translationLanguages} translation language${totalBreakdown.translationLanguages > 1 ? 's' : ''}</span>
            <span style="margin-left: 12px; background: #f3f4f6; color: #555; font-size: 12px; font-weight: 500; border-radius: 12px; padding: 2px 10px; border-left: 3px solid #667eea;">$8.99/1,000 min per host per translation language</span>
        </div>`;
        if (totalBreakdown.translationDiscount > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
                <span class="detail-label">Discount Applied: ${totalBreakdown.translationDiscount}%</span>
                <span class="detail-value">-$${(totalBreakdown.translationCost - totalBreakdown.discountedTranslationCost).toFixed(2)}</span>
            </div>`;
        }
    }
    
    if (
        totalBreakdown.cloudRecordingCost === 0 &&
        totalBreakdown.webRecordingCost === 0 &&
        totalBreakdown.ainsCost === 0 &&
        totalBreakdown.discountedTranscriptionCost === 0 &&
        totalBreakdown.discountedTranslationCost === 0
    ) {
        content += `<div class="detail-item">
            <span class="detail-label">No additional services enabled</span>
            <span class="detail-value">$0.00</span>
        </div>`;
    }
    content += '</div>';

    content += '<div class="detail-section">';
    content += '<h4>Total Summary</h4>';
    
    // Helper for rounding down to nearest cent
    function floor2(val) { return Math.floor(val * 100) / 100; }

    // Screenshare audio
    let screenshareAudioCost = 0;
    let screenshareAudioDiscounted = 0;
    let screenshareAudioDiscount = 0;
    if (totalBreakdown.screenshareEnabled) {
        screenshareAudioCost = floor2((totalBreakdown.duration / 1000) * 0.99);
        const screenshareDiscount = getDiscountForTier('Audio');
        screenshareAudioDiscounted = floor2(screenshareAudioCost * (1 - screenshareDiscount / 100));
        screenshareAudioDiscount = floor2(screenshareAudioCost - screenshareAudioDiscounted);
    }

    // Calculate discounted totals
    let summaryDiscountedHostCost = 0;
    let summaryOriginalHostCost = 0;
    for (const host of hostDetails) {
        summaryOriginalHostCost += host.singleSessionCost || 0;
        summaryDiscountedHostCost += host.singleSessionDiscountedCost || host.singleSessionCost || 0;
    }
    // Add screenshare audio (undiscounted and discounted) if enabled
    if (totalBreakdown.screenshareEnabled) {
        summaryOriginalHostCost += screenshareAudioCost;
        summaryDiscountedHostCost += screenshareAudioDiscounted;
    }
    summaryOriginalHostCost = floor2(summaryOriginalHostCost);
    summaryDiscountedHostCost = floor2(summaryDiscountedHostCost);
    const summaryDiscountedAudienceCost = floor2(audienceDetails.singleSessionDiscountedCost || audienceDetails.singleSessionCost);
    const summaryOriginalAudienceCost = floor2(audienceDetails.singleSessionCost);
    const summaryOriginalCloudCost = floor2(totalBreakdown.cloudRecordingCost || 0);
    const summaryDiscountedCloudCost = (totalBreakdown.cloudRecordingCost > 0) ? (function() { const d = getRecordingDiscount('cloud', audienceDetails.tierName || 'Audio'); return floor2(summaryOriginalCloudCost * (1 - d / 100)); })() : 0;
    const summaryOriginalWebCost = floor2(totalBreakdown.webRecordingCost || 0);
    const summaryDiscountedWebCost = (totalBreakdown.webRecordingCost > 0) ? (function() { const d = getRecordingDiscount('web', totalBreakdown.webRecordingTierName || 'Audio'); return floor2(summaryOriginalWebCost * (1 - d / 100)); })() : 0;
    const summaryOriginalAinsCost = floor2(totalBreakdown.ainsCost || 0);
    const summaryDiscountedAinsCost = (totalBreakdown.ainsCost > 0) ? (function() { const d = advancedDiscountsEnabled ? tierDiscounts.ains : totalBreakdown.rtcDiscount; return floor2(summaryOriginalAinsCost * (1 - d / 100)); })() : 0;

    content += `<div class="detail-item"><span class="detail-label">Host Cost</span><span class="detail-value">$${summaryOriginalHostCost.toFixed(2)}</span></div>`;
    if (summaryOriginalHostCost !== summaryDiscountedHostCost) {
        content += `<div class="detail-item" style="padding-left: 20px; color: #28a745;"><span class="detail-label">Host Discount</span><span class="detail-value">-$${(summaryOriginalHostCost-summaryDiscountedHostCost).toFixed(2)}</span></div>`;
    }
    content += `<div class="detail-item" style="padding-left: 20px;"><span class="detail-label">Host Final</span><span class="detail-value">$${summaryDiscountedHostCost.toFixed(2)}</span></div>`;

    // Show screenshare audio for clarity, but note it's included in Host Final
    if (totalBreakdown.screenshareEnabled) {
        content += `<div class="detail-item"><span class="detail-label">Screenshare Audio <span style='font-size:11px;color:#888;'>(included in Host Final)</span></span><span class="detail-value"></span></div>`;
        if (screenshareAudioDiscount > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; color: #28a745;"><span class="detail-label">Screenshare Discount</span><span class="detail-value">-$${screenshareAudioDiscount.toFixed(2)}</span></div>`;
        }
        content += `<div class="detail-item" style="padding-left: 20px;"><span class="detail-label">Screenshare Final</span><span class="detail-value">$${screenshareAudioDiscounted.toFixed(2)}</span></div>`;
    }

    content += `<div class="detail-item"><span class="detail-label">Audience Cost</span><span class="detail-value">$${summaryOriginalAudienceCost.toFixed(2)}</span></div>`;
    if (summaryOriginalAudienceCost !== summaryDiscountedAudienceCost) {
        content += `<div class="detail-item" style="padding-left: 20px; color: #28a745;"><span class="detail-label">Audience Discount</span><span class="detail-value">-$${(summaryOriginalAudienceCost-summaryDiscountedAudienceCost).toFixed(2)}</span></div>`;
    }
    content += `<div class="detail-item" style="padding-left: 20px;"><span class="detail-label">Audience Final</span><span class="detail-value">$${summaryDiscountedAudienceCost.toFixed(2)}</span></div>`;

    if (summaryOriginalCloudCost > 0) {
        content += `<div class="detail-item"><span class="detail-label">Cloud Recording</span><span class="detail-value">$${summaryOriginalCloudCost.toFixed(2)}</span></div>`;
        if (summaryOriginalCloudCost !== summaryDiscountedCloudCost) {
            content += `<div class="detail-item" style="padding-left: 20px; color: #28a745;"><span class="detail-label">Cloud Discount</span><span class="detail-value">-$${(summaryOriginalCloudCost-summaryDiscountedCloudCost).toFixed(2)}</span></div>`;
        }
        content += `<div class="detail-item" style="padding-left: 20px;"><span class="detail-label">Cloud Final</span><span class="detail-value">$${summaryDiscountedCloudCost.toFixed(2)}</span></div>`;
    }
    if (summaryOriginalWebCost > 0) {
        content += `<div class="detail-item"><span class="detail-label">Web Page Recording</span><span class="detail-value">$${summaryOriginalWebCost.toFixed(2)}</span></div>`;
        if (summaryOriginalWebCost !== summaryDiscountedWebCost) {
            content += `<div class="detail-item" style="padding-left: 20px; color: #28a745;"><span class="detail-label">Web Discount</span><span class="detail-value">-$${(summaryOriginalWebCost-summaryDiscountedWebCost).toFixed(2)}</span></div>`;
        }
        content += `<div class="detail-item" style="padding-left: 20px;"><span class="detail-label">Web Final</span><span class="detail-value">$${summaryDiscountedWebCost.toFixed(2)}</span></div>`;
    }
    if (summaryOriginalAinsCost > 0) {
        content += `<div class="detail-item"><span class="detail-label">AINS</span><span class="detail-value">$${summaryOriginalAinsCost.toFixed(2)}</span></div>`;
        if (summaryOriginalAinsCost !== summaryDiscountedAinsCost) {
            content += `<div class="detail-item" style="padding-left: 20px; color: #28a745;"><span class="detail-label">AINS Discount</span><span class="detail-value">-$${(summaryOriginalAinsCost-summaryDiscountedAinsCost).toFixed(2)}</span></div>`;
        }
        content += `<div class="detail-item" style="padding-left: 20px;"><span class="detail-label">AINS Final</span><span class="detail-value">$${summaryDiscountedAinsCost.toFixed(2)}</span></div>`;
    }
    // Transcription summary
    if (totalBreakdown.transcriptionCost > 0) {
        content += `<div class="detail-item"><span class="detail-label">Transcription</span><span class="detail-value">$${totalBreakdown.transcriptionCost.toFixed(2)}</span></div>`;
        content += `<div class="detail-item" style="padding-left: 20px; color: #666;"><span class="detail-label">Languages</span><span class="detail-value">${totalBreakdown.transcriptionLanguages}</span></div>`;
        if (totalBreakdown.transcriptionLanguages >= 2 && totalBreakdown.lidCost > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; color: #b83232;"><span class="detail-label">LID Fee</span><span class="detail-value">$${totalBreakdown.lidCost.toFixed(2)}</span></div>`;
        }
        if (totalBreakdown.transcriptionCost !== totalBreakdown.discountedTranscriptionCost) {
            content += `<div class="detail-item" style="padding-left: 20px; color: #28a745;"><span class="detail-label">Discount Applied</span><span class="detail-value">-$${(totalBreakdown.transcriptionCost-totalBreakdown.discountedTranscriptionCost).toFixed(2)}</span></div>`;
        }
        content += `<div class="detail-item" style="padding-left: 20px;"><span class="detail-label">Transcription Final</span><span class="detail-value">$${totalBreakdown.discountedTranscriptionCost.toFixed(2)}</span></div>`;
    }
    // Translation summary
    if (totalBreakdown.translationCost > 0) {
        content += `<div class="detail-item"><span class="detail-label">Translation</span><span class="detail-value">$${totalBreakdown.translationCost.toFixed(2)}</span></div>`;
        content += `<div class="detail-item" style="padding-left: 20px; color: #666;"><span class="detail-label">Translation Languages</span><span class="detail-value">${totalBreakdown.translationLanguages}</span></div>`;
        if (totalBreakdown.translationCost !== totalBreakdown.discountedTranslationCost) {
            content += `<div class="detail-item" style="padding-left: 20px; color: #28a745;"><span class="detail-label">Discount Applied</span><span class="detail-value">-$${(totalBreakdown.translationCost-totalBreakdown.discountedTranslationCost).toFixed(2)}</span></div>`;
        }
        content += `<div class="detail-item" style="padding-left: 20px;"><span class="detail-label">Translation Final</span><span class="detail-value">$${totalBreakdown.discountedTranslationCost.toFixed(2)}</span></div>`;
    }
    // Always use totalBreakdown.finalCost for summary Final Cost
    let preDiscountTotal = summaryOriginalHostCost + summaryOriginalAudienceCost + summaryOriginalCloudCost + summaryOriginalWebCost + summaryOriginalAinsCost + (totalBreakdown.transcriptionCost || 0) + (totalBreakdown.translationCost || 0);
    let totalDiscount = preDiscountTotal - (totalBreakdown.finalCost || 0);
    if (totalDiscount > 0.01) {
        content += `<div class="detail-item" style="font-weight:bold;"><span class="detail-label">Pre-Discount Total</span><span class="detail-value">$${preDiscountTotal.toFixed(2)}</span></div>`;
        content += `<div class="detail-item" style="font-weight:bold;color:#28a745;"><span class="detail-label">Total Discount</span><span class="detail-value">-$${totalDiscount.toFixed(2)}</span></div>`;
        content += `<div class="detail-item" style="font-weight:bold;"><span class="detail-label">Final Cost</span><span class="detail-value">$${(totalBreakdown.finalCost || 0).toFixed(2)}</span></div>`;
    } else {
        content += `<div class="detail-item" style="font-weight:bold;"><span class="detail-label">Final Cost</span><span class="detail-value">$${(totalBreakdown.finalCost || 0).toFixed(2)}</span></div>`;
    }

    content += '</div>';

    // --- Advanced Tiered Breakdown Table (if enabled) ---
    if (shouldUseTieredDiscounts(false) || shouldUseTieredDiscounts(bsAudience)) {
        // RTC (hosts) breakdown (advanced section)
        if (shouldUseTieredDiscounts(false)) {
            const rtcState = getTieredDiscountState();
        const rtcSessionsPerMonth = getSessionsPerMonth();
        const rtcTiers = rtcState.tiers;
        const rtcDiscounts = rtcState.discounts;
        const duration = totalBreakdown.duration || 0;
        const hostCount = hostDetails.length || 0;
        // Calculate minutes per resolution for hosts
        const rtcResMinutes = {};
        RESOLUTIONS.forEach(res => { rtcResMinutes[res.key] = 0; });
        hostDetails.forEach(host => {
            const tierToResKey = {
                'audio': 'audio',
                'hdvideo': 'hd', 
                'fullhdvideo': 'fullhd',
                '2kvideo': '2k',
                '2kplusvideo': '2kplus'
            };
            const currentTierKey = (host.tierName || 'Audio').toLowerCase().replace(/[^a-z0-9+]/g, "");
            const resKey = tierToResKey[currentTierKey] || 'audio';
            rtcResMinutes[resKey] += duration * rtcSessionsPerMonth;
        });
        if (totalBreakdown.screenshareEnabled) {
            rtcResMinutes['audio'] += duration * rtcSessionsPerMonth;
        }
        const rtcBaseRates = { audio: 0.99, hd: 3.99, fullhd: 8.99, '2k': 15.99, '2kplus': 35.99 };
        let rtcGrandTotal = 0;
        content += '<div class="detail-section">';
        content += `<h4>RTC Host Advanced Tiered Discount Breakdown (Monthly, Sessions: ${rtcSessionsPerMonth.toLocaleString()})</h4>`;
        content += `<div style='overflow-x:auto; min-width:700px;'>`;
        content += '<table style="min-width:700px; width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">';
        content += '<tr style="background: #f8f9fa; font-weight: bold;">';
        content += '<td style="padding: 8px; border: 1px solid #ddd;">Resolution</td>';
        content += '<td style="padding: 8px; border: 1px solid #ddd;">Tier</td>';
        content += '<td style="padding: 8px; border: 1px solid #ddd;">From (k min)</td>';
        content += '<td style="padding: 8px; border: 1px solid #ddd;">To (k min)</td>';
        content += '<td style="padding: 8px; border: 1px solid #ddd;">Minutes</td>';
        content += '<td style="padding: 8px; border: 1px solid #ddd;">Discount (%)</td>';
        content += '<td style="padding: 8px; border: 1px solid #ddd;">Base Rate ($/1k)</td>';
        content += '<td style="padding: 8px; border: 1px solid #ddd;">Cost</td>';
        content += '</tr>';
        RESOLUTIONS.forEach(res => {
            const minutes = rtcResMinutes[res.key];
            if (minutes === 0) return;
            const tierDiscounts = rtcDiscounts[res.key] || [];
            const breakdown = calculateTieredRTCDiscountBreakdown(minutes, rtcSessionsPerMonth, rtcTiers, tierDiscounts);
            breakdown.forEach(row => {
                const cost = (row.minutes / 1000) * rtcBaseRates[res.key] * (1 - row.discount / 100);
                rtcGrandTotal += cost;
                content += '<tr>';
                content += `<td style="padding: 8px; border: 1px solid #ddd;">${res.label}</td>`;
                content += `<td style="padding: 8px; border: 1px solid #ddd;">${row.tierIdx + 1}</td>`;
                content += `<td style="padding: 8px; border: 1px solid #ddd;">${(row.from / 1000).toLocaleString()}</td>`;
                content += `<td style="padding: 8px; border: 1px solid #ddd;">${row.to === Infinity ? '\u221e' : (row.to / 1000).toLocaleString()}</td>`;
                content += `<td style="padding: 8px; border: 1px solid #ddd;">${row.minutes.toLocaleString()}</td>`;
                content += `<td style="padding: 8px; border: 1px solid #ddd;">${row.discount}</td>`;
                content += `<td style="padding: 8px; border: 1px solid #ddd;">$${rtcBaseRates[res.key]}</td>`;
                content += `<td style="padding: 8px; border: 1px solid #ddd;">$${cost.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>`;
                content += '</tr>';
            });
        });
        content += `<tr style="font-weight:bold;background:#f8f9fa;"><td colspan="7" style="text-align:right;padding:8px;">Grand Total</td><td style="padding:8px;">$${rtcGrandTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td></tr>`;
        content += '</table>';
        content += '</div>';
        content += '</div>';
        }
        // BS (audience) breakdown if BS is enabled
        if (bsAudience && shouldUseTieredDiscounts(true)) {
            const bsState = getBSTieredDiscountState();
            const bsSessionsPerMonth = getBSSessionsPerMonth();
            const bsTiers = bsState.tiers;
            const bsDiscounts = bsState.discounts;
            // Calculate minutes per resolution for audience
            const bsResMinutes = {};
            BS_RESOLUTIONS.forEach(res => { bsResMinutes[res.key] = 0; });
            // Audience: all audience minutes are at the aggregate resolution tier
            let aggResKey = (() => {
                const tierToResKey = {
                    'audio': 'audio',
                    'hdvideo': 'hd', 
                    'fullhdvideo': 'fullhd',
                    '2kvideo': '2k',
                    '2kplusvideo': '2kplus'
                };
                const currentTierKey = (audienceDetails.tierName || 'Audio').toLowerCase().replace(/[^a-z0-9+]/g, "");
                return tierToResKey[currentTierKey] || 'audio';
            })();
            bsResMinutes[aggResKey] += (audienceDetails.count || 0) * (totalBreakdown.duration || 0) * bsSessionsPerMonth;
            const bsBaseRates = { audio: 0.59, hd: 1.99, fullhd: 4.59, '2k': 7.99, '2kplus': 17.99 };
            let bsGrandTotal = 0;
            content += '<div class="detail-section">';
            content += `<h4>BS Audience Advanced Tiered Discount Breakdown (Monthly, Sessions: ${bsSessionsPerMonth.toLocaleString()})</h4>`;
            content += `<div style='overflow-x:auto; min-width:700px;'>`;
            content += '<table style="min-width:700px; width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">';
            content += '<tr style="background: #f8f9fa; font-weight: bold;">';
            content += '<td style="padding: 8px; border: 1px solid #ddd;">Resolution</td>';
            content += '<td style="padding: 8px; border: 1px solid #ddd;">Tier</td>';
            content += '<td style="padding: 8px; border: 1px solid #ddd;">From (k min)</td>';
            content += '<td style="padding: 8px; border: 1px solid #ddd;">To (k min)</td>';
            content += '<td style="padding: 8px; border: 1px solid #ddd;">Minutes</td>';
            content += '<td style="padding: 8px; border: 1px solid #ddd;">Discount (%)</td>';
            content += '<td style="padding: 8px; border: 1px solid #ddd;">Base Rate ($/1k)</td>';
            content += '<td style="padding: 8px; border: 1px solid #ddd;">Cost</td>';
            content += '</tr>';
            BS_RESOLUTIONS.forEach(res => {
                let minutes = bsResMinutes[res.key];
                // Force the row to render for the aggregate tier if audience exists
                if (res.key === aggResKey && audienceDetails.count > 0 && minutes === 0) {
                    minutes = (audienceDetails.count || 0) * (totalBreakdown.duration || 0) * bsSessionsPerMonth;
                }
                if (minutes === 0) return;
                const tierDiscounts = bsDiscounts[res.key] || [];
                const breakdown = calculateTieredRTCDiscountBreakdown(minutes, bsSessionsPerMonth, bsTiers, tierDiscounts);
                breakdown.forEach(row => {
                    const cost = (row.minutes / 1000) * bsBaseRates[res.key] * (1 - row.discount / 100);
                    bsGrandTotal += cost;
                    content += '<tr>';
                    content += `<td style="padding: 8px; border: 1px solid #ddd;">${res.label}</td>`;
                    content += `<td style="padding: 8px; border: 1px solid #ddd;">${row.tierIdx + 1}</td>`;
                    content += `<td style="padding: 8px; border: 1px solid #ddd;">${(row.from / 1000).toLocaleString()}</td>`;
                    content += `<td style="padding: 8px; border: 1px solid #ddd;">${row.to === Infinity ? '\u221e' : (row.to / 1000).toLocaleString()}</td>`;
                    content += `<td style="padding: 8px; border: 1px solid #ddd;">${row.minutes.toLocaleString()}</td>`;
                    content += `<td style="padding: 8px; border: 1px solid #ddd;">${row.discount}</td>`;
                    content += `<td style="padding: 8px; border: 1px solid #ddd;">$${bsBaseRates[res.key]}</td>`;
                    content += `<td style="padding: 8px; border: 1px solid #ddd;">$${cost.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>`;
                    content += '</tr>';
                });
            });
            content += `<tr style="font-weight:bold;background:#f8f9fa;"><td colspan="7" style="text-align:right;padding:8px;">Grand Total</td><td style="padding:8px;">$${bsGrandTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td></tr>`;
            content += '</table>';
            content += '</div>';
            content += '</div>';
        }
    }
    // --- End Advanced Tiered Breakdown ---

    // --- Advanced Addon Features Table ---
    if (shouldUseTieredDiscounts(false) || shouldUseTieredDiscounts(bsAudience)) {
        // ... existing RTC and BS tables ...
        // Addon features table
        const sessionsPerMonth = getSessionsPerMonth();
        const bsSessionsPerMonth = getBSSessionsPerMonth();
        let addonGrandTotal = 0;
        let addonTable = '<div class="detail-section">';
        addonTable += `<h4>Additional Features Breakdown (Monthly, Sessions: RTC ${sessionsPerMonth.toLocaleString()}, BS ${bsSessionsPerMonth.toLocaleString()})</h4>`;
        addonTable += `<div style='overflow-x:auto; min-width:700px;'>`;
        addonTable += '<table style="min-width:700px; width: 100%; border-collapse: collapse; border: 1px solid #ddd; font-size: 14px;">';
        addonTable += '<tr style="background: #f8f9fa; font-weight: bold; border-top: 2px solid #667eea; border-bottom: 2px solid #667eea;">';
        addonTable += '<td style="padding: 8px; border: 1px solid #ddd;">Feature</td>';
        addonTable += '<td style="padding: 8px; border: 1px solid #ddd;">Tier</td>';
        addonTable += '<td style="padding: 8px; border: 1px solid #ddd;">Minutes</td>';
        addonTable += '<td style="padding: 8px; border: 1px solid #ddd;">Base Rate ($/1k)</td>';
        addonTable += '<td style="padding: 8px; border: 1px solid #ddd;">Discount (%)</td>';
        addonTable += '<td style="padding: 8px; border: 1px solid #ddd;">Cost</td>';
        addonTable += '</tr>';
        // Cloud Recording
        if (totalBreakdown.cloudRecordingCost > 0) {
            const isCloudTiered = advancedRecordingDiscountsEnabled && document.getElementById('recording-advanced-discounts')?.checked;
            const tier = isCloudTiered ? audienceDetails.tierName : 'N/A';
            const minutes = ((totalBreakdown.duration || 0) * sessionsPerMonth).toLocaleString();
            const baseRates = { 'Audio': 1.49, 'HD Video': 5.99, 'Full HD Video': 13.49, '2K Video': 23.99, '2K+ Video': 53.99 };
            const baseRate = baseRates[audienceDetails.tierName] || 1.49;
            const discount = getRecordingDiscount('cloud', audienceDetails.tierName);
            const cost = (((totalBreakdown.duration || 0) * sessionsPerMonth / 1000) * baseRate) * (1 - discount / 100);
            addonGrandTotal += cost;
            addonTable += `<tr style=\"background: #fff;\">`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">Cloud Recording</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${tier}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${minutes}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">$${baseRate.toLocaleString()}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${discount}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">$${cost.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>`;
            addonTable += `</tr>`;
        }
        // Web Recording
        if (totalBreakdown.webRecordingCost > 0) {
            const isWebTiered = advancedRecordingDiscountsEnabled && document.getElementById('recording-advanced-discounts')?.checked;
            const tier = isWebTiered ? totalBreakdown.webRecordingTierName : 'N/A';
            const minutes = ((totalBreakdown.duration || 0) * sessionsPerMonth).toLocaleString();
            const baseRates = { 'HD Video': 14, 'Full HD Video': 28 };
            const baseRate = baseRates[totalBreakdown.webRecordingTierName] || 14;
            const discount = getRecordingDiscount('web', totalBreakdown.webRecordingTierName);
            const cost = (((totalBreakdown.duration || 0) * sessionsPerMonth / 1000) * baseRate) * (1 - discount / 100);
            addonGrandTotal += cost;
            addonTable += `<tr style=\"background: #f8f9fa;\">`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">Web Recording</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${tier}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${minutes}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">$${baseRate.toLocaleString()}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${discount}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">$${cost.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>`;
            addonTable += `</tr>`;
        }
        // AINS
        if (totalBreakdown.ainsCost > 0) {
            const isAinsTiered = advancedDiscountsEnabled && document.getElementById('advanced-discounts')?.checked;
            const tier = isAinsTiered ? 'AINS' : 'N/A';
            const minutes = ((totalBreakdown.duration || 0) * hostDetails.length * sessionsPerMonth).toLocaleString();
            const baseRate = 0.59;
            const discount = advancedDiscountsEnabled ? tierDiscounts.ains : totalBreakdown.rtcDiscount;
            const cost = (((totalBreakdown.duration || 0) * hostDetails.length * sessionsPerMonth / 1000) * baseRate) * (1 - discount / 100);
            addonGrandTotal += cost;
            addonTable += `<tr style=\"background: #fff;\">`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">AINS</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">N/A</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${minutes}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">$${baseRate.toLocaleString()}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${discount}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">$${cost.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>`;
            addonTable += `</tr>`;
        }
        // Transcription
        if (totalBreakdown.transcriptionCost > 0) {
            const isTransTiered = advancedDiscountsEnabled && document.getElementById('advanced-discounts')?.checked;
            const tier = isTransTiered ? 'Transcription' : 'N/A';
            const minutes = ((totalBreakdown.duration || 0) * hostDetails.length * sessionsPerMonth).toLocaleString();
            const baseRate = 16.99;
            const discount = advancedDiscountsEnabled ? tierDiscounts.transcription : (parseFloat(document.getElementById("transcription-discount")?.value) || 0);
            const cost = (((totalBreakdown.duration || 0) * hostDetails.length * sessionsPerMonth / 1000) * baseRate) * (1 - discount / 100);
            addonGrandTotal += cost;
            addonTable += `<tr style=\"background: #f8f9fa;\">`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">Transcription</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">N/A</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${minutes}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">$${baseRate.toLocaleString()}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${discount}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">$${cost.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>`;
            addonTable += `</tr>`;
        }
        // Translation
        if (totalBreakdown.translationCost > 0) {
            const isTranslTiered = advancedDiscountsEnabled && document.getElementById('advanced-discounts')?.checked;
            const tier = isTranslTiered ? 'Translation' : 'N/A';
            const minutes = ((totalBreakdown.duration || 0) * hostDetails.length * (totalBreakdown.translationLanguages || 1) * sessionsPerMonth).toLocaleString();
            const baseRate = 8.99;
            const discount = advancedDiscountsEnabled ? tierDiscounts.translation : (parseFloat(document.getElementById("translation-discount")?.value) || 0);
            const cost = (((totalBreakdown.duration || 0) * hostDetails.length * (totalBreakdown.translationLanguages || 1) * sessionsPerMonth / 1000) * baseRate) * (1 - discount / 100);
            addonGrandTotal += cost;
            addonTable += `<tr style=\"background: #fff;\">`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">Translation</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">N/A</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${minutes}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">$${baseRate.toLocaleString()}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">${discount}</td>`;
            addonTable += `<td style=\"padding: 8px; border: 1px solid #ddd;\">$${cost.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>`;
            addonTable += `</tr>`;
        }
        addonTable += `<tr style=\"font-weight:bold;background:#f8f9fa;\"><td colspan=\"5\" style=\"text-align:right;padding:8px;\">Grand Total Addons</td><td style=\"padding:8px;\">$${addonGrandTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td></tr>`;
        // Add RTC and BS grand totals if present
        let rtcGrandTotal = 0;
        let bsGrandTotal = 0;
        if (shouldUseTieredDiscounts(false)) {
            // Calculate RTC grand total from advanced table
            const rtcState = getTieredDiscountState();
            const rtcSessionsPerMonth = getSessionsPerMonth();
            const rtcTiers = rtcState.tiers;
            const rtcDiscounts = rtcState.discounts;
            const duration = totalBreakdown.duration || 0;
            const rtcResMinutes = {};
            RESOLUTIONS.forEach(res => { rtcResMinutes[res.key] = 0; });
            hostDetails.forEach(host => {
                const tierToResKey = {
                    'audio': 'audio',
                    'hdvideo': 'hd', 
                    'fullhdvideo': 'fullhd',
                    '2kvideo': '2k',
                    '2kplusvideo': '2kplus'
                };
                const currentTierKey = (host.tierName || 'Audio').toLowerCase().replace(/[^a-z0-9+]/g, "");
                const resKey = tierToResKey[currentTierKey] || 'audio';
                rtcResMinutes[resKey] += duration * rtcSessionsPerMonth;
            });
            if (totalBreakdown.screenshareEnabled) {
                rtcResMinutes['audio'] += duration * rtcSessionsPerMonth;
            }
            const rtcBaseRates = { audio: 0.99, hd: 3.99, fullhd: 8.99, '2k': 15.99, '2kplus': 35.99 };
            RESOLUTIONS.forEach(res => {
                const minutes = rtcResMinutes[res.key];
                if (minutes === 0) return;
                const tierDiscounts = rtcDiscounts[res.key] || [];
                const breakdown = calculateTieredRTCDiscountBreakdown(minutes, rtcSessionsPerMonth, rtcTiers, tierDiscounts);
                breakdown.forEach(row => {
                    const cost = (row.minutes / 1000) * rtcBaseRates[res.key] * (1 - row.discount / 100);
                    rtcGrandTotal += cost;
                });
            });
        }
        if (shouldUseTieredDiscounts(bsAudience)) {
            // Calculate BS grand total from advanced table
            const bsState = getBSTieredDiscountState();
            const bsSessionsPerMonth = getBSSessionsPerMonth();
            const bsTiers = bsState.tiers;
            const bsDiscounts = bsState.discounts;
            const bsResMinutes = {};
            BS_RESOLUTIONS.forEach(res => { bsResMinutes[res.key] = 0; });
            let aggResKey = (() => {
                const tierToResKey = {
                    'audio': 'audio',
                    'hdvideo': 'hd', 
                    'fullhdvideo': 'fullhd',
                    '2kvideo': '2k',
                    '2kplusvideo': '2kplus'
                };
                const currentTierKey = (audienceDetails.tierName || 'Audio').toLowerCase().replace(/[^a-z0-9+]/g, "");
                return tierToResKey[currentTierKey] || 'audio';
            })();
            bsResMinutes[aggResKey] += (audienceDetails.count || 0) * (totalBreakdown.duration || 0) * bsSessionsPerMonth;
            const bsBaseRates = { audio: 0.59, hd: 1.99, fullhd: 4.59, '2k': 7.99, '2kplus': 17.99 };
            BS_RESOLUTIONS.forEach(res => {
                let minutes = bsResMinutes[res.key];
                if (res.key === aggResKey && audienceDetails.count > 0 && minutes === 0) {
                    minutes = (audienceDetails.count || 0) * (totalBreakdown.duration || 0) * bsSessionsPerMonth;
                }
                if (minutes === 0) return;
                const tierDiscounts = bsDiscounts[res.key] || [];
                const breakdown = calculateTieredRTCDiscountBreakdown(minutes, bsSessionsPerMonth, bsTiers, tierDiscounts);
                breakdown.forEach(row => {
                    const cost = (row.minutes / 1000) * bsBaseRates[res.key] * (1 - row.discount / 100);
                    bsGrandTotal += cost;
                });
            });
        }
        const grandTotal = rtcGrandTotal + bsGrandTotal + addonGrandTotal;
        addonTable += `<tr style=\"font-weight:bold;background:#e2e8f0;\"><td colspan=\"5\" style=\"text-align:right;padding:8px;\">Grand Total (RTC + BS + Addons)</td><td style=\"padding:8px;\">$${grandTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td></tr>`;
        addonTable += '</table></div>';
        addonTable += '</div>';
        content += addonTable;
    }

    document.getElementById('detailsContent').innerHTML = content;
    document.getElementById('detailsPopup').style.display = 'flex';
    
    // Add event listeners for closing the popup
    const popup = document.getElementById('detailsPopup');
    const popupContent = document.querySelector('.popup-content');
    
    // Close when clicking outside the popup content
    popup.addEventListener('click', function(e) {
        if (e.target === popup) {
            closeDetails();
        }
    });
    
    // Close when pressing Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && popup.style.display === 'flex') {
            closeDetails();
        }
    });

    // Add scroll styling to the detailsContent div:
    document.getElementById('detailsContent').style.maxHeight = '70vh';
    document.getElementById('detailsContent').style.overflowY = 'auto';
    setupExportPDF();
    setupExportExportButtons();
}

function closeDetails() {
    document.getElementById('detailsPopup').style.display = 'none';
}

function showAudienceBreakdown() {
    // Use single-session values for audience breakdown (to match cost details)
    const originalAudienceCost = audienceDetails.singleSessionCost;
    const discountedAudienceCost = audienceDetails.singleSessionDiscountedCost || originalAudienceCost;
    const audienceDiscountApplied = originalAudienceCost > 0 ? ((originalAudienceCost - discountedAudienceCost) / originalAudienceCost) * 100 : 0;

    let content = '<div class="detail-section">';
    content += '<h4>Audience Tier Breakdown</h4>';
    content += `<div class="detail-item">
        <span class="detail-label">Audience Members (${audienceDetails.count})</span>
        <span class="detail-value">$${discountedAudienceCost.toFixed(2)}</span>
    </div>`;
    if (audienceDiscountApplied > 0.01) {
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
            <span class="detail-label">Pre-Discount</span><span class="detail-value">$${originalAudienceCost.toFixed(2)}</span>
        </div>`;
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
            <span class="detail-label">Discount</span><span class="detail-value">-$${(originalAudienceCost - discountedAudienceCost).toFixed(2)} (${audienceDiscountApplied.toFixed(2)}%)</span>
        </div>`;
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #333;">
            <span class="detail-label">Final</span><span class="detail-value">$${discountedAudienceCost.toFixed(2)}</span>
        </div>`;
    }
    // Aggregate and tier info in a single row
    content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
        <span class="detail-label">Aggregate: ${audienceDetails.aggregatePixels.toLocaleString()} px (${audienceDetails.tierName})</span>
        <span class="detail-value">$${audienceDetails.pricingTier}/1,000 min (${audienceDetails.pricingMode})</span>
    </div>`;
    // Add screenshare information if enabled
    if (totalBreakdown.screenshareEnabled) {
        content += `<div class="detail-item" style="padding-left: 0; font-size: 13px; color: #666; background: #f8f9fa; border-radius: 6px; margin-top: 6px;">
            <span class="detail-label">Includes Screenshare: ${totalBreakdown.screenshareResolution}</span>
            <span class="detail-value"></span>
        </div>`;
    }
    content += '</div>';

    // Add tier visualization
    content += '<div class="detail-section">';
    content += '<h4>Tier Usage Visualization</h4>';

    const aggregatePixels = audienceDetails.aggregatePixels;
    const tierLimits = {
        'HD': 921600,
        'Full HD': 2073600,
        '2K': 3686400,
        '2K+': 8847360
    };

    let currentTier = 'Audio';
    let tierUsage = 0;
    let tierPercentage = 0;

    if (aggregatePixels > 0) {
        if (aggregatePixels <= tierLimits['HD']) {
            currentTier = 'HD';
            tierUsage = aggregatePixels;
            tierPercentage = (aggregatePixels / tierLimits['HD']) * 100;
        } else if (aggregatePixels <= tierLimits['Full HD']) {
            currentTier = 'Full HD';
            tierUsage = aggregatePixels - tierLimits['HD'];
            tierPercentage = ((aggregatePixels - tierLimits['HD']) / (tierLimits['Full HD'] - tierLimits['HD'])) * 100;
        } else if (aggregatePixels <= tierLimits['2K']) {
            currentTier = '2K';
            tierUsage = aggregatePixels - tierLimits['Full HD'];
            tierPercentage = ((aggregatePixels - tierLimits['Full HD']) / (tierLimits['2K'] - tierLimits['Full HD'])) * 100;
        } else {
            currentTier = '2K+';
            tierUsage = aggregatePixels - tierLimits['2K'];
            tierPercentage = ((aggregatePixels - tierLimits['2K']) / (tierLimits['2K+'] - tierLimits['2K'])) * 100;
        }
    }

    content += `<div class="tier-info">
        <strong>Current Tier: ${currentTier}</strong><br>
        <span style="font-size: 12px; color: #666;">
            Aggregate Resolution: ${aggregatePixels.toLocaleString()} pixels<br>
            Tier Usage: ${tierUsage.toLocaleString()} pixels (${tierPercentage.toFixed(1)}% of ${currentTier} tier)
        </span>
    </div>`;

    // Show all tiers with progress bars
    content += '<div class="tier-progress">';
    content += '<div style="margin-bottom: 15px;"><strong>HD Tier (≤ 921,600 px)</strong></div>';
    content += '<div class="tier-bar">';
    if (aggregatePixels <= tierLimits['HD']) {
        content += `<div class="tier-fill" style="width: ${(aggregatePixels / tierLimits['HD']) * 100}%;"></div>`;
    } else if (aggregatePixels > tierLimits['HD']) {
        content += `<div class="tier-fill" style="width: 100%;"></div>`;
    }
    content += '</div>';
    content += '<div class="tier-labels">';
    content += '<span>0 px</span>';
    content += '<span>921,600 px</span>';
    content += '</div>';
    content += '</div>';

    content += '<div class="tier-progress">';
    content += '<div style="margin-bottom: 15px;"><strong>Full HD Tier (921,601 - 2,073,600 px)</strong></div>';
    content += '<div class="tier-bar">';
    if (aggregatePixels > tierLimits['HD'] && aggregatePixels <= tierLimits['Full HD']) {
        content += `<div class="tier-fill" style="width: ${((aggregatePixels - tierLimits['HD']) / (tierLimits['Full HD'] - tierLimits['HD'])) * 100}%;"></div>`;
    } else if (aggregatePixels > tierLimits['Full HD']) {
        content += '<div class="tier-fill" style="width: 100%;"></div>';
    }
    content += '</div>';
    content += '<div class="tier-labels">';
    content += '<span>921,601 px</span>';
    content += '<span>2,073,600 px</span>';
    content += '</div>';
    content += '</div>';

    content += '<div class="tier-progress">';
    content += '<div style="margin-bottom: 15px;"><strong>2K Tier (2,073,601 - 3,686,400 px)</strong></div>';
    content += '<div class="tier-bar">';
    if (aggregatePixels > tierLimits['Full HD'] && aggregatePixels <= tierLimits['2K']) {
        content += `<div class="tier-fill" style="width: ${((aggregatePixels - tierLimits['Full HD']) / (tierLimits['2K'] - tierLimits['Full HD'])) * 100}%;"></div>`;
    } else if (aggregatePixels > tierLimits['2K']) {
        content += '<div class="tier-fill" style="width: 100%;"></div>';
    }
    content += '</div>';
    content += '<div class="tier-labels">';
    content += '<span>2,073,601 px</span>';
    content += '<span>3,686,400 px</span>';
    content += '</div>';
    content += '</div>';

    content += '<div class="tier-progress">';
    content += '<div style="margin-bottom: 15px;"><strong>2K+ Tier (> 3,686,400 px)</strong></div>';
    content += '<div class="tier-bar">';
    if (aggregatePixels > tierLimits['2K']) {
        content += `<div class="tier-fill" style="width: ${((aggregatePixels - tierLimits['2K']) / (tierLimits['2K+'] - tierLimits['2K'])) * 100}%;"></div>`;
    }
    content += '</div>';
    content += '<div class="tier-labels">';
    content += '<span>3,686,401 px</span>';
    content += '<span>8,847,360 px</span>';
    content += '</div>';
    content += '</div>';

    content += '</div>';
    
    // Add tier breakdown table
    content += '<div style="margin-top: 30px;">';
    content += '<h4>Tier Breakdown</h4>';
    content += '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">';
    content += '<tr style="background: #f8f9fa; font-weight: bold;">';
    content += '<td style="padding: 8px; border: 1px solid #ddd;">Tier</td>';
    content += '<td style="padding: 8px; border: 1px solid #ddd;">Pixel Range</td>';
    content += '<td style="padding: 8px; border: 1px solid #ddd;">Status</td>';
    content += '</tr>';
    
    const tiers = [
        { name: 'HD', min: 0, max: 921600, color: '#667eea' },
        { name: 'Full HD', min: 921601, max: 2073600, color: '#764ba2' },
        { name: '2K', min: 2073601, max: 3686400, color: '#ff6b6b' },
        { name: '2K+', min: 3686401, max: 8847360, color: '#ffc107' }
    ];
    
    tiers.forEach(tier => {
        let status = 'Not Used';
        let statusColor = '#999';
        
        if (aggregatePixels >= tier.min && aggregatePixels <= tier.max) {
            status = 'Current Tier';
            statusColor = '#28a745';
        } else if (aggregatePixels > tier.max) {
            status = 'Exceeded';
            statusColor = '#dc3545';
        }
        
        content += '<tr>';
        content += `<td style="padding: 8px; border: 1px solid #ddd; background: ${tier.color}20;">${tier.name}</td>`;
        content += `<td style="padding: 8px; border: 1px solid #ddd;">${tier.min.toLocaleString()} - ${tier.max.toLocaleString()} px</td>`;
        content += `<td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">${status}</td>`;
        content += '</tr>';
    });
    
    content += '</table>';
    content += '</div>';
    
    content += '</div>';

    document.getElementById('audienceContent').innerHTML = content;
    document.getElementById('audiencePopup').style.display = 'flex';
    
    // Add event listeners for closing the popup
    const popup = document.getElementById('audiencePopup');
    
    // Close when clicking outside the popup content
    popup.addEventListener('click', function(e) {
        if (e.target === popup) {
            closeAudienceBreakdown();
        }
    });
    
    // Close when pressing Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && popup.style.display === 'flex') {
            closeAudienceBreakdown();
        }
    });
}

function closeAudienceBreakdown() {
    document.getElementById('audiencePopup').style.display = 'none';
}

// Advanced Discount Control Functions
function openAdvancedDiscounts() {
    document.getElementById("advanced-discounts").checked = true;
    advancedDiscountsEnabled = true;
    document.getElementById("advancedDiscountsPopup").style.display = "flex";
    
    // Initialize master discount with current RTC discount
    const rtcDiscount = parseFloat(document.getElementById("rtc-discount").value) || 0;
    document.getElementById("master-discount").value = rtcDiscount;
    
    updateTierDiscounts(); // Restore original behavior
    updateMainDiscountFieldsState(); // Grey out main discount fields
    
    // Add event listeners for closing the popup
    const popup = document.getElementById("advancedDiscountsPopup");
    
    // Close when clicking outside the popup content
    popup.addEventListener('click', function(e) {
        if (e.target === popup) {
            closeAdvancedDiscounts();
        }
    });
    
    // Close when pressing Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && popup.style.display === 'flex') {
            closeAdvancedDiscounts();
        }
    });
}

// Populate tier discount fields from saved tierDiscounts
function populateTierDiscountFieldsFromSaved() {
    const discountInputs = [
        { id: 'audio-discount', key: 'audio' },
        { id: 'hd-discount', key: 'hd' },
        { id: 'fullhd-discount', key: 'fullhd' },
        { id: '2k-discount', key: '2k' },
        { id: '2kplus-discount', key: '2kplus' },
        { id: 'ains-discount', key: 'ains' },
        { id: 'bs-audio-discount', key: 'bsAudio' },
        { id: 'bs-hd-discount', key: 'bsHd' },
        { id: 'bs-fullhd-discount', key: 'bsFullhd' },
        { id: 'bs-2k-discount', key: 'bs2k' },
        { id: 'bs-2kplus-discount', key: 'bs2kplus' },
        { id: 'transcription-discount', key: 'transcription' },
        { id: 'translation-discount', key: 'translation' },
        { id: 'cloud-audio-discount', key: 'cloudAudio' },
        { id: 'cloud-hd-discount', key: 'cloudHd' },
        { id: 'cloud-fullhd-discount', key: 'cloudFullhd' },
        { id: 'cloud-2k-discount', key: 'cloud2k' },
        { id: 'cloud-2kplus-discount', key: 'cloud2kplus' },
        { id: 'web-hd-discount', key: 'webHd' },
        { id: 'web-fullhd-discount', key: 'webFullhd' }
    ];
    discountInputs.forEach(({id, key}) => {
        const input = document.getElementById(id);
        if (input && typeof tierDiscounts[key] !== 'undefined') {
            input.value = tierDiscounts[key];
        }
    });
}

function toggleAdvancedDiscounts() {
    const checkbox = document.getElementById("advanced-discounts");
    advancedDiscountsEnabled = checkbox.checked;
    
    if (advancedDiscountsEnabled) {
        openAdvancedDiscounts();
    } else {
        // Re-enable main discount fields when advanced controls are disabled
        enableMainDiscountFields();
    }
    
    updateMainDiscountFieldsState();
}

function updateMainDiscountFieldsState() {
    const rtcDiscountInput = document.getElementById("rtc-discount");
    const recordingDiscountInput = document.getElementById("recording-discount");
    
    if (advancedDiscountsEnabled) {
        rtcDiscountInput.disabled = true;
        rtcDiscountInput.style.opacity = "0.5";
        rtcDiscountInput.style.backgroundColor = "#f5f5f5";
    } else {
        rtcDiscountInput.disabled = false;
        rtcDiscountInput.style.opacity = "1";
        rtcDiscountInput.style.backgroundColor = "";
    }
}

function enableMainDiscountFields() {
    const rtcDiscountInput = document.getElementById("rtc-discount");
    rtcDiscountInput.disabled = false;
    rtcDiscountInput.style.opacity = "1";
    rtcDiscountInput.style.backgroundColor = "";
}

function closeAdvancedDiscounts() {
    document.getElementById("advancedDiscountsPopup").style.display = "none";
    // Don't uncheck the checkbox when closing - only when explicitly disabled
}

function updateTierDiscounts() {
    const masterDiscount = parseFloat(document.getElementById("master-discount").value) || 0;
    // Always set all RTC tier fields to the master value, unless a saved value exists
    const discountInputs = [
        { id: 'audio-discount', key: 'audio' },
        { id: 'hd-discount', key: 'hd' },
        { id: 'fullhd-discount', key: 'fullhd' },
        { id: '2k-discount', key: '2k' },
        { id: '2kplus-discount', key: '2kplus' },
        { id: 'ains-discount', key: 'ains' },
        { id: 'bs-audio-discount', key: 'bsAudio' },
        { id: 'bs-hd-discount', key: 'bsHd' },
        { id: 'bs-fullhd-discount', key: 'bsFullhd' },
        { id: 'bs-2k-discount', key: 'bs2k' },
        { id: 'bs-2kplus-discount', key: 'bs2kplus' },
        { id: 'transcription-discount', key: 'transcription' },
        { id: 'translation-discount', key: 'translation' },
        { id: 'cloud-audio-discount', key: 'cloudAudio' },
        { id: 'cloud-hd-discount', key: 'cloudHd' },
        { id: 'cloud-fullhd-discount', key: 'cloudFullhd' },
        { id: 'cloud-2k-discount', key: 'cloud2k' },
        { id: 'cloud-2kplus-discount', key: 'cloud2kplus' },
        { id: 'web-hd-discount', key: 'webHd' },
        { id: 'web-fullhd-discount', key: 'webFullhd' }
    ];
    discountInputs.forEach(({id, key}) => {
        const input = document.getElementById(id);
        if (input) {
            // If a saved value exists and is nonzero, use it; otherwise use master
            if (typeof tierDiscounts[key] !== 'undefined' && tierDiscounts[key] !== 0) {
                input.value = tierDiscounts[key];
            } else {
                input.value = masterDiscount;
            }
        }
    });
    
    // Also update the tiered discount structure with the master discount
    // Update RTC tiered discounts
    const rtcState = getTieredDiscountState();
    const rtcResolutions = ['audio', 'hd', 'fullhd', '2k', '2kplus'];
    rtcResolutions.forEach(resKey => {
        if (!rtcState.discounts[resKey]) {
            rtcState.discounts[resKey] = [];
        }
        // Set all tiers to master discount if no saved values exist
        for (let i = 0; i < rtcState.tiers.length; i++) {
            if (typeof rtcState.discounts[resKey][i] === 'undefined' || rtcState.discounts[resKey][i] === 0) {
                rtcState.discounts[resKey][i] = masterDiscount;
            }
        }
    });
    saveTieredDiscounts(rtcState);
    
    // Update BS tiered discounts
    const bsState = getBSTieredDiscountState();
    const bsResolutions = ['audio', 'hd', 'fullhd', '2k', '2kplus'];
    bsResolutions.forEach(resKey => {
        if (!bsState.discounts[resKey]) {
            bsState.discounts[resKey] = [];
        }
        // Set all tiers to master discount if no saved values exist
        for (let i = 0; i < bsState.tiers.length; i++) {
            if (typeof bsState.discounts[resKey][i] === 'undefined' || bsState.discounts[resKey][i] === 0) {
                bsState.discounts[resKey][i] = masterDiscount;
            }
        }
    });
    saveBSTieredDiscounts(bsState);
    
    // Re-render the tiered discount UI to reflect the changes
    if (document.getElementById("advancedDiscountsPopup").style.display === "flex") {
        renderTieredDiscountUI();
        renderBSTieredDiscountUI();
    }
}

function saveAdvancedDiscounts() {
    // Save master discount
    const masterDiscount = parseFloat(document.getElementById("master-discount").value) || 0;
    // Save all discount values
    tierDiscounts.audio = parseFloat(document.getElementById("audio-discount").value) || 0;
    tierDiscounts.hd = parseFloat(document.getElementById("hd-discount").value) || 0;
    tierDiscounts.fullhd = parseFloat(document.getElementById("fullhd-discount").value) || 0;
    tierDiscounts['2k'] = parseFloat(document.getElementById("2k-discount").value) || 0;
    tierDiscounts['2kplus'] = parseFloat(document.getElementById("2kplus-discount").value) || 0;
    tierDiscounts.ains = parseFloat(document.getElementById("ains-discount").value) || 0;
    tierDiscounts.bsAudio = parseFloat(document.getElementById("bs-audio-discount").value) || 0;
    tierDiscounts.bsHd = parseFloat(document.getElementById("bs-hd-discount").value) || 0;
    tierDiscounts.bsFullhd = parseFloat(document.getElementById("bs-fullhd-discount").value) || 0;
    tierDiscounts.bs2k = parseFloat(document.getElementById("bs-2k-discount").value) || 0;
    tierDiscounts.bs2kplus = parseFloat(document.getElementById("bs-2kplus-discount").value) || 0;
    tierDiscounts.transcription = parseFloat(document.getElementById("transcription-discount").value) || 0;
    tierDiscounts.translation = parseFloat(document.getElementById("translation-discount").value) || 0;
    // Save tier-based recording discounts
    tierDiscounts.cloudAudio = parseFloat(document.getElementById("cloud-audio-discount").value) || 0;
    tierDiscounts.cloudHd = parseFloat(document.getElementById("cloud-hd-discount").value) || 0;
    tierDiscounts.cloudFullhd = parseFloat(document.getElementById("cloud-fullhd-discount").value) || 0;
    tierDiscounts.cloud2k = parseFloat(document.getElementById("cloud-2k-discount").value) || 0;
    tierDiscounts.cloud2kplus = parseFloat(document.getElementById("cloud-2kplus-discount").value) || 0;
    tierDiscounts.webHd = parseFloat(document.getElementById("web-hd-discount").value) || 0;
    tierDiscounts.webFullhd = parseFloat(document.getElementById("web-fullhd-discount").value) || 0;
    closeAdvancedDiscounts();
    // Do NOT auto-calculate here. User must click Calculate.
    calculatePricing();
    // If the cost details modal is open, update it
    const detailsPopup = document.getElementById('detailsPopup');
    if (detailsPopup && detailsPopup.style.display === 'flex') {
        window.showDetails();
    }
}

function toggleRecordingDiscounts() {
    const checkbox = document.getElementById("recording-advanced-discounts");
    advancedRecordingDiscountsEnabled = checkbox.checked;
    
    const recordingFields = document.getElementById("recording-discount-fields");
    if (advancedRecordingDiscountsEnabled) {
        recordingFields.style.display = "block";
        // Initialize with current recording discount
        const currentRecordingDiscount = parseFloat(document.getElementById("recording-discount").value) || 0;
        
        // Initialize cloud recording fields
        const cloudFields = ['cloud-audio-discount', 'cloud-hd-discount', 'cloud-fullhd-discount', 'cloud-2k-discount', 'cloud-2kplus-discount'];
        cloudFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && field.value === '') {
                field.value = currentRecordingDiscount;
            }
        });
        
        // Initialize web recording fields
        const webFields = ['web-hd-discount', 'web-fullhd-discount'];
        webFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && field.value === '') {
                field.value = currentRecordingDiscount;
            }
        });
    } else {
        recordingFields.style.display = "none";
    }
}

function getDiscountForTier(tierName, isBroadcastStreaming = false) {
    if (!advancedDiscountsEnabled) {
        // Use the main RTC discount
        return parseFloat(document.getElementById("rtc-discount").value) || 0;
    }
    
    // Check if tiered discounts are enabled for this type
    const useTieredDiscounts = isBroadcastStreaming ? 
        document.getElementById("use-bs-tiered-discounts")?.checked : 
        document.getElementById("use-tiered-discounts")?.checked;
    
    if (useTieredDiscounts) {
        // Use tiered discount system - get the first tier discount (Tier 1)
        const norm = (s) => s.toLowerCase().replace(/[^a-z0-9+]/g, "");
        const tierMap = {
            'audio': isBroadcastStreaming ? 'bsAudio' : 'audio',
            'hdvideo': isBroadcastStreaming ? 'bsHd' : 'hd',
            'fullhdvideo': isBroadcastStreaming ? 'bsFullhd' : 'fullhd',
            '2kvideo': isBroadcastStreaming ? 'bs2k' : '2k',
            '2kplusvideo': isBroadcastStreaming ? 'bs2kplus' : '2kplus',
        };
        const discountKey = tierMap[norm(tierName)];
        if (discountKey && tierDiscounts[discountKey]) {
            // Return the first tier discount (index 0)
            return Array.isArray(tierDiscounts[discountKey]) ? tierDiscounts[discountKey][0] || 0 : tierDiscounts[discountKey];
        }
    }
    
    // Use simple individual resolution discounts
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9+]/g, "");
    const tierMap = {
        'audio': isBroadcastStreaming ? 'bsAudio' : 'audio',
        'hdvideo': isBroadcastStreaming ? 'bsHd' : 'hd',
        'fullhdvideo': isBroadcastStreaming ? 'bsFullhd' : 'fullhd',
        '2kvideo': isBroadcastStreaming ? 'bs2k' : '2k',
        '2kplusvideo': isBroadcastStreaming ? 'bs2kplus' : '2kplus',
    };
    const discountKey = tierMap[norm(tierName)];
    return discountKey ? tierDiscounts[discountKey] : 0;
}

function getRecordingDiscount(recordingType, tierName) {
    if (!advancedRecordingDiscountsEnabled) {
        // Use the main recording discount
        return parseFloat(document.getElementById("recording-discount").value) || 0;
    }
    // Normalize tier name
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9+]/g, "");
    let key = '';
    if (recordingType === 'cloud') {
        const map = {
            'audio': 'cloudAudio',
            'hdvideo': 'cloudHd',
            'fullhdvideo': 'cloudFullhd',
            '2kvideo': 'cloud2k',
            '2k+video': 'cloud2kplus',
            '2kplusvideo': 'cloud2kplus',
        };
        key = map[norm(tierName)] || 'cloudAudio';
    } else if (recordingType === 'web') {
        const map = {
            'audio': 'webHd', // Audio falls back to HD pricing
            'hdvideo': 'webHd',
            'fullhdvideo': 'webFullhd',
            '2kvideo': 'webFullhd', // 2K falls back to Full HD pricing
            '2k+video': 'webFullhd', // 2K+ falls back to Full HD pricing
            '2kplusvideo': 'webFullhd',
        };
        key = map[norm(tierName)] || 'webHd';
    }
    return tierDiscounts[key] || 0;
} 

// Add jsPDF and html2canvas script tags if not present
if (!document.getElementById('jspdf-script')) {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.id = 'jspdf-script';
    document.head.appendChild(s);
}
if (!document.getElementById('html2canvas-script')) {
    var s2 = document.createElement('script');
    s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s2.id = 'html2canvas-script';
    document.head.appendChild(s2);
}

// Export to PDF logic
function setupExportPDF() {
    const btn = document.getElementById('export-pdf-btn');
    if (!btn) return;
    btn.onclick = async function() {
        const content = document.getElementById('detailsContent');
        if (!content) return;
        btn.disabled = true;
        btn.textContent = 'Exporting...';

        // Clone the content
        const clone = content.cloneNode(true);
        clone.style.maxHeight = 'none';
        clone.style.overflow = 'visible';
        clone.style.height = 'auto';
        clone.style.width = content.scrollWidth + 'px';
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        document.body.appendChild(clone);

        // Wait for jsPDF and html2canvas to load
        function waitForLibs() {
            return new Promise(resolve => {
                function check() {
                    if (window.jspdf && window.html2canvas) resolve();
                    else setTimeout(check, 100);
                }
                check();
            });
        }
        await waitForLibs();

        window.html2canvas(clone, { scale: 2, useCORS: true }).then(canvas => {
            document.body.removeChild(clone);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new window.jspdf.jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Calculate image dimensions in PDF
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * pageWidth) / canvas.width;

            let position = 0;
            let remainingHeight = imgHeight;

            // Create a temporary canvas for slicing
            const pageCanvas = document.createElement('canvas');
            const pageCtx = pageCanvas.getContext('2d');
            const pageCanvasHeight = Math.floor((pageWidth / canvas.width) * pageHeight * (canvas.height / imgHeight));
            pageCanvas.width = canvas.width;
            pageCanvas.height = Math.floor((pageHeight / imgHeight) * canvas.height);

            while (remainingHeight > 0) {
                // Calculate the source y position in the original canvas
                const sourceY = Math.floor((position / imgHeight) * canvas.height);
                // Clear and draw the slice
                pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
                pageCtx.drawImage(
                    canvas,
                    0, sourceY, canvas.width, pageCanvas.height,
                    0, 0, canvas.width, pageCanvas.height
                );
                const pageImgData = pageCanvas.toDataURL('image/png');
                if (position === 0) {
                    pdf.addImage(pageImgData, 'PNG', 0, 0, imgWidth, pageHeight, '', 'FAST');
                } else {
                    pdf.addPage();
                    pdf.addImage(pageImgData, 'PNG', 0, 0, imgWidth, pageHeight, '', 'FAST');
                }
                position += pageHeight;
                remainingHeight -= pageHeight;
            }

            pdf.save('CostDetails.pdf');
            btn.disabled = false;
            btn.textContent = 'Export to PDF';
        });
    };
}

// Update main recording discount field state when advanced recording is toggled
function updateMainRecordingDiscountFieldState() {
    const recordingDiscountInput = document.getElementById("recording-discount");
    if (!recordingDiscountInput) return;
    if (advancedRecordingDiscountsEnabled) {
        recordingDiscountInput.disabled = true;
        recordingDiscountInput.style.opacity = "0.5";
        recordingDiscountInput.style.backgroundColor = "#f5f5f5";
    } else {
        recordingDiscountInput.disabled = false;
        recordingDiscountInput.style.opacity = "1";
        recordingDiscountInput.style.backgroundColor = "";
    }
}
// Call this in toggleRecordingDiscounts
const origToggleRecordingDiscounts = toggleRecordingDiscounts;
toggleRecordingDiscounts = function() {
    origToggleRecordingDiscounts.apply(this, arguments);
    updateMainRecordingDiscountFieldState();
};
// Also call on page load in case advanced is already checked
setTimeout(updateMainRecordingDiscountFieldState, 100); 

// Helper for rounding up to nearest cent
function ceil2(val) { return Math.ceil(val * 100) / 100; }

// --- Advanced Tiered Discount Calculation Helper ---
function calculateTieredRTCDiscountBreakdown(totalMinutes, sessionsPerMonth, tiers, discounts) {
    // totalMinutes: total RTC/AINS minutes for the month (per resolution)
    // sessionsPerMonth: number of sessions per month
    // tiers: [{from, to}, ...] in thousands of minutes
    // discounts: array of discounts per tier
    // Returns: [{tierIdx, from, to, minutes, discount, cost, baseRate}]
    let breakdown = [];
    let minutesLeft = totalMinutes;
    let prevTo = 0;
    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const from = (typeof tier.from === 'number' ? tier.from : parseInt(tier.from, 10) || 0) * 1000;
        let to = tier.to === '' ? Infinity : (typeof tier.to === 'number' ? tier.to : parseInt(tier.to, 10) || 0) * 1000;
        if (to <= from) to = Infinity;
        const tierMinutes = Math.max(0, Math.min(minutesLeft, to - from));
        if (tierMinutes > 0) {
            breakdown.push({
                tierIdx: i,
                from,
                to,
                minutes: tierMinutes,
                discount: discounts[i] || 0,
                // baseRate will be filled in by caller
            });
            minutesLeft -= tierMinutes;
        }
        if (minutesLeft <= 0) break;
    }
    return breakdown;
}

// --- BS Tiered Discount Structure Logic ---
const DEFAULT_BS_TIERS = [
    { from: 0, to: 20 },
    { from: 20, to: '' }
];
const BS_RESOLUTIONS = [
    { key: 'audio', label: 'Audio Only' },
    { key: 'hd', label: 'HD Video' },
    { key: 'fullhd', label: 'Full HD Video' },
    { key: '2k', label: '2K Video' },
    { key: '2kplus', label: '2K+ Video' }
];
function getSavedBSTieredDiscounts() {
    try {
        return JSON.parse(localStorage.getItem('bsTieredDiscounts')) || null;
    } catch (e) { return null; }
}
function saveBSTieredDiscounts(data) {
    localStorage.setItem('bsTieredDiscounts', JSON.stringify(data));
}
function getBSTieredDiscountState() {
    let state = getSavedBSTieredDiscounts();
    if (!state) {
        state = {
            sessionsPerMonth: 1,
            tiers: JSON.parse(JSON.stringify(DEFAULT_BS_TIERS)),
            discounts: {}
        };
        BS_RESOLUTIONS.forEach(res => {
            state.discounts[res.key] = [0, 0];
        });
    }
    return state;
}
function renderBSTieredDiscountUI() {
    const state = getBSTieredDiscountState();
    // Only set value if the input exists (since the sessions field was removed)
    const bsSessionsInput = document.getElementById('bs-sessions-per-month');
    if (bsSessionsInput) bsSessionsInput.value = state.sessionsPerMonth;
    const tbody = document.getElementById('bs-tier-table-body');
    tbody.innerHTML = '';
    state.tiers.forEach((tier, i) => {
        let showRemove = false;
        if (state.tiers.length > 2) {
            // Only show remove on tiers 3+ (index 2 and above)
            showRemove = (i >= 2);
        }
        const tr = document.createElement('tr');
        tr.innerHTML =
            `<td>${i + 1}</td>` +
            `<td><input type="number" min="0" value="${tier.from}" style="width:90px" disabled /></td>` +
            `<td><input type="number" min="0" value="${tier.to !== '' ? tier.to : ''}" style="width:90px" ${i === state.tiers.length - 1 ? 'disabled placeholder="∞"' : ''} onchange="updateBSTierTo(${i}, this.value)" /></td>` +
            `<td>${showRemove ? `<button type='button' onclick='removeBSTier(${i})' style='background:#e53e3e;color:white;border:none;padding:2px 6px;border-radius:3px;cursor:pointer;'>×</button>` : ''}</td>`;
        tbody.appendChild(tr);
    });
    // Resolution discount table
    const thead = document.querySelector('#bs-resolution-discount-table thead tr');
    while (thead.children.length > 1) thead.removeChild(thead.lastChild);
    state.tiers.forEach((tier, i) => {
        const th = document.createElement('th');
        th.textContent = `Tier ${i + 1} (%)`;
        thead.appendChild(th);
    });
    BS_RESOLUTIONS.forEach(res => {
        const tr = document.querySelector(`#bs-resolution-discount-table tr[data-res='${res.key}']`);
        if (!tr) return;
        while (tr.children.length > 1) tr.removeChild(tr.lastChild);
        for (let i = 0; i < state.tiers.length; i++) {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'number';
            input.min = 0;
            input.max = 100;
            input.className = 'text-input';
            input.style.width = '70px';
            input.value = (state.discounts[res.key] && typeof state.discounts[res.key][i] !== 'undefined') ? state.discounts[res.key][i] : 0;
            input.onchange = function() { updateBSResolutionDiscount(res.key, i, this.value); };
            td.appendChild(input);
            tr.appendChild(td);
        }
    });
}
function updateBSTierTo(index, value) {
    let state = getBSTieredDiscountState();
    value = value === '' ? '' : parseInt(value, 10) || 0;
    state.tiers[index].to = value;
    if (state.tiers[index + 1]) {
        state.tiers[index + 1].from = value;
    }
    saveBSTieredDiscounts(state);
    renderBSTieredDiscountUI();
}
function removeBSTier(index) {
    let state = getBSTieredDiscountState();
    if (state.tiers.length <= 2) return;
    state.tiers.splice(index, 1);
    for (let i = 1; i < state.tiers.length; i++) {
        state.tiers[i].from = state.tiers[i - 1].to;
    }
    // If we just removed the last tier, set the new last tier's 'to' to blank (infinity)
    if (state.tiers.length > 0) {
        state.tiers[state.tiers.length - 1].to = '';
    }
    BS_RESOLUTIONS.forEach(res => {
        if (state.discounts[res.key]) state.discounts[res.key].splice(index, 1);
    });
    saveBSTieredDiscounts(state);
    renderBSTieredDiscountUI();
}
function updateBSResolutionDiscount(resKey, tierIdx, value) {
    let state = getBSTieredDiscountState();
    if (!state.discounts[resKey]) state.discounts[resKey] = [];
    state.discounts[resKey][tierIdx] = parseFloat(value) || 0;
    saveBSTieredDiscounts(state);
}
document.getElementById('add-bs-tier-btn').onclick = function() {
    let state = getBSTieredDiscountState();
    const last = state.tiers[state.tiers.length - 1];
    let newFrom;
    if (last.to !== '' && !isNaN(Number(last.to))) {
        newFrom = Number(last.to) + 10;
        state.tiers[state.tiers.length - 1].to = Number(last.to) + 10;
    } else {
        newFrom = Number(last.from) + 10;
        state.tiers[state.tiers.length - 1].to = newFrom;
    }
    state.tiers.push({ from: newFrom, to: '' });
    // Add default discounts for new tier using master discount
    const masterDiscount = parseFloat(document.getElementById("master-discount")?.value) || 0;
    BS_RESOLUTIONS.forEach(res => {
        if (!state.discounts[res.key]) state.discounts[res.key] = [];
        state.discounts[res.key].push(masterDiscount);
    });
    saveBSTieredDiscounts(state);
    renderBSTieredDiscountUI();
};
// Only set onchange if the input exists (since the sessions field was removed)
const bsSessionsInput = document.getElementById('bs-sessions-per-month');
if (bsSessionsInput) {
    bsSessionsInput.onchange = function() {
        let state = getBSTieredDiscountState();
        state.sessionsPerMonth = parseInt(this.value, 10) || 1;
        saveBSTieredDiscounts(state);
    };
}
// Render on modal open
const origOpenAdvancedDiscountsBS = window.openAdvancedDiscounts;
window.openAdvancedDiscounts = function() {
    origOpenAdvancedDiscountsBS();
    renderTieredDiscountUI();
    renderBSTieredDiscountUI();
};

// Utility to get sessions per month from advanced modal
function getSessionsPerMonth() {
    const state = getTieredDiscountState();
    return state.sessionsPerMonth || 1;
}
function getBSSessionsPerMonth() {
    return getSessionsPerMonth();
}

// Helper function to check if tiered discounts should be used
function shouldUseTieredDiscounts(isBroadcastStreaming = false) {
    if (!advancedDiscountsEnabled) return false;
    
    const checkboxId = isBroadcastStreaming ? "use-bs-tiered-discounts" : "use-tiered-discounts";
    const checkbox = document.getElementById(checkboxId);
    return checkbox ? checkbox.checked : false;
}

// 1. Sync BS tiered checkbox with RTC tiered checkbox when BS is checked and advanced discounts are enabled
const bsAudienceCheckbox = document.getElementById('bs-audience');
if (bsAudienceCheckbox) {
    bsAudienceCheckbox.addEventListener('change', function() {
        if (advancedDiscountsEnabled) {
            const rtcTiered = document.getElementById('use-tiered-discounts');
            const bsTiered = document.getElementById('use-bs-tiered-discounts');
            if (rtcTiered && bsTiered) {
                if (rtcTiered.checked) {
                    bsTiered.checked = true;
                    toggleBSTieredDiscounts();
                } else {
                    bsTiered.checked = false;
                    toggleBSTieredDiscounts();
                }
            }
        }
    });
}

// 2. In calculatePricing, ensure BS uses individual discount fields if BS tiered is not checked, even if RTC is tiered
// (This logic is already handled by shouldUseTieredDiscounts(bsAudience) in getDiscountForTier, but double-check)
// No code change needed here, as getDiscountForTier already checks the correct box.

// Export to PDF and CSV logic
function setupExportExportButtons() {
    // CSV Export
    const csvBtn = document.getElementById('export-csv-btn');
    if (csvBtn) {
        csvBtn.onclick = function() {
            const content = document.getElementById('detailsContent');
            if (!content) return;
            let csvRows = [];
            // For each .detail-section, output heading, items, and any tables inside
            const sections = content.querySelectorAll('.detail-section');
            sections.forEach(section => {
                const header = section.querySelector('h4');
                if (header) {
                    csvRows.push([header.textContent]);
                }
                const items = section.querySelectorAll('.detail-item');
                items.forEach(item => {
                    const label = item.querySelector('.detail-label');
                    const value = item.querySelector('.detail-value');
                    if (label && value) {
                        csvRows.push([label.textContent.trim(), value.textContent.trim()]);
                    } else if (label) {
                        csvRows.push([label.textContent.trim()]);
                    }
                });
                // Output all tables in this section
                const tables = section.querySelectorAll('table');
                tables.forEach(table => {
                    // Table caption (if any)
                    if (table.caption && table.caption.textContent) {
                        csvRows.push([table.caption.textContent]);
                    }
                    // Table headers (only once)
                    let headerRow = [];
                    const thead = table.querySelector('thead');
                    if (thead) {
                        headerRow = Array.from(thead.querySelectorAll('th,td')).map(cell => cell.textContent.trim());
                        if (headerRow.length > 0) {
                            const prevRow = csvRows.length > 0 ? csvRows[csvRows.length - 1] : null;
                            if (!(headerRow.length > 2 && prevRow && prevRow.length === headerRow.length && prevRow.every((v, i) => v === headerRow[i]))) {
                                csvRows.push(headerRow);
                            }
                        }
                    } else {
                        // If no thead, use first row as header
                        const firstRow = table.querySelector('tr');
                        if (firstRow) {
                            headerRow = Array.from(firstRow.querySelectorAll('th,td')).map(cell => cell.textContent.trim());
                            if (headerRow.length > 0) {
                                const prevRow = csvRows.length > 0 ? csvRows[csvRows.length - 1] : null;
                                if (!(headerRow.length > 2 && prevRow && prevRow.length === headerRow.length && prevRow.every((v, i) => v === headerRow[i]))) {
                                    csvRows.push(headerRow);
                                }
                            }
                        }
                    }
                    // Table body rows (skip header if already output)
                    const rows = table.querySelectorAll('tbody tr');
                    if (rows.length > 0) {
                        rows.forEach(row => {
                            const cells = Array.from(row.querySelectorAll('td,th')).map(cell => cell.textContent.trim());
                            const prevRow = csvRows.length > 0 ? csvRows[csvRows.length - 1] : null;
                            if (!(cells.length > 2 && prevRow && prevRow.length === cells.length && prevRow.every((v, i) => v === cells[i]))) {
                                csvRows.push(cells);
                            }
                        });
                    } else {
                        // If no tbody, get all tr except first (header)
                        const allRows = table.querySelectorAll('tr');
                        allRows.forEach((row, idx) => {
                            if (idx === 0) return; // skip header
                            const cells = Array.from(row.querySelectorAll('td,th')).map(cell => cell.textContent.trim());
                            if (cells.length > 0) {
                                const prevRow = csvRows.length > 0 ? csvRows[csvRows.length - 1] : null;
                                if (!(cells.length > 2 && prevRow && prevRow.length === cells.length && prevRow.every((v, i) => v === cells[i]))) {
                                    csvRows.push(cells);
                                }
                            }
                        });
                    }
                    // Blank line after each table
                    csvRows.push(['']);
                });
                // Add a blank line between sections
                csvRows.push(['']);
            });
            // Convert to CSV string
            const csvContent = csvRows.map(row => row.map(cell => '"' + cell.replace(/"/g, '""') + '"').join(',')).join('\r\n');
            // Download
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'CostDetails.csv';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        };
    }
}
// ... existing code ...