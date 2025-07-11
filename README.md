# Agora SDK Pricing Calculator

## Overview

This project is a comprehensive pricing calculator for estimating the cost of using Agora SDK for video streaming. It supports both Interactive Live Streaming and Broadcast Streaming pricing models, with detailed cost breakdowns, tier visualizations, and advanced discount controls.

> **Disclaimer:** This is not an official calculator and may provide incorrect estimates. This will overestimate the host cost.

## Features

### Core Functionality
- **Multiple Hosts**: Add or remove hosts and choose different resolutions (120p, 360p, 480p, 540p, 720p, 1080p, 4K)
- **Audience Management**: Specify audience count with option for Broadcast Streaming pricing
- **Duration-based Calculation**: Calculate costs based on streaming duration in minutes
- **Dual Discount System**: Separate discounts for RTC/AINS and recording services

### Advanced Features
- **Screenshare Support**: Enable screenshare with configurable resolution (120p, 360p, 480p, 540p, 720p, 1080p, 4K)
- **Cloud Recording**: Calculate cloud recording costs based on aggregate resolution
- **Web Page Recording**: Support for 720p and 1080p web page recording
- **AINS (AI Noise Suppression)**: Additional cost for AI-powered noise suppression (applied to hosts only)
- **Broadcast Streaming**: Toggle between Interactive Live Streaming and Broadcast Streaming for audience pricing
- **Real-Time Speech-To-Text (Transcription)**: Support for multiple languages with configurable language count
- **Translation Services**: Real-time translation with support for multiple target languages
- **Advanced Discount Controls**: Comprehensive discount management system

### Advanced Discount Controls
- **Master Discount**: Set a master discount applied to all RTC tiers by default
- **Tiered Discount Structure**: Volume-based discounts for different usage tiers
  - Configurable number of sessions per month
  - Dynamic tier creation and management
  - Per-resolution discount rates for each tier
- **Individual Resolution Discounts**: Flat discounts for each resolution tier
- **Broadcast Streaming Discounts**: Separate discount structure for broadcast streaming
- **Additional Services Discounts**: 
  - AINS discount
  - Transcription and translation discounts
  - Advanced recording discounts (cloud and web page recording)

### Detailed Breakdowns & Export
- **Cost Details Popup**: Comprehensive breakdown showing:
  - Individual host costs and subscriptions
  - Audience cost with pricing mode
  - Additional services (recording, AINS, transcription, translation)
  - Discount calculations
  - Final cost summary
- **Tier Breakdown Visualization**: Progress bars showing usage across HD, Full HD, 2K, and 2K+ tiers
- **Real-time Tier Information**: Current tier status and usage percentages
- **Export Functionality**: 
  - Export detailed cost breakdown to PDF
  - Export cost details to CSV format

## File Structure

```
Audience-Pricing-Calculator/
├── index.html          # Main HTML file with all UI components
├── style.css           # All CSS styles and responsive design
├── script.js           # All JavaScript functionality and calculations
└── README.md           # This file
```

## Usage

### Basic Usage
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
   - Real-Time Speech-To-Text with language count
   - Translation with target language count
7. **Apply discounts** (optional):
   - RTC/AINS discount percentage
   - Recording discount percentage
8. **Calculate** by clicking the "Calculate" button
9. **View details** using:
   - "Show Cost Details" for comprehensive breakdown
   - "Show Tier Breakdown" for tier visualization

### Advanced Discount Configuration
1. **Enable Advanced Discount Controls** by checking the checkbox
2. **Click "Configure"** to open the advanced discount modal
3. **Set Master Discount** for all RTC tiers
4. **Configure Tiered Discounts**:
   - Set number of sessions per month
   - Add/remove tiers as needed
   - Set discount percentages for each resolution per tier
5. **Configure Individual Discounts** for each resolution tier
6. **Set Broadcast Streaming Discounts** (when broadcast streaming is enabled)
7. **Configure Additional Services Discounts**:
   - AINS discount
   - Transcription and translation discounts
   - Advanced recording discounts
8. **Save Discounts** to apply the configuration

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
- **Audio Only**: $0.99/1,000 min
- **HD**: ≤ 921,600 pixels ($3.99/1,000 min)
- **Full HD**: 921,601 - 2,073,600 pixels ($8.99/1,000 min)
- **2K**: 2,073,601 - 3,686,400 pixels ($15.99/1,000 min)
- **2K+**: > 3,686,400 pixels ($35.99/1,000 min)

### Broadcast Streaming Tiers
- **Audio Only**: $0.59/1,000 min
- **HD**: ≤ 921,600 pixels ($1.99/1,000 min)
- **Full HD**: 921,601 - 2,073,600 pixels ($4.59/1,000 min)
- **2K**: 2,073,601 - 3,686,400 pixels ($7.99/1,000 min)
- **2K+**: > 3,686,400 pixels ($17.99/1,000 min)

### Additional Services
- **Cloud Recording**: Based on aggregate resolution
  - Audio Only: $1.49/1,000 min
  - HD Video: $5.99/1,000 min
  - Full HD Video: $13.49/1,000 min
  - 2K Video: $23.99/1,000 min
  - 2K+ Video: $53.99/1,000 min
- **Web Page Recording**: 
  - HD (720p): $14/1,000 min
  - Full HD (1080p): $28/1,000 min
- **AINS**: $0.59/1,000 min per host
- **Screenshare Audio**: $0.99/1,000 min
- **Real-Time Speech-To-Text**: $16.99/1,000 min per host
- **Translation**: $8.99/1,000 min per host per translation language

### Tiered Discount System
- **Volume-based pricing**: Discounts increase with higher usage tiers
- **Per-resolution discounts**: Different discount rates for each resolution tier
- **Session-based calculation**: Discounts calculated based on monthly session count
- **Master discount**: Default discount applied to all tiers
- **Persistent storage**: Discount configurations saved in browser localStorage

## Browser Compatibility

This calculator works in all modern browsers that support:
- ES6 JavaScript features
- CSS Grid and Flexbox
- HTML5 form elements
- localStorage for saving discount configurations
- Blob API for CSV export
- Canvas API for PDF export

## Export Features

### PDF Export
- Exports detailed cost breakdown as PDF
- Uses jsPDF and html2canvas libraries
- Multi-page support for long breakdowns
- Professional formatting and layout

### CSV Export
- Exports cost details in CSV format
- Includes all breakdown sections
- Properly formatted for spreadsheet applications
- Handles special characters and formatting

## Contributing

Feel free to open issues for bugs or feature requests. Pull requests are welcome!

### Development Notes
- All calculations are performed client-side using JavaScript
- Discount configurations are persisted in browser localStorage
- The calculator supports both simple and advanced discount modes
- Export functionality requires internet connection for library loading

---

Enjoy using the Agora SDK Pricing Calculator! For official pricing information, please refer to [Agora's official documentation](https://docs.agora.io/en/Interactive%20Broadcast/billing_rtc).
