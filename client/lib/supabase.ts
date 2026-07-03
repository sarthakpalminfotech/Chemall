import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://citvfveqmdtbhtmwsnwf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdHZmdmVxbWR0Ymh0bXdzbndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODEyMzIsImV4cCI6Mj98NTU3MjMyfQ.d7pv65T6ggE0Qd8g0bW35gnmswVZCNj30goN4xiSf7A"; // Note: User provided anon key is decoded / validated

// We will use the provided keys to connect to the Supabase backend.
export const supabase = createClient(SUPABASE_URL, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdHZmdmVxbWR0Ymh0bXdzbndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODEyMzIsImV4cCI6MjA5ODU1NzIzMn0.d7pv65T6ggE0Qd8g0bW35gnmswVZCNj30goN4xiSf7A");
