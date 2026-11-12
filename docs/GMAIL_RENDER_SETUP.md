# Gmail invitations on Render

Use the existing Render service URL as APP_URL. Keep separate GitHub OAuth apps for localhost and Render. For https://procureproof.onrender.com the hosted callback is https://procureproof.onrender.com/api/auth/callback/github. In Render Environment set APP_URL and AUTH_URL to https://procureproof.onrender.com and set the new OAuth app's AUTH_GITHUB_ID and AUTH_GITHUB_SECRET. Keep the owner allowlist. Never overwrite localhost credentials with hosted ones.

## Authorize one Gmail sender

1. In Google Cloud Console, enable Gmail API in your project.
2. Configure Google Auth Platform branding/audience. For a private hackathon test choose External/Testing and add the sender's Google account as a test user. Add the gmail.send scope in Data Access.
3. Create an OAuth client of type Web application. Add https://developers.google.com/oauthplayground as an authorized redirect URI.
4. Open https://developers.google.com/oauthplayground and open its gear/settings. Select Use your own OAuth credentials and enter that Google client ID and secret privately.
5. Request only https://www.googleapis.com/auth/gmail.send . Authorize using the mailbox that will send invitations. Exchange the authorization code for tokens. Save the refresh token privately; do not use the short-lived access token as the refresh token.
6. Set these in Render Environment:

```env
EMAIL_PROVIDER=gmail
GMAIL_CLIENT_ID=<Google client ID>
GMAIL_CLIENT_SECRET=<Google client secret>
GMAIL_REFRESH_TOKEN=<refresh token>
GMAIL_SENDER_EMAIL=<the authorized Gmail address>
```

Gmail mode does not require RESEND_API_KEY or EMAIL_FROM. This integration refreshes tokens and sends using Gmail API HTTPS, not SMTP. Testing-mode refresh tokens can expire after seven days; reconnect as required. Broader production distribution requires Google's applicable consent/verification process.

Save and deploy the updated code and environment. On the hosted app sign in as owner and open Connected sandbox. Create the request there; local SQLite records are not copied automatically. Add the supplier's actual email, create their private invitation, review recipient and public URL, then click Email invitation. That explicit action automatically sends the message through Gmail. Provider acceptance is not proof of inbox delivery. If the result is uncertain, inspect Gmail Sent before creating another invitation.

The local project must be committed and pushed to the branch Render deploys before the new Gmail controls work online. Use Render build logs and /api/health to check deployment. Do not deploy .env.local, local databases or test artifacts.

Official references: https://developers.google.com/workspace/gmail/api/guides/sending and https://developers.google.com/oauthplayground
