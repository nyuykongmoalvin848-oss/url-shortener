INSERT INTO links (code, target_url)
VALUES
    ('welcome', 'https://example.com/'),
    ('project-docs', 'https://example.com/docs')
ON CONFLICT (code) DO NOTHING;