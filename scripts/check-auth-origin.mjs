// Read-only sign-in diagnostic: checks the generated authorization URL without
// visiting GitHub, exchanging a code, printing credentials or logging in.
const origin = process.env.APP_URL || "http://localhost:3000";
const csrfResponse = await fetch(`${origin}/api/auth/csrf`);
if (!csrfResponse.ok)
  throw Error(`CSRF endpoint returned ${csrfResponse.status}`);
const csrf = await csrfResponse.json();
const cookie = csrfResponse.headers
  .getSetCookie()
  .map((value) => value.split(";")[0])
  .join("; ");
const response = await fetch(`${origin}/api/auth/signin/github`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Auth-Return-Redirect": "1",
    Cookie: cookie,
    Origin: new URL(origin).origin,
  },
  body: new URLSearchParams({
    csrfToken: csrf.csrfToken,
    callbackUrl: `${origin}/settings`,
  }),
  redirect: "manual",
});
const result = await response.json();
const url = new URL(result.url);
if (url.hostname !== "github.com")
  throw Error(
    "Sign-in did not produce a GitHub authorization URL. Check server authentication logs.",
  );
const actual = url.searchParams.get("redirect_uri");
const expected = `${new URL(origin).origin}/api/auth/callback/github`;
if (actual !== expected)
  throw Error(
    `Callback origin mismatch: expected ${expected}, received ${actual}`,
  );
console.log(`GitHub callback verified locally: ${actual}`);
console.log(
  "GitHub was not contacted and no sign-in completed. Its registered callback must match this URL.",
);
