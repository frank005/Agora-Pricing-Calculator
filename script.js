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
    webRecording: 0
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

    const hostEntries = document.querySelectorAll(".host-entry");
    hostEntries.forEach((entry) => {
        const select = entry.querySelector("select");
        const resolution = select.value;
        let resolutionPixels = 0;
        switch (resolution) {
            case "120p":
                resolutionPixels = 160 * 120;
                break;
            case "360p":
                resolutionPixels = 640 * 360;
                break;
            case "480p":
                resolutionPixels = 640 * 480;
                break;
            case "540p":
                resolutionPixels = 960 * 540;
                break;
            case "720p":
                resolutionPixels = 1280 * 720;
                break;
            case "1080p":
                resolutionPixels = 1920 * 1080;
                break;
            case "4k":
                resolutionPixels = 3840 * 2160;
                break;
        }
        aggregatedResolution += resolutionPixels;
        // Audience subscribes to all hosts
        audienceAggregatedResolution += resolutionPixels;
    });

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
    audienceDetails = {
        count: audience,
        aggregatePixels: audienceAggregatedResolution,
        tierName: audienceAggregatedResolution > 3686400 ? "2K+ Video" :
                  audienceAggregatedResolution > 2073600 ? "2K Video" :
                  audienceAggregatedResolution > 921600 ? "Full HD Video" :
                  audienceAggregatedResolution > 0 ? "HD Video" : "Audio",
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
            let hostPricingTier = 0.99; // Default to audio
            let tierName = "Audio";
            if (hostAggregatedPixels > 3686400) {
                hostPricingTier = 35.99; // 2K+
                tierName = "2K+ Video";
            } else if (hostAggregatedPixels > 2073600) {
                hostPricingTier = 15.99; // 2K
                tierName = "2K Video";
            } else if (hostAggregatedPixels > 921600) {
                hostPricingTier = 8.99; // Full HD
                tierName = "Full HD Video";
            } else if (hostAggregatedPixels > 0) {
                hostPricingTier = 3.99; // HD
                tierName = "HD Video";
            }
            
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
    hostEntries.forEach((entry) => {
        const select = entry.querySelector("select");
        const resolution = select.value;
        switch (resolution) {
            case "120p":
                audienceAggregatedResolution += 160 * 120;
                break;
            case "360p":
                audienceAggregatedResolution += 640 * 360;
                break;
            case "480p":
                audienceAggregatedResolution += 640 * 480;
                break;
            case "540p":
                audienceAggregatedResolution += 960 * 540;
                break;
            case "720p":
                audienceAggregatedResolution += 1280 * 720;
                break;
            case "1080p":
                audienceAggregatedResolution += 1920 * 1080;
                break;
            case "4k":
                audienceAggregatedResolution += 3840 * 2160;
                break;
        }
    });
    if (screenshareEnabled) {
        switch (participantResolution) {
            case "120p":
                audienceAggregatedResolution += 160 * 120;
                break;
            case "360p":
                audienceAggregatedResolution += 640 * 360;
                break;
            case "480p":
                audienceAggregatedResolution += 640 * 480;
                break;
            case "540p":
                audienceAggregatedResolution += 960 * 540;
                break;
            case "720p":
                audienceAggregatedResolution += 1280 * 720;
                break;
            case "1080p":
                audienceAggregatedResolution += 1920 * 1080;
                break;
            case "4k":
                audienceAggregatedResolution += 3840 * 2160;
                break;
        }
    }

    const totalCost = totalHostCalculation + audienceCost;
    
    // Cloud recording cost based on aggregate resolution of all participants
    let cloudRecordingCost = 0;
    if (cloudRecordingEnabled) {
        // Calculate total aggregate resolution for cloud recording
        const totalAggregateResolution = hostAggregatedResolution + audienceAggregatedResolution;
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
    if (webRecordingEnabled) {
        webRecordingCost =
            (duration / 1000) *
            (webResolution === "720p" ? 14 : 28);
    }

    const ainsCost = ainsEnabled
        ? (0.59 * (hostEntries.length * duration)) / 1000
        : 0;

    // Apply tier-based discounts for hosts and audience
    let discountedTotalCost = 0;
    let discountedAinsCost = 0;
    
    // Apply individual tier discounts to hosts
    hostDetails.forEach(host => {
        const tierDiscount = getDiscountForTier(host.tierName || 'Audio');
        const discountedHostCost = host.cost * (1 - tierDiscount / 100);
        discountedTotalCost += discountedHostCost;
        
        // Update host details with discounted cost
        host.discountedCost = discountedHostCost;
        host.discountApplied = tierDiscount;
    });
    
    // Apply individual tier discount to audience
    const audienceTierDiscount = getDiscountForTier(audienceDetails.tierName || 'Audio', bsAudience);
    const discountedAudienceCost = audienceCost * (1 - audienceTierDiscount / 100);
    discountedTotalCost += discountedAudienceCost;
    
    // Update audience details with discounted cost
    audienceDetails.discountedCost = discountedAudienceCost;
    audienceDetails.discountApplied = audienceTierDiscount;
    
    // Apply AINS discount
    if (ainsEnabled) {
        const ainsTierDiscount = advancedDiscountsEnabled ? tierDiscounts.ains : rtcDiscount;
        discountedAinsCost = ainsCost * (1 - ainsTierDiscount / 100);
    }
    
    // Validate discount percentages (allow 0-100%)
    if (rtcDiscount < 0 || rtcDiscount > 100) {
        alert("Please enter a RTC/AINS discount percentage between 0 and 100.");
        return;
    }

    // Apply recording discount
    let discountedCloudRecordingCost = cloudRecordingCost;
    let discountedWebRecordingCost = webRecordingCost;
    
    const cloudRecordingDiscount = getRecordingDiscount('cloud', audienceDetails.tierName);
    const webRecordingDiscount = getRecordingDiscount('web', audienceDetails.tierName);
    
    if (cloudRecordingDiscount >= 0 && cloudRecordingDiscount <= 100) {
        discountedCloudRecordingCost = cloudRecordingCost * (1 - cloudRecordingDiscount / 100);
    } else if (cloudRecordingDiscount < 0 || cloudRecordingDiscount > 100) {
        alert("Please enter a cloud recording discount percentage between 0 and 100.");
        return;
    }
    
    if (webRecordingDiscount >= 0 && webRecordingDiscount <= 100) {
        discountedWebRecordingCost = webRecordingCost * (1 - webRecordingDiscount / 100);
    } else if (webRecordingDiscount < 0 || webRecordingDiscount > 100) {
        alert("Please enter a web recording discount percentage between 0 and 100.");
        return;
    }

    let finalCost = discountedTotalCost + discountedCloudRecordingCost + discountedWebRecordingCost + discountedAinsCost;

    // 1. Add screenshare audio cost to totalHostCalculation and finalCost
    let screenshareAudioCost = 0;
    if (screenshareEnabled) {
        screenshareAudioCost = (duration / 1000) * 0.99;
        totalHostCalculation += screenshareAudioCost;
    }

    // Logging costs and stuff
    console.log("Host Aggregate Resolution: " + hostAggregatedResolution);
    console.log("Audience Aggregate Resolution: " + audienceAggregatedResolution);
    console.log("Host Pricing Tier: " + pricingTier);
    console.log("Audience Pricing Tier: " + audiencePricingTier);
    console.log("Final Cost: " + finalCost);
    console.log("Total Host Calculation: " + totalHostCalculation);
    console.log("Total Cost: " + totalCost);
    console.log("Discounted Total Cost: " + discountedTotalCost);
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

    let resultHTML = `<p>Aggregate Resolution Tier: ${audienceDetails.tierName}</p>`;
    resultHTML += `<p>Audience Pricing Mode: ${audiencePricingMode}</p>`;
    resultHTML += `<p>Estimated Cost: $${finalCost.toFixed(2)}</p>`;
    
    document.getElementById("result").innerHTML = resultHTML;

    // Store total breakdown
    totalBreakdown = {
        totalHostCost: totalHostCalculation,
        totalAudienceCost: audienceCost,
        cloudRecordingCost: cloudRecordingCost,
        webRecordingCost: webRecordingCost,
        ainsCost: ainsCost,
        totalCost: totalCost,
        finalCost: finalCost,
        duration: duration,
        rtcDiscount: rtcDiscount,
        recordingDiscount: recordingDiscount,
        screenshareEnabled: screenshareEnabled,
        screenshareResolution: participantResolution,
        totalAggregateResolution: hostAggregatedResolution + audienceAggregatedResolution
    };
}

function showDetails() {
    if (hostDetails.length === 0 && !audienceDetails.count) {
        alert("Please calculate pricing first to see details.");
        return;
    }

    let content = '<div class="detail-section">';
    content += '<h4>Host Breakdown</h4>';
    
    hostDetails.forEach((host, index) => {
        const originalCost = host.cost;
        const discountedCost = host.discountedCost || originalCost;
        const discountApplied = host.discountApplied || 0;
        
        content += `<div class="detail-item">
            <span class="detail-label">${host.name} (${host.resolution})</span>
            <span class="detail-value">$${discountedCost.toFixed(2)}</span>
        </div>`;
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
            <span class="detail-label">Aggregate: ${host.aggregatePixels.toLocaleString()} px (${host.tierName})</span>
            <span class="detail-value">$${host.pricingTier}/1,000 min</span>
        </div>`;
        if (discountApplied > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
                <span class="detail-label">Discount Applied: ${discountApplied}%</span>
                <span class="detail-value">-$${(originalCost - discountedCost).toFixed(2)}</span>
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
    const originalAudienceCost = audienceDetails.cost;
    const discountedAudienceCost = audienceDetails.discountedCost || originalAudienceCost;
    const audienceDiscountApplied = audienceDetails.discountApplied || 0;
    
    content += `<div class="detail-item">
        <span class="detail-label">Audience Members (${audienceDetails.count})</span>
        <span class="detail-value">$${discountedAudienceCost.toFixed(2)}</span>
    </div>`;
    content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
        <span class="detail-label">Aggregate: ${audienceDetails.aggregatePixels.toLocaleString()} px (${audienceDetails.tierName})</span>
        <span class="detail-value">$${audienceDetails.pricingTier}/1,000 min (${audienceDetails.pricingMode})</span>
    </div>`;
    if (audienceDiscountApplied > 0) {
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
            <span class="detail-label">Discount Applied: ${audienceDiscountApplied}%</span>
            <span class="detail-value">-$${(originalAudienceCost - discountedAudienceCost).toFixed(2)}</span>
        </div>`;
    }
    
    // Add screenshare information if enabled
    if (totalBreakdown.screenshareEnabled) {
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
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
        const webDiscount = getRecordingDiscount('web', audienceDetails.tierName);
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
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
            <span class="detail-label">Applied to: ${hostDetails.length} hosts</span>
            <span class="detail-value">$0.59/1,000 min per host</span>
        </div>`;
        if (ainsDiscountApplied > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #28a745;">
                <span class="detail-label">Discount Applied: ${ainsDiscountApplied}%</span>
                <span class="detail-value">-$${(originalAinsCost - discountedAinsCost).toFixed(2)}</span>
            </div>`;
        }
    }
    
    if (totalBreakdown.cloudRecordingCost === 0 && totalBreakdown.webRecordingCost === 0 && totalBreakdown.ainsCost === 0) {
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

    // Calculate discounted totals
    const summaryDiscountedHostCost = floor2(hostDetails.reduce((sum, host) => sum + (host.discountedCost || host.cost), 0));
    const summaryOriginalHostCost = floor2(hostDetails.reduce((sum, host) => sum + (host.cost || 0), 0));
    const summaryDiscountedAudienceCost = floor2(audienceDetails.discountedCost || audienceDetails.cost);
    const summaryOriginalAudienceCost = floor2(audienceDetails.cost);
    const summaryOriginalCloudCost = floor2(totalBreakdown.cloudRecordingCost || 0);
    const summaryDiscountedCloudCost = (totalBreakdown.cloudRecordingCost > 0) ? (function() { const d = getRecordingDiscount('cloud', audienceDetails.tierName || 'Audio'); return floor2(summaryOriginalCloudCost * (1 - d / 100)); })() : 0;
    const summaryOriginalWebCost = floor2(totalBreakdown.webRecordingCost || 0);
    const summaryDiscountedWebCost = (totalBreakdown.webRecordingCost > 0) ? (function() { const d = getRecordingDiscount('web', audienceDetails.tierName || 'Audio'); return floor2(summaryOriginalWebCost * (1 - d / 100)); })() : 0;
    const summaryOriginalAinsCost = floor2(totalBreakdown.ainsCost || 0);
    const summaryDiscountedAinsCost = (totalBreakdown.ainsCost > 0) ? (function() { const d = advancedDiscountsEnabled ? tierDiscounts.ains : totalBreakdown.rtcDiscount; return floor2(summaryOriginalAinsCost * (1 - d / 100)); })() : 0;
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

    content += `<div class="detail-item"><span class="detail-label">Host Cost</span><span class="detail-value">$${summaryOriginalHostCost.toFixed(2)}</span></div>`;
    if (summaryOriginalHostCost !== summaryDiscountedHostCost) {
        content += `<div class="detail-item" style="padding-left: 20px; color: #28a745;"><span class="detail-label">Host Discount</span><span class="detail-value">-$${(summaryOriginalHostCost-summaryDiscountedHostCost).toFixed(2)}</span></div>`;
    }
    content += `<div class="detail-item" style="padding-left: 20px;"><span class="detail-label">Host Final</span><span class="detail-value">$${summaryDiscountedHostCost.toFixed(2)}</span></div>`;

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
    // Screenshare audio breakdown
    if (totalBreakdown.screenshareEnabled) {
        content += `<div class="detail-item"><span class="detail-label">Screenshare Audio</span><span class="detail-value"></span></div>`;
        if (screenshareAudioDiscount > 0) {
            content += `<div class="detail-item" style="padding-left: 20px; color: #28a745;"><span class="detail-label">Screenshare Discount</span><span class="detail-value">-$${screenshareAudioDiscount.toFixed(2)}</span></div>`;
        }
        content += `<div class="detail-item" style="padding-left: 20px;"><span class="detail-label">Screenshare Final</span><span class="detail-value">$${screenshareAudioDiscounted.toFixed(2)}</span></div>`;
    }
    content += `<div class="detail-item" style="font-weight:bold;"><span class="detail-label">Final Cost</span><span class="detail-value">$${totalBreakdown.finalCost.toFixed(2)}</span></div>`;

    content += '</div>';

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
}

function closeDetails() {
    document.getElementById('detailsPopup').style.display = 'none';
}

function showAudienceBreakdown() {
    let content = '<div class="detail-section">';
    content += '<h4>Audience Tier Breakdown</h4>';
    content += `<div class="detail-item">
        <span class="detail-label">Audience Members (${audienceDetails.count})</span>
        <span class="detail-value">$${audienceDetails.cost.toFixed(2)}</span>
    </div>`;
    content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
        <span class="detail-label">Aggregate: ${audienceDetails.aggregatePixels.toLocaleString()} px (${audienceDetails.tierName})</span>
        <span class="detail-value">$${audienceDetails.pricingTier}/1,000 min (${audienceDetails.pricingMode})</span>
    </div>`;
    
    // Add screenshare information if enabled
    if (totalBreakdown.screenshareEnabled) {
        content += `<div class="detail-item" style="padding-left: 20px; font-size: 12px; color: #666;">
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
    
    updateTierDiscounts(); // Initialize tier discounts with master discount
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
    // Always set all RTC tier fields to the master value
    const discountInputs = [
        'audio-discount', 'hd-discount', 'fullhd-discount', '2k-discount', '2kplus-discount',
        'ains-discount', 'bs-audio-discount', 'bs-hd-discount', 'bs-fullhd-discount', 
        'bs-2k-discount', 'bs-2kplus-discount'
    ];
    discountInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.value = masterDiscount;
        }
    });
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
    // Normalize tier name
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9+]/g, "");
    const tierMap = {
        'audio': isBroadcastStreaming ? 'bsAudio' : 'audio',
        'hdvideo': isBroadcastStreaming ? 'bsHd' : 'hd',
        'fullhdvideo': isBroadcastStreaming ? 'bsFullhd' : 'fullhd',
        '2kvideo': isBroadcastStreaming ? 'bs2k' : '2k',
        '2k+video': isBroadcastStreaming ? 'bs2kplus' : '2kplus',
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
        const content = document.querySelector('#detailsContent');
        if (!content) return;
        btn.disabled = true;
        btn.textContent = 'Exporting...';
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
        window.html2canvas(content, {scale:2}).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new window.jspdf.jsPDF({orientation: 'p', unit: 'pt', format: 'a4'});
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            // Fit image to page width
            const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
            const imgWidth = canvas.width * ratio;
            const imgHeight = canvas.height * ratio;
            pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
            pdf.save('CostDetails.pdf');
            btn.disabled = false;
            btn.textContent = 'Export to PDF';
        });
    };
}
// Call setupExportPDF whenever the modal is shown
const origShowDetails = showDetails;
showDetails = function() {
    origShowDetails.apply(this, arguments);
    setTimeout(setupExportPDF, 100);
}; 

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