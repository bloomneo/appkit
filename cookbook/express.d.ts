// Local shim — cookbook recipes use Express but this repo doesn't ship
// @types/express. Consumers copying a recipe into their own app will have
// @types/express installed there; this declaration keeps `tsc --noEmit`
// green here without forcing a real dependency.
declare module 'express';
