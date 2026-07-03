const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRealtimeConnection() {
  console.log("Testing Supabase realtime connection...");

  // Fetch existing data
  const { data, error } = await supabase.from("concepts").select("*");
  console.log("Fetched concepts:", data?.length || 0, "records");
  if (error) {
    console.error("Fetch error:", error);
    return;
  }

  // Subscribe to changes
  const channel = supabase
    .channel("test-channel")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "concepts" },
      (payload) => {
        console.log("🔔 Realtime event received:", payload.eventType, payload);
      }
    )
    .subscribe((status) => {
      console.log("✅ Subscription status:", status);
    });

  console.log("Subscription created. Listening for 30 seconds...");

  // Keep alive
  setTimeout(() => {
    console.log("Test complete. Unsubscribing...");
    channel.unsubscribe();
    process.exit(0);
  }, 30000);
}

testRealtimeConnection().catch(console.error);
