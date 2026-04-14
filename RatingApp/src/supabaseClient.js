import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vvlfjmporhpotwngngsg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bGZqbXBvcmhwb3R3bmduZ3NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODA1MjMsImV4cCI6MjA5MTU1NjUyM30.BwgDFSZt189gZrnPQ-njpfiiWid82TC-2L4GfeppxnM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
