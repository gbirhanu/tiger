-- Check if admin_settings table exists but is empty
INSERT INTO admin_settings (gemini_max_free_calls, enable_marketing, bank_account)
SELECT 5, 0, '' 
WHERE NOT EXISTS (SELECT 1 FROM admin_settings LIMIT 1);

-- Update admin_settings with values from user_settings where user_id=1 (if the values exist and are not null)
UPDATE admin_settings 
SET gemini_max_free_calls = (
    SELECT COALESCE(
        (SELECT gemini_max_free_calls FROM user_settings WHERE user_id = 1),
        gemini_max_free_calls
    )
    FROM admin_settings
),
enable_marketing = (
    SELECT COALESCE(
        (SELECT enable_marketing FROM user_settings WHERE user_id = 1),
        enable_marketing
    )
    FROM admin_settings
),
bank_account = (
    SELECT COALESCE(
        (SELECT bank_account FROM user_settings WHERE user_id = 1),
        bank_account
    )
    FROM admin_settings
)
WHERE EXISTS (SELECT 1 FROM user_settings WHERE user_id = 1); 