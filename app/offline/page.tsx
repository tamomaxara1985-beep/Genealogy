import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Offline — FamilyRoots",
}

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: "#059669",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 36,
          fontWeight: 700,
        }}
      >
        FR
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>You&apos;re offline</h1>
      <p style={{ color: "#4b5563", maxWidth: 360, margin: 0 }}>
        Reconnect to keep exploring your family tree. This page works without a
        connection, but your data needs the network.
      </p>
    </main>
  )
}
