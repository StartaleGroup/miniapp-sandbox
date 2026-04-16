# Localhost Testing environment
Localhost setup for testing the notification server with the miniapp sandbox. This includes:
- A Firebase Cloud Function acting as the notification server
- CORS configuration to allow requests from the sandbox
- Environment variable management for API keys and URLs

## Start Miniapp
```bash
git clone git@github.com:Maar-io/mustard-farcaster-miniapp.git
cd mustard-farcaster-miniapp
npm i
docker compose up --build
```

## Start Sandbox
```bash
git clone git@github.com:StartaleGroup/miniapp-sandbox.git
cd miniapp-sandbox
git checkout feat/firebase
````
edit .env.local to set `VITE_NOTIFICATIONS_URL` and `VITE_NOTIFICATIONS_API_KEY` to your Firebase function URL and API key.

```bash
pnpm i
pnpm dev
``` 

## Firebase notifications server
It is running on URL: `https://notifications-a6nlxdy62q-uc.a.run.app` and accepts requests with the API key 


## How to test
1. Open the sandbox at `http://localhost:3100`
2. Open your miniapp from the gallery
3. Trigger a notification from the miniapp (e.g. by clicking a button that calls Test Notification)
4. Check the sandbox console for logs from the notification server
5. Check the miniapp UI for the received notification
6. There is 6 sec rate limit before you can send netxt notification. 

## Troubleshooting
- If notification is not received by sandbox UI try to disable/enable notifications in the miniapp to reset the token. Then trigger the notification again.
- Check the browser console for any CORS errors or network issues when sending the notification request. If miniapp is running on port 5174 cors will be happy. If you change the port, make sure to update the CORS configuration in the Firebase function accordingly.