# 5e Initiative Player View

A live, real-time player-facing view for the D&D 5th Edition initiative tracker on 5e.tools. This application provides players with a clean and clear interface to follow combat, see the turn order, and track status effects without revealing sensitive DM information like monster HP.

---

## Features

- **Live Combat Tracking:** Connects directly to your Dungeon Master's 5e.tools initiative tracker and updates in real-time.
- **Clear Turn Order:** Displays a sorted list of all combatants based on their initiative rolls.
- **Active Turn Highlighting:** The current creature's turn is prominently highlighted, so you always know who's up.
- **Creature Information:** See names, initiative scores, and active status effects for all creatures in combat.
- **Monster Health Status:** Monsters' general well-being is shown (Healthy, Hurt, Bloodied, Defeated) without revealing exact hit points.
- **Player & Monster Identification:** Easily distinguish between player characters and hostile creatures with distinct icons.
- **Resilient Connection:** Automatically attempts to reconnect if the connection to the DM is temporarily lost.
- **Thematic Design:** A fantasy-inspired interface to enhance immersion during your sessions.

## How to Use

Connecting to your DM's session is simple:

1.  Your Dungeon Master must add the **Initiative Tracker** widget to their [5e.tools DM Screen](https://5e.tools/dmscreen.html).
2.  Within the Initiative Tracker widget, the DM clicks the **"Player View"** button located in the toolbar.
3.  This action generates a unique link. The **Room ID** is the sequence of characters at the end of the link, after the `#` symbol (e.g., `.../dmscreen.html#RoomID123`).
4.  The DM shares this **Room ID** with the players.
5.  Open the 5e Initiative Player View application, enter the Room ID, and click "Connect to the Adventure"!

The tracker will appear and automatically sync with the DM's combat data.

## Technology Stack

This project is a modern, single-page web application built with:

-   **Angular:** A powerful framework for building dynamic web apps. This project uses the latest features, including standalone components and zoneless change detection for optimal performance.
-   **TypeScript:** For robust, type-safe code.
-   **Tailwind CSS:** A utility-first CSS framework for rapid and consistent styling.
-   **PeerJS:** Simplifies the WebRTC implementation, enabling a direct peer-to-peer connection between the DM and players for low-latency updates.
-   **GitHub Actions & Pages:** For continuous integration and automated deployment.

## Development

This project is a Progressive Web App (PWA) and does not require a traditional build step to run locally. Simply serve the repository's root directory with a local web server.

---

Happy adventuring!