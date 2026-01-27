# Loyalty Cards

A Progressive Web App for storing and displaying digital loyalty cards on your phone.

**Live App:** https://gordon-williams.github.io/loyalty-cards/

## Features

- **Store loyalty cards** with support for multiple barcode formats
- **Wallet-style UI** with stacked cards
- **Full-screen barcode display** optimized for scanning at checkout
- **Camera scanning** to quickly add cards from physical cards
- **Location-based filtering** to show nearby store cards
- **Categories and search** for easy organization
- **Dark/light theme** with auto-detection
- **Offline support** via service worker
- **Export/import backup** to JSON

## Supported Barcode Formats

- **1D Barcodes:** CODE128, CODE39, EAN-13, EAN-8, UPC-A, ITF
- **2D Codes:** QR Code

## Installation

### As a PWA (Recommended)

1. Open https://gordon-williams.github.io/loyalty-cards/ in Safari (iOS) or Chrome (Android)
2. **iOS:** Tap Share → "Add to Home Screen"
3. **Android:** Tap menu → "Install app" or "Add to Home Screen"

### Self-Hosted

1. Clone or download this repository
2. Serve the files over HTTPS (required for PWA features)
3. Access via your web browser

## Usage

1. **Add a card:** Tap the + button, enter card details manually or scan a barcode
2. **View card:** Tap a card to select it, tap again for full-screen barcode
3. **Organize:** Use categories and search to find cards quickly
4. **Nearby:** Enable location to see cards for stores near you
5. **Backup:** Export your cards to JSON for safekeeping

## Privacy

All data is stored locally in your browser's localStorage. No data is sent to any server. Location is only used for the "Nearby" feature and is never stored or transmitted.

## License

MIT License - see [LICENSE](LICENSE) file.

## Acknowledgements

This project uses the following open-source libraries:

- **[JsBarcode](https://github.com/lindell/JsBarcode)** (MIT) - Barcode generation
- **[qrcode](https://github.com/soldair/node-qrcode)** (MIT) - QR code generation
- **[html5-qrcode](https://github.com/mebjas/html5-qrcode)** (Apache 2.0) - Barcode/QR scanning
- **[OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)** - Address search geocoding

Built with assistance from [Claude](https://claude.ai) by Anthropic.
