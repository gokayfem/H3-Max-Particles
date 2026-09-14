# Security

This is a static client-side application. It does not require secrets, inference credentials, a database, or an account. Never add provider keys to browser code, CDN URLs, mix files, issues, or committed environment files.

Demo requests go to public media CDNs. Imported media is processed locally in browser storage. Clearing the site's stored data removes imported files and downloaded caches. Run the development server on loopback only; deploy the static files over HTTPS.

Only import media and mix files you trust. Browser codecs and graphics drivers are part of the application's security boundary; keep the browser updated. The secret checker is a baseline guard, not a guarantee of security. Dependencies and future changes still require review.

Report vulnerabilities privately through GitHub's private vulnerability reporting when available, or contact the repository owner privately. Do not publish credentials or private media in an issue.
