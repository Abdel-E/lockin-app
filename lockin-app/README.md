# 🔒 Lock-In Study App

**Cross-device synchronized study sessions with automatic accountability**

Demo-ready MVP built for hackathon. The killer feature: sessions automatically end if you switch apps or close tabs - no cheating!

## 🎯 Core Features

✅ **Cross-Device Real-Time Sync** - Start on web, continues on mobile  
✅ **Auto-End Enforcement** - Background/close app → session ends everywhere  
✅ **Progress Tracking** - Daily (🔴→🟡→🟢) and weekly goals  
✅ **Smart Prioritization** - Tasks sorted by urgency + difficulty  
✅ **No Database** - localStorage + AsyncStorage for instant setup  
✅ **Data Export/Import** - JSON format for portability  

## 🚀 Quick Start (3 Minutes)

### Prerequisites
- Node.js 18+
- Phone with Expo Go app
- Both devices on same WiFi

### 1. Install Dependencies

```bash
# Sync Server
cd sync-server
npm install

# Web App
cd ../web
npm install

# Mobile App
cd ../mobile
npm install
```

### 2. Start Servers

**Terminal 1 - Sync Server:**
```bash
cd sync-server
npm start
```
Note your local IP (e.g., `192.168.1.100`)

**Terminal 2 - Web App:**
```bash
cd web
npm run dev
```
Opens at: http://localhost:3000

**Terminal 3 - Mobile App:**
```bash
cd mobile
npm start
```
Scan QR with Expo Go

### 3. Pair Devices

**On Mobile:**
1. Open Settings tab
2. Enter: `http://YOUR_LOCAL_IP:4000`
3. Tap "Connect"
4. Check for green "Connected" status

### 4. Demo!

1. Click "Lock In" on any task in web
2. Watch mobile timer start automatically
3. Close mobile app or switch tabs
4. Wait 10 seconds
5. Both devices end session automatically

**You're done!** 🎉

## 📱 Architecture

```
┌─────────────┐         ┌─────────────┐
│   Web App   │◄───────►│ Sync Server │
│  (React)    │         │ (Socket.IO) │
└─────────────┘         └─────────────┘
                              ▲
                              │
                              ▼
                        ┌─────────────┐
                        │ Mobile App  │
                        │   (Expo)    │
                        └─────────────┘
```

**Tech Stack:**
- **Web**: React + Vite + Tailwind CSS
- **Mobile**: React Native + Expo
- **Server**: Node.js + Express + Socket.IO
- **Storage**: localStorage + AsyncStorage (no database!)

## 🎬 Demo Flow (2 Minutes)

**Act 1: Web → Mobile Sync (30s)**
- Lock In on web → mobile starts automatically
- Close mobile app → both end after 10s

**Act 2: Mobile → Web Sync (30s)**
- Lock In on mobile → web starts automatically  
- Close web tab → both end after 10s

**Act 3: Progress Tracking (30s)**
- Show color-coded daily progress bar
- Explain Red (0-33%) → Yellow (34-66%) → Green (67%+)
- Show weekly progress chip

**Act 4: Features (30s)**
- Export/Import data
- Task prioritization
- Session history

## 🔧 How It Works

### Session Sync Logic

1. **Start**: Any device emits `session:start` → server broadcasts to all
2. **Heartbeat**: Active device sends pulse every 5s
3. **Grace Period**: 10s client-side buffer before ending
4. **Server TTL**: 15s timeout if no heartbeat
5. **Auto-End**: Server broadcasts `session:stopped` to all devices

### Auto-End Triggers

**Web:**
- Tab hidden for 10+ seconds (visibilitychange API)
- Browser closed
- No heartbeat for 15s

**Mobile:**
- App backgrounded for 10+ seconds (AppState API)
- App closed
- Network drops

## 📊 Seed Data

Pre-loaded with realistic student data:
- **5 Tasks**: Physics, Chemistry, Circuits assignments
- **Due Dates**: Spread across next week
- **Study Goals**: 3h daily, 12h weekly
- **Course Ranking**: Physics (weakest) → Chemistry (strongest)

## 🎨 UI Features

### Progress Bar Colors
- 🔴 **Red (0-33%)**: Behind on goals
- 🟡 **Yellow (34-66%)**: On track
- 🟢 **Green (67%+)**: Ahead of schedule

### Task Urgency Indicators
- **Red border**: < 1 day until due
- **Orange border**: 1-3 days
- **Green border**: > 3 days

### Priority Sorting
Tasks sorted by:
1. Priority score (AI-calculated from due date + course difficulty)
2. Hours remaining (most hours first as tiebreaker)

## 🐛 Troubleshooting

### "Not connected to sync server"
- Ensure server is running: `cd sync-server && npm start`
- Check URL is correct (use local IP for mobile, not `localhost`)
- Verify firewall allows port 4000

### Mobile not syncing
- Both devices on same WiFi
- Use local IP address (e.g., `http://192.168.1.100:4000`)
- Check Settings → Connection Status shows green

### Session doesn't auto-end
- Grace period is 10-15 seconds - be patient!
- Check console logs for errors
- Verify heartbeat being sent (server logs)

### Web app won't start
- Run `npm install` in web folder
- Check port 3000 is available
- Clear browser cache

### Mobile app crashes
- Run `npm install` in mobile folder
- Restart Expo dev server
- Clear Expo cache: `expo start -c`

## 📦 Data Management

**Export:**
- Web: Click "Export" button → downloads JSON
- Mobile: Settings → Export Data

**Import:**
- Web: Click "Import" button → select JSON file
- Mobile: Settings → Import Data

Perfect for:
- Backing up before demo
- Sharing with judges
- Resetting to known state

## 🔑 Environment Variables

### Web (.env)
```bash
VITE_SYNC_SERVER_URL=http://localhost:4000
# For mobile pairing, use your local IP:
# VITE_SYNC_SERVER_URL=http://192.168.1.100:4000
```

### Mobile
All configuration done through Settings UI - no .env needed!

## 📁 Project Structure

```
lockin-app/
├── web/                   # React web app
│   ├── src/
│   │   ├── components/    # TaskList, Timer, ProgressBar
│   │   ├── hooks/         # useSession (Socket.IO)
│   │   ├── utils/         # storage, seedData
│   │   └── App.jsx        # Main component
│   └── package.json
│
├── mobile/                # Expo React Native app
│   ├── app/               # ToDoScreen, TimerScreen, SettingsScreen
│   ├── hooks/             # useSession (AppState)
│   ├── utils/             # storage, seedData
│   └── App.js             # Main with navigation
│
├── sync-server/           # Node.js Socket.IO server
│   ├── server.js          # Session management + heartbeat
│   └── package.json
│
└── shared/                # Shared type definitions
    └── types.js           # JSDoc typedefs
```

## 🎓 Technical Highlights

**Why Socket.IO?**
- Real-time bidirectional communication
- Automatic reconnection
- Room-based architecture scales well

**Why No Database?**
- Instant setup, zero config
- Perfect for hackathon demo
- Easy to understand and modify

**Why Server-Authoritative?**
- Single source of truth
- No split-brain scenarios
- TTL-based auto-end is reliable

**Why Grace Period?**
- Prevents accidental session ends
- Gives time to check notifications
- Still enforces accountability

## 🚧 Known Limitations (MVP)

- No AI planning (placeholder ready for Gemini)
- No Google Calendar integration (placeholder ready)
- No user authentication (single-user demo)
- No push notifications
- Storage is local only (no cloud backup)

## 🎯 Future Enhancements

- [ ] Gemini AI study planning
- [ ] Google Calendar read/write
- [ ] Schedule screenshot parsing
- [ ] Push notifications for reminders
- [ ] Multi-user with authentication
- [ ] Cloud database + sync
- [ ] Pomodoro timer mode
- [ ] Study streaks & gamification

## 📝 Development Notes

**Time Spent**: ~16 hours
- Sync server: 2h
- Web app: 6h
- Mobile app: 6h
- Documentation: 2h

**Lines of Code**: ~2,500
**Files**: 25+

## 📄 License

MIT - Built for hackathon demo

## 🙏 Acknowledgments

Built with:
- React, React Native, Expo
- Socket.IO, Node.js, Express
- Tailwind CSS, React Navigation
- date-fns for date formatting

---

**Ready to Lock In?** 🚀

Start the servers, pair your devices, and experience accountability-enforced study sessions!
