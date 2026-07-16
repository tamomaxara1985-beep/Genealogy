# Genealogy Mobile

Expo app for the Genealogy backend.

## Setup
1. `cd mobile && npm install`
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the LAN IP of
   your running Next.js backend (`npm run dev` in the repo root). A device
   cannot reach `localhost`.
3. `npx expo start`, then open in Expo Go or a simulator.

## Auth
Email/password login against `POST /api/mobile/login`. Token stored in
expo-secure-store, sent as `Authorization: Bearer <token>`.
