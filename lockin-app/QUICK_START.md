# 🚀 Quick Start Guide

Get Lock-In running in **2 minutes**.

## Step 1: Install (30 seconds)

```bash
cd lockin-app

# Install sync server
cd sync-server && npm install

# Install web app
cd ../web && npm install  

# Install mobile app
cd ../mobile && npm install
cd ..
```

## Step 2: Start Sync Server (10 seconds)

```bash
cd sync-server
npm start
```

**📝 Note your local IP** (shown in terminal, e.g., `192.168.1.100`)

## Step 3: Start Web App (10 seconds)

Open new terminal:

```bash
cd web
npm run dev
```

Opens at: `http://localhost:3000`

## Step 4: Start Mobile App (10 seconds)

Open another terminal:

```bash
cd mobile
npm start
```

📱 Scan QR code with Expo Go app

## Step 5: Pair Devices (60 seconds)

### On Mobile:
1. Open **Settings** tab (bottom right)
2. Enter sync server URL: `http://YOUR_LOCAL_IP:4000`
   - Replace YOUR_LOCAL_IP with IP from Step 2
3. Tap **"Connect"**
4. Check for green **"Connected"** status

### On Web:
- Should show **"Synced"** at top

## Step 6: Demo! (30 seconds)

1. Click **"🔒 Lock In"** on any task
2. Watch mobile timer start automatically
3. Close mobile app
4. Wait 10 seconds
5. See session end on both devices

**You're done!** 🎉

---

## Troubleshooting

### "Disconnected" status
- ✅ Check sync server is running
- ✅ Verify IP address (not `localhost` for mobile)
- ✅ Both devices on same WiFi

### Mobile not updating
- ✅ Pull down to refresh on Tasks tab
- ✅ Check Settings shows "Connected"

### Web not syncing
- ✅ Check browser console for errors
- ✅ Verify sync server URL

---

## What's Pre-Loaded

- ✅ 5 tasks across 3 courses
- ✅ Realistic due dates
- ✅ 3 hour daily / 12 hour weekly goals
- ✅ Demo-ready data

---

## Next Steps

1. Read [README.md](README.md) for full docs
2. Try the demo flow
3. Customize and build!

**Need help?** Check README troubleshooting or server logs.
