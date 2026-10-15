# Arena Duel — 3D Arena Shooter

A first-person 3D arena shooter that runs right in your browser. Fight a computer-controlled bot or challenge a friend online in a neon-lit arena. First to 5 kills wins.

## ▶ Play now

**https://shulabh-968026.github.io/arena-shooter-3d/**

Nothing to install. Works in any modern desktop browser (Chrome, Edge, Firefox, Safari). A keyboard is required.

## How to play

1. Enter your **callsign** (player name) on the main menu.
2. Pick a mode:
   - **VS Bot**: choose Easy, Normal or Hard and click **Enter Arena**.
   - **Online 1v1**: play a friend (see [Playing online](#playing-online)).
3. Eliminate your opponent. Each kill wins a round, and the first to **5** wins the match.

### Controls

| Key | Action |
|---|---|
| `↑` / `↓` | Move forward / back |
| `←` / `→` | Turn left / right |
| `Space` | Shoot (hold for rapid fire) |
| Mouse | Aim: look left/right and up/down (click the game to capture the mouse) |
| Left / right click | Shoot / reload |
| `Shift` + `←` / `→` | Strafe sideways |
| `1` – `4` | Select weapon |
| `Q` / `E` or mouse wheel | Previous / next weapon |
| `R` | Reload |
| `P` / `Esc` | Pause (VS Bot only). `Esc` also releases the mouse |

You can play keyboard-only (classic arrow keys + space) or use the mouse for aiming. Both work at the same time. Mouse sensitivity can be adjusted on the main menu and is remembered.

### Weapons

| # | Weapon | Notes |
|---|---|---|
| 1 | **Pistol** | Accurate, unlimited reserve ammo |
| 2 | **Assault Rifle** | Very fast fire rate, low damage per bullet |
| 3 | **Shotgun** | 8 pellets per shot. Devastating up close, useless at range |
| 4 | **Railgun** | Instant beam, 75 damage, slow to fire |

### Pickups

- **Green medkits** restore 40 health.
- **Yellow ammo crates** refill reserve ammo for every weapon.
- Both respawn 15 seconds after they're picked up.

### Tips

- Use the pillars and walls for cover. The bot only shoots when it can see you.
- Keep moving sideways. Enemy shots are projectiles, so you can dodge them.
- The bot gets faster and more accurate every round.
- When your health is low, the bot will head for a medkit, and so should you.
- The red arc around your crosshair points toward whoever is shooting you.

## Playing online

1. Both players open the [game link](https://shulabh-968026.github.io/arena-shooter-3d/) and enter their names.
2. One player chooses **Online 1v1 → Create Room** and shares the 5-character code (click the code to copy it).
3. The other player chooses **Online 1v1**, enters the code and clicks **Join Room**.
4. The match starts automatically as soon as you're connected.

Online play connects the two browsers directly (peer-to-peer WebRTC through the free [PeerJS](https://peerjs.com/) service), so no game server is needed. Both players need an internet connection. Strict office or school networks may block the connection.

## Leaderboard & match history

Every finished match is saved in your browser with your name, opponent, score, result and accuracy. Open the **Leaderboard** tab on the main menu to see the top players, filtered by All, Vs Bot or Online, or the **History** tab to see recent matches.

Stats are stored locally (`localStorage`), so they're specific to each browser and device.

## Run locally

Clone the repository and open `index.html` in a browser:

```bash
git clone https://github.com/Shulabh-968026/arena-shooter-3d.git
cd arena-shooter-3d
```

For online play while testing locally, serve the folder over HTTP instead of opening the file directly:

```bash
python -m http.server 8000
# then open http://localhost:8000 in two browser windows
```

## Built with

- [Three.js](https://threejs.org/) for 3D rendering
- [PeerJS](https://peerjs.com/) for online multiplayer over WebRTC
- Plain HTML, CSS and JavaScript, with no build step. Sound effects are generated in code with the Web Audio API.

| File | Purpose |
|---|---|
| `index.html` | Page layout, menus and HUD |
| `style.css` | Neon theme and responsive layout |
| `game.js` | Game engine, bot AI, weapons, networking and stats |
