// Supabase Configuration
// Thay đổi các giá trị này theo project Supabase của bạn
const SUPABASE_CONFIG = {
    URL: 'https://xvcdjxhrhklibpjeizmt.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Y2RqeGhyaGtsaWJwamVpem10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMTQxNDgsImV4cCI6MjA2OTU5MDE0OH0.kT76MmN1aBFQub08Zpq-7t7V0X0iFldS8OAulHc0Cj4'
};

// Exam Configuration
const EXAM_CONFIG = {
    TIME_LIMIT: 3600, // 60 minutes in seconds
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SUPABASE_CONFIG, EXAM_CONFIG };
} 
