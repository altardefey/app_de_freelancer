
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yckfxydpokyvizvbjout.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2Z4eWRwb2t5dml6dmJqb3V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MjY1MDYsImV4cCI6MjEwNTQwMjUwNn0.bi5d6FmjWQzmX485Ew0zoAw90zAj4RAlWyFAA2q4m3w';

export const supabase = createClient(supabaseUrl, supabaseKey);
