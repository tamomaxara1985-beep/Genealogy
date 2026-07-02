// One-off: copy the single legacy researcherinfos doc into the researchers collection.
// Run once:  node scripts/migrate-researchers.mjs
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("MONGODB_URI not set"); process.exit(1); }

await mongoose.connect(uri);
const db = mongoose.connection.db;

const old = await db.collection("researcherinfos").findOne({});
if (!old) { console.log("No legacy researcher doc found. Nothing to migrate."); await mongoose.disconnect(); process.exit(0); }

const existing = await db.collection("researchers").findOne({ email: old.email });
if (existing) { console.log(`Already migrated (email ${old.email}). Skipping.`); await mongoose.disconnect(); process.exit(0); }

const now = new Date();
const doc = {
  name: { en: old.name ?? "", ka: "", he: "" },
  surname: { en: old.surname ?? "", ka: "", he: "" },
  email: old.email ?? "",
  phone: old.phone ?? "",
  region: old.region ?? "",
  createdAt: now,
  updatedAt: now,
};
const res = await db.collection("researchers").insertOne(doc);
console.log(`Migrated legacy researcher -> researchers/${res.insertedId}`);
await mongoose.disconnect();
