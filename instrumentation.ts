export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { connectDB } = await import("./lib/db");
    await connectDB().catch((e) =>
      console.error("[instrumentation] DB pre-warm failed:", e.message)
    );
  }
}
