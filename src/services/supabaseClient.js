// src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Reemplaza con tus datos reales copiados en el Paso 2
const SUPABASE_URL = 'https://yvzpflcyeigxiyaxxtif.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2enBmbGN5ZWlneGl5YXh4dGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MTM0NzgsImV4cCI6MjEwOTI4OTQ3OH0.XtuVMM4OHg3U-12hKrXqnXSM1uPZuwQ-vyuQf8MIaDY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});