<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 5e Initiative Player View

A real-time initiative tracker player view for D&D 5e, built with Angular. This app connects to a shared room to display combat turn order and player status in real-time.

## Features

- Real-time initiative tracking via WebSocket connection
- Room-based sharing with URL hash fragments
- Responsive design with Tailwind CSS
- Auto-reconnection with retry logic
- Clean, focused player view interface

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd 5e-initiative-player-view
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file (optional - for development):
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your configuration if needed.

## Development

Run the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:4200`.

## Building

Build for production:

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Testing

Run unit tests:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Usage

1. Open the app in your browser
2. Enter a room ID to connect to an existing initiative tracker session
3. The room ID is automatically saved in the URL for easy sharing
4. The app will automatically reconnect if the connection is lost

## Project Structure

```
src/
├── app/
│   ├── connection/     # Connection component
│   └── tracker/        # Initiative tracker display component
├── models/             # TypeScript interfaces and models
├── services/           # Angular services (TrackerSyncService)
├── utils/              # Utility functions (room ID management)
├── app.component.*     # Root application component
└── main.ts            # Application entry point
```

## Technologies

- Angular 21
- TypeScript
- Tailwind CSS
- Vitest (testing)
- RxJS

## License

MIT
