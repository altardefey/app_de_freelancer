import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yckfxydpokyvizvbjout.supabase.co/rest/v1/';
const supabaseKey = 'sb_publishable_ETA_Jjo0W-yCYpPoVDlu2w_XzEvYQ2V';

export const supabase = createClient(supabaseUrl, supabaseKey);
