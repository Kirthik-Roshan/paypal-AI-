import assert from "node:assert/strict";
import { test } from "node:test";
import { gmailSender } from "../src/lib/providers/gmail";
test("Gmail uses refreshed authorization and a base64url MIME message over HTTPS", async () => {
  for (const key of [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
  ])
    process.env[key] = "mock-only";
  process.env.GMAIL_SENDER_EMAIL = "buyer@example.com";
  let calls = 0;
  const transport = (async (url, init) => {
    calls++;
    if (calls === 1) {
      assert.equal(url, "https://oauth2.googleapis.com/token");
      assert.match(String(init?.body), /grant_type=refresh_token/);
      return Response.json({ access_token: "mock-token" });
    }
    assert.equal(
      url,
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    );
    const mime = Buffer.from(
      JSON.parse(String(init?.body)).raw,
      "base64url",
    ).toString();
    assert.match(mime, /To: supplier@example.com/);
    assert.match(mime, /From: buyer@example.com/);
    assert.ok(
      Buffer.from(mime.split("\r\n\r\n")[1], "base64")
        .toString()
        .includes("https://procureproof.example.com/quote/private"),
    );
    return Response.json({ id: "gmail-message" });
  }) as typeof fetch;
  const send = await gmailSender(transport);
  assert.equal(
    (
      await send(
        "supplier@example.com",
        "Quotation requested: Cola",
        "https://procureproof.example.com/quote/private",
      )
    ).status,
    200,
  );
  assert.equal(calls, 2);
  await assert.rejects(
    gmailSender((async () =>
      Response.json(
        {
          error: "invalid_client",
          error_description: "do not expose provider text",
        },
        { status: 401 },
      )) as typeof fetch),
    /401: invalid_client.*not a Places API key/,
  );
  await assert.rejects(
    gmailSender((async () =>
      Response.json(
        { error: "invalid_grant" },
        { status: 400 },
      )) as typeof fetch),
    /No email was sent/,
  );
});
