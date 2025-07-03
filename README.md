# Agora SDK Pricing Calculator

## Overview

This project is a comprehensive pricing calculator for estimating the cost of using Agora SDK for video streaming. It supports both Interactive Live Streaming and Broadcast Streaming pricing models, with detailed cost breakdowns and tier visualizations.

> **Disclaimer:** This is not an official calculator and may provide incorrect estimates. This will overestimate the host cost.

## Features

### Core Functionality
- **Multiple Hosts**: Add or remove hosts and choose different resolutions (120p, 360p, 480p, 540p, 720p, 1080p, 4K)
- **Audience Management**: Specify audience count with option for Broadcast Streaming pricing
- **Duration-based Calculation**: Calculate costs based on streaming duration in minutes
- **Dual Discount System**: Separate discounts for RTC/AINS and recording services

### Advanced Features
- **Screenshare Support**: Enable screenshare with configurable resolution
- **Cloud Recording**: Calculate cloud recording costs based on aggregate resolution
- **Web Page Recording**: Support for 720p and 1080p web page recording
- **AINS (AI Noise Suppression)**: Additional cost for AI-powered noise suppression (applied to hosts only)
- **Broadcast Streaming**: Toggle between Interactive Live Streaming and Broadcast Streaming for audience pricing

### Detailed Breakdowns
- **Cost Details Popup**: Comprehensive breakdown showing:
  - Individual host costs and subscriptions
  - Audience cost with pricing mode
  - Additional services (recording, AINS)
  - Discount calculations
  - Final cost summary
- **Tier Breakdown Visualization**: Progress bars showing usage across HD, Full HD, 2K, and 2K+ tiers
- **Real-time Tier Information**: Current tier status and usage percentages

## File Structure

```
Audience-Pricing-Calculator/
├── index.html          # Main HTML file
├── style.css           # All CSS styles
├── script.js           # All JavaScript functionality
└── README.md           # This file
```

## Usage

1. **Clone or download** the repository
2. **Open `index.html`** in your web browser
3. **Add hosts** using the "Add Host" button and select their resolutions
4. **Configure audience**:
   - Enter the number of audience members
   - Optionally enable Broadcast Streaming pricing
5. **Set duration** in minutes
6. **Enable optional features**:
   - Screenshare with resolution selection
   - AINS (AI Noise Suppression)
   - Cloud Recording
   - Web Page Recording with resolution selection
7. **Apply discounts** (optional):
   - RTC/AINS discount percentage
   - Recording discount percentage
8. **Calculate** by clicking the "Calculate" button
9. **View details** using:
   - "Show Cost Details" for comprehensive breakdown
   - "Show Tier Breakdown" for tier visualization

## Pricing Models

### Interactive Live Streaming (Default)
- Host-to-host communication
- Audience subscribes to all hosts
- Standard Agora pricing tiers

### Broadcast Streaming (Optional)
- Lower cost for audience members
- Same host-to-host pricing
- Different audience pricing table

## Technical Details

### Resolution Tiers
- **HD**: ≤ 921,600 pixels ($3.99/1,000 min)
- **Full HD**: 921,601 - 2,073,600 pixels ($8.99/1,000 min)
- **2K**: 2,073,601 - 3,686,400 pixels ($15.99/1,000 min)
- **2K+**: > 3,686,400 pixels ($35.99/1,000 min)

### Additional Services
- **Cloud Recording**: Based on aggregate resolution
- **Web Page Recording**: $14/1,000 min (720p) or $28/1,000 min (1080p)
- **AINS**: $0.59/1,000 min per host
- **Screenshare Audio**: $0.99/1,000 min

## Browser Compatibility

This calculator works in all modern browsers that support:
- ES6 JavaScript features
- CSS Grid and Flexbox
- HTML5 form elements

## Contributing

Feel free to open issues for bugs or feature requests. Pull requests are welcome!

---

Enjoy using the Agora SDK Pricing Calculator! For official pricing information, please refer to [Agora's official documentation](https://docs.agora.io/en/Interactive%20Broadcast/billing_rtc).
